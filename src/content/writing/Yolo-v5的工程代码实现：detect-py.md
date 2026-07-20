---
title: "Yolo v5的工程代码实现：detect.py"
description: "Yolo v5的推理代码解读与debug。"
pubDate: "2024-01-21 08:56:26"
---

# Yolo简史

Yolo系列可谓是无数CVer的入门之作，也是广大研究生，小厂商的救命稻草。我原先也精读过Yolo v1的论文，不过今天先逐步解析一下Yolo v5的工程代码。

Yolo v1-v3都是由原作者Joseph Redmon开发，2020年，他宣称拒绝该技术被美国军方使用，停止了个人开发。后续的开发由各个企业/开发者维系。

Yolo v4由Yolo Darknet的维护者Alexy Bochkoviskiy发布；Yolo v5/v8由西班牙公司Ulterlytics开发；Yolo v6由美团发布，Yolo v7则继续由Alexy Bochkoviskiy发布。事实上，Alexy Bochkoviskiy目前被广泛认为是Yolo的官方开发者。

# 代码架构

Yolo v5的官方仓库中主要由以下架构组成：

```bash
/yolov5
│
├── classify # 分类模型的训练/推理/验证/教程代码
├── data # 数据集配置文件/超参数配置文件/测试图片
├── models # 模型配置文件
├── segment # 图形分割模型的训练/推理/验证/教程代码
├── utils # 工具代码
├── benchmarks.py # 评估代码
├── detect.py # 预测代码
├── export.py # 模型转换代码
├── hubconf.py # 从torch.hub导入模型的代码
├── train.py # 训练代码
├── val.py # 验证代码
└── tutorial.ipynb # 教程代码
```

今天分析的是其中的`detect.py`，这是yolo v5的推理代码，总共只有200多行代码，所以并不复杂。

## 依赖包

首先是导入依赖包：

```python
import argparse
import csv
import os
import platform
import sys
from pathlib import Path

import torch

#获取detect.py在电脑中的绝对路径
FILE = Path(__file__).resolve() 

# 获取detect.py的父目录（绝对路径）：YOLOv5 root directory
ROOT = FILE.parents[0]  

if str(ROOT) not in sys.path: 
	# 添加yolov5根目录到系统路径中
    sys.path.append(str(ROOT))  
    
# 将绝对路径转换为相对路径
ROOT = Path(os.path.relpath(ROOT, Path.cwd())) 
```

这里值得学习的是路径的导入：通过当前文件的路径找到项目母路径，添加到系统变量，并转化为相对路径。这时，ROOT就变成了项目根目录的相对路径，引用的时候需要从根目录考虑位置。

接下来是导入自定义的库：

```python
from ultralytics.utils.plotting import Annotator, colors, save_one_box

from models.common import DetectMultiBackend
from utils.dataloaders import IMG_FORMATS, VID_FORMATS, LoadImages, LoadScreenshots, LoadStreams
from utils.general import (
    LOGGER,
    Profile,
    check_file,
    check_img_size,
    check_imshow,
    check_requirements,
    colorstr,
    cv2,
    increment_path,
    non_max_suppression,
    print_args,
    scale_boxes,
    strip_optimizer,
    xyxy2xywh,
)
from utils.torch_utils import select_device, smart_inference_mode
```

这些自定义库的内容如下：

- **models.common.py：** 这个文件定义了模型的层结构，以及一些通用的函数和类，比如图像的处理、非极大值抑制等等。
- **utils.dataloaders.py：** 这个文件定义了dataloader和dataset。其中定义了一些常用的类：LoadStream，LoadImages，LoadScreenshots，LoadImagesAndLabels，这些是用来导入数据的类。
- **utils.general.py：** 这个文件定义了一些常用的工具函数，比如判断语句、检查文件是否存在、检查图像大小是否符合要求、打印命令行参数等等。
- **utils.plots.py：** 这个文件定义了Annotator类，可以在图像上绘制矩形框和标注信息。
- **utils.torch_utils.py：** 这个文件定义了一些与PyTorch有关的工具函数，比如选择设备、同步时间等等。

## 配置参数

```python
@smart_inference_mode()
def run(
    weights=ROOT / "yolov5s.pt",  # 权重路径
    source=ROOT / "data/images",  # file/dir/URL/glob/screen/0(本机的摄像头)
    data=ROOT / "data/coco128.yaml",  # 配置数据文件路径，包括image/label/classes等信息，训练自己的文件，需要作相应更改
    imgsz=(640, 640),  # 预测时网络输入图片的尺寸大小 (height, width)
    conf_thres=0.25,  # 置信度阈值
    iou_thres=0.45,  # 非极大值抑制的阈值
    max_det=1000,  # 每张图片最大保留的检测框数量
    device="",  # cuda device, i.e. 0 or 0,1,2,3 or cpu
    view_img=False,  # 是否展示预测之后的图片/视频
    save_txt=False,  # 是否将预测的框坐标以txt文件形式保存，使用--save-txt 将会在路径runs/detect/exp*/labels/*.txt下生成每张图片预测的txt文件
    save_csv=False,  # 是否将预测结果保存到csv文件
    save_conf=False,  # 是否保存检测结果的置信度到 txt文件
    save_crop=False,  # 是否保存裁剪预测框图片，使用--save-crop 在runs/detect/exp*/crop/剪切类别文件夹/ 路径下会保存每个接下来的目标
    nosave=False,  # 不保存图片、视频，使用--nosave 在runs/detect/exp*/就不会出现预测的结果
    classes=None,  # 可以过滤检测结果，只检测指定类别
    agnostic_nms=False,  # 是否使用类别不敏感的非极大抑制（即不考虑类别信息）
    augment=False,  # 是否使用数据增强进行推理
    visualize=False,  # 是否可视化特征图
    update=False,  # 如果为True，则对所有模型进行strip_optimizer操作，去除pt文件中的优化器等信息
    project=ROOT / "runs/detect",  # 结果保存的项目目录路径，默认为 'ROOT/runs/detect'
    name="exp",  # 结果保存的子目录名称，默认为 'exp'
    exist_ok=False,  # 是否覆盖已有结果，默认为 False
    line_thickness=3,  #  画 bounding box 时的线条宽度
    hide_labels=False,  # 是否隐藏标签信息
    hide_conf=False,  # 是否隐藏置信度信息
    half=False,  # 是否使用 FP16 半精度进行推理
    dnn=False,  # 是否使用 OpenCV DNN 进行 ONNX 推理
    vid_stride=1,  # 视频流的帧步
):

```

