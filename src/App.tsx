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
    document.documentElement.dataset.theme = configStore.get().theme || 'default'
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
