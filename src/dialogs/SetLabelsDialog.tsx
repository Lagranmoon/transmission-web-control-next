import { useState } from 'react'
import { Dialog, LinkButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog } from '../lib/ui'
import { useConfig, saveConfig } from '../lib/config'
import { LabelPicker } from '../components/LabelPicker'

/* ---------------- 设置用户标签 ---------------- */
export function SetLabelsDialog({
  dialogId,
  hashs,
}: {
  dialogId: string
  hashs: string[]
}) {
  const { lang } = useLang()
  const config = useConfig()
  const L = lang.dialog['torrent-setLabels']
  // 初始化：取第一个种子的现有标签（惰性初始化，避免渲染期 setState）
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(config.labelMaps[hashs[0]] ?? []),
  )
  return (
    <Dialog
      title={L.title}
      width={520}
      height={220}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            onClick={() => {
              const maps = { ...config.labelMaps }
              const ids = Array.from(selected)
              for (const h of hashs) {
                if (ids.length) maps[h] = ids
                else delete maps[h]
              }
              saveConfig({ labelMaps: maps })
              closeDialog(dialogId)
            }}
          >
            {lang.dialog.public['button-ok']}
          </LinkButton>
          <LinkButton icon="icon-cancel" onClick={() => closeDialog(dialogId)}>
            {lang.dialog.public['button-cancel']}
          </LinkButton>
        </>
      }
    >
      <LabelPicker
        selected={selected}
        onChange={setSelected}
        style={{ height: '100%' }}
      />
    </Dialog>
  )
}
