// Peers IP 归属地/国旗 — 移植原 system.js 的 ipInfo 逻辑
// 支持 ipinfo.io token 或自定义 URL（%ip/%lang/%host/%hostname/%protocol/%navlang）
import { configStore } from './config'
import { asset } from './asset'

const flagCache = new Map<string, string>()
const detailCache = new Map<string, string>()

function expandUrl(url: string, ip: string): string {
  return url
    .replace(/%ip/g, ip)
    .replace(/%lang/g, localStorage.getItem('twc.lang') || 'en')
    .replace(/%hostname/g, location.hostname)
    .replace(/%host/g, location.host)
    .replace(/%protocol/g, location.protocol)
    .replace(/%navlang/g, navigator.language)
}

function geoConfig() {
  const c = configStore.get()
  const token = (c as { ipInfoToken?: string }).ipInfoToken ?? ''
  const flagUrl = (c as { ipInfoFlagUrl?: string }).ipInfoFlagUrl ?? ''
  const detailUrl = (c as { ipInfoDetailUrl?: string }).ipInfoDetailUrl ?? ''
  return { enabled: !!token || !!flagUrl, token, flagUrl, detailUrl }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.text()).trim()
  } catch {
    return null
  }
}

/** 获取国旗代码（两位小写），带缓存；未启用时返回 null */
export async function lookupFlag(ip: string): Promise<string | null> {
  if (flagCache.has(ip)) return flagCache.get(ip) || null
  const { enabled, token, flagUrl } = geoConfig()
  if (!enabled) return null
  const url = flagUrl ? expandUrl(flagUrl, ip) : `https://ipinfo.io/${ip}/country?token=${token}`
  const cc = await fetchText(url)
  const code = cc ? cc.toLowerCase().slice(0, 2) : ''
  flagCache.set(ip, code)
  return code || null
}

/** 获取 IP 归属地描述（可选，仅在配置了详情 URL 时） */
export async function lookupDetail(ip: string): Promise<string | null> {
  if (detailCache.has(ip)) return detailCache.get(ip) || null
  const { enabled, detailUrl } = geoConfig()
  if (!enabled || !detailUrl) return null
  const detail = await fetchText(expandUrl(detailUrl, ip))
  detailCache.set(ip, detail || '')
  return detail || null
}

/** 是否启用了归属地功能（供 UI 决定是否渲染国旗占位） */
export function geoEnabled(): boolean {
  return geoConfig().enabled
}

export function flagSrc(code: string): string {
  return asset(`assets/flags/${code}.png`)
}
