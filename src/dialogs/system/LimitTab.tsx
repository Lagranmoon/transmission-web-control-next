// 系统设置「带宽」页 — 全局限速、队列与 blocklist
import { LinkButton, NumberSpinner, SwitchButton } from '../../components/ui'
import { useLang } from '../../i18n'
import { rpc } from '../../lib/rpc'
import { showToast } from '../../lib/ui'
import type { SessionForm, SetSessionField } from './types'
import { asString } from './utils'

export function LimitTab({
  form,
  set,
}: {
  form: SessionForm
  set: SetSessionField
}) {
  const { lang } = useLang()
  const L = lang.dialog['system-config']
  const minutes = <span>{L.minutes}</span>

  const updateBlocklist = async () => {
    try {
      const r = await rpc<{ 'blocklist-size': number }>('blocklist-update')
      set({ 'blocklist-size': r['blocklist-size'] })
    } catch (e) {
      showToast(String((e as Error).message || e))
    }
  }

  return (
    <div className="dialog">
      <table>
        <tbody>
          <tr>
            <td className="title">{L['speed-limit-down-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['speed-limit-down-enabled']}
                onChange={(v) => set({ 'speed-limit-down-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form['speed-limit-down'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'speed-limit-down': v })}
                width={90}
                disabled={!form['speed-limit-down-enabled']}
              />{' '}
              KB/s
            </td>
            <td className="title">{L['speed-limit-up-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['speed-limit-up-enabled']}
                onChange={(v) => set({ 'speed-limit-up-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form['speed-limit-up'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'speed-limit-up': v })}
                width={90}
                disabled={!form['speed-limit-up-enabled']}
              />{' '}
              KB/s
            </td>
          </tr>
          <tr>
            <td className="title">{L['peer-limit-global']}</td>
            <td>
              <NumberSpinner
                value={(form['peer-limit-global'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'peer-limit-global': v })}
                width={90}
              />
            </td>
            <td className="title">{L['peer-limit-per-torrent']}</td>
            <td>
              <NumberSpinner
                value={
                  (form['peer-limit-per-torrent'] as number | undefined) ?? 0
                }
                onChange={(v) => set({ 'peer-limit-per-torrent': v })}
                width={90}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L.seedRatioLimited}</td>
            <td colSpan={3}>
              <SwitchButton
                checked={!!form.seedRatioLimited}
                onChange={(v) => set({ seedRatioLimited: v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form.seedRatioLimit as number | undefined) ?? 0}
                onChange={(v) => set({ seedRatioLimit: v })}
                width={90}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['queue-stalled-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['queue-stalled-enabled']}
                onChange={(v) => set({ 'queue-stalled-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={
                  (form['queue-stalled-minutes'] as number | undefined) ?? 0
                }
                onChange={(v) => set({ 'queue-stalled-minutes': v })}
                width={90}
              />{' '}
              {minutes}
            </td>
            <td className="title">{L['idle-seeding-limit-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['idle-seeding-limit-enabled']}
                onChange={(v) => set({ 'idle-seeding-limit-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form['idle-seeding-limit'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'idle-seeding-limit': v })}
                width={90}
              />{' '}
              {minutes}
            </td>
          </tr>
          <tr>
            <td className="title">{L['blocklist-enabled']}</td>
            <td colSpan={3}>
              <SwitchButton
                checked={!!form['blocklist-enabled']}
                onChange={(v) => set({ 'blocklist-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <input
                className="eu-textbox"
                style={{ width: 320 }}
                value={(form['blocklist-url'] as string | undefined) ?? ''}
                onChange={(e) => set({ 'blocklist-url': e.target.value })}
                disabled={!form['blocklist-enabled']}
              />{' '}
              <span>
                {L['blocklist-size'].replace(
                  '%n',
                  asString(form['blocklist-size'] ?? 0),
                )}
              </span>{' '}
              <LinkButton
                icon="tr-icon-reload"
                onClick={() => void updateBlocklist()}
              >
                {lang.dialog.public['button-update']}
              </LinkButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
