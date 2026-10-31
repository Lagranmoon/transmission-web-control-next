/* ---------------- 搜索框 ---------------- */
import { useRef } from 'react'
import { Icon } from './Icon'

export function SearchBox({
  onSearch,
  placeholder,
  width = 200,
}: {
  onSearch: (value: string) => void
  placeholder?: string
  width?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <span className="inline-flex" style={{ width }}>
      <input
        ref={inputRef}
        className="eu-textbox w-full rounded-r-none"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch((e.target as HTMLInputElement).value)
        }}
      />
      <span
        className="inline-flex items-center justify-center border border-l-0 border-[var(--eu-border)] rounded rounded-l-none px-1 cursor-pointer hover:bg-[var(--eu-hover)]"
        style={{ width: 20 }}
        onClick={() => onSearch(inputRef.current?.value ?? '')}
        title={placeholder}
      >
        <Icon name="tr-icon-search" />
      </span>
    </span>
  )
}
