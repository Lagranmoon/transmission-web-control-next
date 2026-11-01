// UI 交互状态测试：对话框栈、toast 计时移除、批量进度、订阅 hook
// uiStore/toastSeq/toastTimers 都是模块级单例，
// 每个用例 resetModules 后动态 import，拿到干净的初始状态
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

function importUi() {
  vi.resetModules()
  return import('./ui')
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('uiStore 初始默认值', () => {
  it('全新模块的 state 为文档默认值', async () => {
    const ui = await importUi()
    expect(ui.uiStore.get()).toEqual({
      currentTorrentId: 0,
      checkedIds: [],
      currentNodeId: null,
      searchKey: '',
      attributeExpanded: false,
      statusPanelExpanded: false,
      navWidth: 288,
      attributeHeight: 260,
      dialogs: [],
      toasts: [],
    })
  })
})

describe('对话框栈 openDialog / closeDialog', () => {
  it('openDialog 压栈并携带 props', async () => {
    const ui = await importUi()
    const props = { torrentId: 7 }
    ui.openDialog('torrent-detail', props)
    expect(ui.uiStore.get().dialogs).toEqual([{ id: 'torrent-detail', props }])
  })

  it('相同 id 重复打开被忽略：栈不变且不触发订阅者', async () => {
    const ui = await importUi()
    const listener = vi.fn()
    ui.uiStore.subscribe(listener)
    ui.openDialog('add')
    ui.openDialog('add', { force: true })
    expect(ui.uiStore.get().dialogs).toEqual([{ id: 'add', props: undefined }])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('多个不同 id 按打开顺序入栈', async () => {
    const ui = await importUi()
    ui.openDialog('a')
    ui.openDialog('b')
    ui.openDialog('c')
    expect(ui.uiStore.get().dialogs.map((d) => d.id)).toEqual(['a', 'b', 'c'])
  })

  it('closeDialog(id) 只移除指定项，其余保持顺序', async () => {
    const ui = await importUi()
    ui.openDialog('a')
    ui.openDialog('b')
    ui.openDialog('c')
    ui.closeDialog('b')
    expect(ui.uiStore.get().dialogs.map((d) => d.id)).toEqual(['a', 'c'])
  })

  it('closeDialog() 无参弹出栈顶（最后打开的）', async () => {
    const ui = await importUi()
    ui.openDialog('a')
    ui.openDialog('b')
    ui.closeDialog()
    expect(ui.uiStore.get().dialogs.map((d) => d.id)).toEqual(['a'])
  })

  it('空栈时 closeDialog() 与 closeDialog(未知 id) 都不抛错且保持空栈', async () => {
    const ui = await importUi()
    expect(() => ui.closeDialog()).not.toThrow()
    expect(ui.uiStore.get().dialogs).toEqual([])
    expect(() => ui.closeDialog('nope')).not.toThrow()
    expect(ui.uiStore.get().dialogs).toEqual([])
  })
})

describe('showToast', () => {
  it('追加 toast 且 id 递增唯一', async () => {
    const ui = await importUi()
    vi.useFakeTimers()
    ui.showToast('第一条')
    ui.showToast('第二条')
    expect(
      ui.uiStore.get().toasts.map((t) => ({ id: t.id, text: t.text })),
    ).toEqual([
      { id: 1, text: '第一条' },
      { id: 2, text: '第二条' },
    ])
  })

  it('默认 2500ms 后自动移除', async () => {
    const ui = await importUi()
    vi.useFakeTimers()
    ui.showToast('已开始')
    vi.advanceTimersByTime(2499)
    expect(ui.uiStore.get().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(ui.uiStore.get().toasts).toEqual([])
  })

  it('自定义 ms 在到期前保留、到期即移除', async () => {
    const ui = await importUi()
    vi.useFakeTimers()
    ui.showToast('快闪', 100)
    vi.advanceTimersByTime(99)
    expect(ui.uiStore.get().toasts.map((t) => t.text)).toEqual(['快闪'])
    vi.advanceTimersByTime(1)
    expect(ui.uiStore.get().toasts).toEqual([])
  })

  it('多条 toast 各自独立计时，先到期先移除', async () => {
    const ui = await importUi()
    vi.useFakeTimers()
    ui.showToast('短', 1000)
    ui.showToast('长', 3000)
    vi.advanceTimersByTime(1000)
    expect(ui.uiStore.get().toasts.map((t) => t.text)).toEqual(['长'])
    vi.advanceTimersByTime(2000)
    expect(ui.uiStore.get().toasts).toEqual([])
  })
})

describe('批量进度 progressStore', () => {
  it('showProgress 设置文案，hideProgress 清空', async () => {
    const ui = await importUi()
    ui.showProgress('正在处理 3 个种子…')
    expect(ui.progressStore.get().text).toBe('正在处理 3 个种子…')
    ui.hideProgress()
    expect(ui.progressStore.get().text).toBe('')
  })
})

describe('订阅 hook', () => {
  it('useUi 响应 openDialog 重渲染出新对话框', async () => {
    const ui = await importUi()
    const { result } = renderHook(() => ui.useUi())
    expect(result.current.dialogs).toEqual([])
    act(() => {
      ui.openDialog('detail')
    })
    expect(result.current.dialogs).toEqual([{ id: 'detail', props: undefined }])
  })

  it('useProgress 响应 showProgress / hideProgress', async () => {
    const ui = await importUi()
    const { result } = renderHook(() => ui.useProgress())
    expect(result.current.text).toBe('')
    act(() => {
      ui.showProgress('移动中…')
    })
    expect(result.current.text).toBe('移动中…')
    act(() => {
      ui.hideProgress()
    })
    expect(result.current.text).toBe('')
  })
})
