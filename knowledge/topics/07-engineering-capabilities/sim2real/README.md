# Sim2Real 方法

记录与灵巧手、人形机器人、双臂平台相关的 Sim2Real 主要方法与流派思路。

## 主要流派与方法

### 1. Domain Randomization（域随机化）

- **核心思路**：在训练过程中随机化物理参数（摩擦、质量、阻尼等）、视觉参数（光照、纹理、相机噪声）与动力学参数，使策略对域差异鲁棒。
- **适用**：灵巧操作、人形整身控制、双臂抓取等接触富集任务的常见基线方法。
- **变体**：Automatic Domain Randomization (ADR)、Curriculum-based DR、Foundation Model-guided DR。

### 2. System Identification / Real-to-Sim（系统辨识）

- **核心思路**：用真实数据标定仿真参数（摩擦、惯量、执行器动力学等），缩小仿真与现实的差距。
- **适用**：低成本人形、灵巧手的执行器差异补偿；自动化 real-to-sim tuning。
- **常见做法**：基于轨迹的优化、当前到力矩标定、执行器动力学建模。

### 3. Residual Learning / Residual Policy（残差学习）

- **核心思路**：保留仿真训练的基础策略，在真实环境或精确仿真中学习小的修正网络（residual）。
- **适用**：接触富集的灵巧操作、精密装配、执行器误差补偿。
- **优点**：只需少量真实数据即可显著提升迁移性能。

### 4. Privileged Information & Distillation（特权信息与蒸馏）

- **核心思路**：在仿真中使用特权信息（真实物体状态、精确接触力等）训练 teacher，再蒸馏到仅使用可观测输入的 student。
- **适用**：视觉基灵巧操作、人形整身控制；常与 domain randomization 结合。
- **变体**：Asymmetric Actor-Critic、Teacher-Student distillation。

### 5. Curriculum & Progressive Training（课程与进度式训练）

- **核心思路**：从简单任务或易于探索的初始状态逐步增加难度（接触复杂度、物体多样性、任务长度）。
- **适用**：长视角灵巧操作、双臂协作。

### 6. Hybrid Approaches（混合方法）

- **常见组合**：
  - Domain Randomization + System Identification
  - Residual RL + Privileged Distillation
  - Real-to-Sim tuning + Zero-shot transfer
  - Human video → Sim reconstruction → RL / Residual adaptation（如 DexAgent、Video2Sim2Real 等）
- **实践建议**：对灵巧手与人形，多采用「仿真大规模训练 + 少量真实校准 / residual fine-tuning」。

## 当前挑战（针对灵巧手 / 人形 / 双臂）

- 接触富集任务的物理精度不足
- 执行器动力学与延迟差异
- 视觉与触觉传感的 sim-real 差距
- 高维动作空间的探索效率

## 元数据

- 创建时间：2026-10-21
- 最后更新：2026-10-21
- 来源：近年论文与实践总结