## 初始设置

接下来进入代码块，第一个部分是推理的基础设置，代码如下：

```py
# 将source转换为字符串
# source 为命令行传入的图片或者视频，例如：python detect.py --source data/images/bus.jpg
source = str(source) # 图片路径 'data/images'

# 是否保存预测后的图片，nosave为false，则not nosave为true
# source传入的是照片而不是txt则为true，最后则表示需要存储最后的预测结果
save_img = not nosave and not source.endswith('.txt')  

# Path(source)：为文件地址，例如：data/images/bus.jpg
# suffix[1:]：截取文件后缀，即为bus.jpg，而[1:]则为jpg后，最后输出为jpg
# 判断该jpg是否在(IMG_FORMATS + VID_FORMATS) 该列表内，该列表可参照下一个代码模块。最后输出为true
is_file = Path(source).suffix[1:] in (IMG_FORMATS + VID_FORMATS)

# 判断是否为网络流地址或者是网络的图片地址
# 将其地址转换为小写，并且判断开头是否包括如下网络流开头的
is_url = source.lower().startswith(('rtsp://', 'rtmp://', 'http://', 'https://'))

# 是否是使用webcam数据，一般为false
# 判断source是否为数值（0为摄像头路径）或者 txt文件 或者 网络流并且不是文件地址
webcam = source.isnumeric() or source.endswith('.txt') or (is_url and not is_file)

# 是否传入的为屏幕快照文件
screenshot = source.lower().startswith('screen')

# 如果是网络流地址 以及文件，则对应下载该文件
if is_url and is_file:
    # 下载，该函数在下文中有所讲解
    source = check_file(source) 
```

图片和视频的格式分别如下：

```python
# 包括的图片后缀
IMG_FORMATS = 'bmp', 'dng', 'jpeg', 'jpg', 'mpo', 'png', 'tif', 'tiff', 'webp', 'pfm'  

# 包括的视频后缀
VID_FORMATS = 'asf', 'avi', 'gif', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'ts', 'wmv' 
```

根据source的类型，会确定输入数据的类型：

- 如果source的后缀是图像或视频格式之一，那么将is_file设置为True；
- 如果source以rtsp等开头，那么将is_url设置为True；
- 如果source是数字或以.txt结尾或是一个URL，那么将webcam设置为True；
- 如果source既是文件又是URL，那么会调用check_file函数下载文件。

`check_file(source)`的函数代码如下，如果输入不是url地址，可以忽略：

```python
# 该函数主要的核心功能为：找到文件或者下载文件
def check_file(file, suffix=''):
    # 如果文件后缀符合指定的后缀列表，则没有任何返回
    # 如果文件后缀不符合指定的后缀列表，会抛出一个AssertionError
    check_suffix(file, suffix) 
    # 转换文件为字符串
    file = str(file) 

	# 如果文件存在 或者 不是一个文件，则直接返回文件
    if os.path.isfile(file) or not file:  # exists
        return file
        
	# 如果文件的前缀为网络流信息，则对应进行下载
    elif file.startswith(('http:/', 'https:/')): 
        url = file  
        # urllib.parse.unquote(file) 相当于JS中的urldecode()，对url进行解码
        # 类似https://url.com/file.txt?auth 结果为https://url.com/file.txt
        file = Path(urllib.parse.unquote(file).split('?')[0]).name  
        # 如果文件存在，则输出logger日志
        if os.path.isfile(file):
            LOGGER.info(f'Found {url} locally at {file}') 
       	# 如果文件不存在，则对应下载文件
        else:
            LOGGER.info(f'Downloading {url} to {file}...')
            torch.hub.download_url_to_file(url, file)
            assert Path(file).exists() and Path(file).stat().st_size > 0, f'File download failed: {url}'  # check
        return file

	# 如果文件前缀为ClearML Dataset，设置断言，表明没有安装，需要用pip进行安装
    elif file.startswith('clearml://'):  # ClearML Dataset ID
        assert 'clearml' in sys.modules, "ClearML is not installed, so cannot use ClearML dataset. Try running 'pip install clearml'."
        return file

	# 都不是以上的情况，则对应搜索目录，找到该文件，并且返回该文件
    else:  
        files = []
        # 搜索这些目录
        for d in 'data', 'models', 'utils':  
        	# 模糊搜索，并且添加到files的列表中
            files.extend(glob.glob(str(ROOT / d / '**' / file), recursive=True))  
        # 设置断言
        assert len(files), f'File not found: {file}'  # assert file was found
        assert len(files) == 1, f"Multiple files match '{file}', specify exact path: {files}"  # assert unique
        return files[0]  # return file
```

`check_suffix(file, suffix)`代码如下，这个函数的主要作用是判断文件后缀是否符合指定的后缀列表。如果符合就不会返回任何信息，否则会报错：

