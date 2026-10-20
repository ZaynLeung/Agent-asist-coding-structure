# Docker

## 主要用途

- 环境一致性与可复现性：打包依赖、仿真器、训练环境
- 快速部署与隔离：机器人控制、模型服务、实验环境
- 便于分发与协作

## 常用命令

```bash
# 镜像与容器
docker pull image:tag
docker images
docker run -it --rm image bash
docker run -d -p 8080:8080 --name myapp image
docker ps
docker stop container
docker rm container

# 构建与推送
docker build -t myimage:tag .
docker tag myimage:tag registry/myimage:tag
docker push registry/myimage:tag

# 调试与查看
docker logs container
docker exec -it container bash
docker inspect container

# 清理
docker system prune
docker volume ls
docker network ls
```

## 使用须知

- 镜像尽量精简，多阶段构建以减小体积
- 生产环境避免使用 `latest` 标签，固定版本
- 敏感数据不要写入镜像，使用环境变量或密钥管理
- GPU 支持需要安装 nvidia-docker / NVIDIA Container Toolkit
- 大文件与数据集建议使用 volume 挂载

## 元数据

- 创建时间：2026-10-20
- 最后更新：2026-10-20
- 来源：常用实践总结
