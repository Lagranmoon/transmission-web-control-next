// 顶部标题栏 + 工具栏 — 复刻 index.html #m_top 区域
import { useQueryClient } from '@tanstack/react-query'
import { LinkButton, ComboBox, NumberSpinner, SearchBox, useMenu } from './ui'
import { useLang } from '../i18n'
import { saveConfig, useConfig } from '../lib/config'
import { openDialog, showToast, uiStore, useUi } from '../lib/ui'
import {
  useSession,
  useStats,
  useTorrents,
  useRpcMutation,
  useFreeSpace,
  queryKeys,
} from '../api/queries'
import { getSnapshot, setSearchResult } from '../lib/torrents'
import { formatSize } from '../lib/format'
import { STATUS } from '../lib/types'
import { asset } from '../lib/asset'

// 主题列表与原版 config.js 一致；黑底主题使用白色 logo
const THEMES = [
  { value: 'default', text: 'Default', group: 'Base' },
  { value: 'gray', text: 'Gray', group: 'Base' },
  { value: 'metro', text: 'Metro', group: 'Base' },
  { value: 'material', text: 'Material', group: 'Base' },
  { value: 'bootstrap', text: 'Bootstrap', group: 'Base' },
  { value: 'black', text: 'Black', group: 'Base' },
  { value: 'metro-blue', text: 'Metro Blue', group: 'Metro' },
  { value: 'metro-gray', text: 'Metro Gray', group: 'Metro' },
  { value: 'metro-green', text: 'Metro Green', group: 'Metro' },
  { value: 'metro-orange', text: 'Metro Orange', group: 'Metro' },
  { value: 'metro-red', text: 'Metro Red', group: 'Metro' },
  { value: 'ui-cupertino', text: 'Cupertino', group: 'UI' },
  { value: 'ui-dark-hive', text: 'Dark Hive', group: 'UI' },
  { value: 'ui-pepper-grinder', text: 'Pepper Grinder', group: 'UI' },
  { value: 'ui-sunny', text: 'Sunny', group: 'UI' },
]

const DARK_THEMES = new Set(['black', 'ui-dark-hive'])

/** 应用主题（<html data-theme> + logo 联动） */
// eslint-disable-next-line react-refresh/only-export-components -- 主题副作用函数与 TopBar 组件同文件是有意安排，拆分属结构调整
export function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme
  const logo = document.getElementById('logo') as HTMLImageElement | null
  if (logo)
    logo.src = DARK_THEMES.has(theme)
      ? asset('assets/logo-white.png')
      : asset('assets/logo.png')
}

