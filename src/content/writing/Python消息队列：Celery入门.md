---
title: "Python消息队列：Celery上手"
description: "Python中的消息队列系统Celery上手。"
pubDate: "2024-05-25 21:53:53"
---

上一篇博文里，实现了一个异步任务的场景：调用web服务之后立刻返回结果，后台则继续执行这个任务。这是我工作中的一个真实需求，当我费劲巴拉把这个功能写完之后，我才了解到有一个现成的工具能够实现这个功能，这就是今天要学习的Celery。

> Celery是一个简单，灵活、可靠的分布式任务执行框架，可以支持大量任务的并发执行。Celery采用典型生产者和消费者模型。生产者提交任务到任务队列，众多消费者从任务队列中取任务执行。
> 

生产者和消费者模型是一种设计模式，在这种设计模式中，生产者和消费者分别是任务的发布者和任务的获取者，他们没有直接的关联，之间的交流通过中间人(Broker，也称为消息队列)完成。

在这个过程中，生产者像悬赏榜上的贴告示人一样，将任务发布在消息队列中，任务在任务队列中依次执行后，将结果发送给消费者。在生产环境中，任务队列通常用Redis或RabbitMQ实现。

![](/_posts/Python%E6%B6%88%E6%81%AF%E9%98%9F%E5%88%97%EF%BC%9ACelery%E5%85%A5%E9%97%A8/240525-1.png)

# 实际场景

Celery的实际场景在日常生活中经常出现：

例如Web应用中，当用户触发了一个需要长时间执行的操作时（高计算/高IO等会造成阻塞的任务），可以把它作为任务交给Celery去异步执行，执行完再返回给用户。这段时间用户不需要等待。

对于用户来说，他点击了执行按钮后，得到了一个任务ID，而程序在后台执行，用户只需要等一段时间，通过任务ID拿到任务的执行结果。

还有一个场景是定时任务：例如需要定时向一些地址发布邮件。

> 上手代码之前，我发现了大坑，在我的Windows机器上运行Celery程序时，始终报错`[ValueError: not enough values to unpack]`，起初我以为是代码逻辑的问题，最终发现是Celery的最新版暂时不支持Windows，可以使用WSL或者`celery -A my_project_name worker --pool=solo -l info`执行。后者的话就意味着单线程执行代码。

# 最简单的案例

首先是一个最简单的案例：我们有个计算的程序，负责将输入的两个数字相加，得到结果。为了模拟高计算量的程序，我们在计算时加上sleep2秒。

现在，我们想让用户在执行该程序时，程序不会因为sleep的两秒而阻塞，而是会在后台执行。这个过程我们放在队列里。要完成这一点，我们要实现以下几个内容：

1. 我们需要实现本地的一个消息代理Broker，例如Redis
2. 我们需要实现一个生产者程序，负责生成任务并发送到消息代理。
3. 需要实现一个消费者程序，负责从消息队列中接收任务并执行它们。

在这个过程中，生产者不负责执行程序，只负责发布任务。

以下是代码的实现：

---

首先我们用Docker在本地的6379端口启动redis服务，此处不赘述。

消费者程序，我们命名为`tasks.py`。


```python
import time
from celery import Celery
 
broker = 'redis://127.0.0.1:6379'
backend = 'redis://127.0.0.1:6379/0'
 
app = Celery('my_task', broker=broker, backend=backend)
 
@app.task
def add(x, y):
    time.sleep(2)     # 模拟耗时操作
    return x + y
```

消费者程序里定义了消息代理和结果后端，两个都是用`redis`实现的。顾名思义，一个用来连接消息队列，一个用来存储结果。

首先创建了一个Celery实例，名为`my_task`。`@app.task`是一个装饰器，将被装饰的函数注册为Celery任务。这样这个函数就能被异步调用了。

生产者程序，命名为`client.py`，负责发布任务。

```python
from tasks import add
 
# 异步任务
add.delay(2, 8)
print('hello world')
```

生产者中，首先导入了来源于消费者的`add`函数。`add`函数经过了`@app.task`的包装，变成了一个`Celery`任务。这时候我们就可以通过`delay`方法来异步执行它，并传入两个参数2，8。

当执行异步任务的时候，程序不会干等两秒返回结果，而是马上执行下面的`print('hello world')`。而`add`的结果会在后台计算并返回。

如何执行他们呢？首先需要在命令行执行：

```python
celery -A tasks worker --pool=solo -l info
```

这是启动了一个Celery工作进程来监听队列，并执行任务。`-A`代表应用的模块名来自于`tasks.py`，`worker`表示要启动工作进程，`loglevel`则表示日志级别。

启动后能看到成功连接的日志：

![](/_posts/Python%E6%B6%88%E6%81%AF%E9%98%9F%E5%88%97%EF%BC%9ACelery%E5%85%A5%E9%97%A8/240525-2.png)

这时我们在另一个命令行执行`python client.py`。命令行会马上返回`hello world`。此时程序会在后台执行，可以在Celery进程的后台看到接收和执行的结果。

