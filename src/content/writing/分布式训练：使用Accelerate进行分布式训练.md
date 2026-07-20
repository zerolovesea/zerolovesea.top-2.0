---
title: "分布式训练：使用Accelerate进行分布式训练"
description: "分布式数据并行的介绍。"
pubDate: "2024-05-2 16:09:09"
---

Accelerate是HuggingFace发布的Pytorch高级库，主要是封装了Pytorch当中训练部分的模块。在之前的了解中，我们了解了Pytorch中包含了大量的分布式训练API，如何灵活的调用他们需要费时费力去记忆，为此Accelerate提供了统一的接口，来配置分布式训练参数。

先看看官方的示例：

```python
from accelerate import Accelerator

# 实例化加速器
accelerator = Accelerator()

# 准备一下模型/优化器/dataloader等
model, optimizer, training_dataloader, scheduler = accelerator.prepare(
     model, optimizer, training_dataloader, scheduler)

# 开始训练
for batch in training_dataloader:
      optimizer.zero_grad()
      inputs, targets = batch
      inputs = inputs.to(device)
      targets = targets.to(device)
      outputs = model(inputs)
      loss = loss_function(outputs, targets)
      accelerator.backward(loss)
      optimizer.step()
      scheduler.step()
```

可以看到是比较简单易懂的。

# 使用Accelerate进行DDP训练

下面我们用一个实际例子来对比一下使用Accelerate和不使用的区别。我们使用一个文本分类任务来进行训练。首先是不使用加速库的情况：

我们的数据集示例如下：

```bash
label,review
1,"距离川沙公路较近,但是公交指示不对,如果是""蔡陆线""的话,会非常麻烦.建议用别的路线.房间较为简单."
1,商务大床房，房间很大，床有2M宽，整体感觉经济实惠不错!
```

先是准备一下Dataset和DataLoader：


```python
import os
import torch
import pandas as pd
from torch.optim import Adam
import torch.distributed as dist
from torch.utils.data import Dataset
from torch.utils.data import DataLoader
from torch.utils.data import random_split
from torch.utils.data.distributed import DistributedSampler
from torch.nn.parallel import DistributedDataParallel as DDP
from transformers import BertTokenizer, BertForSequenceClassification


class MyDataset(Dataset):

    def __init__(self) -> None:
        super().__init__()
        self.data = pd.read_csv("./ChnSentiCorp_htl_all.csv")
        self.data = self.data.dropna()

    def __getitem__(self, index):
        return self.data.iloc[index]["review"], self.data.iloc[index]["label"]
    
    def __len__(self):
        return len(self.data)


def prepare_dataloader():

    dataset = MyDataset()

    trainset, validset = random_split(dataset, lengths=[0.9, 0.1], generator=torch.Generator().manual_seed(42))

    tokenizer = BertTokenizer.from_pretrained("/gemini/code/model")

    def collate_func(batch):
        texts, labels = [], []
        for item in batch:
            texts.append(item[0])
            labels.append(item[1])
        inputs = tokenizer(texts, max_length=128, padding="max_length", truncation=True, return_tensors="pt")
        inputs["labels"] = torch.tensor(labels)
        return inputs

    trainloader = DataLoader(trainset, batch_size=32, collate_fn=collate_func, sampler=DistributedSampler(trainset))
    validloader = DataLoader(validset, batch_size=64, collate_fn=collate_func, sampler=DistributedSampler(validset))

    return trainloader, validloader
```

随后准备模型和优化器：

```python
def prepare_model_and_optimizer():
	# 准备模型
    model = BertForSequenceClassification.from_pretrained("/gemini/code/model")

    if torch.cuda.is_available():
        model = model.to(int(os.environ["LOCAL_RANK"]))
	# 使用DDP设置
    model = DDP(model)
    optimizer = Adam(model.parameters(), lr=2e-5)

    return model, optimizer


def print_rank_0(info):
    if int(os.environ["RANK"]) == 0:
        print(info)


def evaluate(model, validloader):
    model.eval()
    acc_num = 0
    with torch.inference_mode():
        for batch in validloader:
            if torch.cuda.is_available():
                batch = {k: v.to(int(os.environ["LOCAL_RANK"])) for k, v in batch.items()}
            output = model(**batch)
            pred = torch.argmax(output.logits, dim=-1)
            acc_num += (pred.long() == batch["labels"].long()).float().sum()
    dist.all_reduce(acc_num)
    return acc_num / len(validloader.dataset)


def train(model, optimizer, trainloader, validloader, epoch=3, log_step=100):
    global_step = 0
    for ep in range(epoch):
        model.train()
        trainloader.sampler.set_epoch(ep)
        for batch in trainloader:
            if torch.cuda.is_available():
                batch = {k: v.to(int(os.environ["LOCAL_RANK"])) for k, v in batch.items()}
            optimizer.zero_grad()
            output = model(**batch)
            loss = output.loss
            loss.backward()
            optimizer.step()
            if global_step % log_step == 0:
                dist.all_reduce(loss, op=dist.ReduceOp.AVG)
                print_rank_0(f"ep: {ep}, global_step: {global_step}, loss: {loss.item()}")
            global_step += 1
        acc = evaluate(model, validloader)
        print_rank_0(f"ep: {ep}, acc: {acc}")

def main():
    dist.init_process_group(backend="nccl")
    trainloader, validloader = prepare_dataloader()
    model, optimizer = prepare_model_and_optimizer()
    train(model, optimizer, trainloader, validloader)


if __name__ == "__main__":
    main()
```

