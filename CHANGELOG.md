# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，并使用语义化版本 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 初始化机器人学知识库框架（`knowledge/` 目录、主题占位、资源与模板）
- 新增 ADR-0002：将仓库转型为机器人学知识库
- 新增工程能力主题（Linux、Docker、Git 基础总结）
- 新增 Sim 仿真平台与 Sim2Real 方法子主题（针对灵巧手、人形、双臂）
- 强化学习主题按范式重构，新增灵巧手操作相关范式与面试问题
- 新增遥操作与运动重定向主题（08）
- 新增控制基础主题（09）：运动学逆解、动力学与最优控制、MPC
- 灵巧手主题新增平台、力控触觉、操作感知子栏目
- 强化学习主题新增仿真学习、目标条件学习、多智能体学习子栏目
- 新增目录标题图数据契约 `knowledge/graph/schema.md`：图结构只管理主题/子目录/条目标题与关系，正文与全文仍由 `knowledge-*` 内容 skill 处理
- 新增 `knowledge-lead`：标注全部可用 skill 的知识库任务编排器（先计划确认、再按复杂度编排、最后集成验收）
- 新增 `knowledge-outline-extract`：资料 → 目录标题图提案（取代人际网 `people-network-extract`）
- 新增 `knowledge-graph-db` / `knowledge-graph-viz`：目录标题图的校验/入库/统计与自包含 HTML 可视化（取代人际网 `people-network-db` / `people-network-viz`）

### Changed

- 5 个 skill 补齐 YAML frontmatter（`code-review`、`knowledge-add-entry`、`knowledge-update-index`、`knowledge-audit`、`knowledge-ingest-paper`），修复因缺少 frontmatter 导致的「调用不到」
- 人际网（people-network）四个 skill 整体改造为知识库目录标题图工作流，目录与 `name` 同步改名
- 更新项目定位与 README、project-context、tasks
- 更新知识库导航，加入工程能力主题
- 更新工程能力目录，加入 sim 与 sim2real
- 强化学习主题从单文件转为目录结构
- 更新主题地图，加入遥操作与控制基础主题

### Fixed

- `skill-creator` 补充用户面验证：`/` 菜单可见性与 `/name` 实际触发校验、用户面缺失排查、会话缓存与工作区权限两类失败模式

## [1.0.0] - 2026-10-02

### Added

- 项目骨架首次发布
