// 通用数据表格 — 复刻 EasyUI datagrid 的核心交互：
// 复选列 / 行号 / 排序 / 列宽拖动 / 表头右键显示隐藏列 / 斑马纹 / 分页 / shift 连选
// 结构：单表格 + 粘性表头（thead sticky），表头与表体列宽天然对齐
// 性能：行组件 React.memo + 稳定行引用（数据层保持对象不变），轮询时只重渲染有变化的行；
//       行数超过阈值时对表体窗口化渲染（上下占位 tr 保持滚动条真实，见 C3）
// 可访问性：th aria-sort / 复选框 aria-label / 行 aria-selected（见 C6）
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Pagination, useMenu, type MenuItemSpec } from './ui'

export interface GridColumn<T = Record<string, unknown>> {
  field: string
  title: ReactNode
  width?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  hidden?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 网格 formatter 的 value 为异构字段值，用 unknown 会迫使每个 formatter 定义点加断言
  formatter?: (value: any, row: T) => ReactNode
  checkbox?: boolean
  allowCustom?: boolean
}

/** C3 虚拟滚动参数：固定行高 / 上下缓冲行数 / 启用阈值。
 *  行高恰为 26px 由三处共同保证（评审 C3 修复：长名换行实测 29px、修活样式后 27px，均 ≠ 26 导致占位漂移）：
 *  1) app.css .datagrid-cell 单行省略（nowrap+ellipsis）且自然高度 24px（padding 4px + line-height 16px）；
 *  2) 窗口化行的 tr 与每个单元格 div 由下方内联高度钉死（tr 的 CSS height 只是最小值，需封顶才不超 26）；
 *  3) 窗口起算扣除粘性表头占位高度 headerH（sticky 不脱流，行 i 的内容位置 = headerH + i*行高） */
const VIRTUAL_ROW_HEIGHT = 26
const VIRTUAL_BUFFER = 10
const VIRTUAL_THRESHOLD = 100

/**
 * 列显隐菜单项 — 表头右键与列表头「列设置」按钮（C5）共用同一份逻辑，
 * 保证两处入口弹出完全相同的菜单（均经 useMenu().show 渲染）
 */
// 与组件同文件导出工厂/hook 是刻意的内聚安排，拆分属结构调整；HMR 对该文件回退整页刷新可接受
// eslint-disable-next-line react-refresh/only-export-components -- 工厂函数与组件共用文件
export function makeColumnMenuItems<T extends Record<string, unknown>>(
  columns: GridColumn<T>[],
  onChange?: (cols: GridColumn<T>[]) => void,
): MenuItemSpec[] {
  return columns
    .filter((c) => c.allowCustom !== false)
    .map((c) => ({
      id: `column-${c.field}`,
      text: typeof c.title === 'string' && c.title ? c.title : c.field,
      // 可见列显示勾选图标（等价原先菜单里的复选框）
      icon: c.hidden ? undefined : 'icon-ok',
      onClick: () =>
        onChange?.(
          columns.map((x) =>
            x.field === c.field ? { ...x, hidden: !x.hidden } : x,
          ),
        ),
    }))
}

/** grid-4：列定义签名（字段集合 + 标题，与顺序/宽度/显隐无关）。
 *  宿主每轮渲染重建等价 columns 数组（如 AttributePanel）时签名不变，不会冲掉本地列宽/显隐/排序调整；
 *  字段集合或标题真正变化（如切换语言）时才视为 initial 变更 */
const columnSignature = <T extends Record<string, unknown>>(
  cols: GridColumn<T>[],
) =>
  cols
    .map((c) => `${c.field}:${typeof c.title === 'string' ? c.title : ''}`)
    .sort()
    .join(',')

// eslint-disable-next-line react-refresh/only-export-components -- 自定义 hook 与组件共用文件
export function useColumnState<T extends Record<string, unknown>>(
  initial: GridColumn<T>[],
  persist?: (cols: GridColumn<T>[]) => void,
) {
  const [columns, setColumns] = useState<GridColumn<T>[]>(initial)
  // grid-4：感知 initial 变更 —— 签名相同（等价重建）时保留本地 state，签名变化时采用新 initial
  useEffect(() => {
    setColumns((prev) =>
      columnSignature(prev) === columnSignature(initial) ? prev : initial,
    )
  }, [initial])
  const update = (next: GridColumn<T>[]) => {
    setColumns(next)
    persist?.(next)
  }
  return { columns, update }
}

