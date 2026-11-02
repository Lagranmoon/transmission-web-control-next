/** unknown 字段值的字符串化：语义等价 String(v)，集中一处避免 no-base-to-string 误报 */
export function asString(v: unknown): string {
  return String(v)
}
