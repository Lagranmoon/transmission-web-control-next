# 贡献指南

感谢关注 Transmission Web Control (Next)！欢迎以 Issue / PR 的形式参与贡献。本文档介绍本地开发环境、常用命令与提交流程。

## 开发环境

- **Git**
- **Node.js**：20.19+ / 22.12+（Vite 7 要求；推荐 Node 22 LTS，与 CI 保持一致）
- **npm**（随 Node 安装；仓库使用 `package-lock.json` 锁定依赖，请用 `npm ci` / `npm install`，勿混用其他包管理器）

```bash
git clone https://github.com/Lagranmoon/transmission-web-control-next.git
cd transmission-web-control-next
npm install
```

## 本地开发

```bash
# 无需 Transmission 守护进程：内置 Mock 数据，适合 UI 开发与演示
VITE_MOCK=1 npm run dev

# 连接真实 Transmission（默认 http://127.0.0.1:9091，可用环境变量覆盖）
TRANSMISSION_URL=http://192.168.1.10:9091 npm run dev

npm run preview   # 本地预览 npm run build 的产物
```

## npm scripts

| 命令              | 作用                                       |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | 启动开发服务器（Vite，带 RPC/upload 代理） |
| `npm run lint`    | 代码检查                                   |
| `npm test`        | 运行测试                                   |
| `npm run build`   | 类型检查（`tsc -b`）+ 生产构建             |
| `npm run preview` | 预览构建产物                               |

提交前请确保 `npm run lint`、`npm test`、`npm run build` 全部通过。

## 项目结构

```
src/
├── api/          # TanStack Query 数据层（queries）
├── components/   # 主界面组件（TopBar / NavPanel / TorrentList / DataGrid / AttributePanel 等）
├── dialogs/      # 各类对话框
├── i18n/         # 语言包（zh-CN / en，直接复用原项目 JSON）
├── lib/          # RPC 客户端、Mock、格式化、配置存储、自研 EasyUI 风格基础组件
├── routes/       # 页面骨架（RootLayout 桌面版 / MobilePage 移动版）
└── styles/       # 样式（Tailwind v4 + EasyUI 主题复刻层）
```

## 提交信息约定

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 风格（与现有 git 历史一致）：

```
<type>(<scope>?): <subject>
```

常用 type：

- `feat`：新功能（如 `feat: 补齐全量原版功能（主题/自动匹配目录/配置导出导入/Peers国旗/移动版UI等）`）
- `fix`：缺陷修复（如 `fix: 目录树路径拼接丢分隔符 + pieces 分块图加说明`）
- `perf`：性能优化（如 `perf: 消除大量种子操作卡顿（RPC 批处理 + 行级渲染优化）`）
- `build`：构建 / 发布链路（如 `build: 发布链路适配 + CI/Release 工作流`）
- `chore` / `docs` / `refactor` / `ci` / `test`：杂务 / 文档 / 重构 / CI / 测试

## Pull Request 要求

1. **一个 PR 聚焦一件事**，便于评审；
2. 从最新的 `main` 拉出分支；
3. 本地通过 `npm run lint`、`npm test`、`npm run build`；
4. CI 通过（类型检查 + 构建 + 产物相对资源路径校验——保证可部署到 Transmission 子目录，见 `.github/workflows/ci.yml`）；
5. 涉及界面改动的，请在 PR 描述中附截图（可用 `VITE_MOCK=1 npm run dev` 复现）；
6. PR 描述使用中文或英文均可，说明改动动机与验证方式。

## 对齐原版的原则

本项目是 [ronggang/transmission-web-control](https://github.com/ronggang/transmission-web-control) 的 1:1 复刻：

- 界面布局、交互行为以原版 1.6.1 为基准；改动「与原版不同」的行为请在 PR 中说明理由；
- i18n 语言包直接复用原项目 JSON，新增文案需同时补齐 zh-CN 与 en；
- localStorage 配置 key 与原项目保持兼容（`transmission-web-control.system`、`transmission-web-control`）；
- 仓库 `repos/` 目录（已被 gitignore）可克隆原版仓库作为参考，勿将其内容提交进来。

## 报告问题

提 Issue 时请尽量附上：浏览器与版本、Transmission 版本、复现步骤、控制台报错截图，以及「参数设置 → 额外设置」中的配置导出（脱敏后）。

## 许可

提交即表示同意以 [MIT License](LICENSE) 授权你的贡献。
