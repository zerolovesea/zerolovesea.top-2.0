---
title: 推荐系统：从FM到FFM
date: 2024-08-10 22:09:54
tags:
  - 推荐系统
  - FM
  - FFM
  - 机器学习
categories: 推荐系统
excerpt: FM和FFM的原理及实现。
index_img: "/img/rec.png"
---

# 从MF到FM

前面讲过了MF模型，它基于用户ID和物品ID的共现矩阵进行矩阵分解，用隐向量来表示物品和用户，并通过内积的形式计算得到预估评分。它比协同过滤的优势在于泛化能力，使用嵌入能够表达一些训练集不存在的特例，但是损失了一定的记忆能力。

MF是协同过滤的一大改进，然而它无法将一些物品及用户的信息作为特征。为了解决这个问题，逻辑回归以其可解释性和易于工业计算的优点，在工业推荐算法中非常流行。

逻辑回归的优点在于特征可解释性非常强，能够通过权重直观的反应特征重要性，然而实际应用中需要进行人工特征组合，这一过程非常耗时耗力。这里的特征组合通常是特征交叉，也就是特征两两之间进行计算。

由于推荐系统天生拥有的稀疏性问题，本就稀疏的特征在进行交叉之后，维度大幅提高的同时，稀疏性也大大提高，由于很难出现两个特征同时出现的情况，要求极大的数据量才能让模型收敛。

这个问题似乎有些似曾相识，在FM模型中，我们也提到它解决了共现矩阵的稀疏问题。现在，为了解决特征的稀疏问题，我们同样能够将他们变为低维稠密向量，这时它们之间两两交互就不会有太多0出现了。

# FM

## FM的公式

FM的公式是对逻辑回归的改进，在原本一次项的基础上增加了二次项，即特征之间的两两内积。类别特征被OneHot之后，转换为了$k$维向量。

FM 模型的基本形式是：

$\hat{y}(x) = w_0 + \sum_{i=1}^{n} w_i x_i + \sum_{i=1}^{n} \sum_{j=i+1}^{n} \langle \mathbf{v}_i, \mathbf{v}_j \rangle x_i x_j$

其中：

- $\hat{y}(x)$ 表示对目标变量的预测值。
- $w_0$是全局偏置（全局截距）。
- $w_i$是特征 $x_i$的权重。
- $x_i$ 和 $x_j$是输入特征。
- $\mathbf{v}_i$和 $\mathbf{v}_j$是对应于特征$x_i$和 $x_j$ 的嵌入隐向量。
- $\langle \mathbf{v}_i, \mathbf{v}_j \rangle $表示$\mathbf{v}$ 和$\mathbf{v}_j$的内积，计算特征$x_i$和 $x_j$之间的交互作用。

原公式的计算复杂度是$n^2 k$，内积部分进一步展开后可以进一步降低到$nk$，FM 模型的预测公式可以写成：

$\hat{y}(x) = w_0 + \sum_{i=1}^{n} w_i x_i + \sum_{i=1}^{n} \sum_{j=i+1}^{n} \left( \sum_{f=1}^{k} v_{i,f} \cdot v_{j,f} \right) x_i x_j$

FM 可以高效地捕捉特征之间的二阶交互作用，并通过隐向量 $\mathbf{v}_i$和$\mathbf{v}_j$对这些交互进行建模。

由于计算复杂度和空间复杂度的权衡，FM通常使用二阶特征交叉。

## FM和MF的关系

从本质上来看，MF是FM的一个特例。MF可以被认作是只有用户ID和物品ID的FM模型。

从公式来看，MF的公式：

$r= \mathbf{p}_u \cdot \mathbf{q}_i^T$

​        $ = \sum_{f=1}^{k} p_{u,f} \cdot q_{i,f}$

和FM的公式：

$\hat{y}(x) = w_0 + \sum_{i=1}^{n} w_i x_i + \sum_{i=1}^{n} \sum_{j=i+1}^{n} \langle \mathbf{v}_i, \mathbf{v}_j \rangle x_i x_j$

