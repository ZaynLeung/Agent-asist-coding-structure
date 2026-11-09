---
name: knowledge-graph-db
description: 知识库目录标题图（knowledge/graph/outline.graph.json）的数据管理手册：init 建空图、validate 按契约校验、ingest 幂等入库、stats 统计、export 规范化导出，含 JSON 输出解读、E/W 错误码与排错。用户说「建目录标题图」「把抽取提案入库」「校验图数据」「导出图数据」「看图统计」「图数据报错」时使用。
whenToUse: 用于图数据的写入、校验、统计、导出，以及入库冲突（W005）与校验失败（E 码）的排错。只做目录与标题抽取用 knowledge-outline-extract；生成/预览图用 knowledge-graph-viz；写条目内容用 knowledge-add-entry、knowledge-ingest-paper 等内容 skill；多步骤编排用 knowledge-lead。
---

# 知识库目录标题图数据管理

本 skill 只管道具化的「主题 / 子目录 / 条目 / 条目内二级标题」结构图，唯一事实源是 `knowledge/graph/outline.graph.json`。正文内容不在这里写。

## 何时用 / 不用

用：

- 把抽取提案（`out/<主题>_outline.json`）落进图数据：`ingest`
- 图数据或提案校验失败、入库出现冲突，需要按 E/W 码排错
- 建空图、看规模与结构、导出规范化副本：`init` / `stats` / `export`

不用：

- 从目录与标题抽图 → `knowledge-outline-extract`
- 写或补条目正文、论文骨架、主题地图、内容审计 → `knowledge-add-entry`、`knowledge-ingest-paper`、`knowledge-update-index`、`knowledge-audit`
- 生成可视化页面 → `knowledge-graph-viz`
- 多步骤任务编排 → `knowledge-lead`

## 前置

- 命令一律在仓库根执行，路径用仓库根相对路径；脚本自行向上查找同时含 `.agents` 与 `knowledge` 的仓库根，不依赖当前目录。
- 只用 node 内置模块（`node:fs` / `node:path`），无第三方依赖，不需要安装步骤。
- 默认数据文件 `knowledge/graph/outline.graph.json`；`--file` 可换，相对路径按仓库根解析。
- 字段、错误码、CLI 参数以 `knowledge/graph/schema.md` 为准（§3 结构、§4 校验码、§5.1 本 skill 契约）；改字段先改它。
- stdout 只有**一个 JSON 对象**（2 空格缩进、UTF-8）；诊断信息在 stderr。退出码：`0` 成功、`2` 输入或校验错误、`1` 运行时异常。

## 命令速查（在仓库根执行，可直接复制）

```powershell
# 1) 建空图：已存在时 created:false 且不覆盖；要重建加 --force（先备份）
node .agents/skills/knowledge-graph-db/scripts/graph.mjs init --file knowledge/graph/outline.graph.json

# 2) 只读校验：数据文件 / 抽取提案都行，不写库
node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate --file knowledge/graph/outline.graph.json
node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate --file out/03_outline.json

# 3) 入库：先 --dry-run 预演，确认计数后再真写
node .agents/skills/knowledge-graph-db/scripts/graph.mjs ingest --file knowledge/graph/outline.graph.json --input out/03_outline.json --dry-run
node .agents/skills/knowledge-graph-db/scripts/graph.mjs ingest --file knowledge/graph/outline.graph.json --input out/03_outline.json

# 4) 只读统计
node .agents/skills/knowledge-graph-db/scripts/graph.mjs stats --file knowledge/graph/outline.graph.json

# 5) 导出规范化副本（节点按 id、边按 from,to,kind 排序）
node .agents/skills/knowledge-graph-db/scripts/graph.mjs export --file knowledge/graph/outline.graph.json --out out/outline.graph.export.json
```

完整参数表、每个命令的 JSON 输出示例、只读排查与备份重建流程见 `references/db-workflows.md`。

## 输出解读

- `init`：`created:true` 表示新建（或 `--force` 重建）；`false` 表示文件已存在，未动一个字节。
- `validate`：先看 `ok`，再看 `errors` 是否为空；`counts.nodes` / `counts.edges` / `counts.kinds` 用来核对规模。有 `warnings` 不阻断，但要在汇报里列出。
- `ingest`：看 `nodes_created` / `nodes_updated` / `nodes_skipped` 与 `edges_created` / `edges_skipped`；`dry_run:true` 时一个字节都没写。`errors` 非空即退出码 2、整批不落库。
- `stats`：`nodes`、`edges`、`kinds`（按节点 kind 计数）、`top_degree`（度最高的最多 5 个节点）、`orphans`（不是 topic 且没有 belongs-to 的节点 id）。
- `export`：`out` / `nodes` / `edges`；导出文件是图数据的规范化副本，节点与边均已排序。

