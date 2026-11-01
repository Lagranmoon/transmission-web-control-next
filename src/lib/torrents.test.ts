// torrents.ts 数据层测试 — 快照构建 / 状态分类 / 目录树与 tracker 聚合 / 搜索
// 模块内是可变单例状态（snapshot/dirSet/seq + configStore），每个用例前 resetModules 取全新实例；
// 测试数据按 types.ts 的类型手工构造，不依赖网络与真实 RPC
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STATUS, type Torrent, type TrackerStat } from './types'

let mod: typeof import('./torrents')
let config: typeof import('./config')

beforeEach(async () => {
  vi.resetModules()
  mod = await import('./torrents')
  config = await import('./config')
})

/** 构造一条字段齐全的种子（字段集取自 types.ts 的 Torrent） */
function makeTorrent(
  overrides: Partial<Torrent> & Pick<Torrent, 'id'>,
): Torrent {
  return {
    name: `torrent-${overrides.id}`,
    status: STATUS.stopped,
    hashString: `hash-${overrides.id}`,
    totalSize: 1000,
    percentDone: 0,
    addedDate: 0,
    leftUntilDone: 1000,
    rateDownload: 0,
    rateUpload: 0,
    recheckProgress: 0,
    peersGettingFromUs: 0,
    peersSendingToUs: 0,
    uploadRatio: 0,
    uploadedEver: 0,
    downloadedEver: 0,
    downloadDir: '/data',
    error: 0,
    errorString: '',
    doneDate: 0,
    queuePosition: 0,
    activityDate: 0,
    ...overrides,
  }
}

/** 构造一条 trackerStat（默认：已成功 announce、活跃状态） */
function makeTracker(
  overrides: Partial<TrackerStat> & Pick<TrackerStat, 'id'>,
): TrackerStat {
  return {
    announce: 'http://announce.invalid/announce',
    announceState: 3,
    downloadCount: 0,
    hasAnnounced: true,
    host: 'http://host.invalid/announce',
    isBackup: false,
    lastAnnouncePeerCount: 0,
    lastAnnounceResult: '',
    lastAnnounceStartTime: 0,
    lastAnnounceSucceeded: true,
    lastAnnounceTime: 0,
    lastAnnounceTimedOut: false,
    leecherCount: 0,
    nextAnnounceTime: 0,
    seederCount: 0,
    scrapeState: 0,
    ...overrides,
  }
}

