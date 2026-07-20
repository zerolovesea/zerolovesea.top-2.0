---
title: 环境迁移：如何在无网Linux环境中迁移Python环境？
date: 2024-01-17 20:38:08
tags:
  - Python
  - 工程实践
  - Linux
categories: Python
excerpt: 将本地的Python环境迁移到无网的Linux环境，以及Linux中的zip/tar操作。
index_img: "/img/python.png"
---

近期的项目中涉及到要在客户环境部署Python环境，通常来说创建虚拟环境，pip install一下依赖库就可以了，不过出于安全管理，客户现场的服务器并没有开启外网，这就带来了难题：如何迁移Python环境？

# 克隆环境

本地虚拟环境迁移可以执行以下命令：

```bash
conda create -n "new_env_name" --clone "old_env_name"
```

同样，还可以克隆同一网络下的不同机器下的环境：

```bash
conda create -n "new_env_name" --clone ~/path 
```

# 导出本地项目依赖库清单

首先，我们需要在本地的项目中构建一个`requirements.txt`，也就是依赖项。对于这个需求有两个办法可以实现：

- pip freeze
- pipreqs

## pip freeze

如果每个项目都有自己的虚拟环境，那么就可以在目标项目的根目录下，切换到项目的虚拟环境，并使用以下指令生成依赖库清单：

```bash
pip freeze > requirements.txt
```

这个方法实际上是把这个虚拟环境里的所有包都导出了，所以会导出大量于项目无关的依赖。所以还可以使用另一个工具`pipreqs`库。

## pipreqs

首先需要安装`pipreqs`库。随后需要到项目根目录，执行以下命令：

```bash
pipreqs ./
```

如果出现编码错误，就需要指定编码：

```bash
pipreqs ./ --encoding=utf8
pipreqs ./ --encoding='iso-8859-1' 
```

# 下载安装包到本地

由于目标环境无法联网使用pip，因此需要先在本地下载安装包：

```bash
pip download -r requirements.txt --dest=/path/to/download/directory
```

> pip download -r requirements.txt -d packages/ -i https://mirrors.aliyun.com/pypi/simple/
> 上述指令会在packages目录下下载依赖项。

上述指令会在目标路径下载python依赖包。

# 在目标服务器配置环境

接下来是重要的一步，将刚刚下载好的依赖包和`requirements.txt`复制到目标服务器的目标路径。我的路径设置如下：

/path/to/your/project/
├── venv/
├── requirements.txt # 依赖项清单
├── modules/ # 安装包文件夹
└── ...

随后在项目根目录执行以下命令：

```bash
pip install --no-index --find-links=/path/to/your/project/modules -r requirements.txt
```

- `no-index`参数告诉 pip 不要使用默认的 Python Package Index (PyPI) 来查找包，而是仅使用后续提供的本地或者自定义的链接。
- `--find-links=/xxx/xxx/site-packages`: 这个选项指定了一个本地或自定义的包链接目录，告诉 pip 在这个目录中查找并安装包。
- `-r /xxx/xxx/site-packages/requirements.txt`: 这部分指明要安装的包的列表，这个列表通常保存在一个名为 `requirements.txt`的文件中，其中包含了需要安装的依赖包及其版本信息。

{% note warning %}
注意！两个环境的python安装包**必须**是同一版本下载的。如果目标环境是Python 3.8，下载安装包的环境是Python 3.10，那么包传过去之后是无法安装的（血泪史！）。
{% endnote %}

# 检查安装是否成功

安装完毕后，只需要使用`pip list`就可以查看是否安装成功。

# Linux压缩/解压

有时候下载的包比较多，直接传到目标系统就会很慢，这时候可以将文件夹压缩一下，发送过去再解压，命令如下：

```bash
# 压缩为zip文件
zip -r dirname.zip dirname

# 压缩为tar文件
tar -cvf dirname.tar dirname

#解压zip文件
unzip dirname.zip

#解压tar文件
tar -xf dirname.tar
```

2024/1/17 于苏州家中

