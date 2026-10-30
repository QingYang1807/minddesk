# Mind Desk

专业思考的本地工作台。统一结构模型驱动思维导图、逻辑树、大纲、鱼骨图与 WBS，使用 SQLite 保存图纸，无账号、无遥测、不依赖外部 CDN。

## 启动

需要 Node.js **24.0+**（开发验证环境为 26.10）。首次使用：

```sh
git clone https://github.com/QingYang1807/minddesk.git
cd minddesk
./start.sh
```

打开 **http://127.0.0.1:4320**。`start.sh` 首次构建；源码修改后运行 `npm run build` 更新正式版本。前后台均只监听本机。

开发热更新：

```sh
npm run dev
```

开发访问 **http://127.0.0.1:4319**，后端为 4320。停止时在启动终端按 Ctrl+C。
全新环境先运行 `npm ci`；有 `package-lock.json` 锁定依赖。首次安装需要 npm 网络可用。已有本地开发目录可直接运行 `./start.sh`。

## 当前能力

- 本地工作台：真实缩略图、搜索、收藏、网格/列表、文件夹、拖入文件夹、重命名、复制、回收站恢复。
- 自定义节点与自然曲线；双侧/单侧、左右/上下逻辑树、紧凑树、真正交错斜骨鱼骨图；尺寸测量、子树间距、自动分支平衡、折叠、手动位置约束、一键美化。
- 大纲直接编辑、缩进、拖动重设父节点；WBS 编码、任务清单与属性面板。
- 标签、图标、备注、任务状态/优先级/负责人/日期/工作量/AC、证据状态/来源/验证方案、跨节点引用。
- Creative / Executive / Consulting / Dark 四套文档主题。
- 600ms 防抖自动保存、顺序写入、保存状态、80 步内存撤销重做、浏览器关闭前恢复副本、SQLite 快照。
- Markdown 标题/缩进列表、纯文本大纲和 Mind Desk JSON 校验预览导入。
- 整图/分支 SVG、1x/2x/3x PNG（内存限制明确提示）、完整 JSON、Markdown；透明背景、横/纵版最小比例、预览和汇报模式。
- 六套可编辑的多级专业模板；MECE、5 Whys、RCA、WBS、生命周期和决策思考入口。
- 真实 Ollama / OpenAI 兼容流式调用：配置、模型列表、取消、错误反馈、创建/扩展/结构分析/任务/根因/改写/风险。先校验，后预览，选择性应用，支持撤销。

**验证状态与尚未完成项请看 [docs/acceptance.md](docs/acceptance.md)**。功能源码存在不等于全部场景已验收；尤其真实浏览器视觉质量与真实模型生成需要可运行的本机服务。

## 数据与备份

- `data/mind-desk.sqlite`：图纸内容、库元数据、文件夹、版本快照。
- `data/mind-desk.sqlite-wal` / `-shm`：SQLite WAL 文件，运行时不能只复制主库作为备份。
- `data/ai-settings.json`：后端模型配置与密钥，创建权限 0600，前端从不收到已保存密钥。不要提交 `data/`。
- 浏览器 localStorage 的 `mind-desk-recovery`：防抖窗口内的本地恢复副本；成功落库即删除。重新打开工作台时校验并恢复。不要在保存完成前清空浏览器站点数据。
- 默认数据目录为**启动时的项目 `data/`**；可通过 `MIND_DESK_DATA=/absolute/path` 指定本机目录。

在「设置与数据」点击「备份整库」，下载包含图纸、文件夹、元数据和快照的 JSON。备份不含密钥。恢复前先备份现有数据；选择文件会校验所有文档，再通过事务替换整库，校验失败保持原库。版本入口可手动创建快照、加载和恢复，恢复操作也可撤销。

## 配置 Ollama

先用你已有的 Ollama 服务与模型，不自动安装或拉取权重。在设置中选择 Ollama，Base URL 默认为 `http://127.0.0.1:11434`，点击「测试连接 / 获取模型」，选择模型，保存设置。

