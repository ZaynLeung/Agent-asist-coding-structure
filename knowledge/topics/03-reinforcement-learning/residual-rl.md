# Residual / Hybrid RL

## 背景

将强化学习与其他方法（演示学习、仿真策略、经典控制）结合，通过学习残差策略来精调或补偿，常用于 Sim2Real 与灵巧手精确操作。

## 主流算法

### Residual Policy Learning

- 在基础策略（仿真或 IL）之上学习小的修正策略，仅需少量数据。

### RL + Imitation Learning

- 先用 IL 获得初始策略，再用 RL 进行精调（或相反）。

### Asymmetric Actor-Critic

- Critic 使用特权信息，Actor 仅使用可观测输入，常用于视觉灵巧操作。

## 面试常见问题

1. Residual Policy 与直接精调全策略的优劣是什么？
2. 如何选择 residual 的动作空间范围？
3. Privileged information 在灵巧手训练中如何使用？如何蒸馏？
4. Residual RL 如何与 domain randomization 结合提升 Sim2Real 性能？

## 元数据

- 创建时间：2026-10-21
- 最后更新：2026-10-21
