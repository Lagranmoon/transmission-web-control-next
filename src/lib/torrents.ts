// 种子数据层 — 移植原项目 transmission.torrents.js
// 轮询 torrent-get（recently-active 增量），在客户端维护全量 map 并派生：
// 状态分组 / 错误 / 警告 / 活动 / 目录树 / 服务器(tracker) 聚合 / 总大小等
import { STATUS, type SessionStats, type Torrent, type TrackerStat } from './types'
import { getHostName, validTreeKey } from './format'
import { configStore } from './config'

export interface TrackerInfo {
  nodeid: string
  name: string
  host: string
  count: number
  torrents: Torrent[]
  size: number
  connected: boolean
  isBT: boolean
}

export interface FolderInfo {
  nodeid: string
  count: number
  torrents: Torrent[]
  size: number
  path: string
}

export interface TorrentSnapshot {
  /** 全量种子（id → torrent） */
  all: Record<number, Torrent>
  /** 按状态分组的列表 */
  status: Record<number, Torrent[]>
  paused: Torrent[]
  downloading: Torrent[]
  actively: Torrent[]
  error: Torrent[]
  warning: Torrent[]
  btItems: Torrent[]
  searchResult: Torrent[] | null
  trackers: Record<string, TrackerInfo>
  folders: Record<string, FolderInfo>
  count: number
  totalSize: number
  /** 出现过的下载目录（排序后） */
  downloadDirs: string[]
  /** 本次有活动的种子 id 集合 */
  recentlyIds: Set<number>
  /** 当前搜索词 */
  searchKey: string
  version: number
}

const EMPTY: TorrentSnapshot = {
  all: {},
  status: {},
  paused: [],
  downloading: [],
  actively: [],
  error: [],
  warning: [],
  btItems: [],
  searchResult: null,
  trackers: {},
  folders: {},
  count: 0,
  totalSize: 0,
  downloadDirs: [],
  recentlyIds: new Set(),
  searchKey: '',
  version: 0,
}

let snapshot: TorrentSnapshot = EMPTY
let initialized = false
let seq = 0
const dirSet = new Set<string>()

export function getSnapshot(): TorrentSnapshot {
  return snapshot
}

export function isInited() {
  return initialized
}

/** tracker 聚合（addTracker 移植），同时累计 leecher/seeder */
function addTracker(item: Torrent, trackers: Record<string, TrackerInfo>, btItems: Torrent[]) {
  const trackerStats = item.trackerStats || []
  const names: string[] = []
  item.leecherCount = 0
  item.seederCount = 0

  if (trackerStats.length === 0) return
  const warnings: string[] = []
  let nextAnnounceTime = 0

  for (const trackerInfo of trackerStats) {
    const hostName = getHostName(trackerInfo.host || trackerInfo.announce)
    let parts = hostName.split('.')
    if (['www', 'tracker', 'announce'].includes(parts[0])) parts = parts.slice(1)
    const name = parts.join('.')
    const id = 'tracker-' + name.replace(/\./g, '-')
    let tracker = trackers[id]
    if (!tracker) {
      tracker = trackers[id] = {
        count: 0,
        torrents: [],
        size: 0,
        connected: true,
        isBT: trackerStats.length > 5,
        nodeid: id,
        name,
        host: trackerInfo.host,
      }
    }
    if (!trackerInfo.lastAnnounceSucceeded && trackerInfo.announceState !== 0) {
      warnings.push(trackerInfo.lastAnnounceResult)
      if (trackerInfo.lastAnnounceResult.toLowerCase() === 'could not connect to tracker') {
        tracker.connected = false
      }
    }
    if (!tracker.torrents.includes(item)) {
      tracker.torrents.push(item)
      tracker.count++
      tracker.size += item.totalSize
    }
    item.leecherCount += trackerInfo.leecherCount
    item.seederCount += trackerInfo.seederCount
    if (!names.includes(name)) names.push(name)
    nextAnnounceTime = nextAnnounceTime
      ? Math.min(nextAnnounceTime, trackerInfo.nextAnnounceTime)
      : trackerInfo.nextAnnounceTime
  }

  if (trackerStats.length > 5) btItems.push(item)

  if (warnings.length === trackerStats.length) {
    const joined = warnings.join(';')
    item.warning = joined.replace(/;/g, '') === '' ? '' : joined
    item.nextAnnounceTime = nextAnnounceTime
    // warning 列表在下方 splitid 中 push
  }

  item.leecherCount = Math.max(0, item.leecherCount)
  item.seederCount = Math.max(0, item.seederCount)
  item.leecher = `${item.leecherCount} (${item.peersGettingFromUs})`
  item.seeder = `${item.seederCount} (${item.peersSendingToUs})`
  item.trackers = names.join(';')
}

