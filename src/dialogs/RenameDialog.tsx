import { useState } from 'react'
import { Dialog, LinkButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog } from '../lib/ui'
import { useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'

/* ---------------- 重命名 ---------------- */
export function RenameDialog({
  dialogId,
  id,
}: {
  dialogId: string
  id: number
}) {
  const { lang } = useLang()
  useTorrents()
  const snap = getSnapshot()
  const mutation = useRpcMutation()
  const torrent = snap.all[id]
  const [name, setName] = useState(torrent?.name ?? '')
  const [error, setError] = useState('')
  if (!torrent) return null
  const L = lang.dialog['torrent-rename']
  return (
    <Dialog
      title={L.title}
      width={520}
      height={200}
      resizable
      dialogId={dialogId}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {error && <span className="mr-2 text-red-600">{error}</span>}
          <LinkButton
            icon="icon-ok"
            loading={mutation.isPending}
            onClick={() => {
              if (!name || name === torrent.name) {
                setError(lang.public['text-nochange'])
                setTimeout(() => setError(''), 2000)
                return
              }
              if (!window.confirm(lang.public['text-confirm'])) return
              mutation.mutate(
                {
                  method: 'torrent-rename-path',
                  args: { ids: [id], path: '', name },
                },
                {
                  onSuccess: () => closeDialog(dialogId),
                  onError: () => {
                    setError(lang.error['rename-error'])
                    setTimeout(() => setError(''), 2000)
                  },
                },
              )
            }}
          >
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
              <td width="20%" className="title">
                {L.oldname}
              </td>
              <td>{torrent.name}</td>
            </tr>
            <tr>
              <td className="title">{L.newname}</td>
              <td>
                <textarea
                  className="eu-textbox"
                  style={{ height: 50 }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}
