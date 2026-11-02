// 系统设置「目录字典」页 — 每行一个常用下载目录
// 草稿由父组件持有：切换页签时组件会卸载，放在本地 state 会丢失未保存的编辑
import { LinkButton } from '../../components/ui'
import { useLang } from '../../i18n'
import { setFolderDictionary } from '../../lib/config'
import { showToast } from '../../lib/ui'

export function DictionaryTab({
  text,
  onChange,
}: {
  text: string
  onChange: (value: string) => void
}) {
  const { lang } = useLang()
  const L = lang.dialog['system-config']

  return (
    <div className="dialog flex flex-col h-full">
      <div className="mb-1">{L.tabs['dictionary-folders']}</div>
      <textarea
        className="eu-textbox flex-1"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/downloads/movies&#10;/data/series"
      />
      <div className="mt-1">
        <LinkButton
          icon="icon-ok"
          onClick={() => {
            setFolderDictionary(
              text
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            )
            showToast(lang.public['text-saved'])
          }}
        >
          {lang.dialog.public['button-save']}
        </LinkButton>
      </div>
    </div>
  )
}
