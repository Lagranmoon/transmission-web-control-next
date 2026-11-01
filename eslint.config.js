// ESLint 扁平配置：typescript-eslint（type-checked，经 projectService 关联仓库 tsconfig）
// + eslint-plugin-react-hooks + eslint-plugin-react-refresh。
// eslint-config-prettier 必须放最后：关掉与 Prettier 冲突的格式类规则（格式统一交给 Prettier）。
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 全局忽略：构建产物 / 依赖 / 参考仓库 / 设计稿 / 静态资源 / 本地工具产物（UI 验收截图、ZCode 生成文件）
  {
    ignores: [
      'dist/',
      'node_modules/',
      'repos/',
      'designs/',
      'out/',
      'public/',
      'src/assets/',
      '.zcode/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: {
      parserOptions: {
        // projectService 按 tsconfig 关联类型信息：src/** 走 tsconfig.app.json，
        // vite.config.ts 走 tsconfig.node.json
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // React Hooks 规则（手动展开规则名，兼容插件 v5/v6 配置导出形态差异）
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 组件文件只导出组件（常量除外），避免 HMR 下 Fast Refresh 失效
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // src/components/ui.tsx 是纯 barrel：再导出 hook（useMenu）会触发
    // react-refresh/only-export-components warning；barrel 不含组件实现、
    // 不构成 Fast Refresh 边界，对该文件关闭此规则，避免每个贡献者都看到永久噪音
    files: ['src/components/ui.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // 纯 JS 配置文件（eslint.config.js 等）不在任何 tsconfig 项目内，
    // 关闭 type-aware 规则，避免 projectService 报“文件不在项目中”
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
)
