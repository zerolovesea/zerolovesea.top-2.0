---
title: '详解Mixtral 8*7B: 高质量的专家组合模型'
date: 2023-12-30 10:46:19
tags: 
	- LLM
	- NLP
categories: LLM
excerpt: Mistral AI团队带来的开源新模型，以更小的参数量超过了LLama2 70B。
index_img: "/img/mixtral.jpg"
---

2023年12月8日，来自欧洲的团队Mistral AI团队发布了他们的新开源模型：Mixtral 8x7B。他们发布的方式也是别具一格，直接甩出一条87G文件的磁力链接。
![](231230-1.png)

值得一提的是，这家位于巴黎的公司上一次发布的Mistral 7B模型，也是直接发的磁力链接，并且把LLama2 13B作为基准碾压了一遍。

# 模型架构
Mixtral采用了SMoE(稀疏混合专家模型)架构，把原来的前馈层改成了一个路由网络，用来给8个并行的子层进行分配Token。这里的子层就被称为专家。由于运行时不是所有参数都会进行推理，因此这个架构被称为稀疏架构，这也是名字中S(Sparse)的由来。

![](231230-2.png)

Mixtral共拥有8个专家，每个专家参数为7B。由于存在共享参数，模型的总参数为47B而非56B。

{% note success %}
其实由上你也可以看出来，这个架构解决的主要还是推理速度，而非显存占用，因为47B参数在运行时依旧需要先加载进入显存。
{% endnote %}

![模型具体架构](231230-3.png)

# 原文翻译

由于Mixtral 8x7B目前还没有发布论文，我们可以解读一下团队发布的博客。

***

Mistral AI 继续履行着它创立以来的使命，为开发者社区提供最佳的开源模型。人工智能的发展需要采取新的技术转向，而不是重复使用众所周知的架构和训练范式。最重要的是，它应该让社区能从原始模型中受益，以促进新的发明和使用。

今天，我们自豪地发布了 Mixtral 8x7B，这是一个高质量稀疏专家混合模型 （SMoE），且权重已经开源 。该模型的许可证是Apache 2.0 。Mixtral 在大多数基准测试中的表现优于 Llama 2 70B，且**推理速度提高了 6 倍**。它是目前的最强开源模型，也是成本/性能权衡方面整体上的最佳模型。重点是，它在大多数标准基准测试上都与 GPT3.5 相当或优于 GPT3.5。

Mixtral 具有以下特性：
- 它能够处理 32k Token的上下文。
- 它能够处理英语、法语、意大利语、德语和西班牙语。
- 它在代码生成方面性能强大。
- 通过对它进行微调，转换为指令遵循(instruaction-following)模型，在 MT-Bench 上能达到 8.3 分。

## 走在推广稀疏架构的开源模型的前沿

Mixtral 是一个稀疏的专家混合网络(sMoE, sparse mixture-of-experts)。这是一种仅解码器(decoder-only)模型，其中前馈模块(Feed Forward，即全连接层)从一组 8 组不同的参数中进行选择。在每一层，对于每个Token，有一个路由(Router)网络都会选择其中8组参数中的两个组（也就是“专家”）来处理Token并将其的输出进行累加组合。

这种技术在增加了参数数量的情况下，控制了成本和延迟，因为模型只需要使用每个Token参数集中总数的一小部分。具体来说，Mixtral 有 46.7B 的总参数，但每个Token只使用 12.9B 参数。因此它的推理速度应当与 12.9B 模型相同。

Mixtral 使用从开放网络中提取的数据进行预训练——这一过程中将同时训练“专家”和“路由”。

## 性能

我们将 Mixtral 与 Llama 2 系列和 GPT3.5 基本型号进行了比较。在大多数基准测试中，Mixtral 都达到或优于 Llama 2 70B 和 GPT3.5。
![](231230-4.png)

在下图中，我们衡量了模型质量与推理预算的权衡。与 Llama 7 型号相比，Mistral 8B 和 Mixtral 8x7B 属于更高效的模型。

![](231230-5.png)

下表给出了上图的详细结果。

![](231230-6.png)

## 模型幻觉和偏见
为了识别可能通过微调/偏好建模来纠正的缺陷，我们在BBQ/BOLD上评估了基本模型的性能。

![](231230-7.png)

与 Llama 2 相比，Mixtral 在 BBQ 基准测试上的偏差较小。总体而言，Mixtral 在 BOLD 上表现出比 Llama 2 更积极的情绪，且每个维度的差异都较一致，不存在偏科的情况。

## 语言
Mixtral 8x7B 精通法语、德语、西班牙语、意大利语和英语。

![](231230-8.png)

## 指导模型

我们发布了 Mixtral 8x7B Instruct 和 Mixtral 8x7B。它们通过监督微调和直接偏好优化 （DPO） 进行了优化，以便仔细遵循人类给出的指令。在 MT-Bench 上，它的得分达到了 8.30，使其成为当前最好的开源模型，性能可与 GPT3.5 相媲美。


## 使用开源部署堆栈部署 Mixtral

