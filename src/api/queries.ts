// TanStack Query 查询层：会话信息、状态统计、种子列表轮询与各类变更操作
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rpc } from '../lib/rpc'
import {
  TORRENT_FIELDS,
  type SessionConfig,
  type SessionStats,
  type Torrent,
} from '../lib/types'
import { ingestTorrents, isInited } from '../lib/torrents'
import { configStore } from '../lib/config'

export const queryKeys = {
  session: ['session'] as const,
  stats: ['stats'] as const,
  torrents: ['torrents'] as const,
  details: (id: number) => ['torrent-details', id] as const,
  freeSpace: (path: string) => ['free-space', path] as const,
}

function reloadInterval() {
  const c = configStore.get()
  return c.autoReload ? c.reloadStep : false
}

/** session-get */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      const s = await rpc<SessionConfig>('session-get')
      return s
    },
    refetchInterval: reloadInterval,
    staleTime: 2000,
  })
}

/** session-stats（状态栏速度 + 统计信息） */
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => rpc<SessionStats>('session-stats'),
    refetchInterval: reloadInterval,
  })
}

/**
 * 种子列表：首次全量，之后 recently-active 增量。
 * 数据在 torrentStore 中派生（分组/目录/tracker 聚合），快照版本号作为渲染依据。
 */
export function useTorrents() {
  return useQuery({
    queryKey: queryKeys.torrents,
    queryFn: async (): Promise<number> => {
      const args: Record<string, unknown> = {
        fields: TORRENT_FIELDS.base.split(','),
      }
      if (isInited()) args.ids = 'recently-active'
      const result = await rpc<{ torrents: Torrent[]; removed: number[] }>(
        'torrent-get',
        args,
      )
      const snap = ingestTorrents(result.torrents || [], result.removed || [])
      return snap.version
    },
    refetchInterval: reloadInterval,
    // 拉取失败（例如网络断开）时静默重试
    retry: 1,
    refetchOnWindowFocus: true,
  })
}

/** 单个种子详情（文件/peers/tracker 等），选中且详情面板展开时轮询 */
export function useTorrentDetails(id: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.details(id),
    enabled: enabled && id > 0,
    queryFn: async () => {
      const fields =
        'fileStats,trackerStats,peers,leftUntilDone,status,rateDownload,rateUpload,uploadedEver,uploadRatio,error,errorString,pieces,pieceCount,pieceSize,files,trackers,comment,dateCreated,creator,downloadDir,downloadLimit,downloadLimited,uploadLimit,uploadLimited,peer-limit,seedIdleLimit,seedIdleMode,seedRatioLimit,seedRatioMode'
      const result = await rpc<{ torrents: Torrent[] }>('torrent-get', {
        fields: fields.split(','),
        ids: id,
      })
      return result.torrents?.[0] || null
    },
    refetchInterval: reloadInterval,
  })
}

/** 可用空间 */
export function useFreeSpace(path: string | undefined) {
  return useQuery({
    queryKey: queryKeys.freeSpace(path || ''),
    enabled: !!path,
    queryFn: () => rpc<{ 'size-bytes': number }>('free-space', { path }),
    refetchInterval: reloadInterval,
    staleTime: 10000,
  })
}

/** 统一变更操作：完成后触发列表刷新
 *  session-get 是全量配置拉取（慢 API 下开销大），仅在真正改了会话参数时才刷新 */
export function useRpcMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      method,
      args = {},
    }: {
      method: string
      args?: Record<string, unknown>
    }) => {
      const result = await rpc<{ result?: string } & Record<string, unknown>>(
        method,
        args,
      )
      return result
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.torrents })
      void qc.invalidateQueries({ queryKey: queryKeys.stats })
      // 前缀匹配命中所有 torrent-details 查询：autoReload 关闭时详情面板也能刷新
      void qc.invalidateQueries({ queryKey: ['torrent-details'] })
      if (variables.method === 'session-set') {
        void qc.invalidateQueries({ queryKey: queryKeys.session })
      }
    },
  })
}
