/* ---------------- 图标 ---------------- */
export function Icon({
  name,
  className = '',
}: {
  name: string
  className?: string
}) {
  return <i className={`iconfont ${name} ${className}`} aria-hidden />
}
