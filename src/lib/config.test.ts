// 配置持久化测试：localStorage 读写与默认值合并
// configStore/userConfigStore 是模块级单例（import 时读 localStorage 初始化），
// 每个用例 resetModules 后动态 import，模拟"全新页面加载"的场景
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Config from './config'

const CONFIG_KEY = 'transmission-web-control.system'
const DICTIONARY_KEY = 'dictionary.folders'
const USER_CONFIG_KEY = 'transmission-web-control'

// 与源码 DEFAULT_CONFIG 保持一致的契约快照（1:1 移植原项目 system.config）
const DEFAULT_CONFIG = {
  autoReload: true,
  reloadStep: 5000,
  pageSize: 200,
  pagination: true,
  pageList: [10, 20, 30, 40, 50, 100, 150, 200, 250, 300, 5000],
  defaultSelectNode: 'actively',
  autoExpandAttribute: false,
  defaultLang: '',
  foldersShow: false,
  theme: 'default',
  showBTServers: false,
  nav: { servers: true, folders: true, statistics: true, labels: false },
  labels: [],
  labelMaps: {},
  hideSubfolders: false,
  simpleCheckMode: false,
  ignoreVersion: [],
}

const DEFAULT_USER_CONFIG = {
  torrentList: { fields: [], sortName: null, sortOrder: 'asc' },
}

function importConfig(): Promise<typeof Config> {
  vi.resetModules()
  return import('./config')
}

function seed(key: string, raw: unknown) {
  localStorage.setItem(key, typeof raw === 'string' ? raw : JSON.stringify(raw))
}

beforeEach(() => {
  localStorage.clear()
})

describe('configStore 初始化（localStorage → 默认值合并）', () => {
  it('空 localStorage 时使用完整默认配置，且 load 阶段不写回', async () => {
    const cfg = await importConfig()
    expect(cfg.configStore.get()).toEqual(DEFAULT_CONFIG)
    expect(localStorage.getItem(CONFIG_KEY)).toBeNull()
  })

  it('部分覆盖：存储字段生效，缺失字段回退默认', async () => {
    seed(CONFIG_KEY, {
      pageSize: 30,
      pagination: false,
      defaultSelectNode: 'paused',
    })
    const cfg = await importConfig()
    expect(cfg.configStore.get()).toEqual({
      ...DEFAULT_CONFIG,
      pageSize: 30,
      pagination: false,
      defaultSelectNode: 'paused',
    })
  })

  it('nav 嵌套对象逐字段合并；非对象 nav 回退整组默认', async () => {
    seed(CONFIG_KEY, { nav: { servers: false } })
    let cfg = await importConfig()
    expect(cfg.configStore.get().nav).toEqual({
      servers: false,
      folders: true,
      statistics: true,
      labels: false,
    })

    localStorage.clear()
    seed(CONFIG_KEY, { nav: 42 })
    cfg = await importConfig()
    expect(cfg.configStore.get().nav).toEqual(DEFAULT_CONFIG.nav)
  })

  it('顶层损坏 JSON 回退默认且不抛错', async () => {
    seed(CONFIG_KEY, '{"pageSize": 30,') // 故意截断的非法 JSON
    const cfg = await importConfig()
    expect(cfg.configStore.get()).toEqual(DEFAULT_CONFIG)
  })

  it('数组/对象/可选字段覆盖后原样保留', async () => {
    const labels = [{ name: '电影', description: '影视类', color: '#ff0000' }]
    seed(CONFIG_KEY, {
      labels,
      labelMaps: { 电影: [1, 2] },
      ignoreVersion: ['4.10'],
      ipInfoToken: 'tok',
    })
    const cfg = await importConfig()
    expect(cfg.configStore.get().labels).toEqual(labels)
    expect(cfg.configStore.get().labelMaps).toEqual({ 电影: [1, 2] })
    expect(cfg.configStore.get().ignoreVersion).toEqual(['4.10'])
    expect(cfg.configStore.get().ipInfoToken).toBe('tok')
  })
})

describe('saveConfig', () => {
  it('带 patch：合并进 store 并把合并后的完整状态写回 localStorage', async () => {
    const cfg = await importConfig()
    cfg.saveConfig({ pageSize: 77 })
    expect(cfg.configStore.get().pageSize).toBe(77)
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY)!)).toEqual({
      ...DEFAULT_CONFIG,
      pageSize: 77,
    })
  })

  it('不带 patch：仅持久化当前 store 状态，不改变任何值', async () => {
    const cfg = await importConfig()
    cfg.configStore.set({ theme: 'dark' })
    cfg.saveConfig()
    expect(cfg.configStore.get()).toEqual({ ...DEFAULT_CONFIG, theme: 'dark' })
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY)!)).toEqual(
      cfg.configStore.get(),
    )
  })

  it('持久化后重新加载模块可完整还原（模拟刷新页面）', async () => {
    let cfg = await importConfig()
    cfg.saveConfig({
      pageSize: 77,
      nav: { servers: false, folders: true, statistics: true, labels: true },
    })

    cfg = await importConfig()
    expect(cfg.configStore.get().pageSize).toBe(77)
    expect(cfg.configStore.get().nav).toEqual({
      servers: false,
      folders: true,
      statistics: true,
      labels: true,
    })
    expect(cfg.configStore.get().theme).toBe('default') // 未改过的字段仍是默认
  })
})

