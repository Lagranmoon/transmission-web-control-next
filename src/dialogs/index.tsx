// 对话框集合 — 复刻原项目 template/dialog-*.html
import { useMemo, useState } from 'react'
import { Dialog, LinkButton, ComboBox, NumberSpinner, SwitchButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog, showProgress, hideProgress, useUi } from '../lib/ui'
import { useSession, useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { configStore, getFolderDictionary, useConfig, saveConfig } from '../lib/config'
import { rpc, addTorrentFile } from '../lib/rpc'
import { uniq } from '../lib/format'
import { LabelPicker } from '../components/LabelPicker'
import { asset } from '../lib/asset'
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
            return <AddTorrentDialog key={d.id} dialogId={d.id} files={p.files} />
          case 'torrent-remove-confirm':
            return <RemoveConfirmDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'torrent-rename':
            return <RenameDialog key={d.id} dialogId={d.id} id={p.id} />
          case 'torrent-changeDownloadDir':
            return <ChangeDownloadDirDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'torrent-changeSpeedLimit':
            return <ChangeSpeedLimitDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'torrent-attribute-add-tracker':
            return <AddTrackerDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'system-replaceTracker':
            return <ReplaceTrackerDialog key={d.id} dialogId={d.id} />
          case 'system-config':
            return <SystemConfigDialog key={d.id} dialogId={d.id} />
          case 'about':
            return <AboutDialog key={d.id} dialogId={d.id} />
          case 'torrent-setLabels':
            return <SetLabelsDialog key={d.id} dialogId={d.id} hashs={p.hashs} />
          case 'export-config':
            return <ExportConfigDialog key={d.id} dialogId={d.id} />
          case 'import-config':
            return <ImportConfigDialog key={d.id} dialogId={d.id} />
          case 'auto-match':
            return <AutoMatchDialog key={d.id} dialogId={d.id} ids={p.ids} />
          case 'auto-match-dictionary':
            return <AutoMatchDictionaryDialog key={d.id} dialogId={d.id} onSaved={p.onSaved} />
          default:
            return null
        }
      })}
    </>
  )
}

/* ---------------- 添加种子（URL / 文件） ---------------- */
export function AddTorrentDialog({ dialogId, files }: { dialogId: string; files?: File[] }) {
  const { lang } = useLang()
  const config = useConfig()
  const session = useSession()
  useTorrents()
  const snap = getSnapshot()
  const mutation = useRpcMutation()
  const L = lang.dialog['torrent-add']
  const defaultDir = (session.data?.['download-dir'] as string) || ''
  const [dir, setDir] = useState(defaultDir)
  const [urls, setUrls] = useState('')
  const [autostart, setAutostart] = useState(!!session.data?.['start-added-torrents'])
  const [setDefault, setSetDefault] = useState(false)
  const [fileList, setFileList] = useState<File[]>(files || [])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  // 添加时同步打标签（原 label_page）
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set())

  const dirOptions = useMemo(() => {
    const list = uniq([...(defaultDir ? [defaultDir] : []), ...snap.downloadDirs, ...getFolderDictionary()])
      .map((d) => (d.endsWith('/') ? d.slice(0, -1) : d))
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
            if (added['torrent-added']?.hashString) saveLabelsFor(added['torrent-added'].hashString)
          } finally {
            done++
            setStatus(`${done}/${fileList.length}`)
          }
        }
        mutation.reset()
        void mutation.mutate({ method: 'session-stats' })
      } else if (urlText) {
        const list = urlText.split('\n').map((s) => s.trim()).filter(Boolean)
        let i = 0
        for (const url of list) {
          i++
          setStatus(`${lang.system.status.queue}${i}/${list.length} ${url}`)
          const u = /^[0-9a-f]{40}$/i.test(url) ? 'magnet:?xt=urn:btih:' + url : url
          const added = await rpc<{ 'torrent-added'?: { hashString: string } }>('torrent-add', {
            filename: u,
            paused: !autostart,
            'download-dir': dir,
          })
          if (added['torrent-added']?.hashString) saveLabelsFor(added['torrent-added'].hashString)
        }
        setStatus(lang.system.status.queuefinish)
      }
      closeDialog(dialogId)
    } catch (e) {
      setStatus(String((e as Error).message || e))
      setBusy(false)
      return
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
          <LinkButton icon="icon-ok" onClick={ok} loading={busy}>
            {lang.dialog.public['button-ok']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog">
        <div className="mb-1 p-1 border border-[#c0c0c0] bg-[#ffffcc]">{L['tip-title']}</div>
        <table>
          <tbody>
            <tr>
              <td width="20%" className="title">{L['download-dir']}</td>
              <td>
                <ComboBox value={dir} options={dirOptions} onChange={setDir} width={450} editable />
                <label className="ml-3">
                  <input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} />
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
                  onChange={(e) => setFileList(Array.from(e.target.files || []))}
                />
                {fileList.length > 0 && <div className="text-[var(--eu-text)]">{fileList.map((f) => f.name).join('、')}</div>}
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
                <SwitchButton checked={autostart} onChange={setAutostart} onText={lang.public['text-on']} offText={lang.public['text-off']} />
              </td>
            </tr>
          </tbody>
        </table>
        {config.nav.labels && (
          <div style={{ borderTop: '1px dotted #ccc', marginTop: 4, paddingTop: 4 }}>
            <LabelPicker selected={selectedLabels} onChange={setSelectedLabels} style={{ height: 110 }} />
          </div>
        )}
      </div>
    </Dialog>
  )
}

