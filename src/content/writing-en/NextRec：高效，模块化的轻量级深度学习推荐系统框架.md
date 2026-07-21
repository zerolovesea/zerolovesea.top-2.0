---
title: "NextRec: an efficient, modular, lightweight deep-learning recommendation framework"
description: "an introduction to the recommendation framework i have been building."
pubDate: "2025-11-30 12:18:41"
---

[[toc]]

I have not updated this blog for the past two months because I have been building a recommendation framework. The project is now on GitHub and has received some encouraging feedback, so I wanted to write an introductory post about it.

The article begins below.

---

Since 2014, recommendation systems have developed rapidly alongside deep learning: from early CF/MF models, through logistic regression, to the broad adoption of deep models. Models have become steadily more complex. Embeddings, Transformers, MoE, contrastive learning, multi-task learning, and generative retrieval have all emerged in quick succession; each new paper may introduce another idea or architecture.

That growth brings problems too:

- More models mean more boilerplate.
- Similar architectures from different papers cannot be reused easily.
- Feature representation, model layers, and inference pipelines lack a unified abstraction.
- Academic code is difficult to productionize, while industrial code is often inflexible.

Several open-source frameworks have attempted to address these issues, including [DeepCTR](https://github.com/shenweichen/DeepCTR), [FuxiCTR](https://github.com/reczoo/FuxiCTR), [EasyRec](https://github.com/alibaba/EasyRec), and [torch-rechub](https://github.com/datawhalechina/torch-rechub). Their goals and design philosophies differ: some focus on rapid experimentation and reproduction, while others target industrial use.

For scenarios without strict real-time data requirements, a common workflow is to pull offline Parquet or CSV features from a Spark cluster, train locally, then run inference on a T+1 basis. In this setting, some of the frameworks above can feel too lightweight, while others can feel too heavy. NextRec was created for that gap. This article introduces its design principles, model system, engineering highlights, and developer experience.

## NextRec architecture

Recommendation models are like building blocks: Embedding → MLP → Attention → Experts → Towers. Nearly every mainstream model uses some combination of these modules. Yet paper implementations declare features in wildly different ways, making models difficult to combine and reuse.

NextRec standardizes the **FeatureSpec → EmbeddingLayer → Backbone → Tower → Serving flow**, allowing models to be assembled from modules. It also separates models into independent modules and decouples architecture from training objectives: a model only needs to describe its own architecture.

NextRec is not only a research framework. It includes a complete training workflow—callbacks, metrics, and session management—streaming inference with path-based inference, and consistent model saving and loading. The diagram below gives a high-level view of the design.

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/nextrec_diagram_zh.png)

## Training a DIN model with NextRec

Install the latest version with `pip install nextrec`. NextRec requires Python 3.10 or later; as of November 30, 2025, the latest release is 0.3.1.

The official [GitHub repository](https://github.com/zerolovesea/NextRec) provides a detailed getting-started guide and accompanying datasets. The `datasets/` directory contains a desensitized subset of an e-commerce dataset, illustrated below.

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/test%20data.png)

The short example below trains a DIN model. DIN (Deep Interest Network) was introduced in Alibaba's 2018 KDD Best Paper for CTR prediction. You can also run the complete training-and-inference example directly with `python tutorials/example_ranking_din.py`.

After training starts, detailed logs are available under `nextrec_logs/din_tutorial`.

