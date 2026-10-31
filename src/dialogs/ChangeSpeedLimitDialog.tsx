import { useState } from 'react'
import { Dialog, LinkButton, NumberSpinner } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog } from '../lib/ui'
import { useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'

/* ---------------- 上传/下载限速 ---------------- */
export function ChangeSpeedLimitDialog({
  dialogId,
  ids,
}: {
  dialogId: string
  ids: number[]
}) {
  const { lang } = useLang()
  useTorrents()
  const snap = getSnapshot()
  const mutation = useRpcMutation()
  const torrent = snap.all[ids[0]]
  const L = lang.dialog['torrent-changeSpeedLimit']
  const [downloadLimited, setDownloadLimited] = useState(
    !!torrent?.downloadLimited,
  )
  const [downloadLimit, setDownloadLimit] = useState(
    torrent?.downloadLimit ?? 0,
  )
  const [uploadLimited, setUploadLimited] = useState(!!torrent?.uploadLimited)
  const [uploadLimit, setUploadLimit] = useState(torrent?.uploadLimit ?? 0)
  const [peerLimit, setPeerLimit] = useState(
    Number(torrent?.['peer-limit'] ?? 60),
  )

  if (!torrent) return null

  const ok = () => {
    mutation.mutate({
      method: 'torrent-set',
      args: {
        ids,
        downloadLimited,
        downloadLimit,
        uploadLimited,
        uploadLimit,
        'peer-limit': peerLimit,
      },
    })
    closeDialog(dialogId)
  }

  return (
    <Dialog
      title={L.title}
      width={600}
      height={200}
      resizable
      dialogId={dialogId}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton icon="icon-ok" onClick={ok}>
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
              <td className="title">
                <label>
                  <input
                    type="checkbox"
                    checked={downloadLimited}
                    onChange={(e) => setDownloadLimited(e.target.checked)}
                  />
                  {L.downloadLimited}
                </label>
              </td>
              <td>
                <NumberSpinner
                  value={downloadLimit}
                  onChange={setDownloadLimit}
                  width={200}
                  disabled={!downloadLimited}
                />{' '}
                KB/s
              </td>
            </tr>
            <tr>
              <td className="title">
                <label>
                  <input
                    type="checkbox"
                    checked={uploadLimited}
                    onChange={(e) => setUploadLimited(e.target.checked)}
                  />
                  {L.uploadLimited}
                </label>
              </td>
              <td>
                <NumberSpinner
                  value={uploadLimit}
                  onChange={setUploadLimit}
                  width={200}
                  disabled={!uploadLimited}
                />{' '}
                KB/s
              </td>
            </tr>
            <tr>
              <td className="title">{L['peer-limit']}</td>
              <td>
                <NumberSpinner
                  value={peerLimit}
                  onChange={setPeerLimit}
                  width={200}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}
