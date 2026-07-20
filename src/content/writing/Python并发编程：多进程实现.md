---
title: "Python并发编程：多进程实现"
description: "Python中的并发多进程编程的实现。"
pubDate: "2024-02-03 11:46:29"
---

上一篇博客大致讲了怎么用Python实现多线程编程，这次写下怎么实现多进程。

首先，进程之间是相互隔离的，因此进程之间的数据默认是不会相互交换的。如果想要利用CPU的多核优势，就可以使用多进程编程。

# 基础用法

```python
import multiprocessing

def task():
    pass

if __name__ == '__main__':
    print('Start...') # 主进程
    p1 = multiprocessing(target=task) # 子进程
    p1.start()
```

```python
import multiprocessing

def task(args):
    pass

def run();
	p1 = multiprocessing(target=task, arg=('xxx',))
    p.start()
    
if __name__ == '__main__':
    run()
```

这里我们可以区分一下主进程和子进程。主进程就是直接执行的那部分，而子进程是被放入multiprocessing方法中的那部分。由于进程之间是隔离的，所以数据不会共享。

我们可以实验一下：

```python
import multiprocessing

def task():
    name = []
    for i in range(1000):
        name.append(i)
    print('子进程的name', name)


if __name__ == '__main__':
    name = []

    p1 = multiprocessing.Process(target=task)
    p1.start()

    print('主进程的name', name)
    
    # 主进程的name []
```

我们在子进程和主线程分别有一个name的列表，但是最后只打印了主进程的name，这是因为主进程取不到子进程的值。

# 子进程获取主进程数据

可以在子进程中获取到外部的一些信息。

例如通过`multiprocessing.current_process()`方法，能够获取当前进程的名字：

```python
import time
from multiprocessing import Process, current_process

def task(args):
    print('mission start.')
    time.sleep(5)
    print(current_process().name)
    print('mission end.')

if __name__ == '__main__':
    p = Process(target=task, args=(1,))
    p.name = 'subprocess'
    p.start()
    p.join()
    print('End')

    # mission start.
	# subprocess
	# mission end.
	# End
```

除此之外，还可以获取进程的pid：

```python
import time
import os
from multiprocessing import Process, current_process

def task(args):
    print(os.getpid())
    print('mission start.')
    time.sleep(5)
    print(current_process().name)
    print('mission end.')

if __name__ == '__main__':
    p = Process(target=task, args=(1,))
    p.name = 'subprocess'
    p.start()
    p.join()
    print('End')
    
	# 51862
    # mission start.
	# subprocess
	# mission end.
	# End
```

以及获取线程个数：

```python
import time
import threading
from multiprocessing import Process, current_process

def task(args):
    print('mission start.')
    print(f'线程个数:{len(threading.enumerate())}')
    time.sleep(5)
    print(current_process().name)
    print('mission end.')

if __name__ == '__main__':
    p = Process(target=task, args=(1,))
    p.name = 'subprocess'
    p.start()
    p.join()
    print('End')

    # mission start.
    # 线程个数：1
	# subprocess
	# mission end.
	# End
```

同样还能获取CPU个数：

```python
import multiprocessing

cpu_count = multiprocessing.cpu_count()
print(cpu_count)

# 8
```

通过这种方式，可以控制进程数以达到更高的效率。

```python
import multiprocessing

if __name__ == '__main__':
    cpu_count = multiprocessing.cpu_count()
    print(cpu_count)
    for i in range(cpu_count, -1):
        p = multiprocessing.Process(target=task)
        p.start()
```



# 自定义进程类

和多线程一样，可以通过继承Process类来自定义自己的进程类：

```python
import multiprocessing

class MyProcess(multiprocessing.Process):
    def run(self):
        print('执行此进程...')
        
if __name__ == "__main__":
    p = MyProcess(args=(0,))
    p.start()
    print('继续执行...')
    
    # 继续执行...
    # 执行此进程...
```

# 进程间通信

默认进程间的数据是独立存在的，无法共享，但是有办法使他们进行通信。

## 基于Manager

可以通过Manger构建上下文管理，在子进程里修改主进程的内容：