describe('ingestTorrents · 快照构建', () => {
  it('首次 ingest 建立全量快照：count/totalSize/all，isInited 置位，version 自 1 递增', () => {
    expect(mod.isInited()).toBe(false)
    expect(mod.getSnapshot().count).toBe(0)

    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, totalSize: 1000 }),
        makeTorrent({ id: 2, totalSize: 2500 }),
      ],
      undefined,
    )
    expect(mod.isInited()).toBe(true)
    expect(snap.count).toBe(2)
    expect(snap.totalSize).toBe(3500)
    expect(Object.keys(snap.all).map(Number).sort()).toEqual([1, 2])
    expect(snap.version).toBe(1)
    // getSnapshot 返回当前快照本体
    expect(mod.getSnapshot()).toBe(snap)

    expect(mod.ingestTorrents([], undefined).version).toBe(2)
  })

  it('增量合并：同 id 只回传部分字段时，新字段覆盖、旧字段沿用', () => {
    mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          name: 'old',
          totalSize: 1000,
          downloadDir: '/data',
        }),
      ],
      undefined,
    )
    const snap = mod.ingestTorrents(
      // 模拟 recent-only 增量回包只带 4 个字段
      [
        {
          id: 1,
          name: 'renamed',
          status: STATUS.download,
          queuePosition: 0,
        } as Torrent,
      ],
      undefined,
    )
    const t = snap.all[1]
    expect(t.name).toBe('renamed')
    expect(t.status).toBe(STATUS.download)
    expect(t.totalSize).toBe(1000)
    expect(t.downloadDir).toBe('/data')
    // count 按合并后的全量 map 计数，而非本批条数
    expect(snap.count).toBe(1)
  })

  it('removed 将种子从 all 与全部派生列表移除；未收录 id 是无害 no-op', () => {
    const a = makeTorrent({ id: 1, status: STATUS.stopped })
    const b = makeTorrent({
      id: 2,
      status: STATUS.download,
      rateDownload: 100,
      totalSize: 400,
    })
    mod.ingestTorrents([a, b], undefined)

    const snap = mod.ingestTorrents([], [1])
    expect(Object.keys(snap.all)).toEqual(['2'])
    expect(snap.count).toBe(1)
    expect(snap.totalSize).toBe(400)
    expect(snap.paused).toEqual([])
    expect(snap.downloading.map((t) => t.id)).toEqual([2])

    expect(mod.ingestTorrents([], [999]).count).toBe(1)
  })

  it('recentlyIds 仅为本批活动 id，不与上一批累积', () => {
    mod.ingestTorrents([makeTorrent({ id: 1 })], undefined)
    expect(mod.getSnapshot().recentlyIds).toEqual(new Set([1]))

    mod.ingestTorrents([makeTorrent({ id: 2 })], undefined)
    expect(mod.getSnapshot().recentlyIds).toEqual(new Set([2]))

    mod.ingestTorrents([], undefined)
    expect(mod.getSnapshot().recentlyIds.size).toBe(0)
  })

  it('uploadRatio：无任何流量强制 -1；有流量保留原值；非法值归 0', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          uploadedEver: 0,
          downloadedEver: 0,
          uploadRatio: 5,
        }),
        makeTorrent({
          id: 2,
          uploadedEver: 10,
          downloadedEver: 5,
          uploadRatio: 2,
        }),
        makeTorrent({
          id: 3,
          uploadedEver: 10,
          downloadedEver: 5,
          uploadRatio: Number.NaN,
        }),
      ],
      undefined,
    )
    expect(snap.all[1].uploadRatio).toBe(-1)
    expect(snap.all[2].uploadRatio).toBe(2)
    expect(snap.all[3].uploadRatio).toBe(0)
  })

  it('remainingTime：有下载速度时 = 剩余字节/速度 向下取整成毫秒', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, rateDownload: 1000, leftUntilDone: 1500 }),
        makeTorrent({ id: 2, rateDownload: 3, leftUntilDone: 1 }),
      ],
      undefined,
    )
    expect(snap.all[1].remainingTime).toBe(1500)
    expect(snap.all[2].remainingTime).toBe(333) // 1/3 秒 → floor
  })

  it('remainingTime 边界：完成=0；无速度停在中途=未知；0 字节 magnet=未知', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          rateDownload: 0,
          leftUntilDone: 0,
          totalSize: 100,
        }),
        makeTorrent({
          id: 2,
          rateDownload: 0,
          leftUntilDone: 500,
          totalSize: 100,
        }),
        makeTorrent({ id: 3, rateDownload: 0, leftUntilDone: 0, totalSize: 0 }),
      ],
      undefined,
    )
    expect(snap.all[1].remainingTime).toBe(0)
    expect(snap.all[2].remainingTime).toBe(3153600000000)
    expect(snap.all[3].remainingTime).toBe(3153600000000)
  })
})

describe('状态分类', () => {
  it('状态分桶：stopped→paused，download→downloading，seed 只进 status[6]', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, status: STATUS.stopped }),
        makeTorrent({ id: 2, status: STATUS.download }),
        makeTorrent({ id: 3, status: STATUS.seed }),
      ],
      undefined,
    )
    expect(snap.status[STATUS.stopped].map((t) => t.id)).toEqual([1])
    expect(snap.paused.map((t) => t.id)).toEqual([1])
    expect(snap.status[STATUS.download].map((t) => t.id)).toEqual([2])
    expect(snap.downloading.map((t) => t.id)).toEqual([2])
    expect(snap.status[STATUS.seed].map((t) => t.id)).toEqual([3])
    expect(snap.paused).not.toContain(snap.all[3])
    expect(snap.downloading).not.toContain(snap.all[3])
  })

  it('同组列表按 queuePosition 升序', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, status: STATUS.download, queuePosition: 2 }),
        makeTorrent({ id: 2, status: STATUS.download, queuePosition: 0 }),
        makeTorrent({ id: 3, status: STATUS.download, queuePosition: 1 }),
      ],
      undefined,
    )
    expect(snap.downloading.map((t) => t.id)).toEqual([2, 3, 1])
    expect(snap.status[STATUS.download].map((t) => t.id)).toEqual([2, 3, 1])
  })

  it('actively：任一方向速率 >0 即活跃，双 0 不活跃', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, rateUpload: 100, rateDownload: 0 }),
        makeTorrent({ id: 2, rateUpload: 0, rateDownload: 200 }),
        makeTorrent({ id: 3, rateUpload: 10, rateDownload: 20 }),
        makeTorrent({ id: 4, rateUpload: 0, rateDownload: 0 }),
      ],
      undefined,
    )
    expect(snap.actively.map((t) => t.id).sort()).toEqual([1, 2, 3])
  })

  it('error 非 0 进 error 列表，errorString 原样保留', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, error: 3, errorString: 'Unregistered torrent' }),
        makeTorrent({ id: 2, error: 0 }),
      ],
      undefined,
    )
    expect(snap.error.map((t) => t.id)).toEqual([1])
    expect(snap.error[0].errorString).toBe('Unregistered torrent')
  })
})

