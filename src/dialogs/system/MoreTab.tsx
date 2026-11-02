// 系统设置「更多」页 — 界面开关、语言、导航栏、IP 归属地与配置导入导出
import { ComboBox, LinkButton, SwitchButton } from '../../components/ui'
import { LANGUAGES, useLang } from '../../i18n'
import { saveConfig, useConfig } from '../../lib/config'
import { openDialog } from '../../lib/ui'

const NAV_KEYS = ['servers', 'folders', 'statistics', 'labels'] as const

export function MoreTab() {
  const { lang, name: langName } = useLang()
  const config = useConfig()
  const L = lang.dialog['system-config']

  // 导航栏开关的标题文案（statistics 多一层嵌套，集中成表避免嵌套三元）
  const navText: Record<(typeof NAV_KEYS)[number], string> = {
    servers: lang.tree.servers,
    folders: lang.tree.folders,
    statistics: lang.tree.statistics.title,
    labels: lang.tree.labels,
  }

  return (
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
              <SwitchButton
                checked={config.hideSubfolders}
                onChange={(v) => saveConfig({ hideSubfolders: v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
            <td className="title">{L['simple-check-mode']}</td>
            <td>
              <SwitchButton
                checked={config.simpleCheckMode}
                onChange={(v) => saveConfig({ simpleCheckMode: v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L.language}</td>
            <td>
              <ComboBox
                width={160}
                value={langName}
                options={Object.entries(LANGUAGES).map(([value, text]) => ({
                  value,
                  text,
                }))}
                onChange={(v) => {
                  localStorage.setItem('twc.lang', v)
                  location.reload()
                }}
              />
            </td>
            <td className="title">{L['nav-contents']}</td>
            <td>
              {NAV_KEYS.map((k) => (
                <label key={k} className="mr-2">
                  <input
                    type="checkbox"
                    checked={config.nav[k]}
                    onChange={(e) =>
                      saveConfig({
                        nav: { ...config.nav, [k]: e.target.checked },
                      })
                    }
                  />
                  {navText[k]}
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
                  if (!window.confirm(lang.public['text-confirm'])) return
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
                value={config.ipInfoToken ?? ''}
                onChange={(e) => saveConfig({ ipInfoToken: e.target.value })}
                placeholder="token"
              />
            </td>
          </tr>
          <tr>
            <td className="title" style={{ verticalAlign: 'top' }}>
              {L.ipInfoCustom}
            </td>
            <td colSpan={3}>
              <div
                className="mb-1"
                style={{ color: '#666' }}
                dangerouslySetInnerHTML={{ __html: L.ipInfoCustomTips }}
              />
              <div className="flex items-center gap-2 mb-1">
                <span style={{ width: 160, textAlign: 'right' }}>
                  {L.ipInfoCountryCodeUrl}
                </span>
                <input
                  className="eu-textbox flex-1"
                  value={config.ipInfoFlagUrl ?? ''}
                  onChange={(e) =>
                    saveConfig({ ipInfoFlagUrl: e.target.value })
                  }
                  placeholder="https://your.service/flag?ip=%ip"
                />
              </div>
              <div className="flex items-center gap-2">
                <span style={{ width: 160, textAlign: 'right' }}>
                  {L.ipInfoDetailUrl}
                </span>
                <input
                  className="eu-textbox flex-1"
                  value={config.ipInfoDetailUrl ?? ''}
                  onChange={(e) =>
                    saveConfig({ ipInfoDetailUrl: e.target.value })
                  }
                  placeholder="https://your.service/detail?ip=%ip"
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="title">{L['export-config']}</td>
            <td colSpan={3}>
              <LinkButton
                icon="tr-icon-download"
                onClick={() => openDialog('export-config')}
              >
                {lang.dialog.public['button-export']}
              </LinkButton>
              <span className="mx-2" />
              <LinkButton
                icon="tr-icon-upload"
                onClick={() => openDialog('import-config')}
              >
                {lang.dialog.public['button-import']}
              </LinkButton>
              <div style={{ color: '#666' }}>{L['export-config']}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
