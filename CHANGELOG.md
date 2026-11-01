# 更新日志 / Changelog

本项目所有显著变更都将记录在本文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 补齐 lint / 测试工程化基建（`npm run lint`、`npm test`）
- 补齐开源文档：重写 README（新增 CI / License 徽章与界面截图）、新增英文版 README.en.md、新增 CONTRIBUTING.md 与本文件
- 新增 `docs/screenshots/` 界面截图（桌面版与移动版，基于 `VITE_MOCK=1` 内置模拟数据）

## [0.1.5] - 2026-10-30

### Fixed

- 精简「关于」对话框：保留原项目 credit、更新版权年份、移除失效链接

## [0.1.3] - 2026-10-30

### Fixed

- 空库时移除「服务器分布」，消除永远的『加载中…』占位

## [0.1.2] - 2026-10-30

### Added

- pieces 区块图添加说明文字

### Fixed

- 目录树路径拼接丢失分隔符

## [0.1.1] - 2026-10-30

### Fixed

- 部署实测修复四项：React 19 兼容、深色主题、子路径资源、主题行为

## [0.1.0] - 2026-10-30

### Added

- 首个发布：1:1 复刻 transmission-web-control（Vite + React 19 + TypeScript + TanStack Query + React Router + Tailwind CSS）
- 补齐全量原版功能：主题切换、自动匹配目录、配置导出导入、Peers 国旗、移动版 UI 等
- 补齐复查发现的 4 处原版功能缺口
- UI 全面优化 17 项
- 发布链路适配 + CI / Release 工作流（产物相对资源路径校验，zip / tar.gz / sha256）

### Performance

- 消除大量种子操作卡顿（RPC 批处理 + 行级渲染优化）

### Fixed

- 表格表头与表体列不对齐、排序箭头挤压、间距过窄及时长单位语言化

---

> 注：版本号 0.1.4 被跳过，没有对应的发布。

[Unreleased]: https://github.com/Lagranmoon/transmission-web-control-next/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/Lagranmoon/transmission-web-control-next/compare/v0.1.3...v0.1.5
[0.1.3]: https://github.com/Lagranmoon/transmission-web-control-next/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/Lagranmoon/transmission-web-control-next/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Lagranmoon/transmission-web-control-next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Lagranmoon/transmission-web-control-next/releases/tag/v0.1.0
