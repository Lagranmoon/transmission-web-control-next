// 主界面布局 — 复刻 index.html #main easyui-layout：
// north(标题+工具栏+状态栏) / west(导航) / center(种子列表 + south 详情面板，均可拖拽分隔)
import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { NavPanel } from '../components/NavPanel'
import { TorrentList } from '../components/TorrentList'
import { AttributePanel } from '../components/AttributePanel'
import { DialogHost } from '../dialogs'
import { useUi, uiStore } from '../lib/ui'
import { useConfig, saveConfig } from '../lib/config'
import { useLang } from '../i18n'
import { openDialog } from '../lib/ui'

export function RootLayout() {
  const ui = useUi()
  const config = useConfig()
  const { lang } = useLang()
  const [navWidth, setNavWidth] = useState(ui.navWidth)
  const [attrHeight, setAttrHeight] = useState(ui.attributeHeight)
  const [dropping, setDropping] = useState(false)

  // 自动展开详情（autoExpandAttribute：选中种子时展开）
  useEffect(() => {
    if (config.autoExpandAttribute && ui.currentTorrentId > 0) {
      uiStore.set({ attributeExpanded: true })
    }
  }, [ui.currentTorrentId, config.autoExpandAttribute])

  // 默认选中导航节点
  useEffect(() => {
    if (!ui.currentNodeId) {
      uiStore.set({ currentNodeId: config.defaultSelectNode || 'torrent-all' })
    }
  }, [])

  // 记住选中的导航节点
  useEffect(() => {
    if (ui.currentNodeId && ui.currentNodeId !== config.defaultSelectNode) {
      saveConfig({ defaultSelectNode: ui.currentNodeId })
    }
  }, [ui.currentNodeId])

  const startDrag = useCallback(
    (kind: 'nav' | 'attr') => (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startNav = navWidth
      const startAttr = attrHeight
      const move = (ev: MouseEvent) => {
        if (kind === 'nav') {
          setNavWidth(Math.min(560, Math.max(160, startNav + ev.clientX - startX)))
        } else {
          setAttrHeight(Math.min(700, Math.max(80, startAttr - (ev.clientY - startY))))
        }
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        uiStore.set(kind === 'nav' ? { navWidth } : { attributeHeight: attrHeight })
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [navWidth, attrHeight],
  )

  // 拖放 .torrent 文件
  const dragCounter = useRef(0)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDropping(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.split('.').pop()?.toLowerCase() === 'torrent')
    if (files.length) openDialog('torrent-addfile', { files })
  }

  return (
    <div
      className="h-full w-full flex flex-col bg-[#eaf2ff]"
      onDragEnter={(e) => {
        e.preventDefault()
        dragCounter.current++
        setDropping(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragCounter.current--
        if (dragCounter.current <= 0) setDropping(false)
      }}
      onDrop={onDrop}
    >
      <TopBar />
      <div className="flex-1 flex min-h-0">
        {/* west: 导航 */}
        <div className="flex min-h-0 bg-white" style={{ width: navWidth }}>
          <div className="flex-1 min-w-0 border-y border-[#95b8e7]">
            <NavPanel />
          </div>
          <div className="eu-splitter-v" onMouseDown={startDrag('nav')} />
        </div>
        {/* center: 列表 + 详情 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
          <div className="flex-1 min-h-0 border-y border-[#95b8e7]">
            <TorrentList />
          </div>
          {/* 详情面板（可折叠） */}
          {ui.attributeExpanded ? (
            <>
              <div className="eu-splitter-h" onMouseDown={startDrag('attr')} />
              <div className="bg-white" style={{ height: attrHeight }}>
                <div className="eu-panel h-full !border-0">
                  <div className="eu-panel-header flex items-center">
                    <span>{lang.title.attribute}</span>
                    <span className="eu-tool" title="收起" onClick={() => uiStore.set({ attributeExpanded: false })}>
                      <i className="iconfont tr-icon-down" />
                    </span>
                  </div>
                  <div className="eu-panel-body">
                    <AttributePanel />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <button
              className="text-[11px] text-[#0e2d5f] bg-gradient-to-b from-[#eff5ff] to-[#e0ecff] border-t border-[#95b8e7] py-0.5 cursor-pointer hover:bg-[#eaf2ff]"
              onClick={() => uiStore.set({ attributeExpanded: true })}
            >
              ▲ {lang.title.attribute}
            </button>
          )}
        </div>
      </div>
      <DialogHost />
      {dropping && (
        <div className="dropArea">
          <span style={{ position: 'absolute', top: 150, left: 150, fontSize: 40, fontWeight: 'bold' }}>
            {lang.public['text-drop-title']}
          </span>
        </div>
      )}
    </div>
  )
}
