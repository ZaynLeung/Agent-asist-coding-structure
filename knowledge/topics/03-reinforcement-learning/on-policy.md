# On-Policy 范式

## 背景

On-Policy 方法使用当前策略采集的数据进行更新，训练相对稳定，常用于灵巧手整身控制与接触富集任务。

## 主流算法

### PPO（Proximal Policy Optimization）

- 通过剪裁代理目标函数限制策略更新幅度，平衡稳定性与性能。
- 灵巧手中常与 domain randomization、privileged information 结合使用。

### TRPO（Trust Region Policy Optimization）

- 通过 KL 散度约束保证更新不偏离太远，理论保证较强，但计算更贵。

## 面试常见问题

1. PPO 中 clip 的作用是什么？为什么比 TRPO 更容易实现？
2. On-Policy 与 Off-Policy 的核心区别是什么？在灵巧手中如何选择？
3. Advantage 函数有哪些估计方式？GAE 的优点是什么？
4. 如何在灵巧手任务中减轻 PPO 的方差过大问题？

## 元数据

- 创建时间：2026-10-21
- 最后更新：2026-10-21
