---
title: Python开发：装饰器如何理解和使用？
date: 2024-01-04 21:37:06
tags: 
  - Python
  - 装饰器
  - 工程实践
categories: Python
excerpt: Python中的装饰器的理解，以及使用教程。
index_img:  "/img/python.png"
---
# 装饰器

看社区代码的时候经常会看到装饰器的出现，我原先大概知道它的概念，也就是使用一个函数作为另一个函数的输入。今天上班路上刚好刷到码农高天的讲解视频，感觉对它的理解更深了一点，因此写篇博客记录一下。

首先提到了闭包的概念。

> 闭包：在函数中嵌套一个函数，并引用了外部函数的变量。

例如以下代码：

```python
def outer(x):
    def inner(y):
        return x + y
    return inner

print(outer(9)(5))
# 14
```

上面的例子中，整个函数运行时，先运行`outer`函数，将`x`传入，随后运行`inner`函数的时候，又用到了`outer`函数的参数，最终输出结果。

Python中的装饰器就是一个语法糖，实现了闭包的作用，这样你可以利用重复调用外部函数，构建不同的函数。

> 语法糖：由英国计算机科学家彼得·兰丁发明的一个术语，指计算机语言中添加的某种语法，这种语法对语言的功能没有影响，但是更方便程序员使用。

一个经典的例子，用于统计内部函数的运算时间：

```python
import time

def time_calc(function):
    def wrapper(*args, **kargs):        
        start_time = time.time() # 起始时间        
        f = function(*args,**kargs) # 函数调用       
        exec_time = time.time() - start_time # 统计结束时间        
        return f    
    return wrapper   # 最后返回内部函数
    
# 使用装饰器
@time_calc    
def add(a, b):
    return a + b
    
@time_calc
def sub(a, b):    
    return a - b
```

我们可以对比以下不用装饰器应该怎么写：

```python
# 定义一个新的add函数，但是没用装饰器
def no_decorator(a, b):
    return a + b

f = time_calc(add)(1,2)

>> 3
>> 函数 no_decorator() 执行时间为: 0.000000 秒    
```

而使用装饰器时，可以看到代码更清晰了：

```python
add(1,2)

>> 3
>> 函数 add() 执行时间为: 0.000000 秒
```

# 同时使用多个装饰器

当一个函数同时使用多个装饰器时，将依次调用。例如：

```python
def decorator_a(func):
    def inner_a(*args, **kwargs):
        print 'Get in inner_a'
        return func(*args, **kwargs)
    return inner_a

def decorator_b(func):
    def inner_b(*args, **kwargs):
        print 'Get in inner_b'
        return func(*args, **kwargs)
    return inner_b

@decorator_b
@decorator_a
def f(x):
    print 'Get in f'
    return x * 2
f(1)

>> Get in inner_b
>> Get in inner_a
>> Get in f
```

也就是运行时，先运行了decorator_b，再运行了decorator_a，最后运行的被装饰的内部函数f(x)。

# 闭包函数和装饰器的return

前面我们看到，在一个装饰器中，有两个return，分别是闭包函数的return和装饰器的return。如何理解他们呢？

例如如下：
```python
def my_decorator(func):
    def wrapper():
        print("执行装饰器逻辑")
        func()  # 调用原始函数
    return wrapper  # 返回闭包函数

@my_decorator
def say_hello():
    print("Hello!")

say_hello()  # 输出 "执行装饰器逻辑" 和 "Hello!"
```

首先，闭包函数没有return，但是可以接收到装饰器函数的变量。装饰器函数有return。运行时返回的是`wrapper`这个函数。当使用` @my_decorator` 装饰 say_hello 函数时，say_hello 被重新赋值为`wrapper`函数。

当装饰器函数和闭包函数都有返回值时，函数的最终返回值是最内层执行的函数的返回值。例如：

```python
def my_decorator(func):
    def wrapper():
        print("这是装饰器的内部函数")
        return func()  # 调用原始函数并返回其结果
    return wrapper  # 返回装饰器的内部函数

@my_decorator
def my_function():
    print("这是原始函数")
    return "返回值来自原始函数"

result = my_function()
print(result)  

>> 这是装饰器的内部函数
>> 这是原始函数
>> 返回值来自原始函数
```

这个例子中闭包函数的返回值是`“返回值来自原始函数”`，而装饰器则返回装饰过后的函数。

result是闭包函数的返回值，也就是最后return的`“返回值来自原始函数”`。在这过程中，装饰器函数先被调用，返回一个修改过后的闭包函数，而闭包函数产生传入函数的结果。

# 实际用例

从网上看了一个例子：

进入视图函数前，需要增加自定义验证（比如判断是否为空，是否包含危险字符等），涉及两个装饰器：@login_required和@custom_login_required

