---
title: "From Pointwise to Generative: Recent NextRec Updates"
description: "A record of recent NextRec updates and architectural refactors."
pubDate: "2026-04-12 10:55:00"
---

Source code for my recommender-systems project: [NextRec](https://github.com/zerolovesea/NextRec)

If you find it useful or interesting, a star would be greatly appreciated.

I did not update this blog much in 2026 because I spent a lot of time on product work and my own projects. As of April 12, 2026, the latest NextRec release is v0.6.7. This post covers the improvements and code changes I made during that period.

## BaseModel and BaseMatchModel

NextRec originally followed a design similar to DeepCTR and torch-rechub, mainly for pointwise samples. DeepCTR has no logic designed for other settings and uses a separate DeepMatch package for pairwise scenarios. Torch-rechub instead changes the training paradigm through different trainers.

Based on those frameworks, NextRec started with `BaseModel` as the base class for pointwise CTR models and `BaseMatchModel` as the base class for two-tower retrieval models. The two differ mainly in sample construction and loss calculation. Pointwise training is simple: a single example can be taken from the batch. The latter must sample within the batch, build positive/negative pairs, and calculate similarity with two towers.

The early architecture was roughly as follows.

**BaseModel**:

- `get_input`: fetch one sample
- `compile`: configure the optimizer, loss function, and scheduler
- `compute_loss`: calculate loss
- `fit`: run complete training
- `train_epoch`: train one epoch

**BaseMatchModel**:

- `inbatch_logits`: calculate a similarity matrix between every user embedding and item embedding in the batch
- `compute_similarity`: output similarity for explicitly supplied user and item embeddings; unlike the former, this is not an all-pairs in-batch calculation
- `compute_loss`: take positive and negative logits from `inbatch_logits`, then calculate loss

The design was logical, but it meant that each model could be assigned only one training paradigm. A `DeepFM` model inheriting from `BaseModel`, for example, could not be trained with a pairwise objective.

## RQVAE and HSTU

Near the end of the year, I began introducing other modules. RQVAE is a representation-compression module: it combines reconstruction and quantization losses, produces discrete SIDs, and needs to persist its codebook. Because it could not fit the existing classes cleanly, I had to override `forward` and `compute_loss` just for it. That was the start of code duplication.

Later I added HSTU, which stacks multiple HSTU layers to output sequence IDs. It is a sequential recommender model and is incompatible with the earlier classification and regression tasks, so I had to add layers of patch logic in both the dataloader and `BaseModel`.

## Refactor v1: Introducing Adapters

As the patch logic grew heavier, I tried an architectural refactor beginning with v0.6.1. Training configuration was split into two parameters:

- `training_mode`: defines the optimization objective; supports pointwise, pairwise, and listwise
- `sampling_mode`: defines sample organization; supports explicit and in-batch sampling
- at the model level, models stopped outputting probabilities for a task and instead returned raw logits

The main goal was to decouple models from training paradigms. This lets models such as DeepFM support contrastive learning. Every model can focus on its network architecture while the framework supports a broader range of experiments.

This refactor introduced adapters that add task-specific utilities to `BaseModel`: `TrainingAdapter` and `TwoTowerAdapter`. They support pointwise and two-tower scenarios, respectively, and implement `format_model_output` to normalize a model's output into the format required by a task.

The rough structure was:

**TrainingAdapter**: adapter for conventional models

- `compute_loss`: returns `None`, leaving loss calculation to `BaseModel`
- `forward`: uses the task-specific `prediction_layer` to standardize the model's raw logits

**TwoTowerAdapter**: adapter for two-tower retrieval

- `prepare_list_input`: turns raw input into `list_size`, `batch_size`, and `flat_input`; the first two preserve the original structure while `flat_input` flattens tensors for the network
- `forward`: restores the output using the previously recorded `list_size` and `batch_size`
- `sample_inbatch_negatives`: returns all negative samples and uses `max_negatives` to sample from them

In addition to adapters, I added `GenerativeRetrievalHead` to task heads for sequence-retrieval tasks.

`BaseModel.__init__` then runs `set_task_output` to configure each task:

```python
    def set_task_output(self):
        if self.training_modes[0] in {"pairwise", "listwise"} and self.sampling_mode == "explicit":
            self.training_adapter = CandidateListAdapter()
        else:
            self.training_adapter = TrainingAdapter()

        self.prediction_layer = None
        if self.training_modes[0] != "pointwise":
            return
        task_type = self.task[0] if isinstance(self.task, list) else self.task
        if task_type == "generative":
            if not hasattr(self, "vocab_size"):
                raise ValueError(
                    f"[{self.__class__.__name__}-head Error] task='generative' requires the model to define vocab_size before BaseModel initialization."
                )
            self.prediction_layer = GenerativeRetrievalHead(vocab_size=int(self.vocab_size), return_logits=True)
            return
        self.prediction_layer = TaskHead(task_type=self.task)

    def format_model_output(self, raw_output: Any):
        if self.training_modes[0] != "pointwise":
            return raw_output
        if isinstance(raw_output, torch.Tensor) and self.prediction_layer is not None:
            return self.prediction_layer(raw_output)
        return raw_output
```

After this refactor, a model could generally support different training paradigms. For some models, `format_model_output` still needs to be overridden to normalize the output.

For example, ESMM models CTCVR, so its logits must be processed before they are returned:

```python
    def format_model_output(self, raw_output):
        if self.training_modes[0] != "pointwise":
            return raw_output
        preds = self.prediction_layer(raw_output)
        ctr, cvr = preds.chunk(2, dim=1)
        ctcvr = ctr * cvr
        return torch.cat([ctr, ctcvr], dim=1)
```

## Refactor v2: Further Decoupling

The first refactor reduced pressure on `BaseModel` by moving old patch logic into adapters, but `BaseModel` was still too heavy. The evaluator needed to accommodate different tasks; autoregressive tasks needed targets built from raw samples; and the data formats of intermediate layers needed consistent normalization. More importantly, the code was still ugly: redundant logic and internal protocols made it hard to read. Soon after v0.6.1, I began a second refactor.

Its core goals were:

1. Manage training components separately: in addition to adapters, extract evaluators and losses.
2. Standardize intermediate-layer protocols: use protocols to manage output fields for different task settings.
3. Bring the training paradigms for pretrained representation models and sequential retrieval models into the framework.

To make this work, I wrote dedicated base classes for different model types rather than forcing everything to inherit from and override one `BaseModel`. I also established a uniform format for intermediate data.

The code has now been published to PyPI dev, but the problem of ugly code remains, so it needs another cleanup. That is largely a consequence of AI-generated code: the initial version used AI only sparingly, so its hierarchy and structure stayed relatively simple and readable. As I used AI more frequently, many pieces of logic were changed directly or indirectly. Resolving that is a major goal of this refactor.

Suzhou, April 12, 2026
