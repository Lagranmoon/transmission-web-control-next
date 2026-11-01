// DataGrid 组件测试（@testing-library/react + jest-dom，jsdom 环境）
// 覆盖：渲染/行号/空态/formatter、行选中与复选（含 shift 连选）、排序、分页（切片/全局行号/翻页/每页条数）、
//       键盘导航（↑↓/空格/Ctrl+A/输入控件让路/开关）、右键菜单（行回调 + 列显隐本地回退）、C3 窗口化渲染。
// 不测：列宽拖动、列拖拽排序、对话框/Tooltip 等依赖真实几何的易碎路径。
// 注意：vitest 未开 globals，RTL 不会自动注册 cleanup，需手动 afterEach(cleanup)
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import {
  DataGrid,
  makeColumnMenuItems,
  useColumnState,
  type GridColumn,
} from './DataGrid'
import { MenuProvider, type MenuItemSpec } from './ui'

afterEach(cleanup)

beforeAll(() => {
  // jsdom 没有 ResizeObserver（C3 视口测量用），也无 scrollIntoView（B1 选中滚动用）
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = vi.fn()
})

type Row = { id: string; name: string; size: number }

const cols: GridColumn<Row>[] = [
  { field: 'name', title: '名称', sortable: true, width: 120 },
  { field: 'size', title: '大小', sortable: true },
]
// 带复选列的列定义（勾选相关用例）
const checkCols: GridColumn<Row>[] = [
  { field: 'ck', title: '', checkbox: true },
  ...cols,
]

const makeRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i + 1}`,
    name: `任务${i + 1}`,
    size: i * 10,
  }))

/** 键盘/选中用受控宿主：selectedKey 与 checkedKeys 由内部 state 驱动，断言落在用户可感知的 DOM 状态上 */
function SelectHarness({
  rows,
  keyboard = true,
}: {
  rows: Row[]
  keyboard?: boolean
}) {
  const [sel, setSel] = useState<string | number | null>(null)
  const [checked, setChecked] = useState<Set<string | number>>(new Set())
  return (
    <DataGrid
      columns={checkCols}
      rows={rows}
      keyField="id"
      selectedKey={sel}
      onSelect={(_, key) => setSel(key)}
      checkedKeys={checked}
      onCheck={setChecked}
      keyboard={keyboard}
    />
  )
}

const scrollBox = () =>
  document.querySelector('.eu-datagrid-scroll') as HTMLElement
const rowOf = (text: string) => screen.getByText(text).closest('tr')!

describe('DataGrid 渲染', () => {
  it('渲染表头、单元格文本与 data-key', () => {
    render(<DataGrid columns={cols} rows={makeRows(3)} keyField="id" />)
    expect(screen.getByText('名称')).toBeInTheDocument()
    expect(screen.getByText('大小')).toBeInTheDocument()
    expect(screen.getByText('任务2')).toBeInTheDocument()
    expect(rowOf('任务2')).toHaveAttribute('data-key', 'r2')
  })

  it('rownumbers 显示行号列与 # 表头', () => {
    render(
      <DataGrid columns={cols} rows={makeRows(3)} keyField="id" rownumbers />,
    )
    expect(screen.getByText('#')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('空数据时显示 emptyText', () => {
    render(
      <DataGrid columns={cols} rows={[]} keyField="id" emptyText="暂无数据" />,
    )
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('formatter 自定义单元格渲染；缺失字段回退为空串', () => {
    const rows: Row[] = [{ id: 'r1', name: 'alpha', size: 0 }]
    const fcols: GridColumn<Row>[] = [
      {
        field: 'name',
        title: '名称',
        formatter: (v) => <b>{String(v).toUpperCase()}</b>,
      },
      { field: 'ghost', title: '缺失' },
    ]
    render(<DataGrid columns={fcols} rows={rows} keyField="id" />)
    expect(screen.getByText('ALPHA')).toBeInTheDocument()
    const ghostCell = rowOf('ALPHA').querySelectorAll('td')[1]
    expect(ghostCell.textContent).toBe('')
  })

  it('点击行触发 onSelect 并携带行数据与 key', () => {
    const onSelect = vi.fn()
    const rows = makeRows(3)
    render(
      <DataGrid columns={cols} rows={rows} keyField="id" onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByText('任务2'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toEqual(rows[1])
    expect(onSelect.mock.calls[0][1]).toBe('r2')
  })
})

describe('DataGrid 排序', () => {
  it('点击可排序列触发 onSort(field)，aria-sort 反映方向，未排序列为 none', () => {
    const onSort = vi.fn()
    render(
      <DataGrid
        columns={cols}
        rows={makeRows(3)}
        keyField="id"
        onSort={onSort}
      />,
    )
    expect(screen.getByText('名称').closest('th')).toHaveAttribute(
      'aria-sort',
      'none',
    )
    fireEvent.click(screen.getByText('大小'))
    expect(onSort).toHaveBeenCalledWith('size')
    cleanup()
    render(
      <DataGrid
        columns={cols}
        rows={makeRows(3)}
        keyField="id"
        onSort={onSort}
        sortName="name"
        sortOrder="asc"
      />,
    )
    expect(screen.getByText('名称').closest('th')).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    expect(screen.getByText('大小').closest('th')).toHaveAttribute(
      'aria-sort',
      'none',
    )
    cleanup()
    render(
      <DataGrid
        columns={cols}
        rows={makeRows(3)}
        keyField="id"
        onSort={onSort}
        sortName="name"
        sortOrder="desc"
      />,
    )
    expect(screen.getByText('名称').closest('th')).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('不可排序列点击不触发 onSort', () => {
    const onSort = vi.fn()
    const nsCols: GridColumn<Row>[] = [
      { field: 'name', title: '名称' },
      { field: 'size', title: '大小', sortable: true },
    ]
    render(
      <DataGrid
        columns={nsCols}
        rows={makeRows(3)}
        keyField="id"
        onSort={onSort}
      />,
    )
    fireEvent.click(screen.getByText('名称'))
    expect(onSort).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('大小'))
    expect(onSort).toHaveBeenCalledWith('size')
  })
})

describe('DataGrid 勾选', () => {
  it('行复选框点击回传包含该行 key 的 Set；已勾选时点击回传移除后的 Set', () => {
    const onCheck = vi.fn()
    const { unmount } = render(
      <DataGrid
        columns={checkCols}
        rows={makeRows(3)}
        keyField="id"
        checkedKeys={new Set<string | number>()}
        onCheck={onCheck}
      />,
    )
    fireEvent.click(screen.getByLabelText('勾选第 1 行'))
    expect(onCheck.mock.calls[0][0]).toEqual(new Set(['r1']))
    unmount()
    render(
      <DataGrid
        columns={checkCols}
        rows={makeRows(3)}
        keyField="id"
        checkedKeys={new Set<string | number>(['r1'])}
        onCheck={onCheck}
      />,
    )
    fireEvent.click(screen.getByLabelText('勾选第 1 行'))
    expect(onCheck.mock.calls[1][0]).toEqual(new Set())
  })

  it('shift 连选以上次勾选为锚点勾选区间，锚点随点击推进（含反向锚点向下扩展）', () => {
    const onCheck = vi.fn()
    render(
      <DataGrid
        columns={checkCols}
        rows={makeRows(5)}
        keyField="id"
        checkedKeys={new Set<string | number>()}
        onCheck={onCheck}
      />,
    )
    fireEvent.click(screen.getByLabelText('勾选第 1 行'))
    fireEvent.click(screen.getByLabelText('勾选第 3 行'), { shiftKey: true })
    expect(onCheck.mock.calls[1][0]).toEqual(new Set(['r1', 'r2', 'r3']))
    // 锚点已推进到第 3 行：shift 点第 5 行 → [3,5]
    fireEvent.click(screen.getByLabelText('勾选第 5 行'), { shiftKey: true })
    expect(onCheck.mock.calls[2][0]).toEqual(new Set(['r3', 'r4', 'r5']))
  })

  it('表头全选：未全选时点击勾选当页全部，已全选时点击清空', () => {
    const onCheck = vi.fn()
    const { unmount } = render(
      <DataGrid
        columns={checkCols}
        rows={makeRows(3)}
        keyField="id"
        checkedKeys={new Set<string | number>()}
        onCheck={onCheck}
      />,
    )
    const all = screen.getByLabelText('全选当前列表')
    expect(all).not.toBeChecked()
    fireEvent.click(all)
    expect(onCheck.mock.calls[0][0]).toEqual(new Set(['r1', 'r2', 'r3']))
    unmount()
    render(
      <DataGrid
        columns={checkCols}
        rows={makeRows(3)}
        keyField="id"
        checkedKeys={new Set<string | number>(['r1', 'r2', 'r3'])}
        onCheck={onCheck}
      />,
    )
    expect(screen.getByLabelText('全选当前列表')).toBeChecked()
    fireEvent.click(screen.getByLabelText('全选当前列表'))
    expect(onCheck.mock.calls[1][0]).toEqual(new Set())
  })
})

describe('DataGrid 分页', () => {
  it('按 page/pageSize 切片渲染，行号与复选框序号使用含分页偏移的全局坐标', () => {
    render(
      <DataGrid
        columns={checkCols}
        rows={makeRows(45)}
        keyField="id"
        rownumbers
        pagination
        page={2}
        pageSize={10}
        onCheck={vi.fn()}
      />,
    )
    expect(screen.queryByText('任务10')).not.toBeInTheDocument()
    expect(screen.getByText('任务11')).toBeInTheDocument()
    expect(screen.getByText('任务20')).toBeInTheDocument()
    expect(screen.queryByText('任务21')).not.toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument() // 行号从 11 起
    expect(screen.getByLabelText('勾选第 11 行')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
    expect(screen.getByText('共 45 条')).toBeInTheDocument()
  })

  it('首页时 «/‹ 不触发翻页，› 翻下一页，» 直达末页', () => {
    const onPageChange = vi.fn()
    render(
      <DataGrid
        columns={cols}
        rows={makeRows(25)}
        keyField="id"
        pagination
        page={1}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    )
    fireEvent.click(screen.getByText('«'))
    fireEvent.click(screen.getByText('‹'))
    expect(onPageChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('›'))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
    fireEvent.click(screen.getByText('»'))
    expect(onPageChange).toHaveBeenLastCalledWith(3)
  })

  it('pageList + onPageSizeChange 渲染每页条数下拉并回传数值', () => {
    const onPageSizeChange = vi.fn()
    const { container } = render(
      <DataGrid
        columns={cols}
        rows={makeRows(45)}
        keyField="id"
        pagination
        page={1}
        pageSize={10}
        pageList={[10, 20, 50]}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    )
    const select = container.querySelector(
      '.eu-pagination select',
    ) as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('10')
    fireEvent.change(select, { target: { value: '20' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(20)
  })
})

describe('DataGrid 键盘导航', () => {
  it('↓ 从无选中落到首行、继续下移；↑ 在首行夹住不越界', () => {
    render(<SelectHarness rows={makeRows(3)} />)
    const box = scrollBox()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(rowOf('任务1')).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(rowOf('任务2')).toHaveAttribute('aria-selected', 'true')
    expect(rowOf('任务1')).toHaveAttribute('aria-selected', 'false')
    fireEvent.keyDown(box, { key: 'ArrowUp' })
    fireEvent.keyDown(box, { key: 'ArrowUp' })
    expect(rowOf('任务1')).toHaveAttribute('aria-selected', 'true')
  })

  it('空格勾选/取消当前选中行', () => {
    render(<SelectHarness rows={makeRows(3)} />)
    const box = scrollBox()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: ' ' })
    expect(screen.getByLabelText('勾选第 1 行')).toBeChecked()
    fireEvent.keyDown(box, { key: ' ' })
    expect(screen.getByLabelText('勾选第 1 行')).not.toBeChecked()
  })

  it('Ctrl+A 全选当页，再按取消全选', () => {
    render(<SelectHarness rows={makeRows(3)} />)
    const box = scrollBox()
    fireEvent.keyDown(box, { key: 'a', ctrlKey: true })
    expect(screen.getByLabelText('勾选第 1 行')).toBeChecked()
    expect(screen.getByLabelText('勾选第 3 行')).toBeChecked()
    expect(screen.getByLabelText('全选当前列表')).toBeChecked()
    fireEvent.keyDown(box, { key: 'a', ctrlKey: true })
    expect(screen.getByLabelText('勾选第 1 行')).not.toBeChecked()
    expect(screen.getByLabelText('全选当前列表')).not.toBeChecked()
  })

  it('焦点在行内输入控件上时不接管按键；keyboard=false 时整体停用', () => {
    const { unmount } = render(<SelectHarness rows={makeRows(3)} />)
    fireEvent.keyDown(screen.getByLabelText('勾选第 1 行'), {
      key: 'ArrowDown',
    })
    expect(rowOf('任务1')).toHaveAttribute('aria-selected', 'false')
    unmount()
    render(<SelectHarness rows={makeRows(3)} keyboard={false} />)
    fireEvent.keyDown(scrollBox(), { key: 'ArrowDown' })
    expect(rowOf('任务1')).toHaveAttribute('aria-selected', 'false')
  })
})

describe('DataGrid 右键菜单', () => {
  it('行右键回调携带行数据与含分页偏移的全局索引', () => {
    const onRowContextMenu = vi.fn()
    const rows = makeRows(45)
    render(
      <DataGrid
        columns={cols}
        rows={rows}
        keyField="id"
        pagination
        page={2}
        pageSize={10}
        onRowContextMenu={onRowContextMenu}
      />,
    )
    fireEvent.contextMenu(screen.getByText('任务11'))
    expect(onRowContextMenu).toHaveBeenCalledTimes(1)
    expect(onRowContextMenu.mock.calls[0][1]).toEqual(rows[10])
    expect(onRowContextMenu.mock.calls[0][2]).toBe(10) // 全局索引 = 页内 0 + 偏移 10
  })

  it('表头右键弹出列显隐菜单（无 onColumnsChange 时走本地状态回退），点选后隐藏列', () => {
    render(
      <MenuProvider>
        <DataGrid columns={cols} rows={makeRows(3)} keyField="id" />
      </MenuProvider>,
    )
    fireEvent.contextMenu(screen.getByText('大小'))
    // 菜单项与表头各一份
    expect(screen.getAllByText('大小')).toHaveLength(2)
    const menuItem = screen
      .getAllByText('大小')
      .find((el) => el.closest('.eu-menu-item'))
    expect(menuItem).toBeTruthy()
    fireEvent.click(menuItem!)
    // 菜单关闭 + 列已隐藏
    expect(screen.queryByText('大小')).not.toBeInTheDocument()
    expect(screen.getByText('名称')).toBeInTheDocument()
  })
})

describe('DataGrid C3 窗口化渲染', () => {
  it('超过阈值只渲染窗口内行并保留占位 tr，滚动后窗口平移', () => {
    render(<DataGrid columns={cols} rows={makeRows(150)} keyField="id" />)
    // jsdom 视口高度为 0：winEnd = ceil(0/26)+buffer(10) = 10，仅渲染 10 行
    expect(document.querySelectorAll('tr.eu-datagrid-row')).toHaveLength(10)
    expect(rowOf('任务1')).toHaveAttribute('data-key', 'r1')
    // winStart=0 无上方占位，仅下方占位
    expect(document.querySelectorAll('tbody tr[aria-hidden]')).toHaveLength(1)
    fireEvent.scroll(scrollBox(), { target: { scrollTop: 2600 } })
    // scrollTop=2600：winStart=100-10=90、winEnd=100+10=110 → r91..r110 共 20 行 + 上下占位
    expect(document.querySelectorAll('tr.eu-datagrid-row')).toHaveLength(20)
    expect(document.querySelector('tr.eu-datagrid-row')).toHaveAttribute(
      'data-key',
      'r91',
    )
    expect(document.querySelectorAll('tbody tr[aria-hidden]')).toHaveLength(2)
  })
})

describe('DataGrid 纯函数与 hooks', () => {
  type ConcreteItem = Exclude<MenuItemSpec, '-'>
  const asItem = (x: MenuItemSpec): ConcreteItem => {
    if (x === '-') throw new Error('unexpected separator')
    return x
  }

  it('makeColumnMenuItems：过滤 allowCustom:false，显隐列图标、title 回退字段名，onClick 切换 hidden', () => {
    const onChange = vi.fn()
    const mcols: GridColumn<Row>[] = [
      { field: 'name', title: '名称' },
      { field: 'size', title: '大小', hidden: true },
      { field: 'ck', title: '', checkbox: true },
      { field: 'sys', title: '系统', allowCustom: false },
      { field: 'obj', title: 42 },
    ]
    const items = makeColumnMenuItems(mcols, onChange)
    expect(items).toHaveLength(4)
    const nameItem = asItem(items[0])
    expect(nameItem.id).toBe('column-name')
    expect(nameItem.text).toBe('名称')
    expect(nameItem.icon).toBe('icon-ok')
    expect(asItem(items[1]).icon).toBeUndefined() // 已隐藏列无勾选图标
    expect(asItem(items[2]).text).toBe('ck') // 空 title 回退字段名
    expect(asItem(items[3]).text).toBe('obj') // 非字符串 title 回退字段名
    nameItem.onClick?.()
    const next = onChange.mock.calls[0][0] as GridColumn<Row>[]
    expect(next.find((c) => c.field === 'name')?.hidden).toBe(true)
    expect(next.find((c) => c.field === 'size')?.hidden).toBe(true) // 原有隐藏状态保留
    asItem(items[1]).onClick?.()
    const next2 = onChange.mock.calls[1][0] as GridColumn<Row>[]
    expect(next2.find((c) => c.field === 'size')?.hidden).toBe(false)
  })

  it('useColumnState：等价重建（字段/标题相同）不冲掉本地列状态，签名变化才采用新 initial', () => {
    const persist = vi.fn()
    const base: GridColumn<Row>[] = [
      { field: 'name', title: 'Name' },
      { field: 'size', title: 'Size' },
    ]
    const { result, rerender } = renderHook(
      (p: { c: GridColumn<Row>[] }) => useColumnState<Row>(p.c, persist),
      { initialProps: { c: base } },
    )
    // 本地调整（改宽度/顺序/显隐）
    const local: GridColumn<Row>[] = [
      { field: 'size', title: 'Size', width: 200 },
      { field: 'name', title: 'Name', width: 80, hidden: true },
    ]
    act(() => result.current.update(local))
    expect(result.current.columns).toBe(local)
    expect(persist).toHaveBeenCalledWith(local)
    // 宿主等价重建 columns（字段/标题集合相同，顺序与属性不同）→ 保留本地 state
    const equivalent: GridColumn<Row>[] = [
      { field: 'name', title: 'Name', width: 999 },
      { field: 'size', title: 'Size' },
    ]
    rerender({ c: equivalent })
    expect(result.current.columns).toBe(local)
    // 标题真正变化（如切换语言）→ 采用新 initial
    const changed: GridColumn<Row>[] = [
      { field: 'name', title: '名称' },
      { field: 'size', title: 'Size' },
    ]
    rerender({ c: changed })
    expect(result.current.columns).toBe(changed)
  })
})
