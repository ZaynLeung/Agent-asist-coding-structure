# 知识库目录标题图 · 定制配方

`scripts/render.mjs` 顶部起每个可调点都有 `// ===== [标记] =====` 注释。改之前先按下面的代码地图定位；改完按第 9 节验证。

## 代码地图（改哪里）

| 想改什么 | 搜标记 / 函数 | 说明 |
| --- | --- | --- |
| 默认输入/输出/页面标题 | `[CLI]` 的 `DEFAULT_FILE` / `DEFAULT_OUT` / `DEFAULT_TITLE` | `--file` / `--out` / `--title` 缺省值 |
| CLI 参数解析 | `parseArgs()` | 只支持这三个长参数；未知参数退出 2 |
| 仓库根与路径 | `discoverRepoRoot()` / `resolveFromRoot()` / `displayPath()` | 向上找含 `.agents` 与 `knowledge` 的目录，与 cwd 无关 |
| 读图与容错 | `[DATA]` 的 `loadGraph()` / `normalizeGraph()` | 跳过非法节点/边、去重 belongs-to、title 兜底、warning 写 stderr |
| 页面骨架与文案 | `buildHtml()` | `<header>`、搜索框、按钮、`#empty`、`#hint`、`#tooltip` |
| 全局样式 | `[HTML:CSS]` 的 `CSS` 常量 | toolbar、legend、tooltip、node、edge、空状态 |
| 内联 JSON 转义 | `serializeGraph()` | 必须保留 `<` → `\u003c`，否则 `</script>` 会提前闭合 |
| 生成后自检 | `[CHECK]` 的 `selfCheck()` | 文件存在、`id="graph-data"`、JSON 可解析、内联 JS 可编译 |
| 页面运行参数 | `[CLIENT:CFG]` 的 `CFG` | 尺寸、间距、缩放、自动收起阈值、默认搜索 |
| 配色与图例文案 | `[CLIENT:COLORS]` 的 `KIND_COLORS` / `KIND_LABELS` / `EDGE_STYLES` | 图例自动跟随，无需改 HTML |
| 层级与深度 | `[CLIENT:LAYOUT]` 的 `prepare()` | 父子关系来自 `belongs-to`，depth 由链长决定 |
| 过滤与折叠 | `[CLIENT:LAYOUT]` 的 `computeVisible()` / `descendantsHidden()` | 搜索命中 + 祖先；折叠只在不搜索时生效 |
| 布局算法 | `[CLIENT:LAYOUT]` 的 `layout()` | 每层一列 + 父节点居中对齐子节点；叶子按 order/title 排序 |
| 画节点/边 | `[CLIENT:RENDER]` 的 `render()` / `edgeGeometry()` / `tint()` | 节点宽度按文本测量自适应 |
| 高亮 | `[CLIENT:INTERACT]` 的 `applyHighlight()` | hover/点击聚焦，邻接节点与边高亮，其余变暗 |
| 平移缩放 | `bindPanZoom()` / `zoomAt()` / `fitView()` | 指针拖拽、滚轮以指针为中心缩放、双击复位 |
| 搜索/Tooltip/折叠按钮 | `[CLIENT:INTERACT]` 的 `init()` 内监听 | 搜索去抖 120ms；tooltip 只放 title + path |
| 空图与无命中 | `updateOverlays()` / `updateChrome()` | 0 节点显示 Empty；搜索无命中显示提示层 |

## 1. 按 kind 配色

改 `KIND_COLORS`（节点）与 `EDGE_STYLES`（边）：

```js
var KIND_COLORS = { topic: '#2f6fed', subtopic: '#0e9384', entry: '#d97706', section: '#7c3aed' };
var EDGE_STYLES = {
  'belongs-to': { color: '#b8c4d4', dash: '', label: '隶属' },
  'related-to': { color: '#f59e0b', dash: '6 5', label: '相关' },
  'see-also': { color: '#8b5cf6', dash: '2 4', label: '参见' }
};
```

