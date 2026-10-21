# 强化学习范式索引（灵巧手操作向）

## 范式列表

1. [On-Policy](on-policy.md)
   - 主流算法：PPO、TRPO
   - 常用于：稳定训练、整身与灵巧控制

2. [Off-Policy](off-policy.md)
   - 主流算法：SAC、TD3、DDPG
   - 常用于：样本效率优先、连续控制

3. [Offline RL](offline-rl.md)
   - 主流算法：CQL、IQL、Decision Transformer
   - 常用于：利用离线数据、避免在线探索

4. [Hierarchical RL](hierarchical-rl.md)
   - 主流算法：Options、Feudal RL、HIRO
   - 常用于：长视角任务、技能组合

5. [Residual / Hybrid RL](residual-rl.md)
   - 主流算法：Residual Policy Learning、RL + IL
   - 常用于：Sim2Real 精调、与演示学习结合

## 关系说明

- On-Policy 与 Off-Policy 是基础范式
- Offline 与 Hierarchical 常用于降低数据成本与提升长视角能力
- Residual 常与 Sim2Real 结合使用
