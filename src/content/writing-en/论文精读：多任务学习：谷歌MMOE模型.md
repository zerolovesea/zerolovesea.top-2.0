---
title: "paper reading: Google's MMoE model for multi-task learning"
description: "a translation and architecture analysis of Google's 2018 multi-task-learning paper."
pubDate: "2025-05-09 13:44:42"
---

MMoE, or Multi-gate Mixture-of-Experts, is a classic 2018 Google model for multi-task learning. Its central problem is negative transfer: when task relationships are weak, forcing them to share one representation can improve one task while hurting another.

## From shared-bottom to MMoE

The simplest multi-task architecture is shared-bottom: all tasks share lower layers, then each has an independent tower. This works when tasks are strongly related, but the fixed sharing pattern can cause negative transfer when they are not.

MMoE introduces multiple shared experts and one gate per task. Each expert processes the common input into a representation. A task-specific gate produces a softmax distribution over experts, and the task receives their weighted sum. The task tower then predicts its output from that mixture.

For task $k$, expert $i$ has output $f_i(x)$ and the gate produces $g^k(x)$. The task representation is:

$$
f^k(x) = \sum_{i=1}^{n} g_i^k(x) f_i(x),
$$

where $n$ is the number of experts. The gate lets each task dynamically choose how much it uses each shared expert for every input.

## Architecture

The model contains three parts:

1. **Experts:** several neural networks that learn shared latent representations.
2. **Task-specific gates:** one gate for each task, mapping the input to expert weights through Softmax.
3. **Task towers:** independent networks that transform each gated mixture into task predictions.

Unlike shared-bottom, MMoE does not require every task to consume the same shared feature. It can emphasize different experts for different tasks and inputs, making soft sharing more flexible.

## Why gates help

The experts are shared, but their use is not. A click-prediction task and conversion-prediction task may both use an expert that captures general user intent, while each assigns different weights to experts focused on browsing or purchase signals. The gates can therefore retain shared benefits for low-sample tasks without enforcing identical representations.

The number of experts is a trade-off. Too few experts limit diversity; too many increase parameters, computation, and the risk that experts become redundant. Gates also need enough training data, since their weights determine how information flows between tasks.

## Training objective

MMoE usually trains with a weighted sum of task losses:

$$
\mathcal{L} = \sum_{k=1}^{K} \lambda_k \mathcal{L}_k,
$$

where $K$ is the number of tasks, $\mathcal{L}_k$ is the task loss, and $\lambda_k$ controls its importance. Classification tasks commonly use binary cross-entropy; regression tasks can use MSE or related losses.

Loss weights remain important. Gates alleviate feature-level negative transfer, but they do not automatically solve imbalance between task objectives or loss scales.

## Practical considerations

In production, MMoE is often used for related behaviors such as click, conversion, engagement, and long-term value. Good feature consistency, reasonable task labels, and careful loss weighting matter as much as the architecture. Offline gains should also be checked online, because task coupling and traffic distribution can change after deployment.

MMoE remains a useful baseline: it is more expressive than shared-bottom but simpler than later variants such as CGC, PLE, and AdaTT. Those later models further separate task-specific and shared experts to reduce negative transfer when task correlations differ substantially.

May 9, 2025, Suzhou
