---
title: Python Web开发：SQLAlchemy
date: 2024-06-02 10:10:47
tags:
  - Python
  - Web开发
  - Flask
  - 工程实践
  - SQLAlchemy
categories: Python
excerpt: SQLAlchemy介绍，主要数据库连接，操作等。
index_img:  "/img/flask.png"
---

上一篇博文简单介绍了Flask的使用，这次深入一下，研究如何将一个Web应用和数据库相结合。这就需要用到今天要提及的SQLAlchemy。

要了解SQLAlchemy，首先需要认识ORM。ORM在数据库中是指对象关系映射，通过某种映射，开发者可以通过面向对象的方式操作数据库。数据库的表被映射成类，行实例代表数据库中的记录，属性则对应于记录中的字段。具体而言，开发者不需要直接使用SQL语句就能编写DDL等数据库操作指令。

# 简单上手

首先我们简单用Flask蓝图，PostgresSQL来实现一个连接本地数据库，并插入数据的操作。

要做到这一点，我们需要实现几个内容：

- 本地构建一个PG数据库，我使用了docker来构建。
- 编写一个`db`文件，用来定义数据库模型，并且实现数据库写入的操作。
- 编写一个Flask应用的配置文件，以达到灵活配置的作用。
- 使用蓝图，并在蓝图中定义一个插入数据库的操作路由。
- 编写一个Flask主程序，用来实例化Flask程序，并注册蓝图和初始化。

## Postgres数据库的构建

Docker如何使用就不赘述了，执行以下命令行构建一个数据库：

```bash
 docker run --name flask_db -e POSTGRES_PASSWORD=12345 -p 5432:5432 -d postgres
```

上述指令会构建一个名为`flask_db`的镜像，里面是一个PG数据库，默认名为`postgres`。

## 配置文件的编写

配置文件用来保存一些隐私数据，例如数据库密码等。我们新建一个`config.py`文件，里面定义`Config`类，来保存配置文件：

```python
import os
import dotenv

dotenv.load_dotenv()

DEFAULTS = {
    'DB_USERNAME': 'postgres',
    'DB_PASSWORD': '12345',
    'DB_HOST': 'localhost',
    'DB_PORT': '5432',
    'DB_DATABASE': 'postgres',
    'DB_CHARSET': '',
}

def get_env(key):
    return os.environ.get(key, DEFAULTS.get(key))

class Config:
    SQLALCHEMY_DATABASE_URI = f"postgresql://{get_env('DB_USERNAME')}:{get_env('DB_PASSWORD')}@{get_env('DB_HOST')}:{get_env('DB_PORT')}/{get_env('DB_DATABASE')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
```

配置文件写完，先暂时不用，我们去写数据库相关的操作。

## 数据库相关定义

我们需要用到`SQLAlchemy`来定义数据库模型。按照顺序，我们需要先对数据库实例化，随后定义模型，以及一个初始化方法。

```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    def __repr__(self):
        return '<User %r>' % self.username
    
def init_db():
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', email='admin@example.com')
        db.session.add(admin)
    
    if not User.query.filter_by(username='guest').first():
        guest = User(username='guest', email='guest@example.com')
        db.session.add(guest)
    
    db.session.commit()
```

`User`类继承自`db.Model`，实际上就是定义的数据库模型。而`init_db`用到了事务，来向数据库写入两个sample数据。

## 定义蓝图

随后，我们创建一个`blueprint.py`，在里面定义一个蓝图，这个蓝图专门负责用户相关的操作。这里我只定义了一个添加用户的操作，并且内容是写死的。

```python
from flask import Blueprint, request, jsonify
from db import db, User

user_bp = Blueprint('user_bp', __name__)

@user_bp.route('/add_user', methods=['POST'])
def add_user():
    username = 'user1' 
    email = 'zy1@gmail.com' 
    new_user = User(username=username, email=email)
    db.session.add(new_user)
    db.session.commit()
    return jsonify(message='User added successfully')
```

## 定义主程序

目前为止我们构建的三个文件都只是独立且割裂的，我们需要在主程序应用中将它们串联起来。我们构建一个`app.py`：

```python
from flask import Flask
from config import Config
from db import db, User, init_db
from blueprint import user_bp

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    # 读取配置文件
    app.config.from_object(Config)
	
    # SQLAlchemy的Flask应用初始化方法
    db.init_app(app)
	
    # 数据库的初始化，后续用flask db migrate代替
    with app.app_context():
        db.create_all()
        init_db()
    
    # 注册蓝图
    app.register_blueprint(user_bp)
    return app

app = create_app()
```

这样，一个简单的应用就完成了。我们使用`flask run --debug`来执行。这时，直接向`http://localhost:5000/add_user`发送POST请求后，可以看到数据库里就创建并写入了一张新表。

> 上面包含了一段内容：
>
> ```python
> with app.app_context():
>     db.create_all()
>     init_db()
> ```
>
> 这段代码的作用是将定义好的模型同步到数据库。不过每次用上下文终归是太麻烦，因此可以使用`Flask-Migrate`代替。

### Flask Migrate

Flask-Migrate是一个 Flask 扩展，用来处理 SQLAlchemy 数据库迁移。例如我们在前面定义的`User`类中新增一个字段，这时候数据库里并不会直接增加字段，我们就需要使用Flask-Migrate来进行数据库的同步。

执行`pip install flask-migrate`进行安装。

在主应用中导入`Migrate`模块并初始化，以下是示例代码：

```python
from flask_migrate import Migrate

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)

    db.init_app(app)
    # 初始化 Flask-Migrate
    migrate = Migrate(app, db)

    return app
```

随后，执行`flask db init`来初始化迁移脚本的存储库。这个指令类似于Git仓库的初始化，只要执行一次就行了。

随后需要创建一个迁移的脚本，代码为`flask db migrate -m "Initial migration."`。这段代码的作用是检测数据库模型与当前数据库状态之间的差异，并自动生成一个迁移脚本。

最后执行`flask db upgrade`，作用是将应用迁移脚本到数据库，并修改数据库结构。

2024/6/2 于苏州