describe('目录树聚合', () => {
  it('多级目录逐级建节点：父/子节点均计入该种子，path 逐级拼接', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          totalSize: 1234,
          downloadDir: '/downloads/linux/isos',
        }),
      ],
      undefined,
    )
    // 节点 key = folders-<validTreeKey(段)> 依序拼接（base64，=/+ 替换为 0）
    expect(Object.keys(snap.folders)).toEqual([
      'folders-ZG93bmxvYWRz',
      'folders-ZG93bmxvYWRzbGludXg0',
      'folders-ZG93bmxvYWRzbGludXg0aXNvcw00',
    ])
    const [root, mid, leaf] = Object.values(snap.folders)
    expect(root.path).toBe('downloads')
    expect(mid.path).toBe('downloads/linux')
    expect(leaf.path).toBe('downloads/linux/isos')
    for (const node of [root, mid, leaf]) {
      expect(node.count).toBe(1)
      expect(node.size).toBe(1234)
      expect(node.torrents).toEqual([snap.all[1]])
    }
  })

  it('兄弟目录在公共父节点聚合 count/size', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, totalSize: 100, downloadDir: '/data/a' }),
        makeTorrent({ id: 2, totalSize: 300, downloadDir: '/data/b' }),
      ],
      undefined,
    )
    const parent = snap.folders['folders-ZGF0YQ00']
    expect(parent.count).toBe(2)
    expect(parent.size).toBe(400)
    expect(parent.torrents.map((t) => t.id).sort()).toEqual([1, 2])
    expect(snap.folders['folders-ZGF0YQ00YQ00']).toMatchObject({
      count: 1,
      size: 100,
      path: 'data/a',
    })
    expect(snap.folders['folders-ZGF0YQ00Yg00']).toMatchObject({
      count: 1,
      size: 300,
      path: 'data/b',
    })
  })

  it('同目录多个种子在叶子节点累计 count/size', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, totalSize: 100, downloadDir: '/data/a' }),
        makeTorrent({ id: 2, totalSize: 50, downloadDir: '/data/a' }),
      ],
      undefined,
    )
    expect(snap.folders['folders-ZGF0YQ00YQ00']).toMatchObject({
      count: 2,
      size: 150,
    })
  })

  it('Windows 反斜杠路径按 / 拆分建树', () => {
    const snap = mod.ingestTorrents(
      [makeTorrent({ id: 1, downloadDir: 'C:\\Downloads\\isos' })],
      undefined,
    )
    expect(Object.keys(snap.folders)).toEqual([
      'folders-Qzo0',
      'folders-Qzo0RG93bmxvYWRz',
      'folders-Qzo0RG93bmxvYWRzaXNvcw00',
    ])
    expect(Object.values(snap.folders).map((n) => n.path)).toEqual([
      'C:',
      'C:/Downloads',
      'C:/Downloads/isos',
    ])
  })

  it('空 downloadDir 不产生节点；中文目录 key 稳定生成', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, downloadDir: '' }),
        makeTorrent({ id: 2, downloadDir: '/下载' }),
      ],
      undefined,
    )
    expect(Object.keys(snap.folders)).toEqual(['folders-5LiL6L29'])
    expect(snap.folders['folders-5LiL6L29']).toMatchObject({
      path: '下载',
      count: 1,
    })
  })
})

describe('downloadDirs', () => {
  it('去重并排序，空目录不收录', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, downloadDir: '/b' }),
        makeTorrent({ id: 2, downloadDir: '/a' }),
        makeTorrent({ id: 3, downloadDir: '/b' }),
        makeTorrent({ id: 4, downloadDir: '' }),
      ],
      undefined,
    )
    expect(snap.downloadDirs).toEqual(['/a', '/b'])
  })
})

