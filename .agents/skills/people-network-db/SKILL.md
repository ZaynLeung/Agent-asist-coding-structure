---
name: people-network-db
description: 人际网 SQLite 数据库的命令操作手册：init 建库、ingest 入库去重、validate 校验、export 导出、stats 统计、search 搜索、path 两人最短关系路径，并说明 JSON 输出解析、E/W 错误码、数据库路径与幂等语义。用户说"建库/把资料入库/查一下某人/这两人怎么认识/导出数据/数据库报错"时使用。
whenToUse: 用于数据库读写、查询与排错。从自然语言资料生成 JSON 用 people-network-extract；改图形与本地预览用 people-network-viz；需要先计划分工时先走 people-network-lead。
---

# 人际网数据库操作

CLI 契约以 `docs/contracts/cli.md` 为准；本 skill 给可直接复制的命令、输出解读与排错。

## 前置

- 项目根目录 = 本 skill 目录的 `../../..`。**所有命令先在项目根执行**，否则 `No module named people_network`。
- 解释器：Windows `.venv\Scripts\python.exe`；POSIX `.venv/bin/python`。以 `-m people_network` 运行，无需安装。
- 数据库默认 `data/people_network.db`，相对路径按项目根解析；`--db` 可指定其他路径（绝对路径原样使用）。
- stdout 是**单个 UTF-8 JSON 对象**（`ensure_ascii=False`、`indent=2`），调试信息在 stderr。解析 stdout，不要把 stderr 混进 JSON。
- 退出码：`0` 成功；`2` 输入/校验错误（JSON `ok=false` + `errors`，不写库）；`1` 运行时异常。

## 命令速查（在项目根执行）

```powershell
# 建库建表
.venv\Scripts\python.exe -m people_network init

# 只校验不写库
.venv\Scripts\python.exe -m people_network validate --input examples\three_body_network.json

# 入库（校验 → 去重 → 写库）
.venv\Scripts\python.exe -m people_network ingest --input examples\three_body_network.json

# 预演：完整走流程但不写库，先看会新建/跳过多少
.venv\Scripts\python.exe -m people_network ingest --input out\extract.json --dry-run

# 导出可视化 JSON / 统计 / 搜索 / 路径
.venv\Scripts\python.exe -m people_network export --out web\data.json
.venv\Scripts\python.exe -m people_network stats
.venv\Scripts\python.exe -m people_network search --query 叶文洁 --limit 20
.venv\Scripts\python.exe -m people_network path --from 汪淼 --to 罗辑 --max-depth 6
```

## 解读输出

- `init`：`created:true` 表示新建；已存在时为 `false` 且不破坏数据。
- `ingest`：看 `persons_created` / `persons_merged` / `relations_created` / `relations_skipped`；`dry_run:true` 时什么都没写。有 `warnings` 不阻断，但要在汇报里列出。
- `validate`：`ok`、`errors`、`warnings`、`counts`；只有 `errors` 为空才算通过。
- `stats`：`persons`、`relations`、`materials`、`categories`、`top_connected`（度最高的几个人）。
- `search`：`results` 为命中人物（姓名/别名/备注）。
- `path`：`found`、`length`、`path[]`（每步 `person`/`relation`/`direction`，`->` 或 `<-`）。

## 幂等与去重

- 同一份 JSON 重复 `ingest` 是安全的：人物按归一化 `name`/`alias` 复用（`persons_merged`），关系按 `(source, target, relation)` 跳过（`relations_skipped`），不会重复插入。
- 重复关系会取较大 `confidence`、追加 `evidence`，不新增行（`docs/contracts/data-model.md` §4）。
- 别名已被别人占用时不覆盖，记 `W002`；要改归属先人工确认，不要靠反复 ingest。
- 修好资料后重跑同一文件即可；不要手工删库。确实要重建时先备份（见 `references/db-workflows.md`）。

## 错误码处理

E 码（`validate`/`ingest`，命中即不写库，退出码 2）：E001 version、E010 persons、E011 name、E012 aliases、E020 relations、E021 source/target、E022 人物找不到、E023 relation、E024 confidence。按码改 JSON 后重跑 `validate`。
W 码（警告，继续但不忽略）：W001 缺原文、W002 别名冲突、W003 关系重复、W004 未知 category、W005 gender 非法、W006 疑似同一人物（不自动合并）。

## 失败处理

- `No module named people_network`：当前目录不是项目根；`cd` 回项目根重试。
- 输出不是 JSON：看退出码；`1` 是运行时异常，把 stderr 原文贴进汇报。
- 写库被占用（database is locked）：先停掉正在跑的 `serve`/其他 ingest，串行重试。
- `E022`：先用 `search --query <名字>` 确认该人是否已入库；不在库就补进本批 `persons`。
- 端口占用（serve）：换 `--port 8766`，不要杀未知进程。

## 验证

- `stats` 的 `persons`/`relations` 与历次 ingest 累计值一致。
- `search --query <某人>` 能命中；`path --from A --to B` 的 `length` 与图上目测步数一致。
- `export --out web\data.json` 后 `nodes`/`links` 与 `stats` 的 persons/relations 一致。
- 需要完整参数表、输出示例、只读 SQL 排查、备份/重建流程时读 `references/db-workflows.md`。
