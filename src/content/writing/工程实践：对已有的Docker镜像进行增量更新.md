---
title: "工程实践：对已有的Docker镜像进行增量更新"
description: "如何使用小包对已有的Docker镜像进行增量更新。"
pubDate: "2024-04-20 22:30:12"
---

近期的工作中有这么一个场景：项目代码需要进行频繁的更新，并打包成镜像在客户现场进行部署。由于需要使用CUDA的镜像，因此每次打包完的tar包都有13G之多。为了解决每次更新都会出现的传输过慢问题，我们采用了大镜像包+小更新镜像包的方式。

思路很简单，就是先构建一个大的基础包，每次将需要更新的内容传进容器，再build一个新版本。

# 基础镜像

首先，我们有一个基础镜像的服务：

```yaml
version: '3.1'

services:
  # cuda_base:
  #   platform: linux/amd64
  #   build: 
  #     context: ../infers
  #     dockerfile: Dockerfile.base
  #   image: behavior-detector-cuda-base:${TAG}
    
  frontend:
    platform: linux/amd64
    build: 
      context: ../frontend
      dockerfile: Dockerfile
    image: behavior-detector-frontend:${TAG}

  infers:
    platform: linux/amd64
    build: 
      context: ../infers
      dockerfile: Dockerfile
      args:
        - TAG=${TAG}
    image: behavior-detector-infers:${TAG}
    # depends_on:
    #   - cuda_base

  backend:
    platform: linux/amd64
    build: 
      context: ../backend
      dockerfile: Dockerfile
      args:
        - TAG=${TAG}
    image: behavior-detector-backend:${TAG}
    depends_on:
      - frontend
```

通过构建以上的`compose`文件，就能得到前后端和推理端的基础镜像。

# 更新包脚本

我们通常在项目的各个路径下进行开发。当我们把`infers`或者`backend`开发完毕后，就需要对这两个项目的文件夹进行打包。为此，我们定义一个`save_patch.sh`来将内容进行打包。

```sh
#! /usr/bin/env bash
PROJECT_DIR=$(cd `dirname $0`/..; pwd)

. .env
# 加载.env文件 设置临时环境变量

# 获取上一层目录的绝对路径

tar -cvf infers_patch_${TAG}.${PATCH_VERSION}.tar -C ${PROJECT_DIR}/infers/ .

tar -cvf backend_patch_${TAG}.${PATCH_VERSION}.tar -C ${PROJECT_DIR}/backend/ .
```

上面的脚本做了两件事，读取配置文件；将推理和后端的文件夹`infers`和`backend`打成tar包。

# 加载包脚本

当我们拿到了更新包以后，就需要将包导入到已有的镜像，并发布一版新镜像。这里给出一个`load_patch.sh`。

```sh
#! /usr/bin/env bash

# 加载.env文件 设置临时环境变量
. .env

# 当前目录
CURRENT_DIR=$(cd `dirname $0`; pwd)

\cp -rf ${CURRENT_DIR}/infers_patch_${TAG}.${PATCH_VERSION}.tar infers_patch.tar
\cp -rf ${CURRENT_DIR}/backend_patch_${TAG}.${PATCH_VERSION}.tar backend_patch.tar
docker compose  -f docker-compose.patch.yaml build
```

这里做的几件事：将更新包复制成`infers_path.tar`和`backend_patch.tar`。这两个包会被之后的`compose`文件使用来构建镜像。

# Docker Compose Patch

构建更新后的镜像需要用到`docker compose.patch.yaml`文件：

```yaml
version: '3.1'

services:
  infers:
    platform: linux/amd64
    # 定义构建的上下文
    build: 
      context: .
      dockerfile: Dockerfile.infers.patch
      args:
        - TAG=${TAG}
        - PATCH_VERSION=${PATCH_VERSION}
    # 定义构建的镜像标签
    image: behavior-detector-infers:${TAG}.${PATCH_VERSION}

  backend:
    platform: linux/amd64
    build: 
      context: .
      dockerfile: Dockerfile.backend.patch
      args:
        - TAG=${TAG}
        - PATCH_VERSION=${PATCH_VERSION}
    image: behavior-detector-backend:${TAG}.${PATCH_VERSION}
```

