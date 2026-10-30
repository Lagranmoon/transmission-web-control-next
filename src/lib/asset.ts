// 运行时引用 public 资源的统一出口：
// 以 BASE_URL 为前缀（vite base:'./'），部署在任意子目录（如 /transmission/web/）都能正确解析
export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '')
}
