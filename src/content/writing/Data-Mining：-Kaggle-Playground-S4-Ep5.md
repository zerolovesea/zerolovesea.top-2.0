---
title: "Data Mining： Kaggle Playground S4 Ep5"
description: "Kaggle Playground S4 Ep5的相关特征工程。"
pubDate: "2024-06-15 19:38:53"
---

工作之后大概有十个月没碰Kaggle，最近打算重新捡起，因此先从最近的Playground开始慢慢热手。

S4 Ep5的主题是洪水回归预测（Regression with a Flood Prediction Dataset），要求基于一系列特征预测未来是否会发生洪水。

# 数据集展示

训练数据集中包含21个特征，目标变量是`FloodProbability`，一个概率值。评估指标是R2。

打印一下看看：

```python
import pandas as pd
import numpy as np

df_train = pd.read_csv('/kaggle/input/playground-series-s4e5/train.csv')
df_train.head()
```

| id   | MonsoonIntensity | TopographyDrainage | RiverManagement | Deforestation | Urbanization | ClimateChange | DamsQuality | Siltation | AgriculturalPractices | ...  | DrainageSystems | CoastalVulnerability | Landslides | Watersheds | DeterioratingInfrastructure | PopulationScore | WetlandLoss | InadequatePlanning | PoliticalFactors | FloodProbability |       |
| :--- | :--------------- | :----------------- | :-------------- | :------------ | :----------- | :------------ | :---------- | :-------- | :-------------------- | :--- | :-------------- | :------------------- | :--------- | :--------- | :-------------------------- | :-------------- | :---------- | :----------------- | :--------------- | :--------------- | ----- |
| 0    | 0                | 5                  | 8               | 5             | 8            | 6             | 4           | 4         | 3                     | 3    | ...             | 5                    | 3          | 3          | 5                           | 4               | 7           | 5                  | 7                | 3                | 0.445 |
| 1    | 1                | 6                  | 7               | 4             | 4            | 8             | 8           | 3         | 5                     | 4    | ...             | 7                    | 2          | 0          | 3                           | 5               | 3           | 3                  | 4                | 3                | 0.450 |
| 2    | 2                | 6                  | 5               | 6             | 7            | 3             | 7           | 1         | 5                     | 4    | ...             | 7                    | 3          | 7          | 5                           | 6               | 8           | 2                  | 3                | 3                | 0.530 |
| 3    | 3                | 3                  | 4               | 6             | 5            | 4             | 8           | 4         | 7                     | 6    | ...             | 2                    | 4          | 7          | 4                           | 4               | 6           | 5                  | 7                | 5                | 0.535 |
| 4    | 4                | 5                  | 3               | 2             | 6            | 4             | 4           | 3         | 3                     | 3    | ...             | 2                    | 2          | 6          | 6                           | 4               | 1           | 2                  | 3                | 5                | 0.415 |

## 目标分布

初始的特征主要是一些环境/城市化相关的特征，我们观察一下目标变量的分布。

```python
plt.figure(figsize=(6, 2))
plt.hist(train.FloodProbability, bins=np.linspace(0.2825, 0.7275, 90), density=True)
plt.ylabel('density')
plt.xlabel('FloodProbability')
plt.show()
```

![](/_posts/Data-Mining%EF%BC%9A-Kaggle-Playground-S4-Ep5/240615-1.png)

目标变量是一个离散值，然而只有83个Unique values，范围在0.285至0.725。且所有数值都是0.005的倍数。

**目标变量属于泊松分布**

使用单样本 K-S 检验能够检验样本是否来自某一分布。我们使用 `scipy.stats` 包中的 `ks_2samp` 函数来执行 Kolmogorov-Smirnov 检验，并使用 `numpy` 来生成泊松分布随机样本。

```python
target_data = df_train['FloodProbability']

# 计算目标变量的均值作为泊松分布的 lambda
lambda_val = target_data.mean()

# 生成与目标变量相同大小的泊松分布样本
poisson_sample = np.random.poisson(lam=lambda_val, size=len(target_data))

# 进行 K-S 检验
d_statistic, p_value = ks_2samp(target_data, poisson_sample)

# 打印结果
print(f"K-S test: D-statistic = {d_statistic}, p-value = {p_value}")

# 判断是否符合泊松分布
if p_value > 0.05:
    print("无法拒绝零假设，目标变量可能符合泊松分布。")
else:
    print("拒绝零假设，目标变量不符合泊松分布。")
```



## 特征分布

```python
features = df_train.drop('FloodProbability',axis=1).columns
_, axs = plt.subplots(5, 4, figsize=(12, 12))
for col, ax in zip(features, axs.ravel()):
    vc = train[col].value_counts() / len(train)
    ax.bar(vc.index, vc)
    vc = test[col].value_counts() / len(test)
    ax.bar(vc.index, vc, alpha=0.6)
    ax.set_title(col)
    ax.xaxis.set_major_locator(MaxNLocator(integer=True)) # only integer labels
plt.tight_layout()
plt.show()
```

![](/_posts/Data-Mining%EF%BC%9A-Kaggle-Playground-S4-Ep5/240615-2.png)

大部分特征都呈现右偏分布，即长尾出现在右边。此外，所有特征都是离散值。

## 相关性

```python
cc = np.corrcoef(train[corr_features], rowvar=False)
plt.figure(figsize=(11, 11))
sns.heatmap(cc, center=0, annot=True, fmt='.1f',
            xticklabels=corr_features, yticklabels=corr_features)
plt.title('Correlation matrix')
plt.show()
```