```python
# 默认按照传参进行设置，如果不传参则赋以下默认值
def check_suffix(file='yolov5s.pt', suffix=('.pt',), msg=''):
    # 在可用的文件后缀中检查后缀
    if file and suffix:
    	# 如果文件后缀为str字符串，则转换为列表
        if isinstance(suffix, str):
            suffix = [suffix]
		
		# 如果文件为列表或者元组则遍历文件，否则将其文件变为列表来遍历
        for f in file if isinstance(file, (list, tuple)) else [file]:
        	# 找到文件后缀 并且小写
            s = Path(f).suffix.lower()  
            if len(s):
                assert s in suffix, f"{msg}{f} acceptable suffix is {suffix}"
```

接下来是创建保存输出结果文件夹的代码：

```python
# 创建文件夹

# Path(project) 为一开始定义的：   project=ROOT / 'runs/detect'
# name为保存的项目名：   name='exp'
# 表示两者的拼接 ：runs/detect/exp
save_dir = increment_path(Path(project) / name, exist_ok=exist_ok)  
print(save_dir) # runs/detect/exp

# 传入的命令参数save_txt 为false，则直接创建exp文件夹
# 传入的命令参数save_txt 为 true，则直接拼接一个/ 'labels 创建文件夹
(save_dir / 'labels' if save_txt else save_dir).mkdir(parents=True, exist_ok=True)  # make dir
```

这里用到的`increment_path`的函数如下，其实就是创建组合一下创建文件夹：

```python
# 递增路径 如 run/train/exp --> runs/train/exp{sep}0, runs/exp{sep}1 etc.
def increment_path(path, exist_ok=False, sep='', mkdir=False):
    # string/win路径 -> win路径
    path = Path(path) 

	#如果文件路径存在
    if path.exists() and not exist_ok:
    	# 文件path路径为：.with_suffix 将路径添加一个后缀 ''
    	# 文件后缀为：path的后缀 
        path, suffix = (path.with_suffix(''), path.suffix) if path.is_file() else (path, '')

        for n in range(2, 9999):
        	# f开头表示字符串内支持大括号的python表达式
        	# increment
            p = f'{path}{sep}{n}{suffix}'
            # 如果不存在该路径，则break退出  
            if not os.path.exists(p):  
                break
        path = Path(p)
	
	# 默认mkdir为false，先不创建dir
    if mkdir:
        path.mkdir(parents=True, exist_ok=True)  

    return path
```

## 加载模型

接下来是加载模型：

```python
# 模型加载

# 选择CPU或者GPU，主要为逻辑判断
# 此处的device 为 None or 'cpu' or 0 or '0' or '0,1,2,3'
device = select_device(device)

# 模型后端框架，传入对应的参数
model = DetectMultiBackend(weights, device=device, dnn=dnn, data=data, fp16=half)

#加载完模型之后，对应读取模型的步长、类别名、pytorch模型类型
stride, names, pt = model.stride, model.names, model.pt

print(f'stride:{stride},names:{names},pt:{pt}') # stride 32, name {0:'person', 1:'bicycle'}, pt True

# 判断模型步长是否为32的倍数
imgsz = check_img_size(imgsz, s=stride) 
print(f'imgsz:{imgsz}') # imgsz 640
```

上面这段代码主要是使用DetectMultiBackend类来加载模型，从模型中提取了三个参数是：

- stride：推理时所用到的步长，默认为32， 大步长适合于大目标，小步长适合于小目标
- names：保存推理结果名的列表，比如默认模型的值是['person', 'bicycle', 'car', ...]
- pt: 加载的是否是pytorch模型（也就是pt格式的文件）

最后确保输入图片的尺寸imgsz能整除stride=32 如果不能则调整为能被整除并返回。

看一下`DetectMultiBackend`的源码：

```python
class DetectMultiBackend(nn.Module):
    def __init__(self, weights='yolov5s.pt', device=torch.device('cpu'), dnn=False, data=None, fp16=False, fuse=True):
		# 限定了作用域以避免循环导入
        from models.experimental import attempt_download, attempt_load  
		# 父函数初始化
        super().__init__()
        # 如果weights权重为列表则取出第一个，否则直接取出weights
        w = str(weights[0] if isinstance(weights, list) else weights)
        # 判断框架模型，本身就是pt了
        pt, jit, onnx, xml, engine, coreml, saved_model, pb, tflite, edgetpu, tfjs, paddle, triton = self._model_type(w)
        fp16 &= pt or jit or onnx or engine  
        # BHWC formats (vs torch BCWH)
        nhwc = coreml or saved_model or pb or tflite or edgetpu  
        # 初始步长为32
        stride = 32  
        cuda = torch.cuda.is_available() and device.type != 'cpu'  # use CUDA
        if not (pt or triton):
        	# 如果不在本地会在网络进行下载，如果存在本地则加载权重文件
            w = attempt_download(w)

        if pt:  # PyTorch
        	# 加载模型权重
            model = attempt_load(weights if isinstance(weights, list) else w, device=device, inplace=True, fuse=fuse)
			# 模型的最大权重
            stride = max(int(model.stride.max()), 32)  
            # 如果不用COCO数据集或者ImageNet数据集的标签，加载模型pt权重
            names = model.module.names if hasattr(model, 'module') else model.names  
            # 用fp16则用半精度推理，没有则用float
            model.half() if fp16 else model.float()
            # 得到加载好的模型
            self.model = model  # explicitly assign for to(), cpu(), cuda(), half()
		elif ...
		# 省略其他情况（大同小异）

     # 生成class name
    if 'names' not in locals():
    	# 生成对应的 999个标签
        names = yaml_load(data)['names'] if data else {i: f'class{i}' for i in range(999)}
    if names[0] == 'n01440764' and len(names) == 1000:  # ImageNet
        names = yaml_load(ROOT / 'data/ImageNet.yaml')['names']  # human-readable names

    self.__dict__.update(locals())  # assign all variables to self
```
加载数据配置文件的方法是：

