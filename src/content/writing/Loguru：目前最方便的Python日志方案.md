---
title: "Loguru：目前最方便的Python日志方案"
description: "Loguru的使用教程。"
pubDate: "2024-01-03 19:46:39"
---

最近在做公司的Machine Learning和Knowledge Graph的项目，这之中都需要日志模块。之前写的时候用的是基于python自带的logging模块的自定义类，相信很多python开发者都了解过。

logging库本身用起来倒也不是很难，就是需要单独实例化`StreamHandler`和`FileHandler`才可以同时生成持久化日志和流式日志，还是有点复杂。对于想~~偷懒~~保持代码简洁的我，还是需要一个更方便的解决方案。

刚好有一天刷知乎看到有人推荐了Loguru，看了一下确实很符合代码简洁的需求。网上对这个库的评价都是“优雅”，“简单”。Github页面甚至用了“Python logging made (stupidly) simple”来形容它的易用性。

# Loguru

Loguru中包含了一个logger类，可以直接调用。之后所有的日志处理都基于这个实例化的logger类。

```python
from loguru import logger
```

由于logger本身已经实例化，可以把它像print一样调用，日志信息会直接显示在控制台：

```python
logger.debug('this is a debug message')
logger.info('this is info message')
logger.warning('this is warning message')
logger.error('this is error message')
logger.info('this is info message')
logger.success('this is success message!')
logger.critical('this is critical message!')
```

# 持久化

如果需要把它持久化在本地，也可以使用logger的add方法，添加到日志文件中。这时在调用logger时，就会同步在日志文件中更新日志。

```python
import os

log_dir = '/logfile'
logfile_dir = os.path.join(log_dir,'model_evl.log')

if not os.path.exists(log_dir):
    os.mkdir(log_dir)

logger.add(logfile_dir)
logger.debug('this is a debug message')
logger.info('this is info message')
logger.warning('this is warning message')
```

# 基础配置

logger的基础配置如下

```python
from loguru import logger

logger.add(
    sink='./logs/train.log',  
    level='INFO',
    rotation='00:00', # '5 seconds' 也可以是Int，当Int时代表日志的容量限制。      
    retention='7 days',  # '4 weeks'/'1 minutes':删除超过4星期/1分钟的日志 3: 仅保留三个最新文件
    compression='zip',        
    encoding='utf-8',  
    backtrace=True, # 设置为True时会将报错信息完整记录在日志
    enqueue=True,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
)
```

以下是参数的解释：

- `sink`:  创建日志文件的路径。
- `level`: 记录日志的等级，低于这个等级的日志不会被记录。等级顺序为 debug < info < warning < error。设置 INFO 会让 logger.debug 的输出信息不被写入磁盘。这个和logging库是一样的。
- `rotation`: 轮换策略，此处代表每天凌晨创建新的日志文件进行日志 IO；也可以通过设置 "2 MB" 来指定 日志文件达到 2 MB 时进行轮换。
- `retention`: 只保留 7 天。
- `compression`: 日志文件较大时会采用 zip 进行压缩。
- `encoding`: 日志的编码方式。
- `format`: 定义日志字符串的样式。
- `filter`：用于过滤记录。 
- `colorize`: 采用布尔值并确定是否应启用终端着色。 
- `serialize`：如果设置为 True，日志记录会保存成 JSON。 
- `backtrace`：确定异常跟踪是否应该延伸到捕获错误的点之外，以便于调试。 诊断：确定变量值是否应显示在异常跟踪中。您应该在生产环境中将其设置为 False 以避免泄露敏感信息。 
- `diagnose`: 确定变量值是否应在异常跟踪中显示。在生产环境中应将其设置为 False，以避免泄露敏感信息。
- `enqueue`：启用此选项会将日志记录放入队列中，以避免多个进程记录到同一目的地时发生冲突。 
- `catch`：如果在记录到指定的接收器时发生意外错误，您可以通过将此选项设置为 True 来捕获该错误。错误将打印到标准错误。

这样看也比较清晰：

```python
logger.add("test.log", rotation="10 MB")     # 文件大于10M会重新生成一个文件
logger.add("test.log", rotation="00:00")     # 每天0点创建新文件
logger.add("test.log", rotation="1 week")    # 每过一周就会创建新文件
logger.add("test.log", retention="5 days")   # 只保留最近五天的日志文件
logger.add("test.log", compression="zip")    # 以zip格式对日志进行保存
logger.add('log-{time}.log', encoding="utf-8")  #会给日志文件名自动增加时间信息以区分，比如log-2021-03-15_23-36-51_241786.log，encoding参数设置保存为UTF-8编码
```

# 过滤日志

可以使用filter来过滤日志。例如我们可以创建一个函数：

```python
import sys
from loguru import logger

def level_filter(level):
    def is_level(record):
        return record["level"].name == level
    return is_level

logger.remove(0)
logger.add("./logs/app.log", filter=level_filter(level="WARNING"))
```

在`filter`中添加过滤函数，可以限制最终日志文件的信息。当然也可以用lambda函数：`filter=lambda record: record["level"].name == "CRITICAL"`。

# 使用装饰器捕捉异常

loguru提供了一个装饰器来捕捉函数的异常报错。

```python
from loguru import logger

@logger.catch()
def test():
    return 1/0
```

这时运行以下代码，日志文件会捕捉报错信息：

```python
logger.add("test.log", retention="5 days")
test()
```

不过使用装饰器会导致函数无法并行运行，这时就需要在函数面前单独加上一个`logger.add('log/running_logs.log')`才能让它正常记录日志。


2024/1/3 于苏州家中

