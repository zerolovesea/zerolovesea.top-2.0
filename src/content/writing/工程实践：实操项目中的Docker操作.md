---
title: "工程实践：实操项目中的Docker操作"
description: "Docker在工程项目中的使用，以及Docker Compose的使用。"
pubDate: "2024-01-25 20:14:50"
---

工作的时候，接触到的就不是[上一篇](https://zerolovesea.github.io/2024/01/23/%E5%B7%A5%E7%A8%8B%E5%AE%9E%E8%B7%B5%EF%BC%9ADocker%E5%85%A5%E9%97%A8%E6%8A%80%E5%B7%A7/)中提到的Docker用法了，而是更复杂的镜像文件，这一篇博客就讲一下一些工程上的Docker用例。

# 打包项目镜像

前面其实已经提过了如何打包项目镜像，不过这里再细讲一遍：

我们的项目结构大致如下：

```bash
project/
|-- frontend/
|   |-- Dockerfile
|   |-- ... (其他前端项目文件)
|-- docker/
|   |-- Dockerfile
|   |-- ... (其他与Docker构建相关的文件)
|-- ... (其他项目文件)

```

这里，我们希望把前后端文件夹打包成镜像，以迁移到新的环境。那么我们需要再项目根目录执行以下指令：

```bash
cd ../frontend
docker build -t project-frontend -f Dockerfile . --no-cache

cd ../docker
docker build -t project-detector:v0.1 -f Dockerfile ../ --no-cache
```

解读一下上面做了什么：

- 首先，将前端打包成镜像，使用`-t`命名tag为`project-frontend`，然后使用`-f`指定使用的是当前目录[frontend]的Dockerfile。
- 然后进入docker文件夹，并使用该目录[docker]的Dockerfile构建镜像。

# 编写Dockerfile

> 什么是Dockerfile？
>
> Dockerfile是构建镜像的蓝图。 `docker pull` 用于获取已有的基础镜像，`docker run` 用于基于镜像运行容器。

我们简单看下Dockerfile怎么写，首先是前端的Dockerfile：

```dockerfile
# 使用官方的 Node.js 镜像作为基础镜像
FROM node:lts-alpine as builder

# 设置环境变量，并设置为工作目录
ENV PROJECT_DIR=/project-admin
WORKDIR $PROJECT_DIR

# 安装pnpm
RUN npm install -g pnpm

# 构建项目
COPY ./ $PROJECT_DIR

# 删除.env并执行pnpm build
RUN rm -rf .env.* && pnpm build
```

然后是docker目录的Dockerfile：

```dockerfile
# 使用官方 Python 3 镜像作为基础镜像
FROM python:3.11-bookworm

COPY ./docker/debian-sources.list /etc/apt/sources.list
RUN rm -rf /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y vim \
    && apt-get install -y libgl1-mesa-glx \

COPY  --from=project-frontend:latest /project-admin/dist/ /var/www/html
COPY ./docker/nginx.default.conf /etc/nginx/sites-available/default

# 设置工作目录
WORKDIR /app
# 复制当前目录下的所有文件到容器的 /app 目录
COPY ./backend /app/

# 安装项目依赖
RUN pip install -r requirements.txt

# 暴露端口号
EXPOSE 80
# 暴露python服务的端口号
EXPOSE 7091

# 执行命令行
CMD ["bash", "start.sh", "prod"]
```

# 将Docker镜像进行保存迁移

在客户无网环境的时候，无法直接使用Dockerfile来下载镜像，这时候就需要将镜像进行打包，指令如下：

```bash
docker save -o project-v0.1.tar project:v0.1

zip -r project-v0.1.tar.zip project-v0.1.tar
```

上面的指令进行了两个操作：

- `docker save`: 将 Docker 镜像保存为一个 tar 归档文件。
- `-o `: 指定输出文件的名称。

在打包完毕之后，就可以将zip压缩包移动至生产环境进行解压。

在生产环境解压后加载tar文件，这将在目标环境中还原，指令如下：

```bash
docker load -i project-v0.1.tar
```

# 使用Docker Compose启动Docker

加载完成后，就需要启动Docker，这里的代码如下：

```bash
docker compose -f docker-compose.service.prod.yaml up -d
```

这里用到了`docker compose`指令，该指令能够读取yaml配置文件来批量加载镜像文件，我们可以看一下这个配置文件是怎么写的：

```yaml
version: '3'
services:
  project:
    image: project
    restart: always
    volumes:
      - /app/logs:/app/logs
      - /app/captures:/app/captures
      - /app/targets:/app/targets
      - /app/html:/app/html
      - ./envs/prod/env.prod.ini:/app/env.prod.ini
      - ./envs/prod/config:/app/config
    ports:
      - "7901:80"
      
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      # The password for the default postgres user.
      POSTGRES_PASSWORD: Fzd_1qaz2wsx
      # The name of the default postgres database.
      POSTGRES_DB: postgres
      # postgres data directory
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ./volumes/db/data:/var/lib/postgresql/data
    ports:
      - "52345:5432"

  # The redis cache.
  redis:
    image: redis:6-alpine
    restart: always
    volumes:
      # Mount the redis data directory to the container.
      - ./volumes/redis/data:/data
    # Set the redis password when startup redis server.
    command: redis-server --requirepass Fzd_1qaz2wsx
    ports:
      - "56379:6379"
```

这里实际上是声明了不同镜像的版本和卷管理，具体解释如下：

- `version: '3'`: 指定 Docker Compose 文件的版本，改变它会改变Compose文件的语法。目前3是最流行的版本。
- `services`: 定义了一个或多个服务。在这里，只定义了一个服务名为 "project"。
- `project`: 这是服务的名称。
  - `image: project:v0.1`: 指定了 Docker 镜像的名称。
  - `restart: always`: 设置容器在退出时总是重新启动。
  - `volumes`: 定义了容器和主机之间的数据卷映射。这些映射用于将容器内的路径映射到主机上的相应路径。
    - `/app/logs:/app/logs`: 将容器内的 "/app/logs" 路径映射到主机上的 "/app/logs"，实现数据的持久化。
    - 其他类似的 `volumes` 条目也是为了将容器内的路径映射到主机上，以实现数据的持久化。
  - `ports`: 定义了容器和主机之间的端口映射。
    - `"7901:80"`: 将容器的 80 端口映射到主机的 7901 端口。这意味着，通过访问主机的 7901 端口，可以访问容器内运行的服务的 80 端口。

2024/1/25 于苏州家中
