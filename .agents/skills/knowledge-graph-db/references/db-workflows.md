# 目录标题图数据工作流与排错

配合本 skill 的 `SKILL.md` 使用。命令一律在仓库根执行，默认图数据文件 `knowledge/graph/outline.graph.json`；字段与错误码的唯一依据是 `knowledge/graph/schema.md`。stdout 只输出一个 JSON 对象，诊断信息在 stderr；退出码 `0` 成功 / `2` 输入或校验错误 / `1` 运行时异常。

## 1. 完整参数表

| 命令 | 参数（默认值） | 是否写图数据 | 输出要点 |
| --- | --- | --- | --- |
| `init` | `--file`（`knowledge/graph/outline.graph.json`）、`--force` | 写（空图） | `ok`、`created`、`file`；已存在且无 `--force` 时 `created:false`，绝不覆盖 |
| `validate` | `--file` | 只读 | `ok`、`errors[]`、`warnings[]`、`counts{nodes,edges,kinds}` |
| `ingest` | `--input`（必填）、`--file`、`--dry-run` | `--dry-run` 不写，否则合并写 | `ok`、`nodes_created`、`nodes_updated`、`nodes_skipped`、`edges_created`、`edges_skipped`、`dry_run`、`errors[]`、`warnings[]` |
| `stats` | `--file` | 只读 | `ok`、`nodes`、`edges`、`kinds`、`top_degree[]`、`orphans[]` |
| `export` | `--file`、`--out`（必填） | 只写 `--out`，不动图数据 | `ok`、`out`、`nodes`、`edges` |

通用约定：

- `--file` / `--input` / `--out` 的相对路径按**仓库根**解析（不是 cwd），也接受绝对路径；`--flag value` 与 `--flag=value` 等价。
- `--dry-run`、`--force` 不带值，写成 `--dry-run=true` 会报「不接受取值」并退出 2。
- 未知参数、缺参数值、未知子命令、缺子命令 → 退出码 `2`，stdout 仍是单个 JSON（`ok:false` + `errors`）。
- 写文件是「临时文件 + rename」的原子替换，父目录不存在会自动创建（`export --out out/x.json` 可直接用）。

## 2. 每个命令的输出示例

`init`（新建，或 `--force` 重建）：

```json
{ "ok": true, "created": true, "file": "knowledge/graph/outline.graph.json" }
```

`init`（已存在、未加 `--force`）：

```json
{ "ok": true, "created": false, "file": "knowledge/graph/outline.graph.json" }
```

`validate` 通过：

```json
{
  "ok": true,
  "errors": [],
  "warnings": [],
  "counts": {
    "nodes": 3,
    "edges": 3,
    "kinds": { "topic": 1, "subtopic": 0, "entry": 2, "section": 0 }
  }
}
```

`validate` 失败（退出码 2，错误码见 schema §4）：

```json
{
  "ok": false,
  "errors": ["E001: version 必须为 1（实际: 2）", "E022: edges[0].to 不在 nodes 中: topics/missing（只允许 root 作为虚拟根）"],
  "warnings": ["W002: 孤立节点 topics/x/orphan（既不是 topic 也没有 belongs-to 边）"],
  "counts": { "nodes": 2, "edges": 1, "kinds": { "topic": 1, "subtopic": 0, "entry": 1, "section": 0 } }
}
```

`ingest` 成功：

```json
{
  "ok": true,
  "nodes_created": 3,
  "nodes_updated": 0,
  "nodes_skipped": 0,
  "edges_created": 3,
  "edges_skipped": 0,
  "dry_run": false,
  "errors": [],
  "warnings": []
}
```

`ingest --dry-run` 第二次跑同一份输入（幂等表现）：

```json
{
  "ok": true,
  "nodes_created": 0,
  "nodes_updated": 0,
  "nodes_skipped": 3,
  "edges_created": 0,
  "edges_skipped": 3,
  "dry_run": true,
  "errors": [],
  "warnings": []
}
```

`ingest` 带 W005（同 id 的 title/path 冲突，保留既有值）：

