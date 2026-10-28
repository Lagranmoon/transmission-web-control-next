// 种子列表 — 复刻 m_list 面板：数据过滤(导航节点)、排序、分页、多选、右键菜单
import { useEffect, useMemo, useState } from 'react'
import { DataGrid, makeColumnMenuItems, type GridColumn } from './DataGrid'
import { useMenu, LinkButton, Icon } from './ui'
import { useLang } from '../i18n'
import { useConfig, userConfigStore, persistUserConfig, configStore, saveConfig } from '../lib/config'
import { useStore } from '../lib/store'
import { getSnapshot } from '../lib/torrents'
import { useTorrents, useRpcMutation } from '../api/queries'
import { compareField, copyToClipboard } from '../lib/format'
import { STATUS, type Torrent } from '../lib/types'
import { makeColumns } from '../lib/columns'
import { openDialog, showToast, uiStore, useUi } from '../lib/ui'
import { rpc } from '../lib/rpc'

type Row = Torrent & Record<string, unknown>

export function TorrentList() {
  const { lang, name: langName } = useLang()
  const config = useConfig()
  const ui = useUi()
  const userCfg = useStore(userConfigStore)
  const { show } = useMenu()
  const mutation = useRpcMutation()
  useTorrents()
  const snap = getSnapshot()

  // 列配置（合并用户设置：宽度/顺序/隐藏/排序）
  const columns = useMemo(() => {
    const base = makeColumns(lang)
    const saved = userCfg.torrentList.fields
    if (!saved.length) return base
    const byField = new Map(base.map((c) => [c.field, c]))
    const result: GridColumn<Row>[] = []
    for (const s of saved) {
      const col = byField.get(s.field)
      if (!col) continue
      byField.delete(s.field)
      result.push({ ...col, width: s.width, hidden: s.hidden })
    }
    // 新增的默认列补到末尾
    for (const col of byField.values()) result.push(col)
    return result
  }, [lang, userCfg])

  const [sortName, setSortName] = useState<string | null>(userCfg.torrentList.sortName)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(userCfg.torrentList.sortOrder)
  const [page, setPage] = useState(1)

  /** 当前导航节点对应的数据源 */
  const source = useMemo<Torrent[]>(() => {
    const s = snap
    const id = ui.currentNodeId
    if (!id) return Object.values(s.all)
    if (id.startsWith('tracker-')) return s.trackers[id]?.torrents ?? []
    if (id.startsWith('folders-')) {
      const folder = s.folders[id]
      if (!folder) return []
      if (!config.hideSubfolders) return folder.torrents
      return folder.torrents.filter((t) => t.downloadDir.replace(/[\\|/]/g, '') === id.replace(/^folders-/, ''))
    }
    if (id.startsWith('label-')) {
      const idx = Number(id.slice('label-'.length))
      return Object.values(s.all).filter((t) => (t.labels || []).includes(idx))
    }
    switch (id) {
      case 'torrent-all':
        return Object.values(s.all)
      case 'paused':
        return s.status[STATUS.stopped] ?? []
      case 'sending':
        return s.status[STATUS.seed] ?? []
      case 'seedwait':
        return s.status[STATUS.seedwait] ?? []
      case 'check':
        return s.status[STATUS.check] ?? []
      case 'checkwait':
        return s.status[STATUS.checkwait] ?? []
      case 'downloading':
        return s.status[STATUS.download] ?? []
      case 'downloadwait':
        return s.status[STATUS.downloadwait] ?? []
      case 'actively':
        return s.actively
      case 'error':
        return s.error
      case 'warning':
        return s.warning
      case 'search-result':
        return s.searchResult ?? []
      case 'btservers':
        return s.btItems
      default:
        return Object.values(s.all)
    }
  }, [snap, ui.currentNodeId, config.hideSubfolders])

  // 派生行数据：在快照对象上补充 completeSize 并复用原引用，
  // 配合 DataGrid 行级 memo，轮询时仅重渲染有变化的种子
  const rows = useMemo<Row[]>(() => {
    const list = source.map((t) => {
      const row = t as Row
      row.completeSize = Math.max(0, t.totalSize - t.leftUntilDone)
      return row
    })
    if (sortName) {
      list.sort(compareField(sortName, sortOrder) as (a: Row, b: Row) => number)
    }
    return list
  }, [source, sortName, sortOrder])

  // 切换导航节点时回到第一页并清空勾选
  useEffect(() => {
    setPage(1)
    uiStore.set({ checkedIds: [] })
  }, [ui.currentNodeId])

  const persistColumns = (cols: GridColumn<Row>[]) => {
    persistUserConfig({
      torrentList: {
        ...userCfg.torrentList,
        fields: cols
          .filter((c) => c.field !== 'ck')
          .map((c) => ({ field: c.field, width: c.width ?? 80, hidden: !!c.hidden })),
      },
    })
  }

  const checkedKeys = useMemo(() => new Set<string | number>(ui.checkedIds), [ui.checkedIds])

  const onRowContextMenu = (e: React.MouseEvent, row: Row) => {
    e.preventDefault()
    // 简单检查模式：右键时仅选中当前行（原 onRowContextMenu 行为）
    if (config.simpleCheckMode) {
      uiStore.set({ checkedIds: [row.id] })
    }
    const ids = ui.checkedIds.includes(row.id) && !config.simpleCheckMode ? ui.checkedIds : [row.id]
    if (!ui.checkedIds.includes(row.id) || config.simpleCheckMode) {
      uiStore.set({ checkedIds: ids })
    }
    const t = lang.toolbar
    const singleTorrent = ids.length === 1 ? snap.all[ids[0]] : null
    const isStopped = singleTorrent?.status === STATUS.stopped
    const doIds = (method: string, args?: Record<string, unknown>) =>
      mutation.mutate({ method, args: { ids, ...args } }, { onSuccess: () => uiStore.set({ checkedIds: [] }) })
    show(
      [
        { id: 'start', text: t.start, icon: 'tr-icon-start', disabled: !(!singleTorrent || isStopped), onClick: () => doIds('torrent-start') },
        { id: 'pause', text: t.pause, icon: 'tr-icon-pause', disabled: !(!singleTorrent || !isStopped), onClick: () => doIds('torrent-stop') },
        '-',
        { id: 'rename', text: t.rename, icon: 'tr-icon-rename', disabled: !singleTorrent, onClick: () => openDialog('torrent-rename', { id: singleTorrent!.id }) },
        { id: 'remove', text: t.remove, icon: 'tr-icon-delete', onClick: () => openDialog('torrent-remove-confirm', { ids }) },
        { id: 'recheck', text: t.recheck, icon: 'tr-icon-data-check', disabled: !(!singleTorrent || isStopped), onClick: () => doIds('torrent-verify') },
        '-',
        { id: 'morepeers', text: t.tip['more-peers'], icon: 'tr-icon-more-peers', disabled: !singleTorrent || isStopped, onClick: () => doIds('torrent-reannounce') },
        { id: 'changeDownloadDir', text: t.tip['change-download-dir'], icon: 'tr-icon-folder-change', onClick: () => openDialog('torrent-changeDownloadDir', { ids }) },
        { id: 'copyPath', text: t.tip['copy-path-to-clipboard'], icon: 'tr-icon-clippy', onClick: () => {
          const paths = Array.from(new Set(ids.map((i) => snap.all[i]?.downloadDir).filter(Boolean)))
          copyToClipboard(paths.join('\n'))
        } },
        '-',
        { id: 'menu-queue-move-top', text: lang.menus.queue['move-top'], icon: 'tr-icon-top', disabled: !singleTorrent, onClick: () => doIds('queue-move-top') },
        { id: 'menu-queue-move-up', text: lang.menus.queue['move-up'], icon: 'tr-icon-up', disabled: !singleTorrent, onClick: () => doIds('queue-move-up') },
        { id: 'menu-queue-move-down', text: lang.menus.queue['move-down'], icon: 'tr-icon-down', disabled: !singleTorrent, onClick: () => doIds('queue-move-down') },
        { id: 'menu-queue-move-bottom', text: lang.menus.queue['move-bottom'], icon: 'tr-icon-bottom', disabled: !singleTorrent, onClick: () => doIds('queue-move-bottom') },
        { id: 'magnetLink', text: lang.menus.copyMagnetLink, icon: 'tr-icon-labels', onClick: async () => {
          const result = await rpc<{ torrents: { id: number; magnetLink: string }[] }>('torrent-get', {
            fields: ['id', 'magnetLink'],
            ids,
          })
          const links = (result.torrents || []).map((x) => x.magnetLink).join('\n')
          copyToClipboard(links)
          showToast(lang.menus.copyMagnetLink)
        } },
        ...(config.nav.labels
          ? [
              '-' as const,
              {
                id: 'setLabels',
                text: (lang.menus as Record<string, unknown>).setLabels as string,
                icon: 'tr-icon-labels',
                disabled: ids.length === 0,
                onClick: () =>
                  openDialog('torrent-setLabels', {
                    hashs: ids.map((i) => snap.all[i]?.hashString).filter(Boolean),
                  }),
              },
            ]
          : []),
      ],
      e.clientX,
      e.clientY,
    )
  }

  // B1 键盘导航补充按键：Delete/Backspace 删除已勾选或当前行、Enter 切换详情面板展开。
  // （对话框打开时 DataGrid 的 keyboard 已整体关闭，不会误触发）
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const ids =
        ui.checkedIds.length > 0 ? ui.checkedIds.slice() : ui.currentTorrentId > 0 ? [ui.currentTorrentId] : []
      if (ids.length > 0) openDialog('torrent-remove-confirm', { ids })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      uiStore.set({ attributeExpanded: !uiStore.get().attributeExpanded })
    }
  }

  // C1 行内快捷操作：hover 行时右端浮出 开始/暂停 + 删除 两个小图标按钮
  const renderRowActions = (row: Row) => {
    const stopped = row.status === STATUS.stopped
    return (
      <>
        <LinkButton
          icon={stopped ? 'tr-icon-start' : 'tr-icon-pause'}
          title={stopped ? lang.toolbar.tip.start : lang.toolbar.tip.pause}
          onClick={(e) => {
            e.stopPropagation()
            mutation.mutate({ method: stopped ? 'torrent-start' : 'torrent-stop', args: { ids: [row.id] } })
          }}
        />
        <LinkButton
          icon="tr-icon-delete"
          title={lang.toolbar.tip.remove}
          onClick={(e) => {
            e.stopPropagation()
            openDialog('torrent-remove-confirm', { ids: [row.id] })
          }}
        />
      </>
    )
  }

  return (
    <div className="eu-panel h-full !border-0">
      <div className="eu-panel-header flex items-center">
        <span>{lang.title.list}</span>
        <span className="ml-auto flex items-center gap-1">
          <LinkButton
            icon={config.autoExpandAttribute ? 'icon-enabled' : 'icon-disabled'}
            title={lang['torrent-head'].buttons.autoExpandAttribute}
            onClick={() => saveConfig({ autoExpandAttribute: !config.autoExpandAttribute })}
          />
          {/* C5 列设置入口：弹出与表头右键完全相同的列显隐菜单（复用 makeColumnMenuItems） */}
          <LinkButton
            icon="tr-icon-system-config"
            title={langName === 'zh-CN' ? '列设置' : 'Columns'}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              show(makeColumnMenuItems(columns, persistColumns), rect.left, rect.bottom + 2)
            }}
          />
        </span>
      </div>
      <div className="flex-1 min-h-0 relative">
        <DataGrid<Row>
          columns={columns}
          rows={rows}
          keyField="id"
          rownumbers
          checkedKeys={checkedKeys}
          onCheck={(keys) => uiStore.set({ checkedIds: Array.from(keys).map(Number) })}
          selectedKey={ui.currentTorrentId}
          onSelect={(row) => uiStore.set({ currentTorrentId: row.id })}
          sortName={sortName}
          sortOrder={sortOrder}
          onSort={(field) => {
            const nextOrder: 'asc' | 'desc' = sortName === field && sortOrder === 'asc' ? 'desc' : 'asc'
            setSortName(field)
            setSortOrder(nextOrder)
            persistUserConfig({ torrentList: { fields: userCfg.torrentList.fields, sortName: field, sortOrder: nextOrder } })
          }}
          onColumnsChange={persistColumns}
          pagination={config.pagination}
          page={page}
          pageSize={config.pageSize}
          pageList={config.pageList}
          onPageChange={setPage}
          onPageSizeChange={(s) => saveConfig({ pageSize: s })}
          onRowContextMenu={onRowContextMenu}
          keyboard={ui.dialogs.length === 0}
          onKeyDown={onGridKeyDown}
          rowActions={renderRowActions}
        />
        {/* B7 空状态：当前过滤结果为空时，表格中央给出大图标 + 文案 + 添加入口 */}
        {rows.length === 0 && (
          <div className="absolute inset-0 z-[5] flex select-none flex-col items-center justify-center gap-2" style={{ color: '#999' }}>
            <i className="iconfont tr-icon-folder" style={{ fontSize: 54, lineHeight: 1 }} aria-hidden />
            <div>{langName === 'zh-CN' ? '暂无种子' : 'No torrents'}</div>
            <a
              className="l-btn"
              style={{ border: '1px solid var(--eu-border)', background: 'var(--eu-menu-bg, #fff)', color: 'var(--eu-text)', padding: '0 10px' }}
              title={lang.toolbar.tip['add-torrent']}
              href="javascript:void(0)"
              onClick={() => openDialog('torrent-add')}
            >
              <Icon name="tr-icon-plus" />
              <span className="l-btn-text">{lang.toolbar['add-torrent']}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
