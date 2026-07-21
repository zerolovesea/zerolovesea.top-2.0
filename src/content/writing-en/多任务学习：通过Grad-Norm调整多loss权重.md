---
title: "multi-task learning: balancing multiple losses with GradNorm"
description: "an introduction to GradNorm and its implementation."
pubDate: "2025-12-21 08:47:18"
---

I have been continuing to develop my open-source recommendation framework, [NextRec](https://github.com/zerolovesea/NextRec), which has now reached version 0.4.11. Most of the early milestones are nearly complete.

The most rewarding part of the work has been gaining a deeper understanding of recommendation algorithms—especially engineering concerns and distributed training. Many of these were once hard problems for earlier engineers, but now have better solutions. This post looks at one unavoidable multi-task-learning question: how should we balance losses across tasks?

We have not used multi-task learning in production for very long; only in the past half year has it become a frequent part of our work. Usually, we set loss weights by intuition: the task that seems more important receives a larger weight. In our scenario, tasks include clicks, registration, and conversion. Conversion matters most to the business, so we commonly give the final task the highest weight.

In NextRec, these weights can be specified when compiling a model:

```python
model.compile(
    optimizer="adam",
    optimizer_params={"lr": 5e-4, "weight_decay": 1e-4},
    loss=["bce", "bce"],
    loss_weights=[0.3, 0.7],
)
```

At every epoch, each task loss is multiplied by its corresponding weight. This is a simple prior-driven approach, and it is not truly data-driven. It has two core issues:

1. **Task losses can have different scales.** This is especially apparent when regression and classification tasks coexist: MSE and BCE can differ substantially in scale, allowing the larger loss to dominate training. In industry, loss normalization is often used to mitigate this.
2. **Task losses can converge at different rates.** An easy task may converge quickly while a difficult task progresses slowly. Looking only at total loss hides the difficult task behind the rapid convergence of the easy one.

In practice, suitable task-loss weights should change with the samples and the course of training. The 2018 paper *GradNorm: Gradient Normalization for Adaptive Loss Balancing in Deep Multitask Networks* proposes a solution.

# GradNorm

GradNorm uses the strength of each task's gradient on shared parameters to determine how strongly that task affects the model, then adjusts the weight of underrepresented tasks. This moves one level deeper than comparing losses alone, to the parameter level.

Let $W$ be the shared parameters in a multi-task model. For task $i$, its gradient norm is

$$G_i = \left\| \nabla_W \big( w_i \mathcal{L}_i \big) \right\|.$$

Why use gradients on shared layers? Task-tower gradients do not compete with one another; the shared layers are where the tasks compete.

GradNorm defines a target gradient norm as

$$\tilde{G}_i = \bar{G} \cdot \left( \frac{\mathcal{L}_i(t)}{\mathcal{L}_i(0)} \right)^{\alpha},$$

where $\bar{G}$ is the mean current gradient norm over all tasks, and the latter term represents task $i$'s relative training progress. For each task, take the gradient on the shared parameters, apply the current task weight, compute its L2 norm, then average across tasks to obtain the first factor.

In the second factor, the numerator is task $i$'s current loss and the denominator its initial loss. This dimensionless ratio better reflects learning speed. The parameter $\alpha$ controls the strength of the adjustment: the faster a task learns, the smaller its target gradient becomes.

On each iteration, compute task losses and the weighted total loss, update the model parameters, then compute each task's shared-layer gradient norm. Construct the new target norms and minimize the GradNorm loss to update the task weights.

# Implementation

NextRec 0.4.13 added GradNorm support. Replace the earlier `loss_weights` list with `{"method": "grad_norm", "alpha": 1.5, "lr": 0.025}`; `"grad_norm"` is also accepted as a shorthand.

```python
model.compile(
    optimizer="adam",
    optimizer_params={"lr": 5e-4, "weight_decay": 1e-4},
    loss=["bce", "bce"],
    loss_weights={"method": "grad_norm", "alpha": 1.5, "lr": 0.025},
)
```

The underlying implementation identifies the shared parameters, computes each task's gradient norm with respect to them, then uses an L1 GradNorm objective to update the learnable weights. It supports EMA smoothing for the current loss and for the initial-loss baseline, which makes the relative training-rate estimate more stable. After every weight update, the weights are clamped to a small positive value and renormalized to sum to the number of tasks.

# Offline metrics

I ran an ablation study on an offline business dataset with more than 300,000 examples. The training tasks were response, conversion, and high-quality-customer prediction. The latter two had fewer examples and therefore imbalanced distributions.

Using MMoE with BCE as the baseline, I compared training with and without GradNorm.

![251222-1](/_posts/%E5%A4%9A%E4%BB%BB%E5%8A%A1%E5%AD%A6%E4%B9%A0%EF%BC%9A%E9%80%9A%E8%BF%87Grad-Norm%E8%B0%83%E6%95%B4%E5%A4%9Aloss%E6%9D%83%E9%87%8D/251222-1.png)

With GradNorm, `label_good`—the more difficult task with relatively fewer samples—achieved a higher AUC. This suggests that GradNorm gave more attention to its gradient and helped the task converge more effectively.

December 21, 2025, Suzhou
