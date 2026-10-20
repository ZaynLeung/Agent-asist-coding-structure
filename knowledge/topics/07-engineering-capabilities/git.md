# Git

## 主要用途

- 版本控制与协作
- 代码、实验记录、知识库内容的可追溯管理
- 支持分支开发、Code Review 与发布流程

## 常用命令

```bash
# 基础操作
git status
git add .
git commit -m "message"
git push
git pull

# 分支
git branch
git checkout -b feat/xxx
git checkout main
git merge feat/xxx

# 查看历史
git log --oneline
git diff
git show commit

# 撤销与回滚
git restore file
git reset --soft HEAD~1
git rebase main

# 远程
git remote -v
git fetch
git clone url
```

## 使用须知

- 提交信息应清晰描述变更内容与原因
- 避免将大文件、密钥、数据集直接提交到仓库（使用 .gitignore）
- 合并前先 pull / rebase 保持分支更新
- 重要变更通过 Pull Request 进行审查
- 知识库内容更新建议也走分支 + PR 流程

## 元数据

- 创建时间：2026-10-20
- 最后更新：2026-10-20
- 来源：常用实践总结