/* ---------------- 删除确认 ---------------- */
export function RemoveConfirmDialog({ dialogId, ids }: { dialogId: string; ids: number[] }) {
  const { lang } = useLang()
  const mutation = useRpcMutation()
  const [removeData, setRemoveData] = useState(false)
  const L = lang.dialog['torrent-remove']
  return (
    <Dialog
      title={L.title}
      width={350}
      height={170}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            loading={mutation.isPending}
            onClick={() => {
              // 批量删除期间在右下角显示进度浮层（onSettled 清除）
              showProgress(lang.public['text-processing'].replace('%n', String(ids.length)))
              mutation.mutate(
                { method: 'torrent-remove', args: { ids, 'delete-local-data': removeData } },
                {
                  onSuccess: () => closeDialog(dialogId),
                  onError: () => alert(L['remove-error']),
                  onSettled: () => hideProgress(),
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
      <div className="p-2">
        <span className="messager-question" />
        <div>{L['confirm-text']}</div>
        <hr />
        <label>
          <input type="checkbox" checked={removeData} onChange={(e) => setRemoveData(e.target.checked)} />
          {L['remove-data']}
        </label>
      </div>
    </Dialog>
  )
}

/* ---------------- 重命名 ---------------- */
export function RenameDialog({ dialogId, id }: { dialogId: string; id: number }) {
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
                { method: 'torrent-rename-path', args: { ids: [id], path: '', name } },
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
              <td width="20%" className="title">{L.oldname}</td>
              <td>{torrent.name}</td>
            </tr>
            <tr>
              <td className="title">{L.newname}</td>
              <td>
                <textarea className="eu-textbox" style={{ height: 50 }} value={name} onChange={(e) => setName(e.target.value)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

/* ---------------- 变更保存目录 ---------------- */
export function ChangeDownloadDirDialog({ dialogId, ids }: { dialogId: string; ids: number[] }) {
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
      ...(session.data?.['download-dir'] ? [session.data['download-dir'] as string] : []),
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
    const moveIds = ids.filter((id) => snap.all[id] && snap.all[id].downloadDir !== dir)
    if (moveIds.length) {
      setBusy(true)
      // 批量迁移期间在右下角显示进度浮层
      showProgress(lang.public['text-processing'].replace('%n', String(moveIds.length)))
      try {
        await rpc('torrent-set-location', { ids: moveIds, location: dir, move: moveData })
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
          <LinkButton icon="icon-ok" onClick={ok} loading={busy}>
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
              <td width="22%" className="title">{L['old-download-dir']}</td>
              <td>{torrent.downloadDir}</td>
            </tr>
            <tr>
              <td className="title">{L['new-download-dir']}</td>
              <td>
                <ComboBox value={dir} options={dirOptions} onChange={setDir} width={400} editable />
              </td>
            </tr>
            <tr>
              <td className="title" />
              <td>
                <label>
                  <input type="checkbox" checked={moveData} onChange={(e) => setMoveData(e.target.checked)} />
                  {L['move-data']}
                </label>
              </td>
            </tr>
            <tr>
              <td className="title" />
              <td>
                <label>
                  <input type="checkbox" checked={recheck} onChange={(e) => setRecheck(e.target.checked)} />
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

/* ---------------- 上传/下载限速 ---------------- */
export function ChangeSpeedLimitDialog({ dialogId, ids }: { dialogId: string; ids: number[] }) {
  const { lang } = useLang()
  useTorrents()
  const snap = getSnapshot()
  const mutation = useRpcMutation()
  const torrent = snap.all[ids[0]]
  const L = lang.dialog['torrent-changeSpeedLimit']
  const [downloadLimited, setDownloadLimited] = useState(!!torrent?.downloadLimited)
  const [downloadLimit, setDownloadLimit] = useState(torrent?.downloadLimit ?? 0)
  const [uploadLimited, setUploadLimited] = useState(!!torrent?.uploadLimited)
  const [uploadLimit, setUploadLimit] = useState(torrent?.uploadLimit ?? 0)
  const [peerLimit, setPeerLimit] = useState(Number(torrent?.['peer-limit'] ?? 60))

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
                  <input type="checkbox" checked={downloadLimited} onChange={(e) => setDownloadLimited(e.target.checked)} />
                  {L.downloadLimited}
                </label>
              </td>
              <td>
                <NumberSpinner value={downloadLimit} onChange={setDownloadLimit} width={200} disabled={!downloadLimited} /> KB/s
              </td>
            </tr>
            <tr>
              <td className="title">
                <label>
                  <input type="checkbox" checked={uploadLimited} onChange={(e) => setUploadLimited(e.target.checked)} />
                  {L.uploadLimited}
                </label>
              </td>
              <td>
                <NumberSpinner value={uploadLimit} onChange={setUploadLimit} width={200} disabled={!uploadLimited} /> KB/s
              </td>
            </tr>
            <tr>
              <td className="title">{L['peer-limit']}</td>
              <td>
                <NumberSpinner value={peerLimit} onChange={setPeerLimit} width={200} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

/* ---------------- 增加 Tracker ---------------- */
export function AddTrackerDialog({ dialogId, ids }: { dialogId: string; ids: number[] }) {
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
              const list = urls.split('\n').map((s) => s.trim()).filter(Boolean)
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
        <textarea className="eu-textbox" style={{ height: 120 }} value={urls} onChange={(e) => setUrls(e.target.value)} />
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
    if (count > 0) showProgress(lang.public['text-processing'].replace('%n', String(count)))
    try {
      for (const [trackerId, torrentIds] of grouped) {
        done++
        setMessage(`-> [${done}/${grouped.size}]`)
        await rpc('torrent-set', { ids: torrentIds, trackerReplace: [trackerId, newUrl] })
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
          <LinkButton icon="icon-ok" onClick={ok} loading={busy}>
            {lang.dialog.public['button-ok']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog">
        <span className="tip block mb-1" dangerouslySetInnerHTML={{ __html: L.tip }} />
        <table>
          <tbody>
            <tr>
              <td width="20%" className="title">{L['old-tracker']}</td>
              <td>
                <input className="eu-textbox w-full" value={oldUrl} onChange={(e) => setOldUrl(e.target.value)} />
              </td>
            </tr>
            <tr>
              <td className="title">{L['new-tracker']}</td>
              <td>
                <input className="eu-textbox w-full" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

/* ---------------- 关于 ---------------- */
export function AboutDialog({ dialogId }: { dialogId: string }) {
  const { lang, name } = useLang()
  const session = useSession()
  const zh = name === 'zh-CN'
  return (
    <Dialog title={lang.toolbar.about} width={420} height={340} onClose={() => closeDialog(dialogId)}>
      <div className="text-center leading-6">
        <img src={asset('assets/images/logo.png')} width={52} height={52} className="mx-auto" alt="logo" />
        <div className="mt-2 text-[15px] font-medium text-[var(--eu-title)]">Transmission Web Control Next</div>
        <div>v{__APP_VERSION__}</div>
        <hr className="my-3" />
        <div>Transmission: {session.data?.version ?? '-'}, RPC: {session.data?.['rpc-version'] ?? '-'}</div>
        <div className="mt-2 text-[13px]">
          <div>Copyright © 2026 Lagranmoon</div>
          <div>
            {zh ? '基于原项目' : 'Based on'}{' '}
            <a className="text-[#0066cc]" href="https://github.com/ronggang/transmission-web-control" target="_blank" rel="noreferrer">
              Transmission Web Control
            </a>{' '}
            © 2012-2019 {zh ? '栽培者' : 'ronggang'} (MIT)
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-1">
          <a className="l-btn" href="https://github.com/Lagranmoon/transmission-web-control-next" target="_blank" rel="noreferrer" title={lang.dialog.about.home}>
            <i className="iconfont tr-icon-github" />
          </a>
        </div>
      </div>
    </Dialog>
  )
}

/* ---------------- 设置用户标签 ---------------- */
export function SetLabelsDialog({ dialogId, hashs }: { dialogId: string; hashs: string[] }) {
  const { lang } = useLang()
  const config = useConfig()
  const L = lang.dialog['torrent-setLabels']
  // 初始化：取第一个种子的现有标签（惰性初始化，避免渲染期 setState）
  const [selected, setSelected] = useState<Set<number>>(() => new Set(config.labelMaps[hashs[0]] ?? []))
  return (
    <Dialog
      title={L.title}
      width={520}
      height={220}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            onClick={() => {
              const maps = { ...config.labelMaps }
              const ids = Array.from(selected)
              for (const h of hashs) {
                if (ids.length) maps[h] = ids
                else delete maps[h]
              }
              saveConfig({ labelMaps: maps })
              closeDialog(dialogId)
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
      <LabelPicker selected={selected} onChange={setSelected} style={{ height: '100%' }} />
    </Dialog>
  )
}

export { SystemConfigDialog }
