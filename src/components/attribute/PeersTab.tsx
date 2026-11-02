// 详情面板「用户」页 — peer 列表与 IP 归属地/国旗
import { useEffect, useMemo, useRef, useState } from 'react'
import { DataGrid, type GridColumn } from '../DataGrid'
import { useLang } from '../../i18n'
import { formatSize } from '../../lib/format'
import { STATUS, type Peer, type Torrent } from '../../lib/types'
import { ProgressBar } from '../../lib/columns'
import {
  flagSrc,
  geoEnabled,
  lookupDetail,
  lookupFlag,
} from '../../lib/peers-geo'

type PeerRow = Record<string, unknown>

export function PeersTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const F = lang.torrent.attribute['peers-fields'] as Record<string, string>
  const S = lang.torrent.attribute.status as Record<string, string>
  const [page, setPage] = useState(1)
  // IP 归属地/国旗（启用后异步补齐）
  const [geo, setGeo] = useState<
    Record<string, { flag: string | null; detail: string | null }>
  >({})
  // peer 地址集合签名：轮询产生的新数组引用内容未变时跳过重查，避免每轮全表重渲染
  const peersKey = (torrent.peers || []).map((p) => p.address).join('\n')
  const lastPeersKey = useRef('')
  // 组件存活标记：以前用 effect cleanup 取消在途查询，但 torrent.peers 每次轮询都是新引用，
  // cleanup 会在下一轮 effect 里把上一轮的查询全部作废，而新一轮又因 peersKey 未变提前 return，
  // 结果 geo 永远落不了地（StrictMode 双次挂载同样必现）。改为只卸载时让结果失效。
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!geoEnabled()) return
    const peers = torrent.peers || []
    if (peersKey === lastPeersKey.current) return
    lastPeersKey.current = peersKey
    void (async () => {
      const next: Record<
        string,
        { flag: string | null; detail: string | null }
      > = {}
      // 与原版一致：每个 peer 并行查询，而不是逐个串行排队
      await Promise.all(
        peers.map(async (p) => {
          next[p.address] = {
            flag: await lookupFlag(p.address),
            detail: await lookupDetail(p.address),
          }
        }),
      )
      // 期间 peers 已变化：本次结果过期（新 effect 会用新 key 重查并提交），丢弃即可
      if (mountedRef.current && lastPeersKey.current === peersKey) setGeo(next)
    })()
  }, [torrent.peers, peersKey])

  const rows: PeerRow[] = useMemo(() => {
    return (torrent.peers || []).map((p: Peer) => {
      const g = geo[p.address]
      const addr = (
        <>
          {g?.flag && (
            <img
              src={flagSrc(g.flag)}
              alt={g.flag}
              title={g.detail || g.flag}
              style={{ verticalAlign: 'middle', marginRight: 4 }}
            />
          )}
          {g ? (
            g.detail ? (
              <span title={g.detail}>{p.address}</span>
            ) : (
              p.address
            )
          ) : (
            p.address
          )}
        </>
      )
      return {
        address: addr,
        port: p.port,
        isUTP: S[String(p.isUTP)],
        clientName: p.clientName,
        flagStr: p.flagStr,
        progress: p.progress,
        rateToClient: p.rateToClient,
        rateToPeer: p.rateToPeer,
      }
    })
    // S 随 lang 同步更替，以 S 为依赖即可（重算时机不变）
  }, [torrent.peers, geo, S])

  const columns: GridColumn<PeerRow>[] = [
    { field: 'address', title: F.address, width: 160 },
    { field: 'port', title: F.port, width: 60 },
    { field: 'isUTP', title: F.isUTP, width: 60, align: 'center' },
    { field: 'clientName', title: F.clientName, width: 140 },
    { field: 'flagStr', title: F.flagStr, width: 60 },
    {
      field: 'progress',
      title: F.progress,
      width: 70,
      align: 'center',
      formatter: (v) => (
        <ProgressBar
          progress={Number((Number(v) * 100).toFixed(2))}
          torrent={{
            status: STATUS.download,
            recheckProgress: 0,
            warning: undefined,
            error: 0,
          }}
        />
      ),
    },
    {
      field: 'rateToClient',
      title: F.rateToClient,
      width: 90,
      align: 'right',
      formatter: (v) => formatSize(Number(v), true, 'speed'),
    },
    {
      field: 'rateToPeer',
      title: F.rateToPeer,
      width: 90,
      align: 'right',
      formatter: (v) => formatSize(Number(v), true, 'speed'),
    },
  ]

  return (
    <DataGrid<PeerRow>
      columns={columns}
      rows={rows}
      keyField="address"
      rownumbers
      pagination
      page={page}
      pageSize={30}
      onPageChange={setPage}
      emptyText="…"
    />
  )
}
