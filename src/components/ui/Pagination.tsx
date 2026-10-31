/* ---------------- 分页 ---------------- */
import type { ReactNode } from 'react'
import { LinkButton } from './LinkButton'

export function Pagination({
  total,
  page,
  pageSize,
  pageList,
  onPageChange,
  onPageSizeChange,
  extraButtons,
}: {
  total: number
  page: number
  pageSize: number
  pageList?: number[]
  onPageChange: (p: number) => void
  onPageSizeChange?: (size: number) => void
  extraButtons?: ReactNode
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const cur = Math.min(page, pages)
  const btn = (
    label: ReactNode,
    disabled: boolean,
    go: number,
    title: string,
  ) => (
    <LinkButton
      disabled={disabled}
      onClick={() => onPageChange(go)}
      title={title}
      className="!px-1"
    >
      {label}
    </LinkButton>
  )
  return (
    <div className="eu-pagination">
      {extraButtons}
      {btn('«', cur <= 1, 1, '首页')}
      {btn('‹', cur <= 1, cur - 1, '上一页')}
      <span className="px-1">
        {cur}/{pages}
      </span>
      {btn('›', cur >= pages, cur + 1, '下一页')}
      {btn('»', cur >= pages, pages, '末页')}
      {pageList && onPageSizeChange && (
        <select
          className="border border-[var(--eu-border)] rounded bg-[var(--eu-surface-alt)] text-[var(--eu-text)] px-0.5 h-[20px]"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <span className="eu-pagination-info">共 {total} 条</span>
    </div>
  )
}
