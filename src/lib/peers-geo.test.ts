// peers-geo.ts 单元测试 — fetch 用 vi.stubGlobal mock，验证 URL 模板展开、缓存与降级行为
// 注意：模块级缓存 Map 会导致用例互相污染，故每个用例前 vi.resetModules() 并动态 import 全新模块实例
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const okResponse = (body: string) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(body),
})

/** 每个 it 内动态加载全新模块图（peers-geo + 其依赖的 config），缓存与配置均为初始态 */
async function freshGeo() {
  const { configStore } = await import('./config')
  const geo = await import('./peers-geo')
  return { configStore, geo }
}

describe('peers-geo', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('geoEnabled', () => {
    it('默认未启用；配置 ipInfoToken 或 ipInfoFlagUrl 任一即启用', async () => {
      const { configStore, geo } = await freshGeo()
      expect(geo.geoEnabled()).toBe(false)

      configStore.set({ ipInfoToken: 'TOK' })
      expect(geo.geoEnabled()).toBe(true)

      configStore.set({
        ipInfoToken: undefined,
        ipInfoFlagUrl: 'https://f.example/%ip',
      })
      expect(geo.geoEnabled()).toBe(true)
    })
  })

  describe('lookupFlag', () => {
    it('未启用时返回 null 且不发起请求', async () => {
      const { geo } = await freshGeo()
      await expect(geo.lookupFlag('1.2.3.4')).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('token 模式请求 ipinfo country 接口，响应 trim 后转小写两位码', async () => {
      const { configStore, geo } = await freshGeo()
      configStore.set({ ipInfoToken: 'TOK' })
      fetchMock.mockImplementation(() => okResponse(' US\n'))

      await expect(geo.lookupFlag('1.2.3.4')).resolves.toBe('us')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://ipinfo.io/1.2.3.4/country?token=TOK',
      )
    })

    it('自定义 flagUrl 展开全部占位符：%ip %lang %hostname %host %protocol %navlang', async () => {
      // jsdom 默认页面为 http://localhost:3000/
      localStorage.setItem('twc.lang', 'zh-CN')
      const { configStore, geo } = await freshGeo()
      configStore.set({
        ipInfoFlagUrl: '%protocol//%hostname/%lang/%ip?nav=%navlang&host=%host',
      })
      fetchMock.mockImplementation(() => okResponse('CN'))

      await geo.lookupFlag('8.8.4.4')
      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://localhost/zh-CN/8.8.4.4?nav=en-US&host=localhost:3000',
      )
    })

    it('同一 IP 命中缓存，第二次调用不再发请求', async () => {
      const { configStore, geo } = await freshGeo()
      configStore.set({ ipInfoToken: 'TOK' })
      fetchMock.mockImplementation(() => okResponse('JP'))

      await geo.lookupFlag('5.6.7.8')
      await geo.lookupFlag('5.6.7.8')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('响应非 2xx 返回 null，且失败结果同样入缓存（不重复请求）', async () => {
      const { configStore, geo } = await freshGeo()
      configStore.set({ ipInfoToken: 'TOK' })
      fetchMock.mockImplementation(() => ({
        ok: false,
        status: 500,
        text: () => Promise.resolve('err'),
      }))

      await expect(geo.lookupFlag('9.9.9.9')).resolves.toBeNull()
      await expect(geo.lookupFlag('9.9.9.9')).resolves.toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('网络异常（fetch reject）返回 null 而非抛出', async () => {
      const { configStore, geo } = await freshGeo()
      configStore.set({ ipInfoToken: 'TOK' })
      fetchMock.mockImplementation(() => {
        throw new TypeError('network down')
      })

      await expect(geo.lookupFlag('1.1.1.1')).resolves.toBeNull()
    })
  })

  describe('lookupDetail', () => {
    it('仅配置 token 未配置 detailUrl 时返回 null，不发请求', async () => {
      const { configStore, geo } = await freshGeo()
      configStore.set({ ipInfoToken: 'TOK' })

      await expect(geo.lookupDetail('2.2.2.2')).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('归属地功能整体未启用（无 token 无 flagUrl）时返回 null', async () => {
      const { configStore, geo } = await freshGeo()
      configStore.set({ ipInfoDetailUrl: 'https://geo.example/%ip' })

      await expect(geo.lookupDetail('4.4.4.4')).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('配置后展开 URL、返回 trim 文本并缓存', async () => {
      localStorage.setItem('twc.lang', 'en')
      const { configStore, geo } = await freshGeo()
      configStore.set({
        ipInfoToken: 'TOK',
        ipInfoDetailUrl: 'https://geo.example/%ip?lang=%lang',
      })
      fetchMock.mockImplementation(() => okResponse('  California, US\n'))

      await expect(geo.lookupDetail('3.3.3.3')).resolves.toBe('California, US')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://geo.example/3.3.3.3?lang=en',
      )

      await geo.lookupDetail('3.3.3.3')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('flagSrc', () => {
    it('生成 BASE_URL 下的旗帜资源路径（vitest 中 BASE_URL 为 /，构建时为 ./）', async () => {
      const { geo } = await freshGeo()
      expect(geo.flagSrc('us')).toBe('/assets/flags/us.png')
    })
  })
})
