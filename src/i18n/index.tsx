// i18n — 语言包来自原项目 i18n/*.json（en 为基础，与目标语言深合并）
import { createContext, useContext } from 'react'
import en from './en.json'
import zhCN from './zh_CN.json'
import { deepMerge } from '../lib/format'

export const LANGUAGES: Record<string, string> = {
  'zh-CN': '简体中文',
  en: 'English',
}

export type Lang = typeof en

const packs: Record<string, unknown> = {
  en,
  'zh-CN': zhCN,
}

export function resolveLang(pref?: string | null): string {
  let lang = pref || localStorage.getItem('twc.lang') || navigator.language || ''
  if (lang.includes('-')) {
    lang = lang.split('-')[0].toLowerCase() + '-' + lang.split('-')[1].toUpperCase()
  }
  if (!packs[lang]) lang = 'en'
  localStorage.setItem('twc.lang', lang)
  return lang
}

export function getLangPack(lang: string): Lang {
  const base = en as Lang
  if (lang === 'en' || !packs[lang]) return base
  return deepMerge(base, packs[lang])
}

export const LangContext = createContext<{ lang: Lang; name: string }>({
  lang: getLangPack('zh-CN'),
  name: 'zh-CN',
})

export function useLang() {
  return useContext(LangContext)
}
