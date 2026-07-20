---
title: "工程实践：高计算量的Python程序状态监测"
description: "Python中对高计算量程序的状态监测。"
pubDate: "2024-05-19 16:10:16"
---

最近在项目中遇到一个需求，在一个分多阶段的高计算量程序中，当前端接入服务后，同时能得到程序当前的运行状态。这种场景也比较实际，例如在训练模型时的数据准备，数据预处理，模型训练，打包等。这篇博文考虑一下怎么解决这个问题。

# 多线程的实现

我们先定义一个类。这个类里需要主要要实现两个方法：一个是执行高计算任务的`execute_task`函数，另一个是获取状态的方法`get_status`。

在初始化的时候定义了内部变量`current_stage`，一个线程锁，和一个判断任务是否结束的Flag。在`execute_task`中分阶段执行高计算量函数中的每个阶段的函数。当执行完成时，Finish Flag被设定为True。

真正的计算过程在`heavy_computation`这个方法里实现，它需要接收`stage`参数，并且根据不同的阶段进行计算。这里我假定每个阶段都会消耗四秒的时间。

我们使用`get_status`方法来获取运行中的状态，它的作用是获取当前的任务状态。`get_status`被`task_monitor`调用，每隔0.5秒会监控一下执行状态。

在主程序中，执行顺序如下：

1. 实例化Task类。
2. 创建两个线程，一个是执行任务的线程，另一个是监控状态的线程。
3. 启动线程。
4. 使用`join`等待两个线程的完成。

> 创建线程的代码中出现了如下内容：`monitor_thread = threading.Thread(target=lambda: task_monitor(task))`。它和`monitor_thread = threading.Thread(target=task_monitor(task))`的区别在于后者会在创建线程时直接执行方法，而前者则是在线程实际启动后才会执行。如果使用后者，将会马上执行监控任务，并持续输出处于`stage`为0的状态，而不会继续走下去。

```python
import threading
import time

class HighComputationalTask:
    def __init__(self):
        self.current_stage = 0
        self.lock = threading.Lock()
        self.finished = False

    def execute_task(self):
        stages = 4
        for stage in range(1, stages + 1):
            with self.lock:
                self.current_stage = stage
            self.heavy_computation(stage)  # 执行某个计算密集的任务阶段
            time.sleep(1)  # 模拟延迟

        with self.lock:
            self.finished = True

    def heavy_computation(self, stage):
        # 在这里添加实际的计算任务
        time.sleep(5)
        print(f"Executing stage {stage} of the computation.")

    def get_status(self):
        with self.lock:
            if self.finished:
                return "Task Completed"
            return f"Currently executing stage {self.current_stage}."

def task_monitor(task):
    while not task.finished:
        print(task.get_status())
        time.sleep(0.5)  # 每0.5秒检查一次状态

# 创建任务对象
task = HighComputationalTask()

# 创建线程：一个用于执行任务，一个用于监控任务状态
task_thread = threading.Thread(target=task.execute_task)
monitor_thread = threading.Thread(target=lambda: task_monitor(task))

# 启动线程
task_thread.start()
monitor_thread.start()

# 等待线程结束
task_thread.join()
monitor_thread.join()
```

# 异步方法的实现

现在假设我们将高计算任务改成从网络接口的请求调用，这时候的运行瓶颈就出现在网络接口调用。我们可以用异步方法实现一下。代码逻辑基本上一样，区别在于不需要开多线程，只需要异步执行就可以了。

> 异步和多线程的区别：异步通常在单线程内执行，通过状态切换来防止阻塞，由特定的库来实现，而多线程由操作系统来分配上下文切换。
>
> 多线程适合高计算任务，异步适合高IO任务。

```python
import asyncio

class HighComputationalTask:
    def __init__(self):
        self.current_stage = 0
        self.finished = False

    async def execute_task(self):
        stages = 4
        for stage in range(1, stages + 1):
            self.current_stage = stage
            await self.heavy_computation(stage)
            await asyncio.sleep(1)  # 模拟延迟

        self.finished = True

    async def heavy_computation(self, stage):
        # 模拟异步执行的计算任务
        print(f"Executing stage {stage} of the computation.")
        await asyncio.sleep(1)  # 模拟计算延迟

    async def get_status(self):
        if self.finished:
            return "Task Completed"
        return f"Currently executing stage {self.current_stage}."

async def task_monitor(task):
    while not task.finished:
        status = await task.get_status()
        print(status)
        await asyncio.sleep(0.5)

async def main():
    task = HighComputationalTask()
    task_future = asyncio.create_task(task.execute_task())
    monitor_future = asyncio.create_task(task_monitor(task))
    await asyncio.gather(task_future, monitor_future)

asyncio.run(main())
```

# 使用Flask实现接口请求状态

