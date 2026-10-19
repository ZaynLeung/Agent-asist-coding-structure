# 智能助手模板项目 · 机器人学知识库

一个面向工程化协作的 Codex 智能助手项目骨架，同时作为**机器人学、灵巧手、移动与操作、强化学习、持续学习与部署后学习**的可追溯知识库。

## 目录结构

- `knowledge/`：机器人学知识库内容（主题、资源、模板）
- `.agent/rules/`：全局规则与编码规范
- `.agent/prompts/`：可复用 Prompt 库（通用/重构/审查）
- `.agent/templates/`：Bugfix/Feature 等标准化模板
- `.agent/snippets/`：常用代码与命令片段
- `.agent/tasks/`：Todo/In-Progress/Done 任务看板
- `.agent/memory/`：ADR/踩坑记录/项目上下文
- `.agent/scripts/`：初始化与同步脚本

## 知识库入口

详见 [knowledge/README.md](knowledge/README.md)。

## 使用指南

### 规则加载（建议）

- 默认以 `.agent/rules/` 作为最高优先级的行为约束
- 需求澄清与产出格式参考 `.agent/prompts/` 与 `.agent/templates/`
- 过程信息与结论沉淀到 `.agent/memory/`，并用 `.agent/tasks/` 维护进度

### 推荐工作流

1. 在 `.agent/tasks/todo.md` 写入需求拆解与优先级
2. 选择对应模板：新功能用 `feature-template.md`，缺陷修复用 `bugfix-template.md`
3. 实施改动后，把关键决策写入 `decisions.md`（ADR 格式）
4. 将已完成事项从 `in-progress.md` 移动到 `done.md`

## 许可证

见 [LICENSE](LICENSE)。
