/* ---------------- Tabs（支持左侧布局，用于详情面板） ---------------- */
import type { ReactNode } from 'react'

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
