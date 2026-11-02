// 详情面板「常规」页 — 种子基础信息、分块状态
import { useMemo, type ReactNode } from 'react'
import { LinkButton } from '../ui'
import { getTimeUnits, useLang } from '../../i18n'
import { openDialog, showToast } from '../../lib/ui'
import { formatLongTime, formatSize, getTotalTime } from '../../lib/format'
import type { Torrent } from '../../lib/types'

// 链接化文本
function linkify(text: string): ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noreferrer"
        className="text-[#0066cc] underline"
      >
        {p}
      </a>
    ) : (
      p
    ),
  )
}

export function BaseTab({ torrent }: { torrent: Torrent }) {
  const { lang, name: langName } = useLang()
  const timeUnits = getTimeUnits(langName)
  const L = lang.torrent.attribute.label as Record<string, string>
  const st = lang.torrent['status-text'] as Record<string, string>

  const pieces = useMemo(() => {
    if (!torrent.pieces || !torrent.pieceCount) return null
    // pieces 是 base64 编码的位图
    let bin: string
    try {
      const b = atob(torrent.pieces)
      bin = b
    } catch {
      return null
    }
    const pieceCount = torrent.pieceCount
    const pieceSize = torrent.pieceSize || 0
    const flags: boolean[] = [] // true = 缺失
    for (let p = 0; p < pieceCount;) {
      const bset = bin.charCodeAt(p >> 3)
      for (let test = 0x80; test > 0 && p < pieceCount; test = test >> 1, ++p) {
        flags.push((bset & test) === 0)
      }
    }
    const MAXCELLS = 500
    const perCell = Math.floor((MAXCELLS - 1 + pieceCount) / MAXCELLS)
    const cellSize = formatSize(pieceSize * perCell)
    const cellCount = Math.floor((perCell - 1 + pieceCount) / perCell)
    const cells: { title: string; rate: number }[] = []
    let piece = 0
    for (let cell = 0; cell < cellCount; ++cell) {
      let done = perCell
      for (let i = 0; i < perCell; ++i, ++piece) {
        if (flags[piece]) --done
      }
      const percent = Math.floor((done * 100) / perCell)
      const ramp =
        Math.floor((Math.pow(128, percent / 100) - 1) * (100 / 127)) / 100
      cells.push({ title: `${cellSize} x ${percent}%`, rate: ramp })
    }
    return cells
  }, [torrent.pieces, torrent.pieceCount, torrent.pieceSize])

  const completeSize = torrent.totalSize - torrent.leftUntilDone
  const remaining = torrent.remainingTime ?? 0

  return (
    <div className="dialog p-1">
      <table>
        <tbody>
          <tr>
            <td className="title">{L.name}</td>
            <td colSpan={3}>{torrent.name}</td>
          </tr>
          <tr>
            <td className="title">{L.downloadDir}</td>
            <td colSpan={3}>
              {torrent.downloadDir}{' '}
              <LinkButton
                icon="tr-icon-folder-change"
                title={lang.toolbar.tip['change-download-dir']}
                onClick={() =>
                  openDialog('torrent-changeDownloadDir', { ids: [torrent.id] })
                }
              />
              <LinkButton
                icon="tr-icon-clippy"
                title={lang.toolbar.tip['copy-path-to-clipboard']}
                onClick={() => {
                  // 显式忽略写入结果，保持原有“失败不提示”的行为
                  void navigator.clipboard?.writeText(torrent.downloadDir)
                  showToast(lang.toolbar.tip['copy-path-to-clipboard'])
                }}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L.status}</td>
            <td>{st[String(torrent.status)]}</td>
            <td className="title">{L.hashString}</td>
            <td>{torrent.hashString}</td>
          </tr>
          {torrent.error !== 0 && (
            <tr>
              <td className="title" style={{ color: 'red' }}>
                {L.errorString}
              </td>
              <td colSpan={3} style={{ color: 'red' }}>
                {torrent.errorString} ({torrent.error})
              </td>
            </tr>
          )}
          <tr>
            <td className="title">{L.totalSize}</td>
            <td>{formatSize(torrent.totalSize)}</td>
            <td className="title">{L.addedDate}</td>
            <td>{formatLongTime(torrent.addedDate)}</td>
          </tr>
          <tr>
            <td className="title">{L.leftUntilDone}</td>
            <td>
              {formatSize(torrent.leftUntilDone)} (
              {remaining >= 3153600000000
                ? '∞'
                : getTotalTime(remaining, timeUnits)}
              )
            </td>
            <td className="title">{L.completeSize}</td>
            <td>{formatSize(completeSize)}</td>
          </tr>
          <tr>
            <td className="title">{L.rateDownload}</td>
            <td>{formatSize(torrent.rateDownload, true, 'speed')}</td>
            <td className="title">{L.rateUpload}</td>
            <td>{formatSize(torrent.rateUpload, true, 'speed')}</td>
          </tr>
          <tr>
            <td className="title">{L.leecherCount}</td>
            <td>{torrent.leecher ?? '-'}</td>
            <td className="title">{L.seederCount}</td>
            <td>{torrent.seeder ?? '-'}</td>
          </tr>
          <tr>
            <td className="title">{L.uploadedEver}</td>
            <td>{formatSize(torrent.uploadedEver)}</td>
            <td className="title">{L.uploadRatio}</td>
            <td>{torrent.uploadRatio === -1 ? '∞' : torrent.uploadRatio}</td>
          </tr>
          <tr>
            <td className="title">{L.creator}</td>
            <td>{torrent.creator}</td>
            <td className="title">{L.dateCreated}</td>
            <td>{formatLongTime(torrent.dateCreated)}</td>
          </tr>
          <tr>
            <td className="title">{L.comment}</td>
            <td colSpan={3}>{linkify(torrent.comment || '')}</td>
          </tr>
        </tbody>
      </table>
      {pieces && (
        <>
          <hr />
          <div
            className="mb-0.5"
            style={{ color: 'var(--eu-text)', opacity: 0.6 }}
          >
            {langName === 'zh-CN'
              ? '分块状态（每个方块为一个数据块，颜色越满表示该块已下载；悬停查看详情）'
              : 'Pieces (each block is a data piece; hover for details)'}
          </div>
          <div id="torrent-attribute-pieces">
            {pieces.map((c, i) => (
              <i
                key={i}
                style={{ filter: `saturate(${c.rate})` }}
                title={c.title}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