在 MF 模型中，只有两个特征：用户和物品。在 FM 模型中，如果忽略一阶项，只选择用户特征$u$和物品特征$i$进行二阶交互项，仅考虑用户和物品的交互项，即 $\langle \mathbf{v}_u, \mathbf{v}_i \rangle$，其中$x_u$和$x_i$是用户和物品的特征值，由于我们只关注用户和物品的交互，因此将它们设置为1。

此时，FM 公式中的二阶交互项可以简化为：$\hat{y}(x) = \langle \mathbf{v}_u, \mathbf{v}_i \rangle x_u x_j$。

在MF中，我们同样只关注用户和物品的交互项，因此将 $x_u$和$x_i$都设置为1。此时公式变为：$\hat{y}(x) = \langle \mathbf{v}_u, \mathbf{v}_i \rangle$。

这实际上与 MF 中的 $\mathbf{p}_u \cdot \mathbf{q}_i^T$的内积是等价的。

## 代码实现

使用numpy实现FM模型，首先需要初始化几个关键参数：特征数和隐向量维度以生成隐向量矩阵，全局偏置和一次项权重。偏置和权重可以随机初始化。

在预测时，只需要将全局截距与一次项和二次项求和即可。一次项部分是输入特征向量和一次项权重的点积。二次项在经过展开后，变换为以下形式：

$\frac{1}{2} \sum_{f=1}^{k} \left( \left( \sum_{i=1}^{n} v_{i,f} x_i \right)^2 - \sum_{i=1}^{n} v_{i,f}^2 x_i^2 \right)$

在训练过程中根据均方误差，手动计算梯度并进行更新。

```python
import numpy as np

class FM:
    def __init__(self, n_features, k=5):
        """
        初始化FM模型
        :param n_features: 特征数量
        :param k: 隐向量的维度
        """
        self.n_features = n_features
        self.k = k
        self.w0 = 0  # 全局偏置
        self.w = np.zeros(n_features)  # 一次项权重
        self.V = np.random.normal(scale=0.1, size=(n_features, k))  # 隐向量矩阵

    def predict(self, X):
        """
        预测函数
        :param X: 输入样本矩阵，形状为 (m_samples, n_features)
        :return: 预测值
        """
        linear_terms = np.dot(X, self.w)  # 线性部分
        interactions = np.sum(np.dot(X, self.V)**2 - np.dot(X**2, self.V**2), axis=1) / 2
        return self.w0 + linear_terms + interactions

    def fit(self, X, y, epochs=10, lr=0.01):
        """
        训练FM模型
        :param X: 输入样本矩阵，形状为 (m_samples, n_features)
        :param y: 标签
        :param epochs: 训练轮数
        :param lr: 学习率
        """
        m_samples = X.shape[0]
        for epoch in range(epochs):
            for i in range(m_samples):
                xi = X[i]
                yi = y[i]
                y_pred = self.predict(xi.reshape(1, -1))
                error = yi - y_pred

                # 更新参数
                self.w0 += lr * error
                self.w += lr * error * xi
                for f in range(self.k):
                    self.V[:, f] += lr * error * (
                        xi * np.dot(xi, self.V[:, f]) - self.V[:, f] * xi**2
                    )

            # 输出当前轮次的误差
            y_preds = self.predict(X)
            mse = np.mean((y - y_preds)**2)
            print(f"Epoch {epoch+1}, MSE: {mse}")

if __name__ == "__main__":
    # 预测集，行为用户，列为OneHot特征
    X = np.array([
        [1, 0, 1],
        [1, 1, 0],
        [0, 1, 1],
        [1, 1, 1]
    ])

    y = np.array([1, 2, 3, 4])  # 目标值

    # 初始化并训练FM模型
    fm = FM(n_features=X.shape[1], k=2)
    fm.fit(X, y, epochs=20, lr=0.01)

    # 预测
    predictions = fm.predict(X)
    print("Predictions:", predictions)
```

也可以用pytorch实现更方便一点：