```json
{
  "ok": true,
  "nodes_created": 1,
  "nodes_updated": 0,
  "nodes_skipped": 1,
  "edges_created": 1,
  "edges_skipped": 0,
  "dry_run": false,
  "errors": [],
  "warnings": ["W005: 节点 topics/03-reinforcement-learning 冲突（title 既有 \"03 强化学习\" / 输入 \"03 强化学习（改名冲突）\"），保留既有值"]
}
```

`stats`：

```json
{
  "ok": true,
  "nodes": 3,
  "edges": 3,
  "kinds": { "topic": 1, "subtopic": 0, "entry": 2, "section": 0 },
  "top_degree": [
    { "id": "topics/03-reinforcement-learning", "title": "03 强化学习", "degree": 3 },
    { "id": "topics/03-reinforcement-learning/off-policy", "title": "Off-Policy 范式", "degree": 1 }
  ],
  "orphans": []
}
```

`export`：

```json
{ "ok": true, "out": "out/outline.graph.export.json", "nodes": 3, "edges": 3 }
```

## 3. 字段语义

- `counts.kinds` / `stats.kinds`：按节点 `kind`（`topic` / `subtopic` / `entry` / `section`）计数，固定输出这 4 个键（没有该 kind 时为 `0`）。
- `top_degree`：无向度（一条边同时计入 `from` 和 `to`；`to:"root"` 不产生节点，故只计 `from`），按度降序、同度按 `id` 升序，最多 5 个；度为 0 的节点不进榜。
- `orphans`：与 `W002` 同一判定 —— 既不是 `topic`、也没有任何 `belongs-to` 边；按 `id` 升序。
- `nodes_updated`：同 id 命中、`title`/`path` 未冲突，但 `kind` 或 `order` 有变化时的计数（`order` 覆盖、缺省字段不会删既有值）。`sum(nodes_created + nodes_updated + nodes_skipped)` 等于输入节点总数。
- `edges_skipped`：既包含库里已存在的 `(from,to,kind)`，也包含同一份输入内部的重复边。边的 `note` 以先入库的为准，重复 ingest 不会覆盖。
- `warnings` 里的 `W001`~`W005` 不阻断写入；`errors` 里的任何 E 码命中都会整批不写、退出码 2。

## 4. 只读排查（不写库）

`validate` 与 `stats` 是纯只读；`init`（无 `--force` 且文件已存在时也是只读）与 `export`（只写 `--out`）不碰图数据。需要更细的查看时用 node 一行命令读 JSON（只读，不改数据）：

```powershell
# 某主题下的全部节点（id 前缀匹配）
node -e "const g=require('./knowledge/graph/outline.graph.json');console.log(JSON.stringify(g.nodes.filter(n=>n.id.startsWith('topics/03-reinforcement-learning')),null,2))"

# 全部 related-to / see-also 边及其关系短语
node -e "const g=require('./knowledge/graph/outline.graph.json');console.log(JSON.stringify(g.edges.filter(e=>e.kind!=='belongs-to'),null,2))"

# 校验发现的问题（直接看 JSON，E/W 都在里面）
node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate --file knowledge/graph/outline.graph.json
```

- 只看不写：排查时不要顺手 `ingest`，先 `--dry-run`。
- 属性排序规则：节点按 `id`、边按 `from,to,kind`，与 `export` 一致，便于肉眼比对。
- 不要用编辑器「顺手」改 JSON 字段名；字段集合由 schema §3 定义，改错字段名会被 E 码丢掉，或在下一次 ingest 时被规范化掉。

## 5. 备份、重建、恢复

图数据是纯 JSON 且已版本化，**备份优先用 git**；临时快照放 `out/`（已 gitignore）。

```powershell
# 1) 写库前快照（或直接依赖 git）
Copy-Item knowledge\graph\outline.graph.json out\outline.graph.backup.json -Force

# 2) 重建：重新抽取 → init --force → ingest（不手工改字段名）
node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan --out out/outline.json --relations
node .agents/skills/knowledge-graph-db/scripts/graph.mjs init --file knowledge/graph/outline.graph.json --force
node .agents/skills/knowledge-graph-db/scripts/graph.mjs ingest --file knowledge/graph/outline.graph.json --input out/outline.json
node .agents/skills/knowledge-graph-db/scripts/graph.mjs stats --file knowledge/graph/outline.graph.json

# 3) 恢复：图数据已版本化，直接回滚；或用 out/ 快照覆盖
git checkout -- knowledge/graph/outline.graph.json
Copy-Item out\outline.graph.backup.json knowledge\graph\outline.graph.json -Force
```

