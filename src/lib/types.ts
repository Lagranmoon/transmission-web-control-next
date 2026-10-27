// Transmission RPC 返回的种子对象（用到字段的并集，宽松类型）
export interface TrackerStat {
  id: number
  announce: string
  announceState: number
  downloadCount: number
  hasAnnounced: boolean
  host: string
  isBackup: boolean
  lastAnnouncePeerCount: number
  lastAnnounceResult: string
  lastAnnounceStartTime: number
  lastAnnounceSucceeded: boolean
  lastAnnounceTime: number
  lastAnnounceTimedOut: boolean
  leecherCount: number
  nextAnnounceTime: number
  seederCount: number
  scrapeState: number
}

export interface TorrentFile {
  bytesCompleted: number
  length: number
  name: string
}

export interface FileStat {
  bytesCompleted: number
  wanted: boolean
  priority: number
}

export interface Peer {
  address: string
  clientName: string
  flagStr: string
  isDownloadingFrom: boolean
  isEncrypted: boolean
  isIncoming: boolean
  isUTP: boolean
  isUploadingTo: boolean
  peerIsChoked: boolean
  peerIsInterested: boolean
  port: number
  progress: number
  rateToClient: number
  rateToPeer: number
}

export interface Torrent {
  id: number
  name: string
  status: number
  hashString: string
  totalSize: number
  percentDone: number
  addedDate: number
  leftUntilDone: number
  rateDownload: number
  rateUpload: number
  recheckProgress: number
  peersGettingFromUs: number
  peersSendingToUs: number
  uploadRatio: number
  uploadedEver: number
  downloadedEver: number
  downloadDir: string
  error: number
  errorString: string
  doneDate: number
  queuePosition: number
  activityDate: number
  trackerStats?: TrackerStat[]
  magnetLink?: string
  comment?: string
  creator?: string
  dateCreated?: number
  files?: TorrentFile[]
  fileStats?: FileStat[]
  peers?: Peer[]
  pieces?: string
  pieceCount?: number
  pieceSize?: number
  // 下载/上传限制配置
  downloadLimit?: number
  downloadLimited?: boolean | number
  uploadLimit?: number
  uploadLimited?: boolean | number
  'peer-limit'?: number
  seedIdleLimit?: number
  seedIdleMode?: number
  seedRatioLimit?: number
  seedRatioMode?: number
  // 派生字段（与原项目一致）
  completeSize?: number
  remainingTime?: number
  leecher?: string
  seeder?: string
  leecherCount?: number
  seederCount?: number
  trackers?: string
  warning?: string
  nextAnnounceTime?: number
  labels?: number[]
  moreInfosTag?: boolean
}

export interface SessionStats {
  activeTorrentCount: number
  downloadSpeed: number
  uploadSpeed: number
  pausedTorrentCount: number
  torrentCount: number
  'cumulative-stats': {
    downloadedBytes: number
    filesAdded: number
    secondsActive: number
    sessionCount: number
    uploadedBytes: number
  }
  'current-stats': {
    downloadedBytes: number
    filesAdded: number
    secondsActive: number
    sessionCount: number
    uploadedBytes: number
  }
}

export type SessionConfig = Record<string, unknown> & {
  version: string
  'rpc-version': number
  'download-dir': string
  'alt-speed-enabled': boolean
  'start-added-torrents': boolean
  'download-dir-free-space': number
}

// 种子状态常量（与 transmission.js 一致）
export const STATUS = {
  stopped: 0,
  checkwait: 1,
  check: 2,
  downloadwait: 3,
  download: 4,
  seedwait: 5,
  seed: 6,
  actively: 101,
} as const

export const TRACKER_STATUS = { inactive: 0, waiting: 1, queued: 2, active: 3 } as const

export const TORRENT_FIELDS = {
  base: 'id,name,status,hashString,totalSize,percentDone,addedDate,trackerStats,leftUntilDone,rateDownload,rateUpload,recheckProgress,peersGettingFromUs,peersSendingToUs,uploadRatio,uploadedEver,downloadedEver,downloadDir,error,errorString,doneDate,queuePosition,activityDate',
  status: 'id,name,status,totalSize,percentDone,trackerStats,leftUntilDone,rateDownload,rateUpload,recheckProgress,peersGettingFromUs,peersSendingToUs,uploadRatio,uploadedEver,downloadedEver,error,errorString,doneDate,queuePosition,activityDate',
  config: 'id,name,downloadLimit,downloadLimited,peer-limit,seedIdleLimit,seedIdleMode,seedRatioLimit,seedRatioMode,uploadLimit,uploadLimited',
}