为了使社区能够使用完全开源的堆栈运行 Mixtral，我们提交了对 vLLM 项目的更改，该项目集成了 Megablocks CUDA 内核以实现高效推理。

# 关于Mistral AI

写博客的时候搜了一下这家公司。Mistral AI来自巴黎，团队成员大多来自于Google，Meta，HuggingFace。他们中的大部分都是从事AI行业多年的大佬。Mistral AI的上一个7B模型就已经获得了社区非常好的反响，基准测试中超过了LLama2 34B。

{% gi 3 3 %}
![](231230-9.png)
![](231230-11.png)

{% endgi %}

在人工智能成为风口的当下，这家公司在六个月内就筹集了1.12亿美元的融资，且A轮融资已经筹集了3.85亿欧元，这也让Mistral AI的估值达到约20亿美元，自6月份首次亮相以来，其估值已增长超过七倍，成为欧洲最成功的大模型公司。

公司的核心创始人是Arthur Mensch(CEO), Timothée Lacroix(CTO)和Guillaume Lample（Chief Scientist)，CEO来自于Google DeepMind，后两者都来自于MetaAI，且均在LLama模型中做出了重大贡献。



# 使用QLoRA对Mixtral模型微调
参考了一些示例代码，写了下微调的示例代码。

```python
# 导入库
import torch
from datasets import load_dataset
from peft import LoraConfig, PeftModel, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    AutoTokenizer,
    TrainingArguments
)
from trl import SFTTrainer
```

```python
model_name = "mistralai/Mixtral-8x7B-v0.1"

# 设置Tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_name, add_eos_token=True, use_fast=True)
tokenizer.pad_token = tokenizer.unk_token
tokenizer.pad_token_id =  tokenizer.unk_token_id
tokenizer.padding_side = 'left'
```

```python
# 设置数据集
def format_ultrachat(ds):
  text = []
  for row in ds:
    if len(row['messages']) > 2:
      text.append("### Human: "+row['messages'][0]['content']+"### Assistant: "+row['messages'][1]['content']+"### Human: "+row['messages'][2]['content']+"### Assistant: "+row['messages'][3]['content'])
    else: #not all tialogues have more than one turn
      text.append("### Human: "+row['messages'][0]['content']+"### Assistant: "+row['messages'][1]['content'])
  ds = ds.add_column(name="text", column=text)
  return ds
dataset_train_sft = load_dataset("HuggingFaceH4/ultrachat_200k", split="train_sft")
dataset_test_sft = load_dataset("HuggingFaceH4/ultrachat_200k", split="test_sft[:5%]")

dataset_test_sft = format_ultrachat(dataset_test_sft)
dataset_train_sft = format_ultrachat(dataset_train_sft)
```

```python
# 导入模型和量化参数
compute_dtype = getattr(torch, "float16")
bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=compute_dtype,
        bnb_4bit_use_double_quant=True,
)
model = AutoModelForCausalLM.from_pretrained(
          model_name, quantization_config=bnb_config, device_map={"": 0}
)
model = prepare_model_for_kbit_training(model)

#Configure the pad token in the model
model.config.pad_token_id = tokenizer.pad_token_id
model.config.use_cache = False # Gradient checkpointing is used by default but not compatible with caching
```

```python
peft_config = LoraConfig(
        lora_alpha=64,
        lora_dropout=0.1,
        r=16,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules= ['k_proj', 'q_proj', 'v_proj', 'o_proj']
)
```

```python
# 设置训练参数
training_arguments = TrainingArguments(
        output_dir="./results_mixtral_sft/",
        evaluation_strategy="steps",
        do_eval=True,
        optim="paged_adamw_8bit",
        per_device_train_batch_size=8,
        gradient_accumulation_steps=2,
        per_device_eval_batch_size=8,
        log_level="debug",
        save_steps=50,
        logging_steps=50,
        learning_rate=2e-5,
        eval_steps=50,
        max_steps=300,
        warmup_steps=30,
        lr_scheduler_type="linear",
)
```

```python
# 开始训练
trainer = SFTTrainer(
        model=model,
        train_dataset=dataset_train_sft,
        eval_dataset=dataset_test_sft,
        peft_config=peft_config,
        dataset_text_field="text",
        max_seq_length=512,
        tokenizer=tokenizer,
        args=training_arguments,
)

trainer.train()
```

```python
# 模型测试
text = "Hello my name is"
inputs = tokenizer(text, return_tensors="pt")

outputs = model.generate(**inputs, max_new_tokens=20)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))

# 模型保存
new_model = 'yang_zhou/mixtral'
trainer.model.save_pretrained(new_model)

del model, trainer
torch.cuda.empty_cache()

# 重新加载模型
model_reload = AutoModelForCausalLM.from_pretrained(
          model_name, quantization_config=bnb_config, device_map={"": 0}
)
model = PeftModel.from_pretrained(model_reload, new_model)

# 合并模型
output_path = 'yang_zhou/mixtral/ft_model'
model = model.merge_and_unload()
model.save_pretrained(output_path)
```

2023/12/30 于昆山

