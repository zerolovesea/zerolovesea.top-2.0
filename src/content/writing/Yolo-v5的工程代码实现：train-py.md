---
title: "Yolo v5的工程代码实现：train.py"
description: "Yolo v5的训练代码解读与debug。"
pubDate: "2024-04-03 22:01:28"
---

距离上次解读Yolo v5的工程代码又过了一段时间，这次继续debug一下它的`train.py`。

# 导入依赖库

首先就是大段的依赖导入各种库：
```python
import argparse       # 解析命令行参数模块
import math           # 数学公式模块
import os             # 与操作系统进行交互的模块 包含文件路径操作和解析
import random         # 生成随机数的模块
import sys            # sys系统模块 包含了与Python解释器和它的环境有关的函数
import time           # 时间模块 更底层
from copy import deepcopy # 深拷贝模块
from datetime import datetime # 基本日期和时间类型模块
from pathlib import Path # Path模块将str转换为Path对象 使字符串路径易于操作
import subprocess     # 命令行模块

try:
    import comet_ml  # must be imported before torch (if installed)
except ImportError:
    comet_ml = None

import numpy as np
import torch
import torch.distributed as dist
import torch.nn as nn
import yaml
from torch.optim import lr_scheduler # 学习率模块
from tqdm import tqdm
```
这里的`deepcopy`区别于平时的`=`进行赋值，不同在于，`=`只是把对象的内存地址拷贝，最终引用的还是原来的同一个对象。而深拷贝则是完完全全把内容复制成一个新的对象。此时修改这个新对象，不会把老对象的内容改变。

接下来导入自定义模块：

```python
# 获取当前文件的绝对路径，使用Path库将其转换为Path对象
FILE = Path(__file__).resolve()
ROOT = FILE.parents[0]  # YOLOv5的根目录，例如D://yolov5
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))  # add ROOT to PATH
ROOT = Path(os.path.relpath(ROOT, Path.cwd()))  # relative

import val as validate  # for end-of-epoch mAP
from models.experimental import attempt_load # 实验性的代码
from models.yolo import Model # yolo模型
from utils.autoanchor import check_anchors # 定义自动锚框生成的方法
from utils.autobatch import check_train_batch_size # 定义自动生成批次大小的方法
from utils.callbacks import Callbacks # 为日志服务的回调函数
from utils.dataloaders import create_dataloader 
from utils.downloads import attempt_download, is_url
from utils.general import (
    LOGGER,
    TQDM_BAR_FORMAT,
    check_amp,
    check_dataset,
    check_file,
    check_git_info,
    check_git_status,
    check_img_size,
    check_requirements,
    check_suffix,
    check_yaml,
    colorstr,
    get_latest_run,
    increment_path,
    init_seeds,
    intersect_dicts,
    labels_to_class_weights,
    labels_to_image_weights,
    methods,
    one_cycle,
    print_args,
    print_mutation,
    strip_optimizer,
    yaml_save,
)
from utils.loggers import LOGGERS, Loggers
from utils.loggers.comet.comet_utils import check_comet_resume
from utils.loss import ComputeLoss
from utils.metrics import fitness
from utils.plots import plot_evolve # 定义了Annotator类，可以在图像上绘制矩形框和标注信息
from utils.torch_utils import (
    EarlyStopping,
    ModelEMA,
    de_parallel,
    select_device,
    smart_DDP,
    smart_optimizer,
    smart_resume,
    torch_distributed_zero_first,
)
```

# 分布式训练初始化

导包完成后，需要配置一些分布式训练的参数，分别是Local Rank, Rank和World Size。

```python
LOCAL_RANK = int(os.getenv("LOCAL_RANK", -1))  # 当前Worker 是这台机器上的第几个 Worker：当前进程对应的GPU
RANK = int(os.getenv("RANK", -1)) # 当前 Worker 是全局第几个 Worker rank = 0 的主机为 master 节点
WORLD_SIZE = int(os.getenv("WORLD_SIZE", 1)) # 总共有几个Worker 
GIT_INFO = check_git_info()
```

# Train函数

最重要的部分，`train`函数包含四个入参：

- `hyp`：超参数
- `opt`： 命令行参数
- `device`：当前设备
- `callbacks` ：用于存储`Loggers`日志记录器中的函数，方便在每个训练阶段控制日志的记录情况

```python
def train(hyp, opt, device, callbacks):  # hyp is path/to/hyp.yaml or hyp dictionary
	# 先从opt获取参数，包含了日志保存路径，轮次、批次、权重、进程序号(主要用于分布式训练)等
    save_dir, epochs, batch_size, weights, single_cls, evolve, data, cfg, resume, noval, nosave, workers, freeze = (
        Path(opt.save_dir),
        opt.epochs,
        opt.batch_size,
        opt.weights,
        opt.single_cls,
        opt.evolve,
        opt.data,
        opt.cfg,
        opt.resume,
        opt.noval,
        opt.nosave,
        opt.workers,
        opt.freeze,
    )
    callbacks.run("on_pretrain_routine_start")

    # 设置保存权重路径 如runs/train/exp1/weights
    w = save_dir / "weights"  # weights dir
    # 新建文件夹 weights train evolve
    (w.parent if evolve else w).mkdir(parents=True, exist_ok=True)  # make dir
    # 保存训练结果的目录，如last.pt和best.pt
    last, best = w / "last.pt", w / "best.pt"

    # 加载超参数
    if isinstance(hyp, str):
        # 若hyp是字符串，即认定为路径，则加载超参数为字典
        with open(hyp, errors="ignore") as f:
            hyp = yaml.safe_load(f)  # load hyps dict
    LOGGER.info(colorstr("hyperparameters: ") + ", ".join(f"{k}={v}" for k, v in hyp.items()))
    opt.hyp = hyp.copy()  # for saving hyps to checkpoints

    # Save run settings
    if not evolve:
        yaml_save(save_dir / "hyp.yaml", hyp)
        yaml_save(save_dir / "opt.yaml", vars(opt))

    # Loggers
    data_dict = None
    if RANK in {-1, 0}:
        include_loggers = list(LOGGERS)
        if getattr(opt, "ndjson_console", False):
            include_loggers.append("ndjson_console")
        if getattr(opt, "ndjson_file", False):
            include_loggers.append("ndjson_file")
```

这里的`Callback`方法有点像之前看过的装饰器，首先注册某个事件，当运行到特定事件时进行调用。

> hook函数是程序中预定义好的函数，这个函数处于原有程序流程当中（暴露一个钩子出来）。 我们需要再在有流程中钩子定义的函数块中实现某个具体的细节，需要把我们的实现，挂接或者注册（register）到钩子里，使得hook函数对目标可用。

hook函数最常使用在某种流程处理当中。这个流程往往有很多步骤。hook函数常常挂载在这些步骤中，为增加额外的一些操作，提供灵活性。

yolov5训练流程中，hook函数在一个训练过程中，会轮询多次训练集，每次称为一个epoch，每个epoch又分为多个batch来训练。 流程先后拆解成:

- 开始训练
- 训练一个epoch前
- 训练一个batch前
- 训练一个batch后
- 训练一个epoch后。
- 评估验证集
- 结束训练

这些步骤是穿插在训练一个batch数据的过程中，这些可以理解成是钩子函数，我们可能需要在这些钩子函数中实现一些定制化的东西，比如在训练一个epoch后我们要保存下训练的损失，这时候我们就需要按照以下流程执行：

```python
# 要向其注册操作的回调钩子名称
callbacks.register_action(hook = "on_pretrain_routine_start",name = "log_function" , callback=on_pretrain_routine_start)
# 调用hook，test_kwargs是on_pretrain_routine_start事件对应钩子函数的入参
callbacks.run("on_pretrain_routine_start","test_kwargs")
# 打印hook信息
callbacks.get_registered_actions("on_pretrain_routine_start")
```

以下是源码：

