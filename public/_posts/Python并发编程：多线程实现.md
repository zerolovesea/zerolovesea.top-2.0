---
title: Python并发编程：多线程实现
date: 2024-01-31 19:55:25
tags: 
  - Python
  - 多线程
  - 多进程
  - 工程实践
categories: Python
excerpt: Python中的并发多线程编程的实现，以及多线程与多进程的基础知识。
index_img:  "/img/python.png"
---

首先上定义：

{% note warning %}
进程：可以简单的理解为一个可以独立运行的程序单位，它是线程的集合，进程就是有一个或多个线程构成的。

线程：进程中的实际运行单位，是操作系统进行运算调度的最小单位。可理解为线程是进程中的一个最小运行单元。
{% endnote %}

当我们运行一个程序时，相当于运行了一个进程，在这个进程中包含了一个或多个线程。当我们需要同时运行多个程序时，就需要用到多进程，而需要更优的运行一个程序时，就需要多线程。

> 多线程共享同一进程的资源。

我们假设有两段代码：

```python
import time 
result = 0

for i in range(100000):
	result+=1
print(result)
```

```python
import time
import requests

url_list = [
    ('视频1','https://www.youtube.com/watch?v=ZKwIInkZK90'),
    ('视频2','https://www.youtube.com/watch?v=Ts2wussx4Js'),
    ('视频3','https://www.youtube.com/watch?v=zDWO7EMFBkQ')
]

print(time.time())
for file_name, url in url_list:
    res = requests.get(url)
    with open(file_name,mode='wb') as f:
        f.write(res.content)
    print(time.time())
```

上面两段代码代表着程序中的两个任务：高计算量和高IO读写。前者需要CPU的计算能力，后者不需要这么高的计算能力，而是高磁盘读写需求。

# 使用多线程实现下载任务

可以使用多线程实现上面的下载任务，这样程序可以在更优的分配任务。这里需要使用`threading`库：

```python
import time
import requests
import threading

url_list = [
    ('视频1','https://www.youtube.com/watch?v=ZKwIInkZK90'),
    ('视频2','https://www.youtube.com/watch?v=Ts2wussx4Js'),
    ('视频3','https://www.youtube.com/watch?v=zDWO7EMFBkQ')
]

def task(file_name,url):
    res = requests.get(url)
    with open(file_name,mode='wb') as f:
        f.write(res.content)
    print(time.time())

    
if __name__ == '__main__':
    print(time.time())
    for name, url in url_list:
        t = threading.Thread(target=task, args=(name,url))
        t.start()
```

在for遍历的时候，会不断的创建线程。当运行`t.start()`的时候，将开始启动所有线程。参数需要在`Thread`方法中传入。

# 使用多进程实现下载任务

同样的可以创建多个进程来实现上面的下载任务，需要用到`multiprocessing`库：

```python
import time
import requests
import multiprocessing

url_list = [
    ('视频1','https://www.youtube.com/watch?v=ZKwIInkZK90'),
    ('视频2','https://www.youtube.com/watch?v=Ts2wussx4Js'),
    ('视频3','https://www.youtube.com/watch?v=zDWO7EMFBkQ')
]

def task(file_name,url):
    res = requests.get(url)
    with open(file_name,mode='wb') as f:
        f.write(res.content)
    print(time.time())
    

if __name__ == '__main__':
    print(time.time())
    for name, url in url_list:
        t = multiprocessing.Process(target=task, args=(name,url))
        t.start()
```

在使用for进行遍历时，会不断加上进程。多进程的开销会更大，因为每次调用进程都相当于启动了一个新程序。

# 使用多进程处理高计算任务

在面对高计算量的任务时，就可以利用多核优势计算结果，例如前面的累加计算任务：

```python
import time
import multiprocessing

def task(start, end, queue):
    result = 0
    for i in range(start, end):
        result += 1
    queue.put(result)
    
if __name__ == '__main__':
    queue = multiprocessing.Queue()
    
    start_time = time.time()
    
    p1 = multiprocessing.Process(target=task, args=(0, 50000, queue))
    p1.start()
    
    p2 = multiprocessing.Process(target=task, args=(50000, 100000, queue))
    p2.start()
    
    v1 = queue.get(block=True)
    v2 = queue.get(block=True)
    print(v1+v2)
    
    end_time = time.time()
```

上面相当于利用多进程创建了两个任务，分开计算，最后将两个任务的结果相加得到总和。

# 如何选择？

在只运行一个任务的时候，多线程的开销会更少一些，不过在Python的CPython解释器中有一个全局解释器锁(GIL)，它要求一个进程中，同时只能有一个线程被CPU调用。这就导致多线程的优势在Python中消失了。

那么如何从这两者之间进行选择？如果程序想要利用计算机的多核优势，则使用多进程开发，让CPU同时处理任务。如果不利于多核优势，那就使用多线程开发。

多线程适用于：

