---
title: "推荐系统：从MF看SVD"
description: "矩阵分解的介绍和实现，以及奇异值分解的原理。"
pubDate: "2024-08-03 23:30:47"
---

前面提到了协同过滤类模型，基于用户-物体共现矩阵，通过相似度计算为用户推荐物品。它的缺点在于无法利用更多的物品和用户的信息，并且无法将单个物品的信息扩展到其他物品上。

用户对多个物品的打分可能代表了用户本身的一些爱好偏向，而不同物品向量之间本身也存在特征信息。如果只使用协同过滤，就损失了这些信息。为了解决这个问题，矩阵分解算法被提出。

这个算法在06年Netflix Prize Challenge中表现出众，解决了稀疏矩阵的问题。

通过将矩阵分解为$P$矩阵和$Q$矩阵，每一个物品和每一个用户都用一个隐向量表示。

公式如下：$ R \approx P \times Q^T $

矩阵分解的优势在于以下几点：

- 泛化能力强，且隐向量基于全局的共线矩阵拟合，能够使用全局信息
- 空间复杂度低，不用存储大量的稀疏矩阵
- 隐向量的表达能力更强，其实和Embedding的思想是类似的

不过，矩阵分解依旧无法使用到一些其他的特征，例如用户和物品自身的一些特征。隐向量的构建还是基于共现矩阵，而共现矩阵并无法体现一些上下文信息。

# 代码实现

基于pytorch简单实现矩阵分解算法。首先写一个FM的网络。完整的训练过程中，我们需要初始化两个矩阵，让两个矩阵的点积拟合评分矩阵。

我们使用torch的Embedding类实例化两个矩阵。

> - nn.Embedding和nn.Linear的区别在于，前者相当于一个查找表，其中根据每个index，可以获取对应index的嵌入向量。而Linear是用于前向和反向传播的向量。
> - Embedding的作用相当于将n个词转换为m维向量，例如当我们使用`emb = Embedding(num_embeddings=3, embedding_dim=5)`时，相当于我们给三个词生成了5维的向量。
> - 当我们实际在输入一个词时，通过Embedding产生的5维向量才是真正参与模型训练并更新的向量。
> - 参考链接：https://blog.csdn.net/qq_43391414/article/details/120783887
> https://www.zhihu.com/question/436748480

前向传播时，只需要两个矩阵计算内积，并拟合用户-物体共现矩阵。

```python
import torch
import torch.nn as nn
import torch.optim as optim

class MatrixFactorization(nn.Module):
    def __init__(self, num_users, num_items, embedding_size=20):
        super(MatrixFactorization, self).__init__()
        self.user_embeddings = nn.Embedding(num_users, embedding_size)
        self.item_embeddings = nn.Embedding(num_items, embedding_size)

    def forward(self, user_indices, item_indices):
        user_embedding = self.user_embeddings(user_indices)
        item_embedding = self.item_embeddings(item_indices)
        return (user_embedding * item_embedding).sum(1)
```
我们生成一些数据。我们假设有5个用户和5个产品，并且隐向量维度是10维，此外还需要生成一些评分。

user_indices对应的是用户对不同物品的打分。一个用户可以为多个物品进行打分。

```python
num_users = 5  # 5个用户
num_items = 5  # 5个物品
embedding_size = 10  # 隐向量维度10

user_indices = torch.tensor([0, 0, 1, 1, 2, 2, 3, 3, 4, 4])
item_indices = torch.tensor([1, 2, 0, 2, 1, 3, 4, 2, 3, 0])
ratings = torch.tensor([3.0, 4.0, 2.0, 5.0, 3.5, 4.0, 2.0, 3.0, 5.0, 1.5])
```

定义模型，损失函数和优化器：

```python
model = MatrixFactorization(num_users, num_items, embedding_size)

criterion = nn.MSELoss()  
optimizer = optim.SGD(model.parameters(), lr=0.1) 
```

训练模型：

```python
num_epochs = 100
for epoch in range(num_epochs):
    optimizer.zero_grad()
    predictions = model(user_indices, item_indices)
    loss = criterion(predictions, ratings)
    loss.backward()
    optimizer.step()

    if epoch % 10 == 0:
        print(f'Epoch {epoch}: Loss = {loss.item()}')
```

训练完成后，我们假设需要预测用户0对物品1的打分，预测代码如下：

```python
user_id = torch.tensor([0])
item_id = torch.tensor([1])
prediction = model(user_id, item_id)
print(f'Predicted rating for user 0 on item 1: {prediction.item()}')
```

# 特征值分解

