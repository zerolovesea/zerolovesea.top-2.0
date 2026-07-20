---
title: "数据库应用：WSL-HIVE的部署"
description: "如何在WSL中部署Apache Hive。"
pubDate: "2024-06-09 09:46:22"
---

最近开始重新捡起一些数据库相关的知识，以前学习的内容差不多忘完了，这次刚好算作温习一下。这篇博文记录如何在WSL中部署Apache Hive。

# Map-Reduce

要了解Hive，首先要了解Hadoop。要了解Hadoop，就需要先了解Map-Reduce。

Map-Reduce来源于谷歌公司发表于2004的一篇论文。它要解决的是传统数据库中无法解决的大数据量的场景。在过去，传统的关系型数据库中，数据都保存在单机上，随着数据量的增大，只能通过扩展单机配置来扩容。为了解决这个问题，就需要一个分布式框架，让多个主机能分开处理任务，这就是Map-Reduce产生的契机。

Map-Reduce是一个框架，它的工作流程包含两步：Map，Reduce。用户通过编写并行处理的程序，在每台节点上执行，来处理大量的数据。大体上来说，Map过程将数据分割为键值对，随后进行排序及分组，最后由Reduce进行合并，并输出最后的结果。

{% note warning %}
MapReduce 优点
简化编程模型：开发者只需关注 Map 和 Reduce 函数的实现，并行化和分布式处理由框架处理。
扩展性：可以轻松扩展到数千台计算机，处理 PB 级别的数据。
容错性：框架自动处理任务失败和节点故障，确保任务顺利完成。
{% endnote %}

{% note sucess %}
MapReduce 缺点
实时性差：需要进行多次磁盘 I/O 操作，MapReduce 适合批处理，不适合实时数据处理。
效率较低：对于某些计算密集型任务的性能不行。
{% endnote %}

{% mermaid %}
graph TD
  A[输入分割] --> B[Map任务 1]
  A[输入分割] --> C[Map任务 2]
  A[输入分割] --> D[Map任务 n]

  B[Map任务 1] --> E[中间键值对]
  C[Map任务 2] --> E[中间键值对]
  D[Map任务 n] --> E[中间键值对]

  E[中间键值对] --> F[Shuffle 和 Sort]
  F[Shuffle 和 Sort] --> G[Reduce任务 1]
  F[Shuffle 和 Sort] --> H[Reduce任务 2]
  F[Shuffle 和 Sort] --> I[Reduce任务 n]

  G[Reduce任务 1] --> J[最终输出]
  H[Reduce任务 2] --> J[最终输出]
  I[Reduce任务 n] --> J[最终输出]
{% endmermaid %}

以下是一个更具体的流程图：

![](/_posts/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BA%94%E7%94%A8%EF%BC%9AWSL-HIVE%E7%9A%84%E9%83%A8%E7%BD%B2/240609-1.png)

# Hadoop

Hadoop是一个用Java编写的开源框架，旨在实现分布式数据处理。它的组件包括了以下：

- Hadoop HDFS：Hadoop 分布式存储系统。
- Yarn：Hadoop 2.x版本开始才有的资源管理系统。
- MapReduce：并行处理框架。

## Hadoop的部署

我在Windows的Linux子系统Ubuntu部署Hadoop，由于Hadoop基于Java实现，因此第一步是安装Java。

### Java安装

在Ubuntu中安装Java相对简单，这里采用了Java8进行实现：

```bash
sudo apt update
sudo apt install openjdk-8-jdk -y
```

下载完成后，设置Java 8 为默认的版本

```bash
sudo update-alternatives --config java
```

上述指令能获取到Java的安装路径。获取路径是为了修改环境变量，我们使用`vim ~/.bashrc`来修改一下配置，加入以下内容：