假设我们的服务是一个网络服务，其他人不光能通过调用接口来启动服务，也能调用另一个接口来接收状态。这时候就需要对相应的任务包装成接口对外开放。我们用Flask来模拟一下：

```python
from flask import Flask, jsonify, request
import asyncio
import threading

app = Flask(__name__)
tasks = {}  # 存储任务的字典

class ComputationalTask:
    def __init__(self):
        self.stages = 4
        self.current_stage = 0
        self.finished = False
        self.result = None  # 初始化结果存储变量

    async def execute_task(self):
        data = None  # 初始化Data
        for stage in range(1, self.stages + 1):
            self.current_stage = stage
            data = await self.heavy_computation(stage, data)  # 使用正确的变量data
            self.result = data  # 更新结果
        self.finished = True
        return data

    async def heavy_computation(self, stage, input_data):
        # 模拟计算密集型任务
        print(f"Executing stage {stage} with input data: {input_data}.")
        await asyncio.sleep(1)  # 模拟计算延迟
        return input_data 
    
    def get_status(self):
        # 获取当前状态
        if self.finished:
            return "Task Completed", self.result
        return f"Currently executing stage {self.current_stage}.", self.result

def start_async_task(task_id):
    loop = asyncio.new_event_loop()
    task = ComputationalTask()
    tasks[task_id] = task
    final_result = loop.run_until_complete(task.execute_task())
    print(f"Task {task_id} completed with result: {final_result}")
    loop.close()

@app.route('/start_task/<task_id>', methods=['POST'])  
def start_task(task_id):
    # 如果已有任务，直接返回
    if task_id in tasks:
        return jsonify({'message': 'Task is already running or completed.'}), 400
    thread = threading.Thread(target=start_async_task, args=(task_id,))
    thread.start()
    return jsonify({'message': f'Task {task_id} started.'}), 200

@app.route('/task_status/<task_id>', methods=['GET'])
def task_status(task_id):
    if task_id not in tasks:
        return jsonify({'message': 'Task not found.'}), 404
    status, result = tasks[task_id].get_status()
    return jsonify({'task_id': task_id, 'status': status, 'result': result}), 200

if __name__ == '__main__':
    app.run(debug=True)
```

启动服务后，我们向默认端口5000端口发送请求来启动任务，也可以发送请求获取当前执行的状态。启动任务的地址是`http://localhost:5000/start_task/task123`。

![](/_posts/%E5%B7%A5%E7%A8%8B%E5%AE%9E%E8%B7%B5%EF%BC%9A%E9%AB%98%E8%AE%A1%E7%AE%97%E9%87%8F%E7%9A%84Python%E7%A8%8B%E5%BA%8F%E7%8A%B6%E6%80%81%E7%9B%91%E6%B5%8B/240519-1.png)

![](/_posts/%E5%B7%A5%E7%A8%8B%E5%AE%9E%E8%B7%B5%EF%BC%9A%E9%AB%98%E8%AE%A1%E7%AE%97%E9%87%8F%E7%9A%84Python%E7%A8%8B%E5%BA%8F%E7%8A%B6%E6%80%81%E7%9B%91%E6%B5%8B/240519-2.png)

# 获取参数并直接返回结果

我们细化一下，用户通过Post命令向启动任务的接口进行传参，我们获取到参数后，执行任务，并直接返回结果，在执行过程时能通过GET方法查看到执行的阶段。代码如下：

```python
from flask import Flask, request, jsonify
import asyncio
import threading

app = Flask(__name__)
tasks = {}  # 存储任务的字典

class ComputationalTask:
    def __init__(self, initial_data):
        self.data = initial_data  # 初始化入参
        self.stages = 4
        self.current_stage = 0
        self.finished = False
        self.result = None

    async def execute_task(self):
        for stage in range(1, self.stages + 1):
            self.current_stage = stage
            self.data = await self.process_stage(self.data, stage)  # 更新每阶段处理的结果
            await asyncio.sleep(1)  # 模拟处理时间
        self.finished = True
        self.result = self.data
        return self.result

    async def process_stage(self, input_data, stage):
        # 模拟每阶段处理逻辑，输出为输入的修改版
        result = f"{input_data} processed at stage {stage}"
        print(f"Processing stage {stage} with data: {result}")
        return result

def start_async_task(task_id, initial_data):
    # 开启event loop
    loop = asyncio.new_event_loop()
    task = ComputationalTask(initial_data)
    tasks[task_id] = {'task': task, 'thread': None}
    # 获取结果并保存
    final_result = loop.run_until_complete(task.execute_task())
    
    tasks[task_id]['result'] = final_result
    loop.close()
    return final_result

@app.route('/start_task', methods=['POST'])
def start_task():
    # 解析入参
    req_data = request.get_json()
    task_id = req_data.get('task_id')
    initial_data = req_data.get('data')
    
    if not task_id or not initial_data:
        return jsonify({'message': 'Missing task_id or data in request.'}), 400
    if task_id in tasks:
        return jsonify({'message': 'Task is already running or completed.'}), 400
    
    # 开始执行
    thread = threading.Thread(target=start_async_task, args=(task_id, initial_data))
    thread.start()
    tasks[task_id]['thread'] = thread
    thread.join()  # 等待任务完成
    final_result = tasks[task_id]['result']
    return jsonify({'message': f'Task {task_id} completed.', 'result': final_result}), 200

@app.route('/task_status/<task_id>', methods=['GET'])
def task_status(task_id):
    if task_id not in tasks:
        return jsonify({'message': 'Task not found.'}), 404
    task = tasks[task_id]['task']
    return jsonify({'task_id': task_id, 'status': 'Completed' if task.finished else 'In progress'}), 200

if __name__ == '__main__':
    app.run(debug=True)
```

