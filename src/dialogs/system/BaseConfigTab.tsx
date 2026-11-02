// 系统设置「基本」页 — 目录、队列、脚本等
import { NumberSpinner, SwitchButton } from '../../components/ui'
import { useLang } from '../../i18n'
import { useFreeSpace } from '../../api/queries'
import { formatSize } from '../../lib/format'
import type { SessionForm, SetSessionField } from './types'

export function BaseConfigTab({
  form,
  set,
}: {
  form: SessionForm
  set: SetSessionField
}) {
  const { lang } = useLang()
  const L = lang.dialog['system-config']
  const free = useFreeSpace(form['download-dir'] as string | undefined)

  return (
    <div className="dialog">
      <table>
        <tbody>
          <tr>
            <td className="title">{L['config-dir']}</td>
            <td colSpan={3}>{String(form['config-dir'])}</td>
          </tr>
          <tr>
            <td className="title">{L['download-dir']}</td>
            <td colSpan={3}>
              <input
                className="eu-textbox w-full"
                value={(form['download-dir'] as string | undefined) ?? ''}
                onChange={(e) => set({ 'download-dir': e.target.value })}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['download-dir-free-space']}</td>
            <td colSpan={3}>
              {free.data
                ? formatSize(free.data['size-bytes'])
                : formatSize(
                    form['download-dir-free-space'] as number | undefined,
                  )}
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
              />{' '}
              <input
                className="eu-textbox"
                style={{ width: 320 }}
                value={(form['incomplete-dir'] as string | undefined) ?? ''}
                onChange={(e) => set({ 'incomplete-dir': e.target.value })}
                disabled={!form['incomplete-dir-enabled']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['cache-size-mb']}</td>
            <td>
              <NumberSpinner
                value={(form['cache-size-mb'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'cache-size-mb': v })}
                width={90}
              />
            </td>
            <td className="title">{L['rename-partial-files']}</td>
            <td>
              <SwitchButton
                checked={!!form['rename-partial-files']}
                onChange={(v) => set({ 'rename-partial-files': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['start-added-torrents']}</td>
            <td>
              <SwitchButton
                checked={!!form['start-added-torrents']}
                onChange={(v) => set({ 'start-added-torrents': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
            <td className="title">{L['download-queue-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['download-queue-enabled']}
                onChange={(v) => set({ 'download-queue-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form['download-queue-size'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'download-queue-size': v })}
                width={60}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['seed-queue-enabled']}</td>
            <td colSpan={3}>
              <SwitchButton
                checked={!!form['seed-queue-enabled']}
                onChange={(v) => set({ 'seed-queue-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form['seed-queue-size'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'seed-queue-size': v })}
                width={60}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['script-torrent-done-enabled']}</td>
            <td colSpan={3}>
              <SwitchButton
                checked={!!form['script-torrent-done-enabled']}
                onChange={(v) => set({ 'script-torrent-done-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <input
                className="eu-textbox"
                style={{ width: 320 }}
                value={
                  (form['script-torrent-done-filename'] as
                    string | undefined) ?? ''
                }
                onChange={(e) =>
                  set({ 'script-torrent-done-filename': e.target.value })
                }
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