我们使用`touchrun --nproc_per_node=2 ddp.py`来执行这个训练任务。

---



下面使用Accelerate来进行同样的训练：

```python
from accelerate import Accelerator

class MyDataset(Dataset):

    def __init__(self) -> None:
        super().__init__()
        self.data = pd.read_csv("./ChnSentiCorp_htl_all.csv")
        self.data = self.data.dropna()

    def __getitem__(self, index):
        return self.data.iloc[index]["review"], self.data.iloc[index]["label"]
    
    def __len__(self):
        return len(self.data)


def prepare_dataloader():

    dataset = MyDataset()

    trainset, validset = random_split(dataset, lengths=[0.9, 0.1], generator=torch.Generator().manual_seed(42))

    tokenizer = BertTokenizer.from_pretrained("/gemini/code/model")

    def collate_func(batch):
        texts, labels = [], []
        for item in batch:
            texts.append(item[0])
            labels.append(item[1])
        inputs = tokenizer(texts, max_length=128, padding="max_length", truncation=True, return_tensors="pt")
        inputs["labels"] = torch.tensor(labels)
        return inputs
	
    # 数据部分把Sample参数替换成shuffle
    trainloader = DataLoader(trainset, batch_size=32, collate_fn=collate_func, shuffle=True)
    validloader = DataLoader(validset, batch_size=64, collate_fn=collate_func, shuffle=False)

    return trainloader, validloader

def prepare_model_and_optimizer():
    model = BertForSequenceClassification.from_pretrained("/gemini/code/model")
    optimizer = Adam(model.parameters(), lr=2e-5)
    return model, optimizer


def evaluate(model, validloader, accelerator: Accelerator):
    model.eval()
    acc_num = 0
    with torch.inference_mode():
        for batch in validloader:
            output = model(**batch)
            pred = torch.argmax(output.logits, dim=-1)
            # 将所有机器的预测结果进行汇总
            # gather_for_metrics是accelerator的内置方法，用于汇总通信组的信息
            pred, refs = accelerator.gather_for_metrics((pred, batch["labels"]))
            acc_num += (pred.long() == refs.long()).float().sum()
    return acc_num / len(validloader.dataset)


def train(model, optimizer, trainloader, validloader, accelerator: Accelerator, epoch=3, log_step=10):
    global_step = 0
    for ep in range(epoch):
        model.train()
        for batch in trainloader:
            optimizer.zero_grad()
            output = model(**batch)
            loss = output.loss
            accelerator.backward(loss)
            optimizer.step()
            if global_step % log_step == 0:
                # dist.all_reduce(loss, op=dist.ReduceOP.AVG)
                # 将Loss在所有机器上合并取均值，不然不同机器的Loss是不一样的
                # accelerator提供了同样的包装
                loss = accelerator.reduce(loss, "mean")
                # 直接可以print日志，而不需要指定Rank来print
                accelerator.print(f"ep: {ep}, global_step: {global_step}, loss: {loss.item()}")
            global_step += 1
        acc = evaluate(model, validloader, accelerator)
        accelerator.print(f"ep: {ep}, acc: {acc}")


def main():
	# 实例化
    accelerator = Accelerator()

    trainloader, validloader = prepare_dataloader()
    model, optimizer = prepare_model_and_optimizer()

    model, optimizer, trainloader, validloader = accelerator.prepare(model, optimizer, trainloader, validloader)

    train(model, optimizer, trainloader, validloader, accelerator)


if __name__ == "__main__":
    main()
```

