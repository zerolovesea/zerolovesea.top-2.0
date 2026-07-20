---
title: Python常用装饰器汇总
date: 2024-01-05 22:13:48
tags: 
  - Python
  - 装饰器
  - 工程实践
categories: Python
excerpt: 分析一些常用的装饰器，如何使用它提升代码效率。
index_img:  "/img/python.png"
---

前面提到了装饰器的一些原理和使用方法，这一篇博客专门讲一下有哪些常用的装饰器。

# @property

在开发中，经常会需要构建类。构建类的时候是需要为类分配属性的。往往的属性会被写在`__init__`方法下，如下：

```python
class Predict:
    def __init__(self,arg1,arg2):
        self.arg1 = arg1
        self.arg2 = arg2
```

这种方式构建的类实例，可以被轻松赋值更改，例如：

```python
predict_instance = Predict(arg1=1,arg2=2)
predict_instance.arg1 = 3
```

这样就会使得使用时安全性大大降低。为了解决这个问题，需要引入私有属性。例如：

```python
class Predict:
    def __init__(self,arg1,arg2):
        self.__arg1 = arg1
        self.__arg2 = arg2
```

这时候就无法访问`arg1`这个私有属性了，要怎么访问呢？那就需要定义一个方法去删除：

```python
class Predict:
    def __init__(self,arg1,arg2):
        self.__arg1 = arg1
        self.__arg2 = arg2
    
    @property
    def arg1(self):
        return self.__age
    
    @property
    def arg2(self):
        return self.__age
```

通过定义了两个方法，就可以访问到这两个私有变量了。那么这里`@property`这个装饰器起到的作用就是把这两个方法变成可以直接调用的属性，这样调用时就不需要像普通方法一样写成`arg1()`了。

如果还想修改和删除这些私有变量，就需要再构建新的方法，并使用原方法组装成装饰器，例如：

```python
@arg1.setter
def arg1(self, arg1):
    if isinstance(arg1, int):
        self.__arg1 = arg1
    else:
        raise ValueError

@arg1.deleter
def age1(self):
    print("删除年龄数据！")
    
predict_instance.arg1 = 3
del predict_instance.arg1
```

通过设置了这两个方法，就可以和之前一样对私有变量进行修改 。

# @abstractmethod

`@abstractmethod`是一个实现抽象方法的装饰器。所谓抽象方法，就是一个模板，后续继承自该类的类都需要满足`abstractmethod`的方法。这是为了模块化功能，使得项目代码更清晰。

```python
from abc import abstractmethod

class LLM_Base():
    def __init__(self):
		pass
    
    @abstractmethod
    def predict(self):
        pass
```

在基类不需要实现具体的方法，但需要在子类中实现。

```python
class OpenAI(LLM_Base)
	def __init__(self,model):
        self.model = model
    
    def predict(self,message):
        return (model.predict(message))
```

可以看到OpenAI类继承自LLM_Base，并实现了predict的方法。如果没有实现就会报错。

# @classmethod 

`@classmethod`和后面提到的`@staticmethod`有点像，它的作用是让类里的方法可以直接调用类的参数，并且不需要实例化类。也就是说，这个方法不需要`self`参数，但是第一个参数需要是`cls`，这代表类本身：从原理上来说，这个方法在内部先实例化了类，因此不需要外部显式的实例化。

举一个例子：

```python
import datetime

class Person:
    def __init__(self, name, birthdate):
        self.name = name
        self.birthdate = birthdate

    def calculate_age(self):
        today = datetime.date.today()
        age = today.year - self.birthdate.year - ((today.month, today.day) < (self.birthdate.month, self.birthdate.day))
        return age

    def display(self):
        return f"{self.name} is {self.calculate_age()} years old."

    @classmethod
    def from_birthyear(cls, name, birthyear):
        ""通过输入名字和日期生成一个实例。"""
        return cls(name, datetime.date(birthyear, 1, 1))

```

上面实现了一个类，这个类要求初始化时输入姓名和出生日期。同时也支持通过类方法`from_birthyear`创建实例，其中的`cls`不需要显式传递。

```pytho
# 使用普通的 __init__ 方法创建实例
person1 = Person("Alice", datetime.date(1990, 10, 15))
print(person1.display())  # 输出：Alice is 34 years old.

# 使用 @classmethod 创建实例
person2 = Person.from_birthyear("Bob", 1995)
print(person2.display())  # 输出：Bob is 29 years old.
```

> 网上翻阅了一些相关内容，发现这个classmethod的好处主要是在可以直接调用类的参数。例如：
>
> ```python
> import math
> class Pizza(object):
>     def __init__(self, radius, height):
>         self.radius = radius
>         self.height = height
>  
>     @staticmethod
>     def compute_area(radius):
>         return math.pi * (radius ** 2)
>  
>     @classmethod
>     def compute_volume(cls, height, radius):
>         return height * cls.compute_area(radius)    #调用@staticmethod方法
>  
>     def get_volume(self):
>         return self.compute_volume(self.height, self.radius)   
>     
> print(Pizza.compute_volume(12, 2))
> 
> >> 150.79644737231007
> ```
>
> 可以看到它可以直接调用类里的静态方法。

# @staticmethod