- 节点填充是 `tint(color, alpha)` 自动生成的浅色：`topic` 0.16，其余 0.09；边框用原色。想改变浅色强度改 `render()` 里 `tint(...)` 的第二个参数。
- `dash` 为空串表示实线，`'6 5'` 是虚线。边的 label 同时用于图例文案。
- 改为深色主题时要同步改 `[HTML:CSS]` 的 `--bg` / `--ink` / `--line`，以及 `#tooltip` 的配色，否则对比度不够。

## 2. 节点大小与字号

```js
var CFG = {
  nodeHeight: 32,      // entry/section/subtopic 高度
  topicHeight: 40,     // topic 高度
  fontSize: 13,        // 会同时驱动文本测量与 CSS 变量 --label-font-size
  minNodeWidth: 96,
  maxNodeWidth: 260,
  labelPadding: 26
};
```

- 标题按像素截断（`fitTitle()` → 省略号），tooltip 仍显示完整 `title` + `path`。
- 节点宽度自适应，但每层列宽取该层最大值（`layout()` 的 `widthByDepth`），所以个别超长条目会撑宽整层；想固定宽度就把 `nodeWidth()` 改成常量。
- 中文标题想多显示几个字：优先加 `maxNodeWidth`，再加 `labelPadding`。

## 3. 层级间距

- `CFG.columnGap`：相邻层级之间的水平间距，越小越紧凑。
- `CFG.rowGap`：同一层叶子节点的垂直间距。
- `CFG.fitPadding`：初始“适应窗口”时四周留白。
- 布局规则：depth 从虚拟根按 `belongs-to` 链计算（topic=1、subtopic=2、entry=3、section=4；孤儿节点按 kind 兜底）；每层一列；父节点垂直居中于其可见子节点；同层按 `order` 再按标题排序。
- 想改成“每个主题一块/一列”的分组布局：改 `layout()` 的坐标计算，保持 `visible`（过滤结果）与 `positions`（节点几何）两个数据结构不变，其余绘制逻辑不用动。

## 4. 只显示某个主题（过滤图数据，不改渲染器）

不要在 `render.mjs` 里写死过滤条件。用 node 生成过滤后的图到 `out/`（已 gitignore），保留祖先 `belongs-to`，再传给 `--file`：

```powershell
@'
const fs = require("fs");
const g = JSON.parse(fs.readFileSync("knowledge/graph/outline.graph.json", "utf8"));
const keep = new Set([process.argv[2]]);
let changed = true;
while (changed) {
  changed = false;
  for (const e of g.edges) {
    if (e.kind === "belongs-to" && e.to !== "root" && keep.has(e.to) && !keep.has(e.from)) {
      keep.add(e.from);
      changed = true;
    }
  }
}
const nodes = g.nodes.filter((n) => keep.has(n.id));
const edges = g.edges.filter((e) => keep.has(e.from) && (e.to === "root" || keep.has(e.to)));
fs.writeFileSync("out/theme.json", JSON.stringify(Object.assign({}, g, { nodes, edges }), null, 2));
console.log("nodes", nodes.length, "edges", edges.length);
'@ | node - topics/03-reinforcement-learning
node .agents/skills/knowledge-graph-viz/scripts/render.mjs --file out/theme.json --out out/theme.html --title "强化学习主题"
```

- 主题 id 从 `process.argv[2]` 读取（管道传给 `node -` 与存成 `.mjs` 文件执行，这个下标都一样）。
- 主题 id 必须与节点 `id` 完全一致（相对 `knowledge/`、不带 `.md`）。脚本会递归保留该节点的所有后代和祖先。
- 只留相关主题时也可以手改 `out/theme.json`，但不要改 `knowledge/graph/outline.graph.json`——那是事实源，由 `knowledge-graph-db` 管理。

## 5. 搜索默认值与范围

