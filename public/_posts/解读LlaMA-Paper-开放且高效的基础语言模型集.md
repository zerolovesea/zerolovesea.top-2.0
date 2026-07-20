---
title: '解读LlaMA Paper: 开放且高效的基础语言模型集'
date: 2024-01-01 11:22:53
tags:
  - LLM
  - NLP
  - LlaMA
categories: LLM
excerpt: 精读Meta团队发布于2022年的论文：原文翻译及架构分析。
index_img: "/img/llama.png"
---
大名鼎鼎的开源语言模型LLaMA由Meta公司发布于2023年2月27日。这在研究社区中引起了广泛的热议，它的架构也被后续各大开源模型争相模仿。

发布的模型参数数量及文件大小：
- 7B：12.55 GB。
- 13B：24.24 GB。
- 33B：60.6 GB。
- 65B：121.6 GB。

数据集总大小则是4828GB，占比如下：
- English CommonCrawl [67%]
- C4 [15%]
- GitHub [4.5%]
- Wikipedia [4.5%]
- Gutenberg and Books3 [4.5%]
- ArXiv [2.5%]
- Stack Exchange [2%]

# LLaMA模型架构
![LLaMA模型架构](240101-1.png)
LLaMA1的架构已经有很多分析了，总结一共有以下几点：

- 前置归一化(Pre-normalizatio)：受到GPT3的启发，LLaMa 对每个 Transformer 子层的输入进行归一化，而不是对输出进行归一化。这是为了训练的稳定性。
- 归一化函数使用的是RMSNorm(均方层归一化)。公式：
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><msub><mrow><mover><mi>x</mi><mo stretchy="false">¯</mo></mover></mrow><mrow><mi>i</mi></mrow></msub><mo>=</mo><mfrac><msub><mi>a</mi><mrow><mi>i</mi></mrow></msub><mrow><mrow><mi mathvariant="normal">R</mi><mi mathvariant="normal">M</mi><mi mathvariant="normal">S</mi></mrow><mo stretchy="false">(</mo><mrow><mi mathvariant="bold">x</mi></mrow><mo stretchy="false">)</mo></mrow></mfrac><msub><mi>g</mi><mrow><mi>i</mi></mrow></msub><mo>,</mo><mstyle scriptlevel="0"><mspace width="1em"></mspace></mstyle><mrow><mi mathvariant="normal">w</mi><mi mathvariant="normal">h</mi><mi mathvariant="normal">e</mi><mi mathvariant="normal">r</mi><mi mathvariant="normal">e</mi><mtext>&nbsp;</mtext><mi mathvariant="normal">R</mi><mi mathvariant="normal">M</mi><mi mathvariant="normal">S</mi></mrow><mo stretchy="false">(</mo><mrow><mi mathvariant="bold">x</mi></mrow><mo stretchy="false">)</mo><mo>=</mo><msqrt><mfrac><mn>1</mn><mi>n</mi></mfrac><munderover><mo data-mjx-texclass="OP">∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mrow><mi>n</mi></mrow></munderover><msubsup><mi>x</mi><mrow><mi>i</mi></mrow><mrow><mn>2</mn></mrow></msubsup></msqrt></math>

- 受PaLM启发，使用了SwiGLU激活函数，公式：$\mathrm{SwiGLU}(x,W,W,W,b,c,\beta)=\mathrm{Swish}_{\beta}(x W+b)\otimes(x V+c)$

- 受GPTNeo启发，采用了旋转位置编码Rotary Embeddings(RoPE)。


# LLaMA论文中的关键信息

1. LLaMA 只使用公开可用数据集进行训练，模型已开源；
   - 基于 **transformer** 架构；
   - 训练数据集大小：**1.4T 个 tokens**；
   - 参数范围 **7B~65B**；
2. 使用更多的 token 进行训练，而不是一味的扩大参数，一样能取得不错的性能。
   - **LLaMA-13B** 在大多数基准测试中**优于 GPT-3（175B）**；
3. 用户更想要的可能是一个**推理速度最快**而不是**训练速度最快**的模型；此时模型大小就非常重要：
   - LLaMA 可以在单个 GPU 上运行；
   - **LLaMA-13B 可以在单个 V100 上运行**；
4. 训练成本
   - **2048 个 A100** 80GB GPU 上，开发和训练约 5 个月；
   - 训练 65B 模型时，在 **2048 个 A100** 80GB GPU 上能处理约 **380 tokens/秒/GPU**，因此 1.4T token 的数据集训练一次大约需要 **21 天**；
   - 耗能约 2638 MWh，折算排放 1015 吨 CO2。


# 原文翻译

## [译][论文] LLaMA：开放和高效的基础语言模型集（Meta/Facebook，2022）

