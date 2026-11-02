/* ---------------- 下拉选择（combobox 简化版） ---------------- */
import { useEffect, useRef, useState, type CSSProperties } from 'react'

export function ComboBox({
  value,
  options,
  onChange,
  width = 120,
  disabled,
  editable = false,
  placeholder,
  style,
}: {
  value: string
  options: { value: string; text: string; group?: string }[]
  onChange: (v: string) => void
  width?: number
  disabled?: boolean
  editable?: boolean
  placeholder?: string
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        // 对齐原版 combobox("getValue") 语义：外部点击关闭时，已手输的文本同样提交
        if (editable && filter !== '') {
          onChange(filter)
          setFilter('')
        }
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, editable, filter, onChange])

  /** 提交一个值：关闭下拉并清空过滤词（选项/手输/回退值三条路径共用） */
  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    setFilter('')
  }

  const current = options.find((o) => o.value === value)
  const visible = filter
    ? options.filter((o) => o.text.toLowerCase().includes(filter.toLowerCase()))
    : options
  let lastGroup: string | undefined

  return (
    <div
      ref={boxRef}
      className="relative inline-block"
      style={{ width, ...style }}
    >
      <div
        className={`eu-textbox flex items-center justify-between ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
        onClick={() => {
          if (disabled) return
          // 手动收起时清空过滤词，否则下次展开仍停留在上次的过滤结果
          if (open) setFilter('')
          setOpen(!open)
        }}
      >
        <input
          className="flex-1 outline-none bg-transparent min-w-0"
          value={editable && open ? filter : (current?.text ?? value)}
          placeholder={placeholder}
          readOnly={!editable || !open || disabled}
          onClick={(e) => {
            // 展开态下点击输入框只是定位光标；不拦截冒泡会把下拉关掉（收起态仍要能点开）
            if (editable && open) e.stopPropagation()
          }}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            // 可编辑模式支持手输提交（如新增下载目录）：Enter 提交输入文本并关闭
            if (!editable || e.key !== 'Enter') return
            if (filter !== '') {
              onChange(filter)
              setFilter('')
            }
            setOpen(false)
          }}
        />
        <span className="text-[8px] mr-0.5">▼</span>
      </div>
      {open && (
        <div
          className="absolute z-[9998] bg-[var(--eu-surface)] text-[var(--eu-text)] border border-[var(--eu-border)] rounded-b shadow-md max-h-[260px] overflow-auto"
          style={{ top: '100%', left: 0, right: 0, minWidth: width }}
        >
          {editable &&
            value &&
            filter === '' &&
            !visible.some((o) => o.value === value) && (
              <div
                className="px-2 py-1 cursor-pointer hover:bg-[var(--eu-hover)]"
                onClick={() => choose(value)}
              >
                {value}
              </div>
            )}
          {/* 手输文本未与选项完全一致时补一行可点的“按输入提交”，避免只能靠回车 */}
          {editable &&
            filter !== '' &&
            !visible.some((o) => o.text === filter) && (
              <div
                className="px-2 py-1 cursor-pointer hover:bg-[var(--eu-hover)]"
                onClick={() => choose(filter)}
              >
                {filter}
              </div>
            )}
          {visible.map((o) => {
            const groupEl =
              o.group && o.group !== lastGroup ? (
                <div className="px-2 py-0.5 text-gray-500 bg-[var(--eu-toolbar)]">
                  {(lastGroup = o.group)}
                </div>
              ) : null
            return (
              <div key={o.value}>
                {groupEl}
                <div
                  className={`px-2 py-1 cursor-pointer hover:bg-[var(--eu-hover)] ${o.value === value ? 'bg-[var(--eu-selected)]' : ''}`}
                  onClick={() => choose(o.value)}
                >
                  {o.text}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
