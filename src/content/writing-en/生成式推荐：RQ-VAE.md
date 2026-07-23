---
title: "generative recommendation: RQ-VAE"
description: "notes on the principles behind RQ-VAE."
pubDate: "2025-09-14 08:49:03"
---

I recently started looking at generative recommendation paradigms—rather late, really. Generative models entered industrial recommendation systems as early as 2023, and frameworks led by Google's Tiger developed quickly over the following two years. This year, large Chinese companies have begun deploying them as well. This weekend I studied one of their core components: RQ-VAE.

## From item IDs to semantic IDs

After the industry moved to the Embedding + DNN paradigm, features became relatively standardized, especially in e-commerce: item IDs, user IDs, profile features, and behavior sequences. An item ID is usually an independent ID obtained through hashing, whose embedding is obtained by lookup. This works well, but still has several problems:

1. Hash collisions.
2. Original item IDs create a very large vocabulary.
3. Numeric IDs handle cold start poorly.
4. They cannot use the item's own semantics.

Semantic IDs were proposed to address these limitations. They represent one item through multiple IDs, and RQ-VAE is a way to construct them. To understand it, we first need VAE.

## VAE

RQ-VAE improves on VAE (Variational Autoencoder), a generative model that learns the input distribution and produces a similar one. KL divergence is part of its objective.

VAE consists of an encoder, reparameterization, and decoder:

1. The encoder maps input to two vectors describing latent variable $z$: mean $\mu(x)$ and standard deviation $\sigma(x)$.
2. Learning the latent distribution requires random sampling, which is not differentiable. Reparameterization makes it differentiable:

$$
z = \mu(x) + \sigma(x) \cdot \epsilon, \quad \epsilon \sim \mathcal{N}(0, 1).
$$

3. The decoder maps $z$ back to data space, producing reconstruction $\hat{x}$.

The loss has two components. Reconstruction loss keeps reconstructed and original data similar; KL divergence constrains latent space to approach a standard normal distribution, making it possible to sample new data:

$$
\mathcal{L} = \underbrace{\text{reconstruction loss} \; \| x - \hat{x} \|^2}_{\text{accurate reconstruction}} +
\underbrace{\text{KL divergence} \; D_{KL}(q(z|x) \| p(z))}_{\text{constrained latent distribution}}.
$$

VAE is used broadly for generation and information compression. This post considers the latter.

### VAE for information compression

VAE is roughly like an embedding layer. For text, tokenize and embed or one-hot encode the input so every token becomes a high-dimensional vector. Feed the high-dimensional sequence to an encoder such as RNN, GRN, CNN, or Transformer, compressing it to a low-dimensional vector. During training, the decoder restores that compressed vector to a predicted text sequence, and the loss controls the encoder's embedding quality.

### Comparison with BERT-like models

Both VAE and BERT-like models map text to low-dimensional vectors through an encoder, but their training objectives differ. VAE reconstructs samples to learn the original text distribution; BERT predicts masked or next tokens. VAE is therefore comparatively insensitive to sequence data and context, focusing on reconstruction. BERT uses self-attention to capture context while generating tokens. As a result, VAE embeddings usually express an overall topic, while BERT can capture the semantics of individual words.

## RQ-VAE: residual quantized VAE

VAE reduces high-dimensional embeddings, but storing a continuous vector for every item still creates industrial-scale storage pressure. RQ-VAE compresses the output further, transforming continuous vectors into discrete low-dimensional representations. RQ refers to vector quantization (VQ) and residual encoding. The aim is to store item indices and retrieve through ID → lookup → dot product.

RQ-VAE represents a VAE embedding through a combination of discrete codebook-index vectors. I think of the codebook as an embedding of a semantic embedding: ordinary text embedding maps discrete tokens to continuous vectors, while a codebook maps semantic vectors to discrete semantic IDs. This avoids storing every embedding directly and makes large-scale embedding storage manageable.

![RQ-VAE architecture](https://pic4.zhimg.com/v2-68a25d23f527b7ce60cd9df0109a52eb_1440w.jpg)

The model adds quantization and residual modules to VAE:

1. The encoder maps input $x$ to latent vector $z_e$.
2. It performs residual quantization on $z_e$: first map $z_e$ to the nearest codebook vector, calculate the residual between it and the quantized representation, quantize that residual again, and accumulate it. Repeating this produces a more precise discrete latent representation.
3. The decoder reconstructs $\hat{x}$ from quantized vector $z_q$.

Its objective includes reconstruction loss and quantization loss:

$$
\mathcal{L}_{quant} = \| \text{sg}[z_e] - z_q \|^2 + \beta \| z_e - \text{sg}[z_q] \|^2,
$$

where `sg` means stop-gradient and controls the update direction. The final loss is:

$$
\mathcal{L} = \text{reconstruction loss} + \mathcal{L}_{quant}.
$$

RQ-VAE recursively quantizes the encoder's latent representation. Each level has a codebook and assigns the residual to its nearest embedding; after $N$ levels, the resulting $N$-codeword tuple is the semantic ID. This approximates the input from coarse to fine.

To avoid codebook collapse—mapping most inputs to only a few codebook vectors—the codebook can be initialized with k-means on the first training batch, using cluster centers and updating them by exponential moving average. A typical update loop initializes codebooks, assigns each vector to its nearest codebook vector, calculates residuals, aggregates and averages residuals assigned to each codeword, updates those codewords, and repeats until convergence or a preset iteration count.

I still do not fully understand the details. There is an existing [implementation](https://github.com/EdoardoBotta/RQ-VAE-Recommender) on GitHub; I need to debug it to learn how codebook updates and semantic alignment are actually implemented. I will update this post when I understand more.

September 14, 2025, Suzhou
