---
title: "revisiting statistical learning: GBDT and its improvements"
description: "GBDT and subsequent improved models."
pubDate: "2025-04-03 21:03:20"
---

Gradient Boosting Decision Trees (GBDT) build an additive model from many weak decision trees. Each tree is trained sequentially to fit the residual—or, more generally, the negative gradient—left by the existing ensemble.

## Gradient boosting

Suppose the current model after $m-1$ trees is $F_{m-1}(x)$. A new weak learner $h_m(x)$ is added:

$$
F_m(x) = F_{m-1}(x) + \eta h_m(x),
$$

where $\eta$ is the learning rate. Instead of directly fitting the target, the new tree fits the negative gradient of the loss with respect to the current prediction. For squared error, this negative gradient is exactly the residual.

This view generalizes boosting beyond regression. With logistic loss, the tree fits gradients related to classification probability; with other differentiable losses, the same principle still applies.

## Regularization and overfitting

Boosted trees are powerful but can overfit. Common controls include limiting tree depth and leaf count, increasing minimum samples per leaf, using learning-rate shrinkage, subsampling rows and features, and stopping early on validation performance. A smaller learning rate usually needs more trees but can generalize better.

## XGBoost

XGBoost improves conventional GBDT through second-order optimization, regularization, and engineering efficiency. It uses both first- and second-order gradients in its objective approximation, adds penalties for the number of leaves and leaf weights, handles missing values by learning default split directions, supports column sampling, and parallelizes split finding.

Its regularized objective can be written as:

$$
\mathcal{Obj}^{(t)} = \sum_i \left[g_i f_t(x_i) + \frac{1}{2}h_i f_t(x_i)^2\right] + \Omega(f_t),
$$

where $g_i$ and $h_i$ are first- and second-order derivatives and $\Omega$ penalizes tree complexity.

## LightGBM

LightGBM focuses on high-speed, large-scale training. It uses histogram-based split finding, leaf-wise tree growth with depth constraints, Gradient-based One-Side Sampling (GOSS), and Exclusive Feature Bundling (EFB). Histogram binning reduces the cost of evaluating continuous split points. GOSS retains instances with large gradients and samples more aggressively from low-gradient instances. EFB combines mutually exclusive sparse features to reduce dimensionality.

Leaf-wise growth selects the leaf with the largest gain rather than expanding all leaves level by level. It often improves accuracy but needs depth or leaf constraints to prevent overfitting.

## CatBoost

CatBoost is designed especially for categorical features. It avoids naive target encoding leakage by using ordered target statistics: for a sample, category statistics are calculated only from preceding samples in a random permutation. It also uses ordered boosting to reduce prediction shift, along with symmetric trees that make inference efficient.

## Choosing a model

XGBoost is a strong, stable general-purpose choice; LightGBM is usually attractive for speed and very large sparse datasets; CatBoost is often the best starting point when categorical features are central and extensive preprocessing is undesirable. The best choice still depends on data, objectives, latency, interpretability, and reliable validation.

April 3, 2025, Suzhou
