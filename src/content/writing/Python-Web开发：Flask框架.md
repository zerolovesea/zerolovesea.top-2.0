---
title: "Python Web开发：Flask框架"
description: "Python的经典网络框架Flask介绍，主要包含配置项，注册数据库，蓝图。"
pubDate: "2024-06-01 6:30:35"
---

Flask和FastAPI在目前的工作中是老生常谈的话题了，不过一直都是上手就用，遇到不会的就看文档，知识比较散落，并且容易忘记。因此这次做个整理，将Flask中一些常用的概念记录一下。

# 基本用法

基本用法不再赘述，流程就是先实例化`app`，使用Flask定义的装饰器来定义路由，最后设置`app`的监听端口等配置项：

```python
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
```

> 上面的代码有两种执行方法：
>
> 1. 直接python 文件名.py：此时会在本机IP的8080端口起服务。
> 2. 命令行设置环境变量，用`flask run`执行。例如以下：
>
> ```python
> export FLASK_APP=myapplication.py # 如果文件名为app.py，无需设置环境变量，直接运行flask run
> flask run --host=0.0.0.0 --port=8080
> ```

## 基本的HTTP方法

几种常用的方式能够定义，例如路由方法直接使用：

```python
from flask import request

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return do_the_login()
    else:
        return show_the_login_form()
```

或者`app`实例内置的方法：

```python
from flask import Flask, request

app = Flask(__name__)

@app.get('/hello')
def hello_world():
    return 'Hello, World!'

@app.post('/upload')
def upload_file():
    file = request.files['file']
    file.save('/tmp/' + file.filename)
    return 'File uploaded'
```

# 读取配置项构建应用

实际较大的项目中，需要配置诸多选项，这时如果只是用上面的方法构建实例`app`，那就会比较不灵活，这时能够通过定义应用工厂来实现。所谓应用工厂对应的是设计模式里的工厂函数。以下是官方示例代码：

```python
import os
from flask import Flask

def create_app(test_config=None):
    # 首先构建实例，instance_relative_config用来定义应用配置文件是处于一个相对路径
    app = Flask(__name__, instance_relative_config=True)
    
    # 加载默认的一些核心配置
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )

    if test_config is None:
        # 读取python文件格式的配置文件，用来设置额外参数
        app.config.from_pyfile('config.py', silent=True)
    else:
        # 读取字典格式的配置入参，用来设置额外参数
        app.config.from_mapping(test_config)

   	# 确定实例路径存在
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    @app.route('/hello')
    def hello():
        return 'Hello, World!'

    return app
```

执行`flask --app flaskr run --debug`来运行应用。这时能够在默认`5000`访问到`hello`函数。

## 实际场景

以下是一个较为实际的项目场景：

```python
from flask import Flask, request
from config import Config

# 自定义类，继承自Flask
class ServiceApp(Flask):
    pass

def create_app():
    app = ServiceApp(__name__) # app = Flask(__name__)

    app.config.from_object(Config())
    logging.basicConfig(level=app.config.get('LOG_LEVEL', 'INFO'))
	# 初始化及注册
    initialize_extensions(app)
    register_blueprints(app)
    register_commands(app)
    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) # flask run --host 0.0.0.0 --port=5000 --debug
```

上面的`initialize_extensions`和注册函数暂且不看，我们在`app.config.from_object`的入参是一个`Config()`对象，内容大致如下：

```python
class Config:
    def __init__(self):
        self.CURRENT_VERSION = "0.0.1"
        self.COMMIT_SHA = get_env('COMMIT_SHA')
        self.EDITION = "SELF_HOSTED"
        self.DEPLOY_ENV = get_env('DEPLOY_ENV')
        self.TESTING = False
        self.LOG_LEVEL = get_env('LOG_LEVEL')
```

# 数据库定义

和Web应用最紧密相关的无疑是数据库的连接，这里我们假设拥有一个Flask项目，我们在这个项目下构建一个文件夹`/db`，并在文件夹下新建`db.py`。

```python
import sqlite3

# click用来执行命令行脚本相关命令
import click
# g是一个特殊对象，用来存储请求期间的数据
# current_app 指向处理请求的flask应用
from flask import current_app, g 

# 获得数据库连接
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        # 返回行
        g.db.row_factory = sqlite3.Row
    return g.db

# 关闭数据库连接
def close_db(e=None):
    db = g.pop('db', None)

    if db is not None:
        db.close()
```

这里的`get_db`方法用来获取数据库连接，不过目前数据库里还没有数据。我们需要创建数据。

首先在`/db`路径下创建一个`schema.sql`，里面存储一些创建表的SQL命令：

```python
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS post;

CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES user (id)
);
```

随后在`/db/db.py`中加入执行这段命令的Python代码：

```python
def init_db():
    db = get_db()

    with current_app.open_resource('schema.sql') as f:
        db.executescript(f.read().decode('utf8'))


@click.command('init-db')
def init_db_command():
    """Clear the existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')
```

这段代码的核心是`init_db`，它首先使用`get_db`方法连接了数据，随后使用`executescript`执行了创建数据表的SQL命令。

随后，通过`click`库中的`command`方法，定义了一个`init-db`的方法。当执行`flask init-db`时，就会执行`init_db_command`函数，也就是数据表的初始化。

# 注册应用

