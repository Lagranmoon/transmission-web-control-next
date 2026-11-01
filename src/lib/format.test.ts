// format.ts 纯函数单元测试 — 边界值与等价类（在原冒烟用例基础上补充单位阈值、舍入边界、编码回退等）
// 约定：src/**/*.test.ts，显式 import，不用 globals
import { describe, expect, it } from 'vitest'
import {
  compareField,
  deepMerge,
  formatLongTime,
  formatSize,
  getGrayLevel,
  getHostName,
  getTotalTime,
  uniq,
  validTreeKey,
} from './format'

describe('formatSize', () => {
  it('0 字节默认显示 "0.00"，speed 追加 /s，zeroToEmpty 返回空串', () => {
    expect(formatSize(0)).toBe('0.00')
    expect(formatSize(0, false, 'speed')).toBe('0.00 KB/s')
    expect(formatSize(0, true)).toBe('')
  })

  it('undefined 等同 0 处理', () => {
    expect(formatSize(undefined)).toBe('0.00')
  })

  it('zeroToEmpty 优先于 speed 后缀', () => {
    expect(formatSize(0, true, 'speed')).toBe('')
  })

  it('按 1024 进制换算 KB / MB / GB', () => {
    expect(formatSize(1024 * 1.5)).toBe('1.50 KB')
    expect(formatSize(1048576 * 2)).toBe('2.00 MB')
    expect(formatSize(1073741824 * 3)).toBe('3.00 GB')
  })

  // 移植自原版的阈值是 1000×1024^n 而非 1024^n：恰好压线即进位，压线下界留在本位
  it('单位阈值取 1000×1024^n：压线值进位且显示 0.98，压线下界显示 1,000.00', () => {
    expect(formatSize(1000 * 1024 - 1)).toBe('1,000.00 KB')
    expect(formatSize(1000 * 1024)).toBe('0.98 MB')
    expect(formatSize(1000 * 1073741824 - 1)).toBe('1,000.00 GB')
    expect(formatSize(1000 * 1073741824)).toBe('0.98 TB')
    expect(formatSize(1000 * 1099511627776)).toBe('0.98 PB')
  })

  it('超出 TB 阈值走 PB 分支，大值带千分位', () => {
    expect(formatSize(1125899906842624 * 1.5)).toBe('1.50 PB')
    // KB/MB/GB/TB 分支上限均为 1,000.00，千分位大值只会出现在 PB 分支
    expect(formatSize(1500 * 1125899906842624)).toBe('1,500.00 PB')
  })

  it('speed 后缀：非零值换算后追加 /s', () => {
    expect(formatSize(1500, false, 'speed')).toBe('1.46 KB/s')
  })

  it('负数不特判：落在 KB 分支照常换算（记录现状）', () => {
    expect(formatSize(-1)).toBe('-0.00 KB')
    expect(formatSize(-2048)).toBe('-2.00 KB')
  })
})

describe('formatLongTime', () => {
  it('0、负数、undefined 返回空串', () => {
    expect(formatLongTime(0)).toBe('')
    expect(formatLongTime(-1)).toBe('')
    expect(formatLongTime(undefined)).toBe('')
  })

  it('输出补零的 yyyy-mm-dd hh:mm:ss，且按本地时区解析回原时刻', () => {
    const t = 1735689600 // 2025-01-01T00:00:00Z，取值本身与本地时区无关
    const s = formatLongTime(t)
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    // 'yyyy-mm-dd hh:mm:ss' 改写为 ISO 无时区形式后按本地时区解析，应还原同一 unix 秒
    expect(Math.round(new Date(s.replace(' ', 'T')).getTime() / 1000)).toBe(t)
  })
})

describe('getTotalTime', () => {
  it('按天/时/分/秒拼接并去首尾空格', () => {
    expect(getTotalTime(90061000)).toBe('1d 1h 1m 1s')
  })

  it('0 或不足 1 秒返回空串', () => {
    expect(getTotalTime(0)).toBe('')
    expect(getTotalTime(400)).toBe('')
  })

  // 秒数用 Math.round：499ms 舍去、500ms 进位到整秒
  it('毫秒舍入边界：500ms 显示 1s，499ms 被舍去', () => {
    expect(getTotalTime(500)).toBe('1s')
    expect(getTotalTime(499)).toBe('')
  })

  it('59.999s 舍入为 60s，60s 进位为 1m（Math.round 不向分钟借位的现状）', () => {
    expect(getTotalTime(59999)).toBe('60s')
    expect(getTotalTime(60000)).toBe('1m')
  })

  it('恰好一天与一天多一秒：中间为 0 的段被跳过', () => {
    expect(getTotalTime(86400000)).toBe('1d')
    expect(getTotalTime(86401000)).toBe('1d 1s')
  })

  it('自定义单位随语言变化', () => {
    expect(
      getTotalTime(90061000, { d: '天', h: '小时', m: '分', s: '秒' }),
    ).toBe('1天 1小时 1分 1秒')
  })
})

