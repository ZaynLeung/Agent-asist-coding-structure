---
name: knowledge-lead
description: 知识库（机器人学知识库）任务的总入口与编排器：先只读探索、输出《执行计划确认单》并等用户明确确认，再按复杂度选择单 agent / 多智能体 / workflow，统一调度资料抽取、目录标题图、内容条目、索引维护、审计等 skill 构建工作流，最后由 Lead 集成与验收。用户说“帮我做知识库”“把这批资料整理进知识库”“安排一下怎么做”“开几个 agent 分工”“把流程跑起来”时使用。
whenToUse: 多步骤、跨文件、需要先计划后执行的知识库任务。单条只读查询（看图数据统计、查一个条目）或只改一个样式值，直接加载 knowledge-graph-db / knowledge-graph-viz，不用本 skill。
---

# 知识库任务编排（Lead）

本 skill 只做三件事：**先计划并经用户确认 → 按复杂度编排 → 亲自集成验收**。具体操作细节交给对应 skill，本 skill 不复制它们的内容。

## 技能清单（标注本仓库全部可用 skill）

**结构层**（目录标题图，数据契约 `knowledge/graph/schema.md`）：

| skill | 负责什么 | 何时调用 |
| --- | --- | --- |
| `knowledge-outline-extract` | 资料 → 目录标题图提案，只到主题/子目录/条目标题层 | 新资料进来，先判断放哪个主题、拆几个条目 |
| `knowledge-graph-db` | 图数据 init / validate / ingest / stats / export | 提案入库、改图、查图状态、排错 |
| `knowledge-graph-viz` | 生成标题图 HTML 预览（自包含、可离线看） | 用户要“看图 / 太挤 / 改配色 / 加搜索” |

**内容层**（正文与条目，由 knowledge-* 处理，**不进图**）：

| skill | 负责什么 | 何时调用 |
| --- | --- | --- |
| `knowledge-ingest-paper` | 论文或项目链接 → 条目骨架（背景/方法/结论/局限/开放问题） | 从外部资料先出骨架 |
| `knowledge-add-entry` | 在 `knowledge/` 下新增或补全条目，并同步主题 README / 索引 | 骨架确认后落正文 |
| `knowledge-update-index` | 维护 `knowledge/index.md` 主题地图与导航一致性 | 新增、重命名、移动主题后 |
| `knowledge-audit` | 全库一致性与可维护性审计（只读，出修复清单） | 定期体检、怀疑链接失效或条目不合规 |

**工程 / 元层**：

| skill | 负责什么 | 何时调用 |
| --- | --- | --- |
| `code-review` | MR / PR / commit 代码差异的结构化审查 | 改完代码、合入前 |
| `skill-creator` | 生成、修改、校验 skill 流程定义 | 要新增流程或改现有 skill |

**分工铁律**：标题与结构 → 结构层；正文与条目内容 → 内容层。同一件事两边都做会产生两份事实源。

`office-*`、`diagnose-windows-sandbox-acl` 属 DSH 内置 skill，不随本仓库分发；本清单只列仓库内 skill。

## 硬性门禁（最高优先级）

**在用户明确确认《执行计划确认单》之前，只允许只读探索。**

- 允许：读文件、grep/glob、只读命令（`graph.mjs stats` / `graph.mjs validate`、`scan.mjs` 不带 `--out`、`render.mjs` 输出到 `out/` 预览）。
- 禁止：`ingest`、`init --force`、改 `knowledge/` 内容、写图数据、`spawn_teammate` 或派发任务、`git commit`。
- 判定“已确认”：用户明确说“确认 / 开始 / 可以 / 按这个做”。沉默、只问细节、“嗯”都不算。
- 用户改需求：更新确认单，标出新增/删除项，重新确认后才继续。

## 步骤

1. **只读探索**：读 `knowledge/graph/schema.md`、`knowledge/index.md`、目标主题 README；跑 `graph.mjs stats`（图还不存在就说明）。完成信号：能说清数据现状、目标产物、受影响目录。
2. **写《执行计划确认单》**：按 `references/plan-template.md` 逐项填满七项。完成信号：写作用域两两不重叠，验收标准可被一条命令判定。
3. **等用户确认**：确认单放进回复，以“确认后我再开始执行”结尾。未确认时只做澄清问答。
4. **选编排模式**：改动 ≤2 个文件且必须串行 → 单 agent；≥2 个互不依赖的大块且写作用域不重叠 → 多智能体；≥3 个同构子任务批量扇出 → workflow。判定细则与反例读 `references/orchestration-checklist.md`，在消息里写明模式与理由。
5. **派发任务**：每任务写清 `write_scopes`（结构层与内容层的写入目录分开）、`blocked_by`、可执行的验收命令；一个 teammate 一次只认领一个任务。
6. **随进度复核**：汇报必须含改动路径、执行命令、输出摘要。收到后自己抽查 diff 并重跑验证；失败就回滚该作用域重派，不带着失败继续。
7. **集成与汇报**：合并后亲自跑全部验证命令，汇总产物路径、验证结果、遗留问题。没亲自跑过验证不得宣布完成。

## 常见工作流

- **新资料入库**：`knowledge-ingest-paper`（骨架）→ 用户确认骨架 → `knowledge-outline-extract`（标题层提案）→ `graph.mjs ingest --dry-run` → `ingest` → `knowledge-add-entry`（正文落盘）→ `knowledge-update-index`（主题地图/索引）→ 重新 `scan.mjs` + `graph.mjs validate` → `knowledge-graph-viz render`。
- **新增或调整主题**：`knowledge-update-index` → `scan.mjs --relations` → `graph.mjs ingest` → `validate` / `stats` → `render`。
- **一致性巡检**：`knowledge-audit`（内容）+ `graph.mjs validate`（结构）→ 合并成一份修复清单 → 按清单派发。

## 失败处理

- teammate 改到作用域外：停该任务，要求只保留作用域内改动并回滚越界部分。
- 两个任务写同一文件：计划阶段的错，重新切分写作用域后重发，不要靠“小心合并”。
- 验证失败但 teammate 声称通过：以 Lead 自己跑的输出为准，重跑并贴原始输出。
- 内容层与结构层互相覆盖：以 `knowledge/graph/schema.md` 划的边界为准，标题归结构、正文归内容。
- `scan` 与手工提案冲突：以仓库实际目录为准，手写节点必须能被 validate 通过才入库。
- 用户确认后又改需求：更新确认单并重新确认。

## 验证

在项目根执行，全部退出码 0：

```powershell
node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate
node .agents/skills/knowledge-graph-db/scripts/graph.mjs stats
node .agents/skills/knowledge-outline-extract/scripts/scan.mjs scan --out out/lead_scan.json
node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate --file out/lead_scan.json
```

- 产物：图数据 `knowledge/graph/outline.graph.json`、可视化 `knowledge/graph/outline.html` 与 `stats` 计数一致。
- 汇报给用户：产物路径 + 验证命令 + 结果摘要 + 遗留问题。