静态方法就很好理解了，相比`classmethod`，它不需要实例化类，也不用类里的参数，只是一个单独可以调用的方法。之所以引入它，是为了区分这个函数属于某一类。例如：

```python
class MathUtility:
    @staticmethod
    def add_numbers(num1, num2):
        """Static method to add two numbers."""
        return num1 + num2
    
sum = MathUtility.add_numbers(num1=4,num2=5)
```

# @dataclass

`@dataclass`在python3.7被引入。它的主要作用就是省略了`__init__`这个过程传统写类的时候，需要给类写一个初始化方法：

```python
def __init__(self, name: str, unit_price: float, quantity_on_hand: int = 0):
    self.name = name
    self.unit_price = unit_price
    self.quantity_on_hand = quantity_on_hand
```

而使用了`@dataclass`后，只需要这样：

```python
from dataclasses import dataclass

@dataclass
class InventoryItem:
    name: str
    unit_price: float
    quantity_on_hand: int = 0

    def total_cost(self) -> float:
        return self.unit_price * self.quantity_on_hand
```

此外，这个装饰器实际上不止实现了`__init__`方法，还实现了其他数据相关的魔术方法，例如：`__eq__`，`__repr__`等等。

我们还可以设置其中的`forzen`参数，将类参数设置为只读对象：

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Person:
    name: str
    age: int
    iq: int = 100
```

# @overload

`overload`主要解决的是重载的概念。正常情况下，当Python同时定义两个同名方法时，后者才是真正调用时会被用到的方法，例如：

```python
def quack():
    print("Quack: ")

def quack(mark):
    print(f"Quack: {mark}")
    
quack # 报错
quack('Hello') # Quack: Hello
```

如果调用`overload`，就可以实现覆盖的效果。最后一个没有`overload`装饰器的同名方法将会涵盖之前的方法，例如：

```python
from typing import overload

class Duck:

    @overload
    def quack(self) -> None: 
        ...

    @overload
    def quack(self, mark: str) -> None: 
        ...

    # 以上两个方法最终会被这个方法覆盖掉
    def quack(self, arg=None):
        if arg:
            print(f"GaGaGa: {arg}")
        else:
            print("GaGaGa!")

d = Duck()
d.quack()                # Output: GaGaGa!
d.quack("I am a duck~")  # Output: GaGaGa: I am a duck~
```

`overload`实际上是一个类型检查的工具。它会为同名的所有方法，分配不同入参时的输出结果的类型。

> 有的时候，一个方法可能有多种入参的组合，输出的结果类型不一样，这个时候就可以用overload实现。

类似的例子：

```python
from typing import overload

class MyClass:
    @overload
    def my_method(self, x: int) -> int:
        pass
    
    @overload
    def my_method(self, x: str) -> str:
        pass

    def my_method(self, x):
        if isinstance(x, int):
            return x * 2
        elif isinstance(x, str):
            return x.upper()

obj = MyClass()

# 测试方法重载
print(obj.my_method(10))     # 输出: 20
print(obj.my_method('hello'))  # 输出: HELLO
```

理解了一下，用`overload`装饰的方法，只需要写它的入参类型和出参类型，具体实现是交给最后的方法实现。这个主要还是让IDE去理解，辅助类型提示。

# @singleton

`singleton`是一种设计思路，意为**单例模式**，也就是一个类只能有一个实例。基于这个思路可以手动实现`singleton`装饰器：

```python
def singleton(cls):
    """装饰器实现的 Singleton 模式"""
    instances = {}  # 存储类实例的字典

    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]

    return get_instance

@singleton
class MyClass:
    def __init__(self, value):
        self.value = value

# 创建实例
obj1 = MyClass(1)
obj2 = MyClass(2)

# 检查两个对象是否相同
print(obj1 is obj2)  # 输出: True
print(obj1.value)    # 输出: 1
print(obj2.value)    # 输出: 1
```

# @lru_cache

`@lru_cache`是Python 标准库中 `functools` 模块提供的一个装饰器，用于实现函数的缓存功能。`LRU` 代表 "Least Recently Used"（最近最少使用），这意味着当缓存达到其最大大小时，最早缓存的项会被删除以为新的项腾出空间。

使用 `@lru_cache` 装饰器可以优化那些计算密集型、且参数相同的函数，因为它会缓存函数的结果，避免对相同输入进行重复计算。例如：

```python
from functools import lru_cache

@lru_cache(maxsize=3)  # 设置最大缓存大小为 3
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# 计算斐波那契数列的值
print(fibonacci(10))  # 第 10 个斐波那契数是 55

# 由于使用了缓存，再次调用 fibonacci(10) 时，结果会立即返回，而不需要再次计算
print(fibonacci(10))  # 仍然输出 55，但不会执行递归计算
```

# @log_results

在运行复杂的函数调用时，跟踪每个函数的输出变得至关重要。因此可以手动实现`@log_results`装饰器，来帮助我们记录函数的结果，以便于调试和监控:

```python
def log_results(func):
     def wrapper(*args, **kwargs):
         result = func(*args, **kwargs)
         with open("results.log", "a") as log_file:
             log_file.write(f"{func.__name__} - Result: {result}\n")
            return result
 
	return wrapper

@log_results
def calculate_metrics(data):
     # Your metric calculation code here
```

2024/1/6 于苏州