可以注意到，虽然名字叫矩阵分解，但是我们在构建模型的时候，实际上并没有使用传统意义的奇异值分解，而是一种经过改良的方法，这种方法由Simon Punk在其博客中公开，通过梯度下降拟合P, Q矩阵，这种方法被称为Latent Factor Model，也称为LFM。

之所以没有使用原版的SVD，其中很大程度上是因为计算量过大，而且共现矩阵过于稀疏。不过我想在矩阵分解这个话题上再更进一步，研究一下奇异值分解。

在此之前，需要了解一下特征值分解。

一个方阵的信息由特征值和特征向量表示。具体定义是$Ax=λx$。

其中 A 是一个$n\times n$的方阵， $x$ 是一个 n 维向量，则 $\lambda$是矩阵 A 的一个特征值，而 $x$  是矩阵 A 的特征值 $\lambda$所对应的特征向量。

**换言之，方阵A可以被转换为$A=Q\lambda Q^{-1}$。其中$\lambda$是对角阵，对角阵上的每个元素都是特征值。特征值的大小说明了对应特征向量的重要性。**

当我们求出了A的n个特征值，我们也拥有了这n个特征值对应的特征向量。

特征值$\lambda$体现的是矩阵被拉伸的强度，这和秩有一点点的关联，秩体现的是矩阵所包含信息的维度。由于特征值代表了在某一个方向上拉伸的方向，当特征值为0时，意味着在某一方向上没有提供信息。

两者的关联是：

- 非零特征值的个数即矩阵的秩。这是因为矩阵的特征值决定了它在特征向量所在方向上的行为，而这些非零特征向量是线性独立的，因此贡献于矩阵的秩。

- 秩提供了关于矩阵如何填充其所在空间的结构信息，而特征值则提供了关于矩阵作用强度和方向的信息。

总结来说，特征值体现的是拉伸属性，秩体现的是矩阵的维度信息。

特征向量$x$通过特征值作为缩放因子进行线性变换后，就会得到最初的方阵。既然只是缩放因子，特征向量的方向是不会变的，变的只是特征向量的数值大小。

特征值分解后得到的两个东西，特征向量代表了特征是什么，而特征值则代表了特征的重要性，也就是拉伸的程度。

# 奇异值分解

参考链接：