```python
import torch
import torch.nn as nn
import torch.optim as optim

class FactorizationMachine(nn.Module):
    def __init__(self, n_features, k):
        """
        初始化FM模型
        :param n_features: 特征数量
        :param k: 隐向量的维度
        """
        super(FactorizationMachine, self).__init__()
        self.n_features = n_features
        self.k = k

        # 初始化参数
        self.w0 = nn.Parameter(torch.zeros(1))  # 全局偏置
        self.w = nn.Parameter(torch.zeros(n_features))  # 线性项权重
        self.V = nn.Parameter(torch.randn(n_features, k) * 0.01)  # 隐向量矩阵

    def forward(self, X):
        """
        前向传播
        :param X: 输入样本矩阵，形状为 (m_samples, n_features)
        :return: 预测值
        """
        linear_terms = torch.matmul(X, self.w)  # 线性部分
        interactions = 0.5 * torch.sum(
            torch.pow(torch.matmul(X, self.V), 2) -
            torch.matmul(torch.pow(X, 2), torch.pow(self.V, 2)),
            dim=1
        )
        return self.w0 + linear_terms + interactions

def train_model(model, X, y, epochs=10, lr=0.01):
    """
    训练FM模型
    :param model: FM模型
    :param X: 输入样本矩阵，形状为 (m_samples, n_features)
    :param y: 标签
    :param epochs: 训练轮数
    :param lr: 学习率
    """
    criterion = nn.MSELoss()
    optimizer = optim.SGD(model.parameters(), lr=lr)

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()

        y_pred = model(X)
        loss = criterion(y_pred, y)
        loss.backward()
        optimizer.step()

        print(f"Epoch {epoch+1}/{epochs}, Loss: {loss.item()}")

if __name__ == "__main__":
    X = torch.tensor([
        [1.0, 0.0, 1.0],
        [1.0, 1.0, 0.0],
        [0.0, 1.0, 1.0],
        [1.0, 1.0, 1.0]
    ])

    y = torch.tensor([1.0, 2.0, 3.0, 4.0]) 

    # 初始化并训练FM模型
    fm = FactorizationMachine(n_features=X.shape[1], k=2)
    train_model(fm, X, y, epochs=20, lr=0.01)

    # 预测
    fm.eval()
    with torch.no_grad():
        predictions = fm(X)
    print("Predictions:", predictions.numpy())

```

# FFM

在原版FM的基础上，后续又研究出了FFM（Field-aware Factorization Machines），意味感知域的因子分解机。它引入了域的概念。所谓域的概念就是为每个特征分配了一个特征域，用于指示特征所从属的类别。

例如假如我们有以下特征：

| User     | Movie | Genre          | Price |
| -------- | ----- | -------------- | ----- |
| YangZhou | Alien | Horror, Sci-fi | $9.9  |

其中User，Movie，Genre就是特征域。当我们将特征进行OneHot编码后，每个特征就会被分配一个特征域：

| Field Name | Field Index | Feature Name  | Feature Index |
| ---------- | ----------- | ------------- | ------------- |
| User       | 1           | User=YangZhou | 1             |
| Movie      | 2           | Moive=Alien   | 2             |
| Genre      | 3           | Genre=Horror  | 3             |
| Price      | 4           | Genre=Sci-fi  | 4             |
|            |             | Price         | 5             |

FFM的思想可以用一个例子来解释：假设我们有两个二阶交叉特征，`男性#45岁`，`男性#初中学历`。可以看到这两个交叉特征中都出现了`男性`这个特征，在FM中，这个特征被一个嵌入隐向量所表示，那么在计算内积的时候，`男性#45岁`，`男性#初中学历`中使用的都是同一个代表`男性`的向量。

现在在FFM中，认为`男性#45岁`，`男性#初中学历`这两个交叉特征中，`男性`的含义可能是不一样的，因为在考虑年龄和考虑学历的时候，`男性`特征可能会有不同的意义。因此，FFM中提出需要为每个特征交互时，考虑特征所处的特征域。

拿我们上面的例子为例，当Movie=Alien和Genre=Horror进行交互时，将采用Movie=Alien对应Genere域的隐向量，而当Movie=Alien和User=YangZhou进行交互时，将采用Movie=Alien对应User域的隐向量。换言之，经过OneHot编码的特征将会为每个特征域单独分配一个向量，这样在两两交互的时候就能够使用更加精确且具有针对性的向量。

2024/8/12 于苏州
