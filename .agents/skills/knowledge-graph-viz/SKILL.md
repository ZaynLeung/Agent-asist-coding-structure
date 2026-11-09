---
name: knowledge-graph-viz
description: 把 knowledge/graph/outline.graph.json 渲染成 self-contained HTML 目录标题图（inline CSS/JS/JSON，file:// 双击可看，无 CDN、无构建链、不依赖 Python）；含搜索、hover/点击高亮、按 kind 图例、title+path tooltip、拖拽平移、滚轮缩放、空图提示。用户说"把知识库画成图/生成目录图/看看知识库结构/图太挤/换个配色/加个搜索/怎么本地看图"时使用。
whenToUse: 用于渲染与定制知识库目录标题图（scripts/render.mjs、references/viz-recipes.md），以及排查页面空白、内联数据、退出码问题。改图数据用 knowledge-graph-db，扫目录出提案用 knowledge-outline-extract，改条目正文交给内容类 skill，多步骤编排用 knowledge-lead。
---

# 知识库目录标题图渲染

输入 `knowledge/graph/outline.graph.json`，输出自包含 HTML（默认 `knowledge/graph/outline.html`，单文件、双击可看）。只画标题层：`topic` / `subtopic` / `entry` / `section` 四类节点与 `belongs-to` / `related-to` / `see-also` 三类边；不读正文、不联网、不跑 Python。

## 何时用 / 何时不用

- **用**：需要看知识库结构、预览目录提案、生成一个能点能搜的结构页；调整配色、布局、密度、过滤、图例、文案。
- **不用**：改图数据本身（节点、边、关系短语、校验）→ `knowledge-graph-db`；从资料或目录扫出提案 → `knowledge-outline-extract`；改 `knowledge/` 下条目正文、README、索引 → 内容类 skill。渲染器只显示，不修正数据。

## 前置

1. 图数据已存在：`knowledge/graph/outline.graph.json`（契约见 `knowledge/graph/schema.md`）。
2. 有 Node（本仓库实测 v24；脚本只用 `node:fs` / `node:path` / `node:url`）。不需要 npm、Python、任何前端依赖。
3. 仓库根 = 同时含 `.agents/` 与 `knowledge/` 的目录。脚本自己向上查找，从任意 cwd 执行都可以。

## 步骤

1. **渲染**（默认参数）：

   ```powershell
   node .agents/skills/knowledge-graph-viz/scripts/render.mjs
   ```

   变体：

   ```powershell
   # 预览 out/ 下的临时提案（out/ 已 gitignore）
   node .agents/skills/knowledge-graph-viz/scripts/render.mjs --file out/proposal.json --out out/proposal.html --title "目录提案预览"

   # 指定其他图文件（相对仓库根解析；绝对路径原样使用）
   node .agents/skills/knowledge-graph-viz/scripts/render.mjs --file knowledge/graph/outline.graph.json
   ```

2. **读 stdout JSON**：只输出一个对象。成功是：

   ```json
   { "ok": true, "out": "knowledge/graph/outline.html", "nodes": 42, "edges": 41 }
   ```

   `nodes` / `edges` 是实际画进页面的数量（非法节点/边会被跳过并在 stderr 给 warning）。退出码：`0` 成功、`2` 输入/校验错误、`1` 运行时异常。有 warning 时把原文列进汇报，不阻断。

3. **确认自检已过**：脚本生成后会自动检查文件存在、含 `id="graph-data"`、内联 JSON 能 `JSON.parse`、内联 JS 能编译；任一失败按 `2` 退出。不要跳过 render 直接手改 HTML。

4. **把 `file_url` 给用户**：用绝对路径并转成 URL，别只给相对路径。

   ```powershell
   $p = (Resolve-Path knowledge/graph/outline.html).Path -replace '\\','/'
   "file:///$p"
   ```

   也可以 `Start-Process knowledge/graph/outline.html` 直接打开。页面里搜索、hover 高亮、图例、tooltip（只显示 title + path）、拖拽、滚轮、折叠都可用。

