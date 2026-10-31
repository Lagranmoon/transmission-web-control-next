import { useUi } from '../lib/ui'
import { AddTorrentDialog } from './AddTorrentDialog'
import { RemoveConfirmDialog } from './RemoveConfirmDialog'
import { RenameDialog } from './RenameDialog'
import { ChangeDownloadDirDialog } from './ChangeDownloadDirDialog'
import { ChangeSpeedLimitDialog } from './ChangeSpeedLimitDialog'
import { AddTrackerDialog, ReplaceTrackerDialog } from './TrackerDialogs'
import { AboutDialog } from './AboutDialog'
import { SetLabelsDialog } from './SetLabelsDialog'
import { SystemConfigDialog } from './SystemConfigDialog'
import {
  ExportConfigDialog,
  ImportConfigDialog,
  AutoMatchDialog,
  AutoMatchDictionaryDialog,
} from './ConfigToolsDialogs'

/* 对话框宿主：根据 uiStore.dialogs 栈渲染对应组件 */
export function DialogHost() {
  const ui = useUi()
  return (
    <>
      {ui.dialogs.map((d) => {
        const p = (d.props || {}) as Record<string, never>
        switch (d.id) {
          case 'torrent-add':
            return <AddTorrentDialog key={d.id} dialogId={d.id} />
          case 'torrent-addfile':
            return (
              <AddTorrentDialog key={d.id} dialogId={d.id} files={p.files} />
            )
          case 'torrent-remove-confirm':
            return (
              <RemoveConfirmDialog key={d.id} dialogId={d.id} ids={p.ids} />
            )
          case 'torrent-rename':
            return <RenameDialog key={d.id} dialogId={d.id} id={p.id} />
          case 'torrent-changeDownloadDir':
            return (
              <ChangeDownloadDirDialog key={d.id} dialogId={d.id} ids={p.ids} />
            )
          case 'torrent-changeSpeedLimit':
            return (
              <ChangeSpeedLimitDialog key={d.id} dialogId={d.id} ids={p.ids} />
            )
          case 'torrent-attribute-add-tracker':
            return <AddTrackerDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'system-replaceTracker':
            return <ReplaceTrackerDialog key={d.id} dialogId={d.id} />
          case 'system-config':
            return <SystemConfigDialog key={d.id} dialogId={d.id} />
          case 'about':
            return <AboutDialog key={d.id} dialogId={d.id} />
          case 'torrent-setLabels':
            return (
              <SetLabelsDialog key={d.id} dialogId={d.id} hashs={p.hashs} />
            )
          case 'export-config':
            return <ExportConfigDialog key={d.id} dialogId={d.id} />
          case 'import-config':
            return <ImportConfigDialog key={d.id} dialogId={d.id} />
          case 'auto-match':
            return <AutoMatchDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'auto-match-dictionary':
            return (
              <AutoMatchDictionaryDialog
                key={d.id}
                dialogId={d.id}
                onSaved={p.onSaved}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}
