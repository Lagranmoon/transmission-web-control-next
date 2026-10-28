// EasyUI 风格基础组件 — iconfont 图标 / linkbutton / 菜单 / 对话框 / tabs / 分页
// 组件层样式（缩放手柄/Tooltip/Toast/进度浮层）统一放在 components.css
import '../styles/components.css'
import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useProgress, useUi } from '../lib/ui'

/* ---------------- 图标 ---------------- */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i className={`iconfont ${name} ${className}`} aria-hidden />
}

/* ---------------- Tooltip（悬浮提示，延迟 300ms，视口边缘自动翻转） ---------------- */
export function Tooltip({
  content,
  children,
}: {
  content?: ReactNode
  /** 需接收鼠标事件的单个元素（通过 cloneElement 注入，不额外包一层 DOM） */
  children: ReactElement<{
    onMouseEnter?: React.MouseEventHandler
    onMouseLeave?: React.MouseEventHandler
  }>
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  // 卸载时清理定时器
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  // 显示后测量气泡并定位：默认在目标下方居中，下方/左右放不下时自动翻转或收拢
  useLayoutEffect(() => {
    if (!visible || !targetRef.current || !tipRef.current) return
    const rect = targetRef.current.getBoundingClientRect()
    const el = tipRef.current
    const w = el.offsetWidth
    const h = el.offsetHeight
    let top = rect.bottom + 6
    if (top + h > window.innerHeight - 4) top = rect.top - h - 6 // 下方放不下：翻转到上方
    let left = rect.left + rect.width / 2 - w / 2
    left = Math.max(4, Math.min(left, window.innerWidth - w - 4)) // 左右收拢进视口
    el.style.top = `${Math.round(top)}px`
    el.style.left = `${Math.round(left)}px`
  }, [visible, content])

  // 无内容时原样渲染（不包一层，不影响布局）
  if (content === undefined || content === null || content === '') return children

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent) => {
          targetRef.current = e.currentTarget as HTMLElement
          if (timerRef.current !== null) clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(() => setVisible(true), 300)
        },
        onMouseLeave: () => {
          if (timerRef.current !== null) clearTimeout(timerRef.current)
          timerRef.current = null
          setVisible(false)
        },
      })}
      {visible &&
        createPortal(
          <div className="eu-tooltip" ref={tipRef} role="tooltip">
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

/* ---------------- linkbutton ---------------- */
export function LinkButton({
  icon,
  text,
  title,
  disabled,
  onClick,
  loading,
  className = '',
  children,
}: {
  icon?: string
  text?: ReactNode
  title?: string
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
  loading?: boolean
  className?: string
  children?: ReactNode
}) {
  const btn = (
    <a
      className={`l-btn ${disabled || loading ? 'l-btn-disabled' : ''} ${className}`}
      onClick={(e) => {
        if (disabled || loading) return
        onClick?.(e)
      }}
      href="javascript:void(0)"
    >
      {loading ? (
        <i className="icon-loading" />
      ) : icon ? (
        <Icon name={icon} />
      ) : null}
      {text ? <span className="l-btn-text">{text}</span> : null}
      {children}
    </a>
  )
  // 有 title 时改用自定义 Tooltip（300ms 延迟 + 边缘翻转），替代原生 title
  return title ? <Tooltip content={title}>{btn}</Tooltip> : btn
}

/* ---------------- 菜单 ---------------- */
export type MenuItemSpec =
  | {
      id: string
      text: ReactNode
      icon?: string
      disabled?: boolean
      danger?: boolean
      onClick?: () => void
    }
  | '-'

type MenuEntry = Exclude<MenuItemSpec, '-'> | '-'

interface MenuState {
  items: MenuEntry[]
  x: number
  y: number
}

const MenuCtx = createContext<{
  show: (items: MenuEntry[], x: number, y: number) => void
}>({ show: () => {} })

export function useMenu() {
  return useContext(MenuCtx)
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MenuState | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state) return
    const close = () => setState(null)
    // 用 setTimeout 避免与本轮打开菜单的 click 事件冲突
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('contextmenu', close)
      window.addEventListener('blur', close)
    }, 0)
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setState(null)
    }
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('contextmenu', close)
      window.removeEventListener('blur', close)
    }
  }, [state])

  useLayoutEffect(() => {
    if (state && ref.current) {
      const el = ref.current
      const w = el.offsetWidth
      const h = el.offsetHeight
      let { x, y } = state
      if (x + w > window.innerWidth - 4) x = Math.max(4, window.innerWidth - w - 4)
      if (y + h > window.innerHeight - 4) y = Math.max(4, window.innerHeight - h - 4)
      el.style.left = x + 'px'
      el.style.top = y + 'px'
    }
  }, [state])

  const show = useCallback((items: MenuItemSpec[], x: number, y: number) => {
    setState({ items, x, y })
  }, [])

  return (
    <MenuCtx.Provider value={{ show }}>
      {children}
      {state &&
        createPortal(
          <div className="eu-menu" ref={ref} style={{ left: state.x, top: state.y }} onContextMenu={(e) => e.preventDefault()}>
            {state.items.map((entry, i) =>
              entry === '-' ? (
                <div key={`sep-${i}`} className="eu-menu-sep" />
              ) : (
                <div
                  key={entry.id}
                  className={`eu-menu-item ${entry.disabled ? 'disabled' : ''}`}
                  style={entry.danger ? { color: '#c00' } : undefined}
                  onClick={() => {
                    if (entry.disabled) return
                    setState(null)
                    entry.onClick?.()
                  }}
                >
                  {entry.icon ? <Icon name={entry.icon} /> : <span style={{ width: 16, display: 'inline-block' }} />}
                  <span>{entry.text}</span>
                </div>
              ),
            )}
          </div>,
          document.body,
        )}
    </MenuCtx.Provider>
  )
}