```python
def yaml_load(file="data.yaml"):
    # Single-line safe yaml loading
    with open(file, errors="ignore") as f:
        return yaml.safe_load(f)        
```

对应的COCO128.yaml文件长这样：

```python
# 数据集源路径root、训练集、验证集、测试集地址

# 数据集源路径root dir
path: ../datasets/coco128  
# root下的训练集地址 128 images
train: images/train2017 
# root下的验证集地址 128 images
val: images/train2017  
# root下的验证集地址 128 images
test:                

# 数据集类别信息
nc: 80  # 数据集类别数量
names: [ 'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
         'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
         'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
         'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
         'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
         'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
         'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
         'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
         'hair drier', 'toothbrush' ]  # 数据集类别名
```

`check_img_size`的源码如下：

```python
# 验证图像大小是每个维度步幅的倍数
def check_img_size(imgsz, s=32, floor=0):
    # 如果尺寸类型为int
    if isinstance(imgsz, int):  
    	# 返回能被除数整除的最接近的x
        new_size = max(make_divisible(imgsz, int(s)), floor)
        
    # 尺寸类型为其他，转换为列表：img_size=[640, 480]
    else:  
        imgsz = list(imgsz)  # convert to list if tuple
        # 新的尺寸对应for遍历循环
        new_size = [max(make_divisible(x, int(s)), floor) for x in imgsz]
    if new_size != imgsz:
        LOGGER.warning(f'WARNING ⚠️ --img-size {imgsz} must be multiple of max stride {s}, updating to {new_size}')
    return new_size
    
# 返回能被除数整除的最接近的x
def make_divisible(x, divisor):
	# 本身传入的参数为32，32为torch.Tensor的类型，则将其转换为int类型  
    if isinstance(divisor, torch.Tensor):
        divisor = int(divisor.max())  # to int
   
    return math.ceil(x / divisor) * divisor
```

## 加载预测数据

```python
    # 数据加载
    bs = 1  # batch_size
    if webcam:
    
    	# 检测cv2.imshow()方法是否可以执行，不能执行则抛出异常
        view_img = check_imshow(warn=True)  
        
        # 加载输入的数据集
        dataset = LoadStreams(source, img_size=imgsz, stride=stride, auto=pt, vid_stride=vid_stride) 
        
        # 如果是加载进来的，就根据视频流的帧数设置bs
        bs = len(dataset) 
    elif screenshot:
        dataset = LoadScreenshots(source, img_size=imgsz, stride=stride, auto=pt) 
    else:
        dataset = LoadImages(source, img_size=imgsz, stride=stride, auto=pt, vid_stride=vid_stride)
        
    # 保存视频的路径
    vid_path, vid_writer = [None] * bs, [None] * bs # 前者是视频路径,后者是一个cv2.VideoWriter对象
```

这段代码根据输入的 source 参数来判断是否是通过 webcam 摄像头捕捉视频流：

- 如果是，则使用 LoadStreams 加载视频流
- 如果是截屏，则使用LoadScreenshots加载截屏
- 否则，使用 LoadImages 加载图像
bs 表示 batch_size（批量大小），这里是 1 或视频流中的帧数。vid_path 和 vid_writer 分别是视频路径和视频编写器，初始化为长度为 batch_size 的空列表。

vid_path 和 vid_writer 分别是视频路径和视频编写器，初始化为长度为 batch_size 的空列表。

其中用到的`LoadImages`函数是这样的：