/**
 * 行内 hover 快捷操作 / 键盘导航所需的少量补充样式。
 * 因组件无法携带独立 CSS 文件，这里内联注入一次（多实例重复注入无副作用）。
 */
const DATAGRID_EXTRA_STYLE = `
/* 键盘导航焦点样式：鼠标点击聚焦不显示轮廓；键盘聚焦用内描边提示（配合全局 :focus-visible 焦点环策略） */
.eu-datagrid-scroll:focus{outline:none}
.eu-datagrid-scroll:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--eu-accent)}
/* C1 行内快捷操作：独立粘性操作列，横向滚动时始终钉在可视区右缘 */
.eu-datagrid td.datagrid-actions-cell{position:sticky;right:0;z-index:1;padding:0;border-right:0;border-left:1px dotted var(--eu-line)}
.eu-datagrid th.datagrid-actions-cell{position:sticky;top:0;right:0;z-index:2;padding:0;border-right:0;border-left:1px dotted var(--eu-line)}
.eu-datagrid td.datagrid-actions-cell .datagrid-row-actions{display:none;align-items:center;gap:2px;padding:2px 3px}
.eu-datagrid .eu-datagrid-row:hover .datagrid-row-actions{display:inline-flex}
.eu-datagrid .datagrid-row-actions .l-btn{height:18px;padding:0 3px;border-color:var(--eu-hover-border)}
`

/** 无 formatter 时的默认单元格文本：等价 String(value ?? '')（空值 → 空串） */
function toCellText(value: unknown): string {
  return String(value)
}

