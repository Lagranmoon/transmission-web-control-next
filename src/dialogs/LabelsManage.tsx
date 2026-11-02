// 用户标签管理（系统设置-更多-用户标签）
import { useState } from 'react'
import { LinkButton } from '../components/ui'
import { useLang } from '../i18n'
import { saveConfig, useConfig, type UserLabel } from '../lib/config'

type LabelRow = UserLabel & { origin: number }

export function LabelsManage() {
  const { lang } = useLang()
  const config = useConfig()
  const L = lang.dialog['system-config']['labels-manage']
  // origin 记录该行在保存前 config.labels 中的下标；labelMaps 存的是下标，删除/重排标签后
  // 必须同步重映射，否则已有种子会指到错标签（甚至因越界而显示不出任何标签）。
  const [labels, setLabels] = useState<LabelRow[]>(() =>
    config.labels.map((l, i) => ({ ...l, origin: i })),
  )

  const update = (i: number, patch: Partial<UserLabel>) => {
    setLabels((arr) =>
      arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    )
  }

  const save = () => {
    const remap = new Map<number, number>()
    labels.forEach((l, i) => {
      if (l.origin >= 0) remap.set(l.origin, i)
    })
    const labelMaps: Record<string, number[]> = {}
    for (const [hash, idxs] of Object.entries(config.labelMaps)) {
      const mapped = idxs
        .map((i) => remap.get(i))
        .filter((v): v is number => v !== undefined)
      if (mapped.length) labelMaps[hash] = mapped
    }
    saveConfig({
      labels: labels.map((l) => ({
        name: l.name,
        description: l.description,
        color: l.color,
      })),
      labelMaps,
      nav: { ...config.nav, labels: true },
    })
    // origin 归一为保存后的实际下标，保证连续多次保存时映射仍然正确
    setLabels((arr) => arr.map((l, i) => ({ ...l, origin: i })))
  }

  return (
    <div className="dialog flex flex-col h-full">
      <table className="border border-collapse border-[#ccc]">
        <thead>
          <tr className="bg-[var(--eu-grid-head-bottom)]">
            <th className="border border-[#ccc] px-1">{L.name}</th>
            <th className="border border-[#ccc] px-1">{L.description}</th>
            <th className="border border-[#ccc] px-1">{L.color}</th>
            <th className="border border-[#ccc] px-1">{L.actions}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((lb, i) => (
            <tr key={i}>
              <td className="border border-[#ccc]">
                <input
                  className="eu-textbox w-full"
                  value={lb.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </td>
              <td className="border border-[#ccc]">
                <input
                  className="eu-textbox w-full"
                  value={lb.description ?? ''}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
              </td>
              <td className="border border-[#ccc]">
                <input
                  type="color"
                  value={lb.color}
                  onChange={(e) => update(i, { color: e.target.value })}
                  style={{ width: 40, height: 20 }}
                />
              </td>
              <td className="border border-[#ccc] text-center">
                <LinkButton
                  icon="tr-icon-delete"
                  onClick={() => {
                    setLabels((arr) => arr.filter((_, idx) => idx !== i))
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1">
        <LinkButton
          icon="tr-icon-plus"
          onClick={() =>
            setLabels((arr) => [
              ...arr,
              { name: `标签${arr.length + 1}`, color: '#4ec94e', origin: -1 },
            ])
          }
        >
          {lang.dialog.public['button-addnew']}
        </LinkButton>
        <LinkButton icon="icon-ok" onClick={save}>
          {lang.dialog.public['button-save']}
        </LinkButton>
      </div>
    </div>
  )
}
