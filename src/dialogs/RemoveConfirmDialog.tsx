import { useState } from 'react'
import { Dialog, LinkButton } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog, showProgress, hideProgress } from '../lib/ui'
import { useRpcMutation } from '../api/queries'

/* ---------------- 删除确认 ---------------- */
export function RemoveConfirmDialog({
  dialogId,
  ids,
}: {
  dialogId: string
  ids: number[]
}) {
  const { lang } = useLang()
  const mutation = useRpcMutation()
  const [removeData, setRemoveData] = useState(false)
  const L = lang.dialog['torrent-remove']
  return (
    <Dialog
      title={L.title}
      width={350}
      height={170}
      onClose={() => closeDialog(dialogId)}
      footer={
        <>
          <LinkButton
            icon="icon-ok"
            loading={mutation.isPending}
            onClick={() => {
              // 批量删除期间在右下角显示进度浮层（onSettled 清除）
              showProgress(
                lang.public['text-processing'].replace(
                  '%n',
                  String(ids.length),
                ),
              )
              mutation.mutate(
                {
                  method: 'torrent-remove',
                  args: { ids, 'delete-local-data': removeData },
                },
                {
                  onSuccess: () => closeDialog(dialogId),
                  onError: () => alert(L['remove-error']),
                  onSettled: () => hideProgress(),
                },
              )
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
      <div className="p-2">
        <span className="messager-question" />
        <div>{L['confirm-text']}</div>
        <hr />
        <label>
          <input
            type="checkbox"
            checked={removeData}
            onChange={(e) => setRemoveData(e.target.checked)}
          />
          {L['remove-data']}
        </label>
      </div>
    </Dialog>
  )
}
