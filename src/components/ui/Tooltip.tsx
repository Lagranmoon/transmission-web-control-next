/* ---------------- Tooltip（悬浮提示，延迟 300ms，视口边缘自动翻转） ---------------- */
import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

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
  if (content === undefined || content === null || content === '')
    return children

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
