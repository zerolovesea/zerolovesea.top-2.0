---
title: "Python开发：换源/更新Python包/虚拟环境"
description: "上手Python开发的一些必要流程。"
pubDate: "2023-12-29 08:43:58"
---

# Python换源
因为一些众所周知的原因，我回国以后打开VSCode的第一件事，就是火速更换Python的默认pip源。

1. 临时更换：
```python
pip install pandas -i http://pypi.douban.com/simple/
```
2. 永久更换：
```bash
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
```

3. 目前在国内已经有一些比较稳定，且能够及时更新的镜像源，可选的地址有：

  - 豆瓣：http://pypi.douban.com/simple/
  - 中科大：https://pypi.mirrors.ustc.edu.cn/simple/
  - 清华：https://pypi.tuna.tsinghua.edu.cn/simple/
  - 阿里云：https://mirrors.aliyun.com/pypi/simple/

通常阿里云和清华用的会多一点，不过清华源有时候会出现更新不及时的情况。

# 更新Python包
想要更新本地已安装的Python包，可以使用以下命令：

```python
# 更新单个包
pip install --upgrade package_name
```
```python
# 更新多个包
pip install --upgrade package1 package2 package3
```

# 虚拟环境
虚拟环境对于项目更迭速度极快的开发者来说应该不陌生。在读书的时候，老师经常向我们安利虚拟环境的重要性，当时我比较不以为然：都装在Base环境下，用的时候不用麻烦一直切换了，这不比切换虚拟环境来的方便吗？

不过，后来在GitHub上看了一些项目，有些老的项目依赖库也很老，更新到新版本反而会导致项目不可用。这时就体现虚拟环境的重要性了，每个项目一个环境，相互不冲突，这样无论是结构清晰度还是环境整洁度都要高很多。

构建Python虚拟环境的方式有不少，比如`Pipenv`,`Virtualenv`和 `Conda`。我自己用Conda多一些。

## 使用Virtualenv构建虚拟环境
1. 安装Virtualenv
```bash
pip install virtualenv
```

2. 进入你的项目文件夹

3. 输入
```bash
python<version> -m venv <virtual-environment-name>
```
例如想要生成一个python版本为3.12的虚拟环境，名字叫LLM_ENV
```bash
python -3.12 -m venv LLM_ENV
```

4. 激活虚拟环境： 
要激活虚拟环境，你需要执行以下命令：
```bash
.\LLM_ENV\Scripts\activate
```
在Windows环境下，则需要在CMD中执行：
```bash
.\LLM_ENV\Scripts\activate.bat
```
5. 停止环境:
要退出虚拟环境，直接执行以下命令：
```bash
deactivate 
```
## 使用Conda构建虚拟环境
Conda是一个广泛被使用的跨平台包/环境管理器，也是我最常用的工具。用它能够创建管理任何类型的包和依赖。简单来说，它是一个编程语言的Windows商店。比较有名的Anaconda和miniconda就在它的基础上构建。

要使用Conda构建虚拟环境，可以参照以下步骤：

1. 找到Anaconda Prompt/Anaconda PowerShell Prompt
2. 在命令行中输入以下指令，这会帮助你生成一个名为`env name`，python版本为3.12的虚拟环境：
```bash
conda create --name <env name> python=3.12
```
3. 想要激活虚拟环境，则只需要在命令行中输入：
```bash
conda activate <env name>
```
4. 想要停止虚拟环境，则需要在命令行中输入：deactivate
```bash
deactivate
```

5. 删除虚拟环境，命令则如下：

```python
conda remove -n <env name> --all
```



2023/12/29 于公司

