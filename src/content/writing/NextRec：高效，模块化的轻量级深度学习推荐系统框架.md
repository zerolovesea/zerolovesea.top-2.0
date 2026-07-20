---
title: "NextRec：高效，模块化的轻量级深度学习推荐系统框架"
description: "介绍一下最近自己写的推荐算法框架。"
pubDate: "2025-11-30 12:18:41"
---

[[toc]]

最近两个月都没有更新博客，是因为在写一个推荐算法框架，现在这个项目已经上线github了，收获了一些好评，因此写一篇介绍性质的文章，来介绍这个框架。

以下是正文。

---

2014年以后，随着深度学习的发展，推荐系统也在高速发展：从最早的CF/MF类模型，到LR模型，再到深度模型大一统。在这过程里，模型不断复杂化：Embedding，Transformer，MoE，对比学习，多任务学习，生成式召回各种概念迅速被提出。每一篇论文的发布，都可能多出一个新的思路或架构。

但问题也随之而来：

- 模型越来越多，「样板代码」膨胀
- 不同论文模型结构相似，却无法复用
- 特征表达层、模型层、推理 pipeline 缺乏统一封装
- 学术代码难以落地业务，工业代码不够灵活

逐渐有了一些开源项目框架尝试解决这些问题：例如[DeepCTR](https://github.com/shenweichen/DeepCTR)，[FuxiCTR](https://github.com/reczoo/FuxiCTR)，[EasyRec](https://github.com/alibaba/EasyRec)，[torch-rechub](https://github.com/datawhalechina/torch-rechub)。出于不同的出发点和设计理念，这些框架的侧重点各不相同，有的框架侧重快速实验和复现，有的专门为工业场景开发。

面对数据实时性需求不强的场景时，通常的工作流是通过spark集群拉取离线特征的parquet/csv，在本地训练后进行T+1日期维度的推理。这个场景下，上述的一些框架可能有些太轻，一些框架又有点太重。NextRec正是在这样的背景下诞生的，本文带你全面认识它的设计理念、模型体系、工程亮点和使用体验。

## NextRec项目架构

推荐模型就像“搭积木”，Embedding → MLP → Attention → Experts → Towers，这些模块几乎所有主流模型都涵盖。但在论文实现上，各个模型的代码里特征声明方式五花八门；不同模型间难以组合复用。

NextRec 的思路是**统一 FeatureSpec → EmbeddingLayer → Backbone → Tower → Serving 流程**，让所有模型像拼模块一样组合。此外，模型拆成独立模块，架构与训练目标解耦，模型只负责描述自己的架构。

NextRec 不只是研究框架，也包含了完整的训练流程（callback、metrics、session 管理），流式推理（支持 path-based inference）和模型存储/加载一致化。下面这个流程图简单描述了NextRec的设计架构。

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/nextrec_diagram_zh.png)

## 快速使用NextRec训练一个 DIN 模型

开发者可以通过`pip install nextrec`快速安装NextRec的最新版本，环境要求为Python 3.10+，截止2025年11月30日，NextRec的最新版本为0.3.1。

我们在NextRec的官方[github仓库](https://github.com/zerolovesea/NextRec)里提供了详细的上手指南和配套数据集，帮助您熟悉框架的不同功能。在`datasets/`路径下提供了一个来自电商场景的脱敏数据集子集，数据示例如下：

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/test%20data.png)

接下来我们将用一个简短的示例，展示如何使用NextRec训练一个DIN模型。DIN(Deep Interest Network)来自于阿里妈妈2018年KDD最佳论文模型，用于CTR预估场景。你也可以直接执行`python tutorials/example_ranking_din.py`来执行训练推理代码。

开始训练以后，你可以在`nextrec_logs/din_tutorial`路径下查看详细的训练日志。

