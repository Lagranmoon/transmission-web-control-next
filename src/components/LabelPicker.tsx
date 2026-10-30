// 「可用标签 / 已选标签」双栏选择器 — AddTorrentDialog 与 SetLabelsDialog 共用
// 复刻原项目 user-label-big 色块交互：左栏点击加入已选，右栏点击移除
import type { CSSProperties } from 'react'
import { useLang } from '../i18n'
import { useConfig } from '../lib/config'
import { getGrayLevel } from '../lib/format'

export function LabelPicker({
  selected,
  onChange,
  style,
}: {
  /** 已选标签（值为 config.labels 的下标） */
  selected: Set<number>
  onChange: (next: Set<number>) => void
  /** 应用到双栏容器的样式（如高度） */
  style?: CSSProperties
}) {
  const { lang } = useLang()
  const config = useConfig()
  const L = lang.dialog['torrent-setLabels']
  return (
    <div className="flex" style={style}>
      <div className="w-1/2">
        <div>{L.available}</div>
        <div className="p-1">
          {config.labels.map((lb, i) =>
            selected.has(i) ? null : (
              <a
                key={i}
                className="user-label-big"
                style={{ backgroundColor: lb.color, color: getGrayLevel(lb.color) > 0.5 ? '#000' : '#fff' }}
                onClick={() => onChange(new Set([...selected, i]))}
              >
                {lb.name}
              </a>
            ),
          )}
        </div>
      </div>
      <div className="w-1/2 border-l border-dotted border-[#ccc] pl-1">
        <div>{L.selected}</div>
        <div className="p-1">
          {[...selected].map((i) => {
            const lb = config.labels[i]
            if (!lb) return null
            return (
              <a
                key={i}
                className="user-label-big"
                style={{ backgroundColor: lb.color, color: getGrayLevel(lb.color) > 0.5 ? '#000' : '#fff' }}
                onClick={() => {
                  const next = new Set(selected)
                  next.delete(i)
                  onChange(next)
                }}
              >
                {lb.name}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
