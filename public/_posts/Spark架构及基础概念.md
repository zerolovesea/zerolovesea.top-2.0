---
title: Spark架构及基础概念
date: 2024-06-23 17:08:25
tags:
  - Spark
  - Big Data
categories: Big Data
excerpt: 复习Spark的基本架构以及各个组件的介绍。
index_img: "/img/spark.jpeg"
---

毕业之后就再也没接触过Spark，印象里它的使用方法比较繁琐，所以基本忘光了。刚好工作中可能会接触到相关内容，因此借着休息这几天的空闲时间，复习一下相关内容。

# Spark

Spark 是一个通用数据处理引擎，用来进行数据处理任务，例如批处理、流处理、机器学习和图计算。

Spark和Hive的区别在于，Hive用于在离线数据的处理上，Spark 用于需要实时计算和处理的任务上。

> Hadoop和Spark的一个关键区别： Hadoop基于大数据的批处理。 这意味着数据会在一段时间内存储，然后使用Hadoop进行处理。 在Spark中，处理可以实时进行。
> 

Spark主要包含的组件是：

- Spark Core：基础通用执行引擎，其所有其他功能都是基于该平台执行的。
- Spark SQL：Spark Core之上的一个组件，它引入了一种名为SchemaRDD的新数据抽象，提供对结构化和半结构化数据的支持。
- Spark Streaming：利用Spark Core的快速调度功能来执行流式分析。它以小批量采集数据，并对这些小批量数据执行RDD（弹性分布式数据集）转换。
- MLlib：Spark上的分布式机器学习框架。
- GraphX：Spark上的分布式图形处理框架。

# Spark架构

以下是Spark的架构图：

![](https://static001.geekbang.org/infoq/6a/6a017f614dd45c2434cdeb2ef203e07d.png)

Spark的主要组件包括：

- Spark Driver：即运行Application的main函数并创建SparkContext，创建SparkContext的目的是为了准备Spark应用程序的运行环境。在Spark中由SparkContext负责与Cluster Manager通信，进行资源申请、任务的分配和监控等，当Executor部分运行完毕后，Driver同时负责将SparkContext关闭。
- Cluster Manager：控制整个集群，负责监控Worker。
- Worker：集群中任何一个物理节点，可以在上面启动Executor进程。
- Spark Executors：在每个Worker上为某应用启动的一个进程，该进程负责运行Task，并且负责将数据存在内存或者磁盘上，每个任务都有各自独立的Executor。
- Task：被发送到Executor上的工作单元。每个Task负责计算一个分区的数据。

## RDD

RDD是Spark中最重要的概念，被称为弹性分布式数据集。这是一个分布式的数据集合，弹性且分布式。它允许在执行多个查询时将工作集缓存在内存中，后续的查询能够重用工作集，这样就能极大的提升查询速度。之所以需要RDD，是因为这个结构能够加速MapReduce这一过程。

RDD是一个抽象的概念，能够通过几种方式创建：

1. 从数据源读取
2. 将已有的集合并行化为RDD
3. 将已有的RDD通过转换（Transformations）生成新的RDD。

RDD支持两个操作：

1. 转换（Transformations）：从现有的RDD创建新的RDD，例如map, filter, join等。
2. 行动（Actions）：用于触发计算，并返回结果到Driver或存储到外部存储系统，例如collect，count，reduce等。

> 我的理解是，RDD是Spark中最底层的数据结构，也就是任何操作，都应该是对RDD进行处理，因此在任何操作之前都应包含RDD的初始化。

以下是一段简单的示例代码，用pyspark实现：

```python
from pyspark import SparkContext

# 创建 SparkContext，local指Spark运行在本地模式，后者指定应用程序的名称
sc = SparkContext("local", "RDD Example")

# 从本地集合创建 RDD
data = [1, 2, 3, 4, 5]
rdd = sc.parallelize(data)

# 转换操作：将每个元素乘以 2
rdd2 = rdd.map(lambda x: x * 2)

# 行动操作：收集结果
result = rdd2.collect()

# 输出结果
print(result)
```

上面这段代码，首先创建了Context，用来启动Spark应用程序。

随后创建了一个RDD，并使用map方法对这个RDD进行了转换操作。

最后使用一个行动操作，用collect获取最后的结果。

# Spark运行流程

1. 为应用构建起基本的运行环境，由Driver创建一个SparkContext进行资源的申请、任务的分配和监控。
2. 资源管理器为Executor分配资源，并启动Executor进程。
3. SparkContext根据RDD的依赖关系构建DAG图，DAG图提交给DAGScheduler解析成Stage，然后把一个个TaskSet提交给底层调度器TaskScheduler处理。
4. Executor向SparkContext申请Task，TaskScheduler将Task发放给Executor运行并提供应用程序代码。
5. Task在Executor上运行把执行结果反馈给TaskScheduler，然后反馈给DAGScheduler，运行完毕后写入数据并释放所有资源。

2024/6/25 于苏州
