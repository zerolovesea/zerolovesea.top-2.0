---
title: "推荐系统：Deep Crossing设计理念及实现"
description: "Deep Crossing的原理，设计理念及Python实现。"
pubDate: "2024-08-17 09:51:19"
---

在推荐系统中，特征交叉和特征筛选是一个永恒不灭的话题。从逻辑回归时代的人工特征交互，到poly2的完全特征交互，到FM的隐向量特征交互，再到GDBT+LR的自动特征交互，都是在深度学习方法开始之前的特征工程的发展历史。

在14年Resnet解决了层数过深导致的梯度消失问题后，深度神经网络被广泛运用到工业界。2016年微软发布了Deep Crossing模型，用于CTR等二分类任务，原论文链接如下：[Deep Crossing: Web-Scale Modeling without
Manually Crafted Combinatorial Features
](https://www.kdd.org/kdd2016/papers/files/adf0975-shanA.pdf)

# 论文解读

看名字就知道它要解决的是人工组合特征的问题。通过构建网络来实现特征的深度交叉。在Deep Crossing中，支持文本，分类，ID，数值这样的特征。

Deep Crossing的网络架构如下：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9ADeep-Crossing%E8%AE%BE%E8%AE%A1%E7%90%86%E5%BF%B5%E5%8F%8A%E5%AE%9E%E7%8E%B0/240818-1.png)

核心是四个部分：Embedding层用于嵌入特征，Stacking层用于将嵌入层简单的concat在一起，随后通过多个Residual模块提取特征。最后利用一个Scoring层来进行打分，也就是最后得到的logit值。通过对logit值进行排序，实现投放广告的排序。

原文中，微软使用的特征如下所示：

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9ADeep-Crossing%E8%AE%BE%E8%AE%A1%E7%90%86%E5%BF%B5%E5%8F%8A%E5%AE%9E%E7%8E%B0/240818-2.png)

对于一些关键的概念也进行了解释：

| 特征       | 含义                                                   |
| ---------- | ------------------------------------------------------ |
| 搜索词     | 用户在搜索框中输入的搜索词                             |
| 广告关键词 | 广告主为广告添加的描述其产品的关键词                   |
| 广告标题   | 广告标题                                               |
| 落地页     | 点击广告后的落地页面                                   |
| 匹配类型 Match Type   | 广告主选择的广告-搜索词匹配类型（精准，模糊，语义等）  |
| 点击率     | 广告历史点击率                                         |
| 预估点击率 | 另一个CTR模型的CTR预估值                               |
| 广告计划 Campaign   | 广告主创建的广告投放计划，包括预算，定向条件等         |
| 曝光样例   | 一个广告曝光的例子，记录了广告在实际曝光场景的相关信息 |
| 点击样例   | 一个广告点击的例子，记录了广告在实际点击场景的相关信息 |


每个单独的特征都被转为向量，例如对于Query等文本特征，将转为49292维的向量。例如匹配类型的低基数分类输入进行one hot处理。对于一些高基数的特征，例如Campaign ID特征，它表示的是不同的广告计划，通常会有数百万个ID，原作者的思路是根据CampaignID的历史点击率，选择Top10000个，编号从0到9999，将剩余的ID统一编号为10001。同时构建其衍生特征，将所有ID对应的历史点击率组合成10001维的稠密矩阵，各个元素分别为对应ID的历史CTR，最后一个元素为剩余ID的平均CTR。通过降维引入衍生特征的方式，可以有效的减少高基数特征带来的参数量剧增问题。

这也是原图中展示的Campaign ID 10001维度的由来。

文章对特征嵌入没有讲的很明确，翻阅了很多网上的解释，我对这一部分依旧不是很理解。原文针对自己的场景有一些tricks，整体的思想就是将高维稀疏矩阵嵌入为低维稠密矩阵。

嵌入层之后经过Stacking层的拼接，直接传到残差层。

