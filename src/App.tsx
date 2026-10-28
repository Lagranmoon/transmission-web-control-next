import { Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { LangContext, getLangPack, resolveLang } from './i18n'
import { MenuProvider } from './components/ui'
import { RootLayout } from './routes/RootLayout'
import { MobilePage } from './routes/MobilePage'
import { configStore } from './lib/config'

export default function App() {
  const langCtx = useMemo(() => {
    const name = resolveLang(new URLSearchParams(location.search).get('lang'))
    return { lang: getLangPack(name), name }
  }, [])

  // 启动时应用已保存的主题
  useEffect(() => {
    const saved = configStore.get().theme || 'default'
    // C2 跟随系统深色：仅当用户从未手动切换过主题（保存值仍为默认 'default'）且系统偏好深色时，
    // 本次会话应用 black 主题并换白色 logo（小段逻辑参考 TopBar.applyTheme，不写回配置、不监听后续变化）。
    const followDark =
      saved === 'default' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = followDark ? 'black' : saved
    document.documentElement.dataset.theme = theme
    if (followDark) {
      const logo = document.getElementById('logo') as HTMLImageElement | null
      if (logo) logo.src = '/assets/logo-white.png'
    }
  }, [])

  return (
    <LangContext.Provider value={langCtx}>
      <MenuProvider>
        <Routes>
          <Route path="/" element={<DesktopOrMobile />} />
          <Route path="/mobile" element={<MobilePage />} />
          <Route path="*" element={<RootLayout />} />
        </Routes>
      </MenuProvider>
    </LangContext.Provider>
  )
}

/** 桌面入口：移动设备自动跳转移动版（?devicetype=computer 可强制桌面），与原版一致 */
function DesktopOrMobile() {
  const navigate = useNavigate()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('devicetype') === 'computer') return
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobile) navigate('/mobile', { replace: true })
  }, [navigate])
  return <RootLayout />
}
