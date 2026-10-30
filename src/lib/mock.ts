// Mock 服务器状态 — 模拟 Transmission 守护进程，用于 UI 开发/演示（VITE_MOCK=1）
// VITE_MOCK_COUNT 可指定种子数量（性能测试用，如 VITE_MOCK_COUNT=2000）
import type { SessionStats, Torrent, TrackerStat } from './types'

const MOCK_COUNT = Number(import.meta.env.VITE_MOCK_COUNT || 12)

function tracker(announce: string, state = 3): TrackerStat {
  const host = announce.replace(/^https?:\/\//, '').split('/')[0]
  return {
    id: Math.abs(hashCode(announce)) % 1000,
    announce,
    announceState: state,
    downloadCount: 123,
    hasAnnounced: true,
    host,
    isBackup: false,
    lastAnnouncePeerCount: 30,
    lastAnnounceResult: '',
    lastAnnounceStartTime: 1700000000,
    lastAnnounceSucceeded: true,
    lastAnnounceTime: Math.floor(Date.now() / 1000) - 600,
    lastAnnounceTimedOut: false,
    leecherCount: 12,
    nextAnnounceTime: Math.floor(Date.now() / 1000) + 1800,
    seederCount: 88,
    scrapeState: 0,
  }
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/** 生成 pieces 位图的 base64（1=已拥有，按完成度填充） */
function piecesBase64(pieceCount: number, percent: number): string {
  const bytes = new Uint8Array(Math.ceil(pieceCount / 8))
  const haveCount = Math.floor(pieceCount * percent)
  for (let p = 0; p < haveCount; p++) {
    // 随机散布（用确定性伪随机，便于稳定渲染）
    const idx = (p * 7919 + 13) % pieceCount
    bytes[idx >> 3] |= 0x80 >> idx % 8
  }
  // 尾部补齐连续片段，模拟正在下载
  for (let p = 0; p < Math.floor(haveCount / 3); p++) bytes[p >> 3] |= 0x80 >> p % 8
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const DIRS = ['/downloads', '/downloads/movies', '/downloads/series', '/data/linux']

function makeTorrent(i: number): Torrent {
  const names = [
    'Ubuntu 24.04.1 LTS Desktop amd64 ISO',
    'Debian 12 netinst',
    'Big.Buck.Bunny.2008.1080p.BluRay',
    'archlinux-2026.10.01-x86_64.iso',
    'Fedora.Workstation.Live.x86_64',
    'Sintel.2010.4K.Remux',
    'openSUSE-Tumbleweed-DVD-x86_64',
    'Linux.Mint.22.Cinnamon',
  ]
  const statuses: number[] = [0, 4, 4, 6, 2, 0, 4, 6]
  const name = names[i % names.length]
  const status = statuses[i % statuses.length]
  const totalSize = 400_000_000 + ((i * 977) % 40) * 250_000_000
  const percent = status === 6 ? 1 : status === 0 ? (i % 5) / 5 : 0.15 + ((i * 37) % 80) / 100
  const leftUntilDone = Math.max(0, Math.round(totalSize * (1 - percent)))
  const rateDownload = status === 4 ? 1_500_000 + ((i * 131) % 9) * 900_000 : 0
  const rateUpload = status === 6 || status === 4 ? 120_000 + ((i * 53) % 7) * 80_000 : 0
  return {
    id: i + 1,
    name,
    status,
    hashString: Array.from({ length: 40 }, (_, k) => ((i * 7 + k * 13) % 16).toString(16)).join(''),
    totalSize,
    percentDone: percent,
    addedDate: 1730000000 + i * 86400,
    leftUntilDone,
    rateDownload,
    rateUpload,
    recheckProgress: status === 2 ? 0.45 : 0,
    peersGettingFromUs: status === 6 ? 4 + (i % 5) : 0,
    peersSendingToUs: status === 4 ? 2 + (i % 9) : 0,
    uploadRatio: percent >= 1 ? 1.5 + i * 0.1 : -1,
    uploadedEver: Math.round(totalSize * (1.2 + (i % 3))),
    downloadedEver: Math.round(totalSize * percent),
    downloadDir: DIRS[i % DIRS.length],
    error: i === 5 ? 3 : 0,
    errorString: i === 5 ? 'tracker 错误：连接超时' : '',
    doneDate: status === 6 ? 1730100000 + i * 3600 : 0,
    queuePosition: i,
    activityDate: 1730050000 + i * 3600,
    trackerStats: [
      tracker(`http://tracker.example.org:8080/announce`),
      tracker(`udp://open.tracker.cl:1337/announce`, 1),
      tracker(`udp://tracker.opentrackr.org:1337/announce`, 3),
    ],
    pieceCount: 240,
    pieceSize: Math.floor(totalSize / 240),
    pieces: piecesBase64(240, percent),
    files: [
      { bytesCompleted: Math.round(totalSize * percent), length: totalSize, name },
      { bytesCompleted: Math.round(totalSize * 0.9 * percent), length: Math.round(totalSize * 0.9), name: name + '/sample.mkv' },
      { bytesCompleted: 0, length: 15_000_000, name: name + '/cover.jpg' },
    ],
    fileStats: [
      { bytesCompleted: Math.round(totalSize * percent), wanted: true, priority: 1 },
      { bytesCompleted: Math.round(totalSize * 0.9 * percent), wanted: true, priority: 0 },
      { bytesCompleted: 0, wanted: false, priority: -1 },
    ],
    peers: Array.from({ length: 4 }, (_, k) => ({
      address: `10.0.${i}.${k + 2}`,
      clientName: ['qBittorrent 4.6', 'Transmission 4.0', 'Deluge 2.1', 'μTorrent 3.6'][k % 4],
      flagStr: 'DUT',
      isDownloadingFrom: true,
      isEncrypted: true,
      isIncoming: k % 2 === 0,
      isUTP: k % 2 === 0,
      isUploadingTo: k % 3 !== 0,
      peerIsChoked: false,
      peerIsInterested: true,
      port: 51400 + k * 11,
      progress: Math.min(1, percent + k * 0.1),
      rateToClient: 120_000 * (k + 1),
      rateToPeer: 80_000 * (k + 1),
    })),
    comment: 'Mock 种子描述 https://example.org/torrent/' + i,
    creator: 'mktorrent 1.1',
    dateCreated: 1720000000 + i * 86400,
  }
}

let torrents: Torrent[] = Array.from({ length: MOCK_COUNT }, (_, i) => makeTorrent(i))
let session = {
  version: '4.0.6',
  'rpc-version': 17,
  'rpc-version-minimum': 1,
  'download-dir': '/downloads',
  'alt-speed-enabled': false,
  'start-added-torrents': true,
  'download-dir-free-space': 320_000_000_000,
  'incomplete-dir-enabled': false,
  'cache-size-mb': 4,
  'rename-partial-files': true,
  'download-queue-enabled': true,
  'download-queue-size': 5,
  'seed-queue-enabled': false,
  'seed-queue-size': 10,
  'peer-port-random-on-start': false,
  'peer-port': 51413,
  'port-forwarding-enabled': true,
  encryption: 'tolerated',
  'utp-enabled': true,
  'dht-enabled': true,
  'lpd-enabled': false,
  'pex-enabled': true,
  'peer-limit-global': 240,
  'peer-limit-per-torrent': 60,
  'speed-limit-down-enabled': false,
  'speed-limit-down': 5120,
  'speed-limit-up-enabled': false,
  'speed-limit-up': 1024,
  'alt-speed-down': 1024,
  'alt-speed-up': 256,
  'alt-speed-time-enabled': false,
  'alt-speed-time-begin': 540,
  'alt-speed-time-end': 1020,
  'alt-speed-time-day': 127,
  'blocklist-enabled': false,
  'blocklist-size': 0,
  seedRatioLimited: false,
  seedRatioLimit: 2,
  'queue-stalled-enabled': true,
  'queue-stalled-minutes': 30,
  'idle-seeding-limit-enabled': false,
  'idle-seeding-limit': 30,
  'script-torrent-done-enabled': false,
  'script-torrent-done-filename': '',
  'config-dir': '/etc/transmission-daemon',
}
let statsTick = 0

function stats(): SessionStats {
  const down = torrents.reduce((s, x) => s + x.rateDownload, 0)
  const up = torrents.reduce((s, x) => s + x.rateUpload, 0)
  return {
    activeTorrentCount: torrents.filter((x) => x.rateDownload > 0 || x.rateUpload > 0).length,
    downloadSpeed: down,
    uploadSpeed: up,
    pausedTorrentCount: torrents.filter((x) => x.status === 0).length,
    torrentCount: torrents.length,
    'cumulative-stats': {
      downloadedBytes: 812_345_678_912,
      filesAdded: 432,
      secondsActive: 98765,
      sessionCount: 27,
      uploadedBytes: 234_567_890_123,
    },
    'current-stats': {
      downloadedBytes: 12_345_678_912,
      filesAdded: 42,
      secondsActive: 9876,
      sessionCount: 3,
      uploadedBytes: 4_567_890_123,
    },
  }
}

export function getMockState(method: string) {
  // 每次 session-stats 拉取时推进模拟进度（真实轮询每个周期恰好拉一次 session-stats）
  if (method === 'session-stats') {
    statsTick++
    for (const x of torrents) {
      if (x.status === 4 && x.leftUntilDone > 0) {
        const advance = x.rateDownload * 5
        x.leftUntilDone = Math.max(0, x.leftUntilDone - advance)
        x.percentDone = Math.min(1, (x.totalSize - x.leftUntilDone) / x.totalSize)
        x.rateDownload = Math.max(100_000, x.rateDownload + ((statsTick % 5) - 2) * 300_000)
        if (x.leftUntilDone === 0) {
          x.status = 6
          x.doneDate = Math.floor(Date.now() / 1000)
        }
      }
    }
  }
  return {
    session,
    stats: stats(),
    torrents,
    removed: [] as number[],
    freeSpaces: {
      '/downloads': 331_000_000_000,
      '/downloads/movies': 128_000_000_000,
      '/data/linux': 512_000_000_000,
    } as Record<string, number>,
  }
}

export async function mockMutate(method: string, args: Record<string, any>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 200))
  switch (method) {
    case 'session-set':
      session = { ...session, ...args }
      return {}
    case 'torrent-add': {
      const filename: string = args.filename || ''
      let name = filename
      if (name.startsWith('magnet:')) {
        const dn = name.match(/dn=([^&]+)/)
        name = dn ? decodeURIComponent(dn[1]) : '新增磁力任务 ' + Date.now()
      } else if (name) {
        name = name.split('/').pop() || name
      } else if (args.metainfo) {
        name = '新增种子 ' + Date.now()
      }
      const id = torrents.reduce((m, x) => Math.max(m, x.id), 0) + 1
      const t = makeTorrent(torrents.length)
      t.id = id
      t.name = name
      t.status = args.paused ? 0 : 4
      t.percentDone = 0
      t.leftUntilDone = t.totalSize
      t.downloadDir = args['download-dir'] || session['download-dir']
      torrents.push(t)
      return { 'torrent-added': { id, hashString: t.hashString, name } }
    }
    case 'torrent-start':
    case 'torrent-stop':
    case 'torrent-verify':
    case 'torrent-reannounce': {
      const ids: number[] = args.ids ?? torrents.map((x) => x.id)
      for (const t of torrents) {
        if (!ids.includes(t.id)) continue
        if (method === 'torrent-start' && t.status === 0) t.status = t.percentDone >= 1 ? 6 : 4
        if (method === 'torrent-stop') t.status = 0
        if (method === 'torrent-verify') {
          t.status = 2
          t.recheckProgress = 0
        }
      }
      return {}
    }
    case 'torrent-remove': {
      const ids: number[] = args.ids || []
      torrents = torrents.filter((x) => !ids.includes(x.id))
      return {}
    }
    case 'torrent-set': {
      const ids: number[] = args.ids || []
      for (const t of torrents) {
        if (!ids.includes(t.id)) continue
        Object.assign(t, args)
      }
      return {}
    }
    case 'torrent-rename-path': {
      const ids: number[] = args.ids || []
      for (const t of torrents) if (ids.includes(t.id)) t.name = String(args.name)
      return {}
    }
    case 'torrent-set-location': {
      const ids: number[] = args.ids || []
      for (const t of torrents) if (ids.includes(t.id)) t.downloadDir = String(args.location)
      return {}
    }
    case 'queue-move-top':
    case 'queue-move-up':
    case 'queue-move-down':
    case 'queue-move-bottom': {
      const ids: number[] = args.ids || []
      torrents.sort((a, b) => a.queuePosition - b.queuePosition)
      const sel = torrents.filter((x) => ids.includes(x.id))
      const rest = torrents.filter((x) => !ids.includes(x.id))
      const ordered = method.endsWith('top') ? [...sel, ...rest] : [...rest, ...sel]
      ordered.forEach((x, i) => (x.queuePosition = i))
      torrents = ordered
      return {}
    }
    default:
      return {}
  }
}