```python
import threading

class Callbacks:
    """" Handles all registered callbacks for YOLOv5 Hooks."""

    def __init__(self):
        # Define the available callbacks
        self._callbacks = {
            "on_pretrain_routine_start": [],
            "on_pretrain_routine_end": [],
            "on_train_start": [],
            "on_train_epoch_start": [],
            "on_train_batch_start": [],
            "optimizer_step": [],
            "on_before_zero_grad": [],
            "on_train_batch_end": [],
            "on_train_epoch_end": [],
            "on_val_start": [],
            "on_val_batch_start": [],
            "on_val_image_end": [],
            "on_val_batch_end": [],
            "on_val_end": [],
            "on_fit_epoch_end": [],  # fit = train + val
            "on_model_save": [],
            "on_train_end": [],
            "on_params_update": [],
            "teardown": [],
        }
        self.stop_training = False  # set True to interrupt training

    def register_action(self, hook, name="", callback=None):
        """
        Register a new action to a callback hook.

        Args:
            hook: 要向其注册操作的回调钩子名称
            name: 动作的名称，供以后参考
            callback: 对fire的回调
        """
        assert hook in self._callbacks, f"hook '{hook}' not found in callbacks {self._callbacks}"
        assert callable(callback), f"callback '{callback}' is not callable"
        self._callbacks[hook].append({"name": name, "callback": callback})

    def get_registered_actions(self, hook=None):
        """
        " Returns all the registered actions by callback hook.

        Args:
            hook: 需要检查的钩子函数名
        """
        return self._callbacks[hook] if hook else self._callbacks

    def run(self, hook, *args, thread=False, **kwargs):
        """
        Loop through the registered actions and fire all callbacks on main thread.

        Args:
            hook: 需要检查的钩子函数名
            args: 从YoloV5接收的参数
            thread: (boolean) 是否在线程中执行
            kwargs: 从YoloV5接收的Keyword
        """

        assert hook in self._callbacks, f"hook '{hook}' not found in callbacks {self._callbacks}"
        for logger in self._callbacks[hook]:
            if thread:
                threading.Thread(target=logger["callback"], args=args, kwargs=kwargs, daemon=True).start()
            else:
                logger["callback"](*args, **kwargs)
```

随后是加载日志信息：

```python
        loggers = Loggers(
            save_dir=save_dir,
            weights=weights,
            opt=opt,
            hyp=hyp,
            logger=LOGGER,
            include=tuple(include_loggers),
        )

        # Register actions
        for k in methods(loggers):
        	# 将日志记录器中的方法与字符串进行绑定
            callbacks.register_action(k, callback=getattr(loggers, k))

        # Process custom dataset artifact link
        data_dict = loggers.remote_dataset
        if resume:  # If resuming runs from remote artifact
            weights, epochs, hyp, batch_size = opt.weights, opt.epochs, opt.hyp, opt.batch_size
```

加载其他参数：

```python
    # Config
    # 是否绘图，使用进化算法则不绘制
    plots = not evolve and not opt.noplots  # create plots
    cuda = device.type != "cpu"
    # 随机种子
    init_seeds(opt.seed + 1 + RANK, deterministic=True)
    
    # 同步所有进程
    with torch_distributed_zero_first(LOCAL_RANK):
    	# 检查数据集，如果没找到数据集则下载数据集(仅适用于项目中自带的yaml文件数据集)
        data_dict = data_dict or check_dataset(data)  # check if None
    # 获取训练集、测试集图片路径
    train_path, val_path = data_dict["train"], data_dict["val"]
    
    # nc：数据集有多少种类别
    nc = 1 if single_cls else int(data_dict["nc"])  # number of classes
    # names: 数据集所有类别的名字，如果设置了single_cls则为一类
    names = {0: "item"} if single_cls and len(data_dict["names"]) != 1 else data_dict["names"]  # class names
    
    # 当前数据集是否是coco数据集(80个类别)
    is_coco = isinstance(val_path, str) and val_path.endswith("coco/val2017.txt")  # COCO dataset
```

下一段是预训练模型的加载：

```python
    # 模型加载/断点续传
    # 检查文件后缀是否是.pt
    check_suffix(weights, ".pt")  # check weights
    # 加载预训练权重
    pretrained = weights.endswith(".pt")
    if pretrained:
    	# 用于同步不同进程对数据读取的上下文管理器
        with torch_distributed_zero_first(LOCAL_RANK):
            # 如果本地不存在就从google云盘中自动下载模型
            # 建议提前下载下来放进weights目录
            weights = attempt_download(weights)  # download if not found locally
            
        # 加载模型及参数，加载到CPU以防止显存泄露
        ckpt = torch.load(weights, map_location="cpu")  # load checkpoint to CPU to avoid CUDA memory leak
        
        # 加载模型
        model = Model(cfg or ckpt["model"].yaml, ch=3, nc=nc, anchors=hyp.get("anchors")).to(device)  # create
        
        # 若cfg 或 hyp.get('anchors')不为空且不使用中断训练 exclude=['anchor'] 否则 exclude=[]
        exclude = ["anchor"] if (cfg or hyp.get("anchors")) and not resume else []  # exclude keys
        
        # 将预训练模型中的所有参数保存下来，赋值给csd
        csd = ckpt["model"].float().state_dict()  # checkpoint state_dict as FP32
        # 判断预训练参数和新创建的模型参数有多少是相同的
        # 筛选字典中的键值对，把exclude删除
        csd = intersect_dicts(csd, model.state_dict(), exclude=exclude)  # intersect
        
        # 模型创建
        model.load_state_dict(csd, strict=False)  # load
        LOGGER.info(f"Transferred {len(csd)}/{len(model.state_dict())} items from {weights}")  # report
    else:
    	# 直接加载模型，ch为输入图片通道
        model = Model(cfg, ch=3, nc=nc, anchors=hyp.get("anchors")).to(device)  # create
    amp = check_amp(model)  # check AMP
```

这里有几个函数需要看一下：

```python
@contextmanager
def torch_distributed_zero_first(local_rank: int):
    if local_rank not in [-1, 0]:
        dist.barrier(device_ids=[local_rank])
    yield
    if local_rank == 0:
        dist.barrier(device_ids=[0])
```

这里的核心是`dist.barrier()`。是 PyTorch 分布式训练中用于同步进程的一种机制，它能够在所有进程到达同一个 barrier 时进行同步，等待所有进程都完成操作之后才能继续执行。

具体来说，当一个进程调用 `dist.barrier()` 时，它会阻塞等待其他进程也到达该点。只有当所有进程都到达该 barrier 点时，它们才会被释放，然后可以继续执行后面的代码。

这个方法用来确保非主进程在等待主进程执行某些操作的时候不会执行其他操作，而主进程在完成操作后会等待其他进程到达同步点。


另一个重要的点是`@contextmanager`和`yield`。它用来简化上下文管理。

加载模型这边用了`Model`方法，这个方法来自于`DetectionModel`类。源码如下：

