# 知识库目录标题图 · 数据契约 v1

本文件是 `knowledge-lead`、`knowledge-outline-extract`、`knowledge-graph-db`、`knowledge-graph-viz` 四个 skill 的**唯一数据依据**。改字段先改这里。

## 1. 边界（最重要）

图结构**只管理目录与标题层级**：

- 管：主题、子目录、条目文件、条目内二级标题；它们之间的隶属关系与主题间关系短语。
- 不管：正文段落、论文内容、公式、代码、资源清单、个人笔记、全文索引。
- 内容的增删改查由内容类 skill 负责：`knowledge-add-entry`（写条目）、`knowledge-ingest-paper`（论文骨架）、`knowledge-update-index`（主题地图/导航）、`knowledge-audit`（内容体检）。
- 图里只出现「标题 + 路径 + 关系短语」，任何节点的 `title` 不得超过 120 字符，边的 `note` 不得超过 80 字符。

一句话：**内容归 knowledge-* 内容 skill，结构归本图**。同一件事不要两边都做。

## 2. 文件位置

| 用途 | 路径 | 版本化 |
| --- | --- | --- |
| 图数据（唯一事实源） | `knowledge/graph/outline.graph.json` | 是 |
| 抽取提案（临时产物） | `out/<主题>_outline.json` | 否（`out/` 在 gitignore） |
| 可视化产物 | `knowledge/graph/outline.html` | 否（gitignore） |

所有脚本都用**仓库根相对路径**；脚本自行向上查找仓库根（含 `.agents` 与 `knowledge` 的目录），不依赖调用时的 cwd。

## 3. 图数据 JSON

```json
{
  "version": 1,
  "root": "knowledge",
  "generated_by": "knowledge-outline-extract/scan.mjs",
  "nodes": [],
  "edges": []
}
```

### node

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 相对 `knowledge/` 的稳定键：`topics/03-reinforcement-learning`、`topics/03-reinforcement-learning/on-policy`。不带 `.md`、不以 `/` 开头或结尾、不含空格与 `..` |
| `kind` | 是 | `topic` \| `subtopic` \| `entry` \| `section` |
| `title` | 是 | `topic`/`subtopic` 取目录 README 的 H1；`entry` 取文件 H1（缺失用文件名）；`section` 取 H2 文本 |
| `path` | 是 | 相对仓库根的 `.md` 路径，如 `knowledge/topics/03-reinforcement-learning/on-policy.md`；`section` 指向所属文件 |
| `order` | 否 | 数字，目录 `NN-` 前缀或出现顺序 |

### edge

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `from` / `to` | 是 | node `id`；`to` 允许是虚拟根 `root`（表示顶层主题） |
| `kind` | 是 | `belongs-to`（子→父，唯一的结构边）\| `related-to`（主题间关系）\| `see-also`（跨主题引用） |
| `note` | 否 | ≤80 字符的关系短语，只能来自 README 的「关系说明」或 `knowledge/index.md`，不得抄正文 |

`related-to` 同一对主题只记一条（方向不敏感）。`belongs-to` 每个节点最多一条。

## 4. 校验错误码

E 码阻断写入（退出码 2），W 码只警告。

| 码 | 含义 |
| --- | --- |
| E001 | `version` 不是 1 |
| E010 | `nodes` 缺失或不是数组 |
| E011 | 节点 `id` 非法（空、含空格、以 `/` 开头结尾、含 `..`） |
| E012 | 节点 `kind` 非法 |
| E013 | `title` 为空或 >120 字符 |
| E014 | `path` 为空、不是 `.md` 或不在 `knowledge/` 下 |
| E015 | 节点 `id` 重复 |
| E020 | `edges` 存在但不是数组 |
| E021 | 边缺 `from` 或 `to` |
| E022 | 边的 `from`/`to` 不在 nodes 中（`to: "root"` 除外） |
| E023 | 边 `kind` 非法 |
| E024 | 自环（`from === to`） |
| W001 | `title` 与路径最后一段 / 目录名明显不匹配 |
| W002 | 孤立节点（既不是 `topic` 也没有 `belongs-to`） |
| W003 | 同一对节点的 `related-to` 重复 |
| W004 | 节点数 >2000，建议按主题分片 |
| W005 | `ingest` 时同一 `id` 的 title/path 冲突，保留既有值 |

