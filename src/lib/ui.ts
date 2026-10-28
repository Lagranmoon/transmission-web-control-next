// UI 交互状态：当前选中/勾选的种子、当前导航节点、打开的对话框、面板尺寸等
import { createStore, useStore } from './store'

export interface DialogSpec {
  id: string
  props?: Record<string, unknown>
}

/** toast 条目（多条堆叠，各自独立计时） */
export interface ToastItem {
  id: number
  text: string
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
  /** toast 提示（多条堆叠，由 RootLayout 的 ToastHost 渲染） */
  toasts: ToastItem[]
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
  toasts: [],
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

/* ---------------- toast（视口顶部居中浮层，多条堆叠） ---------------- */
let toastSeq = 0
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()

/** 接口与原版一致：showToast(text, ms)；内部改为多条堆叠、各自到期自动移除 */
export function showToast(text: string, ms = 2500) {
  const id = ++toastSeq
  const { toasts } = uiStore.get()
  uiStore.set({ toasts: [...toasts, { id, text }] })
  const timer = setTimeout(() => {
    toastTimers.delete(id)
    uiStore.set({ toasts: uiStore.get().toasts.filter((t) => t.id !== id) })
  }, ms)
  toastTimers.set(id, timer)
}

/* ---------------- 批量操作进度浮层（右下角轻量提示） ---------------- */
interface ProgressState {
  /** 显示中的文案；空串表示无任务 */
  text: string
}

export const progressStore = createStore<ProgressState>({ text: '' })

/** 显示批量进度文案（如「正在处理 N 个种子…」） */
export function showProgress(text: string) {
  progressStore.set({ text })
}

/** 清除批量进度浮层 */
export function hideProgress() {
  progressStore.set({ text: '' })
}

export function useProgress() {
  return useStore(progressStore)
}
