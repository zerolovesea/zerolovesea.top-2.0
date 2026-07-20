---
title: Pyspark上手使用
date: 2024-06-25 16:05:42
tags:
  - Spark
  - Big Data
  - 机器学习
categories: Big Data
excerpt: 使用Spark的高级封装API：Pyspark的一些上手复习。
index_img: "/img/spark.jpeg"
---

前面复习了一下Spark一些的架构内容，这次复习一下上手Pyspark做一些数据处理。

上手之前看了一下文档，发现在Spark2.0之后，RDD的概念被Dataset取代了，Dataset也是一个分布式数据集，只不过做了一些底层的优化。

# 简单Demo

首先上手一个简单的Pyspark的Demo，对数据进行一些处理。

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import *

spark = SparkSession.builder.appName("CSV Loader").getOrCreate()
df = spark.read.csv("train.csv", header=True, inferSchema=True)

line_id_0 = df.filter(df.id==0)

# 需要show才能看到
line_id_0.show()

# 计算AveRooms字段的单词数，并显示
# select用于选择，size用于计算长度，split用于分割
df.select(size(split(df.AveRooms, " ")).alias("num_words")).show()

# 缓存
log_data = df.cache()
log_data.count()

log_data.select("id","AveRooms").show(5)

# 选择AveRooms列，并将其转换为一个列表
nums = log_data.select("AveRooms").rdd.flatMap(lambda x: x).collect()
print(nums)
```

# 流程解析

分析一下上面的流程：

- 首先需要实例化一个SparkSession对象，这是Spark所有功能的入口。例如：
	- `spark = SparkSession.builder.appName("CSV Loader").getOrCreate()`。
- 随后，需要从一个数据源创建Spark中的DataFrame。例如：
	- `df = spark.read.csv("train.csv", header=True, inferSchema=True)`。
	- `df = spark.read.json("examples/src/main/resources/people.json")`。
- 在获取到DataFrame之后，能够进行一些基础的操作，例如查看Schema，展示数据，groupBy等操作。例如：
  - `df.printSchema()`
  - `df.select("name").show()`
  - `df.select(df['name'], df['age'] + 1).show()`
  - `df.filter(df['age'] > 21).show()`
  - `df.groupBy("age").count().show()`
- 此外，能够直接执行一些SQL语句。例如：
	- `sqlDF = spark.sql("SELECT * FROM people")` 
- 为了加速读取数据，能够对一些需要长期执行的数据进行缓存，这种方式能够将内存更合理的利用，例如：
	- `log_data = df.cache()` 

> Pyspark涵盖了多个接口，建议直接查看源码。路径是`examples/src/main/python`
> 

2024/6/26 于苏州