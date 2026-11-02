/** session-get 返回的表单数据：字段类型在读取处按需收敛 */
export type SessionForm = Record<string, unknown>

/** 合并式更新表单字段（等价 setForm(f => ({ ...f, ...patch }))） */
export type SetSessionField = (patch: SessionForm) => void
