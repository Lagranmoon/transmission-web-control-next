// 详情面板「文件」页 — 文件过滤、勾选、优先级与下载意愿
import { useMemo, useState } from 'react'
import { DataGrid, type GridColumn } from '../DataGrid'
import { LinkButton, useMenu } from '../ui'
import { useLang } from '../../i18n'
import { useConfig } from '../../lib/config'
import { useRpcMutation } from '../../api/queries'
import { showToast } from '../../lib/ui'
import { compareField, formatSize } from '../../lib/format'
import {
  STATUS,
  type FileStat,
  type Torrent,
  type TorrentFile,
} from '../../lib/types'
import { ProgressBar } from '../../lib/columns'

type FileRow = Record<string, unknown> & { index: number }

export function FilesTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const config = useConfig()
  const mutation = useRpcMutation()
  const { show } = useMenu()
  const [checked, setChecked] = useState<Set<string | number>>(new Set())
  const [filter, setFilter] = useState('.*')
  const [page, setPage] = useState(1)
  const [sortName, setSortName] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const F = lang.torrent.attribute['files-fields'] as Record<string, string>
  const P = lang.torrent.attribute.priority as Record<string, string>
  const S = lang.torrent.attribute.status as Record<string, string>

  const rows: FileRow[] = useMemo(() => {
    const files: TorrentFile[] = torrent.files || []
    const stats: FileStat[] = torrent.fileStats || []
    const nameLen = torrent.name.length + 1
    let list: FileRow[] = files.map((f, i) => {
      const stats0 = stats[i]
      const pct = (
        (stats0.bytesCompleted / Math.max(1, f.length)) *
        100
      ).toFixed(2)
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
    if (sortName) list.sort(compareField(sortName, sortOrder))
    return list
    // S 随 lang 同步更替（以 S 为依赖即可）；torrent.name 变化必然伴随 torrent 对象/文件数组更替
  }, [
    torrent.files,
    torrent.fileStats,
    torrent.name,
    filter,
    sortName,
    sortOrder,
    S,
  ])

  const columns: GridColumn<FileRow>[] = [
    { field: 'ck', title: '', checkbox: true, allowCustom: false, width: 28 },
    { field: 'name', title: F.name, width: 300, sortable: true },
    {
      field: 'length',
      title: F.length,
      width: 80,
      align: 'right',
      sortable: true,
      formatter: (v) => formatSize(Number(v)),
    },
    {
      field: 'percentDone',
      title: F.percentDone,
      width: 70,
      align: 'center',
      sortable: true,
      formatter: (v) => (
        <ProgressBar
          progress={Number(v)}
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
      field: 'bytesCompleted',
      title: F.bytesCompleted,
      width: 80,
      align: 'right',
      sortable: true,
      formatter: (v) => formatSize(Number(v)),
    },
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
    mutation.mutate(
      {
        method: 'torrent-set',
        args: wanted
          ? { ids: [torrent.id], 'files-wanted': files }
          : { ids: [torrent.id], 'files-unwanted': files },
      },
      { onError: (e) => showToast(String(e.message)) },
    )
    setChecked(new Set())
  }

  const setPriority = (priority: number) => {
    const files = Array.from(checked).map(Number)
    if (!files.length) return
    const key =
      priority === 1
        ? 'priority-high'
        : priority === -1
          ? 'priority-low'
          : 'priority-normal'
    mutation.mutate(
      { method: 'torrent-set', args: { ids: [torrent.id], [key]: files } },
      { onError: (e) => showToast(String(e.message)) },
    )
    setChecked(new Set())
  }

  const filterTemplates = [
    {
      value: '.*',
      text: (
        lang.torrent.attribute['filter-template-text'] as Record<string, string>
      )['1'],
    },
    {
      value: '____padding_file',
      text: (
        lang.torrent.attribute['filter-template-text'] as Record<string, string>
      )['2'],
    },
    {
      value: '(.*\\.(url|lnk)$)|(RARBG_DO_NOT_MIRROR\\.exe)|(____padding_file)',
      text: (
        lang.torrent.attribute['filter-template-text'] as Record<string, string>
      )['3'],
    },
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
        sortName={sortName}
        sortOrder={sortOrder}
        onSort={(field) => {
          const nextOrder: 'asc' | 'desc' =
            sortName === field && sortOrder === 'asc' ? 'desc' : 'asc'
          setSortName(field)
          setSortOrder(nextOrder)
        }}
        pagination={config.pagination}
        page={page}
        pageSize={config.pageSize}
        onPageChange={setPage}
        emptyText="…"
      />
      <div className="flex gap-1 p-1 border-t border-[var(--eu-line)] bg-[var(--eu-toolbar)] items-center">
        <LinkButton
          icon="icon-allow"
          title={lang.torrent.attribute.tip['button-allow']}
          onClick={() => setFilesWanted(true)}
        />
        <LinkButton
          icon="icon-deny"
          title={lang.torrent.attribute.tip['button-deny']}
          onClick={() => setFilesWanted(false)}
        />
        <LinkButton
          icon="icon-flag-edit"
          title={lang.torrent.attribute.tip['button-priority']}
          onClick={(e) => {
            const rect = (
              e.currentTarget as HTMLElement
            ).getBoundingClientRect()
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
        <span className="ml-2 text-gray-500">
          {lang.torrent.attribute.tip['button-filter']}：
        </span>
        <select
          className="border border-[var(--eu-border)] rounded h-[22px]"
          value={filterTemplates.some((t) => t.value === filter) ? filter : ''}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
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
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          placeholder=".*"
        />
      </div>
    </div>
  )
}
