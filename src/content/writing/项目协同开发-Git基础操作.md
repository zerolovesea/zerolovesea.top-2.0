---
title: "项目协同开发-Git基础操作"
description: "项目版本控制/协同开发必不可少的Git命令：git branch/git remote/git switch/etc。"
pubDate: "2023-12-29 08:30:38"
---

# 什么是Git

项目开发里必不可少的就是版本控制系统了，相信每个已经工作的码农都经常接触这个玩意。什么？你说你们都用百度网盘共享代码？你小子来买瓜的是吧。

![](/_posts/%E9%A1%B9%E7%9B%AE%E5%8D%8F%E5%90%8C%E5%BC%80%E5%8F%91-Git%E5%9F%BA%E7%A1%80%E6%93%8D%E4%BD%9C/231229-1.gif)

Git是当今世界上使用最广泛的现代版本控制系统，由Linux之父-暴躁老哥Linus Torvalds 于 2005 年开发。作为一个分布式版本控制系统，开发者保存在本地的代码，本身就是一个完整的版本控制存储库。开发人员会在本地提交其工作，然后再将存储库的副本与服务器上的副本进行同步。

Git的起源也和Linux系统的发展息息相关。早在1991年，Linus开发出开源系统Linux后，全世界的开发者都向他发送了自己贡献的代码，Linus会对这些代码检查测试，在达到他的要求后将代码合并。在这种高频的代码版本更迭中，需要一个合适的版本控制工具。

最开始Lin叔使用了一个商业版本控制系统BitKeeper，但是由于一些纠纷，Lin叔没有继续使用它，而是花了十天的时间自己开发出了未来风靡世界的Git。
![](/_posts/%E9%A1%B9%E7%9B%AE%E5%8D%8F%E5%90%8C%E5%BC%80%E5%8F%91-Git%E5%9F%BA%E7%A1%80%E6%93%8D%E4%BD%9C/231229-2.jpg)

下面我们先来说一些Git的常用操作代码。

# Git用法：
## 本地仓库管理

新手上门三板斧：`init`/`add`/`commit`自不用多说。

**本地初始化一个仓库，你将能够在本地进行版本控制操作，包括提交，分支，回退等：**
`git init`

**在修改了本地文件后，你可以将修改的内容添加到本地的暂存区：**
`git add .`
**确定了暂存区后，可以本地提交代码：**
`git commit`
`git commit -m 'This is a commit message' #附加提交信息`

**本地切换已经建立好的分支，分支可以管理单个项目中不同的开发方向：**
`git switch <branch-name>`
**也可以通过加上`-c`，直接在本地建立新分支，并自动切换到该分支：**
`git switch -c <new-branch-name>`

**通过`-M` 可以为本地当前分支改名：**
`git branch -M main`

## 远程仓库管理
下面这个是比较重要的：本地仓库连接到远程仓库。新建了远程仓库后，会产生一个地址。这时在你的本地仓库地址输入以下命令即可连接两个仓库：

**为本地仓库添加一个新的远程仓库并给它起一个别名为 origin：**
`git remote add origin https://github.com/zerolovesea/Coding-Tips.git`

**连接了仓库以后，就可以拉取/提交/推送代码了：**
`git pull origin master`
`git push origin master`

**设置SSH密钥以后，你可能想把仓库从http协议改为ssh协议。那么你可以更新远程仓库的URL，使用remote set-url命令进行操作：**
`git remote set-url origin git@github.com:zerolovesea/Coding-Tips.git`

**在推送代码时加上-u，可以将本地和远程仓库建立连接。**这样未来就可以通过`git push`直接推送代码。下面这个示例中，working-pc是本地分支，origin是远程名称，-u代表建立联系：
`git push -u origin working-pc`

**而未建立联系的时候，在提交推送时就需要写上两边的仓库：**
`git push origin working-pc`

### 远程仓库构建main分支的完整流程：
1. 本地创建main：
`git switch -c main`
2. 新分支推送到远程：
`git push -u origin main`

## 分支管理
**如果想把本地分支转移关联至不同的远程分支，可以按照以下的步骤操作：**
1. 查看当前关联分支：
`git branch -vv`
2. 解除当前关联（本地的main与远程的关联）：
`git branch --unset-upstream main`
3. 关联至新的远程分支（本地main关联远程分支newbranch）：
`git branch -u origin/your-newbranch main`

**同样，可以通过加上`-d`来删除本地分支：**
`git branch -d branch_name`

**总结一下，本地工作流的整体流程如下：**
1. 克隆仓库：
`git clone`
2. 创建新分支：
`git switch -c new_branch`
3. 本地提交工作：
`git add. /git commit`
4. 推送新分支到远程仓库：
`git push -u origin new_feature`

**远程的main分支合并两个远程分支：**

1. 切换到main: 
`git switch main`
2. 拉最新的main：
`git pull origin main`
3. 合并两个远程分支到main：
`git merge origin/branch1`
`git merge origin/branch2`
4. 在解决冲突后，将合并后的main推送：
`git push origin main`

**有的时候，本地改了一大堆代码，发现坑越来越大，还不如直接放弃本地所有修改：**
`git reset --hard`
**放弃特定文件的修改：**
`git checkout -- <filename>`

## Git变基操作：
变基可以将多个提交合并成一个，依次放在最新提交后，从而减少了冗余的提交记录。这有助于保持项目历史的清晰和易读。

1. 更新仓库：
`git pull origin your_branch_name`
2. 切换分支：
`git checkout your_branch_name`
3. 将本地的分支变基到远程的main：
`git rebase main`
4. 将本地更改推送到仓库：
`git push origin your_branch_name --force`

**在本地分支编辑，推送时rebase合并到main：**

1. 切换到本地分支：
`git switch branch_name`
2. 编辑文件
3. 提交和commit
4. 拉取main的最新更改：
`git pull origin main`
5. 变基：
`git rebase main`
6. 推送：
`git push origin branch_name`

# 服务器安装git lfs：
最后顺带讲一下在服务器上下载大文件时需要的操作。使用curl指令下载git-lfs并进行安装：

`curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash`

`sudo apt-get install git-lfs`

有时候会出现Git clone GnuTLS recv error (-110)报错，只需要输入以下命令即可解决：

`git config --global --unset http.https://github.com.proxy`

2023/12/29 于昆山
