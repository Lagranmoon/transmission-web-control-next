// 配置导出/导入 + 自动匹配数据目录 — 移植原项目对应模板
import { useState } from 'react'
import { Dialog, LinkButton, NumberSpinner, ComboBox } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog, openDialog, showToast } from '../lib/ui'
import { useSession, useRpcMutation, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { configStore, getFolderDictionary, setFolderDictionary, saveConfig, userConfigStore } from '../lib/config'
import { rpc } from '../lib/rpc'
import type { SessionConfig } from '../lib/types'

/* ---------------- 导出配置 ---------------- */
export function ExportConfigDialog({ dialogId }: { dialogId: string }) {
  const { lang } = useLang()
  const session = useSession()
  const L = lang.dialog['export-config']
  const [system, setSystem] = useState(true)
  const [dictionary, setDictionary] = useState(true)
  const [server, setServer] = useState(true)

  const doExport = () => {
    const data: Record<string, unknown> = {}
    if (system) {
      data['system'] = configStore.get()
      data['user'] = userConfigStore.get()
    }
    if (dictionary) {
      data['dictionary-folders'] = getFolderDictionary()
    }
    if (server && session.data) {
      const srv: Record<string, unknown> = { ...session.data }
      // 排除不需要/不可导入的参数（与原版一致）
      for (const key of [
        'blocklist-size',
        'config-dir',
        'rpc-version',
        'rpc-version-minimum',
        'version',
        'session-id',
        'units',
        'download-dir-free-space',
      ]) {
        delete srv[key]
      }
      data['server'] = srv
    }
    if (!Object.keys(data).length) {
      showToast(L.title)
      return
    }
    data['configVersion'] = 1
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tr-web-control-config.json'
    a.click()
    URL.revokeObjectURL(a.href)
    closeDialog(dialogId)
  }

  return (
    <Dialog
      title={L.title}
      width={420}
      height={200}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton icon="icon-ok" onClick={doExport}>
            {lang.dialog.public['button-ok']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog p-1">
        <label className="block">
          <input type="checkbox" checked={system} onChange={(e) => setSystem(e.target.checked)} />
          {L['option-system']}
        </label>
        <label className="block">
          <input type="checkbox" checked={dictionary} onChange={(e) => setDictionary(e.target.checked)} />
          {L['option-dictionary']}
        </label>
        <label className="block">
          <input type="checkbox" checked={server} onChange={(e) => setServer(e.target.checked)} />
          {L['option-server']}
        </label>
      </div>
    </Dialog>
  )
}

/* ---------------- 导入配置 ---------------- */
export function ImportConfigDialog({ dialogId }: { dialogId: string }) {
  const { lang } = useLang()
  const mutation = useRpcMutation()
  const L = lang.dialog['import-config']
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const doImport = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      if (!data || typeof data !== 'object') throw new Error('invalid')
      if (!window.confirm(lang.dialog['system-config']['import-config-confirm'])) {
        setBusy(false)
        return
      }
      if (data['system']) {
        const sys = data['system'] as Record<string, unknown>
        saveConfig(sys as Parameters<typeof saveConfig>[0])
      }
      if (data['user']) {
        localStorage.setItem('transmission-web-control', JSON.stringify(data['user']))
      }
      if (data['dictionary-folders']) {
        setFolderDictionary(data['dictionary-folders'] as string[])
      }
      if (data['server']) {
        await rpc('session-set', data['server'] as Record<string, unknown>)
      }
      mutation.mutate({ method: 'session-stats' })
      closeDialog(dialogId)
      setTimeout(() => location.reload(), 300)
    } catch {
      setMessage(L['invalid-file'])
      setTimeout(() => setMessage(''), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={L.title}
      width={420}
      height={160}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {message && <span className="mr-2 text-red-600">{message}</span>}
          <LinkButton icon="icon-ok" loading={busy}>
            {lang.dialog.public['button-import']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog p-2">
        <input
          type="file"
          accept=".json"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
          }}
        />
      </div>
    </Dialog>
  )
}

/* ---------------- 自动匹配数据目录 ---------------- */
interface AutoMatchProps {
  dialogId: string
  ids: number[]
}

export function AutoMatchDialog({ dialogId, ids }: AutoMatchProps) {
  const { lang } = useLang()
  const L = lang.dialog['auto-match-data-folder']
  useTorrents()
  const snap = getSnapshot()
  const mutation = useRpcMutation()

  // 候选：已停止且无数据的种子（与原版一致）
  const candidates = ids.filter((id) => {
    const t = snap.all[id]
    return t && t.status === 0 && t.percentDone === 0
  })

  const [folders, setFolders] = useState(getFolderDictionary())
  const [mode, setMode] = useState(localStorage.getItem('auto-match-data-folder-work-mode') || '1')
  const [interval, setInterval] = useState(Number(localStorage.getItem('auto-match-data-folder-time-interval') || 3000) / 1000)
  const [working, setWorking] = useState(false)
  const [curTorrent, setCurTorrent] = useState('')
  const [curFolder, setCurFolder] = useState('')
  const ignoreRef = { current: false }

  const stop = () => {
    setWorking(false)
    mutation.mutate({ method: 'session-stats' })
    closeDialog(dialogId)
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const matchOne = async (id: number, dirList: string[]): Promise<boolean> => {
    for (const dir of dirList) {
      if (!workingRef.current) return false
      setCurFolder(`${dir} [${dirList.indexOf(dir) + 1}/${dirList.length}]`)
      const t = getSnapshot().all[id]
      if (!t || t.downloadDir === dir) continue
      await rpc('torrent-set-location', { ids: [id], location: dir, move: false })
      await rpc('torrent-verify', { ids: [id] })
      await sleep(interval * 1000)
      const result = await rpc<{ torrents: { percentDone: number }[] }>('torrent-get', {
        ids: [id],
        fields: ['percentDone'],
      })
      if (result.torrents?.[0]?.percentDone !== 0) return true
    }
    return false
  }

  const workingRef = { current: false }

  const start = async () => {
    if (!folders.length || !candidates.length) return
    workingRef.current = true
    ignoreRef.current = false
    setWorking(true)
    localStorage.setItem('auto-match-data-folder-work-mode', mode)
    localStorage.setItem('auto-match-data-folder-time-interval', String(interval * 1000))

    try {
      if (mode === '1') {
        // 方式一：按种子逐个匹配目录
        for (let i = 0; i < candidates.length; i++) {
          if (!workingRef.current) break
          const id = candidates[i]
          const name = getSnapshot().all[id]?.name ?? String(id)
          setCurTorrent(`${name} [${i + 1}/${candidates.length}]`)
          if (ignoreRef.current) {
            ignoreRef.current = false
            continue
          }
          await matchOne(id, folders)
        }
      } else {
        // 方式二：按目录逐个匹配种子（批量移动后校验，筛出仍未匹配的）
        let remaining = [...candidates]
        for (let i = 0; i < folders.length && remaining.length; i++) {
          if (!workingRef.current) break
          const dir = folders[i]
          setCurFolder(`${dir} [${i + 1}/${folders.length}]`)
          setCurTorrent(String(remaining.length))
          await rpc('torrent-set-location', { ids: remaining, location: dir, move: false })
          await rpc('torrent-verify', { ids: remaining })
          await sleep(interval * 1000)
          const result = await rpc<{ torrents: { id: number; status: number; percentDone: number }[] }>(
            'torrent-get',
            { ids: remaining, fields: ['status', 'id', 'percentDone'] },
          )
          remaining = (result.torrents || [])
            .filter((t) => t.status === 0 && t.percentDone === 0)
            .map((t) => t.id)
        }
      }
    } catch (e) {
      showToast(`${lang.error['data-post-error']}: ${String((e as Error).message)}`)
    }
    stop()
  }

  return (
    <Dialog
      title={L.title}
      width={520}
      height={280}
      onClose={() => {
        if (working && !window.confirm(L['working-close-confirm'])) return
        workingRef.current = false
        closeDialog(dialogId)
      }}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            disabled={!folders.length || !candidates.length}
            loading={working}
            onClick={() => void start()}
          >
            {lang.dialog.public['button-ok']}
          </LinkButton>
          <LinkButton
            icon="icon-cancel"
            onClick={() => {
              if (working && !window.confirm(L['working-close-confirm'])) return
              workingRef.current = false
              closeDialog(dialogId)
            }}
          >
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog">
        <table>
          <tbody>
            <tr>
              <td width="30%" className="title">{L['torrent-count']}</td>
              <td>{candidates.length}</td>
              <td width="20%" />
            </tr>
            <tr>
              <td className="title">{L['folder-count']}</td>
              <td>{folders.length}</td>
              <td>
                <LinkButton icon="tr-icon-system-config" onClick={() => openDialog('auto-match-dictionary', { onSaved: (f: string[]) => setFolders(f) })}>
                  {lang.dialog.public['button-config']}
                </LinkButton>
              </td>
            </tr>
            <tr>
              <td className="title">{L['work-mode-title']}</td>
              <td>
                <ComboBox
                  width={200}
                  value={mode}
                  options={[
                    { value: '1', text: L['work-mode']['1'] },
                    { value: '2', text: L['work-mode']['2'] },
                  ]}
                  onChange={setMode}
                />
              </td>
              <td />
            </tr>
            <tr>
              <td className="title">{L['time-interval']}</td>
              <td>
                <NumberSpinner value={interval} onChange={setInterval} width={200} min={0.5} />
              </td>
              <td />
            </tr>
            <tr>
              <td className="title" colSpan={3} style={{ textAlign: 'left' }}>{L.status}</td>
            </tr>
            <tr style={{ display: working ? '' : 'none' }}>
              <td colSpan={3}>
                <div className="truncate" title={curTorrent}>-&gt; {curTorrent}</div>
                <div className="flex items-center">
                  <span className="truncate" style={{ maxWidth: 400 }} title={curFolder}>-&gt; {curFolder}</span>
                  {mode === '1' && (
                    <LinkButton
                      icon="icon-ignore"
                      className="ml-2"
                      title={L.ignore}
                      onClick={() => {
                        ignoreRef.current = true
                      }}
                    >
                      {L.ignore}
                    </LinkButton>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

/** 目录字典编辑（原 dialog-auto-match-data-folder-dictionary） */
export function AutoMatchDictionaryDialog({
  dialogId,
  onSaved,
}: {
  dialogId: string
  onSaved?: (folders: string[]) => void
}) {
  const { lang } = useLang()
  const L = lang.dialog['auto-match-data-folder']
  const [text, setText] = useState(getFolderDictionary().join('\n'))
  return (
    <Dialog
      title={L.dictionary}
      width={530}
      height={280}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            onClick={() => {
              const list = text.split('\n').map((s) => s.trim()).filter(Boolean)
              setFolderDictionary(list)
              onSaved?.(list)
              closeDialog(dialogId)
            }}
          >
            {lang.dialog.public['button-save']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <div className="dialog h-full flex flex-col">
        <span className="tip">{(lang.dialog['system-config'].tabs as Record<string, string>)['dictionary-folders']}</span>
        <textarea className="eu-textbox flex-1" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
    </Dialog>
  )
}