```python
class DetectionModel(BaseModel):
    # YOLOv5 检测模型
    def __init__(self, cfg="yolov5s.yaml", ch=3, nc=None, anchors=None):  # model, input channels, number of classes
        super().__init__()
        if isinstance(cfg, dict):
            self.yaml = cfg  # 模型字典
        else:  # yaml文件
            import yaml  # for torch hub

            self.yaml_file = Path(cfg).name
            with open(cfg, encoding="ascii", errors="ignore") as f:
                self.yaml = yaml.safe_load(f)  # model dict

        # 定义模型
        ch = self.yaml["ch"] = self.yaml.get("ch", ch)  # 从模型的yaml文件中拿到input channels
        if nc and nc != self.yaml["nc"]:
            LOGGER.info(f"Overriding model.yaml nc={self.yaml['nc']} with nc={nc}")
            self.yaml["nc"] = nc  # 覆写yaml value
        if anchors:
            LOGGER.info(f"Overriding model.yaml anchors with anchors={anchors}")
            self.yaml["anchors"] = round(anchors)  # 使用hyp的anchors覆写yaml的anchors
        self.model, self.save = parse_model(deepcopy(self.yaml), ch=[ch])  # model, savelist
        self.names = [str(i) for i in range(self.yaml["nc"])]  # default names
        self.inplace = self.yaml.get("inplace", True)

        # Build strides, anchors
        m = self.model[-1]  # Detect()
        if isinstance(m, (Detect, Segment)):
            s = 256  # 2x min stride
            m.inplace = self.inplace
            forward = lambda x: self.forward(x)[0] if isinstance(m, Segment) else self.forward(x)
            m.stride = torch.tensor([s / x.shape[-2] for x in forward(torch.zeros(1, ch, s, s))])  # forward
            check_anchor_order(m)
            m.anchors /= m.stride.view(-1, 1, 1)
            self.stride = m.stride
            self._initialize_biases()  # only run once

        # Init weights, biases
        initialize_weights(self)
        self.info()
        LOGGER.info("")

    def forward(self, x, augment=False, profile=False, visualize=False):
        if augment:
            return self._forward_augment(x)  # augmented inference, None
        return self._forward_once(x, profile, visualize)  # single-scale inference, train

    def _forward_augment(self, x):
        img_size = x.shape[-2:]  # height, width
        s = [1, 0.83, 0.67]  # scales
        f = [None, 3, None]  # flips (2-ud, 3-lr)
        y = []  # outputs
        for si, fi in zip(s, f):
            xi = scale_img(x.flip(fi) if fi else x, si, gs=int(self.stride.max()))
            yi = self._forward_once(xi)[0]  # forward
            yi = self._descale_pred(yi, fi, si, img_size)
            y.append(yi)
        y = self._clip_augmented(y)  # clip augmented tails
        return torch.cat(y, 1), None  # augmented inference, train

    def _descale_pred(self, p, flips, scale, img_size):
        # de-scale predictions following augmented inference (inverse operation)
        if self.inplace:
            p[..., :4] /= scale  # de-scale
            if flips == 2:
                p[..., 1] = img_size[0] - p[..., 1]  # de-flip ud
            elif flips == 3:
                p[..., 0] = img_size[1] - p[..., 0]  # de-flip lr
        else:
            x, y, wh = p[..., 0:1] / scale, p[..., 1:2] / scale, p[..., 2:4] / scale  # de-scale
            if flips == 2:
                y = img_size[0] - y  # de-flip ud
            elif flips == 3:
                x = img_size[1] - x  # de-flip lr
            p = torch.cat((x, y, wh, p[..., 4:]), -1)
        return p

    def _clip_augmented(self, y):
        # Clip YOLOv5 augmented inference tails
        nl = self.model[-1].nl  # number of detection layers (P3-P5)
        g = sum(4**x for x in range(nl))  # grid points
        e = 1  # exclude layer count
        i = (y[0].shape[1] // g) * sum(4**x for x in range(e))  # indices
        y[0] = y[0][:, :-i]  # large
        i = (y[-1].shape[1] // g) * sum(4 ** (nl - 1 - x) for x in range(e))  # indices
        y[-1] = y[-1][:, i:]  # small
        return y

    def _initialize_biases(self, cf=None): 
        m = self.model[-1]  # Detect() module
        for mi, s in zip(m.m, m.stride):  # from
            b = mi.bias.view(m.na, -1)  # conv.bias(255) to (3,85)
            b.data[:, 4] += math.log(8 / (640 / s) ** 2)  # obj (8 objects per 640 image)
            b.data[:, 5 : 5 + m.nc] += (
                math.log(0.6 / (m.nc - 0.99999)) if cf is None else torch.log(cf / cf.sum())
            )  # cls
            mi.bias = torch.nn.Parameter(b.view(-1), requires_grad=True)
```
`parse_model`方法的两个入参分别是`d`, `ch`。前者是模型字典，后者是输入通道数。它会遍历读取模型的文件，然后返回一个搭好的nn.Sequential()，也就是搭好的模型。

在加载模型后，可以对模型进一些调整：

```python
    # 冻结层
    """
    冻结模型层,设置冻结层名字即可
    作用：冰冻一些层，就使得这些层在反向传播的时候不再更新权重,需要冻结的层,可以写在freeze列表中
    freeze为命令行参数，默认为0，表示不冻结
    """    

    freeze = [f"model.{x}." for x in (freeze if len(freeze) > 1 else range(freeze[0]))]  # layers to freeze
    
    # 遍历所有层
    for k, v in model.named_parameters():
    	# 为所有层的参数设置梯度
        v.requires_grad = True  # train all layers
		# 冻结训练的层，梯度不更新
        if any(x in k for x in freeze):
            LOGGER.info(f"freezing {k}")
            v.requires_grad = False
```

模型设置完就是设置一些训练参数：

```python
    # 图片大小/batch size设置
    # 获取模型总步长和模型输入图片分辨率
    gs = max(int(model.stride.max()), 32)  # grid size (max stride)
    # 检查输入图片分辨率是否能被32整除
    imgsz = check_img_size(opt.imgsz, gs, floor=gs * 2)  # verify imgsz is gs-multiple

    # 设置Batch size
    if RANK == -1 and batch_size == -1:  # single-GPU only, estimate best batch size
        # 确保batch size满足要求
        batch_size = check_train_batch_size(model, imgsz, amp)
        loggers.on_params_update({"batch_size": batch_size})

    # 优化器设置/分组优化设置
    nbs = 64  # nominal batch size
    accumulate = max(round(nbs / batch_size), 1)  # accumulate loss before optimizing
    
    # 根据accumulate设置权重衰减参数，防止过拟合
    hyp["weight_decay"] *= batch_size * accumulate / nbs  # scale weight_decay
```

这里有几个参数需要注意：

- `nbs`: nominal batch size，名义上的batch_size。这里的nbs跟命令行参数中的batch_size不同，命令行中的batch_size默认为16，nbs设置为64。

- `accumulate`: 累计次数，在这里 nbs/batch_size（64/16）计算出 opt.batch_size输入多少批才达到nbs的水平。简单来说，nbs为64，代表想要达到的batch_size，这里的数值是64；batch_size为opt.batch_size，这里的数值是16。64/16等于4，也就是opt.batch_size需要输入4批才能达到nbs，accumulate等于4。(round表示四舍五入取整数，而max表示accumulate不能低于1。)

- 当给模型喂了4批图片数据后，将四批图片数据得到的梯度值，做累积。当每累积到4批数据时，才会对参数做更新，这样就实现了与batch_size=64时相同的效果。
  
- 最后还要做权重参数的缩放，因为batch_size发生了变化，所有权重参数也要做相应的缩放。
  
```python  
    # 设置优化器
    optimizer = smart_optimizer(model, opt.optimizer, hyp["lr0"], hyp["momentum"], hyp["weight_decay"])

    # 学习率/EMA/归一化
    # 是否选择余弦退火学习率
    if opt.cos_lr:
        lf = one_cycle(1, hyp["lrf"], epochs)  # cosine 1->hyp['lrf']
    else:
    	# 线性学习率，通过线性插值的方式调整学习率
        lf = lambda x: (1 - x / epochs) * (1.0 - hyp["lrf"]) + hyp["lrf"]  # linear
    scheduler = lr_scheduler.LambdaLR(optimizer, lr_lambda=lf)  # plot_lr_scheduler(optimizer, scheduler, epochs)
```

训练前最后准备：

