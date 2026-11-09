# 《执行计划确认单》模板

在用户确认前填好这七项，放进回复；缺项的确认单不合法。

## 1. 任务清单

- 一句话目标（可验证的结果，不是动作）：
- 拆解步骤（编号，一步一件事）：
- 明确不做的范围（out of scope）：

## 2. 分工

- 单 agent / 多智能体 / workflow（写明理由）：
- 每个执行单元：负责 skill + 负责的目录/文件 + 交付物：

## 3. 写作用域

| 执行单元 | 允许写的路径 | 允许读的路径 |
| --- | --- | --- |
|  |  |  |

规则：结构层写 `knowledge/graph/`、`out/`；内容层写 `knowledge/topics/`、`knowledge/index.md`、`knowledge/resources/`。两行路径不得重叠，重叠就重新切分。

## 4. 验收标准

每条都必须能被一条命令或一个检查判定，例如：

- `node .agents/skills/knowledge-graph-db/scripts/graph.mjs validate` 退出码 0、`errors=[]`
- `scan.mjs` 产出的 nodes/edges 数量与预期一致
- `knowledge/index.md` 里每个链接目标文件存在
- `validate-skill.mjs <skill>` 退出码 0、0 警告

## 5. 预计产物

- 图数据：`knowledge/graph/outline.graph.json`（新增/变更节点数与边数）
- 可视化：`knowledge/graph/outline.html`
- 内容条目：新增/修改的 `knowledge/topics/**/*.md` 清单
- 报告：修复清单或变更摘要的落点

## 6. 是否需要多智能体 / workflow

- 需要多智能体：≥2 个互不依赖的大块，写作用域完全不重叠，且各自有独立验收命令。
- 需要 workflow：≥3 个同构子任务批量扇出（逐主题巡检、逐批资料抽取）。
- 都不满足：单 agent 串行，别为了并行而并行。

## 7. 风险与回滚

- 风险：覆盖已有条目、图数据与目录不一致、索引链接失效、验证命令不可复现。
- 回滚：改动前 `git status` 确认基线；图数据可 `git checkout -- knowledge/graph/outline.graph.json`；内容改动按文件粒度回滚；不用手工删图重来。
