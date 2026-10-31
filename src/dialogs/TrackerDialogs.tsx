import { useState } from 'react'
import { Dialog, LinkButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog, showProgress, hideProgress } from '../lib/ui'
import { useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { rpc } from '../lib/rpc'

/* ---------------- 增加 Tracker ---------------- */
export function AddTrackerDialog({
  dialogId,
  ids,
}: {
  dialogId: string
  ids: number[]
}) {
  const { lang } = useLang()
  const mutation = useRpcMutation()
  const L = lang.dialog['torrent-attribute-add-tracker']
  const [urls, setUrls] = useState('')
  return (
    <Dialog
      title={L.title}
      width={520}
      height={240}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            loading={mutation.isPending}
            onClick={() => {
              const list = urls
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
              if (!list.length) return
              mutation.mutate(
                { method: 'torrent-set', args: { ids, trackerAdd: list } },
                { onSuccess: () => closeDialog(dialogId) },
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
        <div>{L.tip}</div>
        <textarea
          className="eu-textbox"
          style={{ height: 120 }}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
      </div>
    </Dialog>
  )
}

/* ---------------- 替换 Tracker（全局） ---------------- */
export function ReplaceTrackerDialog({ dialogId }: { dialogId: string }) {
  const { lang } = useLang()
  useTorrents()
  const snap = getSnapshot()
  const L = lang.dialog['system-replaceTracker']
  const [oldUrl, setOldUrl] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const ok = async () => {
    if (!oldUrl || !newUrl || oldUrl === newUrl) {
      setMessage(lang.public['text-nochange'])
      setTimeout(() => setMessage(''), 2000)
      return
    }
    if (!window.confirm(lang.public['text-confirm'])) return
    setBusy(true)
    // 与原 searchAndReplaceTrackers 一致：按 tracker id 分组，
    // 每个 tracker 只发一次批量请求（ids 为该 tracker 下所有命中的种子）
    const grouped = new Map<number, number[]>()
    let count = 0
    for (const t of Object.values(snap.all)) {
      for (const ts of t.trackerStats || []) {
        if (ts.announce === oldUrl) {
          const list = grouped.get(ts.id) ?? []
          list.push(t.id)
          grouped.set(ts.id, list)
          count++
        }
      }
    }
    let done = 0
    // 批量替换期间在右下角显示进度浮层（count 为命中的种子数；无命中时不显示）
    if (count > 0)
      showProgress(lang.public['text-processing'].replace('%n', String(count)))
    try {
      for (const [trackerId, torrentIds] of grouped) {
        done++
        setMessage(`-> [${done}/${grouped.size}]`)
        await rpc('torrent-set', {
          ids: torrentIds,
          trackerReplace: [trackerId, newUrl],
        })
      }
    } catch (e) {
      // 失败时展示错误并保留对话框，成功路径才关闭
      setMessage(String((e as Error).message || e))
      return
    } finally {
      setBusy(false)
      hideProgress()
    }
    if (count === 0) {
      setMessage(L['not-found'])
      setTimeout(() => setMessage(''), 2500)
    } else {
      closeDialog(dialogId)
    }
  }

  return (
    <Dialog
      title={L.title}
      width={520}
      height={200}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {message && <span className="mr-2">{message}</span>}
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
        <span
          className="tip block mb-1"
          dangerouslySetInnerHTML={{ __html: L.tip }}
        />
        <table>
          <tbody>
            <tr>
              <td width="20%" className="title">
                {L['old-tracker']}
              </td>
              <td>
                <input
                  className="eu-textbox w-full"
                  value={oldUrl}
                  onChange={(e) => setOldUrl(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td className="title">{L['new-tracker']}</td>
              <td>
                <input
                  className="eu-textbox w-full"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}
