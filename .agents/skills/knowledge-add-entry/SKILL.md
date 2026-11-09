---
name: knowledge-add-entry
description: 在 knowledge/ 下新增或补全一个知识条目：先读 knowledge/index.md 与目标主题 README 确认归属和命名风格，按 knowledge/templates/knowledge-entry.md 生成内容，更新主题 README 或主题内索引，必要时同步 knowledge/index.md，并在 CHANGELOG 的 [Unreleased] 记录。用户说“把这个知识点加进知识库”“新建一个条目”“补全这个条目”“这条目内容不完整帮我补齐”时使用。
whenToUse: 用于单条知识内容的写入或补全。只改主题地图与导航链接用 knowledge-update-index；全库体检出修复清单用 knowledge-audit；从论文链接先出条目骨架用 knowledge-ingest-paper。
---

# SKILL: knowledge-add-entry

## 目标

在 `knowledge/` 中新增或补全一个知识条目，确保结构合规、可检索，并同步必要的导航与变更记录。

## 输入要求

- topic：目标主题目录（如 `knowledge/topics/08-teleoperation-retargeting/`）
- title：条目标题（中文或英文均可）
- filename：建议文件名（可选；未提供则根据标题生成）
- sources：来源（论文链接/项目链接/会议/个人实验记录）
- intent：新增 | 补全 | 重写（默认：补全）

## 执行步骤

1. 读取 `knowledge/index.md` 与目标主题 `README.md`，确认条目归属与命名风格
2. 以 `knowledge/templates/knowledge-entry.md` 为模板生成条目内容
3. 更新主题 README 或主题内索引文件（如存在 `index.md`）以提供入口
4. 如涉及结构变更，同步更新 `knowledge/index.md`
5. 在 `CHANGELOG.md` 的 [Unreleased] 下记录新增/更新内容

## 输出格式

- 新增/修改的文件列表（含路径）
- 条目摘要：关键概念、核心资源、开放问题
- 后续建议：推荐补充的相关条目与交叉链接