```python

def login_required(func):
    def inner():
        #一般这里是验证逻辑
        ...
        func()
    return inner
 
def custom_login_required(func):
    def inner():
        #这里添加自定义验证逻辑
        ...
        func()
    return inner
 
 
@custom_login_required
@login_required
def index(request):
	...
```

上面这个函数等价于`index = custom_login_required(login_required(index))`

> 使用python装饰器的好处就是在不用更改原函数的代码前提下给函数增加新的功能。从这句话来看，也可以知道装饰器的作用是在原函数的基础上外挂一些额外的功能。因此。装饰器函数的返回是调用传入函数函数的一个函数 。

# 使用类作为装饰器

类同样可以作为装饰器，接收一个对象进行初始化，例如：

```python
 class myDecorator(object):
     def __init__(self, f):
         print("inside myDecorator.__init__()")
         f() # Prove that function definition has completed
     def __call__(self):
         print("inside myDecorator.__call__()")
 
 @myDecorator
 def aFunction():
     print("inside aFunction()")
 
 print("Finished decorating aFunction()")
 aFunction()


 >> inside myDecorator.__init__()
 >> inside aFunction()
 >> Finished decorating aFunction()
 >> inside myDecorator.__call__()
```

上面这个例子中，`aFunction`使用了`myDecorator`这个类作为装饰器，这个装饰器的作用是接收一个函数，在初始化时运行它。

当为`aFunction`定义`@myDecorator`这个装饰器的同时，装饰器函数被实例化了。在实例的同时，执行了一次闭包函数`aFunction`。因此，先打印的句子是`inside myDecorator.__init__()` 和`inside aFunction()`。

随后打印了`Finished decorating aFunction()`。最后打印了`inside myDecorator.__call__()`，这是因为是装饰器的返回内容。换句话说，最后我们运行了被装饰过后的`aFunction`，而不是它的原函数。因此它执行的是`myDecorator`这个类的执行函数，也就是魔法函数`__call__`。

> 被装饰后的函数`aFunction()`实际上已经是类`myDecorator`的对象。当再调用`aFunction()`函数时，实际上就是调用类`myDecorator`的对象，因此会调用到类`myDecorator`的`__call__()`方法。

# 多参数对象作为装饰器

前面是把类作为装饰器，同样可以把类实例化成对象后作为装饰器调用。例如：

```python
 class Decorator:
     def __init__(self, arg1, arg2):
         print('执行类Decorator的__init__()方法')
         self.arg1 = arg1
         self.arg2 = arg2
         
     def __call__(self, f):
         print('执行类Decorator的__call__()方法')
         def wrap(*args):
             print('执行wrap()')
             print('装饰器参数：', self.arg1, self.arg2)
             print('执行' + f.__name__ + '()')
             f(*args)
             print(f.__name__ + '()执行完毕')
         return wrap
     
 @Decorator('Hello', 'World')
 def example(a1, a2, a3):
     print('传入example()的参数：', a1, a2, a3)
     
 >> 执行类Decorator的__init__()方法
 >> 执行类Decorator的__call__()方法
```

以上代码中，装饰器是一个类，在实际调用中，往装饰器传参使其变成一个实例对象。哪怕没有运行传入的函数，在调用装饰器的同时已经开始了实例化并执行`__call__`方法，因此可以看到已经产生了结果。

```python
example('Wish', 'Happy', 'EveryDay')
print('测试代码执行完毕')

>> 执行wrap()
>> 装饰器参数： Hello World
>> 执行example()
>> 传入example()的参数： Wish Happy EveryDay
>> example()执行完毕
>> 测试代码执行完毕
```

在实例化之后，直接运行这个被装饰后的函数。可以看到，它直接从`__call__`方法中的`wrap`函数开始执行。

# 自定义的实例

我又写了一个测试实例：

```python
class test_dec:
    def __init__(self,arg1,arg2):
        self.arg1 = arg1
        self.arg2 = arg2
    def __call__(self,f):
        def wrap(*args):
            print('装饰器参数：',self.arg1,self.arg2)
            return f(*args)
        return wrap
    
@test_dec('hello','world')
def example(a1,a2,a3):
    print('传入example()的参数：',a1,a2,a3)
    return('a,b,c')

b = example('Wish', 'Happy', 'EveryDay')
b

>> 装饰器参数： hello world
>> 传入example()的参数： Wish Happy EveryDay

>> 'a,b,c'
```

在应用时，装饰器被实例化，它会对闭包函数进行装饰，加上了一个print语句。同时返回装饰后的闭包函数。外部函数则print一个语句，并返回a, b, c。

当执行`b = example('Wish', 'Happy', 'EveryDay')`时，依次执行了装饰器和函数本身，最后的结果：闭包函数的结果被赋值给了b。



2024/1/4 于苏州

