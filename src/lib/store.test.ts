// createStore 纯逻辑 + useStore 订阅行为测试（jsdom + @testing-library/react）
// 注意：vitest 未开 globals，RTL 不会自动注册 cleanup，需手动 afterEach(cleanup)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createStore, useStore } from './store'

afterEach(cleanup)

interface State {
  a: number
  b: string
  nested: { x: number }
}

function makeStore() {
  return createStore<State>({ a: 1, b: 'one', nested: { x: 10 } })
}

describe('createStore', () => {
  it('get 返回初始状态', () => {
    const store = makeStore()
    expect(store.get()).toEqual({ a: 1, b: 'one', nested: { x: 10 } })
  })

  it('set 对象补丁浅合并：覆盖指定键、保留其余键、嵌套对象整体替换', () => {
    const store = makeStore()
    store.set({ a: 2 })
    expect(store.get().a).toBe(2)
    expect(store.get().b).toBe('one')
    expect(store.get().nested).toEqual({ x: 10 })

    const replacement = { x: 99 }
    store.set({ nested: replacement })
    expect(store.get().nested).toBe(replacement) // 浅合并：不做深合并
  })

  it('set 函数补丁以上一状态为入参，返回值参与合并', () => {
    const store = makeStore()
    let seen: State | undefined
    store.set((prev) => {
      seen = prev
      return { b: prev.b + '!' }
    })
    expect(seen).toEqual({ a: 1, b: 'one', nested: { x: 10 } })
    expect(store.get().b).toBe('one!')
    expect(store.get().a).toBe(1) // 未返回的键保持不变
  })

  it('set 产生新引用（不可变更新），旧状态内容不变', () => {
    const store = makeStore()
    const before = store.get()
    store.set({ a: 2 })
    expect(store.get()).not.toBe(before)
    expect(before.a).toBe(1)
  })

  it('set 时通知订阅者一次，退订后不再通知', () => {
    const store = makeStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set({ a: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.set({ a: 3 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('useStore', () => {
  it('初始渲染返回当前 state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useStore(store))
    expect(result.current).toEqual({ a: 1, b: 'one', nested: { x: 10 } })
  })

  it('store.set 后重渲染并拿到新 state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useStore(store))
    act(() => {
      store.set({ a: 5, b: 'five' })
    })
    expect(result.current).toEqual({ a: 5, b: 'five', nested: { x: 10 } })
  })

  it('多个消费者共享同一 store 并同步更新', () => {
    const store = createStore<{ count: number }>({ count: 0 })
    const first = renderHook(() => useStore(store))
    const second = renderHook(() => useStore(store))
    act(() => {
      store.set({ count: 2 })
    })
    expect(first.result.current.count).toBe(2)
    expect(second.result.current.count).toBe(2)
  })
})