## 5. CLI 契约

统一约定：stdout 只输出**一个 JSON 对象**（2 空格缩进、UTF-8、无 BOM），排错信息写 stderr；退出码 `0` 成功、`2` 输入/校验错误、`1` 运行时异常；`--file` 缺省为 `knowledge/graph/outline.graph.json`，相对仓库根解析。

### 5.1 `knowledge-graph-db/scripts/graph.mjs`

```bash
node .agents/skills/knowledge-graph-db/scripts/graph.mjs init [--file <p>] [--force]
node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate [--file <p>]
node .agents/skills/knowledge-graph-db/scripts/graph.mjs ingest --input <p> [--file <p>] [--dry-run]
node .agents/skills/knowledge-graph-db/scripts/graph.mjs stats [--file <p>]
node .agents/skills/knowledge-graph-db/scripts/graph.mjs export [--file <p>] --out <p>
```

- `init`：建空图；已存在且无 `--force` 时 `{ok:true, created:false}`，绝不覆盖。
- `validate`：`{ok, errors[], warnings[], counts:{nodes,edges,kinds}}`。
- `ingest`：先校验输入（E 码命中则不写库、退出 2），再按 `id` 合并节点、按 `(from,to,kind)` 去重加边；`--dry-run` 只报告不写。输出 `{ok, nodes_created, nodes_updated, nodes_skipped, edges_created, edges_skipped, dry_run, errors[], warnings[]}`。
- `stats`：`{ok, nodes, edges, kinds, top_degree:[{id,title,degree}](≤5), orphans:[id]}`。
- `export`：规范化（节点按 id、边按 from,to,kind 排序）写 `--out`，输出 `{ok, out, nodes, edges}`。
- 幂等：同一份输入重复 `ingest` 不产生重复节点/边。

### 5.2 `knowledge-outline-extract/scripts/scan.mjs`

```bash
node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan [--root knowledge] [--out <p>] [--relations]
```

- 扫描目录得出 `topic`/`subtopic`/`entry` 节点与 `belongs-to` 边（确定性，不猜内容）。
- `--relations`：解析主题 README 与 `knowledge/index.md` 的「关系说明」列表，把能对上主题标题的条目转成 `related-to` + `note`；对不上的进 `warnings`。
- 不给 `--out` 时 JSON 打到 stdout；给 `--out` 时写文件并输出 `{ok, out, nodes, edges, warnings}`。
- 不读正文、不生成 `section` 节点（`section` 由人工或后续步骤按需补）。

### 5.3 `knowledge-graph-viz/scripts/render.mjs`

```bash
node .agents/skills/knowledge-graph-viz/scripts/render.mjs [--file <p>] [--out <p>] [--title <text>]
```

- 读图数据，生成**自包含** HTML（inline CSS/JS/JSON，无 CDN、无构建链，`file://` 直接可看）。
- 必须包含 `<script id="graph-data" type="application/json">`，内容为图 JSON。
- 交互最小集：搜索框（按标题过滤）、hover/点击高亮相邻边、图例（按 kind 配色）、tooltip 显示 `title` + `path`（只展示标题级字段）、拖拽平移、滚轮缩放。
- 默认输出 `knowledge/graph/outline.html`；输出 `{ok, out, nodes, edges}`；节点为 0 时页面显示空图提示而不是报错。

## 6. 交接流程

1. 资料进来 → `knowledge-outline-extract` 产出目录提案（只到标题层）→ 人工确认。
2. `knowledge-graph-db ingest` 入库（`--dry-run` 先预演）→ `validate` / `stats` 检查。
3. 正文与条目内容 → 内容类 skill（`knowledge-ingest-paper` → `knowledge-add-entry`），**不写进图**。
4. 主题级结构变动 → `knowledge-update-index` 同步 `knowledge/index.md`，重跑 `scan.mjs --relations` 更新图。
5. 看图 → `knowledge-graph-viz render`，把 `file_url` 交给用户。
6. 多步骤任务 → 由 `knowledge-lead` 编排并验收。
