# 《执行计划确认单》模板

用途：`people-network-lead` 在只读探索之后、任何写操作或派发之前，用本模板输出确认单。用户明确确认后才能继续。

## 填写规则

- 七项字段全部要有内容；没有就写"无"，不要留空。
- 写作用域必须写到目录或文件级，且**两两不重叠**；以 `docs/contracts/ownership.md` 为准。
- 验收标准必须是可执行判定：一条命令 + 预期输出/退出码，或一个明确的可检条件。
- 不确定的地方写进"风险与回滚"，不要用模糊措辞掩盖。
- 确认单用中文、可直接贴给用户，不要夹内部推理。

## 模板（复制后逐项填）

```markdown
## 执行计划确认单

**目标**：<一句话，用户可见的最终效果>

**任务清单**
1. <任务> → 验收：`<命令>` 退出码 0 / <可检条件>
2. ...

**分工**
| 角色 | 负责 | 写作用域 | 依赖 |
| --- | --- | --- | --- |
| <成员/单 agent> | <任务> | `<目录或文件>` | <依赖谁或无> |

**写作用域**
- <路径前缀>：<谁写>
- 检查：无两两重叠（列出重叠项则重新切分）

**验收标准**
- `<命令>` → 预期：<退出码/关键字段>
- 产物检查：<文件存在 + 内容条件>

**预计产物**
- <文件/页面/报告路径>

**编排方式**
- 选择：单 agent / 多智能体 / workflow
- 理由：<改动文件数、是否可并行、是否需要扇出>

**风险与回滚**
- <风险> → <规避或回滚动作>

**需要用户确认**
确认后我再开始执行（回复"确认/开始/可以"即视为授权；在此之前我只做只读探索）。
```

## 已填示例（参考语气与颗粒度）

```markdown
## 执行计划确认单

**目标**：把 examples/three_body_story.md 抽成 JSON，入库后渲染成可打开的关系图。

**任务清单**
1. 抽取 examples/three_body_story.md → out/three_body_extract.json → 验收：validate ok=true
2. 入库 out/three_body_extract.json → 验收：ingest 退出码 0，persons/relations 计数合理
3. 渲染并本地预览 → 验收：render 退出码 0，web/index.html 可打开

**分工**
| 角色 | 负责 | 写作用域 | 依赖 |
| --- | --- | --- | --- |
| 单 agent | 任务 1–3 串行 | `out/`、`data/`、`web/` | 无 |

**写作用域**
- `out/`、`data/people_network.db`、`web/`：单 agent
- 检查：无重叠

**验收标准**
- `.venv\Scripts\python.exe -m people_network validate --input out\three_body_extract.json` → ok=true
- `.venv\Scripts\python.exe -m people_network stats` → persons>0 且 relations>0

**预计产物**
- out/three_body_extract.json、data/people_network.db、web/index.html

**编排方式**
- 选择：单 agent（3 步串行，写库必须串行）
- 理由：无并行收益，涉及同一数据库

**风险与回滚**
- 抽取有歧义 → 保留 notes 与 evidence，先 validate 再入库；失败删 out/ 重做
- 误覆盖数据库 → 先备份 data/people_network.db

**需要用户确认**
确认后我再开始执行。
```

## 常见错误

- 先干了 80% 再补确认单：门禁失效，用户没有真正的决定权。
- 写作用域写"项目根"：等于没切分，必然冲突。
- 验收标准写"效果良好"：不可执行，收尾时无法判定。
- 确认单里出现未确认的第三方文件改动：先说明为什么要动、由谁动，再确认。