```bash
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

完成后需要使更改生效：

```bash
source ~/.bashrc
```

使用`java -version`来检查是否正确安装。

### Hadoop安装

我部署的版本是hadoop 3.3.4，首先需要从Apache Hadoop官方网站下载Hadoop的二进制文件。从以下url获取到`tar`包：[Apache Download Mirrors](https://www.apache.org/dyn/closer.cgi/hadoop/common/hadoop-3.4.0/hadoop-3.4.0.tar.gz)。也可以通过：

```bash
wget https://dlcdn.apache.org/hadoop/common/hadoop-3.4.0/hadoop-3.4.0.tar.gz
```

使用`tar -xzvf hadoop-3.3.4.tar.gz`解压，并移动到一个指定的路径，这里我们放在`usr/local/hadoop`路径。

```bash
tar -xzvf hadoop-3.3.4.tar.gz
sudo mv hadoop-3.3.4 /usr/local/hadoop 
```

同样的需要配置一下环境变量，使用`vim ~/.bashrc`进行修改并增加以下内容：

```bash
# Hadoop Environment Variables
export HADOOP_HOME=/usr/local/hadoop
export HADOOP_INSTALL=$HADOOP_HOME
export HADOOP_MAPRED_HOME=$HADOOP_HOME
export HADOOP_COMMON_HOME=$HADOOP_HOME
export HADOOP_HDFS_HOME=$HADOOP_HOME
export YARN_HOME=$HADOOP_HOME
export HADOOP_COMMON_LIB_NATIVE_DIR=$HADOOP_HOME/lib/native
export PATH=$PATH:$HADOOP_HOME/sbin:$HADOOP_HOME/bin
export HADOOP_OPTS="-Djava.library.path=$HADOOP_HOME/lib/native"
```

使用`source ~/.bashrc`来应用更改。

### Hadoop配置

安装完hadoop后还需要配置一下，需要到`$HADOOP_HOME/etc/hadoop`目录进行修改：

**hadoop-env.sh**

需要替换Java环境变量，这里我的路径是`/usr/lib/jvm/java-8-openjdk-amd64`：

```bash
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
```

**core-site.xml**

默认是空的，需要加上以下内容：

```bash
<configuration>
   <property>
      <name>fs.defaultFS</name>
      <value>hdfs://localhost:9000</value>
   </property>
</configuration>
```

**hdfs-site.xml**

用来配置HDFS，因此需要加上配置信息：

```bash
<configuration>
    <property>
        <name>dfs.replication</name>
        <value>1</value>
    </property>

    <property>
        <name>dfs.namenode.name.dir</name>
        <value>file:///home/zerolovesea/hadoopinfra/hdfs/namenode</value>
    </property>

    <property>
        <name>dfs.datanode.data.dir</name>
        <value>file:///home/zerolovesea/hadoopinfra/hdfs/datanode</value>
    </property>
</configuration>
```

> 具体的配置项解释如下：
>
> - dfs.replication：定义了HDFS中每个文件块的复制因子。值为`1`意味着每个文件块只有一个副本。
> - dfs.namenode.name.dir：指定了NameNode存储其元数据的本地文件系统路径。元数据包括文件系统的目录结构和文件块的信息。
> - dfs.datanode.data.dir：指定了DataNode存储实际数据块的本地文件系统路径。

**yarn-site.xml**

YARN的配置文件，加入以下内容：

```bash
<configuration>
   <property> 
      <name>yarn.nodemanager.aux-services</name> 
      <value>mapreduce_shuffle</value> 
   </property>
</configuration>
```

**mapred-site.xml**

用于指定使用的MapReduce框架，加入以下内容：

```bash
<configuration>
   <property> 
      <name>mapreduce.framework.name</name> 
      <value>yarn</value> 
   </property>
</configuration>
```

### 验证安装

上述配置完成后就可以直接执行了。执行以下内容：

```bash 
hdfs namenode -format 

start-dfs.sh
start-yarn.sh
```

这样就能够依次启动Hadoop文件系统和Yarn脚本。`hdfs namenode -format `用来初始化`namenode`，只需要第一次执行就可以了。

至此Hadoop安装完毕，我们可以通过访问转发后的端口`http://localhost:转发端口/`来直接访问到Hadoop的服务。

![](/_posts/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BA%94%E7%94%A8%EF%BC%9AWSL-HIVE%E7%9A%84%E9%83%A8%E7%BD%B2/240609-2.png)

# Hive

