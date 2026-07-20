---
title: "SyncTV+AList+阿里云盘搭建服务器同步观影影院"
description: "使用SyncTV+AList+阿里云盘在服务器上搭建一个支持同步观影的影院。"
pubDate: "2024-06-30 14:21:24"
---

入职前的一周在家里好好休息了一阵，乘着这个功夫，我在阿里云服务器上部署了一些个人感觉比较有意思的服务，例如一个部署于服务器的一个视频播放直播间。

这个方案主要解决的是多人共同观影的问题。例如以前想要和对象一起看视频，都需要一起打开同一个网站，然后随时同步两个人的观看进度，这中间会出现两边网速不一致导致的卡顿，资源难获取的问题。而通过SyncTV这个项目能够构建一个平台，并在这个平台上实现的资源的共享和同步。

# 部署SyncTV

部署SyncTV相当简单，只需要使用docker就可以快速部署：`docker run -d --name synctv -p 8080:8080 synctvorg/synctv`。

这会在服务器的8080端口启动服务，如果需要公网访问，那么需要在服务器的安全组策略设置端口的开放。默认进入这个地址，会出现一个登录界面。管理员账户名/密码均为`root`。

登录之后，首页会显示为空。这时候就可以随意创建房间了。创建房间后，能够设置房间名，密码等等。

![](/_posts/SyncTV-Alist-%E9%98%BF%E9%87%8C%E4%BA%91%E7%9B%98%E6%90%AD%E5%BB%BA%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%90%8C%E6%AD%A5%E8%A7%82%E5%BD%B1%E5%BD%B1%E9%99%A2/240630-1.png)

创建完毕之后，就能够进入房间，并且在房间的界面里，能够添加各自形式的影片链接，包括Bilbil，通过添加Bv号，能够添加到影片列表。由于无法登录，播放的B站视频都是720p。

![](/_posts/SyncTV-Alist-%E9%98%BF%E9%87%8C%E4%BA%91%E7%9B%98%E6%90%AD%E5%BB%BA%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%90%8C%E6%AD%A5%E8%A7%82%E5%BD%B1%E5%BD%B1%E9%99%A2/240630-2.png)

至此，SyncTV顺利部署完成。

# 部署AList

AList是一个多存储的文件列表系统，它能够支持网盘的统一管理。通过这种方式就能够将网盘资源统一在一个服务里。通过将这个服务和SyncTV连接，能够实现直连网盘资源。

同样通过Docker进行部署：`docker run -d --restart=unless-stopped -v /etc/alist:/opt/alist/data -p 5244:5244 -e PUID=0 -e PGID=0 -e UMASK=022 --name="alist" xhofe/alist:latest`。

随后需要进容器设置一下账户和密码：`docker exec -it alist ./alist admin random`，`docker exec -it alist ./alist admin set YourNewPassword`

在后者需要将`YourNewPassword`设置为你想要的密码。

## 在AList部署阿里云盘

通过访问`localhost:5244`，能够进入Alist的管理界面。注意同样需要设置端口的开放。

![](/_posts/SyncTV-Alist-%E9%98%BF%E9%87%8C%E4%BA%91%E7%9B%98%E6%90%AD%E5%BB%BA%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%90%8C%E6%AD%A5%E8%A7%82%E5%BD%B1%E5%BD%B1%E9%99%A2/240630-3.png)

进入存储，我们需要在这里配置阿里云盘的挂载。AList接入了阿里云盘的开发者API，因此能够获取到云盘中的资源。

我们需要配置的参数选项是以下几个：

- 驱动
- 挂载路径
- 根文件夹ID
- 刷新令牌
- Oauth令牌链接
- 移除方式

其中驱动需要配置为`阿里云盘Open`。挂载路径可以配置为`/`，意为根目录。

根文件夹ID为阿里云盘的文件夹ID，打开阿里云盘官网，点击进入要设置的文件夹时点击 URL 后面的字符串，例如`https://www.alipan.com/drive/folder/5fe01e1830601baf774e4827a9fb8fb2b5bf7940`，这个文件夹的 file_id 即为 5fe01e1830601baf774e4827a9fb8fb2b5bf7940。

刷新令牌需要在`https://alist.nn.ci/tool/aliyundrive/request`获取，进入以后需要在里面扫描阿里云盘的二维码，扫描后会获得一长串Token。

接下来需要修改`Oauth令牌链接`为：`https://api.xhofe.top/alist/ali_open/token`。

保存后，通过访问服务器的5244端口，就能访问到云盘里的内容了。

![](/_posts/SyncTV-Alist-%E9%98%BF%E9%87%8C%E4%BA%91%E7%9B%98%E6%90%AD%E5%BB%BA%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%90%8C%E6%AD%A5%E8%A7%82%E5%BD%B1%E5%BD%B1%E9%99%A2/240630-4.png)

至此AList也部署完成了。

# SyncTV配置AList

最后一步是在SyncTV配置AList的账户，我们需要按照以下步骤进行执行：

- 管理后台 --> 点击用户名(root) --> 平台绑定
- AList --> 添加账号
- 地址：[http://127.0.0.1:5244](http://127.0.0.1:5244/) （127.0.0.1需要替换成你的服务器ip）
- 输入AList账号密码后点击登录

此时进入SyncTV的房间，就能在添加影片中选择AList了。

2024/6/30 于苏州