/** 将 torrent-get 返回结果并入全量数据并重新派生（splitid 移植） */
export function ingestTorrents(torrents: Torrent[], removed: number[] | undefined): TorrentSnapshot {
  const prev = snapshot.all
  const datas: Record<number, Torrent> = { ...prev }
  const recentlyIds = new Set<number>()

  for (const t of torrents) {
    datas[t.id] = { ...(prev[t.id] || {}), ...t }
    recentlyIds.add(t.id)
  }
  for (const id of removed || []) {
    delete datas[id]
  }

  const status: Record<number, Torrent[]> = {}
  const trackers: Record<string, TrackerInfo> = {}
  const folders: Record<string, FolderInfo> = {}
  const lists = {
    paused: [] as Torrent[],
    downloading: [] as Torrent[],
    actively: [] as Torrent[],
    error: [] as Torrent[],
    warning: [] as Torrent[],
    btItems: [] as Torrent[],
  }
  let totalSize = 0
  let count = 0

  const list = Object.values(datas).sort((a, b) => a.queuePosition - b.queuePosition)
  for (const item of list) {
    if (item.uploadedEver === 0 && item.downloadedEver === 0) item.uploadRatio = -1
    item.uploadRatio = Number(item.uploadRatio) || 0

    const bucket = (status[item.status] ||= [])
    bucket.push(item)
    totalSize += item.totalSize

    // 剩余时间
    if (item.rateDownload > 0 && item.leftUntilDone > 0) {
      item.remainingTime = Math.floor((item.leftUntilDone / item.rateDownload) * 1000)
    } else if (item.rateDownload === 0 && item.leftUntilDone === 0 && item.totalSize !== 0) {
      item.remainingTime = 0
    } else {
      item.remainingTime = 3153600000000
    }

    if (item.error !== 0) lists.error.push(item)
    if (item.rateUpload > 0 || item.rateDownload > 0) lists.actively.push(item)
    if (item.status === STATUS.stopped) lists.paused.push(item)
    if (item.status === STATUS.download) lists.downloading.push(item)

    if (item.downloadDir) dirSet.add(item.downloadDir)

    // 目录树（folders-xxx key 与原项目一致）
    const segs = item.downloadDir.replace(/\\/g, '/').split('/')
    let folderkey = 'folders-'
    let path = ''
    for (const seg of segs) {
      if (seg === '') continue
      path = path ? path + '/' + seg : seg
      folderkey += validTreeKey(seg)
      let node = folders[folderkey]
      if (!node) {
        node = folders[folderkey] = { count: 0, torrents: [], size: 0, nodeid: folderkey, path }
      }
      node.torrents.push(item)
      node.count++
      node.size += item.totalSize
    }

    count++
  }

  // tracker 聚合在状态分好组后统一处理（需要 warning 分组）
  for (const item of list) {
    addTracker(item, trackers, lists.btItems)
    if (item.warning) lists.warning.push(item)
    // 用户标签
    const labels = configStore.get().labelMaps[item.hashString]
    if (labels && labels.length) item.labels = labels
    else delete item.labels
  }

  initialized = true
  const keepKey = snapshot.searchKey
  snapshot = {
    all: datas,
    status,
    ...lists,
    trackers,
    folders,
    // 搜索结果跟随数据刷新重新计算
    searchResult: keepKey ? search(list, keepKey) : null,
    count,
    totalSize,
    downloadDirs: Array.from(dirSet).sort(),
    recentlyIds,
    searchKey: keepKey,
    version: ++seq,
  }
  return snapshot
}

export function setSearchResult(key: string): Torrent[] {
  const result = search(Object.values(snapshot.all), key)
  snapshot = { ...snapshot, searchResult: result, searchKey: key }
  return result
}

function search(source: Torrent[], key: string): Torrent[] {
  if (!key) return []
  const lower = key.toLowerCase()
  return source.filter((t) => t.name.toLowerCase().includes(lower))
}

/** 供查询层参考的空快照 */
export { EMPTY as EMPTY_SNAPSHOT }

/** 状态文本 key（原 lang.torrent['status-text'][status]） */
export function statusTextKey(status: number): string {
  return String(status)
}