当我们build的时候，就会生成两个镜像：`behavior-detector-infers`和`behavior-detector-backend`。


# 更新包Dockfile

项目中频繁更新的部分是`infers`和`backend`容器，因此为这两个部分的更新包单独写Dockerfile。

后端更新包：

```dockerfile
ARG TAG=1.0.0
ARG PATCH_VERSION=1
FROM behavior-detector-backend:${TAG}

# 设置工作目录
WORKDIR /backend_app

# 删除目录下的文件
RUN rm -rf /backend_app/*

# 复制项目文件
COPY backend_patch.tar /backend_app/
RUN tar xvf /backend_app/backend_patch.tar -C /backend_app

# 暴露端口号
# 80 前端服务
EXPOSE 80
# python 服务
EXPOSE 7091
EXPOSE 7092
EXPOSE 7093

# 启动 FastAPI 应用
CMD ["bash", "start.sh"]
```

推理更新包：

```dockerfile
ARG TAG=1.0.0
ARG PATCH_VERSION=1
FROM behavior-detector-infers:${TAG}

# 设置工作目录
WORKDIR /infer_app

# 复制项目文件
RUN rm -rf /infer_app/*

COPY infers_patch.tar /infer_app/
RUN tar xvf /infer_app/infers_patch.tar -C /infer_app

# 暴露端口
EXPOSE 58090

# 默认命令
CMD ["bash", "start.sh", "prod"]
```

# Docker Compose Prod

最后还需要有一个实际部署的`docker compose`文件，这个文件是实际真正部署的容器镜像：

```yaml
version: '3.1'
services:
  redis-service:
    image: redis:latest
    restart: always
    ports:
      - "6379:6379"

  detector-service-api:
    image: behavior-detector-backend:${TAG}.${PATCH_VERSION}
    restart: always
    environment:
      - RUNTIME_ENV=prod
      - RUNTIME_SERVICE_TYPE=api

      - POSTGRESQL_HOST=xxxx
      - POSTGRESQL_PORT=xxxx
      - POSTGRESQL_DBNAME=xxxx
      - POSTGRESQL_USER=xxxx
      - POSTGRESQL_PASSWD=xxxx

      - REDIS_HOST=xxxx
      - REDIS_PORT=6379
      - REDIS_PASSWD=

    volumes:
      - /app/logs:/app/logs
      - /app/captures:/app/captures
      - /app/targets:/app/targets
      - /app/html:/app/html
      
    ports:
      - "7901:80"
      
    depends_on:
      - redis-service

  detector-service-stream:
    image: behavior-detector-backend:${TAG}.${PATCH_VERSION}
    restart: always
    environment:

      - RUNTIME_ENV=prod
      - RUNTIME_SERVICE_TYPE=stream

      - POSTGRESQL_HOST=xxxx
      - POSTGRESQL_PORT=xxxx
      - POSTGRESQL_DBNAME=xxxx
      - POSTGRESQL_USER=xxxx
      - POSTGRESQL_PASSWD=xxxx

      - REDIS_HOST=xxxx
      - REDIS_PORT=6379
      - REDIS_PASSWD=

    volumes:
      - /app/logs:/app/logs
      - /app/captures:/app/captures
      - /app/targets:/app/targets
      - /app/html:/app/html

    depends_on:
      - redis-service
      
  staytime:
    image: behavior-detector-infers:${TAG}.${PATCH_VERSION}
    restart: always
    ports:
      - "58093:58090"
    volumes:
      - /app:/app
    environment:
      - ENV_MODEL_NAME=staytime
      - ENV_GUNICORN_WORKERS=1
      - ENV_CUDA_DEVICE=0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [ gpu ]
```

实际使用中，使用`docker compose -f docker-compose.prod.yaml up -d`即可进行部署。



2024/4/22 于苏州