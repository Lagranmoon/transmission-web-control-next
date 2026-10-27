// 底部详情面板 — 复刻 torrent-attribute.html：左侧 Tabs（常规/服务器/文件/用户/设置）
import { useMemo, useState } from 'react'
import { DataGrid, type GridColumn } from './DataGrid'
import { LinkButton, NumberSpinner, TriStateCheckbox, useMenu } from './ui'
import { useLang } from '../i18n'
import { useConfig } from '../lib/config'
import { useTorrentDetails, useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { uiStore, useUi, showToast, openDialog } from '../lib/ui'
import { formatLongTime, formatSize, getTotalTime } from '../lib/format'
import { getTimeUnits } from '../i18n'
import { STATUS, type FileStat, type Peer, type Torrent, type TorrentFile, type TrackerStat } from '../lib/types'
import { ProgressBar } from '../lib/columns'
import { rpc } from '../lib/rpc'

type FileRow = Record<string, unknown> & { index: number }
type TrackerRow = Record<string, unknown>
type PeerRow = Record<string, unknown>

export function AttributePanel() {
  const { lang } = useLang()
  const ui = useUi()
  const config = useConfig()
  const [tab, setTab] = useState('base')
  const enabled = ui.attributeExpanded && ui.currentTorrentId > 0
  const { data: detail } = useTorrentDetails(ui.currentTorrentId, enabled)
  useTorrents()
  // 详情与列表基础数据合并（totalSize/remainingTime 等来自基础轮询）
  const base = getSnapshot().all[ui.currentTorrentId]
  const torrent = detail && base ? { ...base, ...detail } : detail ?? base

  const tabs = [
    { id: 'base', title: lang.torrent.attribute.tabs.base },
    { id: 'servers', title: lang.torrent.attribute.tabs.servers },
    { id: 'files', title: lang.torrent.attribute.tabs.files },
    { id: 'peers', title: lang.torrent.attribute.tabs.users },
    { id: 'config', title: lang.torrent.attribute.tabs.config },
  ]

  return (
    <div className="eu-tabs eu-tabs-left h-full">
      <div className="eu-tabs-header">
        {tabs.map((t) => (
          <div key={t.id} className={`eu-tabs-tab ${tab === t.id ? 'selected' : ''}`} onClick={() => setTab(t.id)}>
            {t.title}
          </div>
        ))}
      </div>
      <div className="eu-tabs-body">
        {!enabled ? (
          <div className="p-4 text-gray-400">{lang.title.attribute}</div>
        ) : !torrent ? (
          <div className="p-4 text-gray-400">…</div>
        ) : tab === 'base' ? (
          <BaseTab torrent={torrent} />
        ) : tab === 'servers' ? (
          <ServersTab key={torrent.id} torrent={torrent} />
        ) : tab === 'files' ? (
          <FilesTab key={torrent.id} torrent={torrent} />
        ) : tab === 'peers' ? (
          <PeersTab key={torrent.id} torrent={torrent} />
        ) : (
          <ConfigTab key={torrent.id} torrent={torrent} />
        )}
      </div>
    </div>
  )
}

/* ---------------- 常规 ---------------- */
function BaseTab({ torrent }: { torrent: Torrent }) {
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
    for (let p = 0; p < pieceCount; ) {
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
      const ramp = Math.floor((Math.pow(128, percent / 100) - 1) * (100 / 127)) / 100
      cells.push({ title: `${cellSize} x ${percent}%`, rate: ramp })
    }
    return cells
  }, [torrent.pieces, torrent.pieceCount, torrent.pieceSize])

  const row = (label: string, value: React.ReactNode, key: string) => (
    <tr key={key}>
      <td className="title" style={{ borderBottom: '1px solid #ccc' }}>{label}</td>
      <td style={{ borderBottom: '1px solid #ccc' }}>{value}</td>
    </tr>
  )

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
              <LinkButton icon="tr-icon-folder-change" title={lang.toolbar.tip['change-download-dir']} onClick={() => openDialog('torrent-changeDownloadDir', { ids: [torrent.id] })} />
              <LinkButton icon="tr-icon-clippy" title={lang.toolbar.tip['copy-path-to-clipboard']} onClick={() => {
                navigator.clipboard?.writeText(torrent.downloadDir)
                showToast(lang.toolbar.tip['copy-path-to-clipboard'])
              }} />
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
              <td className="title" style={{ color: 'red' }}>{L.errorString}</td>
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
              {formatSize(torrent.leftUntilDone)} ({remaining >= 3153600000000 ? '∞' : getTotalTime(remaining, timeUnits)})
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
            <td colSpan={3}>
              {linkify(torrent.comment || '')}
            </td>
          </tr>
        </tbody>
      </table>
      {pieces && (
        <>
          <hr />
          <div id="torrent-attribute-pieces">
            {pieces.map((c, i) => (
              <i key={i} style={{ filter: `saturate(${c.rate})` }} title={c.title} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 链接化文本
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className="text-[#0066cc] underline">
        {p}
      </a>
    ) : (
      p
    ),
  )
}

/* ---------------- 服务器（Tracker） ---------------- */
function ServersTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const F = lang.torrent.attribute['servers-fields'] as unknown as Record<string, string>
  const stateText = (lang.torrent.attribute['servers-fields'] as unknown as Record<string, Record<string, string>>).announceStateText
  const boolText = lang.torrent.attribute.status as Record<string, string>
  const mutation = useRpcMutation()
  const [selected, setSelected] = useState<number | null>(null)

  const rows: TrackerRow[] = useMemo(() => {
    return (torrent.trackerStats || []).map((s: TrackerStat) => ({
      id: s.id,
      announce: s.announce,
      announceState: stateText?.[String(s.announceState)] ?? s.announceState,
      lastAnnounceResult: s.lastAnnounceResult,
      downloadCount: s.downloadCount === -1 ? lang.public['text-unknown'] : s.downloadCount,
      leecherCount: s.leecherCount === -1 ? lang.public['text-unknown'] : s.leecherCount,
      seederCount: s.seederCount === -1 ? lang.public['text-unknown'] : s.seederCount,
      lastAnnounceSucceeded: boolText[String(s.lastAnnounceSucceeded)],
      lastAnnounceTime: formatLongTime(s.lastAnnounceTime),
      lastAnnounceTimedOut: boolText[String(s.lastAnnounceTimedOut)],
      nextAnnounceTime: formatLongTime(s.nextAnnounceTime),
    }))
  }, [torrent.trackerStats, lang])

  const columns: GridColumn<TrackerRow>[] = [
    { field: 'announce', title: F.announce, width: 300 },
    { field: 'announceState', title: F.announceState, width: 60 },
    { field: 'lastAnnounceResult', title: F.lastAnnounceResult, width: 160 },
    { field: 'downloadCount', title: F.downloadCount, width: 60 },
    { field: 'leecherCount', title: F.leecherCount, width: 60 },
    { field: 'seederCount', title: F.seederCount, width: 60 },
    { field: 'lastAnnounceSucceeded', title: F.lastAnnounceSucceeded, width: 60, align: 'center' },
    { field: 'lastAnnounceTime', title: F.lastAnnounceTime, width: 130, align: 'center' },
    { field: 'nextAnnounceTime', title: F.nextAnnounceTime, width: 130, align: 'center' },
  ]

  const selTracker = (torrent.trackerStats || []).find((s: TrackerStat) => s.id === selected)

  return (
    <div className="h-full flex flex-col">
      <DataGrid<TrackerRow>
        columns={columns}
        rows={rows}
        keyField="id"
        rownumbers
        selectedKey={selected}
        onSelect={(_, key) => setSelected(key as number)}
        pagination
        pageSize={30}
        emptyText="…"
      />
      <div className="flex gap-1 p-1 border-t border-[#ddd] bg-[#f5f5f5]">
        <LinkButton icon="tr-icon-plus" title={lang.torrent.attribute.tip['button-tracker-add']} onClick={() => openDialog('torrent-attribute-add-tracker', { ids: [torrent.id] })} />
        <LinkButton
          icon="tr-icon-replace"
          title={lang.torrent.attribute.tip['button-tracker-edit']}
          disabled={!selTracker}
          onClick={() => {
            if (!selTracker) return
            const url = window.prompt('Tracker:', selTracker.announce)
            if (url && url !== selTracker.announce) {
              mutation.mutate({
                method: 'torrent-set',
                args: { ids: [torrent.id], trackerReplace: [selTracker.id, url] },
              })
            }
          }}
        />
        <LinkButton
          icon="tr-icon-delete"
          title={lang.torrent.attribute.tip['button-tracker-remove']}
          disabled={!selTracker}
          onClick={() => {
            if (!selTracker) return
            if (window.confirm(lang.torrent.attribute.other['tracker-remove-confim'])) {
              mutation.mutate({
                method: 'torrent-set',
                args: { ids: [torrent.id], trackerRemove: [selTracker.id] },
              })
            }
          }}
        />
      </div>
    </div>
  )
}

/* ---------------- 文件 ---------------- */
function FilesTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const config = useConfig()
  const mutation = useRpcMutation()
  const { show } = useMenu()
  const [checked, setChecked] = useState<Set<string | number>>(new Set())
  const [filter, setFilter] = useState('.*')
  const [page, setPage] = useState(1)

  const F = lang.torrent.attribute['files-fields'] as Record<string, string>
  const P = lang.torrent.attribute.priority as Record<string, string>
  const S = lang.torrent.attribute.status as Record<string, string>

  const rows: FileRow[] = useMemo(() => {
    const files: TorrentFile[] = torrent.files || []
    const stats: FileStat[] = torrent.fileStats || []
    const nameLen = torrent.name.length + 1
    let list: FileRow[] = files.map((f, i) => {
      const stats0 = stats[i]
      const pct = ((stats0.bytesCompleted / Math.max(1, f.length)) * 100).toFixed(2)
      return {
        index: i,
        name: f.name === torrent.name ? f.name : f.name.slice(nameLen),
        length: f.length,
        bytesCompleted: stats0.bytesCompleted,
        percentDone: Number(pct),
        wanted: S[String(stats0.wanted)],
        priority: stats0.priority,
      }
    })
    try {
      const re = new RegExp(filter || '.*')
      list = list.filter((r) => re.test(String(r.name)))
    } catch {
      /* 非法正则忽略 */
    }
    return list
  }, [torrent.files, torrent.fileStats, filter, lang])

  const columns: GridColumn<FileRow>[] = [
    { field: 'ck', title: '', checkbox: true, allowCustom: false, width: 28 },
    { field: 'name', title: F.name, width: 300, sortable: true },
    { field: 'length', title: F.length, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v)) },
    { field: 'percentDone', title: F.percentDone, width: 70, align: 'center', sortable: true, formatter: (v) => <ProgressBar progress={Number(v)} torrent={{ status: STATUS.download, recheckProgress: 0, warning: undefined, error: 0 }} /> },
    { field: 'bytesCompleted', title: F.bytesCompleted, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v)) },
    { field: 'wanted', title: F.wanted, width: 70, align: 'center' },
    {
      field: 'priority',
      title: F.priority,
      width: 70,
      align: 'left',
      formatter: (v) => (
        <span className={`iconlabel icon-flag-${v}`}>{P[String(v)]}</span>
      ),
    },
  ]

  const setFilesWanted = (wanted: boolean) => {
    const files = Array.from(checked).map(Number)
    if (!files.length) return
    mutation.mutate({
      method: 'torrent-set',
      args: wanted
        ? { ids: [torrent.id], 'files-wanted': files }
        : { ids: [torrent.id], 'files-unwanted': files },
    })
    setChecked(new Set())
  }

  const setPriority = (priority: number) => {
    const files = Array.from(checked).map(Number)
    if (!files.length) return
    const key = priority === 1 ? 'priority-high' : priority === -1 ? 'priority-low' : 'priority-normal'
    mutation.mutate({ method: 'torrent-set', args: { ids: [torrent.id], [key]: files } })
    setChecked(new Set())
  }

  const filterTemplates = [
    { value: '.*', text: (lang.torrent.attribute['filter-template-text'] as Record<string, string>)['1'] },
    { value: '____padding_file', text: (lang.torrent.attribute['filter-template-text'] as Record<string, string>)['2'] },
    { value: '(.*\\.(url|lnk)$)|(RARBG_DO_NOT_MIRROR\\.exe)|(____padding_file)', text: (lang.torrent.attribute['filter-template-text'] as Record<string, string>)['3'] },
  ]

  return (
    <div className="h-full flex flex-col">
      <DataGrid<FileRow>
        columns={columns}
        rows={rows}
        keyField="index"
        rownumbers
        checkedKeys={checked}
        onCheck={setChecked}
        pagination={config.pagination}
        page={page}
        pageSize={config.pageSize}
        onPageChange={setPage}
        emptyText="…"
      />
      <div className="flex gap-1 p-1 border-t border-[#ddd] bg-[#f5f5f5] items-center">
        <LinkButton icon="icon-allow" title={lang.torrent.attribute.tip['button-allow']} onClick={() => setFilesWanted(true)} />
        <LinkButton icon="icon-deny" title={lang.torrent.attribute.tip['button-deny']} onClick={() => setFilesWanted(false)} />
        <LinkButton
          icon="icon-flag-edit"
          title={lang.torrent.attribute.tip['button-priority']}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            show(
              [
                { id: '0', text: P['0'], onClick: () => setPriority(0) },
                { id: '1', text: P['1'], onClick: () => setPriority(1) },
                { id: '-1', text: P['-1'], onClick: () => setPriority(-1) },
              ],
              rect.left,
              rect.bottom + 2,
            )
          }}
        />
        <span className="ml-2 text-gray-500">{lang.torrent.attribute.tip['button-filter']}：</span>
        <select
          className="border border-[#95b8e7] rounded h-[22px]"
          value={filterTemplates.some((t) => t.value === filter) ? filter : ''}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">自定义…</option>
          {filterTemplates.map((t) => (
            <option key={t.value} value={t.value}>
              {t.text}
            </option>
          ))}
        </select>
        <input
          className="eu-textbox"
          style={{ width: 220 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder=".*"
        />
      </div>
    </div>
  )
}