[机器学习中的数学(5)-强大的矩阵奇异值分解(SVD)及其应用 - LeftNotEasy - 博客园 (cnblogs.com)](https://www.cnblogs.com/LeftNotEasy/archive/2011/01/19/svd-and-applications.html)

[奇异值的物理意义是什么？ - 知乎 (zhihu.com)](https://www.zhihu.com/question/22237507)

特征值分解对于数理分析非常有用，但是存在局限，即原矩阵必须是方阵，因为一旦不是方阵，就出现了维度的变化，那么特征向量只乘一个标量就无法改变维度变成原矩阵。作为替代，可以使用奇异值分解来分解任意形状的矩阵。对于一个 $m \times n$ 矩阵A，奇异值分解表示为：

$A = U \Sigma V^T$

其中：

- $U$ 是一个$m \times m$的单位正交矩阵，其列向量称为左奇异向量。
- $V$ 是一个$n \times n$的单位正交矩阵，其列向量称为右奇异向量。
- $\Sigma$是一个$m \times n$的对角矩阵，对角线上的元素是$A$的奇异值，且这些值非负且按降序排列。
- $U^TU=I$,$V^TV=I$。

类似的，奇异值也代表着矩阵在特定方向的拉伸程度，也是矩阵$A^TA$或 $A^TA$的特征值的平方根。当方阵$A$对称且正定时，$A^TA$就是一个方阵，它的奇异值是特征值的绝对值。

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-1.png)

知乎上有个对奇异值很好的描述：

> 奇异值分解是一个有着很明显的物理意义的一种方法，它可以将一个比较复杂的矩阵用更小更简单的几个子矩阵的相乘来表示，这些小矩阵描述的是矩阵的重要的特性。
>
> 就像是描述一个人一样，给别人描述说这个人长得浓眉大眼，方脸，络腮胡，而且带个黑框的眼镜，这样寥寥的几个特征，就让别人脑海里面就有一个较为清楚的认识，实际上，人脸上的特征是有着无数种的，之所以能这么描述，是因为人天生就有着非常好的抽取重要特征的能力，让机器学会抽取重要的特征，SVD是一个重要的方法。

代码实现如下：

```python
import numpy as np
import pandas as pd

# 使用ml-100k数据集
df = pd.read_csv('data.txt', sep='\t', header=None)
df.drop(3, inplace=True, axis=1) # 去掉时间戳
df.columns = ['uid', 'iid', 'rating']

df = df.sample(frac=1, random_state=0)
train_set = df.iloc[:int(len(df)*0.75)]
test_set = df.iloc[int(len(df)*0.75):]

n_users = max(df.uid)+1 # uid最小从1开始
n_items = max(df.iid)+1

class Funk_SVD(object):
    def __init__(self, n_epochs, n_users, n_items, n_factors, lr, reg_rate, random_seed=0):
        self.n_epochs = n_epochs
        self.lr = lr
        self.reg_rate = reg_rate
        np.random.seed(random_seed)
        self.pu = np.random.randn(n_users, n_factors) / np.sqrt(n_factors) # 参数初始化不能太大
        self.qi = np.random.randn(n_items, n_factors) / np.sqrt(n_factors)
        
    def predict(self, u, i):
        return np.dot(self.qi[i], self.pu[u])
        
    def fit(self, train_set, verbose=True):
        for epoch in range(self.n_epochs):
            mse = 0
            for index, row in train_set.iterrows():
                u, i, r = row.uid, row.iid, row.rating
                error = r - self.predict(u, i)
                mse += error**2
                tmp = self.pu[u]
                self.pu[u] += self.lr * (error * self.qi[i] - self.reg_rate * self.pu[u])
                self.qi[i] += self.lr * (error * tmp - self.reg_rate * self.qi[i])
            if verbose == True:
                rmse = np.sqrt(mse / len(train_set))
                print('epoch: %d, rmse: %.4f' % (epoch, rmse))
        return self
    
    def test(self, test_set):
        predictions = test_set.apply(lambda x: self.predict(x.uid, x.iid), axis=1)
        rmse = np.sqrt(np.sum((test_set.rating - predictions)**2) / len(test_set))
        return rmse
    
funk_svd = Funk_SVD(n_epochs=20, n_users=n_users, n_items=n_items, n_factors=35, lr=0.005, reg_rate=0.02)
funk_svd.fit(train_set, verbose=True)
funk_svd.test(test_set)
# 0.9872467462373891
funk_svd.predict(120, 282) 
# 测试集中的某一条数据，真实评分为4，预测为3.233268069895416
```

# 基于SVD的改进

前面提到的LFM，是06年的Netflix Prize冠军方案，不过正如之前提到的一些不足，使得后续有很多基于该模型的发展。

## 加入Bias的LFM

原版的LFM公式在开头已经给出，不过我们可以加入偏置项，这是为了平衡一些物品和用户的偏好。公式如下：

$R \approx \mu + b_u + b_i + P \times Q^T$

其中，$\mu$是全局平均评分，$b_u$是用户偏置向量，通常用当前用户打出的所有得分的均分，$b_i$是物品偏置向量，为当前物品收到的所有得分的均分。

这解决的问题是用户的一些属性和物品没有关系，只是自身的独立属性，同样的，物品也存在独立的属性。例如用户可能由于自己的原因，偏向打低分，而一些物品本来的的质量就不佳，因此本身得分就很低。

除此之外，还能够加上L2正则项来防止过拟合。

代码实现如下：

```python
class Bias_SVD(object):
    def __init__(self, n_epochs, n_users, n_items, n_factors, lr, reg_rate, random_seed=0):
        self.n_epochs = n_epochs
        self.lr = lr
        self.reg_rate = reg_rate
        np.random.seed(random_seed)
        self.pu = np.random.randn(n_users, n_factors) / np.sqrt(n_factors)
        self.qi = np.random.randn(n_items, n_factors) / np.sqrt(n_factors)
        self.bu = np.zeros(n_users, np.double)
        self.bi = np.zeros(n_items, np.double)
        self.global_bias = 0
        
    def predict(self, u, i):
        return self.global_bias + self.bu[u] + self.bi[i] + np.dot(self.qi[i], self.pu[u])
        
    def fit(self, train_set, verbose=True):
        self.global_bias = np.mean(train_set.rating)
        for epoch in range(self.n_epochs):
            mse = 0
            for index, row in train_set.iterrows():
                u, i, r = row.uid, row.iid, row.rating
                error = r - self.predict(u, i)
                mse += error**2
                self.bu[u] += self.lr * (error - self.reg_rate * self.bu[u])
                self.bi[i] += self.lr * (error - self.reg_rate * self.bi[i])
                tmp = self.pu[u]
                self.pu[u] += self.lr * (error * self.qi[i] - self.reg_rate * self.pu[u])
                self.qi[i] += self.lr * (error * tmp - self.reg_rate * self.qi[i])
            if verbose == True:
                rmse = np.sqrt(mse / len(train_set))
                print('epoch: %d, rmse: %.4f' % (epoch, rmse))
        return self
    
    def test(self, test_set):
        predictions = test_set.apply(lambda x: self.predict(x.uid, x.iid), axis=1)
        rmse = np.sqrt(np.sum((test_set.rating - predictions)**2) / len(test_set))
        return rmse

bias_svd = Bias_SVD(n_epochs=20, n_users=n_users, n_items=n_items, n_factors=35, lr=0.005, reg_rate=0.02)
bias_svd.fit(train_set, verbose=True)
bias_svd.test(test_set)
# 0.9642304425644652
bias_svd.predict(120, 282) 
# 真实评分为4，预测为3.495711940570076
```

## 加入用户历史行为的SVD++

在前者的基础上，后续又提出SVD++，该模型将用户历史评分的物品加入到LFM模型中。

公式如下：

$m_{ui} = \mu + b_u + b_i + q_i^T \left( p_u + |I_u|^{-1/2} \sum_{j \in I_u} y_j \right)$

和上面的不同在于将原本的物品P矩阵做了扩充，增加了的部分是用户操作过的物品的特性。

代码实现：

```python
class SVDpp(object):
    def __init__(self, n_epochs, n_users, n_items, n_factors, lr, reg_rate, random_seed=0):
        self.n_epochs = n_epochs
        self.lr = lr
        self.reg_rate = reg_rate
        self.n_factors = n_factors
        np.random.seed(random_seed)
        self.pu = np.random.randn(n_users, n_factors) / np.sqrt(n_factors)
        self.qi = np.random.randn(n_items, n_factors) / np.sqrt(n_factors)
        self.yj = np.random.randn(n_items, n_factors) / np.sqrt(n_factors)
        self.bu = np.zeros(n_users, np.double)
        self.bi = np.zeros(n_items, np.double)
        self.global_bias = 0
        self.Iu = dict()
        
    def reg_sum_yj(self, u, i):
        sum_yj = np.zeros(self.n_factors, np.double)
        for j in self.Iu[u]:
            sum_yj += self.yj[j]
        return sum_yj / np.sqrt(len(self.Iu[u]))
        
    def predict(self, u, i, feedback_vec_reg):
        return self.global_bias + self.bu[u] + self.bi[i] + np.dot(self.qi[i], self.pu[u] + feedback_vec_reg)
        
    def fit(self, train_set, verbose=True):
        self.global_bias = np.mean(train_set.rating)
        # 将用户打过分的记录到Iu字典中，key为uid，value为打过分的iid的list
        g = train_set.groupby(['uid'])
        for uid, df_uid in g:
            self.Iu[uid] = list(df_uid.iid)
        
        for epoch in range(self.n_epochs):
            square_err = 0
            for index, row in train_set.iterrows():
                u, i, r = row.uid, row.iid, row.rating
                feedback_vec_reg = self.reg_sum_yj(u, i)
                error = r - self.predict(u, i, feedback_vec_reg)
                square_err += error**2
                self.bu[u] += self.lr * (error - self.reg_rate * self.bu[u])
                self.bi[i] += self.lr * (error - self.reg_rate * self.bi[i])
                tmp_pu = self.pu[u]
                tmp_qi = self.qi[i]
                self.pu[u] += self.lr * (error * self.qi[i] - self.reg_rate * self.pu[u])
                self.qi[i] += self.lr * (error * (tmp_pu + feedback_vec_reg) - self.reg_rate * self.qi[i])
                for j in self.Iu[u]:
                    self.yj[j] += self.lr * (error / np.sqrt(len(self.Iu[u])) * tmp_qi - self.reg_rate * self.yj[j])
            if verbose == True:
                rmse = np.sqrt(square_err / len(train_set))
                print('epoch: %d, rmse: %.4f' % (epoch, rmse))
        return self
    
    def test(self, test_set):
        predictions = test_set.apply(lambda x: self.predict(x.uid, x.iid, self.reg_sum_yj(x.uid, x.iid)), axis=1)
        rmse = np.sqrt(np.sum((test_set.rating - predictions)**2) / len(test_set))
        return rmse

svdpp = SVDpp(n_epochs=20, n_users=n_users, n_items=n_items, n_factors=35, lr=0.005, reg_rate=0.02)
svdpp.fit(train_set, verbose=True)
svdpp.test(test_set)
# 0.9510302683304096
svdpp.predict(120, 282, svdpp.reg_sum_yj(120, 282)) 
# 真实评分为4，预测为3.5370712737668204
```

## 加入时序信息的timeSVD++

通过引入时间信息，原本的共现矩阵现在变为了三维矩阵。对它进行分解后，增加了一项用于计算用户兴趣随时间影响的效应。

# SVD在其他领域的应用

## 潜在语义索引LSA

LSA用于获取潜在的语义信息，这和矩阵分解有点类似。以下例子来源于以下链接：[机器学习中的数学(5)-强大的矩阵奇异值分解(SVD)及其应用 - LeftNotEasy - 博客园 (cnblogs.com)](https://www.cnblogs.com/LeftNotEasy/archive/2011/01/19/svd-and-applications.html)

假设我们有多个文章标题和索引的单词，我们想知道这些标题的特征性质以及单词的特征性质。

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-2.png)

我们对这个矩阵进行SVD，会得到以下三个矩阵：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-3.png)