describe('getHostName', () => {
  it('提取 URL 主机名并去掉端口', () => {
    expect(getHostName('http://192.168.1.10:9091/transmission/rpc')).toBe(
      '192.168.1.10',
    )
    expect(getHostName('https://tracker.example.com/announce')).toBe(
      'tracker.example.com',
    )
  })

  it('非 URL 输入原样返回', () => {
    expect(getHostName('localhost')).toBe('localhost')
  })

  it('无协议头但带端口的主机串按整串处理后再剥端口', () => {
    expect(getHostName('example.com:9091')).toBe('example.com')
  })

  it('IPv6 字面量在首个冒号处被截断（1:1 移植的已知行为，见 skipped 记录）', () => {
    expect(getHostName('http://[::1]:9091/rpc')).toBe('[')
  })
})

describe('getGrayLevel', () => {
  it('黑为 0，白接近 1（浮点误差用 toBeCloseTo）', () => {
    expect(getGrayLevel('#000000')).toBe(0)
    expect(getGrayLevel('#ffffff')).toBeCloseTo(1)
  })

  it('非法输入返回 0', () => {
    expect(getGrayLevel('')).toBe(0)
    expect(getGrayLevel('not-a-color')).toBe(0)
  })

  it('3 位短写等价 6 位展开；大小写与缺 # 均合法', () => {
    expect(getGrayLevel('#abc')).toBe(getGrayLevel('#aabbcc'))
    expect(getGrayLevel('#FFFFFF')).toBe(getGrayLevel('ffffff'))
    expect(getGrayLevel('#808080')).toBeCloseTo(128 / 255, 5)
  })

  it('位数不是 3 或 6 的十六进制串非法', () => {
    expect(getGrayLevel('#12345')).toBe(0)
    expect(getGrayLevel('#1234567')).toBe(0)
  })
})

describe('compareField', () => {
  it('升序比较数字字段，null 排最后', () => {
    const rows: Record<string, unknown>[] = [{ n: 3 }, { n: null }, { n: 1 }]
    const sorted = [...rows].sort(compareField('n', 'asc'))
    expect(sorted.map((r) => r.n)).toEqual([1, 3, null])
  })

  it('desc 反转顺序，null 随之排最前（与 asc 镜像）', () => {
    const rows: Record<string, unknown>[] = [{ n: 1 }, { n: null }, { n: 3 }]
    const sorted = [...rows].sort(compareField('n', 'desc'))
    expect(sorted.map((r) => r.n)).toEqual([null, 3, 1])
  })

  it('字符串字段按字典序；混合类型转字符串比较（10 排在 "9" 前）', () => {
    const rows = [{ s: 'b' }, { s: 'a' }]
    expect([...rows].sort(compareField('s', 'asc')).map((r) => r.s)).toEqual([
      'a',
      'b',
    ])

    const mixed: Record<string, unknown>[] = [{ n: 10 }, { n: '9' }]
    expect([...mixed].sort(compareField('n', 'asc')).map((r) => r.n)).toEqual([
      10,
      '9',
    ])
  })

  it('缺失字段等同 null 排最后', () => {
    const rows: Record<string, unknown>[] = [{ n: 2 }, {}, { n: 1 }]
    const sorted = [...rows].sort(compareField('n', 'asc'))
    expect(sorted.map((r) => r.n)).toEqual([1, 2, undefined])
  })
})

describe('validTreeKey', () => {
  it('纯 ASCII 直接 base64 编码', () => {
    expect(validTreeKey('abc')).toBe('YWJj')
  })

  it('非 ASCII 文本先 UTF-8 编码再 base64', () => {
    expect(validTreeKey('中文')).toBe('5Lit5paH')
  })

  it('base64 保留字符 + / = 与 | 一律替换为 0，结果可安全用作 DOM key', () => {
    expect(validTreeKey('???')).toBe('Pz80') // btoa('???') === 'Pz8/'
    expect(validTreeKey('ab')).toBe('YWI0') // btoa('ab') === 'YWI='
    const nasty = 'Torrent/子目录 (2024)+v2='
    expect(validTreeKey(nasty)).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('空串返回空串', () => {
    expect(validTreeKey('')).toBe('')
  })

  it('含孤立代理对（无法 UTF-8 编码）走 fallback：非字母数字替换为 0', () => {
    expect(validTreeKey('a\uD800b')).toBe('a0b')
    expect(validTreeKey('\uD800高')).toBe('00')
  })
})

describe('deepMerge', () => {
  it('嵌套对象递归合并，保留 base 独有键，且不修改 base 本身', () => {
    const base = { a: { x: 1, y: 2 }, keep: 1 }
    const merged = deepMerge(base, { a: { y: 3 } })
    expect(merged).toEqual({ a: { x: 1, y: 3 }, keep: 1 })
    expect(base.a).toEqual({ x: 1, y: 2 })
  })

  it('数组整体替换而非逐项合并', () => {
    expect(deepMerge({ a: [1, 2, 3] }, { a: [9] })).toEqual({ a: [9] })
  })

  it('override 为 null/undefined 时返回 base 本身', () => {
    const base = { a: 1 }
    expect(deepMerge(base, null)).toBe(base)
    expect(deepMerge(base, undefined)).toBe(base)
  })

  it('base 为标量或数组时直接取 override', () => {
    expect(deepMerge(5, 'x')).toBe('x')
    expect(deepMerge([1, 2], [3])).toEqual([3])
  })

  it('override 中显式 undefined 的值不会删除 base 键', () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 })
  })
})

describe('uniq', () => {
  it('去重并保持原顺序', () => {
    expect(uniq(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('空数组与全重复', () => {
    expect(uniq([])).toEqual([])
    expect(uniq([1, 1, 1])).toEqual([1])
  })
})
