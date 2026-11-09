---
name: people-network-viz
description: 修改人际网可视化源码 viz/（CONFIG 参数、配色、节点大小、力导向布局、标签、高亮、搜索框、图例、tooltip、拖拽缩放），并 render/serve 本地预览、用 node --check 与 HTTP 冒烟验证。用户说"图太挤/颜色不好看/加个搜索/节点显示头像/怎么本地看关系图"时使用。
whenToUse: 用于改 viz/ 前端代码与本地预览。数据抽取用 people-network-extract，入库与查询用 people-network-db，多步骤编排用 people-network-lead。
---

# 人际网可视化改造与本地预览

源码在 `viz/`，产物在 `web/`（gitignore）。契约以 `docs/contracts/viz.md` 为准；不引入任何构建链。

## 边界（先确认再动手）

- 只改 `viz/index.html`、`viz/style.css`、`viz/app.js`；`viz/vendor/d3.v7.min.js` 只读，不换版本。
- 不改 `people_network/`（`render`/`serve` 属 Python 侧）、不加 npm/webpack/babel、不引 CDN 或 ES module（`file://` 必须能看）。
- 需要改 Python 渲染逻辑时停下来报告用户/Lead，由对应作用域处理。

## 步骤

1. **定位改动点**：先读 `viz/app.js` 顶部 `CONFIG`（键名以实际代码为准）；能靠 CONFIG 解决就只改 CONFIG。需要知道「哪个文件/函数管什么」时读 `references/code-map.md`；常见改法直接照 `references/customization-recipes.md`。
2. **改代码**：一次只改一类（配色 / 布局 / 标签 / 交互），保持纯 ES + 全局 `d3`；改完记录改动点与 CONFIG 前后值。
3. **语法检查**：在项目根执行 `node --check viz\app.js`（改到别的 .js 也一并检查）。PATH 无 node 时用绝对路径 `C:\Users\yan\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe --check viz\app.js`。完成信号：无输出、退出码 0。
4. **渲染预览**：项目根（本 skill 目录的 `../../..`）执行 `.venv\Scripts\python.exe -m people_network render`，把输出 JSON 的 `file_url` 给用户（或 `start web\index.html`）。需要 HTTP 时 `.venv\Scripts\python.exe -m people_network serve --port 8765`，只监听 `127.0.0.1`。
5. **验证产物**：`web\index.html` 含 `id="network-data"` 的内联 JSON；`web\data.json` 能被 `json.load`；render 输出的 `nodes`/`links` 与 `stats` 一致；空库时页面显示空库提示而不报错。
6. **HTTP 冒烟**（用了 serve 时）：另开终端或后台跑 serve，`Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/` 状态码 200 且页面含 `network-data`；`/data.json` 返回 200 且是合法 JSON。验证完停掉 serve，不要留后台进程。
7. **汇报**：改动文件清单 + 关键 CONFIG 前后值 + `node --check` 结果 + 渲染/HTTP 验证摘要 + 预览 URL/`file_url`。

## 失败处理

- `node --check` 语法错：按行号修；常见是模板字符串里的反引号、正则转义。不要用"浏览器里能跑"跳过。
- `No module named people_network`：不在项目根；`cd` 回项目根重试。
- 页面空白：看浏览器控制台；确认 `network-data` 的 JSON 合法（`<` 必须转成 `\u003c`，否则 script 提前闭合）；确认没有引入 fetch/module。
- `file://` 下不显示：只允许内联数据与相对路径资源；`d3` 必须是 `vendor/` 本地文件。
- serve 端口占用：换 `--port 8766`；不要 kill 未知进程。
- 改动与契约冲突（如引入构建链、改 vendor）：回退，以 `docs/contracts/viz.md` 为准。

## 验证

- `node --check viz\app.js` → 退出码 0。
- `.venv\Scripts\python.exe -m people_network render` → 退出码 0、`ok=true`，`nodes`/`links` 与 `stats` 一致。
- 打开 `file_url`：搜索、图例、hover 高亮、拖拽、缩放、双击复位都能操作；空库提示正确。
- `git status` 只出现 `viz/` 下预期文件，无新增依赖/构建产物。

## 最小示例

用户："节点太挤了，名字也看不清。" → 只改 `CONFIG` 的 `chargeStrength`、`linkDistance`、`labelFontSize`（配方见 `references/customization-recipes.md`）→ `node --check` → `render` → 把 `file_url` 给用户确认。