```python
import pandas as pd
from nextrec.models.ranking.din import DIN
from nextrec.basic.features import DenseFeature, SparseFeature, SequenceFeature

df = pd.read_csv('dataset/ranking_task.csv')

for col in df.columns and 'sequence' in col: # csv defaults to strings for lists; convert them back to objects
    df[col] = df[col].apply(lambda x: eval(x) if isinstance(x, str) else x)

dense_features = [DenseFeature(name=f'dense_{i}', input_dim=1) for i in range(8)]

sparse_features = [SparseFeature(name='user_id', embedding_name='user_emb', vocab_size=int(df['user_id'].max() + 1), embedding_dim=32), SparseFeature(name='item_id', embedding_name='item_emb', vocab_size=int(df['item_id'].max() + 1), embedding_dim=32),]

sparse_features.extend([SparseFeature(name=f'sparse_{i}', embedding_name=f'sparse_{i}_emb', vocab_size=int(df[f'sparse_{i}'].max() + 1), embedding_dim=32) for i in range(10)])

sequence_features = [
    SequenceFeature(name='sequence_0', vocab_size=int(df['sequence_0'].apply(lambda x: max(x)).max() + 1), embedding_dim=32, padding_idx=0, embedding_name='item_emb'),
    SequenceFeature(name='sequence_1', vocab_size=int(df['sequence_1'].apply(lambda x: max(x)).max() + 1), embedding_dim=16, padding_idx=0, embedding_name='sparse_0_emb'),]

mlp_params = {"dims": [256, 128, 64], "activation": "relu", "dropout": 0.3}

model = DIN(
    dense_features=dense_features, sparse_features=sparse_features,
    sequence_features=sequence_features, mlp_params=mlp_params,
    attention_hidden_units=[80, 40], attention_activation='sigmoid',
    attention_use_softmax=True, target=['label'], device='mps',
    embedding_l1_reg=1e-6, embedding_l2_reg=1e-5,
    dense_l1_reg=1e-5, dense_l2_reg=1e-4,
    session_id="din_tutorial",
)

model.compile(
    optimizer="adam", optimizer_params={"lr": 1e-3, "weight_decay": 1e-5},
    loss="focal", loss_params={"gamma": 2.0, "alpha": 0.25},
)

model.fit(train_data=df, metrics=['auc', 'gauc', 'logloss'], epochs=3,
          batch_size=512, shuffle=True, user_id_column='user_id')

metrics = model.evaluate(df, metrics=['auc', 'gauc', 'logloss'],
                         batch_size=512, user_id_column='user_id')
predictions = model.predict(df, batch_size=512)
```

NextRec provides unified log management. Before training, it prints Feature Configuration (feature dimensions and related information), Model Parameters (the architecture and parameter count), and Training Configuration (hyperparameters and other run settings).

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Feature%20Configuration.png)

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Model%20Parameters.png)

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Training%20Configuration.png)

Once training begins, the configured metrics are reported for every epoch. Logs are written to `nextrec_logs/session_id`, along with feature metadata, model checkpoints, and related files.

![](/_posts/NextRec%EF%BC%9A%E9%AB%98%E6%95%88%EF%BC%8C%E6%A8%A1%E5%9D%97%E5%8C%96%E7%9A%84%E8%BD%BB%E9%87%8F%E7%BA%A7%E6%B7%B1%E5%BA%A6%E5%AD%A6%E4%B9%A0%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%E6%A1%86%E6%9E%B6/Training%20logs.png)

---

## Tutorials

The official repository includes detailed onboarding documentation. The [`tutorials/`](https://github.com/zerolovesea/NextRec/tree/main/tutorials) directory provides examples covering ranking, retrieval, multi-task learning, and data processing:

- [movielen_ranking_deepfm.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/movielen_ranking_deepfm.py) — training DeepFM on MovieLens 100K.
- [example_ranking_din.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/example_ranking_din.py) — training DIN on e-commerce data.
- [example_multitask.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/example_multitask.py) — training the ESMM multi-task model on e-commerce data.
- [movielen_match_dssm.py](https://github.com/zerolovesea/NextRec/blob/main/tutorials/example_match_dssm.py) — a DSSM retrieval-model example trained on MovieLens 100K.

For a deeper introduction to NextRec, there are also Jupyter notebooks:

- [getting started with NextRec](https://github.com/zerolovesea/NextRec/blob/main//tutorials/notebooks/zh/Hands%20on%20nextrec.ipynb)
- [data preprocessing with the data processor](https://github.com/zerolovesea/NextRec/blob/main//tutorials/notebooks/zh/Hands%20on%20dataprocessor.ipynb)

> In the current 0.3.1 release, the retrieval-model module is still incomplete and may have compatibility issues or unexpected errors. If you run into a problem, please open an [issue](https://github.com/zerolovesea/NextRec/issues).

## Closing thoughts

Thank you for taking an interest in NextRec. Whether you are a recommendation engineer, a student interested in recommendation algorithms, or a practitioner in a related field, you are an important part of the recommender community.

NextRec is still growing, and I still lack a great deal of relevant development experience. Contributions of any kind are welcome—code, issues, and more. I look forward to learning and growing in this field together.

November 30, 2025, Suzhou
