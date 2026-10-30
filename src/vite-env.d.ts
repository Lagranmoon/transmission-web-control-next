/// <reference types="vite/client" />

/** 构建期由 vite define 注入的应用版本号（来自 package.json，与 Release tag 对应） */
declare const __APP_VERSION__: string

declare module '*.json' {
  const value: unknown
  export default value
}