```python
    # EMA （指数移动平均），考虑历史值对参数的影响，目的是为了收敛的曲线更加平滑
    # 为模型创建EMA指数滑动平均,如果GPU进程数大于1,则不创建
    ema = ModelEMA(model) if RANK in {-1, 0} else None

    # Resume 断点续训
    # 断点续训其实就是把上次训练结束的模型作为预训练模型，并从中加载参数
    best_fitness, start_epoch = 0.0, 0
    
    # 如果有预训练
    if pretrained:
        if resume:
        	# Epochs 加载训练的迭代次数
        	# start_epoch是从上次的epoch接着训练
            best_fitness, start_epoch, epochs = smart_resume(ckpt, optimizer, ema, weights, epochs, resume)
        # 将预训练的相关参数从内存中删除
        del ckpt, csd

    # DP mode 使用单机多卡模式训练，目前一般不使用
    # rank为进程编号。如果rank=-1且gpu数量>1则使用DataParallel单机多卡模式，效果并不好（分布不平均）
    # rank=-1且gpu数量=1时,不会进行分布式
    if cuda and RANK == -1 and torch.cuda.device_count() > 1:
        LOGGER.warning(
            "WARNING ⚠️ DP not recommended, use torch.distributed.run for best DDP Multi-GPU results.\n"
            "See Multi-GPU Tutorial at https://docs.ultralytics.com/yolov5/tutorials/multi_gpu_training to get started."
        )
        model = torch.nn.DataParallel(model)
	
	# SyncBatchNorm  多卡的BN归一化
    if opt.sync_bn and cuda and RANK != -1:
        model = torch.nn.SyncBatchNorm.convert_sync_batchnorm(model).to(device)
        LOGGER.info("Using SyncBatchNorm()")
```

总结一下，加载模型这边主要做了四件事：

（1）载入模型：载入模型(预训练/不预训练) + 检查数据集 + 设置数据集路径参数(train_path、test_path) + 设置冻结层

（2）优化器：参数设置(`nbs`、`accumulate`、`hyp['weight_decay']`) + 分组优化(pg0、pg1、pg2) + 选择优化器 + 为三个优化器选择优化方式 + 删除变量

（3）学习率：线性学习率 + one cycle学习率 + 实例化 scheduler + 画出学习率变化曲线

（4）训练前最后准备：EMA + 断点续训+ 迭代次数的加载 + DP + SyncBatchNorm）

加载数据集:

```python
    # Trainloader 数据加载/Anchor调整
    '''
    返回一个训练数据加载器，一个数据集对象:
    训练数据加载器是一个可迭代的对象，可以通过for循环加载1个batch_size的数据
    数据集对象包括数据集的一些参数，包括所有标签值、所有的训练数据路径、每张图片的尺寸等等
    '''
    train_loader, dataset = create_dataloader(
        train_path,
        imgsz,
        batch_size // WORLD_SIZE,
        gs,
        single_cls,
        hyp=hyp,
        augment=True,
        cache=None if opt.cache == "val" else opt.cache,
        rect=opt.rect,
        rank=LOCAL_RANK,
        workers=workers,
        image_weights=opt.image_weights,
        quad=opt.quad,
        prefix=colorstr("train: "),
        shuffle=True,
        seed=opt.seed,
    )
    labels = np.concatenate(dataset.labels, 0)
    
    # 标签编号最大值
    mlc = int(labels[:, 0].max())  # max label class
    
    # 如果小于类别数则表示有问题
    assert mlc < nc, f"Label class {mlc} exceeds nc={nc} in {data}. Possible class labels are 0-{nc - 1}"

    # Process 0 验证集数据集加载
    if RANK in {-1, 0}:
        val_loader = create_dataloader(
            val_path,
            imgsz,
            batch_size // WORLD_SIZE * 2,
            gs,
            single_cls,
            hyp=hyp,
            cache=None if noval else opt.cache,
            rect=True,
            rank=-1,
            workers=workers * 2,
            pad=0.5,
            prefix=colorstr("val: "),
        )[0]
```

Anchor锚框计算：

```python
		# 如果没有断点续传
        if not resume:
        	# Anchors 计算默认锚框anchor与数据集标签框的高宽比
            if not opt.noautoanchor:
            	# 进行自动锚框设置
                check_anchors(dataset, model=model, thr=hyp["anchor_t"], imgsz=imgsz)  # run AutoAnchor
                '''
                参数dataset代表的是训练集，hyp['anchor_t']是从配置文件hpy.scratch.yaml读取的超参数，anchor_t:4.0
                当配置文件中的anchor计算bpr（best possible recall）小于0.98时才会重新计算anchor。
                best possible recall最大值1，如果bpr小于0.98，程序会根据数据集的label自动学习anchor的尺寸
                '''
            # 模型半精度
            model.half().float()  # pre-reduce anchor precision
		# 在每个训练前例行程序结束时触发所有已注册的回调
        callbacks.run("on_pretrain_routine_end", labels, names)

    # 训练配置/多尺度训练/热身训练
    if cuda and RANK != -1:
        model = smart_DDP(model)
```

现在进入训练过程：

```python
	# 模型初始化
    # Model attributes 根据自己数据集的类别数和网络FPN层数设置各个损失的系数
    nl = de_parallel(model).model[-1].nl  # number of detection layers (to scale hyps)
    # box为预测框的损失
    hyp["box"] *= 3 / nl  # scale to layers
    # cls为分类的损失
    hyp["cls"] *= nc / 80 * 3 / nl  # scale to classes and layers
    # obj为置信度损失
    hyp["obj"] *= (imgsz / 640) ** 2 * 3 / nl  # scale to image size and layers
    # 标签平滑
    hyp["label_smoothing"] = opt.label_smoothing
    # 设置模型的类别，然后将检测的类别个数保存到模型
    model.nc = nc  
    # 设置模型的超参数，然后将超参数保存到模型
    model.hyp = hyp  
    # 从训练的样本标签得到类别权重，然后将类别权重保存至模型
    model.class_weights = labels_to_class_weights(dataset.labels, nc).to(device) * nc  # attach class weights
    # 获取类别的名字，然后将分类标签保存至模型
    model.names = names
```

训练热身部分：

```python
    # Start training
    t0 = time.time()
    # Batch数量
    nb = len(train_loader)  # number of batches
    # 获取热身训练的迭代次数
    nw = max(round(hyp["warmup_epochs"] * nb), 100)  # number of warmup iterations, max(3 epochs, 100 iterations)
    # nw = min(nw, (epochs - start_epoch) / 2 * nb)  # limit warmup to < 1/2 of training
    last_opt_step = -1
    
    # 初始化 map和result，每个class都为0
    maps = np.zeros(nc)  # mAP per class
    results = (0, 0, 0, 0, 0, 0, 0)  # P, R, mAP@.5, mAP@.5-.95, val_loss(box, obj, cls)
    # 设置学习率衰减所进行到的轮次，即使打断训练，使用resume接着训练也能正常衔接之前的训练进行学习率衰减
    scheduler.last_epoch = start_epoch - 1  # do not move
    # 设置amp混合精度训练
    scaler = torch.cuda.amp.GradScaler(enabled=amp)
    # 早停，不更新结束训练
    stopper, stop = EarlyStopping(patience=opt.patience), False
    # 初始化损失函数
    compute_loss = ComputeLoss(model)  # init loss class
    callbacks.run("on_train_start")
    LOGGER.info(
        f'Image sizes {imgsz} train, {imgsz} val\n'
        f'Using {train_loader.num_workers * WORLD_SIZE} dataloader workers\n'
        f"Logging results to {colorstr('bold', save_dir)}\n"
        f'Starting training for {epochs} epochs...'
    )
```

开始训练：

```python
    for epoch in range(start_epoch, epochs):  # epoch ------------------------------------------------------------------
        callbacks.run("on_train_epoch_start")
        model.train()

        # Update image weights (optional, single-GPU only)
        # 获取图片采样的权重
        if opt.image_weights:
        	# 经过一轮训练，若哪一类的不精确度高，那么这个类就会被分配一个较高的权重，来增加它被采样的概率
            cw = model.class_weights.cpu().numpy() * (1 - maps) ** 2 / nc  # class weights
            # 将计算出的权重换算到图片的维度，将类别的权重换算为图片的权重
            iw = labels_to_image_weights(dataset.labels, nc=nc, class_weights=cw)  # image weights
            # 通过random.choices生成图片索引indices从而进行采样，这时图像会包含一些难识别的样本
            dataset.indices = random.choices(range(dataset.n), weights=iw, k=dataset.n)  # rand weighted idx
```

