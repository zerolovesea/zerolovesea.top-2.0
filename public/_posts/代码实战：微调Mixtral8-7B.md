---
title: 代码实战：微调Mixtral8*7B
date: 2024-01-11 20:12:14
tags:
  - LLM
  - 代码实战
  - NLP
categories: LLM
excerpt: 基于Transformer库实现的Mixtral8x7B的微调代码。
index_img: "/img/mixtral.jpg"
---
这篇是Mixtral8x7B的微调代码实战，之前的博文中有写过，不过写的不是很好，这次单独再开一篇。

注意：微调需要A100的显卡。

# 安装依赖

首先安装依赖包：

```python
!pip install transformers trl accelerate torch bitsandbytes peft datasets -qU
!pip install flash-attn --no-build-isolation
```

这里的flash attention是一个重要的东西，先挖个坑，之后研究一下。

# 导入数据集

我们需要导入数据集，这里数据集来自Hugging Face。

```python
from datasets import load_dataset

instruct_tune_dataset = load_dataset("mosaicml/instruct-v3")
instruct_tune_dataset
```

```
DatasetDict({
    train: Dataset({
        features: ['prompt', 'response', 'source'],
        num_rows: 56167
    })
    test: Dataset({
        features: ['prompt', 'response', 'source'],
        num_rows: 6807
    })
})
```

可以看到，数据集由三个部分组成：prompt，response，source。愿意的话可以打印一下看看：

```python
for i in range(2):
  print(instruct_tune_dataset['train']['prompt'][i])
  print('---'*3)
```

# 数据预处理

对于Mixtral模型，数据集需要按照以下格式准备：

``` 
<s>[INST] Use the provided input to create an instruction that could have been used to generate the response with an LLM.

{input} [/INST]

{response}</s>
```

而我们已有的数据集长这样：

```python
instruct_tune_dataset["train"][0]
```

```
{'prompt': 'Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n### Instruction\nWhat are different types of grass?\n\n### Response\n',
 'response': 'There are more than 12,000 species of grass. The most common is Kentucky Bluegrass, because it grows quickly, easily, and is soft to the touch. Rygrass is shiny and bright green colored. Fescues are dark green and shiny. Bermuda grass is harder but can grow in drier soil.',
 'source': 'dolly_hhrlhf'}
```

定义一个处理的函数：

```python
def create_prompt(sample):
    bos_token = "<s>"
    original_system_message = "Below is an instruction that describes a task. Write a response that appropriately completes the request."
    system_message = "[INST]Use the provided input to create an instruction that could have been used to generate the response with an LLM."
    response = sample["prompt"].replace(original_system_message, "").replace("\n\n### Instruction\n", "").replace("\n### Response\n", "").strip()
    input = sample["response"]
    eos_token = "</s>"
    full_prompt = bos_token + system_message + "\n" + input + "[/INST]" + response + eos_token

    return {"full_prompt": full_prompt}
```

拿之前的数据测试一下：

```python
create_prompt(instruct_tune_dataset["train"][0])
```

```
'<s>[INST]Use the provided input to create an instruction that could have been used to generate the response with an LLM.\nThere are more than 12,000 species of grass. The most common is Kentucky Bluegrass, because it grows quickly, easily, and is soft to the touch. Rygrass is shiny and bright green colored. Fescues are dark green and shiny. Bermuda grass is harder but can grow in drier soil.[/INST]What are different types of grass?</s>'
```

最后对数据集做个映射：

```python
mapped_data = instruct_tune_dataset.map(create_prompt)
```

# 加载模型

``` python
model_id = "mistralai/Mixtral-8x7B-v0.1"

from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

nf4_config = BitsAndBytesConfig(
   load_in_4bit=True,
   bnb_4bit_quant_type="nf4",
   bnb_4bit_use_double_quant=True,
   bnb_4bit_compute_dtype=torch.bfloat16
) # 量化参数

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map='auto',
    quantization_config=nf4_config,
    use_cache=False,
    attn_implementation="flash_attention_2"

) 

tokenizer = AutoTokenizer.from_pretrained(model_id)

tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"
```

先写一个生成回复的方法：

```python
def generate_response(prompt, model):
    encoded_input = tokenizer(prompt,  return_tensors="pt", add_special_tokens=True)
    model_inputs = encoded_input.to('cuda')

    generated_ids = model.generate(
  **model_inputs,
  max_new_tokens=512,
  do_sample=True, 
  pad_token_id=tokenizer.eos_token_id)

    decoded_output = tokenizer.batch_decode(generated_ids)

    return decoded_output[0].replace(prompt, "")
  
  
prompt="""[INST]Use the provided input to create an instruction that could have been used to generate the response with an LLM. \nThere are more than 12,000 species of grass. The most common is Kentucky Bluegrass, because it grows quickly, easily, and is soft to the touch. Rygrass is shiny and bright green colored. Fescues are dark green and shiny. Bermuda grass is harder but can grow in drier soil.[\INST]"""

generate_response(prompt, model)
```
# Tokenization

