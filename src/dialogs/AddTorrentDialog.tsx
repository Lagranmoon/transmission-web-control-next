import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, LinkButton, ComboBox, SwitchButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog } from '../lib/ui'
import { useSession, useTorrents, queryKeys } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import {
  configStore,
  getFolderDictionary,
  useConfig,
  saveConfig,
} from '../lib/config'
import { rpc, addTorrentFile } from '../lib/rpc'
import { uniq } from '../lib/format'
import { LabelPicker } from '../components/LabelPicker'

/* ---------------- 添加种子（URL / 文件） ---------------- */
export function AddTorrentDialog({
  dialogId,
  files,
}: {
  dialogId: string
  files?: File[]
}) {
  const { lang } = useLang()
  const config = useConfig()
  const session = useSession()
  useTorrents()
  const snap = getSnapshot()
  const qc = useQueryClient()
  const L = lang.dialog['torrent-add']
  const defaultDir = (session.data?.['download-dir'] as string) || ''
  const [dir, setDir] = useState(defaultDir)
  const [urls, setUrls] = useState('')
  const [autostart, setAutostart] = useState(
    !!session.data?.['start-added-torrents'],
  )
  const [setDefault, setSetDefault] = useState(false)
  const [fileList, setFileList] = useState<File[]>(files || [])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  // 添加时同步打标签（原 label_page）
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set())

  const dirOptions = useMemo(() => {
    const list = uniq([
      ...(defaultDir ? [defaultDir] : []),
      ...snap.downloadDirs,
      ...getFolderDictionary(),
    ]).map((d) => (d.endsWith('/') ? d.slice(0, -1) : d))
    return list.map((d) => ({ value: d, text: d }))
  }, [snap.downloadDirs, defaultDir])

  /** 添加成功后为种子保存所选标签（每次从 store 现取 labelMaps，避免批量添加时前序写入被闭包旧值覆盖） */
  const saveLabelsFor = (hash: string) => {
    const cfg = configStore.get()
    if (!cfg.nav.labels || !selectedLabels.size) return
    const maps = { ...cfg.labelMaps, [hash]: Array.from(selectedLabels) }
    saveConfig({ labelMaps: maps })
  }

  const ok = async () => {
    const isUpload = fileList.length > 0
    const urlText = urls.trim()
    if (!isUpload && !urlText) {
      setStatus(L.nosource)
      setTimeout(() => setStatus(''), 2000)
      return
    }
    setBusy(true)
    try {
      if (setDefault && dir && dir !== defaultDir) {
        await rpc('session-set', { 'download-dir': dir })
      }
      if (autostart !== !!session.data?.['start-added-torrents']) {
        await rpc('session-set', { 'start-added-torrents': autostart })
      }
      if (isUpload) {
        let done = 0
        for (const f of fileList) {
          try {
            const added = await addTorrentFile(f, dir, !autostart)
            if (added['torrent-added']?.hashString)
              saveLabelsFor(added['torrent-added'].hashString)
          } finally {
            done++
            setStatus(`${done}/${fileList.length}`)
          }
        }
      } else if (urlText) {
        const list = urlText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        let i = 0
        for (const url of list) {
          i++
          setStatus(`${lang.system.status.queue}${i}/${list.length} ${url}`)
          const u = /^[0-9a-f]{40}$/i.test(url)
            ? 'magnet:?xt=urn:btih:' + url
            : url
          const added = await rpc<{ 'torrent-added'?: { hashString: string } }>(
            'torrent-add',
            {
              filename: u,
              paused: !autostart,
              'download-dir': dir,
            },
          )
          if (added['torrent-added']?.hashString)
            saveLabelsFor(added['torrent-added'].hashString)
        }
        setStatus(lang.system.status.queuefinish)
      }
      closeDialog(dialogId)
    } catch (e) {
      setStatus(String((e as Error).message || e))
      setBusy(false)
      return
    } finally {
      // URL/文件两条路径都可能已成功添加一部分种子（批量中途失败亦然），统一触发列表与统计刷新；
      // 以前只有上传路径借道 session-stats mutation 间接触发，URL 路径完全依赖轮询。
      void qc.invalidateQueries({ queryKey: queryKeys.torrents })
      void qc.invalidateQueries({ queryKey: queryKeys.stats })
    }
  }

  return (
    <Dialog
      title={lang.toolbar['add-torrent']}
      width={620}
      height={config.nav.labels ? 560 : 400}
      resizable={!files}
      dialogId={dialogId}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {status && <span className="mr-2">{status}</span>}
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
        <div className="mb-1 p-1 border border-[#c0c0c0] bg-[#ffffcc]">
          {L['tip-title']}
        </div>
        <table>
          <tbody>
            <tr>
              <td width="20%" className="title">
                {L['download-dir']}
              </td>
              <td>
                <ComboBox
                  value={dir}
                  options={dirOptions}
                  onChange={setDir}
                  width={450}
                  editable
                />
                <label className="ml-3">
                  <input
                    type="checkbox"
                    checked={setDefault}
                    onChange={(e) => setSetDefault(e.target.checked)}
                  />
                  {L['set-default-download-dir']}
                </label>
              </td>
            </tr>
            <tr>
              <td className="title">{L['upload-file']}</td>
              <td>
                <input
                  type="file"
                  multiple
                  accept=".torrent"
                  onChange={(e) =>
                    setFileList(Array.from(e.target.files || []))
                  }
                />
                {fileList.length > 0 && (
                  <div className="text-[var(--eu-text)]">
                    {fileList.map((f) => f.name).join('、')}
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td className="title">{L['torrent-url']}</td>
              <td>
                <textarea
                  className="eu-textbox"
                  style={{ height: 130 }}
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                />
                <div>{L['tip-torrent-url']}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={2}>
                <hr />
              </td>
            </tr>
            <tr>
              <td className="title">{L.autostart}</td>
              <td>
                <SwitchButton
                  checked={autostart}
                  onChange={setAutostart}
                  onText={lang.public['text-on']}
                  offText={lang.public['text-off']}
                />
              </td>
            </tr>
          </tbody>
        </table>
        {config.nav.labels && (
          <div
            style={{
              borderTop: '1px dotted #ccc',
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            <LabelPicker
              selected={selectedLabels}
              onChange={setSelectedLabels}
              style={{ height: 110 }}
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
