// 轻量外部存储 — 基于 useSyncExternalStore 的极简 store
import { useSyncExternalStore } from 'react'

export function createStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch: Partial<T> | ((prev: T) => Partial<T>)) {
      const p = typeof patch === 'function' ? patch(state) : patch
      state = { ...state, ...p }
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export function useStore<T extends object>(store: {
  get: () => T
  subscribe: (l: () => void) => () => void
}): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