/* ---------------- 用户（Peers） ---------------- */
function PeersTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const F = lang.torrent.attribute['peers-fields'] as Record<string, string>
  const S = lang.torrent.attribute.status as Record<string, string>
  const [page, setPage] = useState(1)

  const rows: PeerRow[] = useMemo(() => {
    return (torrent.peers || []).map((p: Peer) => ({
      address: p.address,
      port: p.port,
      isUTP: S[String(p.isUTP)],
      clientName: p.clientName,
      flagStr: p.flagStr,
      progress: p.progress,
      rateToClient: p.rateToClient,
      rateToPeer: p.rateToPeer,
    }))
  }, [torrent.peers, lang])

  const columns: GridColumn<PeerRow>[] = [
    { field: 'address', title: F.address, width: 160 },
    { field: 'port', title: F.port, width: 60 },
    { field: 'isUTP', title: F.isUTP, width: 60, align: 'center' },
    { field: 'clientName', title: F.clientName, width: 140 },
    { field: 'flagStr', title: F.flagStr, width: 60 },
    { field: 'progress', title: F.progress, width: 70, align: 'center', formatter: (v) => <ProgressBar progress={Number((Number(v) * 100).toFixed(2))} torrent={{ status: STATUS.download, recheckProgress: 0, warning: undefined, error: 0 }} /> },
    { field: 'rateToClient', title: F.rateToClient, width: 90, align: 'right', formatter: (v) => formatSize(Number(v), true, 'speed') },
    { field: 'rateToPeer', title: F.rateToPeer, width: 90, align: 'right', formatter: (v) => formatSize(Number(v), true, 'speed') },
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

/* ---------------- 设置（单种子参数） ---------------- */
function ConfigTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const L = lang.torrent.attribute.label
  const mutation = useRpcMutation()
  const [saved, setSaved] = useState<'none' | 'saving' | 'saved'>('none')

  const tri = (mode: number | boolean | undefined) => ({
    checked: mode === 1 || mode === true,
    indeterminate: mode === 0,
    value: typeof mode === 'number' ? mode : undefined,
  })
  const [downloadLimited, setDownloadLimited] = useState(!!torrent.downloadLimited)
  const [downloadLimit, setDownloadLimit] = useState(torrent.downloadLimit ?? 0)
  const [uploadLimited, setUploadLimited] = useState(!!torrent.uploadLimited)
  const [uploadLimit, setUploadLimit] = useState(torrent.uploadLimit ?? 0)
  const [peerLimit, setPeerLimit] = useState((torrent as Torrent & { 'peer-limit'?: number })['peer-limit'] ?? 60)
  const [seedRatioMode, setSeedRatioMode] = useState(tri(torrent.seedRatioMode))
  const [seedRatioLimit, setSeedRatioLimit] = useState(torrent.seedRatioLimit ?? 2)
  const [seedIdleMode, setSeedIdleMode] = useState(tri(torrent.seedIdleMode))
  const [seedIdleLimit, setSeedIdleLimit] = useState(torrent.seedIdleLimit ?? 30)

  const save = () => {
    const args: Record<string, unknown> = {
      ids: torrent.id,
      downloadLimited,
      downloadLimit,
      uploadLimited,
      uploadLimit,
      'peer-limit': peerLimit,
      seedRatioMode: seedRatioMode.value ?? (seedRatioMode.checked ? 1 : 2),
      seedRatioLimit,
      seedIdleMode: seedIdleMode.value ?? (seedIdleMode.checked ? 1 : 2),
      seedIdleLimit,
    }
    setSaved('saving')
    mutation.mutate(
      { method: 'torrent-set', args },
      {
        onSuccess: () => {
          setSaved('saved')
          setTimeout(() => setSaved('none'), 2000)
        },
      },
    )
  }

  return (
    <div className="dialog h-full flex flex-col">
      <table>
        <tbody>
          <tr>
            <td width="38%" className="title">
              <TriStateCheckbox
                id="downloadLimited"
                checked={downloadLimited}
                onChange={({ checked }) => setDownloadLimited(checked)}
                label={L.downloadLimited}
              />
            </td>
            <td width="12%">
              <NumberSpinner value={downloadLimit} onChange={setDownloadLimit} disabled={!downloadLimited} /> KB/s
            </td>
            <td width="38%" className="title">
              <TriStateCheckbox
                id="seedRatioMode"
                checked={seedRatioMode.checked}
                indeterminate={seedRatioMode.indeterminate}
                onChange={(next) =>
                  setSeedRatioMode({
                    checked: next.checked,
                    indeterminate: next.indeterminate,
                    // 三态循环：0(跟随全局) → 1(启用) → 2(禁用)
                    value: next.indeterminate ? 0 : next.checked ? 1 : 2,
                  })
                }
                label={L.seedRatioMode}
              />
            </td>
            <td width="12%">
              <NumberSpinner value={seedRatioLimit} onChange={setSeedRatioLimit} disabled={seedRatioMode.value === 2} />
            </td>
          </tr>
          <tr>
            <td className="title">
              <TriStateCheckbox
                id="uploadLimited"
                checked={uploadLimited}
                onChange={({ checked }) => setUploadLimited(checked)}
                label={L.uploadLimited}
              />
            </td>
            <td>
              <NumberSpinner value={uploadLimit} onChange={setUploadLimit} disabled={!uploadLimited} /> KB/s
            </td>
            <td className="title">
              <TriStateCheckbox
                id="seedIdleMode"
                checked={seedIdleMode.checked}
                indeterminate={seedIdleMode.indeterminate}
                onChange={(next) =>
                  setSeedIdleMode({
                    checked: next.checked,
                    indeterminate: next.indeterminate,
                    value: next.indeterminate ? 0 : next.checked ? 1 : 2,
                  })
                }
                label={L.seedIdleMode}
              />
            </td>
            <td>
              <NumberSpinner value={seedIdleLimit} onChange={setSeedIdleLimit} disabled={seedIdleMode.value === 2} />{' '}
              {lang.dialog['system-config'].minutes}
            </td>
          </tr>
          <tr>
            <td className="title">{L['peer-limit']}</td>
            <td>
              <NumberSpinner value={peerLimit} onChange={setPeerLimit} width={90} />
            </td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
      <div className="mt-auto flex items-center gap-2 p-1 border-t border-[#ddd]">
        <LinkButton
          icon="icon-ok"
          onClick={save}
          loading={saved === 'saving'}
        >
          {lang.dialog.public['button-save']}
        </LinkButton>
        {saved === 'saved' && <span>{lang.public['text-saved']}</span>}
      </div>
    </div>
  )
}
