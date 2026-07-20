---
title: Yolo v5的工程代码实现：超参数与优化策略
date: 2024-04-05 07:47:34
tags:
  - CV
  - 工程实践
  - Yolo
categories: CV
excerpt: Yolo v5的超参数设置相关内容。
index_img: "/img/yolov5.png"
---

在Yolo v5的代码中，训练时有几个需要配置的文件。一个是模型的yaml文件，当中包含了多个参数。

# Model.yaml

我们以最小的yolov5s.yaml为例，它的配置文件如下所示：

```yaml
nc: 80 # 需要预测的分类数
depth_multiple: 0.33 # 网络深度的系数
width_multiple: 0.50 # 网络宽度的系数

# 先验框配置，也可以直接写数字表示聚类数
anchors: # 9个anchor，其中P表示特征图的层级，P3/8该层特征图缩放为1/8,是第3层特征
  - [10, 13, 16, 30, 33, 23] # P3/8 FPN接主干网络下采样8倍后的anchor大小,检测小目标,10,13是一组尺寸，总共三组检测小目标
  - [30, 61, 62, 45, 59, 119] # P4/16 FPN接主干网络下采样4倍后的anchor大小,检测中目标，共三组
  - [116, 90, 156, 198, 373, 326] # P5/32 FPN接主干网络下采样2倍后的anchor大小,检测大目标，共三组

backbone:
  # [from, number, module, args]
  [
    [-1, 1, Conv, [64, 6, 2, 2]], # 0-P1/2
    [-1, 1, Conv, [128, 3, 2]], # 1-P2/4
    [-1, 3, C3, [128]],
    [-1, 1, Conv, [256, 3, 2]], # 3-P3/8
    [-1, 6, C3, [256]],
    [-1, 1, Conv, [512, 3, 2]], # 5-P4/16
    [-1, 9, C3, [512]],
    [-1, 1, Conv, [1024, 3, 2]], # 7-P5/32
    [-1, 3, C3, [1024]],
    [-1, 1, SPPF, [1024, 5]], # 9
  ]

head: [
    [-1, 1, Conv, [512, 1, 1]],
    [-1, 1, nn.Upsample, [None, 2, "nearest"]],
    [[-1, 6], 1, Concat, [1]], # cat backbone P4
    [-1, 3, C3, [512, False]], # 13

    [-1, 1, Conv, [256, 1, 1]],
    [-1, 1, nn.Upsample, [None, 2, "nearest"]],
    [[-1, 4], 1, Concat, [1]], # cat backbone P3
    [-1, 3, C3, [256, False]], # 17 (P3/8-small)

    [-1, 1, Conv, [256, 3, 2]],
    [[-1, 14], 1, Concat, [1]], # cat head P4
    [-1, 3, C3, [512, False]], # 20 (P4/16-medium)

    [-1, 1, Conv, [512, 3, 2]],
    [[-1, 10], 1, Concat, [1]], # cat head P5
    [-1, 3, C3, [1024, False]], # 23 (P5/32-large)

    [[17, 20, 23], 1, Detect, [nc, anchors]], # Detect(P3, P4, P5)
  ]

```

## 网络深度与宽度

第一个需要了解的是这里的是`depth_multiple` 和`width_multiple` 。

`depth_multiple`: 有些模块需要重复n次，这时就会将`depth_multiple`$/times$n来控制模块重复的次数。例如在模型架构图中，包含C3模块如下：
```yaml
# ...省略其余模块
[-1, 3, C3, [128]
[-1, 6, C3, [128]
[-1, 9, C3, [128]
[-1, 3, C3, [128]
```

这里的第二个数字用来控制C3模块中残差模块的个数。这时就将`depth_multiple`乘以它来控制重复的次数，这时实际的残差模块的重复次数为`1,2,3,1`，网络的深度就变浅了。当然，本来就为1的不会变。

> C3模块是一个含有3个卷积层的bottleneck模块。留着以后学习。

![C3](c3.png)

`width_multiple`: 控制某些模块输出的channel数。例如卷积层的channel数，用于控制网络宽度。例如卷积层：

```yaml
[-1, 1, Conv, [64, 6, 2, 2]]
```

其中的`[64, 6, 2, 2]`代表输出通道数，卷积核，步长，Padding。当`width_multiple`为0.5时，输出通道数即为32。

## Anchor

引用链接：

