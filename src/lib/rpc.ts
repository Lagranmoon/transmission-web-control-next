// Transmission RPC 客户端 — 移植自原项目 transmission.js
// - 会话初始化：409 + X-Transmission-Session-Id 自动重试
// - 可选 Basic 认证（localStorage twc.auth = "user:pass"）
// - VITE_MOCK=1 时切换到内置模拟服务，便于无守护进程时开发 UI

export class RpcError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

const USE_MOCK = !!import.meta.env.VITE_MOCK

let sessionId = localStorage.getItem('twc.sessionId') || ''

export function getSessionId() {
  return sessionId
}

function rpcUrl(): string {
  const custom = localStorage.getItem('twc.rpcPath')
  return custom || '/rpc'
}

function authHeader(): Record<string, string> {
  const auth = localStorage.getItem('twc.auth')
  if (!auth) return {}
  return { Authorization: 'Basic ' + btoa(auth) }
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
  let res: Response
  try {
    res = await doFetch()
  } catch (e) {
    throw new RpcError(-1, 'network-error')
  }
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

async function mockRpcImpl<T = unknown>(method: string, args: Record<string, any> = {}): Promise<T> {
  const m = (obj: unknown) => obj as T
  const t = (ms: number) => Math.floor((Date.now() - ms) / 1000)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getMockState, mockMutate } = await import('./mock')
  const state = getMockState()

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
      const fields: string[] = args.fields || []
      const ids = args.ids
      let torrents = state.torrents
      if (Array.isArray(ids)) torrents = torrents.filter((x: any) => ids.includes(x.id))
      else if (ids !== 'recently-active' && ids != null) torrents = torrents.filter((x: any) => ids === x.id)
      const picked = torrents.map((x) => {
        const o: Record<string, unknown> = {}
        for (const f of fields) o[f] = (x as any)[f]
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
