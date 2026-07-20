---
title: "工程实践：Docker入门技巧"
description: "Docker的一些基础指令。"
pubDate: "2024-01-23 20:38:52"
---

[前面](https://zerolovesea.github.io/2024/01/19/%E5%B7%A5%E7%A8%8B%E5%AE%9E%E8%B7%B5%EF%BC%9A%E4%BD%BF%E7%94%A8Docker%E6%89%93%E5%8C%85%E8%87%AA%E5%B7%B1%E7%9A%84%E9%A1%B9%E7%9B%AE/)介绍了如何用Docker打包自己的项目，这次要讲一下Docker的一些基本操作。

# 查看Docker版本

首先是如何查看Docker的版本：

```bash
docker --version
```

# 获取镜像

Docker的基础用法之一就是从官方库拉取镜像来创建容器，只要执行以下命令：

```bash
docker pull image_name:tag
```

例如：

```bash
docker pull ubuntu:latest

docker pull python:3.8
```

# 运行容器

要运行容器，则需要执行以下命令：

```bash
docker run options image_name:tag
```

例如：

```bash
docker run -it ubuntu:latest /bin/bash
```

## Docker run命令

Docker的run命令包含多个命令：

- `--name`为容器命名，`-d`在后台运行：

```bash
docker run --name mynginx -d nginx:latest
```

- `-P`指定随机端口映射，容器内部端口**随机**映射到主机的端口，`-p`指定端口映射，语法是 `-p <host-port>:<container-port>`：

```bash
# 将容器内部的端口80随机映射到主机的任意端口
docker run -P -d nginx:latest

# 将在容器内部的端口 80 映射到主机上的端口 8080
# 当你通过浏览器访问 http://localhost:8080 时，实际上是访问了容器内运行的 Nginx 服务
docker run -p 8080:80 nginx 
```

也可以同时映射多个端口：

```bash
docker run -p 8080:80 -p 5000:5000 my_custom_image
```

- `-v`挂载目录，挂载卷允许你将主机上的文件或目录与容器内的文件或目录进行关联，从而实现数据的持久化和共享。语法是 `-v <host-path>:<container-path>`。假设有一个名为 `my_app` 的容器，它需要访问主机上的 `/data` 目录中的数据文件，则需要输入以下指令：

```bash
docker run -v /host/path:/container/path my_app
```

上述指令中，`/host/path` 是主机上的路径，例如 `/data`。`/container/path` 是容器内的路径，例如容器中的应用程序期望的路径。

- `-rm`删除容器后自动删除卷，这个指令会运行容器，并在停止后自动删除：

```bash
docker run --rm my_custom_image
```

- `-i`，`-t`交互式选项。有的时候需要在容器内有一些交互操作，就需要使用这两个选项：

```bash
docker run -i -t ubuntu:latest /bin/bash
```

上述例子中，启动了一个交互式的 Ubuntu 容器，并将其连接到 Bash 终端。这允许直接在容器内执行命令，输入数据等。如果省略了 `-i` 和 `-t`，那么容器可能会在后台运行，并且无法直接与其进行交互。因此，如果只是希望在后台运行一个服务，而不需要直接与容器进行交互，那么可以省略这两个选项。

# 启动已停止的容器

要启动已经停止的容器，首先要查看容器的ID，随后使用`start`指令来启动，代码如下：

```bash
docker ps -a # 查看所有的docker

docker start <docker id> # 启动docker
```

# 停止和重启Docker

要停止docker，需要使用`stop`指令。重启docker，则使用`restart`指令。如下：

```bash
docker stop <docker id>

docker restart <docker id>
```

# 进入后台的Docker

使用`run -d`会让docker在后台运行，此时只要使用`exec`+`/bin/bash`就可以进入后台docker：

```bash
docker exec -i -t <docker id> /bin/bash
```

后面加上的`/bin/bash`是指在容器内打开一个交互式的Bash终端。

## Docker exec命令

Docker exec主要用于在运行中的容器内执行命令。这有很多种用法，例如:

- **容器内部命令执行：** 你可以使用 `docker exec` 在容器内执行命令，而不必进入容器的交互式终端。这对于执行一次性任务或调试容器内的问题非常有用。

```bash
# 在 my_container 容器内部执行 ls /app 命令，显示容器内 /app 目录下的文件和子目录
docker exec -it my_container ls /app
```

- **进入容器内部交互式 Shell：** 通过执行交互式 Shell（例如 Bash），你可以进入容器内部的终端，以便在容器内部执行多个命令。

```bash
docker exec -it my_container /bin/bash
```

- **查看容器日志：** 使用 `docker exec` 可以查看容器的日志，而无需停止容器。这对于实时监控容器的运行状态非常有用。

```bash
docker exec -it my_container tail -f /var/log/app.log
```

- **在运行中的服务中执行管理命令：** 对于运行中的服务，你可以使用 `docker exec` 执行一些管理命令，例如数据库操作、Web 服务器的重新加载配置等。

```bash
# 在名为 database_container 的 Docker 容器内使用 psql 命令连接到 PostgreSQL 数据库
docker exec -it database_container psql -U username -d dbname
```

- **容器内部文件操作：** 你可以使用 `docker exec` 在容器内部进行文件操作，例如查看、复制或修改文件。

```bash
docker exec -it my_container cat /app/config.txt
```

# 删除容器与镜像

删除容器就是`rm`：

```bash
docker rm -f <docker id>
```

要清理所有停止的容器，则需要执行以下命令：

```bash
# 方法1
docker container prune 
# 方法2
docker rm $(docker ps -a -q)
```

## 强制杀死容器

有时候可能会遇到应用崩溃的情况，这时候需要使用`kill`指令杀死容器：

```bash
docker kill my_container
```

## Docker rm命令

- -f :通过 SIGKILL 信号强制删除一个运行中的容器。
- -l :移除容器间的网络连接，而非容器本身。
- -v :删除与容器关联的卷。

例如：

```bash
# 强制删除容器
docker rm -f db01 db02
```

删除镜像则是`rmi`命令：

```bash
docker rmi my_image1 my_image2
```

# 使用Python的简单用例


可以使用 Docker Hub 上提供的官方 Python 镜像来创建一个 Python 3.9 的容器。以下是步骤：

1. **拉取 Python 3.9 镜像：** 打开终端或命令提示符，并执行以下命令来拉取 Python 3.9 镜像：

   ```bash
   docker pull python:3.9
   ```

   这会从 Docker Hub 下载 Python 3.9 镜像到你的本地系统。

2. **运行 Python 3.9 容器：** 一旦下载完成，你可以通过以下命令运行一个 Python 3.9 容器：

   ```bash
   docker run -it python:3.9 /bin/bash
   ```

   这个命令使用 `-it` 选项进入交互模式，并在容器内启动 Bash 终端。

3. **验证 Python 版本：** 在容器内部，你可以使用以下命令验证 Python 版本：

   ```bash
   python --version
   ```

## 想要在这个Python容器中写对外开放的服务？

和之前一样，需要运行python容器时开放端口：

```bash
docker run -d -p 8080:80 python:3.9 
```

这是一个更具体的例子，在python3.9的容器运行了`your_flask_app.py`：

```bash
docker run -d -p 8080:5000 python:3.9 python your_flask_app.py
```

2024/1/23 于苏州家中