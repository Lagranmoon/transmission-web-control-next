# Transmission Web Control (Next)

[ronggang/transmission-web-control](https://github.com/ronggang/transmission-web-control) 的现代化重制版，**1:1 复刻**原项目的界面布局与功能交互。

## 技术栈

- **Vite + React 19 + TypeScript**
- **TanStack Query** — 轮询数据层（session / session-stats / torrent-get recently-active 增量同步）
- **React Router** — 路由骨架
- **Tailwind CSS v4** — 样式（配合手写的 EasyUI default 主题复刻层）
- 自研 EasyUI 风格组件：linkbutton / menu / dialog / tabs / tree / datagrid / pagination / numberspinner / switchbutton / combobox / searchbox

## 功能（对齐原版 1.6.1）

- 主布局：标题栏 + 工具栏 + 状态栏 / 左侧导航树（全部、下载中、做种、校验、活动、错误、警告、服务器分布、数据目录、数据统计、用户标签）/ 种子列表 / 底部种子属性面板
- 种子列表：列排序、列宽拖动、表头右键显隐列、多选（含 shift 连选）、右键菜单（开始/暂停/改名/删除/校验/更多Peer/改目录/限速/队列/复制磁力链接）、分页、本地搜索
- 详情面板：常规（含 pieces 区块图）/ 服务器 Tracker（增删改）/ 文件（选下载、优先级、正则过滤）/ 用户 Peers / 单种子参数设置（三态开关）
- 对话框：添加种子（URL/文件/拖放）、删除确认、重命名、变更保存目录、上传下载限速、增加 Tracker、替换 Tracker、服务器参数设置（基本/网络/带宽/时段/目录字典/更多/标签）、关于
- i18n：zh-CN / en（语言包直接复用原项目 JSON），界面语言可在「参数设置-更多」切换
- 配置持久化：localStorage（同原项目 key：`transmission-web-control.system`、`transmission-web-control`）

## 开发

```bash
npm install

# 连接本机 Transmission（默认 http://127.0.0.1:9091，可通过环境变量覆盖）
TRANSMISSION_URL=http://127.0.0.1:9091 npm run dev

# 无守护进程时使用内置 Mock 数据开发/演示
VITE_MOCK=1 npm run dev

npm run build   # 生产构建
```

部署：构建产物为静态文件，需与 Transmission RPC 同域部署（`/rpc`、`/upload`），或反代同路径。

## 与原版的已知差异

- GitHub 更新检查（有意省略）
- Peers 国旗/IP 归属地需自行配置 ipinfo.io token 或自定义查询服务（参数设置 → 更多设置）

## 许可

GPL-3.0（沿用原项目；图标字体与图片资源来自原项目）
