---
title: Git：常用指令汇总
date: 2024-03-16 09:51:56
tags: 
  - Git
  - 工程实践
categories: Git
excerpt: 项目版本控制/协同开发必不可少的Git命令。
index_img: "/img/git.png"
---

此前在[项目协同开发-Git基础操作](https://zerolovesea.github.io/2023/12/29/项目协同开发-Git基础操作/)一文中简单写了一些常用的git的基础操作，这次增加了一些其他的指令。



# 配置管理

如果要查看Git中配置的用户名和邮箱地址，使用以下命令：

```bash
git config --global user.name
git config --global user.email
```

在后面加上用户名和邮箱地址，即可修改，例如`git config --global user.name "Your Name"`。

# 修改远程仓库地址

如果要修改本地仓库管理的远程仓库地址，需要使用以下指令：

```bash
git remote remove origin  # 删除该远程路径  
git remote add origin git@jslite.github.com:JSLite/JSLite.git  # 添加远程路径 
```

# 撤销提交记录

如果撤销本地的提交记录，并在远程进行同步，需要执行以下命令：

```bash
git reset --hard HEAD~1 # 撤销一条记录   
git push -f origin HEAD:master # 同步到远程仓库的master分支

git push -f origin HEAD:dev # 如果想撤销远程仓库的dev分支
```

# reset和revert的区别是什么？

简单一句话总结：

- `git reset` 用于在本地修改提交历史，可能会导致丢失提交历史。
- `git revert` 用于在提交历史中创建新的提交，以撤销之前的更改，而不会修改提交历史。

如果要回退到某个版本，需要执行以下指令：

```bash
git reset --hard <hash>
# 例如 git reset --hard a3hd73r
# --hard代表丢弃工作区的修改，让工作区与版本代码一模一样，与之对应，
# --soft参数代表保留工作区的修改。
```

如果要回滚到某个commit提交：

```bash
git revert HEAD~1 # 撤销一条记录 会弹出 commit 编辑
git push # 提交回滚
```

需要更保守的去除某个commit：

```bash
# 实质是新建了一个与原来完全相反的commit，抵消了原来commit的效果
git revert <commit-hash> 
```

# 将A分支的某一commit提交至B分支

有的时候，两个分支同时都拥有同一个文件。进行修改后，可以同时commit到这两个分支，比如 `master` 分支和 `dev` 分支，都拥有文件 `.env` ，在 `master` 或者 `dev` 分支下对 `.env` 进行修改后，把修改的文件同时提交到 `master` 分支和 `dev` 分支。

```
git checkout <branch-name> && git cherry-pick <commit-id>
```

# 查看提交历史

使用以下命令来查看提交日志：

```bash
git log
```

如果要在一行进行查看，则加上`--oneline`：

```bash
git log --oneline -5 # 查看最近的5个提交日志
```

# 查看某一文件的历史

有时候需要查看某一个文件的所有历史改动，可以使用以下的这些指令：

```bash
git log --pretty=oneline 文件名  # 列出文件的所有改动历史  
git show c178bf49   # 某次的改动的修改记录  
git log -p c178bf49 # 某次的改动的修改记录  
git blame 文件名     # 显示文件的每一行是在那个版本最后修改。  
git whatchanged 文件名  # 显示某个文件的每个版本提交信息：提交日期，提交人员，版本号，提交备注（没有修改细节）  
```

# 合并多个commit

有时候需要将多个commit历史合并成一个，让提交记录更加简洁：

首先输入：
```bash
git rebase -i HEAD~5 # 合并最近的5个提交
```

这将会打开文本编辑器，你可以选择是否进行保留和合并。将除第一个提交之外的行前面的单词改为 `squash`（或 `s`），这样 Git 将会把这些提交合并到第一个提交中。

```bash
pick <commit_hash> Commit message 1
squash <commit_hash> Commit message 2
squash <commit_hash> Commit message 3
squash <commit_hash> Commit message 4
squash <commit_hash> Commit message 5
```

保存并关闭后，进行提交：

```bash
git push -f origin HEAD:branch_name
```

# 删除分支

删除分支包括以下常用指令：

```bash
git push origin :branchName  # 删除远程分支  
git push origin --delete new # 删除远程分支new   
git branch -d branchName     # 删除本地分支，强制删除用-D  
git branch -d test      # 删除本地test分支   
git branch -D test      # 强制删除本地test分支   
git remote prune origin # 远程删除了，本地还能看到远程存在，这条命令删除远程不存在的分支
```



2024/3/16 于苏州