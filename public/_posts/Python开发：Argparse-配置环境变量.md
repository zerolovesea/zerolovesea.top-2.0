---
title: Python开发：Argparse/配置环境变量
date: 2023-12-30 17:03:00
tags:
  - Python
  - 工程实践
categories: Python
excerpt: 使用Argparse库能够解析命令行参数，运行用户在命令行直接为程序进行赋值。
index_img: "/img/python.png"
---

在训练模型/项目开发的时候，经常会遇到需要为程序赋值参数的场景。Python中的Argparse库就提供了这个功能。

# Argparse用法
我们先定义一个类，它包含一个run函数，需要在运行时输入一些参数，因此需要去这些参数进行解析：

```python
import argparse

# 定义一个类和对应的函数，这里我简单写一下
class PredictService:
	def __init__(self):
		pass
	@staticmethod
	def run(question: str,clear_data: bool,load_from_db: bool):
		if clear_data and load_from_db:
			some_function(question)
		return 
```
```python
if __name__ == '__main__':
	# 实例化参数解析器
    parser = argparse.ArgumentParser(description='Predict using the PredictService')
    parser.add_argument('--question', type=str, help='The question for prediction')
    parser.add_argument('--load_from_db', action='store_true', help='Load data from the database')
    parser.add_argument('--clear_data', action='store_true', help='Clear data')

args = parser.parse_args()

# 使用解析得到的参数
predict_service_instance = PredictService()

# 解析后，args会成为一个字典
sample_question = args.question 

predict_service_instance.run(
    question=args.question,
    load_from_db=args.load_from_db,
    clear_data=args.clear_data,
)
```

实际运行时，需要在命令行运行代码：

```bash
python your_script.py --question "What is the relationship between transformer models and computer vision?" --load_from_db --clear_data 
```
这样就大功告成了！


# 环境变量
有时候，出于安全，通常会将密钥/API存放在本地的环境变量文件里，这样在推送代码时，不会将隐私信息推送上去。同时，在运行代码时，需要对环境变量进行解析。

## 通过.env文件加载环境变量：
通过运行以下命令，能够获取本地的.env文件：
```python
from dotenv import load_dotenv
load_dotenv()
```
## 编写.env文件
编写环境变量文件也不复杂，直接在文件里赋值即可：
```
QUESTION=What is the relationship between transformer models and computer vision?
LOAD_FROM_DB=True
CLEAR_DATA=True
API=XXXXXXXXX
```

## 使用 os.environ 获取环境变量
加载环境变量后，就需要去获取变量。这时候可以把变量看作一个字典，使用get就可以提取。
```python
import os

# 优先使用命令行参数，如果没有则使用环境变量
question = os.environ.get('QUESTION', args.question)  
load_from_db = os.environ.get('LOAD_FROM_DB', 'False').lower() == 'true'
clear_data = os.environ.get('CLEAR_DATA', 'False').lower() == 'true'
txt = os.environ.get('TXT', args.txt)
```
这样就可以直接使用刚刚获取的环境变量值。
```python
predict_service_instance = PredictService()

predict_service_instance.run(
    question=question,
    load_from_db=load_from_db,
    clear_data=clear_data,
    txt=sample_text
)
```

这时候在命令行运行脚本时，就不需要输入信息了，因为它直接解析了本地的环境文件。

```bash
python your_script.py 
```

## 在命令行使用export导入环境变量：
除了解析环境文件，还可以直接在命令行手动导入环境变量，缺点是关了以后就需要重新输入：
```bash
export QUESTION="What is the relationship between transformer models and computer vision?"
export LOAD_FROM_DB=True
export CLEAR_DATA=True

python your_script.py
```

2023/12/30 于昆山