describe('目录字典 getFolderDictionary / setFolderDictionary', () => {
  it('无存储时返回空数组', async () => {
    const cfg = await importConfig()
    expect(cfg.getFolderDictionary()).toEqual([])
  })

  it('按换行拆分并过滤空行（含首尾换行与连续空行）', async () => {
    seed(DICTIONARY_KEY, '/downloads\n\n/movies\n/series\n')
    const cfg = await importConfig()
    expect(cfg.getFolderDictionary()).toEqual([
      '/downloads',
      '/movies',
      '/series',
    ])
  })

  it('set 后可原样读回；空数组存为空串并读回 []', async () => {
    const cfg = await importConfig()
    cfg.setFolderDictionary(['/a', '/b'])
    expect(localStorage.getItem(DICTIONARY_KEY)).toBe('/a\n/b')
    expect(cfg.getFolderDictionary()).toEqual(['/a', '/b'])

    cfg.setFolderDictionary([])
    expect(localStorage.getItem(DICTIONARY_KEY)).toBe('')
    expect(cfg.getFolderDictionary()).toEqual([])
  })
})

describe('loadUserConfig / saveUserConfig', () => {
  it('无存储时返回完整默认', async () => {
    const cfg = await importConfig()
    expect(cfg.loadUserConfig()).toEqual(DEFAULT_USER_CONFIG)
  })

  it('部分存储逐字段合并：torrentList 内层也合并', async () => {
    seed(USER_CONFIG_KEY, {
      torrentList: { sortName: 'name', sortOrder: 'desc' },
    })
    const cfg = await importConfig()
    expect(cfg.loadUserConfig()).toEqual({
      torrentList: { fields: [], sortName: 'name', sortOrder: 'desc' },
    })
  })

  it('损坏 JSON 返回默认且不抛错', async () => {
    seed(USER_CONFIG_KEY, 'not-json{')
    const cfg = await importConfig()
    expect(cfg.loadUserConfig()).toEqual(DEFAULT_USER_CONFIG)
  })

  it('顶层 null 或 torrentList 为 null 均回退默认', async () => {
    seed(USER_CONFIG_KEY, 'null')
    let cfg = await importConfig()
    expect(cfg.loadUserConfig()).toEqual(DEFAULT_USER_CONFIG)

    localStorage.clear()
    seed(USER_CONFIG_KEY, { torrentList: null })
    cfg = await importConfig()
    expect(cfg.loadUserConfig()).toEqual(DEFAULT_USER_CONFIG)
  })

  it('saveUserConfig 后 loadUserConfig 原样读回（含 hidden 列与 null sortName）', async () => {
    const cfg = await importConfig()
    const original = {
      torrentList: {
        fields: [
          { field: 'name', width: 160, hidden: true },
          { field: 'size', width: 90 },
        ],
        sortName: null,
        sortOrder: 'desc' as const,
      },
    }
    cfg.saveUserConfig(original)
    expect(cfg.loadUserConfig()).toEqual(original)
  })
})

describe('userConfigStore / persistUserConfig', () => {
  it('模块初始化时读取已存储的用户配置', async () => {
    seed(USER_CONFIG_KEY, { torrentList: { sortName: 'addedOn' } })
    const cfg = await importConfig()
    expect(cfg.userConfigStore.get().torrentList.sortName).toBe('addedOn')
    expect(cfg.userConfigStore.get().torrentList.sortOrder).toBe('asc')
    expect(cfg.userConfigStore.get().torrentList.fields).toEqual([])
  })

  it('persistUserConfig(patch) 合并进 store 并持久化，可被 loadUserConfig 读回', async () => {
    const cfg = await importConfig()
    cfg.persistUserConfig({
      torrentList: {
        fields: [{ field: 'size', width: 90, hidden: true }],
        sortName: 'size',
        sortOrder: 'desc',
      },
    })
    expect(cfg.userConfigStore.get().torrentList.sortName).toBe('size')
    const stored = JSON.parse(
      localStorage.getItem(USER_CONFIG_KEY)!,
    ) as Config.UserConfig
    expect(stored.torrentList.sortName).toBe('size')
    expect(cfg.loadUserConfig().torrentList.fields).toEqual([
      { field: 'size', width: 90, hidden: true },
    ])
  })

  it('persistUserConfig() 无参时持久化 store 当前状态', async () => {
    const cfg = await importConfig()
    cfg.userConfigStore.set({
      torrentList: { fields: [], sortName: 'name', sortOrder: 'desc' },
    })
    cfg.persistUserConfig()
    expect(cfg.loadUserConfig()).toEqual({
      torrentList: { fields: [], sortName: 'name', sortOrder: 'desc' },
    })
  })
})