```python
class LoadImages:
    # 执行代码：python detect.py --source image.jpg/vid.mp4
    
    # 初始化字段，本身传入的参数如下：
    # path：data\images\bus.jpg, img_size：传入的为【640，640】列表, stride步长32
    def __init__(self, path, img_size=640, stride=32, auto=True, transforms=None, vid_stride=1):
    	# 定义一个文件的空列表
        files = []
        # 遍历path路径
        for p in sorted(path) if isinstance(path, (list, tuple)) else [path]:
        	# 通过相对路径得到绝对路径
            p = str(Path(p).resolve())
            # 判断路径是否有带*
            if '*' in p:
            	# 如果p是采样正则化表达式提取图片/视频, 可以使用glob获取文件路径
                files.extend(sorted(glob.glob(p, recursive=True)))  
            # 判断路径是否为文件夹
            elif os.path.isdir(p):
            	# 如果p是一个文件夹，使用glob获取全部文件路径
                files.extend(sorted(glob.glob(os.path.join(p, '*.*'))))  
            # 判断路径是否为文件
            elif os.path.isfile(p):
            	# 对应添加文件到列表中，本身也是转化为列表
                files.append(p) 
            else:
                raise FileNotFoundError(f'{p} does not exist')
		
		# 图片后缀判断是否在IMG_FORMATS，视频后缀判断是否在VID_FORMATS 
        images = [x for x in files if x.split('.')[-1].lower() in IMG_FORMATS]
        videos = [x for x in files if x.split('.')[-1].lower() in VID_FORMATS]
        # 图片与视频数量
        ni, nv = len(images), len(videos)

        self.img_size = img_size
        self.stride = stride
        self.files = images + videos
        self.nf = ni + nv  # number of files
        # 此处为标志， 是不是video
        self.video_flag = [False] * ni + [True] * nv
        self.mode = 'image'
        # 默认值为true
        self.auto = auto
        self.transforms = transforms  # optional
        self.vid_stride = vid_stride  # video frame-rate stride
        # 判断videos有无值（此处明显为空）
        if any(videos):
        	# 判断有没有video文件  如果包含video文件，则初始化opencv中的视频模块，cap=cv2.VideoCapture等
            self._new_video(videos[0])  
        else:
            self.cap = None
        assert self.nf > 0, f'No images or videos found in {p}. ' \
                            f'Supported formats are:\nimages: {IMG_FORMATS}\nvideos: {VID_FORMATS}'
	
	# 迭代器
    def __iter__(self):
    	# 调用该类别的时候都会执行一次count计数
       self.count = 0
       return self

	# 与iter一起用
    def __next__(self):
    	# 判断计数是否与总文件数一样，如果一样则表明已经迭代结束
        if self.count == self.nf:
            raise StopIteration
        # 读取当前文件路径
        path = self.files[self.count]
		
		# 判断当前文件是否是视频
        if self.video_flag[self.count]:
            # Read video
            self.mode = 'video'
            for _ in range(self.vid_stride):
                self.cap.grab()
            # 获取当前帧画面，ret_val为一个bool变量，直到视频读取完毕之前都为True
            ret_val, im0 = self.cap.retrieve()
            # 如果当前视频读取结束，则读取下一个视频
            while not ret_val:
                self.count += 1
                self.cap.release()
                # 表明已经读取完
                if self.count == self.nf:  # last video
                    raise StopIteration
                path = self.files[self.count]
                self._new_video(path)
                ret_val, im0 = self.cap.read()
			
			# 当前读取视频的帧数
            self.frame += 1
            # im0 = self._cv2_rotate(im0)  # for use if cv2 autorotation is False
            s = f'video {self.count + 1}/{self.nf} ({self.frame}/{self.frames}) {path}: '

        else:
            # Read image
            self.count += 1
            im0 = cv2.imread(path)  # BGR
            assert im0 is not None, f'Image Not Found {path}'
            s = f'image {self.count}/{self.nf} {path}: '

        if self.transforms:
            im = self.transforms(im0)  # transforms
        else:
        	# 填充resize，将其原图变为resize后的图片
            im = letterbox(im0, self.img_size, stride=self.stride, auto=self.auto)[0]  # padded resize
            
            # 转换，习惯把通道数放置在前面
            im = im.transpose((2, 0, 1))[::-1]  # HWC to CHW, BGR to RGB
            im = np.ascontiguousarray(im)  # contiguous
		
		# 返回最后的路径、resize + pad的图片、原始图片、视频对象、s为字符串（后续方便输出）
        return path, im, im0, self.cap, s

    def new_video(self, path):
        # 记录帧数
        self.frame = 0
        # 初始化视频对象
        self.cap = cv2.VideoCapture(path)
        # 得到视频文件中的总帧数
        self.frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
	
    def _cv2_rotate(self, im):
       # Rotate a cv2 video manually
       if self.orientation == 0:
           return cv2.rotate(im, cv2.ROTATE_90_CLOCKWISE)
       elif self.orientation == 180:
           return cv2.rotate(im, cv2.ROTATE_90_COUNTERCLOCKWISE)
       elif self.orientation == 90:
           return cv2.rotate(im, cv2.ROTATE_180)
       return im
       
    def __len__(self):
        return self.nf  # number of files
```

其中使用了一个填充函数`letterbox`，例如`im = letterbox(im0, self.img_size, stride=self.stride, auto=self.auto)[0]`：

```python
# 将图片缩放到指定大小

# img: 原图 hwc
# new_shape: 缩放后的最长边大小
# color: 填充的颜色

# auto: True，保证缩放后的图片保持原图的比例 即 将原图最长边缩放到指定大小，再将原图较短边按原图比例缩放（不会失真）
	  # False，将原图最长边缩放到指定大小，再将原图较短边按原图比例缩放,最后将较短边两边pad操作缩放到最长边大小（不会失真）

# scale_fill: True 直接将原图resize到指定的大小，没有pad操作（失真）

# scale_up: True  对于小于new_shape的原图进行缩放,大于的不变
          # False 对于大于new_shape的原图进行缩放,小于的不变
def letterbox(im, new_shape=(640, 640), color=(114, 114, 114), auto=True, scaleFill=False, scaleup=True, stride=32):
    # （1000，810）
    shape = im.shape[:2]  # current shape [height, width]
    if isinstance(new_shape, int):
    	# (512, 512)
        new_shape = (new_shape, new_shape)

    # 也就是640 /1000 以及 640 / 810 求出最小
    # 对于大于new_shape（r<1）的原图进行缩放,小于new_shape（r>1）的不变
    # 总的来说，就是按照长边缩放，短边补零
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    if not scaleup:  # only scale down, do not scale up (for better val mAP)
    	# 只进行下采样 因为上采样会让图片模糊
        r = min(r, 1.0)

    # Compute padding
    # 此时按照长边的比例进行缩放
    ratio = r, r  # width, height ratios，(1, 1)
    # 缩放过后的图片尺寸为width, height：（480，640）
    # shape[1]在前，shape[0]在后，大致将其宽和高颠倒过来
    new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]  # 用原图减去缩放后的图，也就是160，0
    
    # 输入的只要是32倍的系数，就可输入到图形预测
    # 保证原图比例不变，将图像最大边缩放到指定大小
    if auto:  # minimum rectangle
    	# 取余操作可保证padding后的图片是32的整数倍
        dw, dh = np.mod(dw, stride), np.mod(dh, stride)  # wh padding
    # stretch 直接将图片缩放到指定尺寸
    elif scaleFill:  # stretch
        dw, dh = 0.0, 0.0
        new_unpad = (new_shape[1], new_shape[0])
        ratio = new_shape[1] / shape[1], new_shape[0] / shape[0]  # width, height ratios
	
	# 此时的宽和高是32的倍数，所以不用进行填充
    dw /= 2  # divide padding into 2 sides
    dh /= 2
    
	# shape:[h, w]  new_unpad:[w, h]
    if shape[::-1] != new_unpad:  # resize
    	# 将原图resize到new_unpad（长边相同，比例相同的新图）
        im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    # 计算上下两侧的padding  # top=0 bottom=0     
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    # 计算左右两侧的padding  # left=0 right=0
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    # 也就是此处的值没有padding
    im = cv2.copyMakeBorder(im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)  # add border

	# img: (480, 640, 3)
    return im, ratio, (dw, dh)
```

