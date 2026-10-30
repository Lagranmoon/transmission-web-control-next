// 公用格式化函数 — 1:1 移植自原项目 public.js

/** 两位小数 + 末尾空格（原版 formatNumber("###,###,###,###.00 ") 的 pattern 末尾空格经 fStr 追加），使 formatSize 输出 "1.50 KB" */
function formatNumber(value: number): string {
  return (
    value
      .toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' '
  )
}

/** 字节数格式化；type === 'speed' 时追加 /s，与原 formatSize 行为一致 */
export function formatSize(bytes: number | undefined, zeroToEmpty = false, type?: 'speed'): string {
  if (bytes == null) bytes = 0
  if (bytes === 0) {
    if (zeroToEmpty) return ''
    return type === 'speed' ? '0.00 KB/s' : '0.00'
  }
  let r = 0
  let u = 'KB'
  if (bytes < 1000 * 1024) {
    r = bytes / 1024
    u = 'KB'
  } else if (bytes < 1000 * 1048576) {
    r = bytes / 1048576
    u = 'MB'
  } else if (bytes < 1000 * 1073741824) {
    r = bytes / 1073741824
    u = 'GB'
  } else if (bytes < 1000 * 1099511627776) {
    r = bytes / 1099511627776
    u = 'TB'
  } else {
    r = bytes / 1125899906842624
    u = 'PB'
  }
  if (type === 'speed') u += '/s'
  return formatNumber(r) + u
}

/** unix 秒 → yyyy-mm-dd hh:nn:ss */
export function formatLongTime(time: number | undefined): string {
  if (!time || time <= 0) return ''
  const d = new Date(time * 1000)
  const p = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 时长单位（随界面语言变化） */
export interface TimeUnits {
  d: string
  h: string
  m: string
  s: string
}

/** 英文时长单位，同原版 "%dd %hh %mm %ss" 格式 */
export const EN_TIME_UNITS: TimeUnits = { d: 'd', h: 'h', m: 'm', s: 's' }

/** 毫秒时长 → 本地化时长文本（原 getTotalTime） */
export function getTotalTime(timeMs: number, units: TimeUnits = EN_TIME_UNITS): string {
  const days = Math.floor(timeMs / (24 * 3600 * 1000))
  const leave1 = timeMs % (24 * 3600 * 1000)
  const hours = Math.floor(leave1 / (3600 * 1000))
  const leave2 = leave1 % (3600 * 1000)
  const minutes = Math.floor(leave2 / (60 * 1000))
  const seconds = Math.round((leave2 % (60 * 1000)) / 1000)
  let result = ''
  if (days > 0) result += `${days}${units.d} `
  if (hours > 0) result += `${hours}${units.h} `
  if (minutes > 0) result += `${minutes}${units.m} `
  if (seconds > 0) result += `${seconds}${units.s}`
  return result.trim()
}

export function getHostName(url: string): string {
  const match = url.match(/^\w+:\/\/([^/]*)/)
  let result = match ? match[1] : url
  if (result.includes(':')) result = result.split(':')[0]
  return result
}

/** 根据十六进制颜色计算灰度（用于标签文字黑白选择） */
export function getGrayLevel(color: string): number {
  if (!color) return 0
  const m = color.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return 0
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** 通用排序（arrayObjectSort 移植） */
export function compareField(field: string, order: 'asc' | 'desc') {
  const dir = order === 'desc' ? -1 : 1
  return (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const v1 = a[field]
    const v2 = b[field]
    if (v1 == null) return 1 * dir
    if (v2 == null) return -1 * dir
    if (typeof v1 === 'string' || typeof v2 === 'string') {
      return String(v1).localeCompare(String(v2)) * dir
    }
    if (v1 < v2) return -1 * dir
    if (v1 > v2) return 1 * dir
    return 0
  }
}

export function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text: string) {
  const aux = document.createElement('textarea')
  aux.style.display = 'block'
  aux.value = text
  document.body.appendChild(aux)
  aux.select()
  document.execCommand('copy')
  aux.style.display = 'none'
  document.body.removeChild(aux)
}

/** Base64 目录 key（与原项目 getValidTreeKey 一致） */
export function validTreeKey(text: string): string {
  if (!text) return ''
  try {
    return btoa(unescape(encodeURIComponent(text))).replace(/[+|\/|=]/g, '0')
  } catch {
    return text.replace(/[^a-zA-Z0-9]/g, '0')
  }
}

/** 深合并（用于 en 基础语言包 + 目标语言） */
export function deepMerge<T>(base: T, override: unknown): T {
  if (override == null) return base
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override as T
  if (typeof override !== 'object' || Array.isArray(override)) return override as T
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const key of Object.keys(override as Record<string, unknown>)) {
    const bv = (base as Record<string, unknown>)[key]
    const ov = (override as Record<string, unknown>)[key]
    result[key] = bv !== undefined ? deepMerge(bv, ov) : ov
  }
  return result as T
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}
