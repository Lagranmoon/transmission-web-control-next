// Transmission RPC 客户端 — 移植自原项目 transmission.js
// - 会话初始化：409 + X-Transmission-Session-Id 自动重试
// - 可选 Basic 认证（localStorage twc.auth = "user:pass"）
// - VITE_MOCK=1 时切换到内置模拟服务，便于无守护进程时开发 UI
import type { Torrent } from './types'

export class RpcError extends Error {
  code: number
  constructor(code: number, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.code = code
  }
}

const USE_MOCK = !!import.meta.env.VITE_MOCK

let sessionId = localStorage.getItem('twc.sessionId') || ''

function rpcUrl(): string {
  const custom = localStorage.getItem('twc.rpcPath')
  // 默认相对路径（与原版 rpcpath "../rpc" 一致）：
  // 部署在 Transmission 的 /transmission/web/ 下时自动解析到 /transmission/rpc
  return custom || '../rpc'
}

function authHeader(): Record<string, string> {
  const auth = localStorage.getItem('twc.auth')
  if (!auth) return {}
  try {
    return { Authorization: 'Basic ' + btoa(auth) }
  } catch (e) {
    // btoa 仅支持 Latin1：凭据含非 Latin1 字符时给出明确错误，而非归为 network-error
    throw new RpcError(-1, 'auth-encode-error', { cause: e })
  }
}

interface RpcRequestBody {
  method: string
  arguments: Record<string, unknown>
  tag?: string
}

async function realRpc<T = unknown>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const body: RpcRequestBody = { method, arguments: args }
  const doFetch = () =>
    fetch(rpcUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Transmission-Session-Id': sessionId,
        ...authHeader(),
      },
      body: JSON.stringify(body),
    })
  // 错误契约：调用方只会看到 RpcError（重试 / JSON 解析等一切异常都转成 RpcError 并保留 cause）
  let res: Response
  try {
    res = await doFetch()
    if (res.status === 409) {
      const sid = res.headers.get('X-Transmission-Session-Id')
      if (sid) {
        sessionId = sid
        localStorage.setItem('twc.sessionId', sid)
        res = await doFetch()
      }
    }
    if (res.status === 401) throw new RpcError(401, 'unauthorized')
    if (!res.ok) throw new RpcError(res.status, `http-${res.status}`)
    const data = await res.json()
    if (data.result !== 'success') throw new RpcError(0, data.result || 'error')
    return data.arguments as T
  } catch (e) {
    if (e instanceof RpcError) throw e
    throw new RpcError(-1, 'network-error', { cause: e })
  }
}

export const rpc = USE_MOCK ? mockRpcImpl : realRpc

/** 上传 .torrent 文件（rpc-version>=15 用 metainfo base64 方式，与原项目一致） */
export async function addTorrentFile(file: File, downloadDir: string, paused: boolean) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const idx = dataUrl.indexOf('base64,')
  if (idx === -1) throw new Error('invalid file')
  const metainfo = dataUrl.substring(idx + 'base64,'.length)
  return rpc<{ 'torrent-added'?: { id: number; hashString: string; name: string }; 'torrent-duplicate'?: unknown }>(
    'torrent-add',
    {
      metainfo,
      'download-dir': downloadDir,
      paused,
    },
  )
}

/* ------------------------------------------------------------------ */
/* Mock 实现：模拟一个有若干种子的 Transmission 服务，用于 UI 开发验证  */
/* ------------------------------------------------------------------ */

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number')
}

async function mockRpcImpl<T = unknown>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const m = (obj: unknown) => obj as T
  const { getMockState, mockMutate } = await import('./mock')
  const state = getMockState(method)

  switch (method) {
    case 'session-get':
      return m(state.session)
    case 'session-stats':
      return m(state.stats)
    case 'free-space': {
      const path = String(args.path || '')
      const dir = state.freeSpaces[path]
      return m({ path, 'size-bytes': dir ?? 320 * 1024 ** 3 })
    }
    case 'torrent-get': {
      const fields = isStringArray(args.fields) ? args.fields : []
      const ids = args.ids
      let torrents: Torrent[] = state.torrents
      if (isNumberArray(ids)) torrents = torrents.filter((x) => ids.includes(x.id))
      else if (ids !== 'recently-active' && ids != null) torrents = torrents.filter((x) => ids === x.id)
      const picked = torrents.map((x) => {
        const o: Record<string, unknown> = {}
        for (const f of fields) o[f] = (x as unknown as Record<string, unknown>)[f]
        return o
      })
      return m({ torrents: picked, removed: state.removed })
    }
    case 'torrent-add':
    case 'torrent-start':
    case 'torrent-stop':
    case 'torrent-remove':
    case 'torrent-verify':
    case 'torrent-reannounce':
    case 'torrent-set':
    case 'torrent-rename-path':
    case 'torrent-set-location':
    case 'session-set':
    case 'queue-move-top':
    case 'queue-move-up':
    case 'queue-move-down':
    case 'queue-move-bottom':
      return m(await mockMutate(method, args))
    default:
      return m({})
  }
}