![](/_posts/Python%E6%B6%88%E6%81%AF%E9%98%9F%E5%88%97%EF%BC%9ACelery%E5%85%A5%E9%97%A8/240525-3.png)

这样就实现了一个最简单的用例。

## app.task装饰器

`@app.task`是一个装饰器，用于将程序包装成Celery的实例，其中有几个需要注意的点。

- 如果程序本身有多个装饰器，那么`app.task`必须在最后一个，也就是最上面的那个装饰器。
- `app.task`包含了一个参数`bind`，意为绑定方法。如果需要访问当前任务请求的信息，或者添加到自定义的任务基类，就需要设置为True。例如：

```python
@app.task(bind=True)
def add(self, x, y):
    print(self.request.id)
```

此时程序的第一个参数必须是任务实例，不然拿不到任务id。

- `app.task`装饰器支持为每个任务都设置一个名称，再未设置的情况下，默认为`任务模块.任务名称`。例如：

```python
@app.task(name='tasks.add') # 不显式设置的话也为task.add
def add(x, y): 
    return x + y
```

- `app.task`装饰器支持`retry`，这意味着当报错的时候，可以使用实例的`retry`方法，例如：

```python
@app.task(bind=True)
def send_twitter_status(self, oauth, tweet):
    try:
        twitter = Twitter(oauth)
        twitter.update_status(tweet)
    except (Twitter.FailWhaleError, Twitter.LoginError) as exc:
        raise self.retry(exc=exc)
```

或者一种更方便的方法：

```python
@app.task(autoretry_for=(FailWhaleError,),
          retry_kwargs={'max_retries': 5})
def refresh_timeline(user):
    return twitter.refresh_timeline(user)
```



## Delay方法

Cellery提供的`delay`方法是异步执行的一个接口，它是另外一个接口`apply_async`的封装。执行后它们会返回一个`AsyncResult`的实例，这个实例用来跟踪任务的状态，backend就是用来存储这个的。

## 结果的获取

我们可以在上面的代码里直接获取结果以及任务相关的信息。如下：

```python
from tasks import add
 
# 异步任务
res = add.delay(2, 8)
print('hello world')

res.get(timeout=1) # 10，如果出现报错会将调用栈返回
res.id # 获取任务id
res.get(propagate=False) # 10，但是不返回报错信息
res.state # 任务状态，包含PENDING/STARTED/SUCCESS/FAILURE等
```

我们在这里直接获取结果，实际上有点像顺序执行。如果我们拿到了任务id，需要有另外一个服务去查看任务状态要怎么做呢？

```python
from tasks import app # 先导入Celery实例

res = app.AsyncResult('given-task-id') # 这时候就可以和上面一样获取任务结果了
```

# 构建链

和Langchain一样，Celery也支持链式调用。例如如果需要在一个任务返回后调用另外一个任务。这时就涉及到签名。所谓签名，就是将一个任务的执行选项和参数进行打包，例如：

```python
add.signature((2, 2), countdown=10) # 为add任务增加了2，2的参数，和倒计时10秒的执行选项

add.s(2, 2) # 简写
```

对于上面这个签名，也可以直接执行：

```python
s1 = add.s(2, 2)
res = s1.delay()
res.get()
```

如果使用链的话是这样的：

```python
from celery import chain
from tasks import add, multiply

# (4 + 4) * 8
chain(add.s(4,4) | multiply.s(8))().get()
```

# 路由

Celery支持路由，也就是根据名称将结果发到不同队列：

```python
app.conf.update(
    task_routes = {
        'tasks.add': {'queue': 'add_queue'},
    },
)
```

在执行时，在`apply_async`方法中加入`queue`参数：

```python
from tasks import add
add.apply_async((2, 2), queue='add_queue')
```

并在执行时使用`-Q`来选择队列：

```bash
celery -A tasks worker -Q add_queue
```

## 读取配置文件

在上面的程序中，Broker和Backend的配置写在程序中，但是也可以写成配置文件，用`app`的`config_from_object`方法来加载配置。注意配置文件需要和启动文件放在同一路径下。例如：

在项目路径下创建`celery_config.py`，内容为：

```python
from datetime import timedelta
from celery.schedules import crontab

broker_url = 'redis://127.0.0.1:6379'               # 指定 Broker
result_backend = 'redis://127.0.0.1:6379/0'  # 指定 Backend
broker_connection_retry_on_startup = True

imports = (                                  # 指定导入的任务模块
    'tasks',
)
```

相应的，`tasks.py`也要修改一下，修改后内容如下：

```python
import time
from celery import Celery
 
app = Celery('demo') # Celery实例的名称
app.config_from_object('celery_config')
 
@app.task
def add(x, y):
    time.sleep(2)     # 模拟耗时操作
    return x + y
```

原先定义地址和app都写在`task.py`中，现在只要在`task.py`中直接加载配置文件就可以了。

2024/5/26 于苏州
