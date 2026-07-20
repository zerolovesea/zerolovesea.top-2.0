---
title: "Docker必备指南"
description: "Docker相关博文。"
pubDate: "2024-03-16 18:59:47"
---

此前写过的Docker相关的博文：

- [工程实践：使用Docker打包自己的项目](https://zerolovesea.github.io/2024/01/19/工程实践：使用Docker打包自己的项目/)
- [工程实践：Docker入门技巧](https://zerolovesea.github.io/2024/01/23/工程实践：Docker入门技巧/)

- [工程实践：实操项目中的Docker操作](https://zerolovesea.github.io/2024/01/25/工程实践：实操项目中的Docker操作/)

- [Docker实践挖坑细节](https://zerolovesea.github.io/2024/01/27/Docker实践挖坑细节/)

- [Dockfile编写指南](https://zerolovesea.github.io/2024/01/27/Dockfile编写指南/)
- [Docker部署CUDA/CUDANN ](https://zerolovesea.github.io/2024/02/07/Docker部署CUDA-CUDANN/)
- [Docker Compose编写指南](https://zerolovesea.github.io/2024/04/20/Docker-Compose编写指南/)
- [工程实践：对已有的Docker镜像进行增量更新](https://zerolovesea.github.io/2024/04/20/工程实践：对已有的Docker镜像进行增量更新/)

# 如何安装Docker？

[Installing the NVIDIA Container Toolkit — NVIDIA Container Toolkit 1.14.5 documentation](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

# 如何配置深度学习的Docker环境？

以下是一个简单的演示：

```bash
docker run --gpus all -it --rm -p 8888:8888 -v /home/whaow:/workspace nvcr.io/nvidia/pytorch:xx.xx-py3
```

其中`--rm`指运行后删除，`--gpus all`指将所有显卡都映射到docker中，`xx.xx`指的是docker --version的版本。这会拉取英伟达的pytorch镜像。

# Docker读写文件操作

`docker cp`能够实现容器内和宿主机的文件读写：

`docker cp 容器中的文件路径:宿主机的文件路径`

也可以互换来拷贝宿主机的文件进容器。

2024/3/16 于苏州