[锚框(anchor box)/先验框(prior bounding box)概念介绍及其生成-CSDN博客](https://blog.csdn.net/qq_46110834/article/details/111410923)

[锚框：Anchor box综述 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/63024247)

Yolov5中使用K-means的聚类来初始化9个锚框。这九个锚框分别在三个检测层的Feature Map上被使用。

尺度越大，Feature Map越大，对原图的下采样越小，感受野也越小，设置的Anchor也越小，对原图的小物体预测效果更好。

> 锚框又称为先验框，在Faster R-CNN中被提出。原先的目标检测方法需要使用固定尺寸的滑动窗口，遍历固定大小的窗口里的像素来判断是否是目标。这样会导致不适合形变较大的物体，并且计算量过大。
>
> 因此Faster R-CNN中加入了RPN（Regional Proposal），区域候选框。它负责找到图像中最可能出现目标分类的候选区域。
>
> 锚框则是人为预先选择好的不同大小的候选框。模型去预测Grounding Truth和锚框的偏移量。
>
> 篇幅有限，之后再学习。

总之，这个参数是对预测图片中的物体大小进行适配。如果检测物体较小，则需要调小。Yolo v5中，如果Anchor只设置为数字，则会调用AutoAnchor，找到最佳的锚框。

在Yaml文件中，Anchors可以看到包含三个列表，表示给三个尺度分配，这三个尺度在[[17, 20, 23], 1, Detect, [nc, anchors]] 指明，分别是网络的第17、20和23层。注释P3/8是指输入下采样了23 = 8倍，我们也可以发现网络的第17层特征图为输入的1/8。

[[17, 20, 23], 1, Detect, [nc, anchors]] 表示把第17、20和23三层作为Detect模块的输入， [nc, anchors]是初始化Detect模块的参数。Detect模块在model/yolo.py中声明，相当于从模型中提出想要的层作为输入，转换为相应的检测头，其输出用来计算loss。

## 网络架构

网络架构分为了Backbone和Head，这两个写法是一样。Yolov5按照配置文件实例化各个层，每行的列表中的四个元素分别代表：[from, number, module, args]：

- from：该层的输入，-1代表上一层
- number：该层的数量
- module：类名
- args：类的初始化参数

# hyp.scrach.yaml

`data/hyps`中存放了默认的初始化超参数。示例如下：

```yaml
lr0: 0.01  # 初始学习率 (SGD=1E-2, Adam=1E-3)
lrf: 0.2  # 循环学习率 (lr0 * lrf)
momentum: 0.937  # SGD momentum/Adam beta1 学习率动量
weight_decay: 0.0005  # 权重衰减系数 
warmup_epochs: 3.0  # 预热学习 (fractions ok)
warmup_momentum: 0.8  # 预热学习动量
warmup_bias_lr: 0.1  # 预热初始学习率
box: 0.05  # iou损失系数
cls: 0.5  # cls损失系数
cls_pw: 1.0  # cls BCELoss正样本权重
obj: 1.0  # 有无物体系数(scale with pixels)
obj_pw: 1.0  # 有无物体BCELoss正样本权重
iou_t: 0.20  # IoU训练时的阈值
anchor_t: 4.0  # anchor的长宽比（长:宽 = 4:1）
# anchors: 3  # 每个输出层的anchors数量(0 to ignore)
```

以下系数是数据增强系数，包括颜色空间和图片空间：

```yaml
fl_gamma: 0.0  # focal loss gamma (efficientDet default gamma=1.5)
hsv_h: 0.015  # 色调 (fraction)
hsv_s: 0.7  # 饱和度 (fraction)
hsv_v: 0.4  # 亮度 (fraction)
degrees: 0.0  # 旋转角度 (+/- deg)
translate: 0.1  # 平移(+/- fraction)
scale: 0.5  # 图像缩放 (+/- gain)
shear: 0.0  # 图像剪切 (+/- deg)
perspective: 0.0  # 透明度 (+/- fraction), range 0-0.001
flipud: 0.0  # 进行上下翻转概率 (probability)
fliplr: 0.5  # 进行左右翻转概率 (probability)
mosaic: 1.0  # 进行Mosaic概率 (probability)
mixup: 0.0  # 进行图像混叠概率（即，多张图像重叠在一起） (probability)
```

此外，在训练时，还可以调整训练超参数，包括训练图片的尺寸，Batch，Epoch等等。

2024/4/8 于苏州
