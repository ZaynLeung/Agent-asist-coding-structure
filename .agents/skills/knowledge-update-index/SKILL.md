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
