// 底部详情面板 — 复刻 torrent-attribute.html：左侧 Tabs（常规/服务器/文件/用户/设置）
// 各页签内容按职责拆分至 attribute/ 目录，本文件只负责取数与页签切换
import { useState } from 'react'
import { useLang } from '../i18n'
import { useTorrentDetails, useTorrents } from '../api/queries'
import { getSnapshot } from '../lib/torrents'
import { useUi } from '../lib/ui'
import { BaseTab } from './attribute/BaseTab'
import { ServersTab } from './attribute/ServersTab'
import { FilesTab } from './attribute/FilesTab'
import { PeersTab } from './attribute/PeersTab'
import { ConfigTab } from './attribute/ConfigTab'

export function AttributePanel() {
  const { lang } = useLang()
  const ui = useUi()
  const [tab, setTab] = useState('base')
  const enabled = ui.attributeExpanded && ui.currentTorrentId > 0
  const { data: detail } = useTorrentDetails(ui.currentTorrentId, enabled)
  useTorrents()
  // 详情与列表基础数据合并（totalSize/remainingTime 等来自基础轮询）
  const base = getSnapshot().all[ui.currentTorrentId]
  const torrent = detail && base ? { ...base, ...detail } : (detail ?? base)

  const tabs = [
    { id: 'base', title: lang.torrent.attribute.tabs.base },
    { id: 'servers', title: lang.torrent.attribute.tabs.servers },
    { id: 'files', title: lang.torrent.attribute.tabs.files },
    { id: 'peers', title: lang.torrent.attribute.tabs.users },
    { id: 'config', title: lang.torrent.attribute.tabs.config },
  ]

  return (
    <div className="eu-tabs eu-tabs-left h-full">
      <div className="eu-tabs-header">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`eu-tabs-tab ${tab === t.id ? 'selected' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.title}
          </div>
        ))}
      </div>
      <div className="eu-tabs-body">
        {!enabled ? (
          <div className="p-4 text-gray-400">{lang.title.attribute}</div>
        ) : !torrent ? (
          <div className="p-4 text-gray-400">…</div>
        ) : tab === 'base' ? (
          <BaseTab torrent={torrent} />
        ) : tab === 'servers' ? (
          <ServersTab key={torrent.id} torrent={torrent} />
        ) : tab === 'files' ? (
          <FilesTab key={torrent.id} torrent={torrent} />
        ) : tab === 'peers' ? (
          <PeersTab key={torrent.id} torrent={torrent} />
        ) : (
          <ConfigTab key={torrent.id} torrent={torrent} />
        )}
      </div>
    </div>
  )
}