返回到主体函数即为 `640 * 480 * 3`。

## 推理代码

推理代码作为核心部分，会通过for循环对加载的数据进行遍历，一帧一帧地推理，进行NMS非极大值抑制、绘制bounding box、预测类别。

```python
# 通过运行一次推理来预热模型（内部初始化一张空白图预热模型）
model.warmup(imgsz=(1 if pt or model.triton else bs, 3, *imgsz))  


seen, windows, dt = 0, [], (Profile(device=device), Profile(device=device), Profile(device=device))

print(f'seen:{seen},windows:{windows},dt:{dt}') # seen 0 windows [] dt (Profile(device='cpu'), Profile(device='cpu'), Profile(device='cpu'))

# dataset数据集遍历，path为图片路径
# im为压缩后的图片， 640 * 480 * 3
# im0s为原图，1080 * 810 
# vid_cap 空
# s 打印图片的信息
for path, im, im0s, vid_cap, s in dataset:
    
    print(f'path:{path}') # path data/images/bus.jpg
    print(f'im:{im}') # [[[]]] 
    print(f'im0s:{im0s}') # [[[]]]
    print(f'vid_cap:{vid_cap}') # None
    
    with dt[0]:
    	# numpy array to tensor and device
    	# 在模型中运算，需要转换成pytorch，从numpy转成pytorch，再将其数据放入cpu或者gpu中
        im = torch.from_numpy(im).to(model.device)
        # 半精度训练 uint8 to fp16/32
        im = im.half() if model.fp16 else im.float() 
        # 归一化
        im /= 255  # 0 - 255 to 0.0 - 1.0
		# 图片为3维(RGB)，在前面添加一个维度，batch_size=1。本身输入网络的图片需要是4维， [batch_size, channel, w, h]
		# [1，3，640，480]
        if len(im.shape) == 3:
            im = im[None]  # expand for batch dim
            
        # 检查模型的xml属性是否为真，且第一个维度是否大于1
        # 如果条件满足，会使用torch.chunk函数将im按行分割成多个张量，并将这些张量存储在名为ims的列表中
        if model.xml and im.shape[0] > 1:
            ims = torch.chunk(im, im.shape[0], 0)

    # Inference
    # visualize 一开始为false，如果为true则对应会保存一些特征
    with dt[1]:
        visualize = increment_path(save_dir / Path(path).stem, mkdir=True) if visualize else False
        # 数据的推断增强，但也会降低速度。最后检测出的结果为18900个框
        # 结果为[1，18900，85]，预训练有85个预测信息，4个坐标 + 1个置信度 +80各类别
        pred = model(im, augment=augment, visualize=visualize)
	
	# NMS非极大值阈值过滤
	# conf_thres: 置信度阈值；iou_thres: iou阈值
    # classes: 是否只保留特定的类别 默认为None
    # agnostic_nms: 进行nms是否也去除不同类别之间的框 默认False
    # max_det: 每张图片的最大目标个数 默认1000，超过1000就会过滤
    # pred: [1,num_obj,6] = [1,5,6] 这里的预测信息pred还是相对于 img_size(640)。本身一开始18900变为了5个框，6为每个框的 x左右y左右 以及 置信度 类别值
    with dt[2]:
        pred = non_max_suppression(pred, conf_thres, iou_thres, classes, agnostic_nms, max_det=max_det)
        
    print(f'pred:{pred}') # 张量，shape为(1, 1000, 6)，1000为预测框的数量，6为每个预测框的信息（x1,y1,x2,y2,confidence,class）


```

`Profile()`是ultralytics定义的一个类，是一个简单的上下文管理器（Context Manager）装饰器（Decorator），用于在代码中测量运行时间。内容如下：

```python

class Profile(contextlib.ContextDecorator):
    # YOLOv5 Profile class. Usage: @Profile() decorator or 'with Profile():' context manager
    def __init__(self, t=0.0, device: torch.device = None):
        self.t = t
        self.device = device
        self.cuda = bool(device and str(device).startswith("cuda"))
	
	# 被调用当进入 with 语句块时，它记录当前时间戳，并将其保存在 self.start 属性中
    def __enter__(self):
        self.start = self.time()
        return self
	# 被调用当退出 with 语句块时，计算从进入到退出的时间差，保存在 self.dt 中，并将其累积到 self.t 中
    def __exit__(self, type, value, traceback):
        self.dt = self.time() - self.start  # delta-time
        self.t += self.dt  # accumulate dt
        
	# 返回当前时间戳，如果 self.cuda 为 True（即运行在 CUDA 设备上），则在返回前调用了 torch.cuda.synchronize 以确保测量的时间准确
    def time(self):
        if self.cuda:
            torch.cuda.synchronize(self.device)
        return time.time()
```

核心代码中，包含一个预热函数`warmup`：

```python
# 通过运行一次推理来预热模型
def warmup(self, imgsz=(1, 3, 640, 640)):
    # Warmup model by running inference once
    warmup_types = self.pt, self.jit, self.onnx, self.engine, self.saved_model, self.pb, self.triton
    if any(warmup_types) and (self.device.type != 'cpu' or self.triton):
        im = torch.empty(*imgsz, dtype=torch.half if self.fp16 else torch.float, device=self.device)  # input
        for _ in range(2 if self.jit else 1):  
            self.forward(im)  # warmup
```

接下来是保存为csv文件的代码，只有当前面选择`save_csv`时才会执行。

```python
        # Define the path for the CSV file
        csv_path = save_dir / "predictions.csv"

        # Create or append to the CSV file
        def write_to_csv(image_name, prediction, confidence):
            data = {"Image Name": image_name, "Prediction": prediction, "Confidence": confidence}
            with open(csv_path, mode="a", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=data.keys())
                if not csv_path.is_file():
                    writer.writeheader()
                writer.writerow(data)
```