1. **I/O 密集型任务：** 当程序中的主要瓶颈是等待外部资源读写的时候，使用多线程可以提高效率。一个线程在等待时，其他线程可以继续执行，例如爬虫。
2. **共享数据：** 如果多个任务需要共享数据，且这些任务不需要同时修改共享数据，那么可以选择多线程。

多进程适用于：

1. **CPU 密集型任务：** 当程序中的主要任务是进行大量计算，而不涉及太多的 I/O 操作时，选择多进程。
2. **独立性要求：** 如果任务之间需要高度的独立性，以避免由于一个任务的问题导致整个程序崩溃，选择多进程。
3. **并行性需求：** 多进程可以在多核处理器上并行执行，从而提高整体性能。



# 多线程常用方法

## t.start()

`t.start()`用于将线程准备就绪。

```python
import threading

loop = 1000000
number = 0

def _add(count):
    global number
    for i in range(count):
        number += 1

if __name__ == "__main__":
    t = threading.Thread(target=_add, args=(loop,))
    t.start()

    print(number)
```

上面的number不一定为100000，这是因为程序在执行子线程的时候，可能执行t的子线程到一半，就跑去把print(number)执行了，这恰恰体现了多线程的作用，会跳着执行代码。为了解决这个问题，就用到了`join`方法。

## t.join()

`t.join()`用于等待当前子线程结束，主线程再继续往下执行。

```python
import threading

loop = 1000000
number = 0

def _add(count):
    global number
    for i in range(count):
        number += 1

if __name__ == "__main__":
    t = threading.Thread(target=_add, args=(loop))
    t.start()
    t.join() 
    print(number)
```

当程序运行到`t.join`时，就会停下来等`t`这个子线程运行完，然后继续往下走。还有一个例子：

```python
import threading

number = 0
count = 5

def _add():
    global number
    for i in range(count):
        number += 1

def _sub():
    global number
    for i in range(count):
        number += 1

if __name__ == "__main__":        
    t1 = threading.Thread(target=_add)
    t2 = threading.Thread(target=_sub)
    t1.start()
    t1.join() 

    t2.start()
    t2.join()

    print(number)
    # 10
```

上面这个例子实际上等同于串行执行。主线程会等待`t1`子线程运行完后才会运行`t2`子线程。

## t.setDaemon(布尔值)

`t.setDaemon()`用于设置守护线程，判断主线程是否等待子线程运行完。**它必须被设置在线程被start之前。**

- `t.setDaemon(True)`: 设置为守护线程，当主线程被执行完毕后，子线程自动关闭。
- `t.setDaemon(False)`: 默认非守护线程，主线程等待子线程运行完毕后才会关闭。

```python
import threading
import time

def task():
    time.sleep(5)
    print('mission')
    
t = threading.Thread(target=task)
t.daemon = True
t.start()

print('End')

---
# END
# mission
```

当主线程运行到`print`的时候，就会等待子线程运行结束。当设置为False时，就会直接结束子线程。

## 自定义线程类

通过直接继承`threading.Thread`类，并重写`run`方法，可以直接定义多线程类。这在很多项目中都被用到了。

```python
import threading
import time

class MyThread(threading.Thread):
    def __init__(self, name, delay):
        super().__init__()
        self.name = name
        self.delay = delay

    def run(self):
        print(f"Thread {self.name} starting...")
        self.print_numbers()
        print(f"Thread {self.name} exiting...")

    def print_numbers(self):
        for i in range(5):
            time.sleep(self.delay)
            print(f"Thread {self.name}: {i}")

# 创建两个线程的实例
thread1 = MyThread(name="Thread-1", delay=1)
thread2 = MyThread(name="Thread-2", delay=0.5)

# 启动线程
thread1.start()
thread2.start()

# 等待线程结束
thread1.join()
thread2.join()

print("Main thread exiting.")

```

```python
import requests
import threading

class VideoThread(threading.Thread):
    def run(self):
        file_name, url = self._args
        res = requests.get(url)
        with open(file_name,mode='wb') as f:
           f.write(res.content)       
    
if __name__ == '__main__':  
    url_list = [
        ('视频1','https://www.youtube.com/watch?v=ZKwIInkZK90'),
        ('视频2','https://www.youtube.com/watch?v=Ts2wussx4Js'),
        ('视频3','https://www.youtube.com/watch?v=zDWO7EMFBkQ')
    ]
    
    for item in url_list:
        t = VideoThread(args=(item[0],item[1]))
        t.start()
```

# 多线程的线程安全

在多线程环境中，共享数据可能会被某个线程修改，导致其他线程拿到的数据是不准确的，这种情况被称为竞态条件，为此，`threading`库提供了锁(Lock)来实现数据保护。

