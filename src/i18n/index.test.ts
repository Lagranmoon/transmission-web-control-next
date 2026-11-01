// i18n 结构测试 — en.json 与 zh_CN.json 的叶子 key 集合必须完全一致（漏翻会在此暴露），
// 另覆盖 getLangPack 深合并、resolveLang 归一化与 getTimeUnits
import { beforeEach, describe, expect, it } from 'vitest'
import en from './en.json'
import zhCN from './zh_CN.json'
import { getLangPack, getTimeUnits, resolveLang } from './index'
import { getTotalTime } from '../lib/format'

type LeafMap = Map<string, string>

/** 递归收集叶子节点（非对象值），key 为点号路径 */
function collectLeaves(
  node: unknown,
  prefix = '',
  out: LeafMap = new Map(),
): LeafMap {
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      collectLeaves(value, prefix ? `${prefix}.${key}` : key, out)
    }
  } else {
    out.set(prefix, String(node))
  }
  return out
}

const enLeaves = collectLeaves(en)
const zhLeaves = collectLeaves(zhCN)

describe('语言包结构（en vs zh_CN）', () => {
  it('叶子 key 集合完全一致：双向差集均为空（防单侧加键漏翻）', () => {
    const onlyInEn = [...enLeaves.keys()].filter((k) => !zhLeaves.has(k))
    const onlyInZh = [...zhLeaves.keys()].filter((k) => !enLeaves.has(k))
    expect(onlyInEn).toEqual([])
    expect(onlyInZh).toEqual([])
  })

  it('所有叶子均为非空字符串，且规模合理（防整包被清空后平凡相等）', () => {
    expect(enLeaves.size).toBeGreaterThan(100)
    expect(zhLeaves.size).toBe(enLeaves.size)
    for (const [key, value] of enLeaves)
      expect(value, `en.json → ${key}`).toBeTruthy()
    for (const [key, value] of zhLeaves)
      expect(value, `zh_CN.json → ${key}`).toBeTruthy()
  })
})

describe('getLangPack', () => {
  it('en 与未支持语言均返回 en 基础包本身', () => {
    expect(getLangPack('en')).toBe(en)
    expect(getLangPack('fr')).toBe(en)
  })

  it('zh-CN 深合并后 key 集合与 en 一致、全部有值，且译文确实覆盖了 en 值', () => {
    const pack = getLangPack('zh-CN')
    const packLeaves = collectLeaves(pack)
    expect(packLeaves.size).toBe(enLeaves.size)
    expect([...packLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort())

    let overridden = 0
    for (const [key, value] of enLeaves) {
      expect(packLeaves.get(key), key).toBeTruthy()
      if (packLeaves.get(key) !== value) overridden++
    }
    expect(overridden).toBeGreaterThan(50)
  })

  it('覆盖抽查：system.title 与顶层 name 为中文包取值', () => {
    const pack = getLangPack('zh-CN')
    expect(pack.system.title).toBe('Transmission WEB 控制器')
    expect(pack.name).toBe('zh-CN')
  })
})

describe('resolveLang', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('显式偏好归一化大小写：zh-cn → zh-CN 并写回 localStorage', () => {
    expect(resolveLang('zh-cn')).toBe('zh-CN')
    expect(localStorage.getItem('twc.lang')).toBe('zh-CN')
  })

  it('未支持的语言一律回退 en', () => {
    expect(resolveLang('en-GB')).toBe('en')
    expect(resolveLang('fr-FR')).toBe('en')
  })

  it('无显式偏好时读 localStorage 中的上次选择', () => {
    localStorage.setItem('twc.lang', 'zh-CN')
    expect(resolveLang()).toBe('zh-CN')
  })

  it('无任何偏好时用 navigator.language（jsdom 默认 en-US），归一化后回退 en 并写回', () => {
    expect(resolveLang()).toBe('en')
    expect(localStorage.getItem('twc.lang')).toBe('en')
  })
})

describe('getTimeUnits', () => {
  it('中文界面用 天/小时/分/秒，其余语言用 d/h/m/s', () => {
    expect(getTimeUnits('zh-CN')).toEqual({
      d: '天',
      h: '小时',
      m: '分',
      s: '秒',
    })
    expect(getTimeUnits('en')).toEqual({ d: 'd', h: 'h', m: 'm', s: 's' })
  })

  it('与 getTotalTime 组合输出中文时长', () => {
    expect(getTotalTime(90061000, getTimeUnits('zh-CN'))).toBe(
      '1天 1小时 1分 1秒',
    )
  })
})
