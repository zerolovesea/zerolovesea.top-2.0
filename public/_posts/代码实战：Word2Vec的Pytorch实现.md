---
title: 代码实战：Word2Vec的Pytorch实现
date: 2024-02-11 19:55:25
tags:
  - LLM
  - 代码实战
  - NLP
  - Embedding
categories: LLM
excerpt: 基于Pytorch框架实现的Word2Vec代码。
index_img: "/img/word2vec.png"
---
> 重点引用：
>
> [Word2Vec精讲及代码实现](https://hzaubionlp.files.wordpress.com/2020/09/5e38081word2vece59fbae4ba8epytorche5ae9ee78eb0word2vece8af8de5b58ce585a5.pdf)。
>
> [Word2Vec的PyTorch实现（中文数据）（参考版）](https://angel-hair.github.io/2021/05/20/Word2Vec的PyTorch实现（中文数据）（参考版）/)

话不多说，先上介绍：Word2Vec是由谷歌团队于2013年发布的词嵌入工具，主要包含了两种模型：`Skip-gram`和`CBOW`模型。论文为[Efficient Estimation of Word Representations in Vector Space](https://arxiv.org/pdf/1301.3781.pdf)。

- Skip-gram：根据目标词去预测周围词来训练得到词向量。
- CBOW：根据上下文取预测目标词来训练得到词向量。

Word2Vec在独热编码的基础上对词向量进行升维，因此获得了更高的维度，也代表着更深的语义，它主要的思想是`单词的含义由其上下文定义`。

# 模型架构

`Skip-gram`和`CBOW`分别代表了两种训练方式，不过他们的训练思想是容易理解的。例如，`CBOW` 模型将 “machine”、“learning”、“a”、“method” 作为输入，并返回 “is” 作为输出。`Skip-Gram` 模型则相反。：

![CBOW 方法](https://miro.medium.com/v2/resize:fit:963/1*ETcgajy5s0KNIfMgE5xOqg.png)

![Skip-gram方法](https://miro.medium.com/v2/resize:fit:963/1*SVs6xTpD7AYviP24UTOYUA.png)

上图是一个示例，`Skip-gram`通过建立大小为2的滑动窗口，来基于前后两个词预测中间的词。实际上，这两者都是一个多分类模型，对于输入的每个字进行输出。

整个模型的结构如下：

![Skipgram 模型架构](https://miro.medium.com/v2/resize:fit:963/1*ualmmjPyasihGaddtrXvig.png)

整个模型中包含了几个部分：

1. 对所有单词进行编码。
2. 嵌入层，将所有单词变为300维向量。
3. 使用Softmax的线性层，用来输出概率。

`CBOW` 和 `Skip-Gram` 模型的区别在于输入字的数量。`CBOW` 模型采用多个单词，每个单词经过相同的嵌入层，然后在进入线性层之前对单词嵌入向量进行平均。`Skip-Gram`模型改用一个单词。详细的架构如下图所示。

![CBOW模型](https://miro.medium.com/v2/resize:fit:963/1*mLDM3PH12CjhaFoUm5QTow.png)

![Skip-Gram模型](https://miro.medium.com/v2/resize:fit:963/1*eHh1_t8Wms_hqDNBLuAnFg.png)

在训练结束后，我们将使用嵌入层的权重，而不是直接使用训练的模型，这就是我们得到的嵌入向量。

## 模型的输入



对于`CBOW`来说，模型的输入是上下文单词的独热编码。假设单词向量空间维度为 V（总词表大小），上下文单词个数为C，那么第i个词的就是一个维度为V，第i个元素值非零，其余元素全为0的向量，一共有C个这样的向量。

输入到隐藏层之间包含了一个权重矩阵W。

隐藏层输出层包含了第二权重矩阵W’。

最终输出经过softmax函数，进行归一化。

# 训练代码

以下是训练代码：

```python
import numpy as np
from torchtext.vocab import vocab
from collections import Counter, OrderedDict
from torch.utils.data import Dataset, DataLoader
from torchtext.transforms import VocabTransform 
import torch
from torch import nn
from torch.nn import functional as F


def get_text():
    sentence_list = [  # 假设这是全部的训练语料
        "nlp drives computer programs that translate text from one language to another",
        "nlp combines computational linguistics rule based modeling of human language with statistical",
        "nlp model respond to text or voice data and respond with text",
    ]
    return sentence_list


class CbowDataSet(Dataset):
    def __init__(self, text_list, side_window=3):
        """
        构造Word2vec的CBOW采样Dataset
        :param text_list: 语料
        :param side_window: 单侧正例（构造背景词）采样数，总正例是：2 * side_window
        """
        super(CbowDataSet, self).__init__()
        self.side_window = side_window
        text_vocab, vocab_transform = self.reform_vocab(text_list)
        self.text_list = text_list  # 原始文本
        self.text_vocab = text_vocab  # torchtext的vocab
        self.vocab_transform = vocab_transform  # torchtext的vocab_transform
        self.cbow_data = self.generate_cbow()

    def __len__(self):
        return len(self.cbow_data)

    def __getitem__(self, idx):
        data_row = self.cbow_data[idx]
        return data_row[0], data_row[1]

    def reform_vocab(self, text_list):
        """根据语料构造torchtext的vocab"""
        total_word_list = []
        for _ in text_list:  # 将嵌套的列表([[xx,xx],[xx,xx]...])拉平 ([xx,xx,xx...])
            total_word_list += _.split(" ")
        counter = Counter(total_word_list)  # 统计计数
        sorted_by_freq_tuples = sorted(counter.items(), key=lambda x: x[1], reverse=True)  # 构造成可接受的格式：[(单词,num), ...]
        ordered_dict = OrderedDict(sorted_by_freq_tuples)
        # 开始构造 vocab
        special_token = ["<UNK>", "<SEP>"]  # 特殊字符
        text_vocab = vocab(ordered_dict, specials=special_token)  # 单词转token，specials里是特殊字符，可以为空
        text_vocab.set_default_index(0)
        vocab_transform = VocabTransform(text_vocab)
        return text_vocab, vocab_transform

    def generate_cbow(self):
        """生成CBOW的训练数据"""
        cbow_data = []
        for sentence in self.text_list:
            sentence_id_list = np.array(self.vocab_transform(sentence.split(' ')))
            for center_index in range(
                    self.side_window, len(sentence_id_list) - self.side_window):  # 防止前面或后面取不到足够的值，这是取index的上下界
                pos_index = list(range(center_index - self.side_window, center_index + self.side_window + 1))
                del pos_index[self.side_window]
                cbow_data.append([sentence_id_list[center_index], sentence_id_list[pos_index]])
        return cbow_data

    def get_vocab_transform(self):
        return self.vocab_transform

    def get_vocab_size(self):
        return len(self.text_vocab)


class Word2VecModel(nn.Module):
    def __init__(self, vocab_size, batch_size, word_embedding_size=100, hidden=64):
        """
        Word2vec模型CBOW实现
        :param vocab_size: 单词个数
        :param word_embedding_size: 每个词的词向量维度
        :param hidden: 隐层维度
        """
        super(Word2VecModel, self).__init__()
        self.vocab_size = vocab_size
        self.word_embedding_size = word_embedding_size
        self.hidden = hidden
        self.batch_size = batch_size
        self.word_embedding = nn.Embedding(self.vocab_size, self.word_embedding_size)  # token对应的embedding
        # 建模
        self.linear_in = nn.Linear(self.word_embedding_size, self.hidden)
        self.linear_out = nn.Linear(self.hidden, self.vocab_size)

    def forward(self, input_labels):
        around_embedding = self.word_embedding(input_labels)
        avg_around_embedding = torch.mean(around_embedding, dim=1)  # 1. 输入的词向量对应位置求平均
        in_emb = F.relu(self.linear_in(avg_around_embedding))  # 2. 过第一个linear，使用relu激活函数
        out_emb = F.log_softmax(self.linear_out(in_emb))  # 3. 过第二个linear，得到维度是：[batch_size, 单词总数]
        return out_emb

    def get_embedding(self, token_list: list):
        return self.word_embedding(torch.Tensor(token_list).long())
```

然后是开始训练的部分：

```python
batch_size = 7
sentence_list = get_text()
cbow_data_set = CbowDataSet(sentence_list)  # 构造 DataSet
data_loader = DataLoader(cbow_data_set, batch_size=batch_size, drop_last=True)  # 将DataSet封装成DataLoader
# 开始训练
model = Word2VecModel(cbow_data_set.get_vocab_size(), batch_size)
optimizer = torch.optim.Adam(model.parameters())
criterion = nn.CrossEntropyLoss()
for _epoch_i in range(100):
    loss_list = []
    for center_token, back_token in data_loader:
        # 开始训练
        optimizer.zero_grad()
        model_out = model(back_token)
        loss = criterion(model_out, center_token)
        loss.backward()
        optimizer.step()
        loss_list.append(loss.item())
    print("训练中：", _epoch_i, "Loss:", np.sum(loss_list))
```

简单测试一下：

```python
sentence = "nlp can translate text from one language to another"
vocab_transform = cbow_data_set.get_vocab_transform()
sentence_ids = vocab_transform(sentence.split(' '))
sentence_embedding = model.get_embedding(sentence_ids)
print("这个是句向量的维度：", sentence_embedding.shape)

# 这个是句向量的维度： torch.Size([9, 100])
```

# 调用权重

在训练完之后，我们需要的是Embedding层的权重，我们可以用之前写好的`get embedding`方法来获得权重，或者直接使用`model.word_embedding.weight`也可以实现。

```python
import torch
from torch.nn.functional import cosine_similarity

# 获取嵌入权重
embedding_weights = model.word_embedding.weight

# 获取词汇表
vocab_transform = cbow_data_set.get_vocab_transform()
vocab = vocab_transform.vocab

# 获取两个词的索引
word1_index = vocab['nlp']
word2_index = vocab['translate']

# 获取两个词的嵌入向量
word1_embedding = embedding_weights[word1_index].unsqueeze(0)  # 添加额外的维度使其成为 1xembedding_size
word2_embedding = embedding_weights[word2_index].unsqueeze(0)

# 计算余弦相似度
similarity = cosine_similarity(word1_embedding, word2_embedding)
print(f"余弦相似度 between 'nlp' and 'translate': {similarity.item()}")

# 余弦相似度 between 'nlp' and 'translate': 0.013783279806375504
```

2024/2/11 于汕头

