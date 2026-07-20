---
title: 工程实践：使用Docker打包自己的项目
date: 2024-01-19 21:48:01
tags: 
  - Docker
  - 工程实践
categories: 工程实践
excerpt: 如何构建和使用Docker镜像。
index_img: "/img/docker.jpg"
---

Docker的重要性是老生常谈的话题了，无非就是那些工程部署上的好处。由于之前对Linux不熟悉，所以基本没有接触过它，最近工作中正好用到了，所以干脆研究一下。

# 项目路径设置

首先，我们要了解项目的路径结构是什么样的：

```bash
/project-root
│
├── Dockerfile # 将要创建的Dockerfile
├── app.py # 项目文件
├── requirements.txt # 依赖项清单
└── downloaded-packages/ # 无网环境下用于迁移环境的安装包

```

# 打包Docker容器

要将一个本地的项目打包成Docker容器，首先要创建一个`Dockerfile`。`Dockerfile`类似于一个脚本，用于准备环境，并通过路径下的项目文件构建成一个服务。

我们应在项目根路径下创建一个`Dockerfile`，以下是一个例子：

```dockerfile
# 使用官方的 Python 镜像作为基础
FROM python:3.8

# 设置工作目录
WORKDIR /app

# 复制项目文件到工作目录
COPY . /app

# 安装项目依赖
RUN pip install --no-cache-dir -r requirements.txt

# 暴露应用运行的端口
EXPOSE 8080

# 定义容器启动时运行的命令
CMD ["python", "app.py"]
```

# 构建Docker容器

下一步是在项目根目录运行终端命令行，构建容器，代码如下：

```bash
docker build -t your_image_name:tag .
```

这段代码中，`your_image_name` 是你为容器指定的名称，`tag` 是容器的标签，`.` 表示使用当前目录中的 `Dockerfile`。

例如`docker build -t my_python_app:v1.0 .` 其中`my_python_app` 是容器的名称，`v1.0` 是版本标签，这有助于进行版本管理。

# 运行Docker容器

在构建完成后，就可以运行容器了，代码如下：

```bash
docker run -p 8080:8080 your_image_name:tag
```

以上代码将会将容器的8080端口映射到主机的8080端口，以供用户访问。其中的`tag`是容器的标签，可以是`latest`来运行最新的容器。

# 向无网环境发送完整Docker

有的时候，目标环境没有连接外网，这时候就需要进行环境迁移，相关内容可以看我的[上一篇博客](https://zerolovesea.github.io/2024/01/17/Linux-Python环境迁移：如何在无网环境中迁移Python环境？/)，这里简单给出代码：

首先，在有网环境下载Python包：

```bash
pip download -r requirements.txt --dest=/path/to/download/directory
```

然后在目标环境安装一下：

```bash
pip install --no-index --find-links=/path/to/downloaded/packages -r requirements.txt
```

假设用户将安装包放在根目录的`downloaded-packages`文件夹下，那么相应的，上面这些操作可以写在`Dockerfile`里，这样用户就不需要先手动构建环境了：

```dockerfile
# 使用官方的 Python 镜像作为基础
FROM python:3.8

# 设置工作目录
WORKDIR /app

# 复制项目文件到工作目录
COPY . /app

# 将位于downloaded-packages的离线包拷贝到镜像的downloaded-packages中
COPY downloaded-packages /app/downloaded-packages

# 安装项目依赖
RUN pip install --no-index --find-links=/app/downloaded-packages -r requirements.txt

# 暴露应用运行的端口
EXPOSE 8080

# 定义容器启动时运行的命令
CMD ["python", "app.py"]
```

这样就可以和之前一样构建并运行Docker容器了：

```bash
docker build -t your_image_name:tag .

docker run -p 8080:8080 your_image_name:tag
```

# 多文件夹项目的容器构建

有时候，项目结构过于复杂，可以精确的将需要的文件夹移动到容器中，例如Dockerfile可以这么写：

```dockerfile
# 使用官方的 Python 镜像作为基础
FROM python:3.8

# 设置工作目录
WORKDIR /app

# 复制需要的项目文件到工作目录
COPY src/ /app/src
COPY data/ /app/data
COPY requirements.txt /app/requirements.txt
COPY app.py /app/app.py

# 将离线包拷贝到镜像中
COPY downloaded-packages /app/downloaded-packages

# 安装项目依赖
RUN pip install --no-index --find-links=/app/downloaded-packages -r /app/requirements.txt

# 暴露应用运行的端口
EXPOSE 8080

# 定义容器启动时运行的命令
CMD ["python", "/app/app.py"]

```

# 在容器中修改Python源

回顾一下，怎么在Python环境修改安装源：

```bash
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
```

同理，写在Dockerfile就可以了，代码如下：

```dockerfile
# 使用官方的 Python 镜像作为基础
FROM python:3.8

# 设置 pip 的源为国内源（例如阿里云）
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/

# 设置工作目录
WORKDIR /app

# 复制项目文件到工作目录
COPY . /app

# 将离线包拷贝到镜像中
COPY downloaded-packages /app/downloaded-packages

# 安装项目依赖
RUN pip install --no-index --find-links=/app/downloaded-packages --no-binary=:all: -r requirements.txt

# 暴露应用运行的端口
EXPOSE 8080

# 定义容器启动时运行的命令
CMD ["python", "app.py"]
```

你大概了解了，`RUN`指令实际上就是在运行命令行。

# 实际项目中的Dockerfile

这里给出一个实际项目中的Dockerfile，来看一下工程实践里是怎么写的：

```dockerfile
# 使用官方 Python 3 镜像作为基础镜像
FROM python:3.11-bookworm

# 复制debian-sources.list文件到/etc/apt/sources.list
COPY ./docker/debian-sources.list /etc/apt/sources.list

# 替换Debian软件包管理器的源，安装需要的镜像
# 修改Python安装源
RUN rm -rf /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y vim \
    && apt-get install -y libgl1-mesa-glx \
    && apt-get install -y redis-server \
    && apt-get install -y nginx \
    \
    && mkdir -p /root/.pip \
    && pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \ 
    && echo "[install]" >> /root/.pip/pip.conf \
    && echo "trusted-host=mirrors.aliyun.com" >> /root/.pip/pip.conf 

# 复制前端和Nginx配置文件
COPY  --from=behavior-detector-frontend:latest /behavior-detector-admin/dist/ /var/www/html
COPY ./docker/nginx.default.conf /etc/nginx/sites-available/default

# 设置工作目录
WORKDIR /app
# 复制当前目录下的所有文件到容器的 /app 目录
COPY ./backend /app/

# 安装项目依赖
RUN pip install -r requirements.txt

# 暴露端口号
# 80 前端服务
EXPOSE 80
# python 服务
EXPOSE 7091

# 执行bash start.sh prod
CMD ["bash", "start.sh", "prod"]
```

2024/1/19 于苏州家中