---
title: Python开发：并发场景下的断点续传探索
date: 2025-06-14 07:42:48
tags: 
  - Python
  - 工程实践
categories: Python
excerpt: 探索并发场景下的Excel写入断点续传。
index_img:  "/img/python.png"
---

最近有一个小需求需要实现：需要将批量并发返回的数据写入Excel，并且实现断点续传的功能。以下是原代码：

```python
def write_entry_to_excel(entry):
    try:
        df = pd.DataFrame([entry])
        with thread_lock:
            with pd.ExcelWriter(excel_output_path, engine='openpyxl', mode='a', if_sheet_exists='overlay') as writer:
                sheet_exists = sheet_name in writer.book.sheetnames
                df.to_excel(writer, index=False, header=not sheet_exists)
    except Exception as e:
        print(f"{e}")
        
def process_single_entry(entry):
    return [entry] 
```

除此之外，为了实现断点续传，还需要记录一下已读写的数据：

```python
def load_done_entries(done_path):
    if os.path.exists(done_path):
        with open(done_path, 'r') as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def append_done_entry(done_path, entry_key):
    with open(done_path, 'a') as f:
        f.write(f"{entry_key}\n")
```


设想中，执行的时候是并发执行，返回一条数据写一条数据：

```python
def process_input_file(input_path):
    done_path = input_path + ".done"

    with open(input_path, 'r') as f:
        all_entries = [line.strip() for line in f if line.strip()]

    done_entries = load_done_entries(done_path)

    if len(done_entries) >= len(all_entries):
        print(f"finished, ignore：{input_path}")
        return

    pending_entries = [entry for entry in all_entries if entry not in done_entries]

    print(f"pending entries count：{len(pending_entries)}")

    with ThreadPoolExecutor(max_workers=max_threads) as executor:
        futures = {executor.submit(process_single_entry, entry): entry for entry in pending_entries}

        for i, future in enumerate(as_completed(futures), 1):
            entry = futures[future]
            try:
                result_list = future.result()
                for result in result_list:
                    write_entry_to_excel(result)
                    append_done_entry(done_path, result.get("uuid", entry)) 
            except Exception as e:
                print(f"{e}")

if __name__ == "__main__":
    input_file_path = "input.txt" 
    process_input_file(input_file_path)
```

执行的时候注意到数据缺失了，检查后发现pandas的ExcelWriter类，`if_sheet_exists='overlay'`默认只会在已有sheet上从首行开始写入。`pandas` 的 `to_excel` 本身不支持自动找到最后一行并追加，需要计算起始行，并指定参数`startcol`来跳过。

虽然可以每次写入时都读取现有的数据行数来解决这个问题，但是效率极低。

考虑的解决方法有几种：

1. 返回统一写内存，最后统一写入Excel
2. 每个数据单独写在tmp文件，最后合并
3. 存数据库

考虑到数据量过大，并不适合存内存，存数据库又略重，最后还是考虑第二种，每条数据单独写tmp，每次中断时进行merge。

最终代码实现如下：

```python
import os
import csv
import glob
import requests
import pandas as pd
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

directory_path = r'/'
output_path = f'output.xlsx'

tmp_dir = os.path.join(directory_path, "tmp_results")
os.makedirs(tmp_dir, exist_ok=True)

lock = Lock() 


def load_completed_inputs(file_flag):
    if os.path.exists(file_flag):
        with open(file_flag, 'r') as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def append_completed_input(file_flag, input_value):
    with open(file_flag, 'a') as f:
        f.write(f"{input_value}\n")

def process_single_entry(entry):
    return [entry] 

def save_record_to_csv(record):
    input_value = record.get("uuid", "unknown")
    filename = os.path.join(tmp_dir, f"{input_value}.csv")

    with lock:
        file_exists = os.path.exists(filename)
        with open(filename, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=record.keys())
            if not file_exists:
                writer.writeheader()
            writer.writerow(record)

def merge_csv_outputs(tmp_dir, output_path):
    grouped_data = []
    csv_files = glob.glob(os.path.join(tmp_dir, "*.csv"))
    for file in csv_files:
        df = pd.read_csv(file)
        grouped_data.append(df)

    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        for dfs in grouped_data:
            full_df = pd.concat(dfs, ignore_index=True)
            full_df.to_excel(writer, index=False)

    print(f"saving to {output_path}")


file_list = [os.path.join(directory_path, f) for f in os.listdir(directory_path) if f.endswith('.csv')]

for path in sorted(file_list):
    print(f"{path}")

    with open(path, 'r') as f:
        inputs = [line.strip() for line in f if line.strip()]

    file_flag = path + ".done"
    completed_inputs = load_completed_inputs(file_flag)

    if len(completed_inputs) >= len(inputs):
        print(f"finished, ignore{path}")
        continue

    pending_inputs = [x for x in inputs if x not in completed_inputs]
    print(f"left {len(pending_inputs)} ")

    success_count = 0

    try:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(process_single_entry, x): x for x in pending_inputs}

            for i, future in enumerate(as_completed(futures), 1):
                input_value = futures[future]
                try:
                    input_value, found, records = future.result()
                    if found:
                        success_count += 1
                        for rec in records:
                            save_record_to_csv(rec)
                        print(f"{success_count}）")
                    else:
                        print(f"{input_value}")
                    append_completed_input(file_flag, input_value)
                except Exception as e:
                    print({e})

    except KeyboardInterrupt:
        merge_csv_to_excel(tmp_dir, output_path)
        raise
```

至此Excel就能正常写入了，中断后也可以进行续传。

2025/6/14 于苏州