describe('tracker 聚合', () => {
  it('按主机建节点：nodeid/name/host/count/size/torrents，默认 connected', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          totalSize: 1234,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://tracker.example.com:80/announce',
            }),
          ],
        }),
      ],
      undefined,
    )
    const node = snap.trackers['tracker-example-com']
    expect(node).toBeDefined()
    // host 去协议/端口后剥离 tracker 前缀；host 字段保留原始值
    expect(node).toMatchObject({
      nodeid: 'tracker-example-com',
      name: 'example.com',
      host: 'http://tracker.example.com:80/announce',
      count: 1,
      size: 1234,
      connected: true,
    })
    expect(node.torrents).toEqual([snap.all[1]])
  })

  it('tracker/www/announce 前缀剥离后归并到同一节点', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          totalSize: 100,
          trackerStats: [
            makeTracker({ id: 1, host: 'http://tracker.example.com/announce' }),
          ],
        }),
        makeTorrent({
          id: 2,
          totalSize: 200,
          trackerStats: [
            makeTracker({ id: 2, host: 'http://www.example.com/announce' }),
          ],
        }),
      ],
      undefined,
    )
    expect(Object.keys(snap.trackers)).toEqual(['tracker-example-com'])
    expect(snap.trackers['tracker-example-com']).toMatchObject({
      count: 2,
      size: 300,
    })
  })

  it('leecher/seeder 按条目累加并格式化；trackers 为去重 name 的分号串', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          peersGettingFromUs: 1,
          peersSendingToUs: 2,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://t1.example.com/announce',
              leecherCount: 3,
              seederCount: 10,
            }),
            makeTracker({
              id: 2,
              host: 'http://t2.example.com/announce',
              leecherCount: 2,
              seederCount: 5,
            }),
            // 同 host 重复条目：节点只计一次，但 leecher/seeder 照加（与移植源一致）
            makeTracker({
              id: 3,
              host: 'http://t1.example.com/announce',
              leecherCount: 3,
              seederCount: 10,
            }),
          ],
        }),
      ],
      undefined,
    )
    const t = snap.all[1]
    expect(t.leecherCount).toBe(8) // 3+2+3
    expect(t.seederCount).toBe(25) // 10+5+10
    expect(t.leecher).toBe('8 (1)')
    expect(t.seeder).toBe('25 (2)')
    expect(t.trackers).toBe('t1.example.com;t2.example.com')
    expect(snap.trackers['tracker-t1-example-com']).toMatchObject({
      count: 1,
      size: 1000,
    })
  })

  it('同一 tracker 被多种子共享：节点只建一次，count/size 汇总', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          totalSize: 100,
          trackerStats: [
            makeTracker({ id: 1, host: 'http://shared.example.com/announce' }),
          ],
        }),
        makeTorrent({
          id: 2,
          totalSize: 250,
          trackerStats: [
            makeTracker({ id: 2, host: 'http://shared.example.com/announce' }),
          ],
        }),
      ],
      undefined,
    )
    expect(snap.trackers['tracker-shared-example-com']).toMatchObject({
      count: 2,
      size: 350,
    })
  })

  it('BT 边界：恰好 5 个 tracker 不算 BT', () => {
    const stats = Array.from({ length: 5 }, (_, i) =>
      makeTracker({ id: i, host: `http://f${i}.example.com/announce` }),
    )
    const snap = mod.ingestTorrents(
      [makeTorrent({ id: 1, trackerStats: stats })],
      undefined,
    )
    expect(snap.btItems).toEqual([])
    expect(snap.trackers['tracker-f0-example-com'].isBT).toBe(false)
  })

  it('BT 边界：6 个 tracker 计入 btItems 且节点 isBT', () => {
    const stats = Array.from({ length: 6 }, (_, i) =>
      makeTracker({ id: i, host: `http://bt${i}.example.com/announce` }),
    )
    const snap = mod.ingestTorrents(
      [makeTorrent({ id: 1, trackerStats: stats })],
      undefined,
    )
    expect(snap.btItems.map((t) => t.id)).toEqual([1])
    expect(snap.trackers['tracker-bt0-example-com'].isBT).toBe(true)
  })

  it('announce 失败且结果为 could not connect to tracker 时，节点置 connected=false', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://down.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: 'Could not connect to tracker',
            }),
          ],
        }),
      ],
      undefined,
    )
    expect(snap.trackers['tracker-down-example-com'].connected).toBe(false)
  })

  it('announceState=0（未启用）或失败原因非连接错误时，connected 保持 true', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://idle.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 0,
              lastAnnounceResult: 'Could not connect to tracker',
            }),
            makeTracker({
              id: 2,
              host: 'http://http404.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: 'Server returned 404: Not Found',
            }),
          ],
        }),
      ],
      undefined,
    )
    expect(snap.trackers['tracker-idle-example-com'].connected).toBe(true)
    expect(snap.trackers['tracker-http404-example-com'].connected).toBe(true)
  })

  it('全部 tracker 失败时 warning=各结果分号连接，nextAnnounceTime 取最小', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://a.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: 'Could not connect to tracker',
              nextAnnounceTime: 200,
            }),
            makeTracker({
              id: 2,
              host: 'http://b.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: 'B err',
              nextAnnounceTime: 100,
            }),
          ],
        }),
      ],
      undefined,
    )
    const t = snap.all[1]
    expect(t.warning).toBe('Could not connect to tracker;B err')
    expect(t.nextAnnounceTime).toBe(100)
    expect(snap.warning.map((x) => x.id)).toEqual([1])
  })

  it('部分 tracker 成功则不产生 warning，也不写 nextAnnounceTime', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://ok.example.com/announce',
              lastAnnounceSucceeded: true,
            }),
            makeTracker({
              id: 2,
              host: 'http://bad.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: 'B err',
              nextAnnounceTime: 100,
            }),
          ],
        }),
      ],
      undefined,
    )
    expect(snap.all[1].warning).toBeUndefined()
    expect(snap.all[1].nextAnnounceTime).toBeUndefined()
    expect(snap.warning).toEqual([])
  })

  it('全部失败但结果均为空串时 warning 为空串（不进 warning 列表）', () => {
    const snap = mod.ingestTorrents(
      [
        makeTorrent({
          id: 1,
          trackerStats: [
            makeTracker({
              id: 1,
              host: 'http://a.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: '',
            }),
            makeTracker({
              id: 2,
              host: 'http://b.example.com/announce',
              lastAnnounceSucceeded: false,
              announceState: 1,
              lastAnnounceResult: '',
            }),
          ],
        }),
      ],
      undefined,
    )
    expect(snap.all[1].warning).toBe('')
    expect(snap.warning).toEqual([])
  })

  it('无 trackerStats 的种子：不建节点，也不产生 leecher/seeder/trackers 派生字段', () => {
    const snap = mod.ingestTorrents([makeTorrent({ id: 1 })], undefined)
    expect(snap.trackers).toEqual({})
    const t = snap.all[1]
    expect(t.leecher).toBeUndefined()
    expect(t.seeder).toBeUndefined()
    expect(t.trackers).toBeUndefined()
  })
})

