// 服务器参数设置 — 复刻 dialog-system-config.html（基本/网络/带宽/时段/目录字典/更多/标签）
// 各页签表单已拆分至 system/ 目录，本文件只负责加载、保存基线与页签切换
import { useEffect, useState } from 'react'
import { Dialog, LinkButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog, showToast } from '../lib/ui'
import { useSession } from '../api/queries'
import { getFolderDictionary, useConfig } from '../lib/config'
import { rpc } from '../lib/rpc'
import { SESSION_READONLY_KEYS } from '../lib/types'
import { LabelsManage } from './LabelsManage'
import { AltSpeedTab } from './system/AltSpeedTab'
import { BaseConfigTab } from './system/BaseConfigTab'
import { DictionaryTab } from './system/DictionaryTab'
import { LimitTab } from './system/LimitTab'
import { MoreTab } from './system/MoreTab'
import { NetworkTab, type PortTestResult } from './system/NetworkTab'
import type { SessionForm, SetSessionField } from './system/types'

/** session-get 中只读、不可通过 session-set 设置的字段（与导出配置共用清单） */
const READONLY_KEYS = new Set<string>(SESSION_READONLY_KEYS)

export function SystemConfigDialog({ dialogId }: { dialogId: string }) {
  const { lang } = useLang()
  const session = useSession()
  const config = useConfig()
  const L = lang.dialog['system-config']
  const [tab, setTab] = useState('base')
  const [form, setForm] = useState<SessionForm | null>(null)
  // 保存基线：打开对话框时的 session 快照。不能拿轮询中的 session.data 做 diff —— 面板打开期间
  // 守护进程侧的任何变化都会让未触碰的表单字段被当成「用户修改」重新写回，反向覆盖外部改动。
  const [baseline, setBaseline] = useState<SessionForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<PortTestResult>(null)
  // 目录字典草稿提升到对话框层级：页签切换会卸载子组件，不能丢失未保存的编辑
  const [foldersText, setFoldersText] = useState(() =>
    getFolderDictionary().join('\n'),
  )

  useEffect(() => {
    if (!form && session.data) {
      setForm({ ...session.data })
      setBaseline({ ...session.data })
    }
  }, [session.data, form])

  const set: SetSessionField = (patch) =>
    setForm((f) => ({ ...(f || {}), ...patch }))

  if (!form) {
    return (
      <Dialog
        title={L.title}
        width={680}
        height={500}
        resizable
        dialogId={dialogId}
        onClose={() => closeDialog(dialogId)}
      >
        <div className="p-4">{L.loading}</div>
      </Dialog>
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      // 与原版一致：只提交相对打开时快照的变更项，排除只读字段
      const base = baseline ?? {}
      const changed: SessionForm = {}
      for (const key of Object.keys(form)) {
        if (READONLY_KEYS.has(key)) continue
        if (form[key] !== base[key]) changed[key] = form[key]
      }
      if (Object.keys(changed).length) await rpc('session-set', changed)
      setBaseline({ ...form })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await session.refetch()
    } catch (e) {
      showToast(String((e as Error).message || e))
    } finally {
      setSaving(false)
    }
  }

  const testPort = async () => {
    setTestResult('testing')
    try {
      // 端口有变更时先保存生效再测试，避免测到旧端口（与原版一致）
      if (
        form['peer-port'] != null &&
        form['peer-port'] !== baseline?.['peer-port']
      ) {
        await rpc('session-set', { 'peer-port': form['peer-port'] })
        // 该字段已单独生效：基线同步前移，之后若把输入框改回旧值再保存才会被识别为新变更
        setBaseline((b) => ({ ...(b || {}), 'peer-port': form['peer-port'] }))
        void session.refetch()
      }
      const r = await rpc<{ 'port-is-open': boolean }>('port-test')
      setTestResult(r['port-is-open'] ? 'open' : 'closed')
    } catch {
      setTestResult('closed')
    }
  }

  const tabs = [
    { id: 'base', title: L.tabs.base },
    { id: 'network', title: L.tabs.network },
    { id: 'limit', title: L.tabs.limit },
    { id: 'alt-speed', title: L.tabs['alt-speed'] },
    { id: 'dictionary', title: L.tabs['dictionary-folders'] },
    { id: 'more', title: L.tabs.more },
    ...(config.nav.labels ? [{ id: 'labels', title: L.tabs.labels }] : []),
  ]

  return (
    <Dialog
      title={L.title}
      width={680}
      height={520}
      resizable
      dialogId={dialogId}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          {saved && <span className="mr-2">{lang.public['text-saved']}</span>}
          <LinkButton
            icon="icon-ok"
            onClick={() => void save()}
            loading={saving}
          >
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

      {tab === 'base' && <BaseConfigTab form={form} set={set} />}
      {tab === 'network' && (
        <NetworkTab
          form={form}
          set={set}
          testResult={testResult}
          onTestPort={() => void testPort()}
        />
      )}
      {tab === 'limit' && <LimitTab form={form} set={set} />}
      {tab === 'alt-speed' && <AltSpeedTab form={form} set={set} />}
      {tab === 'dictionary' && (
        <DictionaryTab text={foldersText} onChange={setFoldersText} />
      )}
      {tab === 'more' && <MoreTab />}
      {tab === 'labels' && <LabelsManage />}
    </Dialog>
  )
}
