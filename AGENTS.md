# AGENTS

本文件用于定义智能助手在本仓库内的核心职能、上下文加载优先级与基本交互协议。目标是让不同对话、不同执行者产出一致且可复用的工程化结果。

## 核心职能

- 将需求转化为可执行的工程任务与可验证的交付物
- 在实现前输出清晰的方案、约束与验收标准
- 产出具备可维护性、安全性与可追溯性的代码与文档
- 将关键决策、风险、踩坑与进度沉淀到仓库可检索的位置

## 上下文加载优先级

1. `.agents/rules/`：全局规则与约束（最高优先级，多 Agent 通用）
2. `.agents/AGENTS.md`：多 Agent 协作协议与路由约定
3. `.agents/agents/**/agent.md`：各 Agent 角色职责与输入输出契约
4. `.agents/skills/**/SKILL.md`：可复用技能/流程定义
5. `.agents/tools/`：工具脚本（测试、构建、发布等）
6. `.agents/memories/`：跨任务经验与记忆沉淀
7. `.codex/rules/`：Codex 规则与注意事项（单 Agent/对话驱动场景）
8. `.codex/memory/`：Codex 项目记忆（ADR/踩坑/上下文）
9. `.codex/tasks/`：Codex 任务看板（todo / in-progress / done）
10. `.codex/prompts/`：Codex Prompt 库
11. `.codex/templates/`：Codex 模板库
12. `.codex/snippets/`：Codex 代码/命令片段

## 历史兼容（保留但不推荐）

以下为早期约定的 `.agent/` 路径，保留文本以便迁移参考；新项目统一使用 `.agents/`：

1. `.agent/rules/`：全局规则与约束
2. `.agent/memory/project-context.md`：项目背景、阶段目标与术语
3. `.agent/memory/decisions.md`：已采纳的架构决策（ADR）
4. `.agent/tasks/`：当前任务状态（todo / in-progress / done）
5. `.agent/prompts/`：可复用提示词（用于提高一致性与效率）
6. `.agent/templates/`：结构化产出模板（需求、缺陷、变更等）
7. `.agent/snippets/`：常用代码/命令片段（作为参考）

## 基本交互协议

### 输入澄清

- 当需求存在歧义时，优先提出 1–4 个高信息量问题
- 不假设未明确的依赖、平台、权限与安全边界

### 输出标准

- 默认输出要点化结构，便于快速扫描与落地执行
- 与仓库现有风格一致，尽量复用既有工具与模式
- 对重要结论给出可追溯链接或明确的文件路径

### 变更纪律

- 小步提交：优先最小化改动面，减少无关格式化
- 关键决策写入 `.codex/memory/decisions.md` 或 `.agents/memories/`
- 经验教训写入 `.codex/memory/lessons-learned.md` 或 `.agents/memories/`
- 变更摘要维护在 `CHANGELOG.md`

### 验证要求

- 修改应可被验证：至少给出复现/验证步骤或自动化命令
- 不在日志或文档中暴露密钥、Token 与敏感数据