export interface DataGridProps<T> {
  columns: GridColumn<T>[]
  rows: T[]
  keyField: string
  rownumbers?: boolean
  checkedKeys?: Set<string | number>
  onCheck?: (keys: Set<string | number>) => void
  selectedKey?: string | number | null
  onSelect?: (row: T, key: string | number) => void
  sortName?: string | null
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
  onColumnsChange?: (cols: GridColumn<T>[]) => void
  pagination?: boolean
  page?: number
  pageSize?: number
  pageList?: number[]
  onPageChange?: (p: number) => void
  onPageSizeChange?: (s: number) => void
  pagerExtra?: ReactNode
  onRowContextMenu?: (e: React.MouseEvent, row: T, index: number) => void
  emptyText?: string
  maxHeight?: number
  /** B1 键盘导航开关：宿主可在对话框占用时关闭（有输入框焦点时内部会自动跳过） */
  keyboard?: boolean
  /** B1 内置按键（↑/↓/空格/Ctrl+A）之外的按键转发给宿主（Delete/Enter 等） */
  onKeyDown?: (e: React.KeyboardEvent) => void
  /** C1 行 hover 时在行右端浮出的快捷操作（渲染在最后一个单元格内，不占列宽） */
  rowActions?: (row: T) => ReactNode
}

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  rownumbers = false,
  checkedKeys,
  onCheck,
  selectedKey,
  onSelect,
  sortName,
  sortOrder,
  onSort,
  onColumnsChange,
  pagination = false,
  page = 1,
  pageSize = 30,
  pageList,
  onPageChange,
  onPageSizeChange,
  pagerExtra,
  onRowContextMenu,
  emptyText = '',
  maxHeight,
  keyboard = true,
  onKeyDown,
  rowActions,
}: DataGridProps<T>) {
  const { show: showMenu } = useMenu()
  // grid-3：宿主未传 onColumnsChange 时（如 AttributePanel 各网格），列宽拖动与表头右键显隐
  // 退回 useColumnState 本地 state，两个交互不再静默失效；传了回调则仍由宿主全权受控，行为不变
  const localColumns = useColumnState<T>(columns)
  const gridColumns = onColumnsChange ? columns : localColumns.columns
  const changeColumns = (next: GridColumn<T>[]) => {
    if (onColumnsChange) onColumnsChange(next)
    else localColumns.update(next)
  }
  const visibleCols = useMemo(
    () => gridColumns.filter((c) => !c.hidden),
    [gridColumns],
  )
  const [resizeW, setResizeW] = useState<{ field: string; w: number } | null>(
    null,
  )
  // grid-2：拖拽指示按方向区分 —— pos 记录实际落点在目标列之前/之后，与 dropColumn 的 splice 一致
  const [dragOver, setDragOver] = useState<{
    field: string
    pos: 'before' | 'after'
  } | null>(null)
  const dragField = useRef<string | null>(null)
  const lastCheckedRef = useRef<number>(-1)

  // C3 虚拟滚动状态：滚动容器 ref / 垂直滚动位置 / 视口高度 / 粘性表头占位高度
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)
  const [headerH, setHeaderH] = useState(0)

  // 通过 ref 转发最新的回调，保证传给 memo 行组件的函数引用稳定。
  // grid-6：初值改为明确可空类型（渲染期下方统一赋值，调用点经 ?. 保证安全），去掉 no-op 函数强转占位；
  // onCheck 不入 ref —— 勾选逻辑直接用 prop 闭包（toggleRowCheck/checkAllPage），ref 里从未被读取
  const handlersRef = useRef<{
    onSelect?: (row: T, key: string | number) => void
    onRowContextMenu?: (e: React.MouseEvent, row: T, index: number) => void
    rowActions?: (row: T) => ReactNode
    toggleRowCheck: (index: number, row: T, e: { shiftKey: boolean }) => void
  } | null>(null)
  const stableSelect = useCallback((row: T, key: string | number) => {
    handlersRef.current?.onSelect?.(row, key)
  }, [])
  const stableCheck = useCallback(
    (index: number, row: T, e: React.MouseEvent) => {
      handlersRef.current?.toggleRowCheck(index, row, e)
    },
    [],
  )
  const stableContext = useCallback(
    (e: React.MouseEvent, row: T, index: number) => {
      handlersRef.current?.onRowContextMenu?.(e, row, index)
    },
    [],
  )
  // C1 行内快捷操作：稳定引用交给 memo 行组件，内部经 ref 取最新实现
  const stableRowActions = useCallback(
    (row: T) => handlersRef.current?.rowActions?.(row) ?? null,
    [],
  )

  const keyOf = (row: T) => row[keyField] as string | number
  const checked = checkedKeys ?? new Set<string | number>()

  // grid-1 坐标系统一：全局行号（含分页偏移，供行号显示与右键菜单）与页内索引（供勾选连选）
  // 的换算全部收在组件内部，不改宿主传参 —— toggleRowCheck 入口收全局行号，先减偏移还原页内索引
  // 页码收敛统一在网格内完成：宿主未做钳制时（如详情面板各 Tab），
  // 切片与偏移用 safePage，避免 rows 变少后切片越界得到空表而分页器仍显示正常页码
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = pagination ? Math.min(Math.max(page, 1), pageCount) : page
  const pageOffset = pagination ? (safePage - 1) * pageSize : 0
  const pageRows = useMemo(() => {
    if (!pagination) return rows
    return rows.slice(pageOffset, pageOffset + pageSize)
  }, [rows, pagination, pageOffset, pageSize])

  // 页码越界时回写宿主 state，保证下一次数据变化后仍从合法页继续
  useEffect(() => {
    if (pagination && page !== safePage) onPageChange?.(safePage)
  }, [pagination, page, safePage, onPageChange])

  // 翻页/更换每页条数后锚点失效：shift 连选锚点是页内索引，跨页沿用旧锚点会选错区间甚至越界
  useEffect(() => {
    lastCheckedRef.current = -1
  }, [page, pageSize, pagination])

  // C3 窗口化渲染：超过阈值时只渲染可见区间 ± buffer 行，用上下占位 tr 保持滚动条真实。
  // 行 i 的内容位置 = headerH + i*行高（粘性表头在内容流中占位），窗口起算需扣除 headerH，
  // 否则随滚动深度累积约 headerH/行高 ≈ 1 行的定位偏差
  const useWindow = pageRows.length > VIRTUAL_THRESHOLD
  const winStart = useWindow
    ? Math.max(
        0,
        Math.floor((scrollTop - headerH) / VIRTUAL_ROW_HEIGHT) - VIRTUAL_BUFFER,
      )
    : 0
  const winEnd = useWindow
    ? Math.min(
        pageRows.length,
        Math.ceil((scrollTop + viewportH - headerH) / VIRTUAL_ROW_HEIGHT) +
          VIRTUAL_BUFFER,
      )
    : pageRows.length
  const renderedRows = useWindow ? pageRows.slice(winStart, winEnd) : pageRows
  // C1 行内快捷操作列（粘性右缘）宽度
  const ACTIONS_COL_WIDTH = 46
  const hasActions = !!rowActions
  const colCount =
    visibleCols.length + (rownumbers ? 1 : 0) + (hasActions ? 1 : 0)

  // C3 视口/表头高度：挂载时测量 + ResizeObserver 跟踪面板尺寸变化
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      setViewportH(el.clientHeight)
      const th = el.querySelector('thead')
      if (th) setHeaderH(th.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // B1 选中行变化时确保可见（键盘 ↑/↓ 或程序化选中）；窗口化下目标行未渲染时按行高估算滚动
  useEffect(() => {
    if (selectedKey === null || selectedKey === undefined) return
    const container = scrollRef.current
    if (!container) return
    const selector = `tr.eu-datagrid-row[data-key="${CSS.escape(String(selectedKey))}"]`
    const el = container.querySelector<HTMLElement>(selector)
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      return
    }
    if (!useWindow) return
    const idx = pageRows.findIndex((r) => keyOf(r) === selectedKey)
    if (idx < 0) return
    // 行 i 的内容位置 ≈ 表头高 + i*行高；目标行滚动到视口中部便于连续按键
    const liveHeaderH =
      container.querySelector('thead')?.offsetHeight ?? VIRTUAL_ROW_HEIGHT
    container.scrollTop =
      liveHeaderH +
      idx * VIRTUAL_ROW_HEIGHT -
      Math.max(0, (container.clientHeight - VIRTUAL_ROW_HEIGHT) / 2)
    const raf = requestAnimationFrame(() => {
      container
        .querySelector<HTMLElement>(selector)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(raf)
    // 仅在选中变化时执行（pageRows 为渲染期最新闭包，无需作为依赖）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  // shift 连选（键盘空格勾选传入 {shiftKey:false}，与鼠标路径共用同一实现）
  // grid-1：入口统一收全局行号（鼠标路径由 GridRow 原样传出、空格路径补上分页偏移），
  // 换算回页内索引后再走 shift 区间循环；lastCheckedRef 只存页内坐标，鼠标/键盘两套坐标不再互串
  const toggleRowCheck = (
    globalIndex: number,
    row: T,
    e: { shiftKey: boolean },
  ) => {
    const index = globalIndex - pageOffset
    const next = new Set(checked)
    const key = keyOf(row)
    const willCheck = !next.has(key)
    if (
      e.shiftKey &&
      lastCheckedRef.current >= 0 &&
      lastCheckedRef.current !== index &&
      pageRows.length > 0
    ) {
      // 锚点与目标都可能超出当前页（数据变少/翻页后），区间夹在 [0, pageRows.length-1]，
      // 否则 keyOf(undefined) 会在点击处理器里抛 TypeError
      const [s, e2] = [
        Math.max(0, Math.min(lastCheckedRef.current, index)),
        Math.min(pageRows.length - 1, Math.max(lastCheckedRef.current, index)),
      ]
      for (let i = s; i <= e2; i++) {
        const targetRow = pageRows[i]
        if (!targetRow) continue
        const k = keyOf(targetRow)
        if (willCheck) next.add(k)
        else next.delete(k)
      }
    } else if (willCheck) {
      next.add(key)
    } else {
      next.delete(key)
    }
    lastCheckedRef.current = index
    onCheck?.(next)
  }
  // 每次渲染刷新回调引用（memo 行组件通过 stable 包装调用最新实现）
  handlersRef.current = {
    onSelect,
    onRowContextMenu,
    rowActions,
    toggleRowCheck,
  }

  const checkAllPage = (want: boolean) => {
    const next = new Set(checked)
    for (const row of pageRows) {
      if (want) next.add(keyOf(row))
      else next.delete(keyOf(row))
    }
    onCheck?.(next)
  }

  // B1 键盘导航：↑/↓ 移动选中行、空格勾选当前行、Ctrl/Cmd+A 全选当前列表
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 焦点在表格内部的输入控件上时（复选框/文本框等）不接管按键，留给控件自身
    const t = e.target as HTMLElement | null
    if (
      t &&
      t !== e.currentTarget &&
      t.closest('input,textarea,select,button,[contenteditable]')
    )
      return
    if (!keyboard) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (pageRows.length === 0) return
      const idx = pageRows.findIndex((r) => keyOf(r) === selectedKey)
      // 无选中时（idx=-1）首次按键落到第一行；否则按方向移动并夹在首尾
      const target =
        idx === -1
          ? 0
          : Math.min(
              pageRows.length - 1,
              Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)),
            )
      const row = pageRows[target]
      onSelect?.(row, keyOf(row))
    } else if (e.key === ' ') {
      if (selectedKey === null || selectedKey === undefined) return
      const idx = pageRows.findIndex((r) => keyOf(r) === selectedKey)
      if (idx >= 0) {
        e.preventDefault()
        // grid-1：空格路径与鼠标路径统一传全局行号（入口再换算回页内索引）
        toggleRowCheck(pageOffset + idx, pageRows[idx], { shiftKey: false })
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      // 已全选则取消全选（与表头复选框行为一致）
      checkAllPage(!pageRows.every((r) => checked.has(keyOf(r))))
    } else {
      // 其余按键（Delete/Enter 等）转发给宿主处理
      onKeyDown?.(e)
    }
  }

  // 列宽拖动
  const startResize = (field: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const col = gridColumns.find((c) => c.field === field)
    const startX = e.clientX
    const startW = col?.width ?? 80
    let finalW = startW
    const moveHandler = (ev: MouseEvent) => {
      finalW = Math.max(24, startW + ev.clientX - startX)
      setResizeW({ field, w: finalW })
    }
    const up = () => {
      window.removeEventListener('mousemove', moveHandler)
      window.removeEventListener('mouseup', up)
      setResizeW(null)
      changeColumns(
        gridColumns.map((c) =>
          c.field === field ? { ...c, width: finalW } : c,
        ),
      )
    }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', up)
  }

  // 列拖动排序：fromIdx<toIdx 时 dragField 落在目标列之后，否则落在目标列之前（与拖拽指示方向一致）
  const dropColumn = (targetField: string) => {
    const from = dragField.current
    dragField.current = null
    setDragOver(null)
    if (!from || from === targetField) return
    const order = gridColumns.map((c) => c.field)
    const fromIdx = order.indexOf(from)
    const toIdx = order.indexOf(targetField)
    if (fromIdx === -1 || toIdx === -1) return
    order.splice(toIdx, 0, order.splice(fromIdx, 1)[0])
    changeColumns(order.map((f) => gridColumns.find((c) => c.field === f)!))
  }

  const colWidth = (field: string, fallback: number) =>
    resizeW?.field === field ? resizeW.w : fallback

  const totalWidth =
    visibleCols.reduce((s, c) => s + colWidth(c.field, c.width ?? 80), 0) +
    (rownumbers ? 32 : 0) +
    (hasActions ? ACTIONS_COL_WIDTH : 0)

  return (
    <div className="eu-datagrid" style={maxHeight ? { maxHeight } : undefined}>
      <style>{DATAGRID_EXTRA_STYLE}</style>
      <div
        className="eu-datagrid-scroll"
        ref={scrollRef}
        tabIndex={0}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onKeyDown={handleKeyDown}
      >
        <table style={{ width: totalWidth }}>
          <colgroup>
            {rownumbers && <col style={{ width: 32 }} />}
            {visibleCols.map((col) => (
              <col
                key={col.field}
                style={{ width: colWidth(col.field, col.width ?? 80) }}
              />
            ))}
            {hasActions && <col style={{ width: ACTIONS_COL_WIDTH }} />}
          </colgroup>
          <thead>
            <tr>
              {rownumbers && (
                <th className="datagrid-head-cell" aria-sort="none">
                  <div
                    className="datagrid-cell"
                    style={{ textAlign: 'center' }}
                  >
                    #
                  </div>
                </th>
              )}
              {visibleCols.map((col) => {
                const w = colWidth(col.field, col.width ?? 80)
                const draggable = col.allowCustom !== false && !col.checkbox
                return (
                  <th
                    key={col.field}
                    className={`datagrid-head-cell ${
                      dragOver && dragOver.field === col.field
                        ? `drop-over-${dragOver.pos}`
                        : ''
                    }`}
                    style={{ width: w }}
                    draggable={draggable}
                    onDragStart={(e) => {
                      dragField.current = col.field
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      if (
                        !draggable ||
                        !dragField.current ||
                        dragField.current === col.field
                      )
                        return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      // grid-2：指示方向与 dropColumn 的 splice 落点一致 ——
                      // 拖动列在目标列之前（fromIdx<toIdx）时实际落在目标之后，反之落在目标之前
                      const order = gridColumns.map((c) => c.field)
                      const fromIdx = order.indexOf(dragField.current)
                      const toIdx = order.indexOf(col.field)
                      setDragOver({
                        field: col.field,
                        pos: fromIdx < toIdx ? 'after' : 'before',
                      })
                    }}
                    onDragLeave={() =>
                      setDragOver((f) => (f?.field === col.field ? null : f))
                    }
                    onDrop={(e) => {
                      e.preventDefault()
                      dropColumn(col.field)
                    }}
                    onDragEnd={() => {
                      dragField.current = null
                      setDragOver(null)
                    }}
                    aria-sort={
                      sortName === col.field
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <div
                      className={`datagrid-cell ${col.sortable ? 'sortable' : ''}`}
                      style={{ textAlign: col.align }}
                      onClick={() => col.sortable && onSort?.(col.field)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        // 列显隐菜单：与列表头「列设置」按钮共用 makeColumnMenuItems
                        showMenu(
                          makeColumnMenuItems(gridColumns, changeColumns),
                          e.clientX,
                          e.clientY,
                        )
                      }}
                      title={
                        typeof col.title === 'string' ? col.title : undefined
                      }
                    >
                      {col.checkbox ? (
                        <input
                          type="checkbox"
                          aria-label="全选当前列表"
                          checked={
                            pageRows.length > 0 &&
                            pageRows.every((r) => checked.has(keyOf(r)))
                          }
                          onChange={(e) => checkAllPage(e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="datagrid-cell-text">
                            {col.title}
                          </span>
                          {sortName === col.field && (
                            <span className="sort-icon">
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </>
                      )}
                      <span
                        className="col-resizer"
                        onMouseDown={(e) => startResize(col.field, e)}
                      />
                    </div>
                  </th>
                )
              })}
              {hasActions && (
                <th
                  className="datagrid-head-cell datagrid-actions-cell"
                  aria-hidden="true"
                />
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={colCount}>
                  <div
                    className="datagrid-cell"
                    style={{
                      textAlign: 'center',
                      color: 'var(--eu-text)',
                      opacity: 0.55,
                      padding: 14,
                    }}
                  >
                    {emptyText}
                  </div>
                </td>
              </tr>
            )}
            {/* C3 上方占位：撑起未渲染行的高度，保持滚动条真实 */}
            {useWindow && winStart > 0 && (
              <tr aria-hidden style={{ height: winStart * VIRTUAL_ROW_HEIGHT }}>
                <td colSpan={colCount} style={{ padding: 0, border: 0 }} />
              </tr>
            )}
            {renderedRows.map((row, j) => {
              const i = winStart + j
              return (
                <GridRow<T>
                  key={String(keyOf(row))}
                  row={row}
                  rowKey={keyOf(row)}
                  rowIndex={pageOffset + i}
                  displayIndex={i}
                  cols={visibleCols}
                  rownumbers={rownumbers}
                  checked={checked.has(keyOf(row))}
                  selected={selectedKey === keyOf(row)}
                  onSelect={stableSelect}
                  onToggleCheck={stableCheck}
                  onContext={stableContext}
                  rowActions={rowActions ? stableRowActions : undefined}
                  rowHeight={useWindow ? VIRTUAL_ROW_HEIGHT : undefined}
                />
              )
            })}
            {/* C3 下方占位 */}
            {useWindow && winEnd < pageRows.length && (
              <tr
                aria-hidden
                style={{
                  height: (pageRows.length - winEnd) * VIRTUAL_ROW_HEIGHT,
                }}
              >
                <td colSpan={colCount} style={{ padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pagination && (
        <Pagination
          total={rows.length}
          page={page}
          pageSize={pageSize}
          pageList={pageList}
          onPageChange={onPageChange ?? (() => {})}
          onPageSizeChange={onPageSizeChange}
          extraButtons={pagerExtra}
        />
      )}
    </div>
  )
}

/** 记忆化行组件：row 引用稳定时跳过重渲染（轮询只更新有活动的种子） */
interface GridRowProps<T extends Record<string, unknown>> {
  row: T
  rowKey: string | number
  rowIndex: number
  displayIndex: number
  cols: GridColumn<T>[]
  rownumbers: boolean
  checked: boolean
  selected: boolean
  onSelect: (row: T, key: string | number) => void
  onToggleCheck: (index: number, row: T, e: React.MouseEvent) => void
  onContext: (e: React.MouseEvent, row: T, index: number) => void
  /** C1 行 hover 快捷操作渲染函数（宿主经 ref 转发保持引用稳定） */
  rowActions?: (row: T) => ReactNode
  /** C3 窗口化渲染时固定行高（tr + 单元格 div 双重钉住），保证占位高度与真实行高一致 */
  rowHeight?: number
}

function GridRowImpl<T extends Record<string, unknown>>({
  row,
  rowKey,
  rowIndex,
  displayIndex,
  cols,
  rownumbers,
  checked,
  selected,
  onSelect,
  onToggleCheck,
  onContext,
  rowActions,
  rowHeight,
}: GridRowProps<T>) {
  // C3 窗口化行单元格封顶：tr 的 CSS height 只是最小值（表格布局语义），内容高于行高时行仍会被撑高；
  // 单元格 div 显式钉到 rowHeight-1（减 1px 是 td 下边框），配合 CSS overflow:hidden 保证行高恰为 rowHeight
  const cellStyle = rowHeight ? { height: rowHeight - 1 } : undefined
  return (
    <tr
      className={`eu-datagrid-row ${displayIndex % 2 === 1 ? 'alt' : ''} ${selected ? 'selected' : ''}`}
      data-key={String(rowKey)}
      aria-selected={selected}
      style={rowHeight ? { height: rowHeight } : undefined}
      onClick={() => onSelect(row, rowKey)}
      onContextMenu={(e) => onContext(e, row, rowIndex)}
    >
      {rownumbers && (
        <td>
          <div
            className="datagrid-cell"
            style={{
              textAlign: 'center',
              color: 'var(--eu-text)',
              opacity: 0.75,
              ...(cellStyle || {}),
            }}
          >
            {rowIndex + 1}
          </div>
        </td>
      )}
      {cols.map((col) => {
        return (
          <td key={col.field}>
            <div
              className="datagrid-cell"
              style={{ textAlign: col.align, ...(cellStyle || {}) }}
            >
              {col.checkbox ? (
                <input
                  type="checkbox"
                  aria-label={`勾选第 ${rowIndex + 1} 行`}
                  checked={checked}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleCheck(rowIndex, row, e)
                  }}
                  onChange={() => {
                    /* 状态由 click 处理 */
                  }}
                />
              ) : col.formatter ? (
                col.formatter(row[col.field], row)
              ) : (
                toCellText(row[col.field] ?? '')
              )}
            </div>
          </td>
        )
      })}
      {rowActions && (
        <td className="datagrid-actions-cell">
          <span className="datagrid-row-actions">{rowActions(row)}</span>
        </td>
      )}
    </tr>
  )
}

interface GridRowType {
  <T extends Record<string, unknown>>(
    props: GridRowProps<T> & { key?: string },
  ): React.ReactElement
}

const GridRow = memo(GridRowImpl) as unknown as GridRowType