本文翻译自 2022 年 Meta的大模型论文： [LLaMA: Open and Efficient Foundation Language Models](https://arxiv.org/abs/2302.13971)。

作者：Hugo Touvron, Thibaut Lavril, Gautier Izacard, Xavier Martinet, Marie-Anne Lachaux, Timothée Lacroix, Baptiste Rozière, Naman Goyal, Eric Hambro, Faisal Azhar, Aurelien Rodriguez, Armand Joulin, Edouard Grave, Guillaume Lample。

## 摘要

本文介绍了 LLaMA，一个包含 **7B~65B**（70~650 亿） 参数的基础语言模型集（a collection of foundation language models）。 我们使用了数万亿个（trillions of） token训练这些模型，证明了使用公开数据集就能训练出最先进的模型， 而并非必须使用专有和私有数据集。尤其是，**LLaMA-13B 在大多数基准测试中均优于 GPT-3（175B）** ，而 LLaMA-65B 则与最佳模型 Chinchilla-70B 和 PaLM-540B 相当。 我们已经将所有模型[开源](https://github.com/facebookresearch/llama)，以供社区研究。

## 1 引言

在大规模文本语料库（massive corpora of texts）上训练的大型语言模型（Large Languages Models, LLM），已经有能力根据给定的文本指令（textual instructions） 或示例（a few examples）执行新的任务。

这种 **few-shot** 的属性首先出现在**将模型扩展到足够大的规模时**。 在此之后，出现了很多进一步扩展这些模型的工作， 它们都遵循了这样一个假设：**更多的参数将产生更好的性能**。 然而，Hoffmann 等（2022）的最新工作表明，对于给定的计算预算（compute budget）， 最佳性能并非来自那些最大的模型，而是来自那些**在更多数据上训练出来的较小模型**。

> “few-shot” 指一个模型有能力根据给定的少量示例去执行其他的类似任务的能力。

### 1.1 大模型训练：更多的参数 vs 更大的数据集

Hoffmann 等（2022）提出了 scaling laws，目标是针对给定的训练计算预算（compute budget），如何最佳地扩展（scale）数据集和模型大小。 但是，

- 这个模型没有考虑推理（inference）预算，而在提供大规模推理时，这一点尤其重要： 在这种情况下，给定一个性能目标，我们更想要的是一个推理速度最快而非训练速度最快的模型。
- 对于一个给定的性能要求，训练一个大模型可能是一种更便宜的方式； 但对于最终的推理来说，**较小的模型+更长的训练时间**（a smaller one trained longer）反而更实惠。 例如，Hoffmann 等（2022）建议用 200B tokens 来训练 10B 模型，但我们发现即使在 1T 个 token 之后，7B 模型的性能仍在随着 token 的增多而提高。

### 1.2 LLaMA：减少参数，增大数据集

本文的重点是：对于给定的不同推理预算（inference budgets）， 通过**使用更多 token 进行训练**的方式（超过业内常用的 token 规模） 来获得最佳的性能（the best possible performance）。我们将得到的模型称为 **LLaMA**。 LLaMA 的参数范围在 **7B ~ 65B**，性能与目前业界最佳的一些大语言模型相当。 例如，

- **LLaMA-13B** 在大多数基准测试中**优于 GPT-3**， 尽管参数连后者的 **10%** 都不到；
- **LLaMA 可以在单个 GPU 上运行**， 这使得大模型的获取和研究更容易，而不再只是少数几个大厂的专利；
- 在高端系列上，**LLaMA-65B** 也与最佳的大语言模型（如 Chinchilla 或 PaLM-540B）性能相当。

与 Chinchilla、PaLM、GPT-3 不同，我们只使用了公开数据（publicly available data）， 因此我们的工作是开源兼容的；

- 相比之下，大多数现有模型依赖于不公开或没有文档的数据，例如 “Books–2TB” 和 “Social media conversations”；
- 也存在一些例外，例如 OPT（Zhang 等，2022）、GPT-NeoX（Black 等，2022）、BLOOM（Scao 等，2022）和 GLM（Zeng 等，2022）， 但它们的性能都无法与 PaLM-62B 或 Chinchilla 相比。

### 1.3 内容组织

本文接下来的内容如下：

- 描述我们对 Transformer 架构所做的改动，以及我们的训练方法:
- 给出 LLaMA 的性能，基于标准基准测试与其他 LLM 进行比较；
- 使用 responsible AI 社区的最新基准测试，揭示 LLaMA 模型中存在的一些偏见和毒性（biases and toxicity）。

## 2 方法（Approach）

我们的训练方法与前人的一些工作（Brown 等，2020；Chowdhery 等，2022）类似， 并受到 Chinchilla scaling laws（Hoffmann 等，2022）的启发。 我们使用一个标准的优化器(optimizer) 在大量文本数据上训练大型的Transformers模型。

### 2.1 预训练数据（Pre-training Data）

#### 2.1.1 数据集

训练数据集有几种不同来源，涵盖了多个领域，如表 1 所示。

| 数据集        | 占比  | 迭代次数（Epochs） | 数据集大小（Disk size） |
| ------------- | ----- | ------------------ | ----------------------- |
| CommonCrawl   | 67.0% | 1.10               | 3.3 TB                  |
| C4            | 15.0% | 1.06               | 783 GB                  |
| Github        | 4.5%  | 0.64               | 328 GB                  |
| Wikipedia     | 4.5%  | 2.45               | 83 GB                   |
| Books         | 4.5%  | 2.23               | 85 GB                   |
| ArXiv         | 2.5%  | 1.06               | 92 GB                   |
| StackExchange | 2.0%  | 1.03               | 78 GB                   |

表 1：预训练数据。
其中 epochs 是用 1.4T tokens 预训练时的迭代次数。用 1T tokens 预训练时也是用的这个数据集比例。

这里的数据集大部分都是其他 LLM 训练用过的， 但我们只用其中公开可得（publicly available）的部分，并且要保持开源兼容（compatible with open sourcing）。

**English CommonCrawl [67%]**

我们使用 CCNet pipeline（Wenzek 等，2020）对 2017~2020 的五个 CommonCrawl dumps 进行预处理。

- 在行级别（line level）上对数据去重，
- 使用 fastText 线性分类器进行语言识别，去掉非英文网页，
- 使用 ngram 语言模型过滤掉一些低质量内容。

此外，我们还训练了一个线性模型，将页面分为两类：

1. 被 Wikipedia 引用过的网页；
2. 没有被 Wikipedia 引用过的（随机采样网页）。这一类将被丢弃。

**C4 [15%]**

在前期探索性实验中，我们观察到使用多样化的预处理 CommonCrawl 数据集可以提高性能。 因此，我们将公开可用的 C4 数据集（Raffel 等，2020）也包含到了训练数据中。

对 C4 的预处理也是**去重和语言识别**：与 CCNet 的主要区别在于质量过滤（quality filtering）， 主要依赖于启发式方法（heuristics），例如是否存在标点符号或网页中单词和句子的数量。

**Github [4.5%]**

使用了 Google BigQuery 上公开可用的 GitHub 数据集，但仅保留其中用 Apache、BSD 和 MIT license 的项目。 此外，

- 基于行长度（line length），字母或数字字符（alphanumeric characters）比例等，用启发式方法过滤掉低质量文件；
- 使用正则表达式删除一些模板段落（boilerplate），例如 headers；
- 在文件级别上使用精确匹配对得到的数据集进行去重。

**Wikipedia [4.5%]**

- 使用了 2022 年 6 月至 8 月的一部分 Wikipedia dumps， 覆盖 20 种语言（use either the Latin or Cyrillic scripts）：bg、ca、cs、da、de、en、es、fr、hr、hu、it、nl、pl、pt、ro、ru、sl、sr、sv、uk。

- 删掉了其中的超链接、注释和其他 formatting boilerplate。

**Gutenberg and Books3 [4.5%]**

训练数据集中包含两个书籍语料库：

1. Gutenberg Project：**公版书**（public domain books）；
2. Books3 section of ThePile（Gao 等，2020）：一个用于训练大语言模型的**公开可用**数据集。

在书级别（book level）去重，内容超过 90% 重复的书会被剔除出去。

**ArXiv [2.5%]**

为了让训练数据集包含一定的科学数据（scientific data），我们对一些 arXiv Latex 文件做处理之后加到训练数据集。

- 按照 Lewkowycz 等（2022）的方法，删除了the first section 之前的所有内容以及参考文献，
- 从 .tex 文件中删除了注释，
- 对作者编写的定义和宏（definitions and macros written by users）做了内联展开（inline-expand），使得论文更加一致（increase consistency across papers）。

**Stack Exchange [2%]**

Stack Exchange 是一个高质量的问答网站，涵盖了从计算机科学到化学等各种领域。 我们的训练数据集包括了一个 Stack Exchange dump：

- 保留其中最大的 28 个网站的数据，
- 从文本中删除了 HTML tags ，
- 按分数（从高到低）对答案进行了排序。

#### 2.1.2 Tokenizer（分词器）

我们使用 bytepair encoding（BPE）算法（Sennrich 等，2015）对数据进行 tokenization，算法实现采用的是 Sentence-Piece（Kudo 和 Richardson，2018）。需要说明的是，为了分解未知的 UTF-8字符，我们将所有数字拆分为单个 digits，再 fallback到 bytes。

最终，我们的整个训练数据集在 tokenization 后包含大约 **1.4T 个 token**。

- 对于大多数训练数据，每个 token 在训练期间仅使用一次；
- 维基百科和书籍是个例外，会被使用两次（two epochs）。

### 2.2 架构（Architecture）

与最近大语言模型的研究趋势一致，我们的模型网络也基于 Transformer 架构（Vaswani 等，2017），但做了很多改进，也借鉴了其他模型（例如 PaLM）中的一些技巧。

#### 2.2.1 改进

以下是与原始架构的主要差异，

##### 前置归一化（Pre-normalization）：受 GPT3 启发

为了提高训练稳定性，我们对每个 Transformer子层的输入进行归一化，而不是对输出进行归一化。 这里使用了由 Zhang 和 Sennrich（2019）提出的 RMSNorm 归一化函数。

##### SwiGLU 激活函数：受 PaLM 启发

用 SwiGLU 激活函数替换 ReLU 非线性，该函数由 Shazeer（2020）提出，目的是提升性能。 但我们使用的维度是 `2/3 * 4d`，而不是 PaLM 中的 `4d`。

##### 旋转嵌入（Rotary Embeddings）：受 GPTNeo 启发

去掉了绝对位置嵌入（absolute positional embeddings），并在每个网络层中添加旋转位置嵌入（rotary positional embeddings，RoPE）。 RoPE 由 Su 等（2021）提出。

#### 2.2.2 不同 LLaMA 模型的超参数

不同模型的超参数详细信息见表 2。

| params | dimension | n heads | n layers | learning rate | batch size | n tokens |
| :----- | :-------- | :------ | :------- | :------------ | :--------- | :------- |
| 6.7B   | 4096      | 32      | 32       | 3.0e-4        | 4M         | 1.0T     |
| 13.0B  | 5120      | 40      | 40       | 3.0e-4        | 4M         | 1.0T     |
| 32.5B  | 6656      | 52      | 60       | 1.5e-4        | 4M         | 1.4T     |
| 65.2B  | 8192      | 64      | 80       | 1.5e-4        | 4M         | 1.4T     |

表 2： Model sizes, architectures, and optimization hyper-parameters.

### 2.3 优化器（Optimizer）

- 使用了 AdamW 优化器（Loshchilov 和 Hutter，2017）对模型进行训练，具体超参数：β1=0.9,β2=0.95；
- 使用了一个 cosine learning rate schedule，最终的学习率达到了最大学习率的 10％；
- 使用了 0.1 的权重衰减（weight decay）和 1.0 的梯度裁剪（gradient clipping）；
- 使用了 2,000 个 warmup steps，并根据模型大小来调整 learning rate 和 batch size。

### 2.4 高效实现（Efficient implementation）：提高训练速度

我们进行了几项优化来提高模型的训练速度。

首先，我们使用 **causal multi-head attention** 的一个高效实现来**减少内存占用和运行时**。 这种实现是受 Rabe 和 Staats（2021）的启发，并使用了 Dao 等（2022）的反向传播，现在 [xformers 库](https://github.com/facebookresearch/xformers) 中已经提供了。 优化原理：由于语言建模任务存在因果特性，因此可以不存储注意力权重（attention weights），不计算那些已经被掩码（masked）的 key/query 得分。

为进一步提高训练效率，我们通过 **checkpoint** 技术， 减少了在反向传播期间需要重新计算的激活数量。更具体地说：

- 我们保存了计算成本高昂的激活，例如线性层的输出。实现方式是**手动实现 Transformer 层的反向函数**，而不用 PyTorch autograd。
- 如 Korthikanti 等（2022）中提到的， 为了充分受益于这种优化，我们需要通过模型和序列并行（model and sequence parallelism）来**减少模型的内存使用**。
- 此外，我们还尽可能地 overlap 激活计算和 GPU 之间的网络通信（由于 all_reduce 操作）。

训练 65B 参数的模型时，我们的代码在 **2048 个 A100 80GB GPU** 上能处理约 **380 tokens/秒/GPU**。这意味着 1.4T token 的数据集上训练大约需要 **21 天**。

## 3 主要结果（Main results）

参考前人工作（Brown 等，2020），我们测试了**零样本（zero-shot）和少样本（few-shot）**两种任务， 进行总共 20 个基准测试：

- 零样本：提供任务的文本描述和一个测试示例。模型可以使用开放式生成（open-ended generation）提供答案，或对提议的答案进行排名。
- 少样本：提供一些（1~64 个）任务示例和一个测试示例。模型将此文本作为输入并生成答案，或对不同选项进行排名。

我们将 LLaMA 与其他基础模型进行比较，包括

- 未开源模型：GPT-3（Brown 等，2020）、Gopher（Rae 等，2021）、Chinchilla（Hoffmann 等，2022）和 PaLM（Chowdhery 等，2022），
- 开源模型：OPT 模型（Zhang 等，2022）、GPT-J（Wang 和 Komatsuzaki，2021）和 GPTNeo（Black 等，2022）。
- 在第 4 节中，我们还将简要比较 LLaMA 与 instruction-tuned 模型，如 OPT-IML（Iyer 等，2022）和 Flan-PaLM（Chung 等，2022）。

我们在自由形式生成任务（free-form generation）和多项选择（multiple choice）任务上评估 LLaMA。 多项选择任务的目标是在提供的上下文基础上，从一组给定选项中选择最合适的。我们使用的最合适标准就是可性能最高（highest likelihood）。

- 对于大部分数据集，我们遵循 Gao 等（2021）的方法，使用由完成字符数归一化的可能性（likelihood normalized by the number of characters），
- 对于少量数据集（OpenBookQA，BoolQ），我们遵循 Brown 等（2020）的方法，根据在“Answer:”上下文中给定的完成可能性（likelihood of the completion given “Answer:” as context），用公式表示就是 **P(completion|context) / P(completion|"Answer:")**.

### 3.1 常识推理（Common Sense Reasoning）

使用下面八个标准的常识推理基准测试：

1. BoolQ（Clark 等，2019）
2. PIQA（Bisk 等，2020）
3. SIQA（Sap 等，2019）
4. HellaSwag（Zellers 等，2019）
5. WinoGrande（Sakaguchi 等，2021）
6. OpenBookQA（Mihaylov 等，2018）
7. & 8. ARC easy 和 challenge（Clark 等，2018）

这些数据集包括 Cloze 和 Winograd 风格的任务，以及多项选择题。与语言建模社区类似，我们使用零样本设置进行评估。在表 3 中，我们与各种规模的现有模型进行比较。

![表 3：Zero-shot performance on Common Sense Reasoning tasks](https://arthurchiao.art/assets/img/llama-paper/table-3.png)

几点说明：

- 除了 BoolQ，LLaMA-65B 在其他所有基准测试都优于 Chinchilla-70B。
- 同样，该模型在除了 BoolQ 和 WinoGrande 之外的所有地方都超过了 PaLM-540B。
- LLaMA-13B 模型尽管比 GPT-3 小了 90％ 多，但在大多数基准测试中表现比 GPT-3 还好。

### 3.2 闭卷问答（Closed-book Question Answering）

我们将 LLaMA 与现有的大语言模型进行比较，在两个闭卷问答基准测试：

1. 自然问题（Kwiatkowski 等，2019）
2. TriviaQA（Joshi 等，2017）。

对于这两个基准测试，在相同设置下（例如，模型不能访问那些有助于回答问题的文档）， 取得了完全相同的性能。 表 4 和表 5 分别是在这两个 benchmark 上的结果：

![表 4：NaturalQuestions. Exact match performance](https://arthurchiao.art/assets/img/llama-paper/table-4.png)

![表 5：TriviaQA. Zero-shot and few-shot exact match performance on the filtered dev set](https://arthurchiao.art/assets/img/llama-paper/table-5.png)

在这两个基准测试中，LLaMA-65B 在零样本和少样本设置中都实现了 state-of-the-arts 的性能。 更重要的是，LLaMA-13B 在这些基准测试中与 GPT-3 和 Chinchilla 相比也具有竞争力，尽管参数只有后者的 10%~20％（5-10 smaller）。 在推理场景，**LLaMA-13B 能在单个 V100 GPU** 上运行。

### 3.3 阅读理解（Reading Comprehension）

阅读理解能力测试基于 “RACE 阅读理解基准测试”（Lai 等，2017）。 这个数据集是从**为中国初中和高中生设计的英文阅读理解考试**中收集的。 一些设置遵循 Brown 等（2020），测试结果见表 6，

![表 6：阅读理解能力测试。Zero-shot accuracy](https://arthurchiao.art/assets/img/llama-paper/table-6.png)

在这些基准测试中，LLaMA-65B 与 PaLM-540B 相当，而 LLaMA-13B 比 GPT-3 好几个百分点。

### 3.4 数学推理（Mathematical reasoning）

在两个数学推理基准测试上评估模型：

1. MATH（Hendrycks 等，2021）：一个包含 12K 个初中和高中数学问题的数据集，LaTeX 格式；
2. GSM8k（Cobbe 等，2021）：一个初中数学问题集。

表 7 比较了 PaLM 和 Minerva（Lewkowycz 等，2022）进行比较。

![表 7：量化推理数据集（quantitative reasoning datasets）上的模型性能](https://arthurchiao.art/assets/img/llama-paper/table-7.png)

- Minerva 是一系列在 ArXiv 和 Math Web Pages 中提取的 38.5B token 上 finetune 而成的 PaLM 模型。
- PaLM 和 LLaMA 都没有在数学数据上进行 finetune 。

PaLM 和 Minerva 的性能数字取自 Lewkowycz 等（2022），我们分别用和不用 maj1@k 进行了比较。 maj1@k 表示我们为每个问题生成 k 个样本，并进行多数投票（Wang 等，2022）。

在 GSM8k 上，可以看到 LLaMA-65B 优于 Minerva-62B，尽管它没有在数学数据上进行微调。

### 3.5 代码生成（Code generation）

评估模型从给出的自然语言描述来生成代码的能力，使用了两个基准测试：

1. HumanEval（Chen 等，2021）
2. MBPP（Austin 等，2021）

这两个测试，都是给模型几句关于程序的描述，以及一些输入输出示例。

在表 8 中，我们将 LLaMA 的 pass@1 得分与未在代码上进行微调的现有语言模型进行了比较，即 PaLM 和 LaMDA（Thoppilan 等，2022）。 PaLM 和 LLaMA 是在包含相似数量的代码 token 的数据集上训练的。

![表8：代码生成的模型表现](https://arthurchiao.art/assets/img/llama-paper/table-8.png)

如表 8 所示：

- 对于类似数量的参数，LLaMA 优于其他一般模型，如 LaMDA 和 PaLM，它们没有专门针对代码进行训练或微调。
- LLaMA 具有 13B 参数及以上，在 HumanEval 和 MBPP 上均优于 LaMDA 137B。
- LLaMA 65B 也优于 PaLM 62B，即使它的训练时间更长。

> 本表中 pass@1 结果是通过 temperature=0.1 采样得到的。 pass@100 和 pass@80 指标是通过 temperature=0.8 获得的。 我们使用与 Chen 等（2021）相同的方法来获得 pass@k 的无偏估计。

通过在代码特定 token 上进行微调，可以提高生成代码的性能。例如，

- PaLM-Coder（Chowdhery 等，2022）将 PaLM 在 HumanEval 上的 pass@1 分数从 PaLM 的 26.2％提高到 36％。
- 其他专门针对代码进行训练的模型在这些任务上也表现比通用模型更好（Chen 等，2021; Nijkamp 等，2022; Fried 等，2022）。

在代码 token 上进行微调超出了本文的范围。

### 3.6 大规模多任务语言理解（Massive Multitask Language Understanding）

大规模多任务语言理解基准测试（MMLU）由 Hendrycks 等（2020）提出， 包括涵盖人文、STEM 和社会科学等各种知识领域的多项选择题。 我们在 5-shot 设置下使用基准测试提供的示例来评估我们的模型，结果如表 9 所示，

![表9：Massive Multitask Language Understanding (MMLU). Five-shot accuracy](https://arthurchiao.art/assets/img/llama-paper/table-9.png)

可以看到，LLaMA-65B 落后于 Chinchilla-70B 和 PaLM-540B 几个百分点，并且在大部分领域都是如此。 一个可能的解释是我们在预训练数据中使用了有限数量的书籍和学术论文，即 ArXiv、Gutenberg 和 Books3，总共只有 **177GB**， 而后两个模型是在多达 **2TB** 的书籍上进行训练的。 Gopher、Chinchilla 和 PaLM 使用的大量书籍可能也解释了为什么 Gopher 在这个基准测试中表现优于 GPT-3，而在其他基准测试中表现只是差不多。

### 3.7 训练过程中性能的变化

在训练过程中，我们跟踪了 LLaMA 在一些问题回答和常识基准测试上的性能，如图 2，

![图 2：Evolution of performance on question answering and common sense reasoning during training](https://arthurchiao.art/assets/img/llama-paper/figure-2.png)

在大多数基准测试中，性能随着 token 数量稳步提高，并与模型的训练困惑度(training perplexity)相关（见图 1）。

![图 1：Training loss over train tokens for the 7B, 13B, 33B, and 65 models. LLaMA-33B and LLaMA- 65B were trained on 1.4T tokens. The smaller models were trained on 1.0T tokens. All models are trained with a batch size of 4M tokens](https://arthurchiao.art/assets/img/llama-paper/figure-1.png)

SIQA 和 WinoGrande 是例外。

- 特别是在 SIQA 上，我们观察到性能变化很大，这可能表明这个基准测试不可靠；
- 在 WinoGrande 上，性能与训练困惑度的相关性不太好：LLaMA-33B 和 LLaMA-65B 在训练期间的性能相似。

## 4 指令微调（Instruction Finetuning）

在本节中，我们将说明简单地在指令数据上进行微调，就会迅速提高在 MMLU 上的性能。

尽管 LLaMA-65B 的未微调版本已经能够 follow 基本指令，但我们观察到进行一点微调可以提高在 MMLU 上的性能， 并能进一步提高模型 follow 指令的能力。 由于这不是本文的重点，我们只进行了一次实验，遵循 Chung 等（2022）的相同协议来训练一个指令模型 LLaMA-I。 LLaMA-I 在 MMLU 上的结果见表 10，与当前中等规模的指令微调模型 OPT-IML（Iyer 等，2022）和 Flan-PaLM 系列（Chung 等，2022）进行了比较：

![表 10：Instruction finetuning – MMLU (5-shot). Comparison of models of moderate size with and without instruction finetuning on MMLU](https://arthurchiao.art/assets/img/llama-paper/table-10.png)

尽管这里使用的指令微调方法很简单，但我们在 MMLU 上达到了 68.9％。 LLaMA-I（65B）在 MMLU 上优于现有的中等规模指令微调模型，但仍远远落后于最先进的 GPT code-davinci-002 在 MMLU 上的 77.4（数字来自 Iyer 等（2022））。

## 5 偏差，毒性和错误信息

大型语言模型已被证明能够复制和放大训练数据中存在的偏见（Sheng等，2019年；Kurita等，2019年），并生成有毒或冒犯性的内容（Gehman等，2020年）。由于我们的训练数据集包含大量来自网络的数据，我们认为确定我们的模型生成此类内容的潜力至关重要。为了了解LLaMA-65B的潜在危害，我们在测量有毒内容产生和刻板印象检测的不同基准上进行评估。虽然我们选择了一些语言模型社区用于指示这些模型存在问题的标准基准，但这些评估并不足以完全理解与这些模型相关的风险。

### 5.1 真实的有毒提示(RealToxicityPrompts包含约100k个提示)

语言模型可以生成有毒的语言(toxic language)，例如侮辱、仇恨言论或威胁。模型可以生成的有毒内容范围非常广泛，使得进行全面评估具有挑战性。近期的几项研究（Zhang等，2022；Hoffmann等，2022）已将RealToxicityPrompts基准（Gehman等，2020）视为其模型有多毒的指标。

RealToxicityPrompts包含约100k个提示，模型必须完成这些提示；然后通过向PerspectiveAPI 3发送请求自动评估其毒性得分。我们无法控制第三方PerspectiveAPI使用的流程，这使得与先前模型进行比较变得困难。

对于这100k个提示中的每一个，我们使用我们的模型贪婪地生成结果，并测量其毒性得分。每个提示的得分范围从0（非有毒）到1（有毒）。在表11中，我们报告了我们在RealToxicityPrompts的基础和尊重提示类别上的平均得分。这些得分与我们在文献中观察到的是“可比较的”（例如，Chinchilla为0.087），但这些工作和我们的方法（在采样策略、提示数量和API时间方面）存在差异。

![](240101-2.png)

我们观察到，随着模型大小的增加，哪怕是对于要求尊重的提示，毒性也会增加。这也在之前的研究中观察到（Zhang等，2022），但Hoffmann等人（2022）是一个显著的例外，他们并未观察到Chinchilla和Gopher之间有任何差异，尽管大小不同。这可能是由于更大的模型Gopher的性能比Chinchilla差，表明毒性与模型大小之间的关系可能只适用于同一模型系列内。

### 5.2 CrowS-Pairs

我们在CrowS-Pairs（Nangia等，2020）上评估我们模型的偏见。这个数据集允许在9个类别中测量偏见：性别、宗教、种族/肤色、性取向、年龄、国籍、残疾、外貌和社会经济地位。每个示例由一个刻板印象和一个反刻板印象组成，我们使用zero-shot设置中两个句子的困惑度来测量模型对刻板句子的偏好。因此，较高的分数表示较高的偏见。

我们在表12中与GPT-3和OPT-175B进行比较。平均而言，LLaMA与这两个模型相比略有优势。我们的模型在宗教类别中尤其偏见明显（与OPT-175B相比增加了+10%），其次是年龄和性别。我们预计这些偏见来自CommonCrawl，尽管经过了多个过滤步骤。

![表12：CrowS-Pairs。我们将LLaMA-65B、OPT-175B和GPT-3-175B中包含的偏见水平进行了比较。得分越高表示偏见越大。](240101-3.png)

### 5.3 WinoGender

为了进一步研究我们模型在性别类别上的偏见，我们查看了WinoGender基准测试（Rudinger等，2018），这是一个共指解析数据集。WinoGender由Winograd模式组成，通过确定模型的共指解析性能是否受到代词性别的影响来评估偏见。

> 人们为了避免重复，习惯用代词、称谓和缩略语来指代前面提到的实体全称。 例如，在文章开始处会写“哈尔滨工业大学”，后面可能会说“哈工大”、“工大”等，还会提到“这所大学”、“她”等。 这种现象称为共指现象。共指解析的目的就在于自动识别表示同一个实体的名词短语或代词，并将他们归类。

更具体地说，每个句子都有三个提及：一个“职业”、“参与者”和一个“代词”，其中代词要么指代职业，要么指代参与者。我们提示模型确定共指关系，并根据句子的上下文测量它是否正确地这样做。目标是揭示模型是否捕捉到了与职业相关的社会偏见。

例如，WinoGender数据集中的一个句子是：“护士通知病人，他的班次将在一个小时后结束。”，接着是指的是“His”。然后，我们比较护士和病人与模型进行共指解析的续集的困惑度。我们使用3个代词评估性能：“her/her/she”、“his/him/he”和“their/them/someone”（不同的选择对应于代词的语法功能）。

在表13中，我们报告了数据集中包含的三种不同代词的共指得分。我们观察到，我们的模型在为“their/them/someone”代词执行共指解析时明显优于“her/her/she”和“his/him/he”代词。之前的工作（Rae等，2021年；Hoffmann等，2022）也有类似的观察，并可能表明存在性别偏见。

确实，在“her/her/she”和“his/him/he”代词的情况下，模型可能使用职业的大多数性别进行共指解析，而不是使用句子的证据。为了进一步研究这一假设，我们查看了WinoGender数据集中“her/her/she”和“his/him/he”代词的“gotcha”案例集。这些案例对应于代词不匹配职业的大多数性别的句子，而职业是正确答案。

在表13中，我们观察到我们的模型LLaMA-65B在“gotcha”示例上的错误更多，明确显示它捕捉到了与性别和职业相关的社会偏见。无论性别如何，我们的模型在“her/her/she”和“his/him/he”代词上的性能下降，这表明存在偏见。

![表13：WinoGender](240101-4.png)

在表14中，我们报告了我们模型在两个问题上的性能，以测量真实模型和真实性和信息性的交集。与GPT-3相比，我们的模型在两个类别中得分更高，但正确答案的比率仍然很低，显示我们的模型可能会产生错误答案。

![表14：Truthful QA](240101-5.png)

### 5.4 TruthfulQA

TruthfulQA（Lin等，2021）旨在衡量模型的真实性，即其识别某个声明是否真实的能力。Lin等人（2021）考虑了“真实”在“实际世界的字面真实”意义上的定义，而不是只在信仰系统或传统背景下为真的声明。这个基准测试可以评估模型生成错误信息或错误声明的风险。这些问题以多种风格编写，涵盖了38个类别，并且旨在具有对抗性。

## 6 碳足迹（Carbon footprint）

训练 LLaMA 消耗了大量能源，排放了很多二氧化碳。我们遵循最近的文献，将总能耗和产生的碳足迹分解在表 15 中：

![表15：同一数据中心训练不同模型的碳足迹](https://arthurchiao.art/assets/img/llama-paper/table-15.png)

我们采用 Wu 等(2022)的公式来估算训练模型所需的瓦时数（Watt-hour, Wh）和碳排放量（carbon emissions）。对于瓦时数，我们使用以下公式：

```
Wh = GPU-h * (GPU power consumption) * PUE
```

其中，我们的功率使用效率（PUE）为 1.1。 产生的碳排放量取决于用于训练所在的数据中心的位置。例如，

- BLOOM 使用排放 0.057kg CO2eq/KWh 的电网，产生 27吨CO2eq 的排放量，
- OPT 使用排放 0.231kg CO2eq/KWh 的电网，导致 82吨CO2eq 的排放量。

在本研究中，我们感兴趣的是在同一个数据中心的情况下，不同模型训练的碳排放成本。 因此，我们不考虑数据中心的位置，并使用美国国家平均碳强度系数（carbon intensity factor） 0.385kg CO2eq/KWh。 那么此时就有：

```
tCO2eq = MWh * 0:385
```

我们对 OPT 和 BLOOM 采用相同的公式进行公平比较。

- 对于 OPT，我们假设训练需要在 992 个 A100-80GB 上进行 34 天。
- 我们在 **2048 个 A100 80GB 上，用了约 5 个月**时间来开发 LLaMA。 根据前面的公式，计算得到 LLaMA 的训练成本约为 2638 MWh，总排放量为 1015吨的CO2eq。

我们希望 LLaMA 的发布有助于减少未来的碳排放，因为它训练已经完成（很多情况下大家直接用或者进行微调就行了）: 而且其中一些小参数模型可以在单个 GPU 上运行。

## 7 相关工作（Related work）

**语言模型**是单词、 token 或字符组成的序列的概率分布（probability distributions over sequences of words, tokens or characters）(Shannon, 1948, 1951)。

这个任务通常被描述为**对下一个 token 的预测**，在自然语言处理（Bahl 等，1983；Brown 等，1990）中很早就是一个核心问题了。 Turing（1950）提出通过**“模仿游戏”**（imitation game），使用语言来衡量机器智能， 因此**语言建模**（language modeling）成为了衡量人工智能进展的基准（Mahoney，1999）。

### 7.1 架构

传统上，语言模型基于n-gram计数统计（Bahl等，1983），并提出了各种平滑技术来改善对稀有事件的估计（Katz，1987；Kneser和Ney，1995）。在过去的两十年中，神经网络已成功应用于语言建模任务，从前馈模型（Bengio等，2000）、循环神经网络（Elman，1990；Mikolov等，2010）到长短时记忆网络（LSTMs）（Hochreiter和Schmidhuber，1997；Graves，2013）。最近，基于自注意力的Transformer网络带来了重大的改进，尤其是对于捕获长距离依赖关系（Vaswani等，2017；Radford等，2018；Dai等，2019）。

### 7.2 规模化

对于语言模型的规模化，无论是模型还是数据集的大小，都有着悠久的历史。Brants等（2007）展示了使用训练有2万亿(2 trillion)Token后得到的3000亿n-gram的语言模型对机器翻译质量的好处。

虽然这项工作依赖于一个简单的平滑技术，称为Stupid Backoff，但Heafield等（2013）后来展示了如何将Kneser-Ney平滑技术扩展到Web规模的数据。这使得可以从CommonCrawl的9750亿Token中训练一个5-gram模型，从而得到一个有5000亿n-gram的模型（Buck等，2014）。Chelba等（2013）引入了一个名为One Billion Word的基准测试，这是一个大规模的训练数据集，用于衡量语言模型的进展。

在神经语言模型的背景下，Jozefowicz等（2016）通过将LSTMs扩展到10亿参数，在Billion Word基准测试上获得了最新的结果。随后，基于Transformers的扩展模型在许多NLP任务上都有所改进。值得注意的模型包括BERT（Devlin等，2018）、GPT-2（Radford，2019）、Megatron-LM（Shoeybi等，2019）和T5（Raffel等，2020）。

GPT-3（Brown等，2020）是一个有1750亿参数的模型，这是一个重大突破。这导致了一系列大型语言模型的出现，例如Jurassic-1（Lieber等，2021）、Megatron-Turing NLG（Smith等，2022）、Gopher（Rae等，2021）、Chinchilla（Hoffmann等，2022）、PaLM（Chowdhery等，2022）、OPT（Zhang等，2022）和GLM（Zeng等，2022）。

Hestness等（2017）和Rosenfeld等（2019）研究了规模化对深度学习模型性能的影响，显示了模型和数据集大小与系统性能之间存在的幂律关系。Kaplan等（2020）专门为基于Transformer的语言模型导出了幂律，这些幂律后来由Hoffmann等（2022）通过在扩展数据集时调整学习率表进行了进一步的细化。最后，Wei等（2022）研究了规模化对大型语言模型能力的影响。

## 8 总结

在本文中，我们介绍了一系列公开发布的语言模型，并与最先进的基础模型竞争。尤其值得注意的是，LLaMA-13B的性能超过了GPT-3，而其大小只有GPT-3的十分之一多。而LLaMA-65B与Chinchilla-70B和PaLM-540B处于竞争地位。

与之前的研究不同，我们展示了仅使用公开可用的数据进行训练即可实现最先进的性能，而无需求助于专有数据集。我们希望将这些模型发布给研究社区，这将加速大型语言模型的发展，并帮助改进其稳健性以及缓解已知问题，如毒性和偏见。

此外，我们观察到，与Chung等人（2022年）类似，对这些模型进行指令微调会带来有希望的结果，我们计划在未来的工作中进一步研究这一点。最后，鉴于我们在规模化过程中不断提高性能，我们计划在未来发布使用更大的预训练语料库训练的更大型的模型。

2024/1/1 于苏州家中