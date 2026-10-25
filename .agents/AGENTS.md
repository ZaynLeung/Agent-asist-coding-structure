# .agents/AGENTS

本目录用于跨不同软件/IDE/Agent 框架复用的“多 Agent 协作层”。目标是用一个稳定的目录约定，让不同执行器能够：

- 发现可用 Agent（角色与能力）
- 发现可用 Skills（可复用流程与审查模板）
- 发现可用 Tools（脚本与自动化命令）
- 共享 Memory（经验沉淀与跨任务复用）
- 统一 Rules（风格与安全约束）

## 加载优先级（建议）

1. `.agents/rules/`：全局规则与风格（最高优先级）
2. `.agents/AGENTS.md`：多 Agent 总协议与路由约定
3. `.agents/agents/**/agent.md`：各 Agent 角色职责与输入输出契约
4. `.agents/skills/**/SKILL.md`：可复用技能/流程定义（如 code-review）
5. `.agents/tools/`：可执行工具脚本（如 run-tests.sh）
6. `.agents/memories/`：跨任务复用的记忆与经验

## 多 Agent 协作协议

### 角色划分

- Orchestrator：负责分解任务、路由给合适的 Agent、汇总结果与验收
- Coder：实现功能、修复缺陷、补充测试与文档
- Reviewer：代码审查、安全审计、可维护性与性能建议
- Tester/CI：执行测试、构建、静态检查与回归验证

### 任务契约（Task Contract）

每个任务建议以以下要素描述（可写入外部任务系统或对话上下文）：

- 目标：要达成的可验证结果
- 范围：in/out
- 约束：平台、语言、依赖、权限、安全边界
- 产物：哪些文件/接口/报告
- 验收：如何验证（命令/步骤/用例）

### 路由规则（Routing）

- 需要实现/修复：优先交给 `agents/coder`
- 知识库相关（新增条目/补全条目/维护索引/审计）：优先交给 `agents/librarian`
- 需要质量把关：优先交给 `skills/code-review`
- 需要验证闭环：优先使用 `tools/run-tests.sh` 或接入 CI
- 需要沉淀经验：补充到 `memories/`（避免只存在于对话历史）

## 兼容与跨软件使用建议

- 保持目录稳定：只增加内容，不随工具变更而改名
- Skill/Tool 都应可独立阅读与运行：避免依赖特定 IDE 私有语法
- 脚本尽量 POSIX sh：在 Linux/macOS/WSL/CI 环境更通用

## 可选内容库（迁移自 .agent）

- `.agents/prompts/`：高频 Prompt（需求澄清/重构/审查）
- `.agents/templates/`：结构化模板（feature/bugfix）
- `.agents/snippets/`：代码与命令片段
- `.agents/tasks/`：任务看板（todo/in-progress/done），适合多 Agent 协作时共享进度