上面这段代码主要在做两件事：

1. 模型训练
2. 更新图片权重：有些类的准确率难以识别，准确率并不会很高。在更新图片权重时就会把这些难以识别的类挑出来，并为这个类产生一些权重高的图片，以这种方式来增加识别率低的类别的数据量。提高准确率。

```python
        mloss = torch.zeros(3, device=device)  # mean losses
        # 分布式训练的设置
        # DDP模式打乱数据，并且dpp.sampler的随机采样数据是基于epoch+seed作为随机种子，每次epoch不同，随机种子不同
        if RANK != -1:
            train_loader.sampler.set_epoch(epoch)
            
        # 将训练数据迭代器做枚举，可以遍历出索引值
        pbar = enumerate(train_loader)
        LOGGER.info(("\n" + "%11s" * 7) % ("Epoch", "GPU_mem", "box_loss", "obj_loss", "cls_loss", "Instances", "Size"))
        if RANK in {-1, 0}:
        	# 通过tqdm创建进度条，方便训练信息的展示
            pbar = tqdm(pbar, total=nb, bar_format=TQDM_BAR_FORMAT)  # progress bar
        # 优化器中所有参数清零
        optimizer.zero_grad()
```

接下来是对单个Batch的训练：

```python
        for i, (imgs, targets, paths, _) in pbar:  # batch -------------------------------------------------------------
            callbacks.run("on_train_batch_start")
            # ni: 计算当前迭代次数 iteration
            ni = i + nb * epoch  # number integrated batches (since train start)
            # 将图片加载至设备 并做归一化
            imgs = imgs.to(device, non_blocking=True).float() / 255  # uint8 to float32, 0-255 to 0.0-1.0
            '''
            热身训练(前nw次迭代),热身训练迭代的次数iteration范围[1:nw] 
            在前nw次迭代中, 根据以下方式选取accumulate和学习率
            '''
            # Warmup
            if ni <= nw:
                xi = [0, nw]  # x interp
                # compute_loss.gr = np.interp(ni, xi, [0.0, 1.0])  # iou loss ratio (obj_loss = 1.0 or iou)
                accumulate = max(1, np.interp(ni, xi, [1, nbs / batch_size]).round())
                
                # 遍历优化器中的所有参数组
                for j, x in enumerate(optimizer.param_groups):
                    # bias lr falls from 0.1 to lr0, all other lrs rise from 0.0 to lr0
                    """
                    bias的学习率从0.1下降到基准学习率lr*lf(epoch)，
                    其他的参数学习率从0增加到lr*lf(epoch).
                    lf为上面设置的余弦退火的衰减函数
                    """
                    x["lr"] = np.interp(ni, xi, [hyp["warmup_bias_lr"] if j == 0 else 0.0, x["initial_lr"] * lf(epoch)])
                    if "momentum" in x:
                        x["momentum"] = np.interp(ni, xi, [hyp["warmup_momentum"], hyp["momentum"]])

            # Multi-scale 设置多尺度训练，从imgsz * 0.5, imgsz * 1.5 + gs随机选取尺寸
            # imgsz: 默认训练尺寸   gs: 模型最大stride=32   [32 16 8]       
            if opt.multi_scale:
                sz = random.randrange(int(imgsz * 0.5), int(imgsz * 1.5) + gs) // gs * gs  # size
                sf = sz / max(imgs.shape[2:])  # scale factor
                if sf != 1:
                    ns = [math.ceil(x * sf / gs) * gs for x in imgs.shape[2:]]  # new shape (stretched to gs-multiple)
                    # 下采样
                    imgs = nn.functional.interpolate(imgs, size=ns, mode="bilinear", align_corners=False)
```

前向传播：

```python
            # Forward
            with torch.cuda.amp.autocast(amp):
            	# 推理
                pred = model(imgs)  # forward
                # 计算三个损失：分类损失，置信度损失，框损失
                loss, loss_items = compute_loss(pred, targets.to(device))  # loss scaled by batch_size
                if RANK != -1:
                
                	# 采用DDP训练,平均不同gpu之间的梯度
                    loss *= WORLD_SIZE  # gradient averaged between devices in DDP mode
                if opt.quad:
                    loss *= 4.0

            # Backward 反向传播 scale为使用自动混合精度运算
            scaler.scale(loss).backward()

            # Optimize 
            # 模型会对多批数据进行累积，只有达到累计次数的时候才会更新参数，再还没有达到累积次数时 loss会不断的叠加 不会被新的反向传播替代
            if ni - last_opt_step >= accumulate:      
                scaler.unscale_(optimizer)  # unscale gradients
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=10.0)  # clip gradients
                
                # 参数更新
                scaler.step(optimizer)  # optimizer.step
                scaler.update()
                
                # 梯度清零
                optimizer.zero_grad()
                if ema:
                    ema.update(model)
                
                # 计数
                last_opt_step = ni

            # Log
            if RANK in {-1, 0}:
                mloss = (mloss * i + loss_items) / (i + 1)  # update mean losses
                mem = f"{torch.cuda.memory_reserved() / 1E9 if torch.cuda.is_available() else 0:.3g}G"  # (GB)
                pbar.set_description(
                    ("%11s" * 2 + "%11.4g" * 5)
                    % (f"{epoch}/{epochs - 1}", mem, *mloss, targets.shape[0], imgs.shape[-1])
                )
                callbacks.run("on_train_batch_end", model, ni, imgs, targets, paths, list(mloss))
                if callbacks.stop_training:
                    return
            # end batch ------------------------------------------------------------------------------------------------

        # 进行学习率衰减
        lr = [x["lr"] for x in optimizer.param_groups]  # for loggers
        scheduler.step()
```

模型保存：

```python
        if RANK in {-1, 0}:
            # mAP
            callbacks.run("on_train_epoch_end", epoch=epoch)
            
            # 将model中的属性赋值给ema
            ema.update_attr(model, include=["yaml", "nc", "hyp", "names", "stride", "class_weights"])
            
            # 判断当前epoch是否是最后一轮
            final_epoch = (epoch + 1 == epochs) or stopper.possible_stop
            if not noval or final_epoch:  # Calculate mAP
                """
                测试使用的是ema（指数移动平均 对模型的参数做平均）的模型
                       results: [1] Precision 所有类别的平均precision(最大f1时)
                                [1] Recall 所有类别的平均recall
                                [1] map@0.5 所有类别的平均mAP@0.5
                                [1] map@0.5:0.95 所有类别的平均mAP@0.5:0.95
                                [1] box_loss 验证集回归损失, obj_loss 验证集置信度损失, cls_loss 验证集分类损失
                       maps: [80] 所有类别的mAP@0.5:0.95
                """            
                results, maps, _ = validate.run(
                    data_dict, # 数据集配置文件地址 包含数据集的路径、类别个数、类名、下载地址等信息
                    batch_size=batch_size // WORLD_SIZE * 2, # 要保证batch_size能整除卡数
                    imgsz=imgsz,
                    half=amp,
                    model=ema.ema,
                    single_cls=single_cls,
                    dataloader=val_loader,
                    save_dir=save_dir,
                    plots=False,
                    callbacks=callbacks,
                    compute_loss=compute_loss,
                )

            # 更新best_fitness
            # fi: [P, R, mAP@.5, mAP@.5-.95]的一个加权值 = 0.1*mAP@.5 + 0.9*mAP@.5-.95
            fi = fitness(np.array(results).reshape(1, -1))  
            # 检查是否早停
            stop = stopper(epoch=epoch, fitness=fi)  # early stop check
            
            # 若当前的fitness大于最佳的fitness
            if fi > best_fitness:
            	# 将最佳fitness更新为当前fitness
                best_fitness = fi
                
            # 保存验证结果
            log_vals = list(mloss) + list(results) + lr
            callbacks.run("on_fit_epoch_end", log_vals, epoch, best_fitness, fi)
```

保存模型：

