---
title: "multi-task learning: from hard parameter sharing to PLE"
description: "an introduction to PLE and its implementation."
pubDate: "2025-09-20 09:31:52"
---

With nothing much planned for the weekend, I decided to revisit multi-task learning and study PLE properly. I started because we recently experimented with Meta's AdaTT framework at work, whose official repository implements several classic architectures. I had looked at PLE several times without fully understanding it, so I spent some time working through this classic model.

## Multi-task learning, negative transfer, and the seesaw effect

PLE (Progressive Layered Extraction) was introduced by Tencent Video in a 2020 RecSys paper that won the conference's Best Long Paper Award. It addresses a video-recommendation setting. Two central problems are negative transfer and the seesaw effect: when tasks are weakly correlated, improving one task's metric may hurt another's, undermining the point of sharing parameters.

The paper uses VCR (View Completion Ratio, a regression prediction of video completion) and VTR (View-Through Rate, a binary label indicating whether a user watched past a threshold) as examples. Their experiments observed a clear seesaw between the two tasks. Against single-task baselines, MMoE was the only then-common multi-task model to outperform both single-task models on both tasks.

![ple_seesaw](https://i-blog.csdnimg.cn/blog_migrate/8d5e40f3851c0b6d1d1787cbe210258e.png#pic_center)

My rough understanding is that multi-task learning can help tasks with insufficient samples. MoE and gate layers allow information from other tasks to enter each task tower through learned weights. But a seesaw is understandable too: video completion rate and watch time can be naturally negatively correlated. Many high-completion videos are short; if a model mostly recommends short videos, it will perform poorly on the watch-time task.

## An overview of multi-task architectures

The paper presents a taxonomy of single-layer multi-task models: hard parameter sharing, asymmetric sharing, customized sharing, MMoE, and CGC, which PLE builds upon.

![250920-1](/_posts/%E5%A4%9A%E4%BB%BB%E5%8A%A1%E5%AD%A6%E4%B9%A0%EF%BC%9APLE/250920-1.png)

### Hard parameter sharing

Hard parameter sharing passes the same input through a shared bottom and then expands the resulting representation for the task towers. It is concise, but makes every task use the same shared representation.

### Asymmetric sharing

In asymmetric sharing, tasks do not necessarily use the same features. For example, task A can use only its own representation while task B uses all available information. The original task remains unaffected, while the enhanced task receives additional useful signals.

### Customized sharing

Customized sharing adds a learnable weighting network that allocates feature weights for each task. Cross-Stitch Networks, introduced in 2016, use a learnable cross-stitch matrix to linearly mix task representations.

![Cross-Stitch Network](https://hub-cache.baai.ac.cn//uploads/attachment/avatar/702/702__1602832484.png)

### CGC

MMoE passes a common input through shared experts and then gives each task tower a weighted combination of expert outputs. It assumes that every task can use every expert's representation. Tencent's team argued that this does not split tasks finely enough: when tasks differ significantly, universally shared experts may not be effective.

![MMOE](/_posts/%E5%A4%9A%E4%BB%BB%E5%8A%A1%E5%AD%A6%E4%B9%A0%EF%BC%9APLE/250920-3.png)

![MMOE architecture](/_posts/%E5%A4%9A%E4%BB%BB%E5%8A%A1%E5%AD%A6%E4%B9%A0%EF%BC%9APLE/250920-4.png)

CGC, introduced alongside PLE, is its foundation. Each task has task-specific experts as well as shared experts. A task gate forms a weighted combination of its own experts and the shared experts. This enables selective sharing instead of MMoE's single pool of shared experts.

![CGC architecture](/_posts/%E5%A4%9A%E4%BB%BB%E5%8A%A1%E5%AD%A6%E4%B9%A0%EF%BC%9APLE/250920-2.png)

CGC has three components:

1. A bottom layer of task-specific expert networks and shared networks, all fed copies of the input features.
2. Task towers that produce the final outputs.
3. Gate networks—the white blocks in the diagram—which use softmax to assign weights when fusing expert features.

MMoE and CGC both weight expert outputs. The important difference is the set of experts being weighted and the resulting information flow: MMoE allocates from a pool of shared experts, whereas CGC lets a task choose from its own experts plus shared experts.

## PLE

PLE deepens CGC. Its multi-level extraction network stacks multiple expert layers, based on the idea that deeper expert networks can extract deeper semantic information. At every layer, shared experts continually absorb information from task-specific experts, while each task-specific expert absorbs useful information from shared experts.

Only after feature extraction through these multiple layers are the representations fed to task towers. The authors call this progressive feature extraction, which is where the name Progressive Layered Extraction comes from.

![PLE](https://i-blog.csdnimg.cn/blog_migrate/53406b8d81a3fd2045fdde819fdfd79f.png#pic_center)

In implementation, each extraction layer creates task-specific and shared experts. A task-specific gate selects only that task's experts and the shared experts; a shared gate, except in the final layer, can select from all experts. The gate's softmax weights are multiplied by selected expert representations to produce the representation for the next layer. With just one extraction layer, PLE reduces to CGC.

## Improving the loss function

Beyond architecture, the paper's loss-function changes are valuable in real business settings. Traditional multi-task models use a weighted sum of subtask losses. That is problematic when user behavior labels are ordered: a downstream label exists only after an upstream action, so tasks do not share the same sample space.

The paper solves this by excluding samples outside a task's current sample space when calculating that task's loss. Each task uses its own valid samples, while all tasks still optimize the shared model parameters.

It also replaces manually chosen task weights with dynamic adjustment: each subtask begins with an initial value, and its loss weight is then updated at every step according to its training rate.

September 20, 2025, Suzhou
