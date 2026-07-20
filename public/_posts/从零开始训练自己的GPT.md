---
title: 从零开始训练自己的GPT
date: 2024-02-13 07:43:12
tags:
  - LLM
  - 代码实战
  - NLP
  - GPT
categories: LLM
excerpt: 以诛仙为训练语料，训练一个自己的GPT：数据清理，模型搭建，模型训练。
index_img: "/img/gpt.jpg"
---

之前研究LLM的时候，都只是看架构原理，以及MultiAttention的实现代码，但是对于大模型完整的训练过程没有太多仔细的了解。正好放假，就抽了点时间在研究了一下。这次，用网络小说“诛仙”为例，训练一个能写网文的语言模型。

# 前期准备

首先需要导入一些必要的库，以及设置一些必要的参数。

```python
import torch
import torch.nn as nn
from torch.nn import functional as F
import mmap
import random
import pickle
import argparse

device = 'cuda' if torch.cuda.is_available() else 'cpu'

batch_size = 32 # 训练/预测时的Batch样本个数
block_size = 128  # 训练/预测时的每个样本长度
max_iters = 200 # 最大生成字符数
learning_rate = 3e-4
eval_iters = 100
n_embd = 384
n_head = 4
n_layer = 4
dropout = 0.2
```

## 准备词表

训练模型的第一步是需要从语料中提取出词表字典。

```python
with open('诛仙.txt', 'r', encoding='gbk',errors='replace') as f:
    text = f.read()

chars = sorted(list(set(text)))
vocab_size = len(char) # 词表长度

print(f'共有{vocab_size}个不同的字符')
# 共有3591个不同的字符

print(text[:10])
# 诛仙
# 作者：萧鼎
```

词典提取完之后，就需要弄一个解码器和编码器。这两者的作用是将字符映射为数字Index，以及将Index反映射为字符。

```python
string_to_int = { ch:i for i,ch in enumerate(chars) }
int_to_string = { i:ch for i,ch in enumerate(chars) }
encode = lambda s: [string_to_int[c] for c in s]
decode = lambda l: ''.join([int_to_string[i] for i in l])

encode('天地不仁，以万物为刍狗。')
# [808, 732, 47, 130, 3587, 146, 42, 2094, 71, 351, 2111, 32]

decode([808, 732, 47, 130, 3587, 146, 42, 2094, 71, 351, 2111, 32])
# '天地不仁，以万物为刍狗。'
```

# 获取批数据

接下来，需要定义一个获取批数据的方法。我们定义了80%的数据作为训练集，20%作为验证集。`get_batch`方法会随机选择一个index，然后逐层叠加数据。

```python
n = int(0.8*len(data))
train_data = data[:n]
val_data = data[n:]

def get_batch(split):
    data = train_data if split == 'train' else val_data
    ix = torch.randint(len(data) - block_size, (batch_size,))
    x = torch.stack([data[i:i+block_size] for i in ix])
    y = torch.stack([data[i+1:i+block_size+1] for i in ix])
    x, y = x.to(device), y.to(device)
    return x, y

x, y = get_batch('train')
print('inputs:')
print(x)
print('targets:')
print(y)
```

打印看一下，这里`batch_size`是4，这说明一个批次里有四个样本对。输入是一个长度为8的句子，而输出则是从第二个字之后，预测下一个字。

```bash
inputs:
tensor([[73,  1, 54, 72,  1, 58, 75, 58],
        [58, 69, 65, 62, 58, 57,  1, 28],
        [56, 58, 72, 72, 11,  0,  0,  3],
        [26, 74, 73,  1, 33,  1, 54, 66]], device='cuda:0')
targets:
tensor([[ 1, 54, 72,  1, 58, 75, 58, 71],
        [69, 65, 62, 58, 57,  1, 28, 68],
        [58, 72, 72, 11,  0,  0,  3, 40],
        [74, 73,  1, 33,  1, 54, 66,  1]], device='cuda:0')
```


# 评估函数

接下来定义一个评估的函数。当评估时，不需要计算梯度。模型也需要切换到`eval`模式。随后迭代地取batch样本，计算概率和损失。最后输出损失的均值。

```python
@torch.no_grad()
def estimate_loss():
    out = {}
    model.eval()
    for split in ['train', 'val']:
        losses = torch.zeros(eval_iters)
        for k in range(eval_iters):
            X, Y = get_batch(split)
            logits, loss = model(X, Y)
            losses[k] = loss.item()
        out[split] = losses.mean()
    model.train()
    return out
```

# 构建模型

随后就是最重要的模型部分。这里采用了最通用的多头注意力构成的模型。首先定义一个注意力头。

```python
class Head(nn.Module):
    """ one head of self-attention """

    def __init__(self, head_size):
        super().__init__()
        self.key = nn.Linear(n_embd, head_size, bias=False)
        self.query = nn.Linear(n_embd, head_size, bias=False)
        self.value = nn.Linear(n_embd, head_size, bias=False)
        self.register_buffer('tril', torch.tril(torch.ones(block_size, block_size)))

        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        # input of size (batch, time-step, channels)
        # output of size (batch, time-step, head size)
        B,T,C = x.shape
        k = self.key(x)   # (B,T,hs)
        q = self.query(x) # (B,T,hs)
        # compute attention scores ("affinities")
        wei = q @ k.transpose(-2,-1) * k.shape[-1]**-0.5 # (B, T, hs) @ (B, hs, T) -> (B, T, T)
        wei = wei.masked_fill(self.tril[:T, :T] == 0, float('-inf')) # (B, T, T)
        wei = F.softmax(wei, dim=-1) # (B, T, T)
        wei = self.dropout(wei)
        # perform the weighted aggregation of the values
        v = self.value(x) # (B,T,hs)
        out = wei @ v # (B, T, T) @ (B, T, hs) -> (B, T, hs)
        return out

# [1, 0, 0]
# [1, 0.6, 0]
# [1, 0.6, 0.4]
```

