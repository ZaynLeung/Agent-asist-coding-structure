---
name: knowledge-ingest-paper
description: 从论文或项目链接提炼可直接落盘的知识条目骨架：背景、方法、结论、局限、开放问题、核心资源，并给出待补全清单（待验证事实、对比基线、建议落盘路径与同步动作），不确定信息显式标注，输出可粘贴进 knowledge/templates/knowledge-entry.md 完善。用户说“这篇论文入库”“帮我读这篇 paper 整理成知识条目”“把这个项目链接整理进知识库”“先给我一个条目骨架”时使用。
whenToUse: 用于从外部论文/项目链接先产出骨架与 Action Items，不直接定稿落盘。骨架要正式写入 knowledge/ 用 knowledge-add-entry；主题索引导航用 knowledge-update-index。
---

# SKILL: knowledge-ingest-paper

## 目标

从论文/项目链接提炼一个“可落地的知识条目骨架”，并产出待补全清单，方便后续快速完善为 `knowledge/` 中的正式条目。

## 输入要求

- urls：论文/项目链接列表（至少 1 个）
- topic：建议归属主题（可选；不确定时由 Librarian 给出候选主题）
- title：条目标题（可选；默认从论文标题/项目名抽取）
- focus：论文 | 项目 | 混合（默认：混合）

## 输出内容（条目骨架）

- 背景：问题定义、为何重要、与本仓库主题的关系
- 方法：核心方法、关键假设、与既有方法差异
- 结论：主要结果、指标、适用边界
- 局限：失败案例、依赖条件、已知缺口
- 开放问题：下一步值得研究/补全的点
- 核心资源：论文/代码/数据集/复现实验链接（带一句话摘要）

## 待补全清单（Action Items）

- 需要进一步确认的事实点（标注“不确定/待验证”）
- 推荐补充的对比基线/相关工作
- 建议落盘位置：`knowledge/topics/<topic>/` 下的候选文件名
- 建议同步动作：是否需要更新主题 README / `knowledge/index.md`

## 交付要求

- 输出应可直接粘贴到 `knowledge/templates/knowledge-entry.md` 进行完善
- 不确定信息必须显式标注并给出验证路径（论文段落/代码位置/实验设置）
