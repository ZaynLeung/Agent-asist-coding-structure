# 数据库工作流与排错

配合 `people-network-db` 的 SKILL.md 使用。命令一律在项目根目录执行（本 skill 目录的 `../../..`），解释器为 `.venv\Scripts\python.exe`。

## 1. 完整参数表

| 命令 | 参数（默认值） | 输出要点 |
| --- | --- | --- |
| `init` | `--db`（`data/people_network.db`）、`--force` | `{"ok":true,"db":...,"created":true/false}` |
| `ingest` | `--input FILE`（必填）、`--db`、`--dry-run`、`--fuzzy` | 计数 + warnings + errors；`dry_run` 不写库 |
| `validate` | `--input FILE`、`--db`、`--fuzzy` | `ok`、`errors`、`warnings`、`counts` |
| `export` | `--out FILE`、`--db` | `out`、`nodes`、`links` |
| `stats` | `--db` | `persons`、`relations`、`materials`、`categories`、`top_connected` |
| `search` | `--query Q`、`--db`、`--limit 20` | `query`、`results` |
| `path` | `--from A`、`--to B`、`--db`、`--max-depth 6` | `found`、`length`、`path[]` |
| `render` | `--db`、`--out-dir web`、`--title` | `out_dir`、`index`、`nodes`、`links`、`file_url` |
| `serve` | `--db`、`--out-dir web`、`--host 127.0.0.1`、`--port 8765`、`--no-browser`、`--no-render` | 打印 `Serving at http://127.0.0.1:8765/`，阻塞 |

`render`/`serve` 的修改与预览细节属于 `people-network-viz` skill；本 skill 只负责数据侧。

## 2. 输出示例与字段语义

`ingest` 成功：

```json
{
  "ok": true,
  "db": "E:\\code\\people-network\\data\\people_network.db",
  "dry_run": false,
  "material_id": 1,
  "persons_created": 12,
  "persons_merged": 3,
  "relations_created": 22,
  "relations_skipped": 2,
  "warnings": ["W003: 关系已存在，跳过 叶文洁->杨冬 母亲"],
  "errors": []
}
```

`validate` 失败（退出码 2，不写库）：

```json
{"ok": false, "errors": ["E011: persons[2].name 不能为空", "E022: relations[0] 的 source 未找到: 张三"], "warnings": [], "counts": {"persons": 0, "relations": 0}}
```

`stats`：

```json
{"ok": true, "persons": 15, "relations": 24, "materials": 1, "categories": {"亲属": 3, "合作": 6}, "top_connected": [{"name": "叶文洁", "degree": 7}]}
```

`path`：

```json
{"ok": true, "found": true, "length": 2, "path": [{"person": "汪淼", "relation": "保护", "direction": "->"}, {"person": "罗辑", "relation": "...", "direction": "->"}]}
```

解析时先看 `ok`，再看计数/结果；不要把 stderr 拼进 JSON 解析。

## 3. 幂等矩阵

| 操作 | 重复执行效果 |
| --- | --- |
| `init` | `created:false`，不破坏已有数据 |
| `ingest` 同一文件 | 人物合并、关系跳过，计数给出 created/merged/skipped |
| `ingest --dry-run` | 只报告会发生的变更，不写库 |
| `export` | 覆盖输出文件，幂等 |
| `render` | 覆盖 `web/`，幂等 |
| `validate` | 只读，恒定 |

## 4. 只读 SQL 排查

库是标准 SQLite，CLI 没覆盖的查询可以只读 SQL 查。示例（只 SELECT，不改数据）：

```powershell
# 列出全部人物
.venv\Scripts\python.exe -c "import sqlite3,json;c=sqlite3.connect('data/people_network.db');print(json.dumps([dict(zip(('id','name','gender','tags'),r)) for r in c.execute('SELECT id,name,gender,tags FROM persons ORDER BY id')],ensure_ascii=False,indent=2))"

# 某人的全部出入关系
.venv\Scripts\python.exe -c "import sqlite3,json;c=sqlite3.connect('data/people_network.db');print(json.dumps([dict(r) for r in c.execute('SELECT s.name AS src, r.relation, t.name AS dst, r.confidence FROM relations r JOIN persons s ON s.id=r.source_id JOIN persons t ON t.id=r.target_id WHERE s.name=? OR t.name=?',('叶文洁','叶文洁'))],ensure_ascii=False,indent=2))"

# 检查重复关系（理论上有唯一约束，应为空）
.venv\Scripts\python.exe -c "import sqlite3;c=sqlite3.connect('data/people_network.db');print(list(c.execute('SELECT source_id,target_id,relation,COUNT(*) FROM relations GROUP BY 1,2,3 HAVING COUNT(*)>1')))"
```

- 写操作一律走 CLI，不要直接 `INSERT`/`UPDATE`，否则绕过归一化与去重。
- 查询前先确认没有进程在写（停掉 `serve` 后写库）。

## 5. 备份、重建、恢复

```powershell
# 备份（写库前建议做一次）
Copy-Item data\people_network.db data\people_network.backup.db -Force

# 重新初始化（--force 的具体行为以实现为准，先备份再执行，事后用 stats 确认数据仍在）
.venv\Scripts\python.exe -m people_network init --force
.venv\Scripts\python.exe -m people_network ingest --input examples\three_body_network.json

# 恢复：停掉所有写进程后用备份覆盖
Copy-Item data\people_network.backup.db data\people_network.db -Force
```

重建/重新初始化可能丢数据；执行前先备份，并把影响写进汇报、得到用户确认（属 `people-network-lead` 门禁范围）。

## 6. 常见错误对照

| 症状 | 判定 | 动作 |
| --- | --- | --- |
| `No module named people_network` | 不在项目根 | `cd` 到项目根重试 |
| 退出码 2 + `E0xx` | 输入 JSON 不合契约 | 按错误码改 JSON，重跑 validate |
| 退出码 1 + traceback | 运行时异常 | 保留 stderr，报告 Lead；不要重试覆盖数据 |
| `database is locked` | 有并发写/serve 占用 | 停掉其他进程，串行重试 |
| `W002` 别名冲突 | 别名已属于另一人 | 人工确认归属，必要时换名或先查 search |
| `W003` 关系重复 | 数据已存在 | 正常，计数里体现，无需处理 |
| `W006` 疑似同人 | `--fuzzy` 提示 | 人工判断；用 aliases 合并或加 notes 区分 |
| `stats` 为 0 | 库为空或 `--db` 指错 | 确认库路径；先 `ingest` 演示数据 |
| 中文乱码 | 终端代码页 | 文件一律 UTF-8；PowerShell 可 `[Console]::OutputEncoding=[Text.UTF8Encoding]::new()` |