```python
from multiprocessing import Process, Manager

def f(d,l):
    d[1] = '1'
    d['2'] = 2
    d[0.25] = None
    l.append(666)
    
if __name__ == '__main__':
    with Manager() as manager:
        d = manager.dict()
        l = manager.list()
        
        p = Process(target=f, args=(d,l))
        p.start()
        p.join()
        
        print(d)
        print(l)
        
        # {1: '1', '2': 2, 0.25: None}
		# [666]
```

上面的代码中，主进程使用了Manager维护了两个对象：一个字典一个列表。子进程对其进行了修改，在Manager的作用域里，d和l被子进程修改了。

# 队列

同样，主进程和子进程也可以共同维护一个队列：

```python
import multiprocessing

def task(q):
    for i in range(10):
        q.put(i)
        
if __name__ == '__main__':
    queue = multiprocessing.Queue()
    
    p = multiprocessing.Process(target=task,args=(queue,))
    p.start()
    p.join()
    
    print('主进程：')
    print(queue.get())
    print(queue.get())
    print(queue.get())
    
    # 主进程：
    # 0
    # 1
    # 2
```

# 进程锁

和线程锁一样，多进程也提供了进程锁，防止多线程共享一个数据导致数据混乱：

```python
from multiprocessing import Process, RLock, Manager

def f(n, d, l, lock):
    lock.acquire()
    d[str(n)] = n
    l[n] = -99
    lock.release()

if __name__ == '__main__':
    lock = RLock()
    with Manager() as manager:
        d = manager.dict() 
        l = manager.list(range(10))  # [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        
        for i in range(10):
            p = Process(target=f, args=(i, d, l, lock))
            p.start()
            p.join()

        print(d)
        print(l)
```

通过将锁作为一个参数传入子进程，就可以锁住子进程需要的数据防止被其他进程篡改。

## 进程锁的实际用例

这里有一个实际的案例，使用多进程进行抢票操作。假设我们有一个文件`f1.txt`，里面只有一个数字50，代表剩余还有50张票。现在需要写一个多进程的代码，让多进程抢票的同时不会让数据混乱：

```python
import time 
import multiprocessing

def task(lock):
    lock.acquire()
    with open('f1.txt','r',encoding='utf-8') as f:
        current_num = int(f.read())
    
    print('开始排队抢票')
    time.sleep(1)
    current_num -= 1
    
    with open('f1.txt','w',encoding='utf-8') as f:
        f.write(current_num)
    lock.release()
    
if __name__ == '__main__':
    lock = multiprocessing.RLock()
    
    for i in range(20):
        p = multiprocessing.Process(target=task, args=(lock,))
        p.start()
        
    time.sleep(7)    
```

也可以通过维护一个进程的列表，统一执行进程：

```python
if __name__ == '__main__':
    lock = multiprocessing.RLock()
    
    process_list = []
    for i in range(20):
        p = multiprocessing.Process(target=task, args=(lock,))
        p.start()
        process_list.append(p)
    
    for p in process_list:
        p.join()   
```

# 进程池

与多线程类似，进程数多于CPU核心数，反而会导致性能降低，因此需要进程池来进行维护多进程：

```python
import time
from concurrent.futures import ProcessPoolExecutor

def task(num):
    print('执行')
    time.sleep(2)
    
if __name__ == '__main__':
    pool = ProcessPoolExecutor(4)
    for i in range(10):
        pool.submit(task, i)
    pool.shutdowm(True) # 等待进程池中的任务都完成后，再继续执行
```

还可以执行回调函数：

```python
import time
from concurrent.futures import ProcessPoolExecutor

def task(num):
    print('执行')
    time.sleep(2)
    return num

def done(res):
    print(res.result())
    
if __name__ == '__main__':
    pool = ProcessPoolExecutor(4)
    for i in range(10):
        fur = pool.submit(task, i)
        fur.add_done_callback(done) # 执行回调函数
    
    print(multiprocessing.current_process())
    pool.shutdowm(True) # 等待进程池中的任务都完成后，再继续执行
```

{% note warning %}

在进程池之中，无法使用`multiprocessing`提供的Lock和RLock。只能使用`Manager`提供的RLock和Lock，例如：

```python
lock = Manager.RLock()
```

{% endnote %}

2024/2/3 于苏州
