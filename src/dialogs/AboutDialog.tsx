import { Dialog } from '../components/ui'
import { useLang } from '../i18n'
import { closeDialog } from '../lib/ui'
import { useSession } from '../api/queries'
import { asset } from '../lib/asset'

/* ---------------- 关于 ---------------- */
export function AboutDialog({ dialogId }: { dialogId: string }) {
  const { lang, name } = useLang()
  const session = useSession()
  const zh = name === 'zh-CN'
  return (
    <Dialog
      title={lang.toolbar.about}
      width={420}
      height={340}
      onClose={() => closeDialog(dialogId)}
    >
      <div className="text-center leading-6">
        <img
          src={asset('assets/images/logo.png')}
          width={52}
          height={52}
          className="mx-auto"
          alt="logo"
        />
        <div className="mt-2 text-[15px] font-medium text-[var(--eu-title)]">
          Transmission Web Control Next
        </div>
        <div>v{__APP_VERSION__}</div>
        <hr className="my-3" />
        <div>
          Transmission: {session.data?.version ?? '-'}, RPC:{' '}
          {session.data?.['rpc-version'] ?? '-'}
        </div>
        <div className="mt-2 text-[13px]">
          <div>Copyright © 2026 Lagranmoon</div>
          <div>
            {zh ? '基于原项目' : 'Based on'}{' '}
            <a
              className="text-[#0066cc]"
              href="https://github.com/ronggang/transmission-web-control"
              target="_blank"
              rel="noreferrer"
            >
              Transmission Web Control
            </a>{' '}
            © 2012-2019 {zh ? '栽培者' : 'ronggang'} (MIT)
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-1">
          <a
            className="l-btn"
            href="https://github.com/Lagranmoon/transmission-web-control-next"
            target="_blank"
            rel="noreferrer"
            title={lang.dialog.about.home}
          >
            <i className="iconfont tr-icon-github" />
          </a>
        </div>
      </div>
    </Dialog>
  )
}
