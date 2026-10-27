// 系统配置 — 1:1 移植原项目 system.config（localStorage 持久化）
import { createStore, useStore } from './store'

export interface UserLabel {
  name: string
  description?: string
  color: string
}

export interface SystemConfig {
  autoReload: boolean
  reloadStep: number
  pageSize: number
  pagination: boolean
  pageList: number[]
  defaultSelectNode: string
  autoExpandAttribute: boolean
  defaultLang: string
  foldersShow: boolean
  theme: string
  showBTServers: boolean
  nav: { servers: boolean; folders: boolean; statistics: boolean; labels: boolean }
  labels: UserLabel[]
  labelMaps: Record<string, number[]>
  hideSubfolders: boolean
  simpleCheckMode: boolean
  ignoreVersion: string[]
}

const DEFAULT_CONFIG: SystemConfig = {
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

const CONFIG_KEY = 'transmission-web-control.system'
const DICTIONARY_KEY = 'dictionary.folders'

function load(): SystemConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...parsed, nav: { ...DEFAULT_CONFIG.nav, ...(parsed.nav || {}) } }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export const configStore = createStore<SystemConfig>(load())

export function saveConfig(patch?: Partial<SystemConfig>) {
  if (patch) configStore.set(patch)
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configStore.get()))
}

/** 用户自定义目录字典（原 dictionary.folders） */
export function getFolderDictionary(): string[] {
  const raw = localStorage.getItem(DCTIONARY_SAFE())
  if (!raw) return []
  return raw.split('\n').filter(Boolean)
}

function DCTIONARY_SAFE() {
  return DICTIONARY_KEY
}

export function setFolderDictionary(dirs: string[]) {
  localStorage.setItem(DICTIONARY_KEY, dirs.join('\n'))
}

export function useConfig() {
  return useStore(configStore)
}

/* ---------------- 用户表格列设置 ---------------- */

export interface ColumnSetting {
  field: string
  width: number
  hidden?: boolean
}

export interface UserConfig {
  torrentList: {
    fields: ColumnSetting[]
    sortName: string | null
    sortOrder: 'asc' | 'desc'
  }
}

const USER_CONFIG_KEY = 'transmission-web-control'

export function loadUserConfig(): UserConfig {
  try {
    const raw = localStorage.getItem(USER_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { torrentList: { fields: [], sortName: null, sortOrder: 'asc' } }
}

export function saveUserConfig(cfg: UserConfig) {
  localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(cfg))
}

export const userConfigStore = createStore<UserConfig>(loadUserConfig())
export function persistUserConfig(patch?: Partial<UserConfig>) {
  if (patch) userConfigStore.set(patch)
  saveUserConfig(userConfigStore.get())
}
