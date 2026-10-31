/* ---------------- 对话框 ---------------- */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/** resizable 对话框的尺寸记忆（按 dialogId 存 localStorage），key 与原版 config 风格一致 */
const DIALOG_SIZE_KEY = 'twc.dialogSize.'
const DIALOG_MIN_WIDTH = 320
const DIALOG_MIN_HEIGHT = 160

function loadDialogSize(
  dialogId: string,
): { width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(DIALOG_SIZE_KEY + dialogId)
    if (!raw) return null
    const s = JSON.parse(raw) as { width?: unknown; height?: unknown }
    if (typeof s.width !== 'number' || typeof s.height !== 'number') return null
    // 恢复时限制在当前视口内，避免小屏上打开即出界
    return {
      width: Math.max(
        DIALOG_MIN_WIDTH,
        Math.min(s.width, window.innerWidth - 16),
      ),
      height: Math.max(
        DIALOG_MIN_HEIGHT,
        Math.min(s.height, window.innerHeight - 16),
      ),
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
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    () => (dialogId ? loadDialogSize(dialogId) : null),
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
    const rect = (
      e.currentTarget.closest('.eu-dialog') as HTMLElement
    ).getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let w = rect.width
    let h = rect.height
    const move = (ev: MouseEvent) => {
      w = Math.max(
        DIALOG_MIN_WIDTH,
        Math.min(rect.width + ev.clientX - startX, window.innerWidth - 8),
      )
      h = Math.max(
        DIALOG_MIN_HEIGHT,
        Math.min(rect.height + ev.clientY - startY, window.innerHeight - 8),
      )
      setSize({ width: w, height: h })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      if (dialogId) {
        try {
          localStorage.setItem(
            DIALOG_SIZE_KEY + dialogId,
            JSON.stringify({ width: w, height: h }),
          )
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
      {/* 对齐原版 EasyUI dialog：点击遮罩不关闭，防止误点丢表单内容 */}
      {modal && <div className="eu-dialog-mask" />}
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
            el.style.left =
              Math.max(8, (window.innerWidth - rect.width) / 2) + 'px'
            el.style.top =
              Math.max(8, (window.innerHeight - rect.height) / 2 - 30) + 'px'
          }
        }}
      >
        <div
          className="eu-dialog-header"
          onMouseDown={onDragStart}
          style={{ cursor: 'move', userSelect: 'none' }}
        >
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
        {footer !== undefined && (
          <div className="eu-dialog-footer">{footer}</div>
        )}
        {resizable && (
          <div className="eu-dialog-resizer" onMouseDown={onResizeStart} />
        )}
      </div>
    </>,
    document.body,
  )
}
