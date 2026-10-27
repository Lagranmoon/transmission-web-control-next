// UI 交互状态：当前选中/勾选的种子、当前导航节点、打开的对话框、面板尺寸等
import { createStore, useStore } from './store'

export interface DialogSpec {
  id: string
  props?: Record<string, unknown>
}

export interface UiState {
  /** 当前选中的种子（单选，用于详情面板） */
  currentTorrentId: number
  /** 勾选的种子（多选，用于批量操作） */
  checkedIds: number[]
  /** 当前导航树节点 id */
  currentNodeId: string | null
  /** 搜索关键字（生成 search-result 节点时用） */
  searchKey: string
  /** 详情面板是否展开 */
  attributeExpanded: boolean
  /** 左侧状态面板是否展开 */
  statusPanelExpanded: boolean
  /** 布局尺寸（持久化到 config.ui.status 的等价物） */
  navWidth: number
  attributeHeight: number
  /** 已打开对话框（栈） */
  dialogs: DialogSpec[]
  /** toast 提示 */
  toast: string | null
}

export const uiStore = createStore<UiState>({
  currentTorrentId: 0,
  checkedIds: [],
  currentNodeId: null,
  searchKey: '',
  attributeExpanded: false,
  statusPanelExpanded: false,
  navWidth: 288,
  attributeHeight: 260,
  dialogs: [],
  toast: null,
})

export function useUi() {
  return useStore(uiStore)
}

export function openDialog(id: string, props?: Record<string, unknown>) {
  const { dialogs } = uiStore.get()
  if (dialogs.some((d) => d.id === id)) return
  uiStore.set({ dialogs: [...dialogs, { id, props }] })
}

export function closeDialog(id?: string) {
  const { dialogs } = uiStore.get()
  uiStore.set({ dialogs: id ? dialogs.filter((d) => d.id !== id) : dialogs.slice(0, -1) })
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
export function showToast(text: string, ms = 2500) {
  uiStore.set({ toast: text })
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => uiStore.set({ toast: null }), ms)
}