5. **回报**：改了哪些文件、`ok`、`nodes` / `edges`、`out` 路径、验证命令与结果。

## 常见改法

先读 `references/viz-recipes.md` 的「代码地图」，按配方只改 `scripts/render.mjs` 的一类内容（配色 / 大小 / 间距 / 过滤 / 搜索默认值），改完必须重跑第 1 步：

- 按 kind 配色、边线型：`KIND_COLORS`、`EDGE_STYLES`。
- 节点大小、字号、间距：`CFG.nodeHeight` / `topicHeight` / `fontSize` / `maxNodeWidth` / `rowGap` / `columnGap`。
- 只看某个主题：用 node 生成过滤后的 `out/<主题>.json` 再 `--file`（配方有可复制命令），不要改事实源图数据。
- 搜索默认值：`CFG.defaultQuery`。
- 大图：`CFG.autoCollapseAt` 控制自动收起阈值；页面工具栏有「全部收起 / 全部展开」。
- 页面标题：优先用 `--title`，不要改代码里的默认值。

## 失败处理

- **`找不到图数据文件`（退出 2）**：先 `knowledge-outline-extract` 出提案、`knowledge-graph-db ingest` 入库；不要手写一份假图绕过。
- **退出 2 且 `errors` 提到 JSON**：文件被截断或不是 UTF-8。用 `Get-Content <文件> -Raw | ConvertFrom-Json` 定位；BOM 会被脚本剥掉，半个 JSON 治不了。
- **页面空白、只有工具条**：浏览器 Console 看报错；重新跑 render 确认是刚生成的产物；确认内联 JSON 里的 `<` 仍是 `\u003c`；确认没有手动加外链脚本。
- **中文乱码**：文件必须 UTF-8；不要用 GBK 编辑器另存，脚本固定 utf8 写出。
- **节点为 0**：页面显示 Empty 提示是正常结果（退出码 0），先补图数据。
- **图太挤 / 被截断**：按配方调 `CFG`；条目 title 在节点上按宽度截断，hover 看 tooltip 的完整 title + path。
- **节点 > 2000**：schema W004 建议按主题分片（配方第 4 节），不要硬渲染一张巨图。
- **不要**引入 CDN、在线字体、`<script src>`、`fetch`、模块加载或构建链；也不要改成依赖 Python。契约要求单文件离线可看。

## 验证

```powershell
# 1) 语法：无输出、退出 0
node --check .agents/skills/knowledge-graph-viz/scripts/render.mjs

# 2) 渲染：stdout 的 ok=true，out 与 nodes/edges 合理
node .agents/skills/knowledge-graph-viz/scripts/render.mjs

# 3) 内联数据/脚本自检（render 已自动做，这里是手工复核）
@'
const fs = require("fs");
const h = fs.readFileSync("knowledge/graph/outline.html", "utf8");
const d = JSON.parse(h.match(/<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
fs.writeFileSync("out/_viz_client.mjs", h.match(/<script id="graph-app">([\s\S]*?)<\/script>/)[1]);
console.log("graph-data ok:", d.nodes.length, "nodes", d.edges.length, "edges");
'@ | node
node --check out/_viz_client.mjs

# 4) skill 规范：退出 0、0 警告
node .agents/skills/skill-creator/scripts/validate-skill.mjs .agents/skills/knowledge-graph-viz
```

完成信号：render `ok:true`；HTML 中 `id="graph-data"` 的内联 JSON 可解析；两条 `node --check` 都退出 0；validator 0 错误 0 警告；浏览器里搜索、hover、图例、tooltip、拖拽、缩放、折叠都可用，空图显示 Empty 提示。

## 最小示例

- 用户：「知识库结构太乱，帮我画出来」→ 直接 render（默认参数）→ 拿到 `{ok:true, out:"knowledge/graph/outline.html"}` → 把 `file:///.../knowledge/graph/outline.html` 给用户。
- 用户：「图太挤，条目名字被截断了」→ 按配方调 `CFG.rowGap` / `CFG.columnGap` / `CFG.maxNodeWidth` → `node --check` → 重跑 render → 重新给 URL。
