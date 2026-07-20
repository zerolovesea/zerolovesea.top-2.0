---
title: "Docker Compose编写指南"
description: "Docker Compose的编写教程，如何配置各个参数。"
pubDate: "2024-04-20 08:14:46"
---

相关链接：[Docker Compose | 菜鸟教程](https://www.runoob.com/docker/docker-compose.html)


前面学习了一些Docker容器的构建和应用，实际项目中通常不止用到一个Docker，往往会有多个Docker组建网络，这个时候就需要用到Docker Compose了。

> Docker Compose用于定义和运行多容器。通过`docker-compose up`能够启动在`docker-compose.yml`中定义的整个应用程序。
> 

# Compose的三个步骤

1. 使用Dockerfile定义容器环境。
2. 使用`docker-compose.yaml`定义构成应用的服务。
3. 使用`docker-compose up`来启动服务。

# 示例配置

以下提供了一个`docker-compose.yml`的示例配置文件：

```yaml
# 使用Docker Compose文件格式版本3
version: "3"  

services:

  redis:
    # 使用基于Alpine Linux的Redis镜像，体积较小
    image: redis:alpine  
    ports:
      # 将容器的6379端口暴露给主机
      - "6379"  
    networks:
      # 连接到前端网络
      - frontend  
  db:
    # 使用PostgreSQL 9.4版本的官方镜像
    image: postgres:9.4  
    volumes:
      # 持久化PostgreSQL数据
      - db-data:/var/lib/postgresql/data  
    networks:
      # 连接到后端网络
      - backend  

  vote:
    # 添加构建配置
    build:  
      # 设置Docker构建上下文目录为当前目录下的vote子目录
      context: ./vote  
      # 指定Dockerfile文件路径
      dockerfile: Dockerfile  
    ports:
      # 映射容器的80端口到主机的5000端口
      - 5000:80  
    networks:
      # 连接到前端网络
      - frontend  
    depends_on:
      # 依赖于redis服务
      - redis  

  result:
    # 添加构建配置
    build:  
      # 设置Docker构建上下文目录为当前目录下的result子目录
      context: ./result  
      # 指定Dockerfile文件路径
      dockerfile: Dockerfile  
    ports:
      # 映射容器的80端口到主机的5001端口
      - 5001:80  
    networks:
      # 连接到后端网络
      - backend  
    depends_on:
      # 依赖于数据库服务
      - db  

  worker:
    # 工作服务的镜像，用于处理后台任务
    image: dockersamples/examplevotingapp_worker  
    networks:
      # 连接到前端网络
      - frontend  
      # 也连接到后端网络
      - backend  

  visualizer:
    # 使用稳定版本的可视化工具镜像
    image: dockersamples/visualizer:stable  
    ports:
      # 映射端口8080到主机
      - "8080:8080"  
    # 设置容器停止前的宽限期为1分30秒
    stop_grace_period: 1m30s  
    # 挂载Docker套接字文件
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"  

networks:
  # 声明前端网络
  frontend:  
  # 声明后端网络
  backend:  

volumes:
  # 声明持久化卷，用于存储数据库数据
  db-data:  
```

上面这个示例展示了compose的基础使用方法。我们拉取了Docker Hub的官方镜像作为我们服务中的基础镜像，并在`images`选项中定义镜像的版本。除此之外，`enviroment`，`ports`都比较好理解，也就是在这个服务中对应容器对外拿的环境变量，以及端口。

# 利用自己构建的镜像定义compose

上面的例子中，我们的服务使用的是官方镜像，这种情况下我们无需写Dockerfile。而如果我们需要自己定义镜像，应该怎么处理呢？以下是一个示例：

## 定义应用

首先，我们定义一个应用，它基于Flask，使用Redis监听等待时间。

```python
import time

import redis
from flask import Flask

app = Flask(__name__)
cache = redis.Redis(host='redis', port=6379)

def get_hit_count():
    retries = 5
    while True:
        try:
            return cache.incr('hits')
        except redis.exceptions.ConnectionError as exc:
            if retries == 0:
                raise exc
            retries -= 1
            time.sleep(0.5)


@app.route('/')
def hello():
    count = get_hit_count()
    return 'Hello World! I have been seen {} times.\n'.format(count)
```

随后我们需要写一个`requirements.txt`。这里只要两个依赖项：flask和redis。

## 编写Dockerfile

下一步是写Dockerfile，我们以python 3.7作为基础镜像。

```dockerfile
# 基础镜像
FROM python:3.7-alpine

# 工作目录
WORKDIR /code

# 环境变量 设置app.py作为Flask启动默认脚本
ENV FLASK_APP app.py

ENV FLASK_RUN_HOST 0.0.0.0

# 复制安装依赖项
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# 将当前目录的文件复制到容器的工作目录
COPY . .

# 启动
CMD ["flask", "run"]
```

## 编写Docker Compose

接下来定义`docker-compose.yml`。我们在目录路径下新建文件，内容如下：

```yaml
version: '3'
services:
  # web服务通过当前路径下的Dockerfile自动构建
  web:
    build: .
    ports:
      # 宿主机端口：容器端口
      - "5000:5000"
  redis:
    image: "redis:alpine"
```

接下来就是`docker-compose up`。这将会构建web镜像并拉取redis镜像（也可以先`docker-compose build`再`up`）。此时访问`localhost:5000`即可观察到前面写的页面服务。

## 设置挂载路径

对应flask服务，能够实时修改代码并更新，这时可以把宿主机的代码挂载到容器内，这样就可以随时修改应用程序，而无需重新构建镜像。

```yaml
version: '3'
services:
  web:
    build: .
    ports:
      - "5000:5000"
    # 添加了挂载路径，将当前目录挂载至容器目录
    volumes:
      - .:/code
    environment:
      # Flask环境变量
      FLASK_ENV: development
  redis:
    image: "redis:alpine"
```

# Docker Compose命令行

Docker Compose的命令行参数有以下几个常用参数：

## docker compose

```bash
docker-compose [-f <arg>...] [options] [COMMAND] [ARGS...]

-f --file FILE指定Compose模板文件，默认为docker-compose.yml
-p --project-name NAME 指定项目名称，默认使用当前所在目录为项目名
--verbose  输出更多调试信息
-v，-version 打印版本并退出
--log-level LEVEL 定义日志等级(DEBUG, INFO, WARNING, ERROR, CRITICAL)
```

## docker compose up

```bash
docker-compose up [options] [--scale SERVICE=NUM...] [SERVICE...]

-d 在后台运行服务容器
-no-color 不是有颜色来区分不同的服务的控制输出
-no-deps 不启动服务所链接的容器
--force-recreate 强制重新创建容器，不能与-no-recreate同时使用
–no-recreate 如果容器已经存在，则不重新创建，不能与–force-recreate同时使用
–no-build 不自动构建缺失的服务镜像
–build 在启动容器前构建服务镜像
–abort-on-container-exit 停止所有容器，如果任何一个容器被停止，不能与-d同时使用
-t, –timeout TIMEOUT 停止容器时候的超时（默认为10秒）
–remove-orphans 删除服务中没有在compose文件中定义的容器
```

## docker compose build

```bash
docker-compose build [options] [--build-arg key=val...] [SERVICE...]
构建（重新构建）项目中的服务容器。

–compress 通过gzip压缩构建上下环境
–force-rm 删除构建过程中的临时容器
–no-cache 构建镜像过程中不使用缓存
–pull 始终尝试通过拉取操作来获取更新版本的镜像
-m, –memory MEM为构建的容器设置内存大小
–build-arg key=val为服务设置build-time变量
服务容器一旦构建后，将会带上一个标记名。可以随时在项目目录下运行docker-compose build来重新构建服务
```

以上是几个常用的命令行指令，还有`down`，`start`等指令比较易懂，就不放这了。

# Service配置项

`docker-compose.yml`的大部分配置都聚焦在`service`这一块，有很多参数需要了解：

## build

指定 `Dockerfile` 所在文件夹的路径,`Compose` 将会利用它自动构建镜像。如：

```yaml
version: '3.8'
services:

  webapp:
    build: ./dir
```

### context

可以使用 `context` 指定文件夹路径（可以是 Dockerfile 的目录路径，也可以是 git 存储库的 url），使用 `dockerfile` 指定 `Dockerfile` 文件名，使用 `arg` 为 `Dockerfile`中的变量赋值。如：

```yaml
version: '3.8'
services:

  webapp:
    build:
      context: ./dir
      dockerfile: Dockerfile-alternate
      args:
        buildno: 1
```

如果在 `build` 同时指定了 `image`，那么 Compose 会使用在 `image` 中指定的名字和标签来命名最终构建的镜像。如:

```yaml
build: ./dir
image: webapp:tag
```

这将从 `./dir`构建，生成名为 `webapp`，标签为：`tag` 的镜像。

`build`参数下包括了以下参数：

- context：上下文路径。
- dockerfile：指定构建镜像的 Dockerfile 文件名。
- args：添加构建参数，这是只能在构建过程中访问的环境变量。
- labels：设置构建镜像的标签。
- target：多层构建，可以指定构建哪一层。

## image

指定要从哪个镜像启动容器，以下是一个示例：

```yaml
version: "3.8"
services:
  webserver:
    image: nginx:latest
    ports:
      - "80:80"
```

假如已经在本地有了一个自定义的镜像，也可以进行类似的操作：

```yaml
version: "3.8"
services:
  myservice:
    image: myusername/myapp:1.0
    ports:
      - "8080:80"
```

> 当需要使用`docker compose build`时，`docker compose.yml`文件中需要包含的是`build`参数，这需要和`images`区分开。

## volumes

设置挂载路径，书写格式是`宿主机文件路径：容器文件路径`：

```yaml
version: "3.8"
services:
  db:
    image: postgres
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: mysecretpassword

volumes:
  db-data:
```

## restart

`restart`是容器的重启策略，包括了：

- `no`：默认值，容器不会在退出时自动重启。
- `always`：无论容器因何种原因停止，都将尝试重启容器。
- `on-failure`：仅当容器非正常退出时（退出状态非零）重启容器。
- `unless-stopped`：除非容器被人为停止（例如通过 Docker 命令），否则在退出时总是重启。

```yaml
version: "3.8"
services:
  web:
    image: nginx
    ports:
      - "80:80"
    restart: always
```

## command

覆盖容器启动的默认命令：

```yaml
command: ["bundle", "exec", "thin", "-p", "3000"]
```

这样就不需要重写Dockerfile并构建新镜像。

## container_name

指定容器名称。默认将会使用 `项目名称_服务名称_序号` 这样的格式，设置此项后可以自定义容器名：

```yaml
version: "3.8"
services:
  webapp:
    image: node:14
    container_name: webapp_dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    working_dir: /app
    command: npm start
```

这样设置以后，就可以通过`docker logs webapp_dev` 或 `docker exec -it webapp_dev /bin/bash` 等命令来操作这个容器，而不是`项目名_webapp_`这样类似的格式。

## depends_on

指定服务之间的依赖关系，以便按顺序启动服务。以下例子中会先启动 `redis` `db` 再启动 `web`

```yaml
version: '3.8'

services:
  web:
    build: .
    depends_on:
      - db
      - redis

  redis:
    image: redis

  db:
    image: postgres
```
## env_file

从文件中添加环境变量。可以是单个值或列表。

如果通过 `docker-compose -f FILE` 方式来指定了 Compose 文件，则 `env_file` 中变量的路径相对于文件所在目录。

在 `environment` 声明的变量，会覆盖这些值。即使这些值为空或未定义。

```yaml
env_file: .env

env_file:
  - ./common.env
  - ./apps/web.env
  - /opt/secrets.env
```

假设我们有一个`.env`文件内容如下：

```yaml
DB_HOST=localhost
DB_USER=myuser
DB_PASS=mypassword
```

我们在`docker compose`文件中定义：

```yaml
version: "3.8"
services:
  webapp:
    image: my-webapp-image
    ports:
      - "5000:5000"
    env_file: 
      - .env
```

当服务启动时，`docker compose`会从配置文件中读取环境变量并设置在容器中。


## environment

管理环境变量的另一种方式是使用`environment`参数。它可以显式的在yaml文件中配置环境变量：

```yaml
version: "3.8"
services:
  webapp:
    image: my-webapp-image
    ports:
      - "5000:5000"
    environment:
      - DB_HOST=localhost
      - DB_USER=myuser
      - DB_PASS=mypassword
```

> 使用`env_file`可以更好地管理大量或敏感的环境变量，而`environment`提供了直接和灵活的方式来设置少量或不敏感的环境变量。


## secrets

存储敏感数据，例如 `mysql` 服务密码。

```yaml
version: "3.8"
services:
  redis:
    image: redis:latest
    deploy:
      replicas: 1
    secrets:
      - my_secret
      - my_other_secret
secrets:
  my_secret:
    file: ./my_secret.txt
  my_other_secret:
    external: true
```

## network

通过`network`参数设置不同容器之间的通信：

```yaml
version: "3.8"
services:
  webapp:
    image: my-webapp-image
    networks:
      - frontend
    ports:
      - "5000:5000"

  db:
    image: my-db-image
    networks:
      - backend

networks:
  frontend:
  backend:
```

上述例子中：

- webapp 服务只连接到 frontend 网络。
- db 服务只连接到 backend 网络。

通过这种方式，webapp 不能直接访问 db，除非将 db 也连接到 frontend 网络或者 webapp 连接到 backend 网络。

## expose

在服务内部的网络里开放端口，这是让一个服务内的不同容器相互通信。它与`ports`不同，并不对外开放端口。

假如网络中有前后端服务的容器服务，我们需要前后端的容器相互对接端口，我们需要编写以下内容：

```yaml
version: "3.8"
services:
  frontend:
    image: frontend-image
    ports:
      - "5000:5000"
    networks:
      - app-network

  backend:
    image: backend-image
    expose:
      - "4000"
    networks:
      - app-network

networks:
  app-network:
```

在这个配置中：

- `frontend`服务通过`ports`指令将容器的 5000 端口映射到宿主机的 5000 端口，允许外部网络访问。
- `backend`服务使用`expose`指令暴露 4000 端口，但这个端口只在内部`app-network`网络中可见，外部网络无法直接访问。
- `frontend`和`backend`都连接到了同一个`app-network`网络，因此`frontend`可以通过内部网络访问`backend`的 4000 端口，进行必要的数据交互。

如果不设置`networks`选项的话，会链接到默认的网络中。

2024/4/21 于苏州 
