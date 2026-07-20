---
title: Docker部署CUDA/CUDANN
date: 2024-02-07 20:06:07
tags: 
  - Docker
  - 工程实践
  - CUDA
categories: 工程实践
excerpt: 如何在Docker中调用CUDA并进行推理。
index_img: "/img/cuda.png"
---

最近的项目中，大规模使用了Docker，随着项目发展，萌生了把推理服务也打包容器化的想法，因此就有了这篇博客。操作系统使用的是Centos7.9，Cuda版本为11.6.1。

首先，容器的主要原理就是在构建一个轻量级的操作系统，并在这个独立的操作系统中搭建想要的容器。通常来说，如果不需要调用宿主机硬件的话，可以直接构建容器。

# 安装Nvidia-Container-Toolkit

如果需要用到显卡的话，就需要安装Nvidia的容器套件[nvidia-container-toolkit](https://github.com/NVIDIA/nvidia-container-toolkit)。

我们通过curl来下载并安装套件：

```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | \
sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo

sudo yum install -y nvidia-container-toolkit
```

# Docker拉取镜像

安装完套件后，需要去DockerHub拉取对应版本的cuda镜像，命令如下：

```bash
docker pull nvidia/cuda:11.6.1-cudnn8-devel-centos7
```

其中Cuda镜像除了本身的版本以外，还有多个版本：base, runtime, devel。它们的大小均不同。解释如下：

- base版本：只包含了预构建cuda应用程序的最低要求的包。如果用户需要自定义安装需要的cuda包，可以选择使用这个镜像版本，但如果想省事儿，别用。
- runtime版本：只涵盖了运行环境的最小集合，例如动态库等。
- devel版本：涵盖了开发所需的所有工具，包含编译、debug等，以及编译需要的头文件、静态库。

**如果想用docker镜像做开发环境，建议使用devel版本的image。**

# 编写Dockerfile

前面拉取完cuda的镜像后就可以直接编写Dockerfile了，这里给一个示例。这里的场景是需要在Docker中构建一个能够调用显卡的python环境，因此需要分成多个阶段进行构建：

```dockerfile
# 第一阶段：使用Miniconda镜像
FROM continuumio/miniconda3:latest as miniconda_stage                                           
# 设置环境变量                                                                                 
ENV PATH="/opt/conda/bin:$PATH"                                                               
# 安装 Python 3.10.13                                                                       
RUN conda install -y python=3.10.13                                                             
# 第二阶段：使用 CUDA 镜像                                                                     
FROM nvidia/cuda:11.6.1-cudnn8-devel-centos7 as cuda_image                                        
# 从 Miniconda 阶段复制环境                                                                   
COPY --from=miniconda_stage /opt/conda /opt/conda                                                
# 设置环境变量                                                                                 
ENV PATH="/opt/conda/bin:$PATH"                                                                  
# 第三阶段：构建项目                                                                           
FROM cuda_image                                                                                 
# 设置工作目录                                                                             
WORKDIR /infer_app                                                                               
# 复制项目文件                                                                                 
COPY ./ /infer_app                                                                             
# 安装 mesa-libGL                                                                           
RUN yum install -y mesa-libGL                                                                
# 安装 vim                                                                                   
RUN yum install -y vim                                                                        
# 安装项目依赖                                                                                 
RUN pip install -r requirements.txt                                                            
# 暴露端口                                                                                   
EXPOSE 58090 58091                                                                                                                                                                       
# 默认命令                                                                                   
CMD ["/bin/bash"]               
```

在编写完之后，就可以构建一下容器，这里我写了个脚本来构建镜像：

```bash
docker rm -f test:v0.0.1
docker rmi -f test:v0.0.1
docker build -t test:v0.0.1
```

# 部署容器

镜像构建完之后，就可以部署容器了，需要注意的是，如果要调用显卡，需要设置`--gpus all`来使用，否则会报错。这里给一个示例命令：

```bash
docker run -it --gpus all --network host -v /app/:/app/ -p 58090:58090 -p 58091:58091 test:v0.0.1 bash
```

进入容器以后就可以直接运行需要运行的程序了。你也可以直接使用nvidia-smi来查看是否成功调用显卡。

2024/2/7 于苏州家中
