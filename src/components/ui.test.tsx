// 基础组件测试（@testing-library/react + jest-dom，jsdom 环境）
// 注意：vitest 未开 globals，RTL 不会自动注册 cleanup，需手动 afterEach(cleanup)
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  ComboBox,
  LinkButton,
  NumberSpinner,
  SearchBox,
  SwitchButton,
} from './ui'

afterEach(cleanup)

/* ---------------- LinkButton ---------------- */
describe('LinkButton', () => {
  it('渲染文本并以 role=button 可点击', () => {
    const onClick = vi.fn()
    render(<LinkButton text="开始" onClick={onClick} />)
    const btn = screen.getByRole('button', { name: '开始' })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled 时不触发 onClick', () => {
    const onClick = vi.fn()
    render(<LinkButton text="开始" disabled onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('SwitchButton', () => {
  it('点击切换开关并回传新状态', () => {
    const onChange = vi.fn()
    render(<SwitchButton checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByTitle('关'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

/* ---------------- NumberSpinner ---------------- */
describe('NumberSpinner', () => {
  // 受控组件挂在持有 state 的宿主下，提交后的值能反映回输入框
  function SpinnerHarness({
    initial,
    min,
    max,
  }: {
    initial: number
    min?: number
    max?: number
  }) {
    const [v, setV] = useState(initial)
    return <NumberSpinner value={v} onChange={setV} min={min} max={max} />
  }
  const input = () => screen.getByRole<HTMLInputElement>('textbox')

  it('渲染受控当前值', () => {
    render(<NumberSpinner value={7} onChange={vi.fn()} />)
    expect(input().value).toBe('7')
  })

  it('点击 ▲/▼ 加减 1 并反映回输入框', () => {
    render(<SpinnerHarness initial={5} />)
    fireEvent.click(screen.getByText('▲'))
    expect(input().value).toBe('6')
    fireEvent.click(screen.getByText('▼'))
    expect(input().value).toBe('5')
  })

  it('箭头步进在上/下边界处被 clamp', () => {
    const { unmount } = render(<SpinnerHarness initial={100} max={100} />)
    fireEvent.click(screen.getByText('▲'))
    expect(input().value).toBe('100')
    unmount()
    render(<SpinnerHarness initial={0} min={0} />)
    fireEvent.click(screen.getByText('▼'))
    expect(input().value).toBe('0')
  })

  it('Enter 提交草稿：超出上限收敛到 max', () => {
    render(<SpinnerHarness initial={50} max={100} />)
    fireEvent.change(input(), { target: { value: '500' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(input().value).toBe('100')
  })

  it('Enter 提交草稿：低于下限收敛到 min（负数可自由键入）', () => {
    render(<SpinnerHarness initial={5} min={0} />)
    fireEvent.change(input(), { target: { value: '-5' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(input().value).toBe('0')
  })

  it('不可解析的草稿按 Enter 放弃：不触发 onChange，回到已提交值', () => {
    const onChange = vi.fn()
    render(<NumberSpinner value={50} onChange={onChange} />)
    fireEvent.change(input(), { target: { value: 'abc' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(input().value).toBe('50')
  })

  it('空草稿按 Number("")===0 处理并收敛到 [min,max]', () => {
    render(<SpinnerHarness initial={5} min={1} />)
    fireEvent.change(input(), { target: { value: '' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(input().value).toBe('1')
  })

  it('存在草稿时点 ▲ 以 clamp 后的草稿为基准 +1', () => {
    render(<SpinnerHarness initial={5} />)
    fireEvent.change(input(), { target: { value: '10' } })
    fireEvent.click(screen.getByText('▲'))
    expect(input().value).toBe('11')
  })

  it('disabled 时点击箭头不触发 onChange', () => {
    const onChange = vi.fn()
    render(<NumberSpinner value={5} onChange={onChange} disabled />)
    fireEvent.click(screen.getByText('▲'))
    fireEvent.click(screen.getByText('▼'))
    expect(onChange).not.toHaveBeenCalled()
    expect(input().disabled).toBe(true)
  })
})

/* ---------------- ComboBox ---------------- */
describe('ComboBox', () => {
  const opts = [
    { value: '10', text: '10分钟' },
    { value: '30', text: '30分钟' },
    { value: '60', text: '60分钟' },
  ]
  const input = () => screen.getByRole<HTMLInputElement>('textbox')

  it('默认收起，输入框显示当前选中项文本', () => {
    render(<ComboBox value="30" options={opts} onChange={vi.fn()} />)
    expect(input().value).toBe('30分钟')
    expect(screen.queryByText('60分钟')).not.toBeInTheDocument()
  })

  it('点击展开、选择选项后回传 value 并收起', () => {
    const onChange = vi.fn()
    render(<ComboBox value="30" options={opts} onChange={onChange} />)
    fireEvent.click(input())
    expect(screen.getByText('60分钟')).toBeInTheDocument()
    fireEvent.click(screen.getByText('60分钟'))
    expect(onChange).toHaveBeenCalledWith('60')
    expect(screen.queryByText('60分钟')).not.toBeInTheDocument()
  })

  it('disabled 时点击不展开', () => {
    render(<ComboBox value="30" options={opts} onChange={vi.fn()} disabled />)
    fireEvent.click(input())
    expect(screen.queryByText('60分钟')).not.toBeInTheDocument()
  })

  it('非可编辑模式输入框 readOnly', () => {
    render(<ComboBox value="30" options={opts} onChange={vi.fn()} />)
    expect(input().readOnly).toBe(true)
  })

  it('editable 模式按文本过滤选项（大小写不敏感）', () => {
    const caseOpts = [
      { value: 'l1', text: 'Low' },
      { value: 'l2', text: 'low-case' },
      { value: 'h', text: 'HIGH' },
    ]
    render(
      <ComboBox value="l1" options={caseOpts} onChange={vi.fn()} editable />,
    )
    fireEvent.click(input())
    fireEvent.change(input(), { target: { value: 'LOW' } })
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('low-case')).toBeInTheDocument()
    expect(screen.queryByText('HIGH')).not.toBeInTheDocument()
  })

  it('editable 模式 Enter 提交手输文本并收起', () => {
    const onChange = vi.fn()
    render(<ComboBox value="10" options={opts} onChange={onChange} editable />)
    fireEvent.click(input())
    fireEvent.change(input(), { target: { value: '/tmp/down' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('/tmp/down')
    expect(screen.queryByText('60分钟')).not.toBeInTheDocument()
  })

  it('editable 模式空输入按 Enter 只收起、不提交空串', () => {
    const onChange = vi.fn()
    render(<ComboBox value="10" options={opts} onChange={onChange} editable />)
    fireEvent.click(input())
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByText('60分钟')).not.toBeInTheDocument()
  })

  it('editable 模式点击外部时提交已手输的文本（getValue 语义）', () => {
    const onChange = vi.fn()
    render(<ComboBox value="10" options={opts} onChange={onChange} editable />)
    fireEvent.click(input())
    fireEvent.change(input(), { target: { value: 'abc' } })
    fireEvent.mouseDown(document.body)
    expect(onChange).toHaveBeenCalledWith('abc')
    expect(screen.queryByText('60分钟')).not.toBeInTheDocument()
  })

  it('当前值不在选项中（自定义值）时展示可点的原值行', () => {
    const onChange = vi.fn()
    render(<ComboBox value="45" options={opts} onChange={onChange} editable />)
    fireEvent.click(input())
    expect(screen.getByText('45')).toBeInTheDocument()
    fireEvent.click(screen.getByText('45'))
    expect(onChange).toHaveBeenCalledWith('45')
    expect(screen.queryByText('45')).not.toBeInTheDocument()
  })

  it('分组选项每组标题只渲染一次', () => {
    const grouped = [
      { value: 'a1', text: 'A1', group: 'A' },
      { value: 'a2', text: 'A2', group: 'A' },
      { value: 'b1', text: 'B1', group: 'B' },
    ]
    render(<ComboBox value="a1" options={grouped} onChange={vi.fn()} />)
    fireEvent.click(input())
    expect(screen.getAllByText('A')).toHaveLength(1)
    expect(screen.getAllByText('B')).toHaveLength(1)
    expect(screen.getByText('A2')).toBeInTheDocument()
  })
})

/* ---------------- SearchBox ---------------- */
describe('SearchBox', () => {
  it('输入后按 Enter 触发 onSearch 并携带输入值', () => {
    const onSearch = vi.fn()
    render(<SearchBox onSearch={onSearch} placeholder="搜索" />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'ubuntu' },
    })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSearch).toHaveBeenCalledWith('ubuntu')
  })

  it('点击放大镜按钮触发 onSearch', () => {
    const onSearch = vi.fn()
    render(<SearchBox onSearch={onSearch} placeholder="搜索" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'iso' } })
    fireEvent.click(screen.getByTitle('搜索'))
    expect(onSearch).toHaveBeenCalledWith('iso')
  })

  it('空输入点击按钮回传空串', () => {
    const onSearch = vi.fn()
    render(<SearchBox onSearch={onSearch} placeholder="搜索" />)
    fireEvent.click(screen.getByTitle('搜索'))
    expect(onSearch).toHaveBeenCalledWith('')
  })
})
