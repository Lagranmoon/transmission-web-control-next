// 服务器参数设置 — 复刻 dialog-system-config.html（基本/网络/带宽/时段/目录字典/更多/标签）
import { useEffect, useState } from 'react'
import { Dialog, LinkButton, NumberSpinner, SwitchButton, ComboBox } from '../components/ui'
import { useLang, LANGUAGES } from '../i18n'
import { closeDialog, openDialog, showToast } from '../lib/ui'
import { useSession, useRpcMutation, useFreeSpace } from '../api/queries'
import { configStore, getFolderDictionary, setFolderDictionary, saveConfig, useConfig } from '../lib/config'
import { formatSize } from '../lib/format'
import { rpc } from '../lib/rpc'

type S = Record<string, any>

export function SystemConfigDialog({ dialogId }: { dialogId: string }) {
  const { lang, name: langName } = useLang()
  const session = useSession()
  const mutation = useRpcMutation()
  const config = useConfig()
  const L = lang.dialog['system-config']
  const [tab, setTab] = useState('base')
  const [form, setForm] = useState<S | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<'testing' | 'open' | 'closed' | null>(null)
  const [foldersText, setFoldersText] = useState(getFolderDictionary().join('\n'))

  useEffect(() => {
    if (!form && session.data) setForm({ ...session.data } as S)
  }, [session.data, form])

  const set = (patch: S) => setForm((f) => ({ ...(f || {}), ...patch }))
  const free = useFreeSpace(form?.['download-dir'])

  if (!form) {
    return (
      <Dialog title={L.title} width={680} height={500} onClose={() => closeDialog(dialogId)}>
        <div className="p-4">{L.loading}</div>
      </Dialog>
    )
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      await rpc('session-set', { ...form })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await session.refetch()
    } finally {
      setSaving(false)
    }
  }

  const testPort = async () => {
    setTestResult('testing')
    try {
      const r = await rpc<{ 'port-is-open': boolean }>('port-test')
      setTestResult(r['port-is-open'] ? 'open' : 'closed')
    } catch {
      setTestResult('closed')
    }
  }

  const minutes = <span>{L.minutes}</span>
  const tabs = [
    { id: 'base', title: L.tabs.base },
    { id: 'network', title: L.tabs.network },
    { id: 'limit', title: L.tabs.limit },
    { id: 'alt-speed', title: L.tabs['alt-speed'] },
    { id: 'dictionary', title: L.tabs['dictionary-folders'] },
    { id: 'more', title: L.tabs.more },
    ...(configStore.get().nav.labels ? [{ id: 'labels', title: L.tabs.labels }] : []),
  ]

  return (
    <Dialog
      title={L.title}
      width={680}
      height={520}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {saved && <span className="mr-2">{lang.public['text-saved']}</span>}
          <LinkButton icon="icon-ok" onClick={save} loading={saving}>
            {lang.dialog.public['button-save']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-close']}
          </LinkButton>
        </>
      }
    >
      <div className="flex gap-1 border-b border-[#ccc] mb-1 flex-wrap">
        {tabs.map((t) => (
          <span
            key={t.id}
            className={`px-2 py-0.5 cursor-pointer rounded-t ${tab === t.id ? 'bg-[var(--eu-selected)] border border-b-0 border-[var(--eu-border)]' : 'hover:bg-[var(--eu-hover)]'}`}
            onClick={() => setTab(t.id)}
          >
            {t.title}
          </span>
        ))}
      </div>

      {tab === 'base' && (
        <div className="dialog">
          <table>
            <tbody>
              <tr>
                <td className="title">{L['config-dir']}</td>
                <td colSpan={3}>{form['config-dir']}</td>
              </tr>
              <tr>
                <td className="title">{L['download-dir']}</td>
                <td colSpan={3}>
                  <input className="eu-textbox w-full" value={form['download-dir'] ?? ''} onChange={(e) => set({ 'download-dir': e.target.value })} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['download-dir-free-space']}</td>
                <td colSpan={3}>
                  {free.data ? formatSize(free.data['size-bytes']) : formatSize(form['download-dir-free-space'])}{' '}
                  {form['incomplete-dir-enabled'] ? `(${form['incomplete-dir'] ?? ''})` : ''}
                </td>
              </tr>
              <tr>
                <td className="title">{L['incomplete-dir-enabled']}</td>
                <td colSpan={3}>
                  <SwitchButton
                    checked={!!form['incomplete-dir-enabled']}
                    onChange={(v) => set({ 'incomplete-dir-enabled': v })}
                    onText={lang.public['text-on']}
                    offText={lang.public['text-off']}
                  />
                </td>
              </tr>
              <tr>
                <td className="title">{L['cache-size-mb']}</td>
                <td>
                  <NumberSpinner value={form['cache-size-mb'] ?? 0} onChange={(v) => set({ 'cache-size-mb': v })} width={90} />
                </td>
                <td className="title">{L['rename-partial-files']}</td>
                <td>
                  <SwitchButton checked={!!form['rename-partial-files']} onChange={(v) => set({ 'rename-partial-files': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['start-added-torrents']}</td>
                <td>
                  <SwitchButton checked={!!form['start-added-torrents']} onChange={(v) => set({ 'start-added-torrents': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
                <td className="title">{L['download-queue-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['download-queue-enabled']} onChange={(v) => set({ 'download-queue-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form['download-queue-size'] ?? 0} onChange={(v) => set({ 'download-queue-size': v })} width={60} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['seed-queue-enabled']}</td>
                <td colSpan={3}>
                  <SwitchButton checked={!!form['seed-queue-enabled']} onChange={(v) => set({ 'seed-queue-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form['seed-queue-size'] ?? 0} onChange={(v) => set({ 'seed-queue-size': v })} width={60} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['script-torrent-done-enabled']}</td>
                <td colSpan={3}>
                  <SwitchButton checked={!!form['script-torrent-done-enabled']} onChange={(v) => set({ 'script-torrent-done-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <input className="eu-textbox" style={{ width: 320 }} value={form['script-torrent-done-filename'] ?? ''} onChange={(e) => set({ 'script-torrent-done-filename': e.target.value })} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'network' && (
        <div className="dialog">
          <table>
            <tbody>
              <tr>
                <td className="title">{L['peer-port-random-on-start']}</td>
                <td>
                  <SwitchButton checked={!!form['peer-port-random-on-start']} onChange={(v) => set({ 'peer-port-random-on-start': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
                <td className="title">{L['port-forwarding-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['port-forwarding-enabled']} onChange={(v) => set({ 'port-forwarding-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
              </tr>
              <tr>
                <td className="title">{lang.dialog['system-config']['peer-port-random-on-start'].includes('固定') ? '端口：' : 'Port:'}</td>
                <td>
                  <NumberSpinner value={form['peer-port'] ?? 0} onChange={(v) => set({ 'peer-port': v })} width={90} disabled={!!form['peer-port-random-on-start']} />{' '}
                  <LinkButton onClick={testPort} loading={testResult === 'testing'}>
                    {L['test-port']}
                  </LinkButton>
                  {testResult === 'open' && <span className="text-green-600 ml-1">{L['port-is-open-true']}</span>}
                  {testResult === 'closed' && <span className="text-red-600 ml-1">{L['port-is-open-false']}</span>}
                </td>
                <td className="title">{L.encryption}</td>
                <td>
                  <ComboBox
                    width={140}
                    value={String(form.encryption ?? 'tolerated')}
                    options={[
                      { value: 'required', text: L['encryption-type'].required },
                      { value: 'preferred', text: L['encryption-type'].preferred },
                      { value: 'tolerated', text: L['encryption-type'].tolerated },
                    ]}
                    onChange={(v) => set({ encryption: v })}
                  />
                </td>
              </tr>
              <tr>
                <td className="title">{L['utp-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['utp-enabled']} onChange={(v) => set({ 'utp-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
                <td className="title">{L['dht-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['dht-enabled']} onChange={(v) => set({ 'dht-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['lpd-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['lpd-enabled']} onChange={(v) => set({ 'lpd-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
                <td className="title">{L['pex-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['pex-enabled']} onChange={(v) => set({ 'pex-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'limit' && (
        <div className="dialog">
          <table>
            <tbody>
              <tr>
                <td className="title">{L['speed-limit-down-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['speed-limit-down-enabled']} onChange={(v) => set({ 'speed-limit-down-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form['speed-limit-down'] ?? 0} onChange={(v) => set({ 'speed-limit-down': v })} width={90} disabled={!form['speed-limit-down-enabled']} /> KB/s
                </td>
                <td className="title">{L['speed-limit-up-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['speed-limit-up-enabled']} onChange={(v) => set({ 'speed-limit-up-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form['speed-limit-up'] ?? 0} onChange={(v) => set({ 'speed-limit-up': v })} width={90} disabled={!form['speed-limit-up-enabled']} /> KB/s
                </td>
              </tr>
              <tr>
                <td className="title">{L['peer-limit-global']}</td>
                <td>
                  <NumberSpinner value={form['peer-limit-global'] ?? 0} onChange={(v) => set({ 'peer-limit-global': v })} width={90} />
                </td>
                <td className="title">{L['peer-limit-per-torrent']}</td>
                <td>
                  <NumberSpinner value={form['peer-limit-per-torrent'] ?? 0} onChange={(v) => set({ 'peer-limit-per-torrent': v })} width={90} />
                </td>
              </tr>
              <tr>
                <td className="title">{L.seedRatioLimited}</td>
                <td colSpan={3}>
                  <SwitchButton checked={!!form.seedRatioLimited} onChange={(v) => set({ seedRatioLimited: v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form.seedRatioLimit ?? 0} onChange={(v) => set({ seedRatioLimit: v })} width={90} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['queue-stalled-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['queue-stalled-enabled']} onChange={(v) => set({ 'queue-stalled-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form['queue-stalled-minutes'] ?? 0} onChange={(v) => set({ 'queue-stalled-minutes': v })} width={90} /> {minutes}
                </td>
                <td className="title">{L['idle-seeding-limit-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['idle-seeding-limit-enabled']} onChange={(v) => set({ 'idle-seeding-limit-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <NumberSpinner value={form['idle-seeding-limit'] ?? 0} onChange={(v) => set({ 'idle-seeding-limit': v })} width={90} /> {minutes}
                </td>
              </tr>
              <tr>
                <td className="title">{L['blocklist-enabled']}</td>
                <td colSpan={3}>
                  <SwitchButton checked={!!form['blocklist-enabled']} onChange={(v) => set({ 'blocklist-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />{' '}
                  <span>{L['blocklist-size'].replace('%n', String(form['blocklist-size'] ?? 0))}</span>{' '}
                  <LinkButton
                    icon="tr-icon-reload"
                    onClick={async () => {
                      const r = await rpc<{ 'blocklist-size': number }>('blocklist-update')
                      set({ 'blocklist-size': r['blocklist-size'] })
                    }}
                  >
                    {lang.dialog.public['button-update']}
                  </LinkButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'alt-speed' && (
        <div className="dialog">
          <table>
            <tbody>
              <tr>
                <td className="title">{L['alt-speed-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['alt-speed-enabled']} onChange={(v) => set({ 'alt-speed-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
                <td className="title">{L['alt-speed-time-enabled']}</td>
                <td>
                  <SwitchButton checked={!!form['alt-speed-time-enabled']} onChange={(v) => set({ 'alt-speed-time-enabled': v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
              </tr>
              <tr>
                <td className="title">{L['alt-speed-down']}</td>
                <td>
                  <NumberSpinner value={form['alt-speed-down'] ?? 0} onChange={(v) => set({ 'alt-speed-down': v })} width={90} /> KB/s
                </td>
                <td className="title">{L['alt-speed-up']}</td>
                <td>
                  <NumberSpinner value={form['alt-speed-up'] ?? 0} onChange={(v) => set({ 'alt-speed-up': v })} width={90} /> KB/s
                </td>
              </tr>
              <tr>
                <td className="title">{L['alt-speed-time']}</td>
                <td colSpan={3}>
                  <input
                    type="time"
                    className="eu-textbox"
                    value={timeStr(form['alt-speed-time-begin'])}
                    onChange={(e) => set({ 'alt-speed-time-begin': minutesOf(e.target.value) })}
                    disabled={!form['alt-speed-time-enabled']}
                  />
                  {' '}~{' '}
                  <input
                    type="time"
                    className="eu-textbox"
                    value={timeStr(form['alt-speed-time-end'])}
                    onChange={(e) => set({ 'alt-speed-time-end': minutesOf(e.target.value) })}
                    disabled={!form['alt-speed-time-enabled']}
                  />{' '}
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <label key={d} className="ml-2">
                      <input
                        type="checkbox"
                        checked={!!((form['alt-speed-time-day'] ?? 0) & (1 << d))}
                        onChange={(e) => {
                          const cur = form['alt-speed-time-day'] ?? 0
                          set({ 'alt-speed-time-day': e.target.checked ? cur | (1 << d) : cur & ~(1 << d) })
                        }}
                      />
                      {L.weekday[String(d) as keyof typeof L.weekday]}
                    </label>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'dictionary' && (
        <div className="dialog flex flex-col h-full">
          <div className="mb-1">{L.tabs['dictionary-folders']}</div>
          <textarea
            className="eu-textbox flex-1"
            value={foldersText}
            onChange={(e) => setFoldersText(e.target.value)}
            placeholder="/downloads/movies&#10;/data/series"
          />
          <div className="mt-1">
            <LinkButton
              icon="icon-ok"
              onClick={() => {
                setFolderDictionary(foldersText.split('\n').map((s) => s.trim()).filter(Boolean))
                showToast(lang.public['text-saved'])
              }}
            >
              {lang.dialog.public['button-save']}
            </LinkButton>
          </div>
        </div>
      )}

      {tab === 'more' && (
        <div className="dialog">
          <table>
            <tbody>
              <tr>
                <td className="title">{L['show-bt-servers']}</td>
                <td colSpan={3}>
                  <SwitchButton
                    checked={config.showBTServers}
                    onChange={(v) => saveConfig({ showBTServers: v })}
                    onText={lang.public['text-on']}
                    offText={lang.public['text-off']}
                  />
                </td>
              </tr>
              <tr>
                <td className="title">{L['hide-subfolders']}</td>
                <td>
                  <SwitchButton checked={config.hideSubfolders} onChange={(v) => saveConfig({ hideSubfolders: v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
                <td className="title">{L['simple-check-mode']}</td>
                <td>
                  <SwitchButton checked={config.simpleCheckMode} onChange={(v) => saveConfig({ simpleCheckMode: v })} onText={lang.public['text-on']} offText={lang.public['text-off']} />
                </td>
              </tr>
              <tr>
                <td className="title">{L.language}</td>
                <td>
                  <ComboBox
                    width={160}
                    value={langName}
                    options={Object.entries(LANGUAGES).map(([value, text]) => ({ value, text }))}
                    onChange={(v) => {
                      localStorage.setItem('twc.lang', v)
                      location.reload()
                    }}
                  />
                </td>
                <td className="title">{L['nav-contents']}</td>
                <td>
                  {(['servers', 'folders', 'statistics', 'labels'] as const).map((k) => (
                    <label key={k} className="mr-2">
                      <input
                        type="checkbox"
                        checked={config.nav[k]}
                        onChange={(e) => saveConfig({ nav: { ...config.nav, [k]: e.target.checked } })}
                      />
                      {k === 'servers' ? lang.tree.servers : k === 'folders' ? lang.tree.folders : k === 'statistics' ? lang.tree.statistics.title : lang.tree.labels}
                    </label>
                  ))}
                </td>
              </tr>
              <tr>
                <td className="title">{L['restore-default-settings']}</td>
                <td colSpan={3}>
                  <LinkButton
                    icon="tr-icon-reload"
                    onClick={() => {
                      localStorage.removeItem('transmission-web-control.system')
                      localStorage.removeItem('transmission-web-control')
                      location.reload()
                    }}
                  >
                    {L['restore-default-settings']}
                  </LinkButton>
                </td>
              </tr>
              <tr>
                <td className="title">{L['ipinfo']}</td>
                <td colSpan={3}>
                  <input
                    className="eu-textbox"
                    style={{ width: 260 }}
                    value={(config as { ipInfoToken?: string }).ipInfoToken ?? ''}
                    onChange={(e) => saveConfig({ ipInfoToken: e.target.value })}
                    placeholder="token"
                  />
                </td>
              </tr>
              <tr>
                <td className="title" style={{ verticalAlign: 'top' }}>{L.ipInfoCustom}</td>
                <td colSpan={3}>
                  <div className="mb-1" style={{ color: '#666' }} dangerouslySetInnerHTML={{ __html: L.ipInfoCustomTips }} />
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ width: 160, textAlign: 'right' }}>{L.ipInfoCountryCodeUrl}</span>
                    <input
                      className="eu-textbox flex-1"
                      value={(config as { ipInfoFlagUrl?: string }).ipInfoFlagUrl ?? ''}
                      onChange={(e) => saveConfig({ ipInfoFlagUrl: e.target.value })}
                      placeholder="https://your.service/flag?ip=%ip"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 160, textAlign: 'right' }}>{L.ipInfoDetailUrl}</span>
                    <input
                      className="eu-textbox flex-1"
                      value={(config as { ipInfoDetailUrl?: string }).ipInfoDetailUrl ?? ''}
                      onChange={(e) => saveConfig({ ipInfoDetailUrl: e.target.value })}
                      placeholder="https://your.service/detail?ip=%ip"
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <td className="title">{L['export-config']}</td>
                <td colSpan={3}>
                  <LinkButton icon="tr-icon-download" onClick={() => openDialog('export-config')}>
                    {lang.dialog.public['button-export']}
                  </LinkButton>
                  <span className="mx-2" />
                  <LinkButton icon="tr-icon-upload" onClick={() => openDialog('import-config')}>
                    {lang.dialog.public['button-import']}
                  </LinkButton>
                  <div style={{ color: '#666' }}>{L['export-config']}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'labels' && <LabelsManage />}
    </Dialog>
  )
}

function timeStr(minutes: number): string {
  const h = Math.floor((minutes ?? 0) / 60)
  const m = (minutes ?? 0) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** hh:mm → 当日分钟数 */
function minutesOf(hhmm: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/* 用户标签管理（更多设置-用户标签） */
function LabelsManage() {
  const { lang } = useLang()
  const config = useConfig()
  const L = lang.dialog['system-config']['labels-manage']
  const [labels, setLabels] = useState(config.labels.map((l) => ({ ...l })))

  const update = (i: number, patch: Partial<(typeof labels)[number]>) => {
    setLabels((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  return (
    <div className="dialog flex flex-col h-full">
      <table className="border border-collapse border-[#ccc]">
        <thead>
          <tr className="bg-[var(--eu-grid-head-bottom)]">
            <th className="border border-[#ccc] px-1">{L.name}</th>
            <th className="border border-[#ccc] px-1">{L.description}</th>
            <th className="border border-[#ccc] px-1">{L.color}</th>
            <th className="border border-[#ccc] px-1">{L.actions}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((lb, i) => (
            <tr key={i}>
              <td className="border border-[#ccc]">
                <input className="eu-textbox w-full" value={lb.name} onChange={(e) => update(i, { name: e.target.value })} />
              </td>
              <td className="border border-[#ccc]">
                <input className="eu-textbox w-full" value={lb.description ?? ''} onChange={(e) => update(i, { description: e.target.value })} />
              </td>
              <td className="border border-[#ccc]">
                <input type="color" value={lb.color} onChange={(e) => update(i, { color: e.target.value })} style={{ width: 40, height: 20 }} />
              </td>
              <td className="border border-[#ccc] text-center">
                <LinkButton
                  icon="tr-icon-delete"
                  onClick={() => {
                    setLabels((arr) => arr.filter((_, idx) => idx !== i))
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1">
        <LinkButton icon="tr-icon-plus" onClick={() => setLabels((arr) => [...arr, { name: `标签${arr.length + 1}`, color: '#4ec94e' }])}>
          {lang.dialog.public['button-addnew']}
        </LinkButton>
        <LinkButton
          icon="icon-ok"
          onClick={() => {
            saveConfig({ labels, nav: { ...config.nav, labels: true } })
          }}
        >
          {lang.dialog.public['button-save']}
        </LinkButton>
      </div>
    </div>
  )
}