随后，我们组一个多头注意力模板。

```python
class MultiHeadAttention(nn.Module):
    """ multiple heads of self-attention in parallel """

    def __init__(self, num_heads, head_size):
        super().__init__()
        self.heads = nn.ModuleList([Head(head_size) for _ in range(num_heads)])
        self.proj = nn.Linear(head_size * num_heads, n_embd)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        out = torch.cat([h(x) for h in self.heads], dim=-1) # (B, T, F) -> (B, T, [h1, h1, h1, h1, h2, h2, h2, h2, h3, h3, h3, h3])
        out = self.dropout(self.proj(out))
        return out   
```

然后是前向传播层。

```python
class FeedFoward(nn.Module):
    """ a simple linear layer followed by a non-linearity """

    def __init__(self, n_embd):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd),
            nn.ReLU(),
            nn.Linear(4 * n_embd, n_embd),
            nn.Dropout(dropout),
        )

    def forward(self, x):
        return self.net(x)
    
class Block(nn.Module):
    """ Transformer block: communication followed by computation """

    def __init__(self, n_embd, n_head):
        # n_embd: embedding dimension, n_head: the number of heads we'd like
        super().__init__()
        head_size = n_embd // n_head
        self.sa = MultiHeadAttention(n_head, head_size)
        self.ffwd = FeedFoward(n_embd)
        self.ln1 = nn.LayerNorm(n_embd)
        self.ln2 = nn.LayerNorm(n_embd)

    def forward(self, x):
        y = self.sa(x)
        x = self.ln1(x + y)
        y = self.ffwd(x)
        x = self.ln2(x + y)
        return x
    
class GPTLanguageModel(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.token_embedding_table = nn.Embedding(vocab_size, n_embd)
        self.position_embedding_table = nn.Embedding(block_size, n_embd)
        self.blocks = nn.Sequential(*[Block(n_embd, n_head=n_head) for _ in range(n_layer)])
        self.ln_f = nn.LayerNorm(n_embd) # final layer norm
        self.lm_head = nn.Linear(n_embd, vocab_size)
        
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, index, targets=None):
        B, T = index.shape
        
        # idx and targets are both (B,T) tensor of integers
        tok_emb = self.token_embedding_table(index) # (B,T,C)
        pos_emb = self.position_embedding_table(torch.arange(T, device=device)) # (T,C)
        x = tok_emb + pos_emb # (B,T,C)
        x = self.blocks(x) # (B,T,C)
        x = self.ln_f(x) # (B,T,C)
        logits = self.lm_head(x) # (B,T,vocab_size)
        
        if targets is None:
            loss = None
        else:
            B, T, C = logits.shape
            logits = logits.view(B*T, C)
            targets = targets.view(B*T)
            loss = F.cross_entropy(logits, targets)
        
        return logits, loss
    
    def generate(self, index, max_new_tokens):
        # index is (B, T) array of indices in the current context
        for _ in range(max_new_tokens):
            # crop idx to the last block_size tokens
            index_cond = index[:, -block_size:]
            # get the predictions
            logits, loss = self.forward(index_cond)
            # focus only on the last time step
            logits = logits[:, -1, :] # becomes (B, C)
            # apply softmax to get probabilities
            probs = F.softmax(logits, dim=-1) # (B, C)
            # sample from the distribution
            index_next = torch.multinomial(probs, num_samples=1) # (B, 1)
            # append sampled index to the running sequence
            index = torch.cat((index, index_next), dim=1) # (B, T+1)
        return index

model = GPTLanguageModel(vocab_size)
# print('loading model parameters...')
# with open('model-01.pkl', 'rb') as f:
#     model = pickle.load(f)
# print('loaded successfully!')
m = model.to(device)
```

# 训练模型

我们创建一个Optimizer，随后开始训练模型。

```python
# create a PyTorch optimizer
optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)

for iter in range(max_iters):
    if iter % eval_iters == 0:
        losses = estimate_loss()
        print(f"step: {iter}, train loss: {losses['train']:.3f}, val loss: {losses['val']:.3f}")

    # sample a batch of data
    xb, yb = get_batch('train')

    # evaluate the loss
    logits, loss = model.forward(xb, yb)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    optimizer.step()
print(loss.item())

with open('model-01.pkl', 'wb') as f:
    pickle.dump(model, f)
print('model saved')
```

# 测试模型

训练完成后就可以测试模型了。

```python
prompt = 'Hello! Can you see me?'
context = torch.tensor(encode(prompt), dtype=torch.long, device=device)
generated_chars = decode(m.generate(context.unsqueeze(0), max_new_tokens=100)[0].tolist())
print(generated_chars)
```

2024/2/17 于连江