- `CFG.defaultQuery`：页面初始化时写入搜索框并立即过滤；留空表示默认全展开。
- 搜索只匹配 `title`（小写化比较，中文不受影响），显示命中节点及其祖先；搜索期间临时忽略折叠状态。
- 想让搜索也匹配 `path`/`id`：改 `computeVisible()` 里的判断条件，并同步 `updateChrome()` 的“匹配 N 个标题”文案。
- 输入去抖时间在 `init()` 的 `window.setTimeout(..., 120)`；`Esc` 清空搜索。

## 6. 空图与空搜索结果

- 图数据 0 节点：页面显示 `#empty` 的 “图中还没有节点（Empty）” 提示，`render` 仍返回 `ok:true`、退出码 0。文案在 `buildHtml()` 里改。
- 搜索无命中：`#no-match` 覆盖层，文案带当前关键字（`updateOverlays()`）。
- 这两种情况都不允许改成抛错：契约要求空图正常产出。

## 7. 离线与中文注意点

- 页面必须保持单文件自包含：CSS/JS/JSON 全内联。允许出现的唯一 URL 是 SVG 命名空间字符串 `http://www.w3.org/2000/svg`（不是网络请求）。
- 禁止 `<script src>`、`<link>`、`@import`、`fetch()`、ES module `import`、在线字体；否则 `file://` 下会失败或页面空白。
- 内联 JSON 必须把 `<` 转成 `\u003c`：`serializeGraph()` 已处理，不要改成直接 `JSON.stringify(graph)`。
- 文件固定 UTF-8（无 BOM），保持 `<meta charset="utf-8">`；中文只用系统字体栈（Segoe UI / 微软雅黑 / PingFang / Noto Sans CJK），不要引入 webfont。
- Windows 双击即 `file://`。把绝对路径转 URL 时把 `\` 换成 `/`，例如 `file:///D:/repo/knowledge/graph/outline.html`。
- `--title` 与节点 title 都会做 HTML 转义；不要为了“支持 HTML”去掉 `escapeHtml()`。

## 8. 大图与性能

- 默认全展开；节点数 > `CFG.autoCollapseAt`（默认 600）时初始化自动收起所有 topic，页面 meta 会提示。
- 工具栏有“全部收起/全部展开”；每个有子级的节点右上角有 +/− 按钮。
- 搜索、折叠都会重算布局并重建 SVG（O(n)），几千节点内可用；schema W004 建议 > 2000 节点按主题分片（见第 4 节），不要硬塞进一张图。
- 需要真正的“按主题分组”布局时改 `layout()`，不要引入第三方图形/布局库。

## 9. 改完怎么验证

```powershell
# 1) 语法
node --check .agents/skills/knowledge-graph-viz/scripts/render.mjs

# 2) 渲染（默认写 knowledge/graph/outline.html，会自动自检）
node .agents/skills/knowledge-graph-viz/scripts/render.mjs

# 3) 手工复核内联 JSON 与内联 JS（抽出脚本再 node --check）
@'
const fs = require("fs");
const h = fs.readFileSync("knowledge/graph/outline.html", "utf8");
const d = JSON.parse(h.match(/<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
fs.writeFileSync("out/_viz_client.mjs", h.match(/<script id="graph-app">([\s\S]*?)<\/script>/)[1]);
console.log("graph-data ok:", d.nodes.length, "nodes", d.edges.length, "edges");
'@ | node
node --check out/_viz_client.mjs

# 4) skill 规范
node .agents/skills/skill-creator/scripts/validate-skill.mjs .agents/skills/knowledge-graph-viz
```

完成信号：render 输出 `ok:true`；HTML 含 `id="graph-data"` 且其 JSON 可解析；`node --check` 均退出 0；validator 0 错误 0 警告。最后在浏览器里实际点一遍：搜索、hover 高亮、图例、tooltip（只有 title + path）、拖拽、滚轮、折叠。
