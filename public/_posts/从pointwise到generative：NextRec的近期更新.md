---
title: 从pointwise到generative：NextRec的近期更新
date: 2026-04-12 10:55:00
tags:
  - 推荐系统
  - NextRec
categories: 推荐系统
excerpt: 近期NextRec的更新记录和架构重构。
index_img: "/img/rec.png"
---
漫谈推荐系统源码：[NextRec](https://github.com/zerolovesea/NextRec)

如果觉得不错或感兴趣的话，可以star一下，感谢!

26年没怎么更新博客，主要在业务和自己的项目上投入了不少时间。截至26年4月12日，NextRec的最新版本号是v0.6.7。这篇文章主要讲一下我在这段时间内做的改进和代码更迭。

## BaseModel与BaseMatchModel

NextRec一开始的设计思路和DeepCTR以及torch-rechub比较类似，主要面向的是pointwise样本。DeepCTR完全没有为其他场景设计逻辑，而是用单独的DeepMatch来处理pairwise场景，torch-rechub则是使用不同的trainer来调整训练范式。

基于这两个框架，NextRec在设计之初使用BaseModel作为pointwise ctr模型的基类，使用BaseMatchModel作为双塔召回模型的基类。两个基类的区分主要在构造样本和前向计算loss上。pointwise比较简单，只需要从batch内拿单条样本即可，后者则需要考虑batch内采样，构造正负样本对，通过双塔计算相似度。

最初版本的大致架构如下：

**BaseModel**：

- get_input：获取一条样本
- compile：配置优化器，损失函数与调度器
- compute_loss：计算损失
- fit：完整训练
- train_epoch：训练一个epoch

**BaseMatchModel**：

- inbatch_logits：计算batch内所有user embedding和item embedding的相似度矩阵
- compute_similarity：输出user embedding和item embedding的相似度，不同是前者是在batch内计算，这个是根据显式输入计算
- compute_loss：从inbatch_logits里拿正负样本的logit，再计算loss

设计上这一套是符合逻辑的，不过这意味着单个模型只能被分配一种训练范式，例如DeepFM继承自BaseModel，自然不支持用pairwise的训练范式进行训练。

## RQVAE与HSTU

在年末的时候，我开始尝试引入一些其他模块。其中RQVAE是一个信息压缩的表征模块，通过重建损失和量化损失构建整体损失函数，输出离散的sid的同时，还需要持久化码本。由于和现有的类完全兼容，只能单独为这个类覆写forward和compute loss，这就是代码冗余的开始。

在后面又引入了HSTU，它通过多层HSTU layer的堆叠，输出序列ID，这是一个序列推荐模型，和之前的分类，回归任务都不兼容，导致不得不在在dataloader和basemodel里加上多层补丁逻辑。

## 重构v1: 引入adapter

由于补丁逻辑越来越重，从v0.6.1开始，我尝试进行一轮结构上的重构。训练配置拆成两个参数：

- training_mode：定义优化目标，支持 pointwise、pairwise、listwise
- sampling_mode：定义样本组织方式，支持 explicit、inbatch
- 模型层面从之前根据任务目标输出概率，改为输出原始logit

这轮重构的主要目的让模型和训练范式做解耦，这样DeepFM这样的模型也能支持对比学习，所有的模型都只关注自己的网络架构，真正能做到业务上各种各样的尝试。

这轮的重构引入了adpater的概念，它根据不同的任务，为basemodel添加工具函数：TrainingAdapter，TwoTowerAdapter。分别是为了pointwise，双塔场景构造的辅助，其中实现了format_model_output方法，用于将模型的输出，统一成任务规定的标准化输出。

大致结构如下：

**TrainingAdapter**：常规模型adapter

- compute_loss：直接返回None，用basemodel自己的计算损失逻辑
- forward：直接使用任务要求的prediction_layer对模型输出的logit进行统一

**TwoTowerAdapter**：双塔召回adapter

- prepare_list_input：根据输入的原始数据，输出list_size, batch_size, flat_input这三个参数，前两者是记录数据的原始格式，flat input是将张量展平输入给网络
- forward：从模型网络得到结果以后，再根据前面记录的list_size, batch_size，还原成
- sample_inbatch_negatives：输出所有负样本，以及max_negatives参数，来从负样本里采样

除了adapter外，还在任务头内增加了GenerativeRetrievalHead，用于处理序列召回的任务。

而在Basemodel里的init里会执行set_task_output方法来为每个任务进行配置：

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

这次重构以后，基本上做到了一个模型能够支持不同的训练范式，在一些特定模型，需要覆写format_model_output来标准化模型输出。

例如ESMM由于建模的是ctcvr，需要将logit做处理后才输出：

```python
    def format_model_output(self, raw_output):
        if self.training_modes[0] != "pointwise":
            return raw_output
        preds = self.prediction_layer(raw_output)
        ctr, cvr = preds.chunk(2, dim=1)
        ctcvr = ctr * cvr
        return torch.cat([ctr, ctcvr], dim=1)
```

## 重构v2: 进一步解耦

前一版重构已经一定程度上减轻了basemodel的压力，让adapter来处理原先的各种补丁逻辑，但是整体basemodel还是比较重：evaluator需要适配不同任务，对于自回归的任务，需要从原始样本里构造目标target，各种中间层的数据格式需要有统一规范化管理。更重要的是，代码还是很丑，各种冗余逻辑和内部协议导致可读性很差，因此v0.6.1后，我很快开始了第二次重构。

第二次重构的核心目的是：

1. 分开管理训练组件：除了adpater外，还剥离了evaluater和loss
2. 中间层协议标准化：使用protocols来管理不同任务场景下的输出字段
3. 将预训练表征模型和序列召回模型的训练范式纳入框架支持

为了实现这一点，我将不同类型的模型都写了各自的基类，而不是统一在basemodel上继承和改写，同时对于中间数据层的格式进行了统一规定。

目前代码已经推送到了pypi dev，但是代码丑的问题还是存在，因此需要再次调整（这一点主要来自ai生成的代码，最初版本只有少部分的ai代码，因此代码层级和结构都相对简单可读，之后由于使用ai的频率越来越大，导致其中很多逻辑都被直接间接修改过，这也是这次重构需要解决的一大问题）。

2026/4/12 于苏州