```python
            # Save model
            """
            保存带checkpoint的模型用于inference或resuming training
            保存模型, 还保存了epoch, results, optimizer等信息
            optimizer将不会在最后一轮完成后保存
            model保存的是EMA的模型
            """            
            if (not nosave) or (final_epoch and not evolve):  # if save
            	# 将当前训练过程中的所有参数赋值给ckpt
                ckpt = {
                    "epoch": epoch,
                    "best_fitness": best_fitness,
                    "model": deepcopy(de_parallel(model)).half(),
                    "ema": deepcopy(ema.ema).half(),
                    "updates": ema.updates,
                    "optimizer": optimizer.state_dict(),
                    "opt": vars(opt),
                    "git": GIT_INFO,  # {remote, branch, commit} if a git repo
                    "date": datetime.now().isoformat(),
                }

                # Save last, best and delete 保存每轮的模型
                torch.save(ckpt, last)
                
                # 如果这个模型的fitness是最佳的
                if best_fitness == fi:
                    torch.save(ckpt, best)
                if opt.save_period > 0 and epoch % opt.save_period == 0:
                    torch.save(ckpt, w / f"epoch{epoch}.pt")
                    
                # 模型保存完毕 将变量从内存中删除
                del ckpt
                callbacks.run("on_model_save", last, epoch, final_epoch, best_fitness, fi)

        # EarlyStopping
        if RANK != -1:  # if DDP training
            broadcast_list = [stop if RANK == 0 else None]
            dist.broadcast_object_list(broadcast_list, 0)  # broadcast 'stop' to all ranks
            if RANK != 0:
                stop = broadcast_list[0]
        if stop:
            break  # must break all DDP ranks

        # end epoch ----------------------------------------------------------------------------------------------------
    # end training -----------------------------------------------------------------------------------------------------
```

总结一下训练过程，同样分为四块：

（1）初始化训练需要的模型参数：设置/初始化一些训练要用的参数(`hyp['box']`、`hyp['cls']`、`hyp['obj']`、`hyp['label_smoothing']`）+ 从训练样本标签得到类别权重`model.class_weights`、`model.names`。

（2）热身部分：热身迭代的次数`iterationsnw`、`last_opt_step`、初始化maps和results、学习率衰减所进行到的轮次`scheduler.last_epoch` + 设置amp混合精度训练`scaler` + 初始化损失函数`compute_loss` + 打印日志信息)