![](/_posts/Data-Mining%EF%BC%9A-Kaggle-Playground-S4-Ep5/240615-3.png)

从相关系数上来看，特征之间没有相关性，但所有特征都与目标相关。

## 共线性

```python
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.tools.tools import add_constant

df_train_with_const = add_constant(df_train) 

vif_data = pd.DataFrame()
vif_data["feature"] = df_train_with_const.columns
vif_data["VIF"] = [variance_inflation_factor(df_train_with_const.values, i) for i in range(df_train_with_const.shape[1])]

print(vif_data)
```

```python
                            feature         VIF
0                             const  152.517829
1                                id    1.000011
2                  MonsoonIntensity    1.331574
3                TopographyDrainage    1.348860
4                   RiverManagement    1.343868
5                     Deforestation    1.338782
6                      Urbanization    1.347294
7                     ClimateChange    1.338716
8                       DamsQuality    1.346030
9                         Siltation    1.338225
10            AgriculturalPractices    1.339117
11                    Encroachments    1.346542
12  IneffectiveDisasterPreparedness    1.343053
13                  DrainageSystems    1.340917
14             CoastalVulnerability    1.351291
15                       Landslides    1.343013
16                       Watersheds    1.345418
17      DeterioratingInfrastructure    1.334803
18                  PopulationScore    1.346067
19                      WetlandLoss    1.339142
20               InadequatePlanning    1.340360
21                 PoliticalFactors    1.348455
22                 FloodProbability    6.449539
```

检查一下共线性。通常来说，VIF小于5，都可以认为共线性没有那么大的影响。VIF超过10时就需要处理一下特征。这里大部分特征之间都没有共线性，因此无需处理。

这一点也可以通过PCA分析来进行确认：

```python
pca = PCA()
pca.fit(train[features])
plt.figure(figsize=(3, 2.5))
plt.plot(pca.explained_variance_ratio_.cumsum())
plt.gca().xaxis.set_major_locator(MaxNLocator(integer=True)) # only integer labels
plt.title('Principal Components Analysis')
plt.xlabel('component#')
plt.ylabel('explained variance ratio')
plt.yticks([0, 1])
plt.show()
```

![](/_posts/Data-Mining%EF%BC%9A-Kaggle-Playground-S4-Ep5/240615-4.png)

基本上是一条直线，没有显著的特征能够解释大部分方差。

# 特征工程

一些社区内的特征工程：

```python
def transform(dataframe: pd.DataFrame) -> pd.DataFrame:
    df_copy = dataframe.copy()
    features = df_copy.columns.tolist()

    # 计算所有特征的平均值，并乘以 0.1
    df_copy['mean_features'] = 0.1 * df_copy[features].mean(axis=1)

    # 计算所有特征的标准差
    df_copy['std_features'] = df_copy[features].std(axis=1)

    # 计算所有特征的最大值
    df_copy['max_features'] = df_copy[features].max(axis=1)

    # 计算所有特征的最小值
    df_copy['min_features'] = df_copy[features].min(axis=1)

    # 计算所有特征的中位数，并乘以 0.1
    df_copy['median_features'] = 0.1 * df_copy[features].median(axis=1)

    # 假设 NUMERIC_COLS 是一个包含数值列名的列表
    # 计算数值列的总和
    NUMERIC_COLS = features  # 如果所有列都是数值列
    df_copy['sum_features'] = df_copy[NUMERIC_COLS].sum(axis=1)

    # 排序数值列并创建新列
    sorted_features = [f'sort_{i}' for i in np.arange(len(NUMERIC_COLS))]
    df_copy[sorted_features] = np.sort(df_copy[NUMERIC_COLS], axis=1)

    # 计算四分位数
    df_copy['q1'] = df_copy[features].quantile(0.25, axis=1)
    df_copy['q2'] = df_copy[features].quantile(0.50, axis=1)
    df_copy['q3'] = df_copy[features].quantile(0.75, axis=1)

    # 删除原始特征列
    df_copy = df_copy.drop(features, axis=1)
    
    # 一些特征交叉
    df_copy['ClimateAnthropogenicInteraction'] = (df['MonsoonIntensity'] + df['ClimateChange']) * (df['Deforestation'] + df['Urbanization'] + df['AgriculturalPractices'] + df['Encroachments'])
    df_copy['InfrastructurePreventionInteraction'] = (df['DamsQuality'] + df['DrainageSystems'] + df['DeterioratingInfrastructure']) * (df['RiverManagement'] + df['IneffectiveDisasterPreparedness'] + df['InadequatePlanning'])

    # 计算统计特征
    df_copy['sum'] = df[features].sum(axis=1)
    df_copy['std'] = df[features].std(axis=1)
    df_copy['mean'] = df[features].mean(axis=1)
    df_copy['max'] = df[features].max(axis=1)
    df_copy['min'] = df[features].min(axis=1)
    df_copy['mode'] = df[features].mode(axis=1)[0]  # 注意：mode 返回的是 DataFrame，需要取第一个值
    df_copy['median'] = df[features].median(axis=1)
    df_copy['skew'] = df[features].skew(axis=1)
    df_copy['kurt'] = df[features].kurt(axis=1)
    df_copy['entropy'] = df[num_cols].apply(lambda x: -1*(x*np.log(x)).sum(), axis=1)
    
    return df_copy

```

2024/6/15 于苏州