模型必须能输出 JSON。推荐先以少量节点验证；较慢模型可能达到 180 秒服务请求上限。取消会中断上游请求，不修改图纸。连接失败不会影响手动编辑、布局、保存和导出。

## 配置 OpenAI 兼容服务

设置中选「OpenAI 兼容」，Base URL 填完整 API 前缀（如 `https://api.example.com/v1`），填写 API Key 和模型名称。适配层访问 `/models` 与 `/chat/completions`，要求支持流式 Chat Completions 及 JSON object 输出。

非本机地址必须勾选「允许发送内容至非本机模型服务」。调用时提示词和图纸内容会发送给该服务；请自行确认服务和内容。密钥只在配置请求中发送给本机后端，不进入前端持久化、备份、Git 或日志。

## AI JSON 导入

将 [docs/ai-prompt-template.md](docs/ai-prompt-template.md) 提供给任意 AI，要求生成 JSON。在「从文本创建 / 导入图纸」粘贴或选择文件，先校验与预览，再创建。机器 Schema：[docs/mind-desk.schema.json](docs/mind-desk.schema.json)，说明：[docs/ai-mindmap-schema.md](docs/ai-mindmap-schema.md)。

示例：[生命周期](docs/examples/lifecycle.json)、[根因分析](docs/examples/rca.json)、[WBS](docs/examples/wbs.json)。每个 JSON 都是完整可编辑业务数据，不是图片。

## 常用操作

| 操作 | 快捷键 / 手势 |
|---|---|
| 新建图纸 | ⌘N |
| 子节点 / 同级节点 | Tab / Enter |
| 编辑 | F2 / 双击 |
| 编辑内多行 | Shift Enter |
| 完成编辑 | Enter / 点击其他位置 |
| 删除所选节点 | Delete / Backspace |
| 撤销 / 重做 | ⌘Z / ⌘Shift Z |
| 复制 / 粘贴子树或大纲 | ⌘C / ⌘V |
| 全选 / 节点搜索 | ⌘A / ⌘F |
| 保存 / 命令面板 | ⌘S / ⌘K |
| 框选 / 多选 | Shift 拖动 / ⌘点击 |
| 平移 / 缩放 | 触控板 / ⌘滚轮或捏合 |
| 拖动改变层级 | 将节点拖至目标节点 |
| 手动位置约束 | 拖至空白处；Alt 拖动避免重设父节点 |
| 大纲提升 / 降低层级 | Shift Tab / Tab |

文本输入时不会触发图纸删除快捷键，组合输入期间忽略结构快捷键。右键节点有分支、AI、复制和提升层级操作；一键美化会清除手动位置约束。跨节点引用目前在属性中管理，尚无画布关系连线视图。

## 开发与测试

```sh
npm run check       # 严格 TypeScript
npm run test:core   # 从 packages/core 运行 Vitest（含真实 SQLite）
npm run build       # 本地静态产物
npm run test:e2e    # 先在另一个终端运行 npm run dev
node --import tsx scripts/artifacts.ts   # Schema / 示例 / SVG / 基准
```

原始工作区为空，并非所提供 opencode AGENTS 指令对应的 monorepo，无 `origin/dev`、Protocol/HttpApi 或生成客户端。本项目遵守其适用的结构与测试约束；Bun 未安装，因此使用已有 Node/npm 做等价检查，不修改系统环境。新建仓库时使用 `dev` 作为默认分支。

## 架构

`packages/core/src/` 管理文档 Schema、纯函数命令、布局、主题、模板、导入导出和 AI 建议应用；无服务器/UI 运行时依赖。`server/` 仅负责 HTTP、SQLite 迁移和模型适配。`src/` 通过 Zustand 持有唯一文档，React Flow 只负责交互和渲染；布局坐标不混入层级数据。后端和前端共享 Schema；不维护平行业务模型。

技术决策见 [设计记录](docs/superpowers/specs/2026-10-30-mind-desk-design.md)。布局现阶段在主线程执行；500 节点的纯计算基准写入 `artifacts/performance.json`，不代表浏览器帧率。
