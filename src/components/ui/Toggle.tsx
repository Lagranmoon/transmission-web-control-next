/* ---------------- 三态复选框（用于 seedRatioMode 等 0/1/2） ---------------- */
import type { ReactNode } from 'react'

export function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
  id,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (next: { checked: boolean; indeterminate: boolean }) => void
  label?: ReactNode
  id?: string
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        id={id}
        type="checkbox"
        style={{ width: 16, height: 16 }}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate
        }}
        onChange={() => onChange({ checked: !checked, indeterminate: false })}
      />
      {label ? <label htmlFor={id}>{label}</label> : null}
    </span>
  )
}

/* ---------------- 开关按钮（switchbutton） ---------------- */
export function SwitchButton({
  checked,
  onChange,
  onText = '开',
  offText = '关',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  onText?: string
  offText?: string
}) {
  return (
    <span
      className="inline-flex items-center cursor-pointer select-none"
      onClick={() => onChange(!checked)}
      title={checked ? onText : offText}
    >
      <span
        className="inline-flex rounded-full overflow-hidden border border-[var(--eu-border)]"
        style={{
          width: 56,
          height: 20,
          background: checked ? '#fff' : 'var(--eu-grid-head-bottom)',
        }}
      >
        <span
          className="flex items-center justify-center h-full transition-all"
          style={{
            width: '50%',
            background: checked ? 'var(--eu-accent)' : '#c9c9c9',
            color: '#fff',
            marginLeft: checked ? '50%' : '0',
          }}
        >
          {checked ? onText : offText}
        </span>
      </span>
    </span>
  )
}
