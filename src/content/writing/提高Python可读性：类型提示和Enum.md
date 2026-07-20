---
title: "提高Python可读性：Type Hints的应用"
description: "Python中的Typing类型提示的使用用例。"
pubDate: "2024-01-08 20:50:59"
---

Python的类型提示是从3.6版本引入的。什么是类型提示？就是在各个方法中提前预设好需要的变量类型是什么。尽管Python作为动态类型语言，只有在运行时才能获得数据，但是它也提供了数据类型提示，来使得开发时更少的出现报错。

Python中提供了两种方式：原生和Typing库。它们的作用有两个：

1. 让IDE识别，进行告警和提示。
2. 帮助其他开发者理解代码。

此处附上一个非常有用的[参考链接](https://zhuanlan.zhihu.com/p/424042902?hmsr=toutiao.io&utm_campaign=toutiao.io&utm_medium=toutiao.io&utm_source=toutiao.io)。

# Built-In Type Hints

例如我们可以定义函数：

```python
def add_int(a: int, b: int) -> str:  
    return f"{a}-{b}"  

r = add_int(2, 'hello')  
print(r)
```

可以看到，这个函数的两个参数被指定为`int`，输出则为`str`。因此当使用时，输入错误变量类型时就会报错。

Python原生类型包括了：

1. **基本类型**:
   - `int`: 整数
   - `float`: 浮点数
   - `bool`: 布尔值
   - `str`: 字符串
2. **特殊类型**:
   - `None`: 表示没有值
3. **集合类型**:
   - `list`: 列表
   - `tuple`: 元组
   - `set`: 集合
   - `dict`: 字典

其中值得主意的是`None`。当一个方法没有return任何东西时，它的返回就是`None`。

为了提供更全面的提示，还能够通过导入typing库来进行提示。

## 容器类型

有时候，需要标注输入的参数是一个列表，且列表中只能为int，可以这么写：

```python
def my_sum(lst: list[int]) -> int:
    total = 0
    for i in lst:
        total += i 
    return total
```

这就是一个很好的例子。同样的，还可以这样：

```python
l: list[int] = [1, 2, 3]

t: tuple[str, ...] = ("a", "b")

d: dict[str, int] = {
    "a": 1,
    "b": 2,
}
```

## 类型别名

对于一些多重嵌套的类型，还可以自定义类型别名，例如：

```python
Config = list[tuple[str, int], dict[str, str]]

config: Config = [
    ("127.0.0.1", 8080),
    {
        "MYSQL_DB": "db",
        "MYSQL_USER": "user",
        "MYSQL_PASS": "pass",
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3306",
    },
]

def start_server(config: Config) -> None:
    pass

start_server(config)
```

## 可变类型

对于一些可变的参数，也可以添加类型标注：

```python
def my_function(*args: str, **kwargs: int) -> None:
    ...

my_function("a", "b", 1, x=2, y="c")
```

# Typing库

在Python3.9以前，有一些类型需要通过`typing`库来提供支持：

例如：

```python
# for Python 3.9+ 
l1: list[int] = [1, 2, 3]
t1: tuple[int, int] = (1, 2)
d1: dict[str, int] = {"a": 3, "b": 4}

# for Python 3.8 and earlier
from typing import List, Tuple, Dict

x: List[int] = [1]
x: Tuple[int, str, float] = (3, "yes", 7.5)
x: Dict[str, float] = {'field': 2.0}
```

以下提供了一些常用的类型解释：

| Type              | Description                                              |
| ----------------- | -------------------------------------------------------- |
| int               | 整型                                                     |
| float             | 浮点数字                                                 |
| bool              | 布尔                                                     |
| str               | 字符串                                                   |
| bytes             | 8位字符                                                  |
| object            | 任意对象                                                 |
| List(str)         | 字符串组成的列表                                         |
| Tuple[int, …]     | 任意数量的int对象的元组                                  |
| Tuple[int, int]   | 两个int对象的元组                                        |
| Dict[str, int]    | 键是 str 值是 int 的字典                                 |
| Iterable[int]     | 包含 int 的可迭代对象                                    |
| Sequence[bool]    | 布尔值序列（只读）                                       |
| Mapping[str, int] | 从 str 键到 int 值的映射（只读）                         |
| Any               | 具有任意类型的动态类型值                                 |
| Union             | 联合类型                                                 |
| Optional          | 参数可以为空或已经声明的类型                             |
| Mapping           | 映射，是 collections.abc.Mapping 的泛型                  |
| MutableMapping    | Mapping 对象的子类，可变                                 |
| Generator         | 生成器类型, Generator[YieldType、SendType、ReturnType]   |
| NoReturn          | 函数没有返回结果，等同None                               |
| Set               | 集合 set 的泛型, 推荐用于注解返回类型                    |
| AbstractSet       | collections.abc.Set 的泛型，推荐用于注解参数             |
| Sequence          | ollections.abc.Sequence 的泛型，list、tuple 等的泛化类型 |
| TypeVar           | 自定义兼容特定类型的变量                                 |
| NewType           | 声明一些具有特殊含义的类型                               |
| Callable          | 可调用类型, Callable[[参数类型], 返回类型]               |

有一些值得注意的类型：

`Any`：表示能够返回任何类型，这也是python默认的返回类型。

`TypeVar`：可以使用它来接收任意类型，例如：

```py
height = 1.75
Height = TypeVar('Height', int, float, None)
def get_height() -> Height:
    return height
```

`Union`：可以使用指定的类型，例如：

```python
from typing import Union

def concat(s1: Union[str, bytes], s2: Union[str, bytes]) -> Union[str, bytes]:
    return s1 + s2
```

## TypeVar和Union的区别

TypeVar对多参数的要求更加严格，必须类型是一致的，而不能混着来，例如：

```python
from typing import TypeVar

T = TypeVar("T", str, bytes)

def concat(s1: T, s2: T) -> T:
    return s1 + s2

concat("hello", "world")
concat(b"hello", b"world")
concat("hello", b"world") # 报错，因为两个输入的类型不一致。
```

`Optional`：表示一个值可以是特定类型或 `None`。这在函数参数和返回类型中很有用，因为它允许你明确地表达某个值可能不存在的情况，例如：

```python
from typing import Optional

def greet(name: Optional[str]) -> Optional[str]:
    if name:
        return f"Hello, {name}"
    else:
        return None

result = greet("Alice")
print(result)  # 输出: Hello, Alice

result = greet(None)
print(result)  # 输出: None
```

上述函数中，输入和输出都可能是空值。

事实上，`Optional[str]` 与 `Union[str, None]` 是等价的。

`NewType`：可以声明一些具有特殊含义的类型：

```py
Person = NewType('Person', Tuple[str, int, float])
person = Person(('Mike', 22, 1.75))
```

# Type Hints实践

## Dataclass

在实际开发中，有很多可以用到类型提示的方法，例如：

```python
from dataclasses import dataclass, field

@dataclass
class User(object):
    id: int
    name: str
    friends: list[int] = field(default_factory=list)

data = {
    "id": 123,
    "name": "Tim",
}

user = User(**data)
print(user.id, user.name, user.friends)
```

上面的例子中，我们给User的属性规定了类型。

## Pydantic

Pydantic也基于Type Hints，用来对数据类型进行检查：

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

class User(BaseModel):
    id: int
    name = 'John Doe'
    signup_ts: Optional[datetime] = None
    friends: list[int] = []

external_data = {
    'id': '123',
    'signup_ts': '2021-09-02 17:00',
    'friends': [1, 2, '3'],
}
user = User(**external_data)
```

2024/1/8 于苏州