```python
import threading

lock = threading.RLock()
loop = 1000000
number = 0

def _add(count):
    lock.acquire() # 第一个进入的线程会上锁
    global number
	for i in range(count):
        number += 1
    lock.release() # 释放锁

def _sum(count):
    lock.acquire() # 申请锁
    global number
	for i in range(count):
        number -= 1
    lock.release() # 释放锁    
    
# 创建多个线程来修改共享数据
t1 = threading.Thread(target=_add. args=(loop))
t2 = threading.Thread(target=_sub, args=(loop))

t1.start()
t2.start()

t1.join()
t2.join()

print(shared_data)
```

在上面这个任务中，进程任务里带了一个锁。当运行一个进程时，数据是被锁住的，其他线程无法访问，需要等待锁被释放。当它被释放后，其他线程才可以继续对其中的数据进行修改。

`threading`提供了两种锁，`Lock`和`RLock`。唯一的区别是`RLock`中可以继续上`RLock`锁，但是`Lock`锁不能这样做。可以重复锁的好处在于协调开发时，当调用其他人的上锁的方法时，可以继续上锁来保证线程安全。

同样也可以使用上下文来上锁，这样更方便：

```python
import threading

number = 0
lock = threading.RLock()

def task():
    with lock: # 基于上下文管理，自动执行申请锁和释放锁
        global number
        for i in range(10000):
            number += i
    print(number)
 
for i in range(2):
    t = threading.Thread(target=task)
    t.start()
```

# 死锁

当多线程中出现了线程相互等待对方释放资源时会卡死，这被称为死锁。例如：

```python
import threading

resource1 = threading.Lock()
resource2 = threading.Lock()

def thread1():
    with resource1:
        print("Thread 1 acquired resource 1")
        with resource2:
            print("Thread 1 acquired resource 2")

def thread2():
    with resource2:
        print("Thread 2 acquired resource 2")
        with resource1:
            print("Thread 2 acquired resource 1")

t1 = threading.Thread(target=thread1)
t2 = threading.Thread(target=thread2)

t1.start()
t2.start()

t1.join()
t2.join()
```

这两个线程分别尝试获取`resource1`和`resource2`，但由于它们的获取顺序不同，可能导致死锁。如果`thread1`先获取`resource1`，而`thread2`先获取`resource2`，那么两个线程将陷入相互等待的状态，导致死锁。

# 线程池

## 线程池示例

线程并非越多越好，因此需要有线程池加以控制。Python在`concurrent`库中提供了`ThreadPoolExecutor`来实现线程池。

```python
import time
from concurrent.future import ThreadPoolExecutor

def task(url):
    print('mission start.')
    time.sleep(5)
    
pool = ThreadPoolExecutor(10) # 最多维护10个线程

url_list = ['www.xxx_{}.com'.format(i) for i in range(100)]
for url in url_list:
    pool.submit(task, url)
```

在上面这段代码中，向线程池`pool`不断提交`submit`任务。如果线程池为空，则将任务加入，否则进行等待。

## 主线程等待线程池

```py
import time
from concurrent.futures import ThreadPoolExecutor

def task(url):
    print('mission start.')
    time.sleep(5)
    
pool = ThreadPoolExecutor(10) # 最多维护10个线程

url_list = ['www.xxx_{}.com'.format(i) for i in range(100)]
for url in url_list:
    pool.submit(task, url)

print('Working...')
pool.shutdown(True) # 等待线程池中的任务执行完成，再继续执行
print('Keep going')
```

上面这段代码加入了`pool.shutdown()`这个方法，用于让主线程等待线程池执行，类似于线程的`join()`方法。

## 执行Pipeline

```python
import time
import random
from concurrent.futures import ThreadPoolExecutor, Future

def task(url):
    print('mission start.')
    time.sleep(5)
    return random.ranint(0,10)

def done(response):
    print('response number', response.result())
    
pool = ThreadPoolExecutor(10) # 最多维护10个线程

url_list = ['www.xxx_{}.com'.format(i) for i in range(100)]
for url in url_list:
    future = pool.submit(task, url) # 提交任务
    future.add_done_callback(done) # 子线程继续执行
```

上面这段函数对线程池进行了实例化，并使用了`add_done_callback`方法，将线程的结果放入下一个函数进行执行。这相当于构建了一个pipeline。例如，task可以执行下载任务，done函数执行写入任务。

## 显示线程结果

如果要获取线程的结果，只需要使用线程的`result`这个方法即可提取：

```python
import time
import random
from concurrent.futures import ThreadPoolExecutor, Future

def task(url):
    print('mission start.')
    time.sleep(5)
    return random.randint(0,10)

def done(response):
    print('response number', response.result())

pool = ThreadPoolExecutor(10) # 最多维护10个线程

future_list = []

url_list = ['www.xxx_{}.com'.format(i) for i in range(100)]
for url in url_list:
    future = pool.submit(task, url) # 提交任务
    future_list.append(future)
    
pool.shutdown(True)

for fu in future_list:
    print(fu.result())
```

2024/2/1 于苏州家中