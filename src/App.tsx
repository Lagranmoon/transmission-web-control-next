import { Route, Routes } from 'react-router-dom'
import { useMemo } from 'react'
import { LangContext, getLangPack, resolveLang } from './i18n'
import { MenuProvider } from './components/ui'
import { RootLayout } from './routes/RootLayout'

export default function App() {
  const langCtx = useMemo(() => {
    const name = resolveLang(new URLSearchParams(location.search).get('lang'))
    return { lang: getLangPack(name), name }
  }, [])

  return (
    <LangContext.Provider value={langCtx}>
      <MenuProvider>
        <Routes>
          <Route path="/" element={<RootLayout />} />
        </Routes>
      </MenuProvider>
    </LangContext.Provider>
  )
}
