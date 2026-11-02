// 详情面板「设置」页 — 单种子限速、做种模式与 peer 上限
import { useState } from 'react'
import { LinkButton, NumberSpinner, TriStateCheckbox } from '../ui'
import { useLang } from '../../i18n'
import { useRpcMutation } from '../../api/queries'
import { showToast } from '../../lib/ui'
import type { Torrent } from '../../lib/types'

interface TriState {
  checked: boolean
  indeterminate: boolean
  value?: number
}

const toTriState = (mode: number | boolean | undefined): TriState => ({
  checked: mode === 1 || mode === true,
  indeterminate: mode === 0,
  value: typeof mode === 'number' ? mode : undefined,
})

/** TriStateCheckbox 只翻转 checked，模式按「0 跟随全局 → 1 启用 → 2 禁用 → 0」循环 */
const nextTriState = (s: TriState): TriState => {
  const cur = s.value ?? (s.indeterminate ? 0 : s.checked ? 1 : 2)
  const next = (cur + 1) % 3
  return { checked: next === 1, indeterminate: next === 0, value: next }
}

export function ConfigTab({ torrent }: { torrent: Torrent }) {
  const { lang } = useLang()
  const L = lang.torrent.attribute.label
  const mutation = useRpcMutation()
  const [saved, setSaved] = useState<'none' | 'saving' | 'saved'>('none')

  const [downloadLimited, setDownloadLimited] = useState(
    !!torrent.downloadLimited,
  )
  const [downloadLimit, setDownloadLimit] = useState(torrent.downloadLimit ?? 0)
  const [uploadLimited, setUploadLimited] = useState(!!torrent.uploadLimited)
  const [uploadLimit, setUploadLimit] = useState(torrent.uploadLimit ?? 0)
  const [peerLimit, setPeerLimit] = useState(torrent['peer-limit'] ?? 60)
  const [seedRatioMode, setSeedRatioMode] = useState(
    toTriState(torrent.seedRatioMode),
  )
  const [seedRatioLimit, setSeedRatioLimit] = useState(
    torrent.seedRatioLimit ?? 2,
  )
  const [seedIdleMode, setSeedIdleMode] = useState(
    toTriState(torrent.seedIdleMode),
  )
  const [seedIdleLimit, setSeedIdleLimit] = useState(
    torrent.seedIdleLimit ?? 30,
  )

  const save = () => {
    const args: Record<string, unknown> = {
      ids: torrent.id,
      downloadLimited,
      downloadLimit,
      uploadLimited,
      uploadLimit,
      'peer-limit': peerLimit,
      seedRatioMode: seedRatioMode.value ?? (seedRatioMode.checked ? 1 : 2),
      seedRatioLimit,
      seedIdleMode: seedIdleMode.value ?? (seedIdleMode.checked ? 1 : 2),
      seedIdleLimit,
    }
    setSaved('saving')
    mutation.mutate(
      { method: 'torrent-set', args },
      {
        onSuccess: () => {
          setSaved('saved')
          setTimeout(() => setSaved('none'), 2000)
        },
        onError: (e) => {
          // 失败时复位保存按钮（否则永久停在 loading 且不可重试），并给出可见反馈
          setSaved('none')
          showToast(String(e.message))
        },
      },
    )
  }

  return (
    <div className="dialog h-full flex flex-col">
      <table>
        <tbody>
          <tr>
            <td width="38%" className="title">
              <TriStateCheckbox
                id="downloadLimited"
                checked={downloadLimited}
                onChange={({ checked }) => setDownloadLimited(checked)}
                label={L.downloadLimited}
              />
            </td>
            <td width="12%">
              <NumberSpinner
                value={downloadLimit}
                onChange={setDownloadLimit}
                disabled={!downloadLimited}
              />{' '}
              KB/s
            </td>
            <td width="38%" className="title">
              <TriStateCheckbox
                id="seedRatioMode"
                checked={seedRatioMode.checked}
                indeterminate={seedRatioMode.indeterminate}
                onChange={() => setSeedRatioMode(nextTriState(seedRatioMode))}
                label={L.seedRatioMode}
              />
            </td>
            <td width="12%">
              <NumberSpinner
                value={seedRatioLimit}
                onChange={setSeedRatioLimit}
                disabled={seedRatioMode.value !== 1}
              />
            </td>
          </tr>
          <tr>
            <td className="title">
              <TriStateCheckbox
                id="uploadLimited"
                checked={uploadLimited}
                onChange={({ checked }) => setUploadLimited(checked)}
                label={L.uploadLimited}
              />
            </td>
            <td>
              <NumberSpinner
                value={uploadLimit}
                onChange={setUploadLimit}
                disabled={!uploadLimited}
              />{' '}
              KB/s
            </td>
            <td className="title">
              <TriStateCheckbox
                id="seedIdleMode"
                checked={seedIdleMode.checked}
                indeterminate={seedIdleMode.indeterminate}
                onChange={() => setSeedIdleMode(nextTriState(seedIdleMode))}
                label={L.seedIdleMode}
              />
            </td>
            <td>
              <NumberSpinner
                value={seedIdleLimit}
                onChange={setSeedIdleLimit}
                disabled={seedIdleMode.value !== 1}
              />{' '}
              {lang.dialog['system-config'].minutes}
            </td>
          </tr>
          <tr>
            <td className="title">{L['peer-limit']}</td>
            <td>
              <NumberSpinner
                value={peerLimit}
                onChange={setPeerLimit}
                width={90}
              />
            </td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
      <div className="mt-auto flex items-center gap-2 p-1 border-t border-[var(--eu-line)]">
        <LinkButton icon="icon-ok" onClick={save} loading={saved === 'saving'}>
          {lang.dialog.public['button-save']}
        </LinkButton>
        {saved === 'saved' && <span>{lang.public['text-saved']}</span>}
      </div>
    </div>
  )
}
