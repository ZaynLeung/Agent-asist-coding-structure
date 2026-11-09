---
name: knowledge-update-index
description: 维护 knowledge/index.md 的主题地图与导航一致性：扫描 knowledge/topics/ 下的主题目录与 README 入口，比对主题列表和链接有效性，更新主题地图与关系说明并补交叉引用，最后在 CHANGELOG 的 [Unreleased] 记录结构调整，同时列出缺 README、命名不一致、链接失效等问题。用户说“更新知识库索引”“新增了主题帮我加到 index”“index 里的链接失效了”“主题地图和目录对不上”时使用。
whenToUse: 用于主题级结构变化后的索引导航同步（新增、重命名、移动主题，入口链接失效或缺失）。写单个条目内容用 knowledge-add-entry；全库审计与修复清单用 knowledge-audit。
---

# SKILL: knowledge-update-index

## 目标

维护 `knowledge/index.md` 的主题地图与导航一致性，确保新增主题/移动文件后仍可一键定位与检索。

## 适用场景

- 新增 `knowledge/topics/<xx-*>/` 主题
- 调整主题命名或层级
- 主题 README/入口链接失效或不一致

## 输入要求

- change_summary：本次结构变化概述
- expected_topics：期望存在的主题列表（可选）

## 执行步骤

1. 扫描 `knowledge/topics/` 下的主题目录与 README 入口
2. 对比 `knowledge/index.md` 的主题列表与链接有效性
3. 更新主题地图与“关系说明”，必要时补充交叉引用建议
4. 在 `CHANGELOG.md` 的 [Unreleased] 下记录结构调整

## 输出

- 修改后的主题列表与链接
- 潜在问题清单（缺 README、命名不一致、链接失效）
