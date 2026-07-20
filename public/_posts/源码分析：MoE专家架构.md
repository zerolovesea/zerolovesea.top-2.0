---
title: 源码分析：MoE专家架构
date: 2024-04-10 20:43:37
tags:
  - LLM
  - 代码实战
  - NLP
categories: LLM
excerpt: 基于代码层面分析MoE专家架构的实现路径。
index_img: "/img/moe.png"
---

相关链接：

[混合专家模型（MoE）详解](https://huggingface.co/blog/zh/moe)

[手把手教你，从零开始实现一个稀疏混合专家架构语言模型（MoE） ](https://www.jiqizhixin.com/articles/2024-02-15-7)

MoE专家模型因为Mixtral的使用让大家又一次了解了这个架构，事实上这个架构起源于 1991 年的论文 [Adaptive Mixture of Local Experts](https://www.cs.toronto.edu/~hinton/absps/jjnh91.pdf)。这种思想旨在使用多个独立的网络组成一个监督模型，该模型中，每个独立的网络（也被称作专家网络）专注于训练样本中的不同数据。这个系统中，一个门控网络被训练来决定哪个专家被选中。

这和传统的机器学习模型中的Ensemble模型有点类似，都是结合了多个模型来处理任务，区别在于MoE的子模型是根据不同的任务建模，并且多了一个门控单元。

> 我的理解：MoE是如何体现在语言模型上的？可以理解为生成文本时，会根据上一段文本中的内容进行预测。在上一段文本中，每个Token都有一个专门的专家处理，来给出预测。

# Pytorch实现简单的专家网络

这里用pytorch实现一个简单的专家网络。完成这个任务需要有几个部分：

1. 需要一个Dataset。
2. 需要一个DataLoader。
3. 需要一个TopN函数，用来选择需要的专家网络。
4. 需要一个单个的Expert网络。
5. 需要一个完整的MoE网络。
6. 需要一个损失函数和评估函数。
7. 需要完整的训练过程。

## Dataset与DataLoader

 ```python
 import torch
 import torch.nn as nn
 import torch.nn.functional as F
 from torch.utils.data import DataLoader, Dataset
 from sklearn.model_selection import train_test_split
 from sklearn.metrics import accuracy_score
 import numpy as np
 
 # 创建一些随机数据（替换为真实数据）
 num_samples = 1000
 num_features = 300  # 假设文本已经转换为固定大小的向量
 num_classes = 10    # 假设有10个类别
 
 # 随机生成数据和标签
 X = np.random.randn(num_samples, num_features) # (1000, 300)
 y = np.random.randint(0, num_classes, num_samples) # (1000,)
 
 # 划分训练集和测试集
 X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
 
 # 定义 Dataset
 class TextDataset(Dataset):
     # features: (num_samples, num_features) # 1000个样本，每个样本300个嵌入特征
     def __init__(self, features, labels):
         self.features = features
         self.labels = labels
 
     def __len__(self):
         return len(self.labels)
 
     def __getitem__(self, idx):
         return torch.tensor(self.features[idx], dtype=torch.float), torch.tensor(self.labels[idx], dtype=torch.long)
 
 # 创建 DataLoader
 train_dataset = TextDataset(X_train, y_train)
 train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
 
 test_dataset = TextDataset(X_test, y_test)
 test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
 ```

 ## TopN函数

门控网络是一个线性层，它将输入的完整的Tensor转换为所有的专家网络数大小的张量，代表着每个专家的得分。随后取Top N个专家的Index。

 ```python
 ###模型定义
 class TopKGating(nn.Module):
     def __init__(self, input_dim, num_experts, top_k=2):
         super(TopKGating, self).__init__()
         # 初始化线性层作为门控机制
         self.gate = nn.Linear(input_dim, num_experts) # (300, 4)
         # 设置要选择的顶部专家数量
         self.top_k = top_k
 
     def forward(self, x):
         # 计算每个专家的分数
         gating_scores = self.gate(x) # x: (batch_size, input_dim) (32, 300) gating_scores: (batch_size, num_experts) (32, 4)
         # 选取分数最高的 top_k 个专家，并返回它们的索引和 softmax 权重
         top_k_values, top_k_indices = torch.topk(F.softmax(gating_scores, dim=1), self.top_k)
         return top_k_indices, top_k_values
 ```

 ## 专家网络

专家网络就是一个简单的神经网络：

 ```python
 class Expert(nn.Module):
     def __init__(self, input_dim, output_dim):
         super(Expert, self).__init__()
         # 为每个专家定义一个简单的神经网络
         self.net = nn.Sequential(
             nn.Linear(input_dim, 4*input_dim),
             nn.ReLU(),
             nn.Linear(4*input_dim, output_dim)
         )
 
     def forward(self, x):
         # 通过专家网络传递输入数据
         print(f'expert input shape', x.shape) # (batch_size, input_dim) (32, 300) 
         return self.net(x) # output = self.net(x) # (batch_size, output_dim) (32, 10)
 ```

## MoE网络

我们假设这是一个分类任务，那么构建MoE网络需要如下参数：输出的Tensor，类别数量，专家数量，TopN。假如是文本预测任务，那么类别数量就是词表大小。

```python
class MoE(nn.Module):
     def __init__(self, input_dim, num_classes, num_experts, top_k=2):
         super(MoE, self).__init__()
         # 设置专家数量
         self.num_experts = num_experts
         # 设置类别数量
         self.num_classes = num_classes
         # 初始化 TopK 门控层
         self.gating = TopKGating(input_dim, num_experts, top_k)
         # 创建专家网络的列表，每个专家是一个 Expert 实例
         self.experts = nn.ModuleList([Expert(input_dim, num_classes) for _ in range(num_experts)])
 
     def forward(self, x):
         # 获取批量大小
         batch_size = x.size(0) # (32, 300)
     
         # 通过门控层获得 top_k 专家的索引和门控权重
         indices, gates = self.gating(x)  # indices：[batch_size, top_k], gates：[batch_size, top_k]
     
         # 准备收集选定专家的输出
         expert_outputs = torch.zeros(batch_size, indices.size(1), self.num_classes).to(x.device)
     
         # 遍历每个样本和其对应的 top_k 专家
         for i in range(batch_size): # 32
             print(f'第i个batch', i)
             for j in range(indices.size(1)): # 2，即top_k
                 expert_idx = indices[i, j].item()  # 获取专家的索引，即门控权重最大的专家
                 print(f'Top2专家', expert_idx) 
                 print(self.experts[expert_idx]) # 打印专家网络 一个完整的神经网络
                 print(f'-----')
                 print(f'x[i] shape', x[i].shape) # (300,)
                 print(f'x[i].unsqueeze(0) shape', x[i].unsqueeze(0).shape) # (1, 300) 在第0维度上增加一个维度
                 expert_outputs[i, j, :] = self.experts[expert_idx](x[i].unsqueeze(0)) # 通过专家网络传递输入数据，(1, 300)->(1, 10)
                 print(f'expert_outputs shape', expert_outputs.shape) # (32, 2, 10)

         # 将门控权重扩展到与专家输出相同的维度
         gates = gates.unsqueeze(-1).expand(-1, -1, self.num_classes)  # 形状：[batch_size, top_k, num_classes]
     
         # 计算加权的专家输出的和
         output = (gates * expert_outputs).sum(1)
         return output, gates.sum(0)  # 返回模型输出和门控使用率以用于负载平衡损失计算
```

## 损失函数 

```python
import torch.nn.functional as F
 
def moe_loss(output, target, gating_weights, lambda_balance=0.1):
     # 标准损失（例如交叉熵损失）
     # output 是模型的输出，target 是真实的标签
     standard_loss = F.cross_entropy(output, target)
 
     # 负载平衡损失
     # gating_weights 是门控权重，表示每个专家的使用率
     # 使用标准差来衡量各专家使用率的平衡程度
     balance_loss = torch.std(gating_weights)
 
     # 总损失
     # 结合标准损失和负载平衡损失，lambda_balance 是一个超参数，用于控制负载平衡损失在总损失中的比重
     total_loss = standard_loss + lambda_balance * balance_loss
     return total_loss
```

## 训练模型

```python
 # 初始化模型
model = MoE(input_dim=num_features, num_classes=num_classes, num_experts=4, top_k=2)
 optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
 
 # 训练循环
num_epochs = 1
for epoch in range(num_epochs):
    model.train()
    total_loss = 0
    for features, labels in train_loader:
         optimizer.zero_grad()
         outputs, gating_weights = model(features)
         loss = moe_loss(outputs, labels, gating_weights)
         loss.backward()
         optimizer.step()
         total_loss += loss.item()
    print(f'Epoch {epoch+1}, Loss: {total_loss/len(train_loader)}')
 
 
def evaluate(model, data_loader):
     model.eval()
     predictions, true_labels = [], []
     with torch.no_grad():
         for features, labels in data_loader:
             s = time.time()
             outputs, _ = model(features)
             e = time.time()
             print(e-s)
             predicted = torch.argmax(outputs, dim=1)
             predictions.extend(predicted.tolist())
             true_labels.extend(labels.tolist())
     return accuracy_score(true_labels, predictions)
```

以下是一个Epoch的输出：

```bash
Expert(
  (net): Sequential(
    (0): Linear(in_features=300, out_features=1200, bias=True)
    (1): ReLU()
    (2): Linear(in_features=1200, out_features=10, bias=True)
  )
)
-----
x[i] shape torch.Size([300])
x[i].unsqueeze(0) shape torch.Size([1, 300])
expert_outputs shape torch.Size([32, 2, 10])
第i个batch 0
Top2专家 0
Expert(
  (net): Sequential(
    (0): Linear(in_features=300, out_features=1200, bias=True)
    (1): ReLU()
    (2): Linear(in_features=1200, out_features=10, bias=True)
  )
)
-----
x[i] shape torch.Size([300])
x[i].unsqueeze(0) shape torch.Size([1, 300])
expert_outputs shape torch.Size([32, 2, 10])
Top2专家 1
Expert(
  (net): Sequential(
    (0): Linear(in_features=300, out_features=1200, bias=True)
    (1): ReLU()
    (2): Linear(in_features=1200, out_features=10, bias=True)
  )
)
-----
x[i] shape torch.Size([300])
x[i].unsqueeze(0) shape torch.Size([1, 300])
expert_outputs shape torch.Size([32, 2, 10])
第i个batch_size 26
Top2专家 2
Expert(
  (net): Sequential(
    (0): Linear(in_features=300, out_features=1200, bias=True)
    (1): ReLU()
    (2): Linear(in_features=1200, out_features=10, bias=True)
  )
)
-----
x[i] shape torch.Size([300])
x[i].unsqueeze(0) shape torch.Size([1, 300])
expert_outputs shape torch.Size([32, 2, 10])
Top2专家 3
Expert(
  (net): Sequential(
    (0): Linear(in_features=300, out_features=1200, bias=True)
    (1): ReLU()
    (2): Linear(in_features=1200, out_features=10, bias=True)
  )
)
-----
```



# Mixtral MoE源码

同时附上了Transformer中Mixtral的MoE源码：

首先是Mixtral的单个专家模块，它将输入层经过一个被激活过的线性层，再经过两个线性层。

```python
class MixtralBLockSparseTop2MLP(nn.Module):
    def __init__(self, config: MixtralConfig):
        super().__init__()
        # FFNSize，一般是 HidSize x4
        self.ffn_dim = config.intermediate_size
        # HidSize，隐藏状态的向量尺寸
        self.hidden_dim = config.hidden_size

        # 用于隐藏状态扩张的线性层
        self.w1 = nn.Linear(self.hidden_dim, self.ffn_dim, bias=False)
        # 用于隐藏状态收缩的线性层
        self.w2 = nn.Linear(self.ffn_dim, self.hidden_dim, bias=False)
        # 用于计算隐藏状态门控的线性层
        self.w3 = nn.Linear(self.hidden_dim, self.ffn_dim, bias=False)

        self.act_fn = ACT2FN[config.hidden_act]

    def forward(self, hidden_states):
        # 输入隐藏状态的形状为 [BatchSize, SeqLen, HidSize]、
        # 输入经过第三个线性层并激活，得到门控
        # 输入经过第一个线性层，乘以门控，经过第二个线性层，得到输出
        current_hidden_states = self.act_fn(self.w1(hidden_states)) * self.w3(hidden_states)
        current_hidden_states = self.w2(current_hidden_states)
        return current_hidden_states

class MixtralBLockSparseTop2MLP(MixtralBlockSparseTop2MLP):
    def __init__(self, *args, **kwargs):
        logger.warning_once(
            "MixtralBLockSparseTop2MLP is deprecated by MixtralBlockSparseTop2MLP and will be removed in v4.40."
        )
        super().__init__(*args, **kwargs)
```

以下代码是MoE的模型构建：

```python
# MOE 的架构
class MixtralSparseMoeBlock(nn.Module):
    """
    This implementation is
    strictly equivalent to standard MoE with full capacity (no
    dropped tokens). It's faster since it formulates MoE operations
    in terms of block-sparse operations to accomodate imbalanced
    assignments of tokens to experts, whereas standard MoE either
    (1) drop tokens at the cost of reduced performance or (2) set
    capacity factor to number of experts and thus waste computation
    and memory on padding.
    """

    def __init__(self, config):
        super().__init__()
        # HidSize，隐藏状态的向量尺寸
        self.hidden_dim = config.hidden_size
        self.ffn_dim = config.intermediate_size
        # NExp，专家数量
        self.num_experts = config.num_local_experts
        # TopK，激活的专家数量
        self.top_k = config.num_experts_per_tok

        # 门控线性层
        self.gate = nn.Linear(self.hidden_dim, self.num_experts, bias=False)

        # 专家模块列表，每个都是 FFN
        self.experts = nn.ModuleList([MixtralBLockSparseTop2MLP(config) for _ in range(self.num_experts)])

    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        """ """
        # 输入尺寸：[BatchSize, SeqLen, HidSize]
        # 获取 BatchSize（批量大小）
        #     SeqLen（序列长度）
        #     HidSize（隐藏状态尺寸）
        batch_size, sequence_length, hidden_dim = hidden_states.shape
        # 将输入前两维合并，[BatchSize * SeqLen, HidSize]
        hidden_states = hidden_states.view(-1, hidden_dim)
        # 将隐藏状态传入门控线性层得到专家得分
        # 每个样本的每个单词都有一组得分
        # [BatchSize * SeqLen, NExp]
        router_logits = self.gate(hidden_states)
        # 专家得分经过 Softmax 得到专家概率
        routing_weights = F.softmax(router_logits, dim=1, dtype=torch.float)
        # 计算每个得分的 TOPK，得到专家索引
        # routing_weights：TOPK 专家概率，[BatchSize * SeqLen, TopK]
        # selected_experts：TOPK 专家索引，[BatchSize * SeqLen, TopK]
        routing_weights, selected_experts = torch.topk(routing_weights, self.top_k, dim=-1)
        # 专家概率归一化，使每组得分和为一
        routing_weights /= routing_weights.sum(dim=-1, keepdim=True)
        # 转换为输入的数据类型
        routing_weights = routing_weights.to(hidden_states.dtype)
        # 将最终的隐藏状态初始化为零，用于累加
        final_hidden_states = torch.zeros(
            (batch_size * sequence_length, hidden_dim), dtype=hidden_states.dtype, device=hidden_states.device
        )

        # 将专家索引单热化，交换前后两维，得到专家的掩码
        # [NExp, TopK, BatchSize * SeqLen]
        # mask[i, j, k] 表示第 k 个单词的第 j 个专家是不是专家 i
        expert_mask = torch.nn.functional.one_hot(selected_experts, num_classes=self.num_experts).permute(2, 1, 0)

        # 遍历每个专家，expert_idx 为专家索引
        for expert_idx in range(self.num_experts):
            # 获取当前专家模块
            expert_layer = self.experts[expert_idx]
            # 使用索引来索引掩码，得到当前专家的掩码矩阵
            # [TopK, BatchSize * SeqLen]
            # 它的元素 [i, j] 表示第 j 个样本的第 i 个专家是不是当前专家
            # where 计算调用该专家的单词序号（top_x），以及该专家的排名（idx）
            idx, top_x = torch.where(expert_mask[expert_idx])

            # 如果没有单词调用该专家，转到下一个
            if top_x.shape[0] == 0:
                continue

            # 转 Python 列表
            top_x_list = top_x.tolist()
            idx_list = idx.tolist()

            # 获取调用该专家的单词的隐藏状态，[NHid, HidSize]
            current_state = hidden_states[None, top_x_list].reshape(-1, hidden_dim)
            # 将隐藏状态传入当前专家，得到专家输出，[NHid, HidSize]
            # 获取调用该专家的单词的专家概率，[NHid, 1]
            # 二者相乘
            current_hidden_states = expert_layer(current_state) * routing_weights[top_x_list, idx_list, None]

            # 将隐藏状态加到最终隐藏状态
            # 即 final_hidden_states[top_x[i]] += current_hidden_states[i]
            final_hidden_states.index_add_(0, top_x, current_hidden_states.to(hidden_states.dtype))
        # 拆分第一维，[BatchSize, SeqLen, HidSize]
        final_hidden_states = final_hidden_states.reshape(batch_size, sequence_length, hidden_dim)
        return final_hidden_states, router_logits
```

2024/4/14 于苏州