export function TopBar() {
  const { lang } = useLang()
  const config = useConfig()
  const session = useSession()
  const stats = useStats()
  const version = session.data?.version
  // rpc>=15 后 session-get 不再返回可用空间，用 free-space 方法获取
  const freeSpace = useFreeSpace(session.data?.['download-dir'] || '')
  const freeBytes = freeSpace.data?.['size-bytes']
  const freeSpaceText =
    freeBytes == null
      ? '…'
      : freeBytes >= 0
        ? formatSize(freeBytes)
        : lang.public['text-unknown']

  return (
    <div
      className="eu-panel"
      style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}
    >
      {/* 标题行 */}
      <div
        className="eu-panel-header"
        style={{ height: 47, display: 'flex', alignItems: 'center' }}
      >
        <img
          id="logo"
          src={
            DARK_THEMES.has(config.theme)
              ? asset('assets/logo-white.png')
              : asset('assets/logo.png')
          }
          width={180}
          height={50}
          style={{ objectFit: 'contain' }}
          alt="logo"
        />
        <div className="ml-auto flex items-center gap-2 pr-2">
          <span>Theme: </span>
          <ComboBox
            width={120}
            value={config.theme}
            options={THEMES}
            onChange={(v) => {
              applyTheme(v)
              saveConfig({ theme: v })
            }}
          />
          <span className="button-split">|</span>
          <LinkButton
            icon="tr-icon-server"
            title={lang.toolbar.tip['ui-mobile']}
            onClick={() => (window.location.hash = '#/mobile')}
          />
          <span className="button-split">|</span>
          <LinkButton
            icon="icon-transmission"
            title={lang.toolbar.tip['ui-original']}
            onClick={() => (window.location.href = 'index.original.html')}
          />
          <span className="button-split">|</span>
          <LinkButton
            icon="tr-icon-help"
            title={lang.toolbar.about}
            onClick={() => openDialog('about')}
          >
            {lang.toolbar.about}
          </LinkButton>
        </div>
      </div>
      <Toolbar />
      {/* 断线提示条（服务器不可达时出现在工具栏下方） */}
      <ConnectionBanner />
      {/* 底部状态栏 */}
      <div
        className="flex items-center px-2 gap-2 bg-[var(--eu-toolbar)] border-t border-[var(--eu-border)]"
        style={{ height: 22 }}
      >
        <span
          style={{
            display: session.data?.['alt-speed-enabled']
              ? 'inline-block'
              : 'none',
            background: `url(${asset('assets/images/alt-speed.ico')}) no-repeat`,
            width: 16,
            height: 16,
          }}
        />
        <span className="iconlabel icon-down" style={{ paddingLeft: 19 }}>
          {lang.statusbar.downloadspeed}
        </span>
        <span>
          {formatSize(stats.data?.downloadSpeed ?? 0, false, 'speed')}
        </span>
        <span className="button-split">|</span>
        <span className="iconlabel icon-up" style={{ paddingLeft: 19 }}>
          {lang.statusbar.uploadspeed}
        </span>
        <span>{formatSize(stats.data?.uploadSpeed ?? 0, false, 'speed')}</span>
        <span className="button-split">|</span>
        <span>
          {lang.dialog['system-config']['download-dir-free-space']}{' '}
          {freeSpaceText}
        </span>
        <span className="ml-auto text-[var(--eu-text)]">
          {version
            ? `Transmission ${lang.statusbar.version}${version}, RPC: ${session.data?.['rpc-version']}, WEB Control: ${__APP_VERSION__}`
            : ''}
        </span>
      </div>
    </div>
  )
}

/**
 * 断线提示条：stats / torrents 两个轮询查询同时出错时认定服务器不可达，
 * 在工具栏下方显示红黄色提示；查询成功（重试后恢复）即自动消失。
 * 独立成叶子组件避免整块 TopBar 订阅种子轮询；不新增轮询，仅订阅现有查询缓存状态。
 */
function ConnectionBanner() {
  const { lang } = useLang()
  const stats = useStats()
  const torrents = useTorrents()
  // 初次加载（尚无结果）不算断线；仅两个查询都进入 error 才提示
  const offline = stats.isError && torrents.isError
  if (!offline) return null
  return (
    <div className="eu-conn-lost" role="alert">
      {lang.system.status.connect || '无法连接服务器，正在重试…'}
    </div>
  )
}

