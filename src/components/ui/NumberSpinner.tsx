/* ---------------- 数字微调器 ---------------- */
import { useState } from 'react'

export function NumberSpinner({
  value,
  onChange,
  min,
  max,
  width = 70,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  width?: number
  disabled?: boolean
}) {
  const clamp = (v: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  // 键入走本地字符串草稿（不做中间态提交，负号/清空可自由输入），
  // blur/Enter 时经 clamp 一次性提交，与点击/箭头路径统一收敛到 [min,max]
  const [draft, setDraft] = useState<string | null>(null)

  /** 草稿可解析时以 clamp 后的草稿为“当前值”，否则回退到已提交值 */
  const effectiveValue = () => {
    if (draft !== null && draft.trim() !== '') {
      const v = Number(draft)
      if (!Number.isNaN(v)) return clamp(v)
    }
    return value
  }

  /** blur/Enter：草稿经 clamp 后提交（空草稿按 Number('') === 0 处理并收敛到 [min,max]）；不可解析则放弃草稿 */
  const commitDraft = () => {
    if (draft === null) return
    const v = Number(draft)
    setDraft(null)
    if (!Number.isNaN(v)) onChange(clamp(v))
  }

  // 大热区：点击输入框上半区 +1、下半区 -1（对应原版 spinner 的点击行为）
  const onAreaClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isUpper = e.clientY - rect.top < rect.height / 2
    setDraft(null)
    onChange(clamp(effectiveValue() + (isUpper ? 1 : -1)))
  }
  // ▲▼ 按钮：不小于 10x9px，保持 EasyUI 竖排双按钮外观
  const arrowClass =
    'flex-1 text-[9px] leading-none border border-[var(--eu-border)] cursor-pointer select-none flex items-center justify-center'
  return (
    <span className="inline-flex items-stretch" style={{ width }}>
      <input
        className="eu-textbox w-full rounded-r-none"
        value={draft !== null ? draft : value}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDraft()
        }}
        onClick={onAreaClick}
        style={{ textAlign: 'center', width: width - 16, cursor: 'ns-resize' }}
      />
      <span className="inline-flex flex-col" style={{ width: 16 }}>
        <span
          className={`${arrowClass} rounded-tr`}
          style={{ minWidth: 10, minHeight: 9 }}
          onClick={() => {
            if (disabled) return
            setDraft(null)
            onChange(clamp(effectiveValue() + 1))
          }}
        >
          ▲
        </span>
        <span
          className={`${arrowClass} border-t-0 rounded-br`}
          style={{ minWidth: 10, minHeight: 9 }}
          onClick={() => {
            if (disabled) return
            setDraft(null)
            onChange(clamp(effectiveValue() - 1))
          }}
        >
          ▼
        </span>
      </span>
    </span>
  )
}