上面两个函数现在我们只是写好了，但是并没有和我们的Flask应用相关联，因此我们需要进行注册。

目前为止，我们对数据库的操作方法都在`db.py`中，同样的，数据库初始化我们也放在这里。我们加入一个新的方法`init_app`，它用来执行数据库初始化以及正常关闭。

```python
# init_app方法接收一个Flask实例，并执行绑定的命令
def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
```

随后，我们在Flask应用初始化的位置（例如`__init__.py`）引入这个方法：

```python
def create_app():
    app = Flask(__name__, instance_relative_config=True)
    
    # 加载默认的一些核心配置
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )
    app.config.from_pyfile('config.py', silent=True)
    from . import db
    db.init_app(app)

    return app
```

这样，初始化数据库函数就在应用中进行了注册，我们使用`flask --app flaskr init-db`既可初始化。

![](/_posts/Python-Web%E5%BC%80%E5%8F%91%EF%BC%9AFlask%E6%A1%86%E6%9E%B6/240601-1.png)

## 实际场景

实际场景中，我们项目中会使用`SQLAlchemy`来实例化数据库。这是一个 Python ORM 框架，用于将数据库操作映射为 Python 对象的操作。

```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_app(app):
    db.init_app(app)
```

同时，我们需要在Flask应用中加上它的配置参数，我们有两种方法：

```python
from flask import Flask
from db_module import init_app  

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///example.db'
init_app(app)  # 这会初始化 SQLAlchemy，并使用配置好的数据库 URI
```

> 通常`SQLALCHEMY_DATABASE_URI`的格式如下：
>
> ```python
> dialect+driver://username:password@host:port/database
> ```
>
> **dialect**：SQLAlchemy 使用的数据库类型，如 `postgresql`, `mysql`, `sqlite` 等。
> **driver**：连接数据库时使用的 DBAPI，这通常可以省略。
> **username**：连接数据库的用户名。
> **password**：对应的密码。
> **host**：数据库服务器的地址。
> **port**：数据库服务器的端口。
> **database**：要连接的数据库名称。

面对如此多的参数，我们可以在`Config`类中定义：

```python
class Config:
    def __init__(self):
        db_credentials = {
            key: get_env(key) for key in
            ['DB_USERNAME', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_CHARSET']
        }
        self.SQLALCHEMY_DATABASE_URI = f"postgresql://{db_credentials['DB_USERNAME']}:{db_credentials['DB_PASSWORD']}@{db_credentials['DB_HOST']}:{db_credentials['DB_PORT']}/{db_credentials['DB_DATABASE']}{db_extras}"
```

随后在Flask应用的设置中引入参数：

```python
from flask import Flask, request
from config import Config

# 自定义类，继承自Flask
class ServiceApp(Flask):
    pass

def create_app():
    app = ServiceApp(__name__) # app = Flask(__name__)

    app.config.from_object(Config())
    logging.basicConfig(level=app.config.get('LOG_LEVEL', 'INFO'))
	# 数据库初始化
    db.init_app(app)
    return app

app = create_app()
```

# 蓝图

什么是蓝图？在Flask中，我们可以把它看作是一个Flask应用的子集。

在我们之前的代码中，我们都在为主Flask应用注册路由。例如`hello_world`方法通过主路由调用。如果项目中包含了多个应用，这时只通过主路由调用就不那么优雅了。Flask提供的蓝图方法支持将应用分解成不同的组件，每个组件都用来处理单独的操作，最后在主路由上统一注册。

以下是一个简单示例，例如如果想创建一个处理用户相关的蓝图，我们需要实现以下代码：

```python
from flask import Blueprint

# 和主应用一样实例化蓝图，区别只在于对象是Blueprint
users = Blueprint('users', __name__)

# 定义路由
@users.route('/login')
def login():
    return 'Login Page'

@users.route('/logout')
def logout():
    return 'Logout Page'
```

随后，我们需要在主Flask应用中对蓝图进行注册：

```python
from flask import Flask
from module import users

app = Flask(__name__)
# 注册蓝图，并设置前缀
app.register_blueprint(users, url_prefix='/users')
```

当我们注册蓝图后，就可以在`/users/login`端口进行访问。这就是`url_prefix`的作用。它的好处就是让应用后加模块化。

## 实际场景

以下是一个场景：

首先我们实例化蓝图对象，并设置对应的路由：

```python
from flask import Blueprint
from libs.external_api import ExternalApi

bp = Blueprint('web', __name__, url_prefix='/api')
api = ExternalApi(bp)
```

这里的`ExternalApi`是我们定义的对象，它继承自`flask_restful`的`Api`对象，并覆写了`handle_error`方法以处理报错信息。

我们会在这个`api`中不断添加资源，代码类似于`api.add_resource(CompletionApi, '/chat/completions')`。

随后我们在主应用中注册蓝图：

```python
def register_blueprints(app):
    from controllers.web import bp as web_bp
    app.register_blueprint(web_bp)
    
def create_app():
    app = Flask(__name__)

    app.config.from_object(Config())
    logging.basicConfig(level=app.config.get('LOG_LEVEL', 'INFO'))

    register_blueprints(app)
    return app
```

整体的顺序如下：

- 初始化API示例，也就是`api = Api(bp)`
- 注册蓝图至Flask应用，即`app.register_blueprint(bp)`
- 创建API实例后，向实例添加资源。

2024/6/1 于苏州
