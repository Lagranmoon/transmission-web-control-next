/* ---------------- linkbutton ---------------- */
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { Tooltip } from './Tooltip'

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
  /** 鼠标点击与 Enter/Space 键盘触发共用；键盘路径收到的是 KeyboardEvent */
  onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void
  loading?: boolean
  className?: string
  children?: ReactNode
}) {
  const btn = (
    <a
      className={`l-btn ${disabled || loading ? 'l-btn-disabled' : ''} ${className}`}
      onClick={(e) => {
        if (disabled || loading) return
        e.preventDefault()
        onClick?.(e)
      }}
      // React 19 会拦截 javascript: URL（原版 EasyUI 的 href="javascript:void(0);" 写法
      // 会在每次点击时抛 "React has blocked a javascript: URL"），故不带 href，改用 role
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (disabled || loading) return
          e.preventDefault()
          onClick?.(e)
        }
      }}
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
