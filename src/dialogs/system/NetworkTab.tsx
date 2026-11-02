// 系统设置「网络」页 — 端口、加密、DHT/LPD/PEX 等
import {
  ComboBox,
  LinkButton,
  NumberSpinner,
  SwitchButton,
} from '../../components/ui'
import { useLang } from '../../i18n'
import type { SessionForm, SetSessionField } from './types'
import { asString } from './utils'

export type PortTestResult = 'testing' | 'open' | 'closed' | null

export function NetworkTab({
  form,
  set,
  testResult,
  onTestPort,
}: {
  form: SessionForm
  set: SetSessionField
  testResult: PortTestResult
  onTestPort: () => void
}) {
  const { lang } = useLang()
  const L = lang.dialog['system-config']

  return (
    <div className="dialog">
      <table>
        <tbody>
          <tr>
            <td className="title">{L['peer-port-random-on-start']}</td>
            <td>
              <SwitchButton
                checked={!!form['peer-port-random-on-start']}
                onChange={(v) => set({ 'peer-port-random-on-start': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />{' '}
              <NumberSpinner
                value={(form['peer-port'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'peer-port': v })}
                width={90}
                disabled={!!form['peer-port-random-on-start']}
              />{' '}
              <LinkButton
                onClick={onTestPort}
                loading={testResult === 'testing'}
              >
                {L['test-port']}
              </LinkButton>
              {testResult === 'open' && (
                <span className="text-green-600 ml-1">
                  {L['port-is-open-true']}
                </span>
              )}
              {testResult === 'closed' && (
                <span className="text-red-600 ml-1">
                  {L['port-is-open-false']}
                </span>
              )}
            </td>
            <td className="title">{L['port-forwarding-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['port-forwarding-enabled']}
                onChange={(v) => set({ 'port-forwarding-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L.encryption}</td>
            <td>
              <ComboBox
                width={140}
                value={asString(form.encryption ?? 'tolerated')}
                options={[
                  {
                    value: 'required',
                    text: L['encryption-type'].required,
                  },
                  {
                    value: 'preferred',
                    text: L['encryption-type'].preferred,
                  },
                  {
                    value: 'tolerated',
                    text: L['encryption-type'].tolerated,
                  },
                ]}
                onChange={(v) => set({ encryption: v })}
              />
            </td>
            <td className="title">{L['utp-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['utp-enabled']}
                onChange={(v) => set({ 'utp-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['dht-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['dht-enabled']}
                onChange={(v) => set({ 'dht-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
            <td className="title">{L['lpd-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['lpd-enabled']}
                onChange={(v) => set({ 'lpd-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['pex-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['pex-enabled']}
                onChange={(v) => set({ 'pex-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
