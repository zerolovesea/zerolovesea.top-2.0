---
title: "Recommender systems: PEPNET and embedding-personalized multi-task learning"
description: "How PEPNET works and how it is implemented."
pubDate: "2026-01-03 13:47:00"
---

Source code for my recommender-systems project: [NextRec](https://github.com/zerolovesea/NextRec)

If you find it useful, a star would be appreciated.

Over the New Year holiday, I caught up with PEPNET, a model from a 2023 Kuaishou paper for multi-scenario, multi-task modeling that was deployed across the platform.

Multi-scenario multi-task learning adds another dimension to conventional multi-task learning. A conventional setting may predict click-through, registration, and conversion rates for different products on one page. A multi-scenario setting performs multi-task modeling across pages; in marketing, that can mean multi-step conversion objectives for different marketing channels.

The motivation is straightforward:

- Modeling each scenario separately creates too many models to maintain and prevents samples from being shared. This is the original problem that multi-task modeling tried to solve.
- The see-saw problem remains: improving one task can hurt another. With scenarios added, a second see-saw emerges. Large-sample scenarios are easier to learn, while small-sample scenarios may not receive enough learning signal.

# Architecture

To address the see-saw problem, PEPNET introduces personalized priors. Embeddings carry personalized information, but a given scenario does not need every part of an embedding. Gates select the useful dimensions. Gates are needed both for scenarios and for tasks, so the model can choose the relevant embeddings and subnetwork parameters. Hence the name: **Parameter and Embedding Personalized Network**.

From a parameter-learning perspective, it resembles POSO, which uses probability-conditioned features to learn priors.

![](https://img2024.cnblogs.com/blog/1704997/202504/1704997-20250430115243737-743557708.png)

The architecture introduces Gate NU, EPNet, and PPNet.

Gate NU is a scaling gate: two fully connected layers, a sigmoid in the final layer, and element-wise multiplication by a scale factor of 2. Its output weights each input dimension. For example, `[2, 4, 1]` gives the corresponding embedding dimensions different weights.

$$
x_1 = ReLU(x_0 W_0 + b_0)
$$

$$
x_1 = 2 \cdot Sigmoid(x_1 W_1 + b_1)
$$

In the figure, domain features—such as a scenario ID or scenario-specific features—enter Gate NU. The resulting weights are multiplied element-wise with embeddings to emphasize dimensions important to each scenario. This is EPNet, the Embedding Personalized Network: it maps the same embedding differently for different scenarios. To avoid disturbing learning in the shared embedding layer, gradients from the shared embedding are stopped while the gate is computed.

PPNet, the Parameter Personalized Network, receives the complete feature set: weighted embeddings and ID features. Gate NU then reweights them before each subsequent layer. Stacking these layers produces a DNN with personalized parameters.

# Implementation

NextRec provides PEPNET through `from nextrec.models.multi_task.pepnet import PEPNet`. The [source](https://github.com/zerolovesea/NextRec/blob/main/nextrec/models/multi_task/pepnet.py) implements EPNet as a feature-level gate and PPNet as task-specific gated towers. `domain_features`, `user_features`, and `item_features` form the task context; the domain embedding and the EPNet input are detached in the gate path, while the original feature embeddings remain available for the main forward path.

Each PPNet block applies a GateMLP before every MLP layer. The gate is conditioned on the task context and a stop-gradient copy of the EPNet output; it therefore scales each layer's representation for that task without allowing gate gradients to overwrite the shared representation directly.

The implementation is available in the linked source and can be used directly through `PEPNet`.

January 3, 2026, in Suzhou
