---
title: Docker实践挖坑细节
date: 2024-01-27 08:08:15
tags: 
  - Docker
  - 工程实践
categories: 工程实践
excerpt: 使用Docker时遇到的一些问题汇总。
index_img: "/img/docker.jpg"
---

前面写了一些Docker的基础使用的东西，不过真正要学会还是得实际上手，这篇博客就记录一下我实际使用Docker时遇到的一些问题。

这里是之前几篇Docker相关的博文地址：

- [工程实践：使用Docker打包自己的项目 - 我不是算法工程师](https://zerolovesea.github.io/2024/01/19/工程实践：使用Docker打包自己的项目/)

- [工程实践：Docker入门技巧 - 我不是算法工程师 ](https://zerolovesea.github.io/2024/01/23/工程实践：Docker入门技巧/)

- [工程实践：实操项目中的Docker操作 - 我不是算法工程师 ](https://zerolovesea.github.io/2024/01/25/工程实践：实操项目中的Docker操作/)

---

# Windows终端查看Docker出现报错

我在windows直接使用`docker ps -a`会出现报错`error during connect`。以下是完整报错内容；

```bash
error during connect: this error may indicate that the docker daemon is not running: Get "http://%2F%2F.%2Fpipe%2Fdocker_engine/v1.24/containers/json?all=1": open //./pipe/docker_engine: The system cannot find the file specified.
```

实际遇到时，启动Docker的应用就可以解决，这是因为没有开启守护进程。在Linux上可以用以下方式设置开机自动启动Docker：`sudo systemctl enable docker`。

# 报错：repository name must be lowercase

这个报错源自于Dockerfile的编写，执行` docker build -t qa_system:v0.1 .`时出现报错，完整报错如下：

```bash
Dockerfile:1
--------------------
   1 | >>> FROM Python:3.10
   2 |
   3 |     WORKDIR /app
--------------------
ERROR: failed to solve: failed to parse stage name "Python:3.10": invalid reference format: repository name must be lowercase
```

原来是需要都是小写，把`Python`改成`python`即可。

# 下载Python依赖库时的路径选择

当我在执行`pip download -r .\requirements.txt --dest \downloaded_packages`时，并没有在根目录下找到文件夹。这是因为需要在路径前面加一个`.`来指定当前目录。解决方法如下：

```bash
# 相对路径
pip download -r .\requirements.txt --dest '.\downloaded_packages'

# 绝对路径
pip download -r .\requirements.txt --dest C:\path\to\downloaded_packages
```

# 命令行参数顺序出错导致无法启动Docker

当`build`完容器后，就是`run`这个容器，我一开始输的命令是` docker run qa_system:v0.1 -p 8501:8501`，出现了报错：

```bash
docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "-p": executable file not found in $PATH: unknown.
```

这是因为命令行应该把容器放在最后写，端口等参数应在前面。正确的应该是`docker run -p 8501:8501 qa_system:v0.1`。

![](240127-1.png)

完美！现在可以在本地的`8501`访问容器的`8501`了！

# stop容器报错

当我使用`Ctrl C`停止了容器的服务后，我想在命令行停止容器，于是我执行了`docker stop qa_system:v0.1`，出现报错：

```bash
Error response from daemon: No such container: qa_system:v0.1
```

这是因为需要指定容器的id。修改后即可正确stop。

# 保存镜像为tar文件并发送给其他人

这个是我单纯记不住指令，所以在这写一下。前面我们在本地已经有了镜像，现在我需要把它打包发给别人，需要执行以下指令`docker save -o qa_system.tar qa_system:v0.1`。`-o`是声明保存后的文件名，后面则附上镜像的版本号。

保存完后将tar文件发送给目标用户，对方只需要执行`docker load -i qa_system.tar`即可在对方环境加载镜像。

# 删除本地的镜像

看了一眼镜像有1.9G，所以打算删一下。执行`docker remove qa_system`会报错：

```bash
Error response from daemon: No such container: qa_system
```

这是因为这个指令只是用来删除容器。删除镜像需要使用`rmi`。完整指令如下：

```bash
docker rmi qa_system:v0.1
```

这样就可以顺利删除了。



2024/1/27 于苏州家中

