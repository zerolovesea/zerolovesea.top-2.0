---
title: Dockfile编写指南
date: 2024-01-27 09:22:24
tags: 
  - Docker
  - 工程实践
categories: 工程实践
excerpt: 如何正确，高效地编写Dockerfile。
index_img: "/img/docker.jpg"
---

Docker篇的第五篇，学习一下怎么编写Dockerfile。

# 不要过多的叠加层数

Docker 镜像是分层的，Dockerfile 中的每个指令都会创建一个新的镜像层。每一层都是前一层变化的增量。

以下是一个Dockerfile的例子：

```bash
FROM ubuntu

ADD . /app

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y nodejs ssh mysql
RUN cd /app && npm install

CMD mysql & sshd & npm start
```

在上面这个Dockerfile里，每执行一次`RUN`，就会在镜像中多增加一层，最高层是127层。如果添加过多的层数会导致镜像过大。因此应当尽可能的将`RUN`指令写成一行，如下：

```bash
FROM ubuntu

ADD . /app

RUN apt-get update \
    && apt-get install -y nodejs \
    && cd /app \
    && npm install

CMD npm start
```

# 使用.dockerignore忽略文件

和.gitignore一样，有时候在打包时，不需要将一些文件拷贝进镜像以防止镜像过大，例如一些Readme，或者.git文件，这时候就需要用到.dockerignore。语法是类似的，例如要忽略后缀是“swp”“sh”的文件：
```bash
# docker ignore
*.swp
*.sh
```

例如不需要.git目录，或者某个文件夹，则如下：

```bash
.git/
node_modules/
```

# Dockerfile命令

下面是Dockerfile的一些常用命令

| FROM       | 基于哪个镜像来实现                                           |
| ---------- | ------------------------------------------------------------ |
| LABEL      | 给构建的镜像打标签                                           |
| ENV        | 声明环境变量                                                 |
| ARG        | 指定了用户在 `docker build --build-arg` 时可以使用的参数     |
| RUN        | 执行的命令                                                   |
| CMD        | run后面跟启动命令会被覆盖掉                                  |
| ENTRYPOINT | 与CMD功能相同，但需docker run 不会覆盖，如果需要覆盖可增加参数-entrypoint来覆盖 |
| ADD        | 添加宿主机文件到容器里，有需要解压的文件会自动解压           |
| COPY       | 添加宿主机文件到容器里                                       |
| WORKDIR    | 工作目录                                                     |
| EXPOSE     | 容器内应用可使用的端口容器启动后所执行的程序，如果执行docker |
| VOLUME     | 将宿主机的目录挂载到容器里                                   |
| USER       | 为接下来的Dockerfile指令指定用户                             |

# ARG指令

`ARG` 指令用于定义构建参数，用来在构建过程中被使用，但在运行时不会保留在最终的镜像中。这对于在构建过程中传递一些动态值是非常有用的。

以下是一个例子：

```dockerfile
# 使用 ARG 指令定义构建参数
ARG BASE_IMAGE=alpine:latest

# 使用构建参数作为基础镜像
FROM $BASE_IMAGE

# 在容器中创建一个文件，内容为构建参数值
RUN echo "The base image is: $BASE_IMAGE" > /output.txt
```

上面的Dockerfile中，我们设定了默认的`BASE_IMAGE`为`alpine:latest`，因此当我们执行`docker build -t my-image .`时，会使用默认的`alphine:latest`构建镜像。如果要从外部传入自定义的参数，可以执行以下命令：

```bash
docker build -t my-image --build-arg BASE_IMAGE=ubuntu:latest .
```

可以看到，`--build-arg`这个指令将会解析传入的参数。

# ENV指令

`ENV` 指令用于设置环境变量。这些环境变量可以在构建过程中以及运行容器时使用。

以下是一个例子：

```dockerfile
# 使用基础镜像
FROM ubuntu:20.04

# 设置环境变量
ENV MY_VAR="Hello Docker" \
    ANOTHER_VAR=42

# 执行一些操作
RUN echo "My variable is: $MY_VAR"
RUN echo "Another variable is: $ANOTHER_VAR"

# 在容器启动时执行的命令
CMD ["echo", "Container is running!"]
```

其中，`ENV` 指令用于设置两个环境变量，`MY_VAR` 和 `ANOTHER_VAR`。当运行时，需要执行`-e`来输入环境变量：
```bash
docker run -e MY_VAR="Custom Value" -e ANOTHER_VAR=99 my-image
```

{% note warning%}

`ARG`和`ENV`的区别主要在，`ARG` 用于在构建过程中传递参数，而这些参数仅在构建时有效。而`ENV` 用于设置环境变量，可以在容器启动时访问。

也就是说，在`RUN`时，Docker只会使用`ARG`的默认值，而不是传入的值。但是会使用`ENV`传入的值。

因此，`ARG`常被用在设置软件版本、构建路径。而`ENV`被用在配置应用程序、传递参数（例如数据库密码，用户名等）。

{% endnote %}

# RUN和CMD的区别是什么

`RUN`指令在Dockerfile的作用主要是执行一些构建Docker时必要的动作，例如下载，安装等等，例如：

```dockerfile
# 安装
RUN apt-get update && apt-get install -y \
    package1 \
    package2 \
    && rm -rf /var/lib/apt/lists/*

# 下载软件
RUN curl -O https://example.com/file.tar.gz \
    && tar -xzvf file.tar.gz \
    && rm file.tar.gz

# 执行编译
RUN make

# 结合ARG执行
ARG VERSION=latest
RUN echo "Version is $VERSION"
```

而`CMD`则用于最后容器启动时要进行的操作，例如：

```dockerfile
CMD ["./start.sh"]
```

# VOLUME指令

`VOLUME` 指令用于在容器中创建挂载，并指定容器中的目录应该被挂载到主机的哪个位置。也就是说，将容器内的数据关联到外部的文件，例如，修改配置文件时就不需要进入容器进行修改，以下是一个例子：

```dockerfile
FROM ubuntu:20.04

# 创建挂载点
VOLUME ["/app/data"]

# 设置工作目录
WORKDIR /app

# 复制应用程序代码到容器中
COPY . /app
```

上述操作中的`VOLUME ["/app/data"]`实际上是在容器内部的 `/app/data` 目录创建一个卷（Volume）。当在命令行执行以下代码时：

```bash
docker run -v /host/path:/app/data my-image
```

就会把容器中的 `/app/data` 映射到主机上的 `/host/path`。这意味着容器中写入 `/app/data` 的数据将实际上存储在主机的 `/host/path` 目录中。

## 在容器内读取宿主机的配置文件

我们可以通过运行以下指令来挂载卷：

```bash
docker run -v /host/config:/container/config my-image
```

上述指令会将宿主机的/host/config与容器的/config进行映射。假设宿主机的路径下的配置文件是 `my-config.conf`，在容器内读取该配置文件的路径是 `/container/config/my-config.conf`。容器内的应用程序应该使用这个路径来访问配置文件。

2024/1/27 于苏州家中