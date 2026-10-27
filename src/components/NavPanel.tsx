// 左侧导航面板 — 复刻原项目导航树（全部/状态/服务器/目录/统计/标签）+ 状态子面板
import { useMemo, useState, type ReactNode } from 'react'
import { Tree, type TreeNodeData } from './Tree'
import { useLang } from '../i18n'
import { useConfig } from '../lib/config'
import { useStats, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { STATUS } from '../lib/types'
import { formatSize, getTotalTime } from '../lib/format'
import { getTimeUnits } from '../i18n'
import { uiStore, useUi } from '../lib/ui'

function btoaSafe(s: string): string {
  try {
    return btoa(unescape(encodeURIComponent(s))).replace(/[+|\/|=]/g, '0')
  } catch {
    return s.replace(/[^a-zA-Z0-9]/g, '0')
  }
}

function moreInfos(count: number, size?: number): ReactNode {
  return (
    <>
      {count > 0 && <span className="nav-torrents-number"> ({count})</span>}
      {size && size > 0 && <span className="nav-total-size">[{formatSize(size)}]</span>}
    </>
  )
}

export function NavPanel() {
  const { lang } = useLang()
  const config = useConfig()
  const ui = useUi()
  const stats = useStats()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['torrent-all']))
  // 数据版本订阅
  useTorrents()
  const snap = getSnapshot()

  const nodes = useMemo<TreeNodeData[]>(() => {
    const t = lang.tree
    const s = snap.status
    const statusChildren: TreeNodeData[] = [
      { id: 'downloading', text: <>{t.downloading}{moreInfos(s[STATUS.download]?.length ?? 0)}</>, iconCls: 'tr-icon-download' },
      { id: 'paused', text: <>{t.paused}{moreInfos(s[STATUS.stopped]?.length ?? 0)}</>, iconCls: 'tr-icon-pause2' },
      { id: 'sending', text: <>{t.sending}{moreInfos(s[STATUS.seed]?.length ?? 0)}</>, iconCls: 'tr-icon-upload' },
      { id: 'check', text: <>{t.check}{moreInfos(s[STATUS.check]?.length ?? 0)}</>, iconCls: 'tr-icon-data-check' },
      { id: 'actively', text: <>{t.actively}{moreInfos(snap.actively.length)}</>, iconCls: 'tr-icon-actively' },
      { id: 'error', text: <>{t.error}{moreInfos(snap.error.length)}</>, iconCls: 'tr-icon-errors' },
      { id: 'warning', text: <>{t.warning}{moreInfos(snap.warning.length)}</>, iconCls: 'tr-icon-warning' },
    ]
    // 等待中的子节点（与原逻辑一致）
    const idx = statusChildren.findIndex((n) => n.id === 'downloading')
    if (s[STATUS.downloadwait]?.length) {
      statusChildren[idx].children = [
        { id: 'downloadwait', text: <>{t.wait}{moreInfos(s[STATUS.downloadwait].length)}</>, iconCls: 'tr-icon-wait' },
      ]
    }
    const sidx = statusChildren.findIndex((n) => n.id === 'sending')
    if (s[STATUS.seedwait]?.length) {
      statusChildren[sidx].children = [
        { id: 'seedwait', text: <>{t.wait}{moreInfos(s[STATUS.seedwait].length)}</>, iconCls: 'tr-icon-wait' },
      ]
    }
    const cidx = statusChildren.findIndex((n) => n.id === 'check')
    if (s[STATUS.checkwait]?.length) {
      statusChildren[cidx].children = [
        { id: 'checkwait', text: <>{t.wait}{moreInfos(s[STATUS.checkwait].length)}</>, iconCls: 'tr-icon-wait' },
      ]
    }

    const result: TreeNodeData[] = [
      {
        id: 'torrent-all',
        text: <>{t.all}{moreInfos(snap.count, snap.totalSize)}</>,
        iconCls: 'tr-icon-home',
        children: [
          ...statusChildren,
          ...(ui.searchKey
            ? [{ id: 'search-result', text: <>{t['search-result']} : {ui.searchKey} ({snap.searchResult?.length ?? 0})</>, iconCls: 'tr-icon-search' }]
            : []),
        ],
      },
    ]

    if (config.nav.servers) {
      const trackers = Object.values(snap.trackers)
      const normal = trackers.filter((x) => !x.isBT)
      const bt = trackers.filter((x) => x.isBT)
      const serverChildren: TreeNodeData[] = normal.map((tr) => ({
        id: tr.nodeid,
        text: <>{tr.name}{moreInfos(tr.count, tr.size)}</>,
        iconCls: tr.connected ? 'tr-icon-server' : 'tr-icon-server-error',
      }))
      if (config.showBTServers && bt.length) {
        serverChildren.push({
          id: 'btservers',
          text: 'BT',
          iconCls: 'tr-icon-bt',
          children: bt.map((tr) => ({
            id: tr.nodeid,
            text: <>{tr.name}{moreInfos(tr.count, tr.size)}</>,
            iconCls: tr.connected ? 'tr-icon-server' : 'tr-icon-server-error',
          })),
        })
      }
      result.push({
        id: 'servers',
        text: t.servers,
        iconCls: 'tr-icon-servers',
        children: serverChildren.length
          ? serverChildren
          : [{ id: 'servers-loading', text: t.status.loading, iconCls: 'tree-loading' }],
      })
    }

    if (config.nav.folders) {
      result.push({
        id: 'folders',
        text: t.folders,
        iconCls: 'tr-icon-folder',
        children: buildFolderNodes(snap, lang.tree.folders as string),
      })
    }

    if (config.nav.statistics && stats.data) {
      const units = getTimeUnits(lang.name ?? 'en')
      const cs = stats.data['cumulative-stats']
      const ks = stats.data['current-stats']
      const statItems = (s: typeof cs, units: ReturnType<typeof getTimeUnits>) => [
        { id: 'uploadedBytes', text: `${t.statistics.uploadedBytes} ${formatSize(s.uploadedBytes)}`, iconCls: 'tr-icon-empty' },
        { id: 'downloadedBytes', text: `${t.statistics.downloadedBytes} ${formatSize(s.downloadedBytes)}`, iconCls: 'tr-icon-empty' },
        { id: 'filesAdded', text: `${t.statistics.filesAdded} ${s.filesAdded}`, iconCls: 'tr-icon-empty' },
        { id: 'sessionCount', text: `${t.statistics.sessionCount} ${s.sessionCount}`, iconCls: 'tr-icon-empty' },
        { id: 'secondsActive', text: `${t.statistics.secondsActive} ${getTotalTime(s.secondsActive * 1000, units)}`, iconCls: 'tr-icon-empty' },
      ]
      result.push({
        id: 'statistics',
        text: t.statistics.title,
        iconCls: 'tr-icon-shuju',
        children: [
          { id: 'cumulative-stats', text: t.statistics.cumulative, iconCls: 'tr-icon-folder', children: statItems(cs, units).map((x) => ({ ...x, id: x.id })) },
          { id: 'current-stats', text: t.statistics.current, iconCls: 'tr-icon-folder', children: statItems(ks, units).map((x) => ({ ...x, id: 'current-' + x.id })) },
        ],
      })
    }

    if (config.nav.labels) {
      result.push({
        id: 'labels',
        text: t.labels,
        iconCls: 'tr-icon-labels',
        children: config.labels.map((lb, i) => ({
          id: `label-${i}`,
          text: lb.name,
          iconCls: 'tr-icon-label',
          labelIndex: i,
          labelColor: lb.color,
        })),
      })
    }

    return result
  }, [lang, config, snap, stats.data, ui.searchKey])

  // 目录树节点（复用 folders 聚合，按 nodeid 前缀构成层级）
  function buildFolderNodes(snap: ReturnType<typeof getSnapshot>, _title: string): TreeNodeData[] {
    const entries = Object.values(snap.folders)
    const byId = new Map(entries.map((e) => [e.nodeid, e]))
    const roots: TreeNodeData[] = []
    const nodeMap = new Map<string, TreeNodeData>()
    for (const entry of entries) {
      const segs = entry.nodeid.replace(/^folders-/, '')
      // folders key 由每段 base64 拼接而成，无法直接拆分；
      // 用 path 全路径 + 目录层级逐段累积 key（与原 appendFolder 一致）
      const pathSegs = entry.path.split('/')
      let key = 'folders-'
      let parent: TreeNodeData | undefined
      let pathAcc = ''
      for (let i = 0; i < pathSegs.length; i++) {
        const seg = pathSegs[i]
        if (!seg) continue
        pathAcc += seg
        key += btoaSafe(seg)
        const info = byId.get(key) ?? snap.folders[key]
        let node = nodeMap.get(key)
        if (!node) {
          node = {
            id: key,
            text: <>{seg}{info ? moreInfos(info.count, info.size) : null}</>,
            iconCls: 'tr-icon-file',
            path: pathAcc,
            downDir: entry.path,
          }
          nodeMap.set(key, node)
          if (parent) (parent.children ||= []).push(node)
          else roots.push(node)
        }
        parent = node
      }
    }
    return roots
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="eu-panel flex-1 min-h-0 !border-0">
        <div className="eu-panel-header">{lang.title.left}</div>
        <div className="eu-panel-body">
          <Tree
            nodes={nodes}
            selectedId={ui.currentNodeId}
            expanded={expanded}
            onSelect={(node) => {
              uiStore.set({ currentNodeId: node.id })
            }}
            onToggle={(node, open) => {
              setExpanded((prev) => {
                const next = new Set(prev)
                if (open) next.add(node.id)
                else next.delete(node.id)
                return next
              })
            }}
          />
        </div>
      </div>
      {/* 状态面板（底部，选中时展开显示） */}
      {ui.checkedIds.length > 0 && (
        <div className="eu-panel !border-0 !border-t border-[#95b8e7]" style={{ height: 180 }}>
          <div className="eu-panel-header">{lang.title.status}</div>
          <div className="eu-panel-body overflow-auto text-[12px]">
            <div className="p-1">
              {lang.system.status.checked.replace('%n', String(ui.checkedIds.length))}
            </div>
            <ol className="list-decimal ml-6">
              {ui.checkedIds.map((id) => (
                <li key={id} className="truncate px-1" title={snap.all[id]?.name}>
                  {snap.all[id]?.name ?? id}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

