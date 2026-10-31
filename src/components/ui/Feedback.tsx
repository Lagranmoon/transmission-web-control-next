/* ---------------- Toast 浮层宿主（视口顶部居中、多条堆叠、各自自动消失） ---------------- */
import { createPortal } from 'react-dom'
import { useProgress, useUi } from '../../lib/ui'

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
