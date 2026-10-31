/* ---------------- 菜单 ---------------- */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

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

interface MenuState {
  items: MenuItemSpec[]
  x: number
  y: number
}

const MenuCtx = createContext<{
  show: (items: MenuItemSpec[], x: number, y: number) => void
}>({ show: () => {} })

// eslint-disable-next-line react-refresh/only-export-components -- 自定义 hook 与 MenuProvider 同文件是有意安排
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
      if (x + w > window.innerWidth - 4)
        x = Math.max(4, window.innerWidth - w - 4)
      if (y + h > window.innerHeight - 4)
        y = Math.max(4, window.innerHeight - h - 4)
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
          <div
            className="eu-menu"
            ref={ref}
            style={{ left: state.x, top: state.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
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
                  {entry.icon ? (
                    <Icon name={entry.icon} />
                  ) : (
                    <span style={{ width: 16, display: 'inline-block' }} />
                  )}
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