其中， 左奇异向量表示词的一些特性，右奇异向量表示文档的一些特性，中间的奇异值矩阵表示左奇异向量的一行与右奇异向量的一列的重要程序，也是拉伸的程度。

从这里就能看出它和矩阵分解的思路是一样的，只不过MF采用了另一种方法实现。

在吴军老师的数据之美中这样解释：

> “三个矩阵有非常清楚的物理含义。
>
> 第一个矩阵X中的每一行表示意思相关的一类词，其中的每个非零元素表示这类词中每个词的重要性（或者说相关性），数值越大越相关。
>
> 最后一个矩阵Y中的每一列表示同一主题一类文章，其中每个元素表示这类文章中每篇文章的相关性。
>
> 中间的矩阵则表示类词和文章之间的相关性。因此，我们只要对关联矩阵A进行一次奇异值分解，我们就可以同时完成了近义词分类和文章的分类。（同时得到每类文章和每类词的相关性）。”

## SVD用于图像压缩

SVD同样用于图像领域，由于图像本身就是矩阵，通过SVD后，能找到对于原图更重要的特征，去除不重要的特征，已达到图像压缩的效果。

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-7.png)

同样摘抄来自知乎的一个例子：

原图如下：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-4.png)

原图视为矩阵$A$，奇异值分解后将矩阵分解为多个秩一矩阵之和。其实就是将特征单独剥离出来。拆解后得到：

