// 种子列表列定义 — 移植 torrent-fields.json + system.js setFieldFormat
import type { ReactNode } from 'react'
import type { GridColumn } from '../components/DataGrid'
import type { Lang } from '../i18n'
import type { Torrent } from './types'
import { formatLongTime, formatSize, getTotalTime, getGrayLevel } from './format'
import { getTimeUnits, getLangPack, resolveLang } from '../i18n'
import { openDialog } from './ui'
import { STATUS } from './types'
import { useConfig } from './config'

/** 语言在页面生命周期内固定（切换语言会刷新），模块级取一次即可 */
const SET_LABELS_TIP =
  (getLangPack(resolveLang()).dialog as Record<string, { title?: string }>)['torrent-setLabels']?.title ??
  '设置用户标签'

type Row = Torrent & Record<string, unknown>

/** 进度条（getTorrentProgressBar 移植）— progress 为两位小数字符串/数字，恒显示 "50.00%" 形态（原版 parseFloat(v).toFixed(2)） */
export function ProgressBar({ progress, torrent }: { progress: number | string; torrent: Pick<Torrent, 'status' | 'recheckProgress' | 'warning' | 'error'> }) {
  const percent = typeof progress === 'number' ? progress.toFixed(2) : progress
  let className = ''
  switch (torrent.status) {
    case STATUS.stopped:
      className = 'torrent-progress-stop'
      break
    case STATUS.checkwait:
    case STATUS.check:
      className = 'torrent-progress-check'
      break
    case STATUS.downloadwait:
    case STATUS.download:
      className = 'torrent-progress-download'
      break
    case STATUS.seedwait:
    case STATUS.seed:
      className = 'torrent-progress-seed'
      break
  }
  if (torrent.warning) className = 'torrent-progress-warning'
  if (torrent.error !== 0) className = 'torrent-progress-error'
  if (torrent.status === STATUS.check) {
    const percentCheckText = (torrent.recheckProgress * 100).toFixed(2)
    const percentCheckView = (Number(percent) * torrent.recheckProgress).toFixed(2)
    return (
      <div className="torrent-progress" title={`${percent}%`}>
        <div className="torrent-progress-text" style={{ zIndex: 2 }}>{percentCheckText}%</div>
        <div className="torrent-progress-bar torrent-progress-seed" style={{ width: `${percentCheckView}%`, zIndex: 1, opacity: 0.7 }} />
        <div className={`torrent-progress-bar ${className}`} style={{ width: `${percent}%` }} />
      </div>
    )
  }
  return (
    <div className="torrent-progress" title={`${percent}%`}>
      <div className="torrent-progress-text">{percent}%</div>
      <div className={`torrent-progress-bar ${className}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

/** 名称列（getTorrentNameBar 移植） */
export function NameCell({ torrent, lang }: { torrent: Torrent; lang: Lang }) {
  let cls = 'icon-wait'
  switch (torrent.status) {
    case STATUS.stopped:
      cls = 'icon-pause-small'
      break
    case STATUS.check:
      cls = 'icon-checking'
      break
    case STATUS.download:
      cls = 'icon-down'
      break
    case STATUS.seed:
      cls = 'icon-up'
      break
  }
  let tip = torrent.name + '\n' + torrent.downloadDir
  if (torrent.warning) {
    cls = 'icon-warning-type1'
    tip += `\n\n${lang.public['text-info']}: ${torrent.warning}`
  }
  if (torrent.error !== 0) {
    cls = 'icon-exclamation'
    tip += `\n\n${lang.public['text-info']}: ${torrent.errorString}`
  }
  return (
    <span className={`iconlabel ${cls}`} title={tip}>
      {torrent.name}
    </span>
  )
}

/** 标签列（formetTorrentLabels 移植，含内联快速设置按钮） */
export function LabelsCell({ torrent }: { torrent: Torrent }) {
  // 订阅配置：标签编辑保存后 memo 行内的单元格自行重渲染
  const config = useConfig()
  const labels = config.labels
  const ids = torrent.labels
  const navLabels = config.nav.labels
  return (
    <>
      {(ids || []).map((id) => {
        const item = labels[id]
        if (!item) return null
        const gray = getGrayLevel(item.color)
        return (
          <span key={id} className="user-label" style={{ backgroundColor: item.color, color: gray > 0.5 ? '#000' : '#fff' }}>
            {item.name}
          </span>
        )
      })}
      {navLabels && (
        <button
          className="user-label-set-btn"
          title={SET_LABELS_TIP}
          onClick={(e) => {
            e.stopPropagation()
            openDialog('torrent-setLabels', { hashs: [torrent.hashString] })
          }}
        >
          <i className="iconfont tr-icon-labels" />
        </button>
      )}
    </>
  )
}

export function makeColumns(lang: Lang): GridColumn<Row>[] {
  const f = lang.torrent.fields as Record<string, string>
  const units = getTimeUnits(lang.name ?? 'en')
  const ratio = (value: number): ReactNode => (
    <span className={parseFloat(String(value)) < 1 && value !== -1 ? 'text-status-warning' : ''}>
      {value === -1 ? '∞' : value}
    </span>
  )
  const remainingTime = (value: number): ReactNode => (value >= 3153600000000 ? '∞' : getTotalTime(value, units))

  const cols: GridColumn<Row>[] = [
    { field: 'ck', title: '', checkbox: true, allowCustom: false, width: 28 },
    {
      field: 'name',
      title: f.name,
      width: 300,
      sortable: true,
      formatter: (v, row) => <NameCell torrent={row} lang={lang} />,
    },
    { field: 'totalSize', title: f.totalSize, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v)) },
    {
      field: 'percentDone',
      title: f.percentDone,
      width: 70,
      align: 'center',
      sortable: true,
      formatter: (v, row) => <ProgressBar progress={(Number(v) * 100).toFixed(2)} torrent={row} />,
    },
    { field: 'remainingTime', title: f.remainingTime, width: 100, align: 'right', sortable: true, formatter: remainingTime },
    { field: 'uploadRatio', title: f.uploadRatio, width: 60, align: 'right', sortable: true, formatter: (v) => ratio(Number(v)) },
    {
      field: 'status',
      title: f.status,
      width: 60,
      align: 'center',
      sortable: true,
      formatter: (v, row) => {
        const text = (lang.torrent['status-text'] as Record<string, string>)[String(v)]
        if (row.error !== 0) return <span className="text-status-error">{text}</span>
        if (row.warning) return <span className="text-status-warning" title={row.warning}>{text}</span>
        return text
      },
    },
    { field: 'seederCount', title: f.seederCount, width: 60, align: 'left' },
    { field: 'leecherCount', title: f.leecherCount, width: 60, align: 'left' },
    { field: 'rateDownload', title: f.rateDownload, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v), true, 'speed') },
    { field: 'rateUpload', title: f.rateUpload, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v), true, 'speed') },
    { field: 'completeSize', title: f.completeSize, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v)) },
    { field: 'uploadedEver', title: f.uploadedEver, width: 80, align: 'right', sortable: true, formatter: (v) => formatSize(Number(v)) },
    { field: 'addedDate', title: f.addedDate, width: 130, align: 'center', sortable: true, formatter: (v) => formatLongTime(Number(v)) },
    { field: 'id', title: f.id, width: 30, align: 'center', sortable: true },
    { field: 'queuePosition', title: f.queuePosition, width: 30, align: 'center', sortable: true },
    { field: 'trackers', title: f.trackers, width: 100, align: 'left', sortable: true },
    { field: 'downloadDir', title: f.downloadDir, width: 200, align: 'left', sortable: true },
    { field: 'activityDate', title: f.activityDate, width: 130, align: 'center', sortable: true, formatter: (v) => formatLongTime(Number(v)) },
    { field: 'labels', title: f.labels, width: 130, align: 'left', formatter: (_v, row) => <LabelsCell torrent={row} /> },
    { field: 'doneDate', title: f.doneDate, width: 130, align: 'center', sortable: true, formatter: (v) => formatLongTime(Number(v)) },
  ]
  return cols
}