我们使用`touchrun --nproc_per_node=2 accelerate.py`来开始训练，或者还能使用`accelerate launch accelerate.py`。如果使用后者，还能在终端输入`accelerate config`来设置训练的参数。在设置完之后，使用`accelerate launch accelerate.py`，就可以直接调用前面设置的参数来进行训练。

# 两者的差别

我们来对比一下这两种方式分别有什么区别：

1. 原生`DDP`中需要在`DataLoader`中设置`sampler`，使用`Accelerate`则不需要。
2. 原生`DDP`中需要将模型进行包装`model = DDP(model)`，另一个则不需要。
3. 原生需要在训练时初始化进程组`dist.init_process_group`，`Accelerate`则不需要，只需要实例化`Accelerate`。
4. 数据，模型，优化器都使用了`accelerate.prepare`来进行分布式的准备。
5. 训练中，`trainloder.sampler.set_epoch()`以及后续的`batch`发送到不同机器这一步也省略了。
6. 打印日志可以使用`accelerate.print()`实现。

# 使用混合精度进行训练

混合精度训练结合了32位的单精度浮点数和16位半精度来进行训练。首先加载完整的32位的完整精度模型，随后将它复制一份成16位的半精度模型。16bit的低精度模型会被用来前向传播，得到的16bit精度的梯度会被转为32bit，传入优化器。最后在32位的模型上进行参数更新。

通过这种方式，能够加速训练，但是不会减少对显存的需求。

假设模型参数量为M：

|        | 混合精度                        | 单精度                     |
| ------ | ------------------------------- | -------------------------- |
| 模型   | (4+2) Bytes * M                 | 4 Bytes * M                |
| 优化器 | 8 Bytes * M                     | 8 Bytes * M                |
| 梯度   | (2 + ) Bytes * M                | 4 Bytes * M                |
| 激活值 | 2 Bytes * A                     | 4 Bytes * A                |
| 汇总   | (16 + ) Bytes * M + 2 Bytes * A | 16 Bytes * M + 4 Bytes * A |

当使用混合精度训练时，不光需要一个完整模型，还需要一个半精度模型，因此模型这占用了4 + 2倍的参数量。优化器占用的参数量不变，梯度这在前向传播时变成了半精度，只在更新时会拿出一组参数提高为单精度，因此可以视作2 + 的参数量。此外，激活值也会变为半精度。

使用Accelerate时，只需要使用以下几种方法就可以进行混合精度训练：

```python
# 方法一
accelerator = Accelerator(mixed_percision = 'bf16')

# 方法二
acclerator config && choice bf 16

# 方法三
accelerator launch --mixed_precision bf 16 {script.py}
```

# 使用梯度累积进行训练

在显卡显存过小的时候，能够使用梯度累积的功能来模拟大Batch Size的训练效果。

梯度累积的流程如下：

1. 分割Batch：将大Batch分割为多个Mini Batch
2. 计算梯度：每个Mini Batch独立计算梯度
3. 累积梯度：将Mini Batch的梯度进行累积，而不是马上更新参数
4. 更新参数：当积累到一定数量，统一使用累积的梯度更新参数

示例如下：

```python
accumulation_steps = 4 # 累积步数
model.zero_grad() # 清空梯度
for step, (inputs, targets) in enumerate(dataloader):
    outputs = model(inputs)
    loss = criterion(outputs, targets) 
    loss = loss/accumulation_steps # 对损失进行缩放
    loss.backward()
    if (step + 1) % accumulation_step == 0: # 只有达到累积的步数才会更新
        optimizer.step()
        model.zero_grad()
```

在Accelerate的实现代码如下：

```python
# 在实例化时设置累积步数
accelerator = Accelerator(gradient_accumulation_steps=2)
```

然后再训练时计算：

```python
def train(model, optimizer, trainloader, validloader, accelerator: Accelerator, epoch=3, log_step=10):
    global_step = 0
    for ep in range(epoch):
        model.train()
        for batch in trainloader:
            # 加入上下文
            with accelerator.accumulate(model):
                optimizer.zero_grad()
                output = model(**batch)
                loss = output.loss
                accelerator.backward(loss)
                optimizer.step()
                
                if accelerator.sync_gradients:
                    global_step += 1
                    if global_step % log_step == 0:
                        loss = accelerator.reduce(loss, "mean")
                        accelerator.print(f"ep: {ep}, global_step: {global_step}, loss: {loss.item()}")
                
        acc = evaluate(model, validloader, accelerator)
        accelerator.print(f"ep: {ep}, acc: {acc}")

```

2024/5/2 于苏州