```python
import pandas as pd
from nextrec.models.ranking.din import DIN
from nextrec.basic.features import DenseFeature, SparseFeature, SequenceFeature

df = pd.read_csv('dataset/ranking_task.csv')

for col in df.columns and 'sequence' in col: # csv默认将列表读取成文本，我们需要将其转化为对象
    df[col] = df[col].apply(lambda x: eval(x) if isinstance(x, str) else x)

# 我们需要将不同特征进行定义
dense_features = [DenseFeature(name=f'dense_{i}', input_dim=1) for i in range(8)]

sparse_features = [SparseFeature(name='user_id', embedding_name='user_emb', vocab_size=int(df['user_id'].max() + 1), embedding_dim=32), SparseFeature(name='item_id', embedding_name='item_emb', vocab_size=int(df['item_id'].max() + 1), embedding_dim=32),]

sparse_features.extend([SparseFeature(name=f'sparse_{i}', embedding_name=f'sparse_{i}_emb', vocab_size=int(df[f'sparse_{i}'].max() + 1), embedding_dim=32) for i in range(10)])

sequence_features = [
    SequenceFeature(name='sequence_0', vocab_size=int(df['sequence_0'].apply(lambda x: max(x)).max() + 1), embedding_dim=32, padding_idx=0, embedding_name='item_emb'),
    SequenceFeature(name='sequence_1', vocab_size=int(df['sequence_1'].apply(lambda x: max(x)).max() + 1), embedding_dim=16, padding_idx=0, embedding_name='sparse_0_emb'),]

mlp_params = {
    "dims": [256, 128, 64],
    "activation": "relu",
    "dropout": 0.3,
}

model = DIN(
    dense_features=dense_features,
    sparse_features=sparse_features,
    sequence_features=sequence_features,
    mlp_params=mlp_params,
    attention_hidden_units=[80, 40],
    attention_activation='sigmoid',
    attention_use_softmax=True,
    target=['label'],                                     # 目标变量
    device='mps',                                         
    embedding_l1_reg=1e-6,
    embedding_l2_reg=1e-5,
    dense_l1_reg=1e-5,
    dense_l2_reg=1e-4,
    session_id="din_tutorial",                            # 实验id，用于存放训练日志
)

# 编译模型，设置优化器和损失函数
model.compile(
            optimizer = "adam",
            optimizer_params = {"lr": 1e-3, "weight_decay": 1e-5},
            loss = "focal",
            loss_params={"gamma": 2.0, "alpha": 0.25},
        )

model.fit(
    train_data=df,
    metrics=['auc', 'gauc', 'logloss'],  # 添加需要查看的指标
    epochs=3,
    batch_size=512,
    shuffle=True,
    user_id_column='user_id'             # 用于计算GAUC的id列 
)

# 训练完成后进行指标评估
metrics = model.evaluate(
    df,
    metrics=['auc', 'gauc', 'logloss'],
    batch_size=512,
    user_id_column='user_id'
)

# 也可以直接推理新数据集，输入支持dict，dataframe，pathlike
predictions = model.predict(df, batch_size=512)
```

NextRec拥有统一的日志管理，在训练开始前，NextRec会为你输出以下信息：分别是特征配置Feature Configuration，用于记录特征的维度等信息；模型参数Model Parameters，用于记录模型的架构，和参数量统计；训练参数Training Configuration，用于记录本次训练的超参数等配置项。

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Feature%20Configuration.png)

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Model%20Parameters.png)

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Training%20Configuration.png)

开始训练后，则会根据配置的指标，输出每个epoch的评估指标。训练过程中，训练日志会在nextrec_logs/session_id路径下生成，并且同步保存特征信息，模型checkpoint等相关文件。

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Training%20logs.png)

------

## 使用教程

我们在NextRec的官方仓库下提供了详细的上手文档，其中在[`tutorials/`](https://github.com/zerolovesea/NextRec/tree/main/tutorials) 目录下，我们提供了多个示例，覆盖排序、召回、多任务、数据处理等场景：

- [movielen_ranking_deepfm.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/movielen_ranking_deepfm.py) - movielen 100k数据集上的 DeepFM 模型训练示例
- [example_ranking_din.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/example_ranking_din.py) - 电商数据集上的DIN 深度兴趣网络训练示例
- [example_multitask.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/example_multitask.py) - 电商数据集上的ESMM多任务学习训练示例
- [movielen_match_dssm.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/example_match_dssm.py) - 基于movielen 100k数据集训练的 DSSM 召回模型示例

如果想了解更多NextRec框架的细节，我们还提供了Jupyter notebook来帮助你了解：

- [如何上手NextRec框架](https://github.com/zerolovesea/NextRec/blob/main//tutorials/notebooks/zh/Hands%20on%20nextrec.ipynb)
- [如何使用数据处理器进行数据预处理](https://github.com/zerolovesea/NextRec/blob/main//tutorials/notebooks/zh/Hands%20on%20dataprocessor.ipynb)

> 当前版本[0.3.1]，召回模型模块尚不完善，可能存在一些兼容性问题或意外报错，如果遇到问题，欢迎开发者在[Issue区](https://github.com/zerolovesea/NextRec/issues)提出问题。

## 写在最后

最后，感谢正在看这篇文章的你关注到NextRec，无论你是推荐算法工程师，对推荐算法感兴趣的学生，还是相关从业者，都是recommender社区的重要一员。

NextRec是一个尚在成长期的框架，作为开发者，还缺少很多相关的开发经验，因此，我们欢迎任何形式的贡献，包括代码提交，提出issue等等，期待和大家一起在这个领域学习和成长！

2025/11/30 于苏州