Hive和Hadoop的关系可能让有些人不太理解，前者实际上是基于后者的一个衍生工具。由于Hadoop由Java编写，当用户需要实现具体功能的时候，需要使用Java来编写MapReduce任务。也就是需要分开写多个Java代码来实现Map和Reduce的功能，这让一些只懂SQL的用户增加了学习成本。

为了解决这个问题，才出现了Hive，它用来将SQL转换为MapReduce任务，以帮助用户更快的实现需求。

Hive的主要组件包括：

- MetaStore: 存储Hive表的元数据。
- HiveQL: 类似于SQL的查询语言。
- 执行引擎: 将HiveQL转换为MapReduce任务，执行数据处理。

## Hive的部署

### Hive安装

我们选择Hive 3.1.3来安装，在选取版本时，需要注意一定要和安装的Hadoop版本相匹配，不然会出现很多问题。首先下载`tar`包，通过[Index of /hive (apache.org)](https://dlcdn.apache.org/hive/)或：

```bash
wget https://dlcdn.apache.org/hive/hive-3.1.3/apache-hive-3.1.3-bin.tar.gz
```

随后解压并移动到需要的路径，例如：

```bash
tar -xzvf apache-hive-3.1.3-bin.tar.gz
sudo mv apache-hive-3.1.3-bin /usr/local/hive
```

同时在`bashrc`中修改环境变量：

```bash
# Hive Environment Variables
export HIVE_HOME=/usr/local/hive
export PATH=$PATH:$HIVE_HOME/bin
```

使用`source ~/.bashrc`使更改生效。

### Hive配置

Hive的配置文件位于`$HIVE_HOME/conf`目录下。

我们需要先执行`cp hive-env.sh.template hive-env.sh`，并在其中添加Hadoop的路径：

```bash
export HADOOP_HOME=/usr/local/hadoop
```

随后，需要创建并修改路径下的`hive-site.xml`，这是Hive的主要配置文件：

**hive-site.xml**

默认是没有这个文件的，因此需要创建并添加以下内容：

```bash
<configuration>
   <property>
      <name>javax.jdo.option.ConnectionURL</name>
      <value>jdbc:mysql://localhost:3306/metastore_db?createDatabaseIfNotExist=true</value>
      <description>JDBC connect string for a JDBC metastore</description>
   </property>
   <property>
      <name>javax.jdo.option.ConnectionDriverName</name>
      <value>com.mysql.cj.jdbc.Driver</value>
      <description>Driver class name for a JDBC metastore</description>
   </property>
   <property>
      <name>javax.jdo.option.ConnectionUserName</name>
      <value>zerolovesea</value>
      <description>username to use against metastore database</description>
   </property>
   <property>
      <name>javax.jdo.option.ConnectionPassword</name>
      <value>zy26yang</value>
      <description>password to use against metastore database</description>
   </property>
   <property>
      <name>datanucleus.autoCreateSchema</name>
      <value>true</value>
      <description>Auto create the JDO tables needed by the metastore</description>
   </property>
      <property>
      <name>hive.server2.enable.doAs</name>
      <value>true</value>
   </property>
   <property>
      <name>hive.server2.authentication</name>
      <value>NONE</value>
   </property>
```

其中有一些是需要自定义的内容，例如：

```bash
<property>
  <name>javax.jdo.option.ConnectionUserName</name>
  <value>zerolovesea</value>
  <description>username to use against metastore database</description>
</property>

<property>
  <name>javax.jdo.option.ConnectionPassword</name>
  <value>zy26yang</value>
  <description>password to use against metastore database</description>
</property>
```

这两段分别用来配置连接数据库时的用户名和密码。

```bash
<property>
  <name>javax.jdo.option.ConnectionURL</name>
  <value>jdbc:mysql://localhost:3306/metastore_db?createDatabaseIfNotExist=true</value>
  <description>JDBC connect string for a JDBC metastore</description>
</property>
<property>
  <name>javax.jdo.option.ConnectionDriverName</name>
  <value>com.mysql.cj.jdbc.Driver</value>
  <description>Driver class name for a JDBC metastore</description>
</property>
```

这段用于配置MySQL的连接，会在后面解释。

### Hive元数据存储设置

Hive需要一个元数据存储来保存表和数据库信息。这里我们使用MySQL作为元数据存储。

首先需要安装MySQL:

```bash
sudo apt update
sudo apt install mysql-server -y
```

随后登录MySQL并创建数据库以及用户：

```bash
sudo mysql -u root -p
```

进入MySQL后，执行以下命令以创建用户名和密码：

```bash
CREATE DATABASE metastore_db;
CREATE USER 'zerolovesea'@'localhost' IDENTIFIED BY 'zy26yang';
GRANT ALL PRIVILEGES ON metastore_db.* TO 'zerolovesea'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

这里的用户名和密码就对应前面Hive配置的内容。

### 初始化Hive元数据

Hive提供了一个脚本来初始化元数据表。需要下载MySQL JDBC驱动并将其复制到Hive库目录：

```bash
wget https://dev.mysql.com/get/Downloads/Connector-J/mysql-connector-java-8.0.29.tar.gz
tar -xzvf mysql-connector-java-8.0.29.tar.gz
sudo cp mysql-connector-java-8.0.29/mysql-connector-java-8.0.29.jar /usr/local/hive/lib/
```

随后执行以下命令来初始化元数据：

```bash
schematool -initSchema -dbType mysql
```

最后启动Hive：

```bash
hive
```

![](/_posts/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BA%94%E7%94%A8%EF%BC%9AWSL-HIVE%E7%9A%84%E9%83%A8%E7%BD%B2/240609-3.png)

至此大功告成，我们可以创建一个表，插入数据来验证安装是否成功：

```sql
CREATE TABLE test (id INT, name STRING);
LOAD DATA LOCAL INPATH '/usr/local/hive/examples/files/kv1.txt' INTO TABLE test;
SELECT * FROM test;
```

我们可以通过`SHOW TABLES;`来查看当前数据库中的所有表：

![](/_posts/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BA%94%E7%94%A8%EF%BC%9AWSL-HIVE%E7%9A%84%E9%83%A8%E7%BD%B2/240609-4.png)

也可以查看其中的内容：

```sql
USE database_name;
SHOW TABLES;
```

![](/_posts/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BA%94%E7%94%A8%EF%BC%9AWSL-HIVE%E7%9A%84%E9%83%A8%E7%BD%B2/240609-5.png)

# 使用DBeaver连接Hive

使用命令行连数据库还是比较麻烦，因此考虑使用DBeaver来连接Hive。要实现它，首先需要让WSL和Windows进行通信。我们在WSL中输出`hostname -I`来获取WSL的IP地址。

随后在WSL启动HiveServer2：

```bash
hiveserver2
```

这时就可以在DBeaver中配置新连接了。在创建新连接中选择Apache Hive，随后连接参数里填上主机，端口，数据库，用户名和密码，就可以连接到WSL的Hive了。

![](/_posts/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BA%94%E7%94%A8%EF%BC%9AWSL-HIVE%E7%9A%84%E9%83%A8%E7%BD%B2/240609-6.png)

# 停止服务

如果需要停止服务，需要执行以下内容：

#### 停止Hadoop服务

```bash
# 停止YARN
stop-yarn.sh

# 停止HDFS
stop-dfs.sh
```

#### 停止Hive服务

```bash
# 停止Hive Metastore
# 如果是以后台方式启动的，需要找到其进程并杀掉
# 举例：
# ps -ef | grep HiveMetaStore
# kill <process_id>

# 停止HiveServer2
# 如果是以后台方式启动的，需要找到其进程并杀掉
# 举例：
# ps -ef | grep HiveServer2
# kill <process_id>
```

#### 关闭WSL

在停止所有服务之后，就可以安全地关闭WSL：

```bash
wsl --shutdown
```

这样可以确保Hadoop和Hive服务被优雅地停止，避免数据损坏或任务中断。

### 重新启动Hadoop和Hive服务

下次启动WSL时，需要重新启动Hadoop和Hive服务：

```bash
# 启动HDFS
start-dfs.sh

# 启动YARN
start-yarn.sh

# 启动Hive
# 如果需要HiveServer2或Metastore，也需要分别启动
```

2024/6/9 于苏州