继续处理推理信息：

```python
# Process predictions

# 对每张图片进行处理，将pred(相对img_size 640)映射回原图img0 size
# 此处的det，表示5个检测框中的信息，i是每个batch的信息
for i, det in enumerate(pred): 
    
    print('正在进入Pred迭代...')
    print(f'i:{i},det:{det}') # i:0
    
	# 每处理一张图片，就会加1 
    seen += 1
    # 输入源是网页，对应取出dataset中的一张照片
    if webcam:  # batch_size >= 1
        p, im0, frame = path[i], im0s[i].copy(), dataset.count
        s += f'{i}: '
    else:
    	# p为当前图片或者视频绝对路径
    	# im0原始图片
    	# frame: 初始为0  可能是当前图片属于视频中的第几帧
        p, im0, frame = path, im0s.copy(), getattr(dataset, 'frame', 0)
        
        print(f'p:{p},im0:{im0},frame:{frame}') # p data/images/bus.jpg im0 [[[[]]]] frame 0

```

上面这段代码，实际上是在迭代`pred`这个对象。`pred`是什么呢？就是模型输出的一个batch里的预测数据，当bs为1，或者只有一张图片时，这个pred就只是由一个多维张量组成的列表。

```python
    p = Path(p)  # to Path
    # 图片的保存路径
    save_path = str(save_dir / p.name)  # im.jpg
    # txt 保存路径（保存预测框的坐标）
    txt_path = str(save_dir / 'labels' / p.stem) + ('' if dataset.mode == 'image' else f'_{frame}')  # im.txt

	# 输出图片shape (w, h)
    s += '%gx%g ' % im.shape[2:]  # print string
    # gn = [w, h, w, h]  用于后面的归一化
    gn = torch.tensor(im0.shape)[[1, 0, 1, 0]]  # normalization gain whwh
    # imc: for save_crop 在save_crop中使用
    imc = im0.copy() if save_crop else im0  # for save_crop

	# 自定义的绘图工具，入参是图片，画图检测框的粗细，以及数字-标签对应的字典
    annotator = Annotator(im0, line_width=line_thickness, example=str(names))
    if len(det):
        
        print('正在进入scale_boxes...')
        print(f'det:{det}') # [[],[],[]] 张量，每个子列表为一个预测框的信息（x1,y1,x2,y2,confidence,class）

        # Rescale boxes from img_size to im0 size
        # 将预测信息（相对img_size 640）映射回原图 img0 size
        det[:, :4] = scale_boxes(im.shape[2:], det[:, :4], im0.shape).round()
        
        print(f'已经完成了scale_boxes...')
        print(f'det:{det}') # [[],[],[]] 张量，每个子列表为一个预测框的信息（x1,y1,x2,y2,confidence,class）

        # Print results
        # 统计每个框的类别
        for c in det[:, 5].unique():
            n = (det[:, 5] == c).sum()  # detections per class
            s += f"{n} {names[int(c)]}{'s' * (n > 1)}, "  # add to string

        print(f's:{s}') # s image 1/2 C:\Users\ZeroLoveSeA\Desktop\学习\CV\yolov5\data\images\bus.jpg: 640x480 4 persons, 1 bus
```

## 绘制预测图

前面得到了预测的结果`det`，也就是一个多张量的列表，其中每个子列表为一个预测框的信息（x1,y1,x2,y2,confidence,class），接下来就需要遍历这个列表里面的每一个预测框，在一张图片上绘图。

这里用到了`reversed`这个方法，用来将一个张量里的所有元素都进行倒序排列。我理解这样可以进行后续的操作`for *xyxy, conf, cls in reversed(det)`，可以直接拿到最后两位作为置信度和分类标签。

```python
        print(f'reversed(det):{reversed(det)}') # 反向张量，每个子列表为一个预测框的信息(class, confidence, y2,y1,x2,x1)

        # 保存预测信息: txt、img0上画框、crop_img
        # 迭代每个预测框，*xyxy是前四位，conf是第五位，cls是第六位
        for *xyxy, conf, cls in reversed(det):
        	# 将每个图片的预测信息分别存入save_dir/labels下的xxx.txt中 每行: class_id+score+xywh
            if save_txt:  # Write to file
            	# 将xyxy(左上角 + 右下角)格式转换为xywh(中心的 + 宽高)格式 并除以gn(whwh)做归一化 转为list再保存
                xywh = (xyxy2xywh(torch.tensor(xyxy).view(1, 4)) / gn).view(-1).tolist()  # normalized xywh
                line = (cls, *xywh, conf) if save_conf else (cls, *xywh)  # label format
                with open(f'{txt_path}.txt', 'a') as f:
                    f.write(('%g ' * len(line)).rstrip() % line + '\n')
	
			# 在原图上画框 + 将预测到的目标剪切出来 保存成图片 保存在save_dir/crops下
            if save_img or save_crop or view_img:  # Add bbox to image
                c = int(cls)  # integer class
                label = None if hide_labels else (names[c] if hide_conf else f'{names[c]} {conf:.2f}')
                
                print('正在绘制框...')
                print(f'xyxy:{xyxy},label:{label},color:{colors(c, True)}')
                # xyxy:[tensor(0.), tensor(552.), tensor(68.), tensor(875.)],label:person 0.53,color:(56, 56, 255)
 				
 				# 使用了自定义库中的box_label方法来进行绘图，color中的c参数是cls的个数
                annotator.box_label(xyxy, label, color=colors(c, True))		
           # 如果需要就将预测到的目标剪切出来 保存成图片 保存在save_dir/crops下
            if save_crop:
                save_one_box(xyxy, imc, file=save_dir / 'crops' / names[c] / f'{p.stem}.jpg', BGR=True)

    # Stream results
    im0 = annotator.result()
    if view_img:
        if platform.system() == 'Linux' and p not in windows:
            windows.append(p)
            cv2.namedWindow(str(p), cv2.WINDOW_NORMAL | cv2.WINDOW_KEEPRATIO)  # allow window resize (Linux)
            cv2.resizeWindow(str(p), im0.shape[1], im0.shape[0])
        # 通过imshow显示出框
        cv2.imshow(str(p), im0)
        cv2.waitKey(1)  # 1 millisecond

    # 是否需要保存图片或视频（检测后的图片/视频 里面已经被我们画好了框的） img0
    if save_img:
        if dataset.mode == 'image':
            cv2.imwrite(save_path, im0)
        else:  # 'video' or 'stream'
            if vid_path[i] != save_path:  # new video
                vid_path[i] = save_path
                if isinstance(vid_writer[i], cv2.VideoWriter):
                    vid_writer[i].release()  # release previous video writer
                if vid_cap:  # video
                    fps = vid_cap.get(cv2.CAP_PROP_FPS)
                    w = int(vid_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    h = int(vid_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                else:  # stream
                    fps, w, h = 30, im0.shape[1], im0.shape[0]
                save_path = str(Path(save_path).with_suffix('.mp4'))  # force *.mp4 suffix on results videos
                vid_writer[i] = cv2.VideoWriter(save_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
            vid_writer[i].write(im0)

# Print time (inference-only)
LOGGER.info(f"{s}{'' if len(det) else '(no detections), '}{dt[1].dt * 1E3:.1f}ms")
```

