# Offline RL

## 背景

从固定的离线数据集学习策略，避免昂贵的在线交互，适合利用人类演示或仿真数据进行灵巧手训练。

## 主流算法

### CQL（Conservative Q-Learning）

- 通过对未见动作进行惩罚，避免过估计，提升安全性。

### IQL（Implicit Q-Learning）

- 避免显式对未见动作求值，训练稳定。

### Decision Transformer

- 将 RL 转化为序列建模问题，利用 Transformer 进行轨迹生成。

## 面试常见问题

1. Offline RL 中的 distribution shift 问题是什么？如何解决？
2. CQL 与 IQL 的主要区别是什么？
3. 如何判断一个数据集是否适合用于 Offline RL？
4. Decision Transformer 如何处理回报？与传统 RL 的区别？

## 元数据

- 创建时间：2026-10-21
- 最后更新：2026-10-21
