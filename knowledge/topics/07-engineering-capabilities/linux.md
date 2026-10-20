# Linux

## 主要用途

- 服务器与开发环境的基础操作系统
- 进程管理、文件操作、网络配置、脚本自动化
- 机器人实验与仿真环境的常见宿主系统

## 常用命令

```bash
# 文件与目录
ls -la
cd /path
cp -r src dest
mv old new
rm -rf dir

# 查看与搜索
cat file
less file
grep -r "keyword" .
find . -name "*.py"

# 进程与系统
ps aux
top
htop
kill -9 PID
df -h
free -h

# 权限与用户
sudo command
chmod +x script.sh
chown user:group file

# 网络
ping host
ssh user@host
scp file user@host:/path
```

## 使用须知

- 生产环境操作前先确认命令影响范围，避免误删
- 优先使用 `sudo` 而非直接以 root 运行
- 重要操作前做好备份或在容器/虚拟机中测试
- 脚本建议添加错误处理与日志

## 元数据

- 创建时间：2026-10-20
- 最后更新：2026-10-20
- 来源：常用实践总结
