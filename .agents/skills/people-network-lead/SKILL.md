---
name: people-network-lead
description: 人际网（人物关系图）项目的任务入口与编排器。接到需求先只读探索，输出《执行计划确认单》并等用户明确确认，再按复杂度选择单 agent、多智能体或 workflow，调度 extract/db/viz 三个 skill，最终由 Lead 集成与验收。用户说"帮我做人际网""整理人物关系""安排一下怎么做""开几个 agent 分工""把这个项目跑起来"时使用。
whenToUse: 用于多步骤、跨文件、需要分工或需要先计划后执行的人际网任务。单条只读查询（查一个人、看一条命令结果）无需加载本 skill，直接执行 people-network-db 的只读命令；只改一个样式值用 people-network-viz。
---

# 人际网任务编排（Lead）

本 skill 只做三件事：**先计划并经用户确认 → 按复杂度编排 → 亲自集成验收**。抽取、入库、可视化的操作细节交给对应 skill，本 skill 不复制它们的内容。

## 何时使用 / 不使用

- 使用：新需求、多文件改动、需要拆给多人、用户问"怎么安排"。
- 不使用：单条只读查询、单个样式值微调、已有明确 JSON 只差校验。直接走 `people-network-db` 或 `people-network-viz`。

## 硬性门禁（最高优先级，不可跳过）

**在用户明确确认《执行计划确认单》之前，只允许只读探索。**

- 允许：读文件、grep/glob、跑只读命令（`stats`、`search`、`path`、`validate` 只校验不写库）。
- 禁止：`spawn_teammate`、用 `team_task_create`/`team_task_update` 派发任务、加载并执行其他 skill 的写操作、写或改文件、`git commit`、`init --force`/`ingest` 等会改库的命令。
- 判定"已确认"：用户明确说出"确认/开始/可以/按这个做"。沉默、只问细节、只说"嗯"、只转发资料都不算确认。
- 用户改需求：更新确认单，标出新增/删除项，重新确认后才继续。

## 步骤

1. **只读探索**：读 `docs/contracts/data-model.md`、`docs/contracts/cli.md`、`docs/contracts/viz.md`、`docs/contracts/ownership.md` 和 `README.md`；用 `stats`/`search` 看数据现状。完成信号：能说清数据现状、目标产物、受影响目录。
2. **写《执行计划确认单》**：按 `references/plan-template.md` 逐项填，七项不得空缺：任务清单、分工、写作用域、验收标准、预计产物、是否需要多智能体/多 workflow、风险与回滚。完成信号：写作用域两两不重叠，验收标准可被一条命令判定。
3. **等用户确认**：把确认单放在回复里，以一句明确的"确认后我再开始执行"结尾。完成信号：收到含明确授权的回复。未收到时只做澄清问答，不执行、不派发。
4. **选编排模式**：改动 ≤2 个文件且必须串行 → 单 agent；≥2 个互不依赖的大块且各有独立写入目录 → 多智能体；≥3 个同构子任务批量扇出（如逐批抽资料、逐条核关系）→ workflow。判断细则与反例读 `references/orchestration-checklist.md`。完成信号：在消息里写明模式与理由。
5. **派发共享任务**：每个任务写清 `write_scopes`（取自 `docs/contracts/ownership.md`）、`blocked_by`、可执行的验收标准；一个 teammate 一次只认领一个任务。完成信号：任务板无写作用域重叠告警、依赖顺序正确。
6. **随进度复核**：teammate 汇报必须含改动路径、执行命令、输出摘要。收到后自己抽查 diff 并独立跑一次验证；失败就回滚该作用域并重派，不带着失败继续。
7. **集成与汇报**：合并后亲自跑全部验证命令，汇总产物、验证结果、遗留问题。未亲自跑过验证不得宣布完成。

## 失败处理

- teammate 改到作用域外：立即停该任务，要求只保留作用域内改动并回滚越界部分。
- 两个任务写同一文件：这是计划阶段的错。重新切分写作用域后重发任务，不要靠"小心合并"。
- 验证失败但 teammate 声称通过：以 Lead 自己跑的输出为准，重跑并把原始输出写进汇报。
- 用户确认后又改需求：更新确认单并重新确认，不要在旧确认上继续加活。
- 多个 agent 抢同一个数据库或端口：写库串行、预览端口分配不同值。

## 验证

在项目根目录（本 skill 目录的 `../../..`）依次执行，全部退出码 0 且 JSON `ok=true`：

```powershell
.venv\Scripts\python.exe -m people_network validate --input examples\three_body_network.json
.venv\Scripts\python.exe -m people_network ingest --input examples\three_body_network.json
.venv\Scripts\python.exe -m people_network stats
.venv\Scripts\python.exe -m people_network render
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

- 产物：`web\index.html`、`web\data.json` 存在，nodes/links 与 `stats` 一致。
- 契约对照：四个 skill 的产出都能在 `docs/contracts/` 找到依据；冲突时以契约为准。
- 汇报给用户：产物路径 + 验证命令 + 结果摘要 + 遗留问题。
