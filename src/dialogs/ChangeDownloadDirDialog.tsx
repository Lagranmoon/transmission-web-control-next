import { useMemo, useState } from 'react'
import { Dialog, LinkButton, ComboBox } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog, showProgress, hideProgress } from '../lib/ui'
import { useSession, useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { getFolderDictionary } from '../lib/config'
import { rpc } from '../lib/rpc'
import { uniq } from '../lib/format'

/* ---------------- 变更保存目录 ---------------- */
export function ChangeDownloadDirDialog({
  dialogId,
  ids,
}: {
  dialogId: string
  ids: number[]
}) {
  const { lang } = useLang()
  useTorrents()
  const snap = getSnapshot()
  const session = useSession()
  const mutation = useRpcMutation()
  const torrent = snap.all[ids[0]]
  const L = lang.dialog['torrent-changeDownloadDir']
  const [dir, setDir] = useState(torrent?.downloadDir ?? '')
  const [moveData, setMoveData] = useState(true)
  const [recheck, setRecheck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const dirOptions = useMemo(() => {
    const list = uniq([
      ...(session.data?.['download-dir'] ? [session.data['download-dir']] : []),
      ...snap.downloadDirs,
      ...getFolderDictionary(),
    ])
    return list.map((d) => ({ value: d, text: d }))
  }, [snap.downloadDirs, session.data])

  if (!torrent) return null

  const ok = async () => {
    if (dir === torrent.downloadDir) {
      setError(lang.public['text-nochange'])
      setTimeout(() => setError(''), 2000)
      return
    }
    // torrent-set-location 原生支持 ids 数组：一次请求批量迁移，
    // 避免慢 API 下逐条串行导致的长时间等待
    const moveIds = ids.filter(
      (id) => snap.all[id] && snap.all[id].downloadDir !== dir,
    )
    if (moveIds.length) {
      setBusy(true)
      // 批量迁移期间在右下角显示进度浮层
      showProgress(
        lang.public['text-processing'].replace('%n', String(moveIds.length)),
      )
      try {
        await rpc('torrent-set-location', {
          ids: moveIds,
          location: dir,
          move: moveData,
        })
        if (recheck) {
          await rpc('torrent-verify', { ids: moveIds })
        }
      } catch (e) {
        // 失败时保留对话框并展示错误，成功路径才关闭
        setError(String((e as Error).message || e))
        return
      } finally {
        setBusy(false)
        hideProgress()
      }
    }
    mutation.reset()
    void mutation.mutate({ method: 'session-stats' })
    closeDialog(dialogId)
  }

  return (
    <Dialog
      title={L.title}
      width={520}
      height={220}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {error && <span className="mr-2 text-red-600">{error}</span>}
          <LinkButton icon="icon-ok" onClick={() => void ok()} loading={busy}>
            {lang.dialog.public['button-ok']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog">
        <table>
          <tbody>
            <tr>
              <td width="22%" className="title">
                {L['old-download-dir']}
              </td>
              <td>{torrent.downloadDir}</td>
            </tr>
            <tr>
              <td className="title">{L['new-download-dir']}</td>
              <td>
                <ComboBox
                  value={dir}
                  options={dirOptions}
                  onChange={setDir}
                  width={400}
                  editable
                />
              </td>
            </tr>
            <tr>
              <td className="title" />
              <td>
                <label>
                  <input
                    type="checkbox"
                    checked={moveData}
                    onChange={(e) => setMoveData(e.target.checked)}
                  />
                  {L['move-data']}
                </label>
              </td>
            </tr>
            <tr>
              <td className="title" />
              <td>
                <label>
                  <input
                    type="checkbox"
                    checked={recheck}
                    onChange={(e) => setRecheck(e.target.checked)}
                  />
                  {L['recheck-data']}
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}