$A = \sigma_1 u_1 v_1^T + \sigma_2 u_2 v_2^T + \ldots + \sigma_r u_r v_r^T$

可以理解为，将SVD分解后，中间的那个对角矩阵$\lambda$每个奇异值拆出来，作为对应奇异向量的乘积。所有的乘积之和组成了这张完整的照片。我们将其按照奇异值大小排序，并保留前5项，这时的图片就变成了：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-5.jpg)

当保留20项时，图片变为了：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-6.jpg)

原图是一个$450×333的矩阵，需要保存$450×333=149850$个元素的值。而如果我们只保留奇异值分解后的前50项，那存储量仅为原图的26%。

同样的，这也可以用在图像去噪上，我们将一些较小的奇异值认为是噪音，将它们变为0，这时图像就达到了降噪的效果。

记录一下示例代码，使用numpy就能进行SVD分解：

```python
import numpy as np
import cv2
 
img = cv2.imread('harden.jpg')
print('origin image shape is ', img.shape)
# 表示 RGB 中各有一个矩阵，都为300*532
#  origin image shape is  (300, 532, 3)
 
 
def svd_compression(img, k):
    res_image = np.zeros_like(img)
    for i in range(img.shape[2]):
        # 进行奇异值分解, 从svd函数中得到的奇异值sigma 是从大到小排列的
        U, Sigma, VT = np.linalg.svd(img[:,:,i])
        res_image[:, :, i] = U[:,:k].dot(np.diag(Sigma[:k])).dot(VT[:k,:])
 
    return res_image
 
 
# 保留前 k 个奇异值
res1 = svd_compression(img, k=300)
res2 = svd_compression(img, k=200)
res3 = svd_compression(img, k=100)
res4 = svd_compression(img, k=50)
 
row11 = np.hstack((res1, res2))
row22 = np.hstack((res3, res4))
res = np.vstack((row11, row22))
 
cv2.imshow('img', res)
cv2.waitKey(0)
cv2.destroyAllWindows()
```

分别提取了前300， 200， 100， 50 的奇异值，结果图如下：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9A%E4%BB%8EMF%E7%9C%8BSVD/240804-8.png)

可以看到，当我们取到前面300个奇异值来重构图片时，基本与原图看不出来差别。



2024/8/4 于苏州