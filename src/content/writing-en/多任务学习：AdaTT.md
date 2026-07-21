---
title: "multi-task learning: AdaTT"
description: "an introduction to AdaTT and its implementation."
pubDate: "2025-09-20 09:32:41"
---

After working through PLE in the previous post, I moved on to AdaTT. This KDD 2023 paper from Meta is a further development of PLE.

## Existing work

The paper agrees with the central idea behind customized sharing and PLE: task correlations differ. Some tasks may be strongly related while others are weakly related. An ideal model should learn those relationships dynamically instead of assuming a fixed sharing structure.

Too much sharing can cause negative transfer; too much specialization loses the benefits of sharing, especially for low-sample tasks. A mechanism is needed to balance shared and task-specific experts automatically.

The paper summarizes existing approaches as follows:

- **Shared-bottom** is simple but has a fixed sharing structure, which can force unrelated tasks to share and cause negative transfer.
- **Soft-sharing models** such as MMoE and PLE use experts and gates to combine representations dynamically, usually through shared experts plus task experts or through dynamic layer-wise module selection.
- **Cross-Stitch** and related networks mix representations between fixed layers, but their gates or mixing mechanisms can be too coarse-grained and insufficiently flexible.

The authors argue that soft-sharing models such as PLE do not make task relationships explicit enough. AdaTT moves sharing to the task level rather than only the feature level.

## Model architecture

![Model architecture](/_posts/%E5%A4%9A%E4%BB%BB%E5%8A%A1%E5%AD%A6%E4%B9%A0%EF%BC%9AAdaTT/250921-1.png)

AdaTT—Adaptive Task-to-Task Fusion Network—aims to:

- Model task relationships more precisely at the task-pair level, allowing one task to share directly with another.
- Retain task-specific learning and fuse shared and task-specific information through residual connections and gates.
- Fuse at multiple depths, so shallow layers learn task-generic representations while deeper layers learn more task- and semantics-specific representations.

## Implementation

Meta's open-source implementation provides two architectures. `AdaTTSp` gives every task its own experts, so each layer's experts serve only their corresponding task; gates fuse information between tasks. `AdaTTWSharedExps` additionally introduces shared experts that every task can access, similarly to PLE and MMoE.

### AdaTTSp

For every extraction layer, `AdaTTSp` builds a set of experts for each task and a gate for each task. All expert outputs are stacked, and each task gate produces a softmax distribution over them. A batched matrix multiplication then fuses the outputs into a task representation.

Its main addition is a residual connection from each task's native experts. When a task has multiple experts, the model learns a separate linear combination of those experts and adds it to the gate-fused output. When there is only one expert per task, that expert output is added directly. This keeps task-specific information available even while tasks exchange information through the gates.

### AdaTTWSharedExps

`AdaTTWSharedExps` extends `AdaTTSp` with shared experts. Before the final layer, it propagates outputs for both task modules and the shared module. At the final layer, only task representations are needed for the task towers.

Each task and, where applicable, the shared module has a gate over all experts. The model adds the residual contribution of native experts to those gate weights before fusion. If every module has exactly one expert, this residual is simply added; otherwise, learned per-module weights determine the contribution of native experts.

After reading through the model, it still feels to me as though much of the improvement comes from adding parameters. Shared experts are not a new idea; AdaTT moves the fusion module from feature extraction to the task level. There are still points I do not fully understand, but I will first test it in the business setting before deciding whether to explore it further.

September 21, 2025, Suzhou
