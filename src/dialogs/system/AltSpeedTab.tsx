// 系统设置「时段」页 — 限速时段与星期选择
import { NumberSpinner, SwitchButton } from '../../components/ui'
import { useLang } from '../../i18n'
import type { SessionForm, SetSessionField } from './types'

function timeStr(minutes: number | undefined): string {
  const h = Math.floor((minutes ?? 0) / 60)
  const m = (minutes ?? 0) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** hh:mm → 当日分钟数 */
function minutesOf(hhmm: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function AltSpeedTab({
  form,
  set,
}: {
  form: SessionForm
  set: SetSessionField
}) {
  const { lang } = useLang()
  const L = lang.dialog['system-config']

  return (
    <div className="dialog">
      <table>
        <tbody>
          <tr>
            <td className="title">{L['alt-speed-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['alt-speed-enabled']}
                onChange={(v) => set({ 'alt-speed-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
            <td className="title">{L['alt-speed-time-enabled']}</td>
            <td>
              <SwitchButton
                checked={!!form['alt-speed-time-enabled']}
                onChange={(v) => set({ 'alt-speed-time-enabled': v })}
                onText={lang.public['text-on']}
                offText={lang.public['text-off']}
              />
            </td>
          </tr>
          <tr>
            <td className="title">{L['alt-speed-down']}</td>
            <td>
              <NumberSpinner
                value={(form['alt-speed-down'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'alt-speed-down': v })}
                width={90}
              />{' '}
              KB/s
            </td>
            <td className="title">{L['alt-speed-up']}</td>
            <td>
              <NumberSpinner
                value={(form['alt-speed-up'] as number | undefined) ?? 0}
                onChange={(v) => set({ 'alt-speed-up': v })}
                width={90}
              />{' '}
              KB/s
            </td>
          </tr>
          <tr>
            <td className="title">{L['alt-speed-time']}</td>
            <td colSpan={3}>
              <input
                type="time"
                className="eu-textbox"
                value={timeStr(
                  form['alt-speed-time-begin'] as number | undefined,
                )}
                onChange={(e) =>
                  set({ 'alt-speed-time-begin': minutesOf(e.target.value) })
                }
                disabled={!form['alt-speed-time-enabled']}
              />{' '}
              ~{' '}
              <input
                type="time"
                className="eu-textbox"
                value={timeStr(
                  form['alt-speed-time-end'] as number | undefined,
                )}
                onChange={(e) =>
                  set({ 'alt-speed-time-end': minutesOf(e.target.value) })
                }
                disabled={!form['alt-speed-time-enabled']}
              />{' '}
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <label key={d} className="ml-2">
                  <input
                    type="checkbox"
                    checked={
                      !!(
                        ((form['alt-speed-time-day'] as number | undefined) ??
                          0) &
                        (1 << d)
                      )
                    }
                    onChange={(e) => {
                      const cur =
                        (form['alt-speed-time-day'] as number | undefined) ?? 0
                      set({
                        'alt-speed-time-day': e.target.checked
                          ? cur | (1 << d)
                          : cur & ~(1 << d),
                      })
                    }}
                  />
                  {L.weekday[String(d) as keyof typeof L.weekday]}
                </label>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