## 打印信息

最后输出打印的信息：

```python
# seen为预测图片总数，dt为耗时时间，求出平均时间
t = tuple(x.t / seen * 1E3 for x in dt)  # speeds per image
LOGGER.info(f'Speed: %.1fms pre-process, %.1fms inference, %.1fms NMS per image at shape {(1, 3, *imgsz)}' % t)

# 保存预测的label信息 xywh等   save_txt
if save_txt or save_img:
    s = f"\n{len(list(save_dir.glob('labels/*.txt')))} labels saved to {save_dir / 'labels'}" if save_txt else ''
    LOGGER.info(f"Results saved to {colorstr('bold', save_dir)}{s}")
if update:
	# strip_optimizer函数将optimizer从ckpt中删除  更新模型
    strip_optimizer(weights[0])  # update model (to fix SourceChangeWarning)
```

## 参数导入

这里没啥好说的，单纯导入参数：

```python
def parse_opt():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", nargs="+", type=str, default=ROOT / "yolov5s.pt", help="model path or triton URL")
    parser.add_argument("--source", type=str, default=ROOT / "data/images", help="file/dir/URL/glob/screen/0(webcam)")
    parser.add_argument("--data", type=str, default=ROOT / "data/coco128.yaml", help="(optional) dataset.yaml path")
    parser.add_argument("--imgsz", "--img", "--img-size", nargs="+", type=int, default=[640], help="inference size h,w")
    parser.add_argument("--conf-thres", type=float, default=0.25, help="confidence threshold")
    parser.add_argument("--iou-thres", type=float, default=0.45, help="NMS IoU threshold")
    parser.add_argument("--max-det", type=int, default=1000, help="maximum detections per image")
    parser.add_argument("--device", default="", help="cuda device, i.e. 0 or 0,1,2,3 or cpu")
    parser.add_argument("--view-img", action="store_true", help="show results")
    parser.add_argument("--save-txt", action="store_true", help="save results to *.txt")
    parser.add_argument("--save-csv", action="store_true", help="save results in CSV format")
    parser.add_argument("--save-conf", action="store_true", help="save confidences in --save-txt labels")
    parser.add_argument("--save-crop", action="store_true", help="save cropped prediction boxes")
    parser.add_argument("--nosave", action="store_true", help="do not save images/videos")
    parser.add_argument("--classes", nargs="+", type=int, help="filter by class: --classes 0, or --classes 0 2 3")
    parser.add_argument("--agnostic-nms", action="store_true", help="class-agnostic NMS")
    parser.add_argument("--augment", action="store_true", help="augmented inference")
    parser.add_argument("--visualize", action="store_true", help="visualize features")
    parser.add_argument("--update", action="store_true", help="update all models")
    parser.add_argument("--project", default=ROOT / "runs/detect", help="save results to project/name")
    parser.add_argument("--name", default="exp", help="save results to project/name")
    parser.add_argument("--exist-ok", action="store_true", help="existing project/name ok, do not increment")
    parser.add_argument("--line-thickness", default=3, type=int, help="bounding box thickness (pixels)")
    parser.add_argument("--hide-labels", default=False, action="store_true", help="hide labels")
    parser.add_argument("--hide-conf", default=False, action="store_true", help="hide confidences")
    parser.add_argument("--half", action="store_true", help="use FP16 half-precision inference")
    parser.add_argument("--dnn", action="store_true", help="use OpenCV DNN for ONNX inference")
    parser.add_argument("--vid-stride", type=int, default=1, help="video frame-rate stride")
    opt = parser.parse_args()
    opt.imgsz *= 2 if len(opt.imgsz) == 1 else 1  # expand
    print_args(vars(opt))
    return opt


def main(opt):
	# 检查是否安装依赖项
    check_requirements(ROOT / "requirements.txt", exclude=("tensorboard", "thop")) 
    run(**vars(opt))


if __name__ == "__main__":
    opt = parse_opt()
    main(opt)
```

整体看下来，代码逻辑是比较清晰易懂的。记得我第一次看这个代码的时候，被里面很多python的用法都吓到了，现在回过头看看，并不是很复杂，难点主要在怎么对张量进行变换。

2024/1/21 于苏州家中
