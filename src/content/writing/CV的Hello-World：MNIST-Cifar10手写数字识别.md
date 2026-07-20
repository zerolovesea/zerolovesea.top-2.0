---
title: "CV的Hello World：MNIST/Cifar10手写数字识别"
description: "基于Pytorch框架实现的MNIST/Cifar10数据集代码。"
pubDate: "2024-02-24 19:10:06"
---

MNIST和Cifar10分类任务可谓是CV界的Hello World。要熟悉Pytorch框架免不了多写几遍代码。这里实现一下代码。

# Cifar10数据集

```python
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
```

定义一下`transforms`，把像素归一化。

```python
transform = transforms.Compose(
[transforms.ToTensor(),
transforms.Normlize((0.5,0.5,0.5),(0.5,0.5,0.5))])

trainset = torchvision.dataset.CIFAR10(root='./data',train=True,download=True,transform=transform)
testset = torchvision.dataset.CIFAR10(root='./data',train=False,download=True,transform=transform)

classes = ('plane', 'car', 'bird', 'cat', 'deer', 'dog', 'frog', 'horse', 'ship', 'truck')
```

接下来定义`dataloader`：

```python
trainloader = DataLoader(trainset, batch_size=4, shuffle=True)
testloader = DataLoader(testset, batch_size=4, shuffle=False)
```

做一下可视化：

```python
import matplotlib.pyplot as plt
import numpy as np

for i in range(12):
    plt.subplot(3, 4, i+1)
    plt.imshow(trainset[i][0].permute(1, 2, 0)) # [channels, heights, weights] ==> [heights, weights, channels]
    plt.title(classes[trainset[i][1]])
    plt.axis('off')

plt.show()
```

![](/_posts/CV%E7%9A%84Hello-World%EF%BC%9AMNIST-Cifar10%E6%89%8B%E5%86%99%E6%95%B0%E5%AD%97%E8%AF%86%E5%88%AB/240224-1.png)接下来就是简单的模型架构：

```python
import torch.nn as nn
import torch.nn.functional as F

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 6, 5)
        self.pool = nn.MaxPool2d(2, 2)
        self.conv2 = nn.Conv2d(6, 16, 5)
        self.fc1 = nn.Linear(16*5*5, 120)
        self.fc2 = nn.Linear(120, 84)
        self.fc3 = nn.Linear(84, 10)
        
    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)
        return x
    
net = Net()
```

接下来定义损失函数和优化器：

```python
import torch.optim as optim

criterion = nn.CrossEntropyLoss()
optimizer = optim.SGD(net.parameters(), lr=0.001, momentum=0.9)
```

开始训练：

```python
for epoch in range(2):
    running_loss = 0.0
    
    for i, (inputs, labels) in enumerate(trainloader):
        optimizer.zero_grad()
        outputs = net(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item()
        if i % 2000 == 1999:
            print(f'epoch: {epoch}, mini batch: {i+1:5d}, loss: {running_loss / 2000:.3f}')
            
print('Finish Training.')
```

保存一下模型：

```python
torch.save(net.state_dict(), './cifar_net.pth')
```

用测试集验证一下：

```python
dataiter = iter(testloader)
images, labels = next(dataiter)

imshow(torchvision.utils.make_grid(images))
print('GroundTruth: ', ' '.join(f'{classes[labels[j]]:5s}' for j in range(4)))
```

```python
correct = 0
total = 0

with torch.no_grad():
    for data in testloader:
        img, labels = data
        outputs = net(images)
        _, prediction = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (prediction == labels).sum().item()
        
print(f'Accuracy on test set: {100 * correct // total}%')
```

也可以对每一类的准确度进行验证：

```python
correct_pred = {classname: 0 for classname in classes}
total_pred = {classname: 0 for classname in classes}

with torch.no_grad():
    for data in testloader:
        images, labels = data
        outputs = net(images)
        _, prediction = torch.max(outputs.data, 1)
        for label, prediction in zip(labels, predictions):
            if label == predictions:
                correct_pred[classes[label]] += 1
            total_pred[classes[label]] += 1
            
for classname, correct_count in correct_pred.items():
    accuracy = 100 * float(correct_count) / total_pred[classname]
    print(f'Accuracy for class: {classname} is {accuracy:.1f} %')
```

# MNIST数据集

直接上代码：

```python
train_dataset = torchvision.datasets.MNIST(root="./data", train=True, transform=transforms.ToTensor(), download=True)
test_dataset = torchvision.datasets.MNIST(root="./data", train=False, transform=transforms.ToTensor(), download=True)

train_loader = torch.utils.data.DataLoader(dataset=train_dataset, batch_size=64, shuffle=True)
test_loader = torch.utils.data.DataLoader(dataset=test_dataset, batch_size=64, shuffle=False)
```

定义模型：

```python
class Net(nn.Module):
    def __init__(self):
        super(Net, self).__init__()
        self.conv1 = nn.Conv2d(1, 10, kernel_size=5)
        self.conv2 = nn.Conv2d(10, 20, kernel_size=5)
        self.pool = nn.MaxPool2d(2)
        self.fc = nn.Linear(320, 10)

    def forward(self, x):
        x = self.pool(nn.functional.relu(self.conv1(x)))
        x = self.pool(nn.functional.relu(self.conv2(x)))
        x = x.view(-1, 320)
        x = self.fc(x)
        return x

net = Net()
```

定义损失函数与优化器：

```python
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)
```

训练：

```python
for epoch in range(4):
    for i, (images, labels) in enumerate(train_loader):
        outputs = model(images)
        loss = criterion(outputs, labels)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if (i+1) % 100 == 0:
            print (f'Epoch: {epoch+1} , Loss:{loss.item():.4f}')           
```

验证：

```python
with torch.no_grad():
    correct = 0
    total = 0
    for images, labels in test_loader:
        images = images.to(device)
        labels = labels.to(device)
        outputs = model(images)
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
    print(f'Accuracy: {100 * correct / total} %')
```

2024/2/24 于苏州家中