function Toolbar() {
  const { lang } = useLang()
  const config = useConfig()
  const ui = useUi()
  const { show } = useMenu()
  const mutation = useRpcMutation()
  const qc = useQueryClient()
  const session = useSession()
  // 订阅种子数据版本，轮询更新后重新计算按钮状态
  useTorrents()
  const snapshot = getSnapshot()

  const checked = ui.checkedIds.map((id) => snapshot.all[id]).filter(Boolean)
  const single = checked.length === 1 ? checked[0] : null

  /** 与原 checkTorrentRow 相同的按钮可用性逻辑 */
  const btnState = () => {
    const st = {
      start: false,
      pause: false,
      rename: false,
      remove: false,
      recheck: false,
      morepeers: false,
      changeDownloadDir: false,
      changeSpeedLimit: false,
      copyPath: false,
      queue: false,
    }
    if (checked.length === 0) return st
    st.remove = st.changeDownloadDir = st.changeSpeedLimit = st.copyPath = true
    if (checked.length === 1) {
      st.rename = true
      st.queue = true
      const t = single!
      if (t.status === STATUS.stopped) {
        st.start = st.recheck = true
      } else if (t.status === STATUS.check || t.status === STATUS.checkwait) {
        // 校验中：全部禁用
      } else {
        st.pause = st.morepeers = true
      }
    } else {
      st.start = st.pause = st.recheck = true
    }
    return st
  }
  const st = btnState()

  const withChecked = (fn: (ids: number[]) => void) => () =>
    fn(ui.checkedIds.slice())

  const changeStatus = (method: string) =>
    withChecked((ids) => {
      // 慢 API 下防止连点堆叠请求
      if (mutation.isPending) return
      mutation.mutate(
        { method, args: { ids } },
        { onSuccess: () => uiStore.set({ checkedIds: [] }) },
      )
    })

  const split = <span className="button-split">|</span>

  return (
    <div
      className="bg-[var(--eu-toolbar)] px-1 py-0.5 flex items-center flex-wrap gap-0.5 border-t border-[#d8d8d8]"
      style={{ minHeight: 28 }}
    >
      <LinkButton
        icon="tr-icon-plus"
        text={lang.toolbar['add-torrent']}
        title={lang.toolbar.tip['add-torrent']}
        onClick={() => openDialog('torrent-add')}
      />
      {split}
      <LinkButton
        icon={
          session.data?.['alt-speed-enabled']
            ? 'tr-icon-woniu'
            : 'tr-icon-rocket'
        }
        title={lang.toolbar.tip['alt-speed']}
        loading={
          mutation.isPending && mutation.variables?.method === 'session-set'
        }
        onClick={() => {
          const enabled = !session.data?.['alt-speed-enabled']
          mutation.mutate({
            method: 'session-set',
            args: { 'alt-speed-enabled': enabled },
          })
        }}
      />
      {split}
      <LinkButton
        icon="tr-icon-reload"
        title={lang.toolbar.tip['system-reload']}
        onClick={() => {
          void qc.invalidateQueries({ queryKey: queryKeys.torrents })
          void qc.invalidateQueries({ queryKey: queryKeys.stats })
          void qc.invalidateQueries({ queryKey: queryKeys.session })
        }}
      />
      <LinkButton
        icon="tr-icon-system-config"
        title={lang.toolbar.tip['system-config']}
        onClick={() => openDialog('system-config')}
      />
      {split}
      <LinkButton
        icon="tr-icon-plugin"
        text={lang.toolbar.plugin}
        title={lang.toolbar.plugin}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          show(
            [
              {
                id: 'replace-tracker',
                text: lang.toolbar['tracker-replace'],
                icon: 'tr-icon-replace',
                onClick: () => openDialog('system-replaceTracker'),
              },
              {
                id: 'auto-match',
                text: (lang.menus.plugin as Record<string, string>)[
                  'auto-match-data-folder'
                ],
                icon: 'tr-icon-auto-match',
                disabled: ui.checkedIds.length === 0,
                onClick: () =>
                  openDialog('auto-match', { ids: ui.checkedIds.slice() }),
              },
            ],
            rect.left,
            rect.bottom + 2,
          )
        }}
      />
      {split}
      <LinkButton
        icon="tr-icon-start"
        title={lang.toolbar.tip.start}
        disabled={!st.start}
        onClick={changeStatus('torrent-start')}
      />
      <LinkButton
        icon="tr-icon-pause"
        title={lang.toolbar.tip.pause}
        disabled={!st.pause}
        onClick={changeStatus('torrent-stop')}
      />
      <LinkButton
        icon="tr-icon-rename"
        title={lang.toolbar.tip.rename}
        disabled={!st.rename}
        onClick={() =>
          single && openDialog('torrent-rename', { id: single.id })
        }
      />
      <LinkButton
        icon="tr-icon-delete"
        title={lang.toolbar.tip.remove}
        disabled={!st.remove}
        onClick={withChecked((ids) =>
          openDialog('torrent-remove-confirm', { ids }),
        )}
      />
      <LinkButton
        icon="tr-icon-data-check"
        title={lang.toolbar.tip.recheck}
        disabled={!st.recheck}
        onClick={() => {
          const needConfirm = checked.some((t) => t.percentDone > 0)
          if (
            !needConfirm ||
            window.confirm(lang.toolbar.tip['recheck-confirm'])
          ) {
            changeStatus('torrent-verify')()
          }
        }}
      />
      <LinkButton
        icon="tr-icon-more-peers"
        title={lang.toolbar.tip['more-peers']}
        disabled={!st.morepeers}
        onClick={changeStatus('torrent-reannounce')}
      />
      <LinkButton
        icon="tr-icon-folder-change"
        title={lang.toolbar.tip['change-download-dir']}
        disabled={!st.changeDownloadDir}
        onClick={withChecked((ids) =>
          openDialog('torrent-changeDownloadDir', { ids }),
        )}
      />
      <LinkButton
        icon="tr-icon-speedlimit"
        title={lang.toolbar.tip['change-speedlimit']}
        disabled={!st.changeSpeedLimit}
        onClick={withChecked((ids) =>
          openDialog('torrent-changeSpeedLimit', { ids }),
        )}
      />
      <LinkButton
        icon="tr-icon-clippy"
        title={lang.toolbar.tip['copy-path-to-clipboard']}
        disabled={!st.copyPath}
        onClick={() => {
          const paths = Array.from(new Set(checked.map((t) => t.downloadDir)))
          // 显式忽略写入结果，保持原有“失败不提示”的行为
          void navigator.clipboard?.writeText(paths.join('\n'))
          showToast(lang.toolbar.tip['copy-path-to-clipboard'])
        }}
      />
      {split}
      <LinkButton
        icon="tr-icon-queue-move"
        text={lang.toolbar.queue}
        title={lang.toolbar.queue}
        disabled={!st.queue}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          show(
            [
              {
                id: 'queue-move-top',
                text: lang.menus.queue['move-top'],
                icon: 'tr-icon-top',
                disabled: !st.queue,
                onClick: changeStatus('queue-move-top'),
              },
              {
                id: 'queue-move-up',
                text: lang.menus.queue['move-up'],
                icon: 'tr-icon-up',
                disabled: !st.queue,
                onClick: changeStatus('queue-move-up'),
              },
              {
                id: 'queue-move-down',
                text: lang.menus.queue['move-down'],
                icon: 'tr-icon-down',
                disabled: !st.queue,
                onClick: changeStatus('queue-move-down'),
              },
              {
                id: 'queue-move-bottom',
                text: lang.menus.queue['move-bottom'],
                icon: 'tr-icon-bottom',
                disabled: !st.queue,
                onClick: changeStatus('queue-move-bottom'),
              },
            ],
            rect.left,
            rect.bottom + 2,
          )
        }}
      />
      {split}
      <LinkButton
        icon="tr-icon-start-all"
        title={lang.toolbar.tip['start-all']}
        onClick={() => mutation.mutate({ method: 'torrent-start' })}
      />
      <LinkButton
        icon="tr-icon-pause-all"
        title={lang.toolbar.tip['pause-all']}
        onClick={() => mutation.mutate({ method: 'torrent-stop' })}
      />
      {split}
      <label>{lang.toolbar['reload-time']}</label>
      <NumberSpinner
        value={config.reloadStep / 1000}
        min={3}
        width={50}
        disabled={!config.autoReload}
        onChange={(v) => {
          if (Number.isFinite(v)) saveConfig({ reloadStep: v * 1000 })
        }}
      />
      <label>{lang.toolbar['reload-time-unit']}</label>
      <LinkButton
        text={
          config.autoReload
            ? lang.toolbar['autoreload-enabled']
            : lang.toolbar['autoreload-disabled']
        }
        icon={config.autoReload ? 'icon-enabled' : 'icon-disabled'}
        title={
          config.autoReload
            ? lang.toolbar.tip['autoreload-disabled']
            : lang.toolbar.tip['autoreload-enabled']
        }
        onClick={() => saveConfig({ autoReload: !config.autoReload })}
      />
      <span className="ml-auto flex items-center">
        <SearchBox
          width={200}
          placeholder={lang.toolbar['search-prompt']}
          onSearch={(v) => {
            const result = setSearchResult(v)
            if (!v) {
              // 清空搜索：复位导航选中，避免停留在已清空的搜索结果节点
              uiStore.set({ searchKey: '', currentNodeId: 'torrent-all' })
              return
            }
            if (!result.length) {
              showToast(lang.system.status.notfinal)
              uiStore.set({ searchKey: '', currentNodeId: 'torrent-all' })
              return
            }
            // 同步 searchKey，使导航树出现「搜索结果」节点并选中
            uiStore.set({ searchKey: v, currentNodeId: 'search-result' })
          }}
        />
      </span>
    </div>
  )
}