/* ---------------- 对话框 ---------------- */
/** resizable 对话框的尺寸记忆（按 dialogId 存 localStorage），key 与原版 config 风格一致 */
const DIALOG_SIZE_KEY = 'twc.dialogSize.'
const DIALOG_MIN_WIDTH = 320
const DIALOG_MIN_HEIGHT = 160

function loadDialogSize(dialogId: string): { width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(DIALOG_SIZE_KEY + dialogId)
    if (!raw) return null
    const s = JSON.parse(raw) as { width?: unknown; height?: unknown }
    if (typeof s.width !== 'number' || typeof s.height !== 'number') return null
    // 恢复时限制在当前视口内，避免小屏上打开即出界
    return {
      width: Math.max(DIALOG_MIN_WIDTH, Math.min(s.width, window.innerWidth - 16)),
      height: Math.max(DIALOG_MIN_HEIGHT, Math.min(s.height, window.innerHeight - 16)),
    }
  } catch {
    return null
  }
}

export function Dialog({
  title,
  width = 420,
  height,
  onClose,
  children,
  footer,
  modal = true,
  style,
  resizable = false,
  dialogId,
}: {
  title: ReactNode
  width?: number
  height?: number
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  modal?: boolean
  style?: CSSProperties
  /** 是否允许右下角拖拽调整大小（对应原版 easyui dialog 的 resizable:true） */
  resizable?: boolean
  /** 对话框标识：resizable 时按此 id 记忆/恢复尺寸 */
  dialogId?: string
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  // 上次拖出的尺寸（打开时恢复）
  const [size, setSize] = useState<{ width: number; height: number } | null>(() =>
    dialogId ? loadDialogSize(dialogId) : null,
  )
  const effWidth = size?.width ?? width
  const effHeight = size?.height ?? height

  const onDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const el = e.currentTarget.closest('.eu-dialog') as HTMLElement
    dragRef.current = {
      dx: e.clientX - (pos?.left ?? parseFloat(el.style.left)),
      dy: e.clientY - (pos?.top ?? parseFloat(el.style.top)),
    }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setPos({
        left: ev.clientX - dragRef.current.dx,
        top: ev.clientY - dragRef.current.dy,
      })
    }
    const up = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  /** 右下角手柄拖拽调整大小（最小 320x160，不超出视口），松手时按 dialogId 持久化 */
  const onResizeStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget.closest('.eu-dialog') as HTMLElement).getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let w = rect.width
    let h = rect.height
    const move = (ev: MouseEvent) => {
      w = Math.max(DIALOG_MIN_WIDTH, Math.min(rect.width + ev.clientX - startX, window.innerWidth - 8))
      h = Math.max(DIALOG_MIN_HEIGHT, Math.min(rect.height + ev.clientY - startY, window.innerHeight - 8))
      setSize({ width: w, height: h })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      if (dialogId) {
        try {
          localStorage.setItem(DIALOG_SIZE_KEY + dialogId, JSON.stringify({ width: w, height: h }))
        } catch {
          // 隐私模式等写入失败时静默忽略
        }
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return createPortal(
    <>
      {modal && <div className="eu-dialog-mask" onMouseDown={onClose} />}
      <div
        className="eu-dialog"
        style={{
          width: effWidth,
          height: effHeight,
          left: pos?.left,
          top: pos?.top,
          ...style,
        }}
        ref={(el) => {
          if (el && !pos && !el.style.left) {
            const rect = el.getBoundingClientRect()
            el.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + 'px'
            el.style.top = Math.max(8, (window.innerHeight - rect.height) / 2 - 30) + 'px'
          }
        }}
      >
        <div className="eu-dialog-header" onMouseDown={onDragStart} style={{ cursor: 'move', userSelect: 'none' }}>
          <span style={{ float: 'left' }}>{title}</span>
          <span
            className="eu-tool"
            style={{ float: 'right' }}
            title="关闭"
            onClick={onClose}
          >
            <Icon name="icon-cancel" />
          </span>
        </div>
        <div className="eu-dialog-body">{children}</div>
        {footer !== undefined && <div className="eu-dialog-footer">{footer}</div>}
        {resizable && <div className="eu-dialog-resizer" onMouseDown={onResizeStart} />}
      </div>
    </>,
    document.body,
  )
}

/* ---------------- Tabs（支持左侧布局，用于详情面板） ---------------- */
export function Tabs({
  tabs,
  active,
  onChange,
  position = 'top',
}: {
  tabs: { id: string; title: ReactNode }[]
  active: string
  onChange: (id: string) => void
  position?: 'top' | 'left'
}) {
  return (
    <div className={`eu-tabs ${position === 'left' ? 'eu-tabs-left' : ''}`}>
      <div className="eu-tabs-header">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`eu-tabs-tab ${active === t.id ? 'selected' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.title}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- 分页 ---------------- */
export function Pagination({
  total,
  page,
  pageSize,
  pageList,
  onPageChange,
  onPageSizeChange,
  extraButtons,
}: {
  total: number
  page: number
  pageSize: number
  pageList?: number[]
  onPageChange: (p: number) => void
  onPageSizeChange?: (size: number) => void
  extraButtons?: ReactNode
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const cur = Math.min(page, pages)
  const btn = (label: ReactNode, disabled: boolean, go: number, title: string) => (
    <LinkButton disabled={disabled} onClick={() => onPageChange(go)} title={title} className="!px-1">
      {label}
    </LinkButton>
  )
  return (
    <div className="eu-pagination">
      {extraButtons}
      {btn('«', cur <= 1, 1, '首页')}
      {btn('‹', cur <= 1, cur - 1, '上一页')}
      <span className="px-1">
        {cur}/{pages}
      </span>
      {btn('›', cur >= pages, cur + 1, '下一页')}
      {btn('»', cur >= pages, pages, '末页')}
      {pageList && onPageSizeChange && (
        <select
          className="border border-[var(--eu-border)] rounded bg-white px-0.5 h-[20px]"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <span className="eu-pagination-info">
        共 {total} 条
      </span>
    </div>
  )
}

/* ---------------- 数字微调器 ---------------- */
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
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
  // 大热区：点击输入框上半区 +1、下半区 -1（对应原版 spinner 的点击行为）
  const onAreaClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isUpper = e.clientY - rect.top < rect.height / 2
    onChange(clamp(value + (isUpper ? 1 : -1)))
  }
  // ▲▼ 按钮：不小于 10x9px，保持 EasyUI 竖排双按钮外观
  const arrowClass =
    'flex-1 text-[9px] leading-none border border-[var(--eu-border)] cursor-pointer select-none flex items-center justify-center'
  return (
    <span className="inline-flex items-stretch" style={{ width }}>
      <input
        className="eu-textbox w-full rounded-r-none"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
        onClick={onAreaClick}
        style={{ textAlign: 'center', width: width - 16, cursor: 'ns-resize' }}
      />
      <span className="inline-flex flex-col" style={{ width: 16 }}>
        <span
          className={`${arrowClass} rounded-tr`}
          style={{ minWidth: 10, minHeight: 9 }}
          onClick={() => !disabled && onChange(clamp(value + 1))}
        >
          ▲
        </span>
        <span
          className={`${arrowClass} border-t-0 rounded-br`}
          style={{ minWidth: 10, minHeight: 9 }}
          onClick={() => !disabled && onChange(clamp(value - 1))}
        >
          ▼
        </span>
      </span>
    </span>
  )
}

/* ---------------- 三态复选框（用于 seedRatioMode 等 0/1/2） ---------------- */
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
        style={{ width: 56, height: 20, background: checked ? '#fff' : 'var(--eu-grid-head-bottom)' }}
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

/* ---------------- 下拉选择（combobox 简化版） ---------------- */
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
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = options.find((o) => o.value === value)
  const visible = filter
    ? options.filter((o) => o.text.toLowerCase().includes(filter.toLowerCase()))
    : options
  let lastGroup: string | undefined

  return (
    <div ref={boxRef} className="relative inline-block" style={{ width, ...style }}>
      <div
        className={`eu-textbox flex items-center justify-between ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <input
          className="flex-1 outline-none bg-transparent min-w-0"
          value={editable && open ? filter : current?.text ?? value}
          placeholder={placeholder}
          readOnly={!editable || !open || disabled}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[8px] mr-0.5">▼</span>
      </div>
      {open && (
        <div
          className="absolute z-[9998] bg-white border border-[var(--eu-border)] rounded-b shadow-md max-h-[260px] overflow-auto"
          style={{ top: '100%', left: 0, right: 0, minWidth: width }}
        >
          {editable && !visible.some((o) => o.value === value) && value && filter === '' && (
            <div className="px-2 py-1 cursor-pointer hover:bg-[var(--eu-hover)]" onClick={() => { onChange(value); setOpen(false) }}>
              {value}
            </div>
          )}
          {visible.map((o) => {
            const groupEl = o.group && o.group !== lastGroup ? (
              <div className="px-2 py-0.5 text-gray-500 bg-[var(--eu-toolbar)]">{(lastGroup = o.group)}</div>
            ) : null
            return (
              <div key={o.value}>
                {groupEl}
                <div
                  className={`px-2 py-1 cursor-pointer hover:bg-[var(--eu-hover)] ${o.value === value ? 'bg-[var(--eu-selected)]' : ''}`}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setFilter('')
                  }}
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

/* ---------------- 搜索框 ---------------- */
export function SearchBox({
  onSearch,
  placeholder,
  width = 200,
}: {
  onSearch: (value: string) => void
  placeholder?: string
  width?: number
}) {
  return (
    <span className="inline-flex" style={{ width }}>
      <input
        className="eu-textbox w-full rounded-r-none"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch((e.target as HTMLInputElement).value)
        }}
      />
      <span
        className="inline-flex items-center justify-center border border-l-0 border-[var(--eu-border)] rounded rounded-l-none px-1 cursor-pointer hover:bg-[var(--eu-hover)]"
        style={{ width: 20 }}
        onClick={(e) => {
          const input = (e.currentTarget.previousSibling as HTMLInputElement)
          onSearch(input.value)
        }}
        title={placeholder}
      >
        <Icon name="tr-icon-search" />
      </span>
    </span>
  )
}

/* ---------------- Toast 浮层宿主（视口顶部居中、多条堆叠、各自自动消失） ---------------- */
export function ToastHost() {
  const ui = useUi()
  if (ui.toasts.length === 0) return null
  return createPortal(
    <div className="eu-toast-host">
      {ui.toasts.map((t) => (
        <div key={t.id} className="eu-toast-item">
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  )
}

/* ---------------- 批量操作进度浮层（右下角，带 loading 图标） ---------------- */
export function ProgressOverlay() {
  const progress = useProgress()
  if (!progress.text) return null
  return createPortal(
    <div className="eu-progress-overlay">
      <i className="icon-loading" />
      <span>{progress.text}</span>
    </div>,
    document.body,
  )
}