## 幂等与去重

- 同一份输入重复 `ingest` 是安全的：节点按 `id` 命中计入 `nodes_skipped`，边按 `(from,to,kind)` 去重计入 `edges_skipped`，不会新增节点或边。第二次 `--dry-run` 应看到 `nodes_created:0`、`edges_created:0`。
- 同 `id` 但 `title`/`path` 不同 → 记 `W005`，**保留既有值**、计入 `nodes_skipped`；不要靠反复 ingest 改名。
- 确实要改名/改路径时先人工确认：确认后只改既有 JSON 里的字段**值**（不改字段名），或备份后 `init --force` 再重新抽取入库。
- 写入排序稳定（节点按 `id`、边按 `from,to,kind`），重复执行不会产生无意义的 diff。

## 错误码处理

E 码阻断（不写库、退出码 2），改完输入后重跑 `validate`：

- `E001` version 不是 1；`E010` nodes 缺失/非数组；`E011` 节点 id 非法（空、空白或反斜杠、以 `/` 开头结尾、含 `..`、带 `.md`）；`E012` 节点 kind 非法；`E013` title 为空或超 120 字符；`E014` path 为空、非 `.md` 或不在 `knowledge/` 下；`E015` 节点 id 重复。
- `E020` edges 存在但不是数组；`E021` 边缺 `from`/`to`；`E022` 边的 `from`/`to` 不在 nodes 中（`to:"root"` 除外）；`E023` 边 kind 非法；`E024` 自环。

W 码只警告（`ok` 仍为 true，但必须汇报）：`W001` 标题与命名明显不一致、`W002` 孤立节点、`W003` 同一对节点的 `related-to` 重复、`W004` 节点数超 2000、`W005` ingest 时 title/path 冲突保留既有值。

判定边界：`W001` 只在两侧都有英文词且无任何共同词时提示；中文标题对英文目录名不做判断，避免全库误报。`W002` 严格按「不是 topic 且没有 belongs-to 边」判定，topic 挂不挂 `root` 都不算孤立。

## 失败处理

| 症状 | 判定 | 动作 |
| --- | --- | --- |
| 退出码 2 + `图数据文件不存在` | 还没 `init`，或 `--file` 指错 | 核对路径后先 `init --file <同一路径>` |
| 退出码 2 + `JSON 解析失败` | 文件不是合法 JSON | 修文件（UTF-8、无 BOM 尾逗号）后重跑 `validate` |
| 退出码 2 + `输入文件不存在` | `--input` 相对仓库根解析 | 从仓库根重跑，或改用绝对路径 |
| 退出码 2 + `未知参数` / `缺少取值` | 参数拼错或没给值 | 对照命令速查；`--dry-run`、`--force` 不带值 |
| 退出码 1 + stderr 堆栈 | 运行时异常（读不了/写不了文件） | 保留 stderr 原文上报；先查目标目录权限与占用，不要重试覆盖数据 |
| `ok:true` 但 W002 很多 | 抽取侧把条目挂错父主题 | 回抽取侧修 `belongs-to`，再重新 ingest |
| `W005` 反复出现 | 上游改名了 | 人工确认新 title/path 后按「幂等与去重」处理，不要反复 ingest |

## 验证

1. `validate --file knowledge/graph/outline.graph.json` → `ok:true`、`errors:[]`。
2. 同一 `--input` 连跑两次 ingest：第二次的 `nodes_created` / `edges_created` 均为 0，`nodes_skipped` / `edges_skipped` 等于该批输入量。
3. `stats` 的 `nodes` / `edges` 与历次 ingest 累计值一致；`orphans` 为空（除非有意留有未挂父节点的条目）。
4. `export --out out/x.json` 后：节点按 `id` 升序、边按 `(from,to,kind)` 升序，`nodes` / `edges` 计数与 `stats` 一致。
5. 需要只读排查小抄、备份与重建、与 `knowledge/graph/schema.md` 的逐条对应时读 `references/db-workflows.md`。