# 添加Uuid/通过接口获取结果/定时清理任务

在前面的基础上，可以在每次调用的时候返回一个uuid，通过这个uuid来查询任务执行状态。此外，也可以用获取状态的接口获取最终的返回值。

```python
from flask import Flask, request, jsonify
import uuid
import asyncio
import threading
import time

app = Flask(__name__)
tasks = {}  # 记录任务

class ComputationalTask:
    def __init__(self, initial_data):
        self.data = initial_data # 初始数据
        self.stages = 4 # 总阶段数
        self.current_stage = 0
        self.finished = False
        self.result = None # 当前输出

    async def execute_task(self):
        data = self.data
        # 执行任务
        for stage in range(1, self.stages + 1):
            self.current_stage = stage
            data = await self.process_stage(stage, data)
            # 获取当前阶段的输出
            self.result = data
        self.finished = True

    async def process_stage(self, stage, input_data):
        # 根据当前阶段进行计算
        print(f"Executing stage {stage} with input: {input_data}")
        result = f"{input_data} -> processed by stage {stage}"
        await asyncio.sleep(1)
        return result

    def get_status(self):
        # 如果已结束，返回结果
        if self.finished:
            return "Task Completed", self.result
        return f"Currently executing stage {self.current_stage}.", self.result

def start_async_task(task_id, initial_data):
    # 启动异步服务
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    task = ComputationalTask(initial_data)
    tasks[task_id] = task
    loop.run_until_complete(task.execute_task())
    loop.close()

@app.route('/start_task', methods=['POST'])
def start_task():
    # 解析数据
    req_data = request.get_json()
    task_id = str(uuid.uuid4())
    initial_data = req_data.get('data')
    
    if not initial_data:
        return jsonify({'message': 'Missing data in request.'}), 400
    if task_id in tasks:
        return jsonify({'message': 'Task is already running or completed.'}), 400
    
    thread = threading.Thread(target=start_async_task, args=(task_id, initial_data))
    thread.start()
    return jsonify({'message': 'Task started.', 'task_id': task_id}), 200

@app.route('/task_status/<task_id>', methods=['GET'])
def task_status(task_id):
    if task_id not in tasks:
        return jsonify({'message': 'Task not found.'}), 404
    status, result = tasks[task_id].get_status()
    return jsonify({'task_id': task_id, 'status': status}), 200

def cleanup_tasks():
    # 清理队列
    while True:
        time.sleep(60)
        with app.app_context():
            # 删除已经结束的任务
            keys_to_remove = [k for k, v in tasks.items() if v['task'].finished]
            for key in keys_to_remove:
                del tasks[key]
                print(f"Removed finished task {key}")

if __name__ == '__main__':
    cleaner_thread = threading.Thread(target=cleanup_tasks, daemon=True)
    cleaner_thread.start()
    app.run(debug=True)
```

![](/_posts/%E5%B7%A5%E7%A8%8B%E5%AE%9E%E8%B7%B5%EF%BC%9A%E9%AB%98%E8%AE%A1%E7%AE%97%E9%87%8F%E7%9A%84Python%E7%A8%8B%E5%BA%8F%E7%8A%B6%E6%80%81%E7%9B%91%E6%B5%8B/240519-3.png)

![](/_posts/%E5%B7%A5%E7%A8%8B%E5%AE%9E%E8%B7%B5%EF%BC%9A%E9%AB%98%E8%AE%A1%E7%AE%97%E9%87%8F%E7%9A%84Python%E7%A8%8B%E5%BA%8F%E7%8A%B6%E6%80%81%E7%9B%91%E6%B5%8B/240519-4.png)

这样，每次调用接口就可以从返回一个任务ID，通过这个ID发送请求来查询任务状态。并且每个60s会清理任务ID的字典，防止字典过大。实际使用中，可以用redis来代替这个部分。

2024/5/19 于苏州
