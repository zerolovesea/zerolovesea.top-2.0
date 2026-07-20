---
title: "解读KANs：网络架构中对激活函数的学习"
description: "分析ZiMingLiu于2024年发布的Kolmogorov-Arnold Networks。"
pubDate: "2024-05-07 22:28:52"
---

整个五一假期都没有碰代码（除了第一天捣鼓了一点小玩意）。到了假期末的时候刷了一下Github的热榜，看到一个国人的开源仓库冲上了日榜，也就是今天要学习的内容，KANs。

作者是斯坦福大学的博士生刘子鸣，他将自己开发的网络命名为Kolmogorov-Arnold Networks。在他的博客上介绍了自己，毕业于北大物理系，并曾在微软亚院实习。目前他主要研究的方向是传统物理和AI的交叉学科，看起来很笼统。看了一下Google Scholar，引用最高的几篇文章偏向机器学习方面。

---

该文的命名来源于Kolmogorov-Arnold表示定理，此前我完全没有了解过。看了很多网上的解释，我理解为任何**多变量连续**函数都可以表示为多个单变量、加法连续函数的有限组合。

公式如下：$ f(\mathbf{x}) = f(x_1, \dots, x_n) = \sum_{q=0}^{2n} \Phi_q \left( \sum_{p=1}^n \phi_{qp}(x_p) \right) $

这里等号后面的括号里和括号外就是从$[0,1]$的$R$的连续函数。括号里是内部函数，外则是外部函数。连续函数可以是线性变换函数或者二次函数等等。

这个理论在机器学习领域可以简化为：学习高维函数的过程可以简化成学习多项式数量的一维函数。KANs的想法则是替代前馈网络：$ \mathbf{y} = \sigma(\mathbf{Wx} + \mathbf{b}) $

> 为什么之前在机器学习中没有被人们所使用？论文中给出了自己的解释：
>
> 有人可能天真地认为这对机器学习来说是个好消息：学习高维函数归结为学习多项式数量的一维函数。然而，这些一维函数可能是非光滑的，甚至是分形的，因此在实践中可能无法学习。由于这种病态行为，科尔莫戈洛夫-阿诺德表示定理在机器学习中基本上被判了死刑，被认为在理论上是正确的，但在实践中是无用的。
> 
>

拿Github上的原图来展示一下：

![](/_posts/%E8%A7%A3%E8%AF%BBKANs%EF%BC%9A%E7%BD%91%E7%BB%9C%E6%9E%B6%E6%9E%84%E4%B8%AD%E5%AF%B9%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E7%9A%84%E5%AD%A6%E4%B9%A0/240507-1.png)

在前馈网络中，最终需要拟合的函数由多个线性函数（$W$权重）以及非线性函数（激活函数）组合而成。而在KANs则变为了$KAN(x)=(\Phi_3\circ \Phi_2 \circ \Phi_1)(x)$。

上图同时还展示了另外一点，那就是KANs网络的可学习参数要比MLP要少了很多。其中$\Phi_2$用来实现非线性函数。

# 代码实现

作者的工程能力很强，提供了基于Pytorch写的框架，不过据他所说，目前代码还有一些不足。而目前Github社区也有人迅速跟进。目前这个名为`efficent-kan`的项目已经获得了超过两千颗星，链接：[Blealtan/efficient-kan: An efficient pure-PyTorch implementation of Kolmogorov-Arnold Network (KAN)](https://github.com/Blealtan/efficient-kan/tree/master)。

看了一眼源码，代码量不多，但是需要比较深的数学背景，所以暂时跳过这个部分。


# MNIST数据集

项目用MNIST数据集进行了测试训练，代码如下：

```python
from efficient_kan import KAN

# Train on MNIST
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
from tqdm import tqdm

# Load MNIST
transform = transforms.Compose(
    [transforms.ToTensor(), transforms.Normalize((0.5,), (0.5,))]
)
trainset = torchvision.datasets.MNIST(
    root="./data", train=True, download=True, transform=transform
)
valset = torchvision.datasets.MNIST(
    root="./data", train=False, download=True, transform=transform
)
trainloader = DataLoader(trainset, batch_size=64, shuffle=True)
valloader = DataLoader(valset, batch_size=64, shuffle=False)

# 定义模型，输入Size是28*28像素，输出Size是10个分类
model = KAN([28 * 28, 64, 10])
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
# AdamW优化器
optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
# LR学习率
scheduler = optim.lr_scheduler.ExponentialLR(optimizer, gamma=0.8)

# 定义损失
criterion = nn.CrossEntropyLoss()
for epoch in range(10):
    # Train
    model.train()
    with tqdm(trainloader) as pbar:
        for i, (images, labels) in enumerate(pbar):
            images = images.view(-1, 28 * 28).to(device)
            optimizer.zero_grad()
            output = model(images)
            loss = criterion(output, labels.to(device))
            loss.backward()
            optimizer.step()
            accuracy = (output.argmax(dim=1) == labels.to(device)).float().mean()
            pbar.set_postfix(loss=loss.item(), accuracy=accuracy.item(), lr=optimizer.param_groups[0]['lr'])

    # Validation
    model.eval()
    val_loss = 0
    val_accuracy = 0
    with torch.no_grad():
        for images, labels in valloader:
            images = images.view(-1, 28 * 28).to(device)
            output = model(images)
            val_loss += criterion(output, labels.to(device)).item()
            val_accuracy += (
                (output.argmax(dim=1) == labels.to(device)).float().mean().item()
            )
    val_loss /= len(valloader)
    val_accuracy /= len(valloader)

    # 更新学习率
    scheduler.step()

    print(
        f"Epoch {epoch + 1}, Val Loss: {val_loss}, Val Accuracy: {val_accuracy}"
    )
```
从结果上来看，KANs在收敛速度上比传统的MLP要快，精度相差不大。不过MLP存在过拟合的问题。数据集过小。还需要在更多的场景验证。

总的来说，KANs架构带来最大的两个优势：

1. 计算复杂度降低带来的收敛速度提高。
1. 动态图结构（区别于MLP的静态图结构中固定的激活函数）更加灵活，大家普遍认为这能解决灾难性遗忘的问题，因为训练时，较远的权重参数之间不会有太大的影响。


2024/5/11 于苏州
