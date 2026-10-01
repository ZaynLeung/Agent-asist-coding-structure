# Codex 智能助手项目

一个面向工程化协作的 Codex 智能助手项目骨架：提供统一的规则、提示词库、模板库、任务看板与项目记忆，便于在多轮对话中保持一致的产出质量与可追溯性。

## 目录结构

- `.codex/rules/`：全局规则与编码规范
- `.codex/prompts/`：可复用 Prompt 库（通用/重构/审查）
- `.codex/templates/`：Bugfix/Feature 等标准化模板
- `.codex/snippets/`：常用代码与命令片段
- `.codex/tasks/`：Todo/In-Progress/Done 任务看板
- `.codex/memory/`：ADR/踩坑记录/项目上下文
- `.codex/scripts/`：初始化与同步脚本

## 安装与初始化

1. 克隆仓库

```bash
git clone <your-repo-url>
cd Agent-asist-coding-structure
```

2. 初始化目录与文件

```bash
bash .codex/scripts/init.sh
```

## 使用指南

### 规则加载（建议）

- 默认以 `.codex/rules/` 作为最高优先级的行为约束
- 需求澄清与产出格式参考 `.codex/prompts/` 与 `.codex/templates/`
- 过程信息与结论沉淀到 `.codex/memory/`，并用 `.codex/tasks/` 维护进度

### 推荐工作流

1. 在 `.codex/tasks/todo.md` 写入需求拆解与优先级
2. 选择对应模板：新功能用 `feature-template.md`，缺陷修复用 `bugfix-template.md`
3. 实施改动后，把关键决策写入 `decisions.md`（ADR 格式）
4. 将已完成事项从 `in-progress.md` 移动到 `done.md`

## 许可证

见 [LICENSE](LICENSE)。