下面需要对输入的训练数据集做分词：

```python
def tokenize_prompts(prompt):
    return tokenizer(prompt)

tokenized_train_dataset = mapped_data["train"].map(tokenize_prompts)
tokenized_val_dataset = mapped_data["test"].map(tokenize_prompts)
```

# 模型架构

```python
print(model)
```

```
MixtralForCausalLM(
  (model): MixtralModel(
    (embed_tokens): Embedding(32000, 4096)
    (layers): ModuleList(
      (0-31): 32 x MixtralDecoderLayer(
        (self_attn): MixtralFlashAttention2(
          (q_proj): Linear4bit(in_features=4096, out_features=4096, bias=False)
          (k_proj): Linear4bit(in_features=4096, out_features=1024, bias=False)
          (v_proj): Linear4bit(in_features=4096, out_features=1024, bias=False)
          (o_proj): Linear4bit(in_features=4096, out_features=4096, bias=False)
          (rotary_emb): MixtralRotaryEmbedding()
        )
        (block_sparse_moe): MixtralSparseMoeBlock(
          (gate): Linear4bit(in_features=4096, out_features=8, bias=False)
          (experts): ModuleList(
            (0-7): 8 x MixtralBLockSparseTop2MLP(
              (w1): Linear4bit(in_features=4096, out_features=14336, bias=False)
              (w2): Linear4bit(in_features=14336, out_features=4096, bias=False)
              (w3): Linear4bit(in_features=4096, out_features=14336, bias=False)
              (act_fn): SiLU()
            )
          )
        )
        (input_layernorm): MixtralRMSNorm()
        (post_attention_layernorm): MixtralRMSNorm()
      )
    )
    (norm): MixtralRMSNorm()
  )
  (lm_head): Linear(in_features=4096, out_features=32000, bias=False)
)
```

# 设置训练参数

需要设置一下训练必须的参数：

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

peft_config = LoraConfig(
    lora_alpha=16,
    lora_dropout=0.1,
    r=64,
    bias="none",
    target_modules=[
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
        "lm_head",
    ],
    task_type="CAUSAL_LM"
)

model = prepare_model_for_kbit_training(model) # 用来使得模型能够训练在4Bits精度
model = get_peft_model(model, peft_config)
```

打印一下可训练参数数量。

```python
def print_trainable_parameters(model):
    """
    Prints the number of trainable parameters in the model.
    """
    trainable_params = 0
    all_param = 0
    for _, param in model.named_parameters():
        all_param += param.numel()
        if param.requires_grad:
            trainable_params += param.numel()
    print(
        f"trainable params: {trainable_params} || all params: {all_param} || trainable%: {100 * trainable_params / all_param}"
    )
    
print_trainable_parameters(model)
```

```
trainable params: 56836096 || all params: 23539437568 || trainable%: 0.24145052674182907
```

# 设置训练超参数

还可以设置一些训练超参数：

`num_train_epochs/max_steps`: 数据迭代次数，如果过高会造成过拟合。

```python
if torch.cuda.device_count() > 1: # If more than 1 GPU
    print(torch.cuda.device_count())
    model.is_parallelizable = True
    model.model_parallel = True
```

```python
from transformers import TrainingArguments

args = TrainingArguments(
  output_dir = "Mixtral_Alpace_v2",
  #num_train_epochs=5,
  max_steps = 1000, # 可以选择num_train_epochs或者按steps进行训练
  per_device_train_batch_size = 32,
  warmup_steps = 0.03,
  logging_steps=10,
  save_strategy="epoch",
  #evaluation_strategy="epoch",
  evaluation_strategy="steps",
  eval_steps=10, # 默认是每轮都会评估，也可以自定义设置
  learning_rate=2.5e-5,
  bf16=True,
  # lr_scheduler_type='constant',
)
```

最后设置一下SFTTrainer。

```python
from trl import SFTTrainer

max_seq_length = 1024

trainer = SFTTrainer(
  model=model,
  peft_config=peft_config,
  max_seq_length=max_seq_length,
  tokenizer=tokenizer,
  packing=True,
  formatting_func=create_prompt, # 这个会自动对原始数据集做映射处理，也就是之前的操作可以省略
  args=args,
  train_dataset=instruct_tune_dataset["train"],
  eval_dataset=instruct_tune_dataset["test"]
)

trainer.train() # 开始训练
```

训练完毕后记得保存模型：

```python
trainer.save_model("Mixtral_V2")
```

# 模型合并

可以通过`merge_and_unload`方法进行合并。

```python
merged_model = model.merge_and_unload()
```

最后可以再使用新模型推理一下：

```python
prompt = "[INST]Use the provided input to create an instruction that could have been used to generate the response with an LLM.\nThere are more than 12,000 species of grass. The most common is Kentucky Bluegrass, because it grows quickly, easily, and is soft to the touch. Rygrass is shiny and bright green colored. Fescues are dark green and shiny. Bermuda grass is harder but can grow in drier soil.[/INST]"

generate_response(prompt, merged_model)
```

2024/1/11 于苏州家中