（3）开始训练：图片采样策略 + `Warmup`热身训练 + `multi_scale`多尺度训练 + amp混合精度训练 +  `accumulate` 梯度更新策略+ 打印训练相关信息(包括当前epoch、显存、损失(box、obj、cls、total) + 当前batch的target的数量和图片的size等  + 调整学习率、`scheduler.step()`、`emp val.run()`得到results, maps相关信息

（4）训练完成保存模型：将测试结果results写入日志，更新best mAP，以加权mAP fitness为衡量标准+保存模型


```python    
    # 训练结束/打印信息/保存结果
    if RANK in {-1, 0}:
        LOGGER.info(f"\n{epoch - start_epoch + 1} epochs completed in {(time.time() - t0) / 3600:.3f} hours.")
        for f in last, best:
            if f.exists():
                strip_optimizer(f)  # strip optimizers
                if f is best:
                    LOGGER.info(f"\nValidating {f}...")
                    results, _, _ = validate.run(
                        data_dict,
                        batch_size=batch_size // WORLD_SIZE * 2,
                        imgsz=imgsz,
                        model=attempt_load(f, device).half(),
                        iou_thres=0.65 if is_coco else 0.60,  # best pycocotools at iou 0.65
                        single_cls=single_cls,
                        dataloader=val_loader,
                        save_dir=save_dir,
                        save_json=is_coco,
                        verbose=True,
                        plots=plots,
                        callbacks=callbacks,
                        compute_loss=compute_loss,
                    )  # val best model with plots
                    if is_coco:
                        callbacks.run("on_fit_epoch_end", list(mloss) + list(results) + lr, epoch, best_fitness, fi)

        callbacks.run("on_train_end", last, best, epoch, results)

    torch.cuda.empty_cache()
    return results
```

# 参数设置

`parse_opt`函数主要负责解析一些命令行参数：

```python

def parse_opt(known=False):
    parser = argparse.ArgumentParser()
    # 预训练权重文件
    parser.add_argument("--weights", type=str, default=ROOT / "yolov5s.pt", help="initial weights path")
    # 训练模型
    parser.add_argument("--cfg", type=str, default="", help="model.yaml path")
    # 训练路径，包括训练集，验证集，测试集的路径，类别总数等
    parser.add_argument("--data", type=str, default=ROOT / "data/coco128.yaml", help="dataset.yaml path")
    # hpy超参数设置文件
    parser.add_argument("--hyp", type=str, default=ROOT / "data/hyps/hyp.scratch-low.yaml", help="hyperparameters path")
    # epochs: 训练轮次， 默认轮次为300次
    parser.add_argument("--epochs", type=int, default=100, help="total training epochs")
    # batchsize: 训练批次， 默认bs=16
    parser.add_argument("--batch-size", type=int, default=16, help="total batch size for all GPUs, -1 for autobatch")
    # imagesize: 设置图片大小, 默认640*640
    parser.add_argument("--imgsz", "--img", "--img-size", type=int, default=640, help="train, val image size (pixels)")
    # rect: 是否采用矩形训练，默认为False
    # 矩形训练：将比例相近的图片放在一个batch
    parser.add_argument("--rect", action="store_true", help="rectangular training")
    # resume: 是否接着上次的训练结果，继续训练
    parser.add_argument("--resume", nargs="?", const=True, default=False, help="resume most recent training")
    parser.add_argument("--nosave", action="store_true", help="only save final checkpoint")
    # noval: 最后进行测试, 设置了之后就是训练结束都测试一下
    parser.add_argument("--noval", action="store_true", help="only validate final epoch")
    # noautoanchor: 不自动调整anchor, 默认False
    parser.add_argument("--noautoanchor", action="store_true", help="disable AutoAnchor")
    parser.add_argument("--noplots", action="store_true", help="save no plot files")
    # 进化策略轮次
    parser.add_argument("--evolve", type=int, nargs="?", const=300, help="evolve hyperparameters for x generations")
    parser.add_argument(
        "--evolve_population", type=str, default=ROOT / "data/hyps", help="location for loading population"
    )
    parser.add_argument("--resume_evolve", type=str, default=None, help="resume evolve from last generation")
    parser.add_argument("--bucket", type=str, default="", help="gsutil bucket")
    # cache: 是否提前缓存图片到内存，以加快训练速度
    parser.add_argument("--cache", type=str, nargs="?", const="ram", help="image --cache ram/disk")
    # image-weights: 使用图片采样策略，默认不使用
    parser.add_argument("--image-weights", action="store_true", help="use weighted image selection for training")
    parser.add_argument("--device", default="", help="cuda device, i.e. 0 or 0,1,2,3 or cpu")
    # multi-scale 是否进行多尺度训练
    parser.add_argument("--multi-scale", action="store_true", help="vary img-size +/- 50%%")
    # single-cls: 数据集是否多类/默认True
    parser.add_argument("--single-cls", action="store_true", help="train multi-class data as single-class")
    parser.add_argument("--optimizer", type=str, choices=["SGD", "Adam", "AdamW"], default="SGD", help="optimizer")
    # 同步BatchNorm
    parser.add_argument("--sync-bn", action="store_true", help="use SyncBatchNorm, only available in DDP mode")
    # dataloader的最大worker数量 （使用多线程加载图片）
    parser.add_argument("--workers", type=int, default=8, help="max dataloader workers (per RANK in DDP mode)")
    parser.add_argument("--project", default=ROOT / "runs/train", help="save to project/name")
    parser.add_argument("--name", default="exp", help="save to project/name")
    parser.add_argument("--exist-ok", action="store_true", help="existing project/name ok, do not increment")
    # 四元数据加载器: 允许在较低 --img 尺寸下进行更高 --img 尺寸训练
    parser.add_argument("--quad", action="store_true", help="quad dataloader")
    # cos-lr: 余弦学习率
    parser.add_argument("--cos-lr", action="store_true", help="cosine LR scheduler")
    # 标签平滑 / 默认不增强
    parser.add_argument("--label-smoothing", type=float, default=0.0, help="Label smoothing epsilon")
    parser.add_argument("--patience", type=int, default=100, help="EarlyStopping patience (epochs without improvement)")
    # freeze冻结训练
    parser.add_argument("--freeze", nargs="+", type=int, default=[0], help="Freeze layers: backbone=10, first3=0 1 2")
    # 多少个epoch保存一次
    parser.add_argument("--save-period", type=int, default=-1, help="Save checkpoint every x epochs (disabled if < 1)")
    parser.add_argument("--seed", type=int, default=0, help="Global training seed")
    parser.add_argument("--local_rank", type=int, default=-1, help="Automatic DDP Multi-GPU argument, do not modify")

    # Logger arguments
    parser.add_argument("--entity", default=None, help="Entity")
    parser.add_argument("--upload_dataset", nargs="?", const=True, default=False, help='Upload data, "val" option')
    parser.add_argument("--bbox_interval", type=int, default=-1, help="Set bounding-box image logging interval")
    parser.add_argument("--artifact_alias", type=str, default="latest", help="Version of dataset artifact to use")

    # NDJSON logging
    parser.add_argument("--ndjson-console", action="store_true", help="Log ndjson to console")
    parser.add_argument("--ndjson-file", action="store_true", help="Log ndjson to file")

    return parser.parse_known_args()[0] if known else parser.parse_args()
```

# Main函数



```python
def main(opt, callbacks=Callbacks()):
    # 检查分布式训练环境
    if RANK in {-1, 0}: 
        print_args(vars(opt)) # 输出所有训练参数
        check_git_status() # 检查yolo v5的官方仓库状态
        check_requirements(ROOT / "requirements.txt")

    # 是否进行断点续传
    # 如果resume是True，则通过get_lastest_run()函数找到runs为文件夹中最近的权重文件last.pt
    if opt.resume and not check_comet_resume(opt) and not opt.evolve:
        last = Path(check_file(opt.resume) if isinstance(opt.resume, str) else get_latest_run())
        opt_yaml = last.parent.parent / "opt.yaml"  # train options yaml
        opt_data = opt.data  # original dataset
        if opt_yaml.is_file():
            with open(opt_yaml, errors="ignore") as f:
                d = yaml.safe_load(f)
        else:
            d = torch.load(last, map_location="cpu")["opt"]
        opt = argparse.Namespace(**d)  # replace
        opt.cfg, opt.weights, opt.resume = "", str(last), True  # reinstate
        if is_url(opt_data):
            opt.data = check_file(opt_data)  # avoid HUB resume auth timeout
    else:
        opt.data, opt.cfg, opt.hyp, opt.weights, opt.project = (
            check_file(opt.data),
            check_yaml(opt.cfg),
            check_yaml(opt.hyp),
            str(opt.weights),
            str(opt.project),
        )  # 如果模型文件和权重文件为空，弹出警告
        assert len(opt.cfg) or len(opt.weights), "either --cfg or --weights must be specified"
        
        # 如果要进行超参数进化，重建保存路径
        if opt.evolve:
        	# 设置新的项目输出目录
            if opt.project == str(ROOT / "runs/train"):  # if default project name, rename to runs/evolve
                opt.project = str(ROOT / "runs/evolve")
            # 将resume传递给exist_ok
            opt.exist_ok, opt.resume = opt.resume, False  # pass resume to exist_ok and disable resume
        if opt.name == "cfg":
            opt.name = Path(opt.cfg).stem  # use model.yaml as name
           
        # 根据opt.project生成目录，并赋值给opt.save_dir  如: runs/train/exp1
        opt.save_dir = str(increment_path(Path(opt.project) / opt.name, exist_ok=opt.exist_ok))
```

分布式训练的判断部分：

```python
    # 分布式训练 DDP mode
    device = select_device(opt.device, batch_size=opt.batch_size)
    # 当进程内的GPU编号不为-1时，才会进入DDP
    if LOCAL_RANK != -1:
        msg = "is not compatible with YOLOv5 Multi-GPU DDP training"
        assert not opt.image_weights, f"--image-weights {msg}"
        assert not opt.evolve, f"--evolve {msg}"
        assert opt.batch_size != -1, f"AutoBatch with --batch-size -1 {msg}, please pass a valid --batch-size"
        assert opt.batch_size % WORLD_SIZE == 0, f"--batch-size {opt.batch_size} must be multiple of WORLD_SIZE"
        assert torch.cuda.device_count() > LOCAL_RANK, "insufficient CUDA devices for DDP command"
        torch.cuda.set_device(LOCAL_RANK)
        device = torch.device("cuda", LOCAL_RANK)
        
        dist.init_process_group(
            backend="nccl" if dist.is_nccl_available() else "gloo", timeout=timedelta(seconds=10800)
        )
```

进化训练的判断：

```python
    # 如果不进行超参数进化，则直接调用train()函数，开始训练
    if not opt.evolve:
        train(opt.hyp, opt, device, callbacks)

    # 是否进行进化训练/遗传算法调参
    else:
        # 超参数列表(突变范围 - 最小值 - 最大值)
        meta = {
            "lr0": (False, 1e-5, 1e-1),  # initial learning rate (SGD=1E-2, Adam=1E-3)
            "lrf": (False, 0.01, 1.0),  # final OneCycleLR learning rate (lr0 * lrf)
            "momentum": (False, 0.6, 0.98),  # SGD momentum/Adam beta1
            "weight_decay": (False, 0.0, 0.001),  # optimizer weight decay
            "warmup_epochs": (False, 0.0, 5.0),  # warmup epochs (fractions ok)
            "warmup_momentum": (False, 0.0, 0.95),  # warmup initial momentum
            "warmup_bias_lr": (False, 0.0, 0.2),  # warmup initial bias lr
            "box": (False, 0.02, 0.2),  # box loss gain
            "cls": (False, 0.2, 4.0),  # cls loss gain
            "cls_pw": (False, 0.5, 2.0),  # cls BCELoss positive_weight
            "obj": (False, 0.2, 4.0),  # obj loss gain (scale with pixels)
            "obj_pw": (False, 0.5, 2.0),  # obj BCELoss positive_weight
            "iou_t": (False, 0.1, 0.7),  # IoU training threshold
            "anchor_t": (False, 2.0, 8.0),  # anchor-multiple threshold
            "anchors": (False, 2.0, 10.0),  # anchors per output grid (0 to ignore)
            "fl_gamma": (False, 0.0, 2.0),  # focal loss gamma (efficientDet default gamma=1.5)
            "hsv_h": (True, 0.0, 0.1),  # image HSV-Hue augmentation (fraction)
            "hsv_s": (True, 0.0, 0.9),  # image HSV-Saturation augmentation (fraction)
            "hsv_v": (True, 0.0, 0.9),  # image HSV-Value augmentation (fraction)
            "degrees": (True, 0.0, 45.0),  # image rotation (+/- deg)
            "translate": (True, 0.0, 0.9),  # image translation (+/- fraction)
            "scale": (True, 0.0, 0.9),  # image scale (+/- gain)
            "shear": (True, 0.0, 10.0),  # image shear (+/- deg)
            "perspective": (True, 0.0, 0.001),  # image perspective (+/- fraction), range 0-0.001
            "flipud": (True, 0.0, 1.0),  # image flip up-down (probability)
            "fliplr": (True, 0.0, 1.0),  # image flip left-right (probability)
            "mosaic": (True, 0.0, 1.0),  # image mixup (probability)
            "mixup": (True, 0.0, 1.0),  # image mixup (probability)
            "copy_paste": (True, 0.0, 1.0),
        }  # segment copy-paste (probability)

        # GA configs 
        pop_size = 50
        mutation_rate_min = 0.01
        mutation_rate_max = 0.5
        crossover_rate_min = 0.5
        crossover_rate_max = 1
        min_elite_size = 2
        max_elite_size = 5
        tournament_size_min = 2
        tournament_size_max = 10
		
        # 加载默认超参数
        with open(opt.hyp, errors="ignore") as f:
            hyp = yaml.safe_load(f)  # load hyps dict
            
            # 如果超参数文件中没有'anchors'，则设为3
            if "anchors" not in hyp:  # anchors commented in hyp.yaml
                hyp["anchors"] = 3
        if opt.noautoanchor:
            del hyp["anchors"], meta["anchors"]
            
        # 使用进化算法时，仅在最后的epoch测试和保存
        opt.noval, opt.nosave, save_dir = True, True, Path(opt.save_dir)  # only val/save final epoch
        # ei = [isinstance(x, (int, float)) for x in hyp.values()]  # evolvable indices
        evolve_yaml, evolve_csv = save_dir / "hyp_evolve.yaml", save_dir / "evolve.csv"
        if opt.bucket:
            # download evolve.csv if exists
            subprocess.run(
                [
                    "gsutil",
                    "cp",
                    f"gs://{opt.bucket}/evolve.csv",
                    str(evolve_csv),
                ]
            )

        # Delete the items in meta dictionary whose first value is False
        del_ = [item for item, value_ in meta.items() if value_[0] is False]
        hyp_GA = hyp.copy()  # Make a copy of hyp dictionary
        for item in del_:
            del meta[item]  # Remove the item from meta dictionary
            del hyp_GA[item]  # Remove the item from hyp_GA dictionary

        # Set lower_limit and upper_limit arrays to hold the search space boundaries
        lower_limit = np.array([meta[k][1] for k in hyp_GA.keys()])
        upper_limit = np.array([meta[k][2] for k in hyp_GA.keys()])

        # Create gene_ranges list to hold the range of values for each gene in the population
        gene_ranges = [(lower_limit[i], upper_limit[i]) for i in range(len(upper_limit))]

        # Initialize the population with initial_values or random values
        initial_values = []

        # If resuming evolution from a previous checkpoint
        if opt.resume_evolve is not None:
            assert os.path.isfile(ROOT / opt.resume_evolve), "evolve population path is wrong!"
            with open(ROOT / opt.resume_evolve, errors="ignore") as f:
                evolve_population = yaml.safe_load(f)
                for value in evolve_population.values():
                    value = np.array([value[k] for k in hyp_GA.keys()])
                    initial_values.append(list(value))

        # If not resuming from a previous checkpoint, generate initial values from .yaml files in opt.evolve_population
        else:
            yaml_files = [f for f in os.listdir(opt.evolve_population) if f.endswith(".yaml")]
            for file_name in yaml_files:
                with open(os.path.join(opt.evolve_population, file_name)) as yaml_file:
                    value = yaml.safe_load(yaml_file)
                    value = np.array([value[k] for k in hyp_GA.keys()])
                    initial_values.append(list(value))

        # Generate random values within the search space for the rest of the population
        if initial_values is None:
            population = [generate_individual(gene_ranges, len(hyp_GA)) for _ in range(pop_size)]
        elif pop_size > 1:
            population = [generate_individual(gene_ranges, len(hyp_GA)) for _ in range(pop_size - len(initial_values))]
            for initial_value in initial_values:
                population = [initial_value] + population

        # Run the genetic algorithm for a fixed number of generations
        list_keys = list(hyp_GA.keys())
        for generation in range(opt.evolve):
            if generation >= 1:
                save_dict = {}
                for i in range(len(population)):
                    little_dict = {list_keys[j]: float(population[i][j]) for j in range(len(population[i]))}
                    save_dict[f"gen{str(generation)}number{str(i)}"] = little_dict

                with open(save_dir / "evolve_population.yaml", "w") as outfile:
                    yaml.dump(save_dict, outfile, default_flow_style=False)

            # Adaptive elite size
            elite_size = min_elite_size + int((max_elite_size - min_elite_size) * (generation / opt.evolve))
            # Evaluate the fitness of each individual in the population
            fitness_scores = []
            for individual in population:
                for key, value in zip(hyp_GA.keys(), individual):
                    hyp_GA[key] = value
                hyp.update(hyp_GA)
                results = train(hyp.copy(), opt, device, callbacks)
                callbacks = Callbacks()
                # Write mutation results
                keys = (
                    "metrics/precision",
                    "metrics/recall",
                    "metrics/mAP_0.5",
                    "metrics/mAP_0.5:0.95",
                    "val/box_loss",
                    "val/obj_loss",
                    "val/cls_loss",
                )
                print_mutation(keys, results, hyp.copy(), save_dir, opt.bucket)
                fitness_scores.append(results[2])

            # Select the fittest individuals for reproduction using adaptive tournament selection
            selected_indices = []
            for _ in range(pop_size - elite_size):
                # Adaptive tournament size
                tournament_size = max(
                    max(2, tournament_size_min),
                    int(min(tournament_size_max, pop_size) - (generation / (opt.evolve / 10))),
                )
                # Perform tournament selection to choose the best individual
                tournament_indices = random.sample(range(pop_size), tournament_size)
                tournament_fitness = [fitness_scores[j] for j in tournament_indices]
                winner_index = tournament_indices[tournament_fitness.index(max(tournament_fitness))]
                selected_indices.append(winner_index)

            # Add the elite individuals to the selected indices
            elite_indices = [i for i in range(pop_size) if fitness_scores[i] in sorted(fitness_scores)[-elite_size:]]
            selected_indices.extend(elite_indices)
            # Create the next generation through crossover and mutation
            next_generation = []
            for _ in range(pop_size):
                parent1_index = selected_indices[random.randint(0, pop_size - 1)]
                parent2_index = selected_indices[random.randint(0, pop_size - 1)]
                # Adaptive crossover rate
                crossover_rate = max(
                    crossover_rate_min, min(crossover_rate_max, crossover_rate_max - (generation / opt.evolve))
                )
                if random.uniform(0, 1) < crossover_rate:
                    crossover_point = random.randint(1, len(hyp_GA) - 1)
                    child = population[parent1_index][:crossover_point] + population[parent2_index][crossover_point:]
                else:
                    child = population[parent1_index]
                # Adaptive mutation rate
                mutation_rate = max(
                    mutation_rate_min, min(mutation_rate_max, mutation_rate_max - (generation / opt.evolve))
                )
                for j in range(len(hyp_GA)):
                    if random.uniform(0, 1) < mutation_rate:
                        child[j] += random.uniform(-0.1, 0.1)
                        child[j] = min(max(child[j], gene_ranges[j][0]), gene_ranges[j][1])
                next_generation.append(child)
            # Replace the old population with the new generation
            population = next_generation
        # Print the best solution found
        best_index = fitness_scores.index(max(fitness_scores))
        best_individual = population[best_index]
        print("Best solution found:", best_individual)
        # Plot results 将结果可视化 / 输出保存信息
        plot_evolve(evolve_csv)
        LOGGER.info(
            f'Hyperparameter evolution finished {opt.evolve} generations\n'
            f"Results saved to {colorstr('bold', save_dir)}\n"
            f'Usage example: $ python train.py --hyp {evolve_yaml}'
        )


def generate_individual(input_ranges, individual_length):
    individual = []
    for i in range(individual_length):
        lower_bound, upper_bound = input_ranges[i]
        individual.append(random.uniform(lower_bound, upper_bound))
    return individual


def run(**kwargs):
    # Usage: import train; train.run(data='coco128.yaml', imgsz=320, weights='yolov5m.pt')
    opt = parse_opt(True)
    for k, v in kwargs.items():
        # setattr() 赋值属性，属性不存在则创建一个赋值
        setattr(opt, k, v)
    main(opt)
    return opt


if __name__ == "__main__":
    opt = parse_opt()
    main(opt)

```

2024/4/10 于苏州