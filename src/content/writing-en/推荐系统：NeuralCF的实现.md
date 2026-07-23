---
title: "recommendation systems: implementing Neural Collaborative Filtering"
description: "the principles, design, and Python implementation of NeuralCF."
pubDate: "2024-10-03 08:19:04"
---

Neural Collaborative Filtering (NCF, often called NeuralCF) extends classical collaborative filtering by replacing the fixed inner product used in matrix factorization with neural networks that can learn more complex user-item interactions.

## From matrix factorization to NCF

Matrix factorization represents a user and item with embedding vectors and predicts their preference from an inner product:

$$
\hat{y}_{ui} = p_u^T q_i.
$$

This is efficient and effective, but the inner product is a fixed interaction function. NCF learns the interaction function from data instead.

## GMF and MLP

NCF contains two complementary branches.

**Generalized Matrix Factorization (GMF)** takes user and item embeddings and performs element-wise multiplication:

$$
\phi^{GMF} = p_u \odot q_i.
$$

A prediction layer then learns a weighted version of the classical inner product.

**Multi-Layer Perceptron (MLP)** concatenates a separate pair of user and item embeddings and passes them through multiple nonlinear layers:

$$
\phi^{MLP} = MLP([p_u; q_i]).
$$

This branch can model nonlinear and higher-order interactions.

## NeuMF

NeuMF combines GMF and MLP. Its final representation concatenates the two branch outputs, then uses a prediction layer:

$$
\hat{y}_{ui} = \sigma(h^T[\phi^{GMF};\phi^{MLP}]),
$$

where $\sigma$ is typically sigmoid for implicit-feedback prediction. GMF supplies a stable multiplicative signal, while MLP supplies nonlinear interaction capacity.

## Training implicit feedback

In implicit-feedback recommendation, observed interactions are treated as positives. Unobserved user-item pairs are not necessarily negative, but are commonly sampled as negatives for training. Binary cross-entropy is used:

$$
\mathcal{L} = -\sum_{(u,i) \in \mathcal{D}} \left[y_{ui}\log \hat{y}_{ui} + (1-y_{ui})\log(1-\hat{y}_{ui})\right].
$$

Negative-sampling strategy matters greatly: random negatives are easy, while popularity-based or hard negatives can make training more realistic but also more unstable.

## Practical notes

Separate embeddings for GMF and MLP help the branches specialize. Pretraining GMF and MLP separately before initializing NeuMF can improve convergence, although end-to-end training also works. Embedding dimension, MLP layer sizes, dropout, regularization, and the positive-negative sampling ratio are the main hyperparameters.

NCF is a useful bridge from matrix factorization to deep recommendation models. It retains the basic user-item interaction formulation while allowing the model to learn nonlinear relationships that a simple dot product cannot express.

October 3, 2024, Suzhou