- `init --force` 会把图重置为**空图**，节点与边全部丢失；执行前必须备份/确认，并在汇报里写明影响。
- 重建的正确路径是「重新抽取 + ingest」，不是手写 JSON；确需手工修正时只改字段**值**，不改字段名、不加新字段。
- `ingest` 会保留图数据里既有的 `version` / `root` / `generated_by`；只有字段缺失时才取输入的同名字段或默认值。

## 6. 与 `knowledge/graph/schema.md` 的对应关系

| schema 位置 | 本 skill 的落点 |
| --- | --- |
| §2 文件位置 | 默认图数据路径即 §5.1 的 `--file` 缺省值；抽取提案放 `out/`（临时产物，不版本化） |
| §3 图数据 JSON（`version`/`root`/`generated_by`/`nodes`/`edges`） | `init` 生成空图；`ingest`/`export` 读写的对象；`export` 输出规范化副本 |
| §3 node 字段（`id`/`kind`/`title`/`path`/`order`） | `validate` 按 E011~E015 校验；`ingest` 按 `id` 合并；`export` 按 `id` 排序 |
| §3 edge 字段（`from`/`to`/`kind`/`note`） | `validate` 按 E020~E024 校验；`ingest` 按 `(from,to,kind)` 去重；`export` 排序 |
| §4 E 码 | `validate` / `ingest` 产出；命中即退出码 2、不写库 |
| §4 W 码 | `validate` 产出 W001~W004；`ingest` 额外产出 W005（title/path 冲突保留既有值） |
| §5.1 CLI 契约 | `scripts/graph.mjs` 的 `init` / `validate` / `ingest` / `stats` / `export` 五个子命令 |
| §6 交接流程第 2 步 | 本 skill 的位置：抽取提案人工确认后入库，再用 `validate` / `stats` 检查 |

已知取舍（schema 未定义，脚本按契约最小实现）：

- `note` ≤80 字符是 §3 的建议，§4 没有对应错误码，因此**不阻断、不进 `warnings`**；超长时只往 stderr 打提示。
- `belongs-to` 每个节点最多一条、`related-to` 同对主题只记一条都靠 `ingest` 去重保证；`belongs-to` 重复没有专门 W 码，不会单独告警。
- `W001` 判定保守：只在两侧都有英文词且没有任何共同英文词时提示；中文标题对英文目录名不判，避免全库误报。
- 校验只查 JSON 结构，不检查 `path` 指向的文件是否真的存在（文件存在性属于内容类 skill 的审计范围）。

## 7. 常见错误对照

| 症状 | 判定 | 动作 |
| --- | --- | --- |
| 退出码 2 + `图数据文件不存在` | 还没 `init` 或 `--file` 指错 | 核对路径，先 `init --file <同一路径>` |
| 退出码 2 + `JSON 解析失败` | 文件非法 JSON（尾逗号、BOM、编码） | 修成 UTF-8 合法 JSON 后重跑 `validate` |
| 退出码 2 + `输入文件不存在` | `--input` 相对仓库根解析 | 从仓库根重跑或改绝对路径 |
| 退出码 2 + `E0xx` | 输入不符合 §3/§4 | 按码改抽取侧输出，重新 `validate` 再 ingest |
| 退出码 1 + 堆栈 | 运行时异常（权限/占用/路径不可写） | 保留 stderr 原文上报；确认目标目录可写后重试，不要覆盖数据 |
| 退出码 2 + `未知参数` | 参数拼错 | 对照第 1 节参数表 |
| `stats` 全 0 | 空图或 `--file` 指错 | 先 `init`/`ingest`；确认文件路径 |
| `W005` 反复出现 | 上游改名或换路径 | 人工确认后按第 5 节重建，或只改既有 JSON 的字段值 |
| `W002` 很多 | 抽取侧 `belongs-to` 缺失/挂错父 | 回 `knowledge-outline-extract` 修父主题后重新 ingest |
