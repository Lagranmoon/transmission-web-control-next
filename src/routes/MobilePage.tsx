// 移动版界面 — 复刻 index.mobile.html + system.mobile.js
// 结构：标题栏 / 分类主页 / 种子列表(复选+分页) / 添加种子 / 底部操作栏+状态栏 / 右侧滑出面板
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLang } from '../i18n'
import { useConfig, saveConfig } from '../lib/config'
import {
  useSession,
  useStats,
  useTorrents,
  useRpcMutation,
  useFreeSpace,
  queryKeys,
} from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { STATUS, type Torrent } from '../lib/types'
import { formatSize } from '../lib/format'
import { rpc } from '../lib/rpc'
import { ProgressBar } from '../lib/columns'

const PAGE_SIZE = 30

type MobileView = 'home' | 'torrent-list' | 'add-torrent'

export function MobilePage() {
  const { lang } = useLang()
  const config = useConfig()
  const session = useSession()
  const stats = useStats()
  const mutation = useRpcMutation()
  const qc = useQueryClient()
  useTorrents()
  const snap = getSnapshot()
  // Transmission 4 / RPC 15 起 session-get 不再返回 download-dir-free-space，需单独查询
  const freeSpace = useFreeSpace(session.data?.['download-dir'])

  const [page, setPage] = useState<MobileView>('home')
  const [category, setCategory] = useState('all')
  const [panelOpen, setPanelOpen] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [pageNum, setPageNum] = useState(1)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removeData, setRemoveData] = useState(false)
  const [urls, setUrls] = useState('')
  const [dir, setDir] = useState('')
  const [autostart, setAutostart] = useState(true)
  const [addMsg, setAddMsg] = useState('')
  // session 为异步查询：挂载时数据未返回（data === undefined），初值沿用旧版默认 true；
  // 数据到达后同步守护进程的 start-added-torrents（依赖为布尔值，仅在实际变化时覆盖，不打断手动勾选）
  const sessionAutostart = session.data?.['start-added-torrents']
  useEffect(() => {
    if (sessionAutostart !== undefined) setAutostart(!!sessionAutostart)
  }, [sessionAutostart])

  const counts = useMemo(() => {
    const s = snap.status
    return {
      all: snap.count,
      downloading: s[STATUS.download]?.length ?? 0,
      paused: s[STATUS.stopped]?.length ?? 0,
      sending: s[STATUS.seed]?.length ?? 0,
      check: s[STATUS.check]?.length ?? 0,
      actively: snap.actively.length,
      error: snap.error.length,
      warning: snap.warning.length,
    }
  }, [snap])

  const torrents = useMemo<Torrent[]>(() => {
    const s = snap
    switch (category) {
      case 'all':
        return Object.values(s.all)
      case 'downloading':
        return s.status[STATUS.download] ?? []
      case 'paused':
        return s.status[STATUS.stopped] ?? []
      case 'sending':
        return s.status[STATUS.seed] ?? []
      case 'check':
        return s.status[STATUS.check] ?? []
      case 'actively':
        return s.actively
      case 'error':
        return s.error
      case 'warning':
        return s.warning
      default:
        return Object.values(s.all)
    }
  }, [snap, category])

  const pages = Math.max(1, Math.ceil(torrents.length / PAGE_SIZE))
  // 页码收敛：列表变少时夹回 [1, pages]（与原版 gotoPage 的钳制一致），分页控件与切片共用同一页码
  const safePage = Math.min(Math.max(pageNum, 1), pages)
  if (safePage !== pageNum) setPageNum(safePage)
  const pageRows = torrents.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const showList = (target: string) => {
    setCategory(target)
    setPageNum(1)
    setChecked(new Set())
    setPage('torrent-list')
  }

  const doIds = (method: string, args?: Record<string, unknown>) => {
    const ids = Array.from(checked)
    if (!ids.length) return
    mutation.mutate(
      { method, args: { ids, ...args } },
      { onSuccess: () => setChecked(new Set()) },
    )
  }

  const addUrl = async () => {
    const list = urls
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!list.length) {
      setAddMsg(lang.dialog['torrent-add'].nosource)
      setTimeout(() => setAddMsg(''), 2000)
      return
    }
    let i = 0
    try {
      for (const u of list) {
        i++
        setAddMsg(`${lang.system.status.queue}${i}/${list.length}`)
        const url = /^[0-9a-f]{40}$/i.test(u) ? 'magnet:?xt=urn:btih:' + u : u
        await rpc('torrent-add', {
          filename: url,
          paused: !autostart,
          'download-dir':
            dir || (session.data?.['download-dir'] as string) || '',
        })
      }
    } catch (e) {
      setAddMsg(String((e as Error).message || e))
      return
    } finally {
      // 中途失败时前面已成功添加的种子也必须出现在列表里，因此放在 finally 而非成功分支
      void qc.invalidateQueries({ queryKey: queryKeys.torrents })
    }
    setUrls('')
    setAddMsg(lang.system.status.queuefinish)
    setTimeout(() => {
      setAddMsg('')
      setPage('home')
    }, 800)
  }

  const categories: { key: keyof typeof counts; label: string }[] = [
    { key: 'all', label: lang.tree.all },
    { key: 'downloading', label: lang.tree.downloading },
    { key: 'paused', label: lang.tree.paused },
    { key: 'sending', label: lang.tree.sending },
    { key: 'check', label: lang.tree.check },
    { key: 'actively', label: lang.tree.actively },
    { key: 'error', label: lang.tree.error },
    { key: 'warning', label: lang.tree.warning },
  ]

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{ background: '#f9f9f9', color: '#333' }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center gap-2 px-2 text-white select-none"
        style={{
          height: 44,
          background: 'linear-gradient(#5c9ccc,#396b9e)',
          flex: 'none',
        }}
      >
        <button className="m-btn" onClick={() => setPage('home')}>
          ⌂
        </button>
        <div
          className="flex-1 text-center font-bold truncate"
          style={{ fontSize: 14 }}
        >
          {page === 'torrent-list'
            ? (categories.find((c) => c.key === category)?.label ??
              'Transmission Web Control')
            : page === 'add-torrent'
              ? lang.toolbar['add-torrent']
              : 'Transmission Web Control'}
        </div>
        <button className="m-btn" onClick={() => setPanelOpen(true)}>
          ☰
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {page === 'home' && (
          <div className="p-3">
            <ul className="m-list">
              {categories.map((c) => (
                <li key={c.key}>
                  <a onClick={() => showList(c.key)}>
                    <span>{c.label}</span>
                    {counts[c.key] > 0 && (
                      <span className="m-count">{counts[c.key]}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {page === 'torrent-list' && (
          <>
            {/* 分页条 */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-4 py-1 bg-[#e9e9e9] text-sm">
                <button
                  disabled={safePage <= 1}
                  className="m-btn"
                  onClick={() => setPageNum((p) => p - 1)}
                >
                  ‹
                </button>
                <span>
                  {safePage}/{pages}
                </span>
                <button
                  disabled={safePage >= pages}
                  className="m-btn"
                  onClick={() => setPageNum((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            )}
            <ul className="m-list">
              {pageRows.map((t) => (
                <li key={t.id}>
                  <label className="flex items-start gap-2 p-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(checked)
                        if (e.target.checked) next.add(t.id)
                        else next.delete(t.id)
                        setChecked(next)
                      }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold truncate">{t.name}</span>
                      <span className="block my-1">
                        <ProgressBar
                          progress={Number((t.percentDone * 100).toFixed(2))}
                          torrent={t}
                        />
                      </span>
                      <span
                        className="block text-gray-500"
                        style={{ fontSize: 11 }}
                      >
                        ↓{formatSize(t.rateDownload, false, 'speed')} ↑
                        {formatSize(t.rateUpload, false, 'speed')} |{' '}
                        {formatSize(Math.max(0, t.totalSize - t.leftUntilDone))}
                        /{formatSize(t.totalSize)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {page === 'add-torrent' && (
          <div className="p-4 flex flex-col gap-3">
            <label className="block">
              <span className="block mb-1">
                {lang.dialog['torrent-add']['torrent-url']}
              </span>
              <textarea
                className="eu-textbox"
                rows={5}
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block mb-1">
                {lang.dialog['torrent-add']['download-dir']}
              </span>
              <input
                className="eu-textbox"
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                placeholder={session.data?.['download-dir']}
              />
            </label>
            <label className="block">
              <span className="block mb-1">
                {lang.dialog['torrent-add']['used-download-dir']}
              </span>
              <select
                className="eu-textbox"
                value={dir}
                onChange={(e) => setDir(e.target.value)}
              >
                <option value="">
                  {session.data?.['download-dir'] as string}
                </option>
                {snap.downloadDirs.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autostart}
                onChange={(e) => setAutostart(e.target.checked)}
              />
              {lang.dialog['torrent-add'].autostart}
            </label>
            <div className="text-gray-500" style={{ fontSize: 11 }}>
              {lang.dialog['torrent-add']['tip-torrent-url']}
            </div>
            {addMsg && (
              <div className="p-2 bg-[#ffffcc] border border-[#ff9900]">
                {addMsg}
              </div>
            )}
            <button className="m-button" onClick={() => void addUrl()}>
              {lang.dialog.public['button-ok']}
            </button>
            <button className="m-button" onClick={() => setPage('home')}>
              {lang.dialog.public['button-cancel']}
            </button>
          </div>
        )}
      </div>

      {/* 底部：选中操作栏 + 状态栏 */}
      <div
        style={{
          flex: 'none',
          borderTop: '1px solid #bbb',
          background: '#f3f3f3',
        }}
      >
        {page === 'torrent-list' && checked.size > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 overflow-x-auto"
            style={{ borderBottom: '1px solid #ddd' }}
          >
            <button
              className="m-button"
              onClick={() => {
                if (checked.size === pageRows.length) setChecked(new Set())
                else setChecked(new Set(pageRows.map((t) => t.id)))
              }}
            >
              ✓ {checked.size}
            </button>
            <button className="m-button" onClick={() => doIds('torrent-start')}>
              {lang.toolbar.start}
            </button>
            <button className="m-button" onClick={() => doIds('torrent-stop')}>
              {lang.toolbar.pause}
            </button>
            <button
              className="m-button"
              onClick={() => {
                if (window.confirm(lang.toolbar.tip['recheck-confirm']))
                  doIds('torrent-verify')
              }}
            >
              {lang.toolbar.recheck}
            </button>
            <button
              className="m-button"
              style={{ color: '#c00' }}
              onClick={() => setConfirmRemove(true)}
            >
              {lang.toolbar.remove}
            </button>
          </div>
        )}
        <div
          className="flex items-center gap-3 px-2 py-1 text-gray-600"
          style={{ fontSize: 11 }}
        >
          <span className="iconlabel icon-down" style={{ paddingLeft: 19 }}>
            {formatSize(stats.data?.downloadSpeed ?? 0, false, 'speed')}
          </span>
          <span className="iconlabel icon-up" style={{ paddingLeft: 19 }}>
            {formatSize(stats.data?.uploadSpeed ?? 0, false, 'speed')}
          </span>
          <span>
            {formatSize(
              freeSpace.data?.['size-bytes'] ??
                (session.data as Record<string, number>)?.[
                  'download-dir-free-space'
                ] ??
                0,
            )}
          </span>
        </div>
      </div>

      {/* 删除确认弹层 */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <div
            className="bg-white rounded"
            style={{ width: '85%', maxWidth: 360 }}
          >
            <div
              className="text-white px-3 py-2 rounded-t"
              style={{ background: '#396b9e' }}
            >
              {lang.dialog['torrent-remove'].title}
            </div>
            <div className="p-4">
              <div className="mb-3">
                {lang.dialog['torrent-remove']['confirm-text']}
              </div>
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={removeData}
                  onChange={(e) => setRemoveData(e.target.checked)}
                />
                {lang.dialog['torrent-remove']['remove-data']}
              </label>
              <div className="flex justify-end gap-2">
                <button
                  className="m-button"
                  onClick={() => setConfirmRemove(false)}
                >
                  {lang.dialog.public['button-cancel']}
                </button>
                <button
                  className="m-button"
                  style={{ background: '#5c9ccc', color: '#fff' }}
                  onClick={() => {
                    doIds('torrent-remove', { 'delete-local-data': removeData })
                    setConfirmRemove(false)
                  }}
                >
                  {lang.dialog.public['button-ok']}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 右侧滑出面板 */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-[9990]"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setPanelOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 z-[9995] bg-white overflow-auto"
            style={{
              width: '78%',
              maxWidth: 320,
              boxShadow: '-3px 0 8px rgba(0,0,0,0.2)',
            }}
          >
            <div
              className="px-3 py-2 text-white"
              style={{ background: '#396b9e' }}
            >
              {lang.title.left}
            </div>
            <ul className="m-list mt-2">
              <li>
                <a
                  onClick={() => {
                    setPage('add-torrent')
                    setPanelOpen(false)
                  }}
                >
                  ➕ {lang.toolbar['add-torrent']}
                </a>
              </li>
            </ul>
            <div className="px-3 py-2 bg-[#ececec] text-gray-600">
              {lang.toolbar['reload-time']}
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span>
                {config.autoReload
                  ? lang.toolbar['autoreload-enabled']
                  : lang.toolbar['autoreload-disabled']}
              </span>
              <input
                type="checkbox"
                checked={config.autoReload}
                onChange={(e) => saveConfig({ autoReload: e.target.checked })}
              />
            </div>
            <div className="px-3 py-2 bg-[#ececec] text-gray-600">UI</div>
            <ul className="m-list">
              <li>
                <a
                  onClick={() =>
                    (window.location.href = '?devicetype=computer#/')
                  }
                >
                  🖥 {lang.toolbar['ui-computer']}
                </a>
              </li>
              <li>
                <a
                  onClick={() => (window.location.href = 'index.original.html')}
                >
                  ⚙ {lang.toolbar['ui-original']}
                </a>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
