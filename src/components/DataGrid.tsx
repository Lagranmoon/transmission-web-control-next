// 通用数据表格 — 复刻 EasyUI datagrid 的核心交互：
// 复选列 / 行号 / 排序 / 列宽拖动 / 表头右键显示隐藏列 / 斑马纹 / 分页 / shift 连选
// 结构：单表格 + 粘性表头（thead sticky），表头与表体列宽天然对齐
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Pagination } from './ui'

export interface GridColumn<T = Record<string, unknown>> {
  field: string
  title: ReactNode
  width?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  hidden?: boolean
  formatter?: (value: any, row: T) => ReactNode
  checkbox?: boolean
  allowCustom?: boolean
}

export function useColumnState(initial: GridColumn[], persist?: (cols: GridColumn[]) => void) {
  const [columns, setColumns] = useState<GridColumn[]>(initial)
  const update = (next: GridColumn[]) => {
    setColumns(next)
    persist?.(next)
  }
  return { columns, update }
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
}: {
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
}) {
  const visibleCols = columns.filter((c) => !c.hidden)
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null)
  const [resizeW, setResizeW] = useState<{ field: string; w: number } | null>(null)
  const lastCheckedRef = useRef<number>(-1)

  const keyOf = (row: T) => row[keyField] as string | number
  const checked = checkedKeys ?? new Set<string | number>()

  const pageRows = useMemo(() => {
    if (!pagination) return rows
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, pagination, page, pageSize])

  // shift 连选
  const toggleRowCheck = (index: number, row: T, e: React.MouseEvent) => {
    const next = new Set(checked)
    const key = keyOf(row)
    const willCheck = !next.has(key)
    if (e.shiftKey && lastCheckedRef.current >= 0 && lastCheckedRef.current !== index) {
      const [s, e2] = [Math.min(lastCheckedRef.current, index), Math.max(lastCheckedRef.current, index)]
      for (let i = s; i <= e2; i++) {
        const k = keyOf(pageRows[i])
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

  const checkAllPage = (want: boolean) => {
    const next = new Set(checked)
    for (const row of pageRows) {
      if (want) next.add(keyOf(row))
      else next.delete(keyOf(row))
    }
    onCheck?.(next)
  }

  // 列宽拖动
  const startResize = (field: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const col = columns.find((c) => c.field === field)
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
      onColumnsChange?.(columns.map((c) => (c.field === field ? { ...c, width: finalW } : c)))
    }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', up)
  }

  const colWidth = (field: string, fallback: number) =>
    resizeW?.field === field ? resizeW.w : fallback

  const totalWidth =
    visibleCols.reduce((s, c) => s + colWidth(c.field, c.width ?? 80), 0) + (rownumbers ? 32 : 0)

  return (
    <div className="eu-datagrid" style={maxHeight ? { maxHeight } : undefined}>
      <div className="eu-datagrid-scroll">
        <table style={{ width: totalWidth }}>
          <colgroup>
            {rownumbers && <col style={{ width: 32 }} />}
            {visibleCols.map((col) => (
              <col key={col.field} style={{ width: colWidth(col.field, col.width ?? 80) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {rownumbers && (
                <th className="datagrid-head-cell">
                  <div className="datagrid-cell" style={{ textAlign: 'center' }}>#</div>
                </th>
              )}
              {visibleCols.map((col) => {
                const w = colWidth(col.field, col.width ?? 80)
                return (
                  <th key={col.field} className="datagrid-head-cell" style={{ width: w }}>
                    <div
                      className={`datagrid-cell ${col.sortable ? 'sortable' : ''}`}
                      style={{ textAlign: col.align }}
                      onClick={() => col.sortable && onSort?.(col.field)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setHeaderMenu({ x: e.clientX, y: e.clientY })
                      }}
                      title={typeof col.title === 'string' ? col.title : undefined}
                    >
                      {col.checkbox ? (
                        <input
                          type="checkbox"
                          checked={pageRows.length > 0 && pageRows.every((r) => checked.has(keyOf(r)))}
                          onChange={(e) => checkAllPage(e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="datagrid-cell-text">{col.title}</span>
                          {sortName === col.field && (
                            <span className="sort-icon">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </>
                      )}
                      <span className="col-resizer" onMouseDown={(e) => startResize(col.field, e)} />
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + (rownumbers ? 1 : 0)}>
                  <div className="datagrid-cell" style={{ textAlign: 'center', color: '#999', padding: 14 }}>
                    {emptyText}
                  </div>
                </td>
              </tr>
            )}
            {pageRows.map((row, i) => {
              const key = keyOf(row)
              const rowIndex = (pagination ? (page - 1) * pageSize : 0) + i
              return (
                <tr
                  key={String(key)}
                  className={`eu-datagrid-row ${i % 2 === 1 ? 'alt' : ''} ${selectedKey === key ? 'selected' : ''}`}
                  onClick={() => onSelect?.(row, key)}
                  onContextMenu={(e) => onRowContextMenu?.(e, row, rowIndex)}
                >
                  {rownumbers && (
                    <td>
                      <div className="datagrid-cell" style={{ textAlign: 'center', color: '#444' }}>
                        {rowIndex + 1}
                      </div>
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td key={col.field}>
                      <div className="datagrid-cell" style={{ textAlign: col.align }}>
                        {col.checkbox ? (
                          <input
                            type="checkbox"
                            checked={checked.has(key)}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRowCheck(i, row, e)
                            }}
                            onChange={() => {
                              /* 状态由 click 处理 */
                            }}
                          />
                        ) : col.formatter ? (
                          col.formatter(row[col.field], row)
                        ) : (
                          String(row[col.field] ?? '')
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
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
      {headerMenu &&
        (() => {
          return (
            <div
              className="eu-menu"
              style={{ left: headerMenu.x, top: headerMenu.y, position: 'fixed', zIndex: 9999 }}
              onMouseLeave={() => setHeaderMenu(null)}
            >
              {columns
                .filter((c) => c.allowCustom !== false)
                .map((c) => (
                  <div
                    key={c.field}
                    className="eu-menu-item"
                    onClick={() => {
                      onColumnsChange?.(
                        columns.map((x) => (x.field === c.field ? { ...x, hidden: !x.hidden } : x)),
                      )
                      setHeaderMenu(null)
                    }}
                  >
                    <input type="checkbox" readOnly checked={!c.hidden} />
                    <span>{typeof c.title === 'string' ? c.title : c.field}</span>
                  </div>
                ))}
            </div>
          )
        })()}
    </div>
  )
}