![](/_posts/%E6%8E%A8%E8%8D%90%E7%B3%BB%E7%BB%9F%EF%BC%9ADeep-Crossing%E8%AE%BE%E8%AE%A1%E7%90%86%E5%BF%B5%E5%8F%8A%E5%AE%9E%E7%8E%B0/240818-3.png)

针对ResNet中的残差模块，将原本的卷积核替换为了普通的MLP层。经过多层残差后，输出一个score，用于评估用户是否会点击对应的广告。

# 代码实现

用pytorch实现一下代码，假设特征工程和预处理已经结束，我们需要实现数据集类，模型，训练/预测代码：

```python
class CustomDataset(Dataset):
    def __init__(self, X, y=None):
        self.X = X  # Dataframe
        self.y = y
        
    def __len__(self):
        return len(self.X)
    
    def __getitem__(self, index):
        X_item = torch.tensor(self.X.iloc[index].values, dtype=torch.float32)
        if self.y is not None:
            y_item = torch.tensor(self.y.iloc[index], dtype=torch.float32)
            return X_item, y_item
        return X_item
        
        
train_dataset = CustomDataset(X_train, y_train)
test_dataset = CustomDataset(X_test, y_test)

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
```

定义模型：

```python
class DeepCrossing(nn.Module):
    def __init__(self, input_dims, embedding_dim, residual_dims, output_dim=1):
        super(DeepCrossing, self).__init__()
        
        # 对每维特征进行嵌入
        self.embeddings = nn.ModuleList([
            nn.Linear(input_dim, embedding_dim) if input_dim > embedding_dim else nn.Identity()
            for input_dim in input_dims
        ])
        
        # Stacking layer
        self.stack_dim = sum(embedding_dim if input_dim > embedding_dim else input_dim for input_dim in input_dims)
        
        # 残差块
        self.residual_units = nn.Sequential(
            *[ResidualUnit(self.stack_dim, dim) for dim in residual_dims]
        )
        
        # 评分层
        self.scoring_layer = nn.Linear(self.stack_dim, output_dim)
        
    def forward(self, inputs):
        embedded = [embedding(input) for embedding, input in zip(self.embeddings, inputs)]
        # 直接concat特征
        stacked = torch.cat(embedded, dim=1)
        
        out = self.residual_units(stacked)
        out = torch.sigmoid(self.scoring_layer(out))
        return out

class ResidualUnit(nn.Module):
    def __init__(self, input_dim, hidden_dim):
        super(ResidualUnit, self).__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, input_dim)
        
    def forward(self, x):
        residual = x
        out = F.relu(self.fc1(x))
        out = self.fc2(out)
        out += residual
        return F.relu(out)
```

下面就是训练部分：

```python
# 假设输入维度是10
input_dims = 10

embedding_dim = 8
residual_dims = [64, 128, 64, 32]

model = DeepCrossing(input_dims, embedding_dim, residual_dims)

# 4. 训练模型
criterion = nn.BCELoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

def train(model, train_loader, criterion, optimizer, num_epochs=10):
    model.train()
    for epoch in range(num_epochs):
        running_loss = 0.0
        for inputs, labels in train_loader:
            inputs = [inputs[:, i].unsqueeze(1) for i in range(inputs.shape[1])]
            
            optimizer.zero_grad()
            outputs = model(inputs).squeeze()
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * inputs[0].size(0)
        
        epoch_loss = running_loss / len(train_loader.dataset)
        print(f'Epoch {epoch+1}/{num_epochs}, Loss: {epoch_loss:.4f}')

train(model, train_loader, criterion, optimizer)
```

模型评估：

```python
def evaluate(model, test_loader):
    model.eval()
    predictions = []
    with torch.no_grad():
        for inputs, labels in test_loader:
            inputs = [inputs[:, i].unsqueeze(1) for i in range(inputs.shape[1])]
            outputs = model(inputs).squeeze()
            predictions.extend(outputs.tolist())
    return predictions

predictions = evaluate(model, test_loader)
predictions = np.array(predictions) > 0.5  # 将输出转换为二分类预测
print("Predictions: ", predictions)
```

2024/8/18 于苏州