describe('用户标签', () => {
  it('labelMaps 按 hashString 附加 labels；取消映射后重新 ingest 清除残留', () => {
    config.configStore.set({ labelMaps: { 'hash-1': [2, 7] } })
    const snap = mod.ingestTorrents(
      [
        makeTorrent({ id: 1, hashString: 'hash-1' }),
        makeTorrent({ id: 2, hashString: 'hash-2' }),
      ],
      undefined,
    )
    expect(snap.all[1].labels).toEqual([2, 7])
    expect(snap.all[2].labels).toBeUndefined()

    config.configStore.set({ labelMaps: {} })
    // 空增量也会对全量重跑标签逻辑
    const snap2 = mod.ingestTorrents([], undefined)
    expect(snap2.all[1].labels).toBeUndefined()
  })
})

describe('搜索', () => {
  it('setSearchResult 按名称大小写不敏感子串过滤并写入快照', () => {
    mod.ingestTorrents(
      [
        makeTorrent({ id: 1, name: 'Ubuntu ISO' }),
        makeTorrent({ id: 2, name: 'debian netinst' }),
      ],
      undefined,
    )
    const result = mod.setSearchResult('UBUNTU')
    expect(result.map((t) => t.id)).toEqual([1])
    const snap = mod.getSnapshot()
    expect(snap.searchKey).toBe('UBUNTU')
    expect(snap.searchResult).toBe(result)
  })

  it('空关键字返回空数组', () => {
    mod.ingestTorrents([makeTorrent({ id: 1, name: 'Ubuntu ISO' })], undefined)
    expect(mod.setSearchResult('')).toEqual([])
    expect(mod.getSnapshot().searchResult).toEqual([])
  })

  it('持有搜索词时增量刷新会重算 searchResult，纳入新匹配种子', () => {
    mod.ingestTorrents([makeTorrent({ id: 1, name: 'Ubuntu ISO' })], undefined)
    mod.setSearchResult('ubuntu')
    const snap = mod.ingestTorrents(
      [makeTorrent({ id: 2, name: 'ubuntu-24.04' })],
      undefined,
    )
    expect(snap.searchResult?.map((t) => t.id).sort()).toEqual([1, 2])
  })

  it('清除搜索词后 ingest，searchResult 回到 null', () => {
    mod.ingestTorrents([makeTorrent({ id: 1, name: 'Ubuntu ISO' })], undefined)
    mod.setSearchResult('ubuntu')
    mod.setSearchResult('')
    const snap = mod.ingestTorrents([], undefined)
    expect(snap.searchKey).toBe('')
    expect(snap.searchResult).toBeNull()
  })
})
