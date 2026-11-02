// 详情面板「服务器」页 — tracker 列表与增删改
import { useMemo, useState } from 'react'
import { DataGrid, type GridColumn } from '../DataGrid'
import { LinkButton } from '../ui'
import { useLang } from '../../i18n'
import { useRpcMutation } from '../../api/queries'
import { openDialog, showToast } from '../../lib/ui'
import { formatLongTime } from '../../lib/format'
import type { Torrent, TrackerStat } from '../../lib/types'

type TrackerRow = Record<string, unknown>

export function ServersTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const F = lang.torrent.attribute['servers-fields']
  const stateText = F.announceStateText
  const boolText = lang.torrent.attribute.status as Record<string, string>
  const mutation = useRpcMutation()
  const [selected, setSelected] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const rows: TrackerRow[] = useMemo(() => {
    return (torrent.trackerStats || []).map((s: TrackerStat) => ({
      id: s.id,
      announce: s.announce,
      announceState:
        stateText[String(s.announceState) as keyof typeof stateText] ??
        s.announceState,
      lastAnnounceResult: s.lastAnnounceResult,
      downloadCount:
        s.downloadCount === -1 ? lang.public['text-unknown'] : s.downloadCount,
      leecherCount:
        s.leecherCount === -1 ? lang.public['text-unknown'] : s.leecherCount,
      seederCount:
        s.seederCount === -1 ? lang.public['text-unknown'] : s.seederCount,
      lastAnnounceSucceeded: boolText[String(s.lastAnnounceSucceeded)],
      lastAnnounceTime: formatLongTime(s.lastAnnounceTime),
      lastAnnounceTimedOut: boolText[String(s.lastAnnounceTimedOut)],
      nextAnnounceTime: formatLongTime(s.nextAnnounceTime),
    }))
    // stateText/boolText 均为 lang 的派生值，lang 已在依赖中，补齐不会引入额外重算
  }, [torrent.trackerStats, lang, stateText, boolText])

  const columns: GridColumn<TrackerRow>[] = [
    { field: 'announce', title: F.announce, width: 300 },
    { field: 'announceState', title: F.announceState, width: 60 },
    { field: 'lastAnnounceResult', title: F.lastAnnounceResult, width: 160 },
    { field: 'downloadCount', title: F.downloadCount, width: 60 },
    { field: 'leecherCount', title: F.leecherCount, width: 60 },
    { field: 'seederCount', title: F.seederCount, width: 60 },
    {
      field: 'lastAnnounceSucceeded',
      title: F.lastAnnounceSucceeded,
      width: 60,
      align: 'center',
    },
    {
      field: 'lastAnnounceTime',
      title: F.lastAnnounceTime,
      width: 130,
      align: 'center',
    },
    {
      field: 'nextAnnounceTime',
      title: F.nextAnnounceTime,
      width: 130,
      align: 'center',
    },
  ]

  const selTracker = (torrent.trackerStats || []).find(
    (s: TrackerStat) => s.id === selected,
  )

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
        page={page}
        pageSize={30}
        onPageChange={setPage}
        emptyText="…"
      />
      <div className="flex gap-1 p-1 border-t border-[var(--eu-line)] bg-[var(--eu-toolbar)]">
        <LinkButton
          icon="tr-icon-plus"
          title={lang.torrent.attribute.tip['button-tracker-add']}
          onClick={() =>
            openDialog('torrent-attribute-add-tracker', { ids: [torrent.id] })
          }
        />
        <LinkButton
          icon="tr-icon-replace"
          title={lang.torrent.attribute.tip['button-tracker-edit']}
          disabled={!selTracker}
          onClick={() => {
            if (!selTracker) return
            const url = window.prompt('Tracker:', selTracker.announce)
            if (url && url !== selTracker.announce) {
              mutation.mutate(
                {
                  method: 'torrent-set',
                  args: {
                    ids: [torrent.id],
                    trackerReplace: [selTracker.id, url],
                  },
                },
                { onError: (e) => showToast(String(e.message)) },
              )
            }
          }}
        />
        <LinkButton
          icon="tr-icon-delete"
          title={lang.torrent.attribute.tip['button-tracker-remove']}
          disabled={!selTracker}
          onClick={() => {
            if (!selTracker) return
            if (
              window.confirm(
                lang.torrent.attribute.other['tracker-remove-confim'],
              )
            ) {
              mutation.mutate(
                {
                  method: 'torrent-set',
                  args: { ids: [torrent.id], trackerRemove: [selTracker.id] },
                },
                { onError: (e) => showToast(String(e.message)) },
              )
            }
          }}
        />
      </div>
    </div>
  )
}
