---
title: "python: resumable processing in concurrent workloads"
description: "exploring resumable Excel writes in concurrent workflows."
pubDate: "2025-06-14 07:42:48"
---

I recently had a small requirement: write data returned by concurrent batch work to Excel, while supporting resumable processing. The original code was:

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

To resume an interrupted run, completed work also needs to be recorded:

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

The intended behavior was concurrent processing, writing every returned item as it arrived:

```python
def process_input_file(input_path):
    done_path = input_path + ".done"

    with open(input_path, 'r') as f:
        all_entries = [line.strip() for line in f if line.strip()]

    done_entries = load_done_entries(done_path)

    if len(done_entries) >= len(all_entries):
        print(f"finished, ignore: {input_path}")
        return

    pending_entries = [entry for entry in all_entries if entry not in done_entries]

    print(f"pending entries count: {len(pending_entries)}")

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

When running it, I noticed missing data. Investigation showed that `pandas.ExcelWriter` with `if_sheet_exists='overlay'` writes from the first row of an existing sheet by default. `pandas.to_excel` does not automatically find the last row and append; it requires calculating the start row and supplying `startrow`.

Reading the existing row count for every write would solve the problem, but it would be extremely inefficient.

I considered three approaches:

1. Collect all results in memory and write one Excel file at the end.
2. Write each result to a temporary file, then merge them at the end.
3. Store results in a database.

The dataset was too large to keep in memory, and a database felt unnecessarily heavy, so I chose the second option: write each result to a temporary CSV and merge on interruption.

The final implementation was:

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
        print(f"finished, ignore {path}")
        continue

    pending_inputs = [x for x in inputs if x not in completed_inputs]
    print(f"left {len(pending_inputs)}")

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
                        print(f"{success_count})")
                    else:
                        print(f"{input_value}")
                    append_completed_input(file_flag, input_value)
                except Exception as e:
                    print({e})

    except KeyboardInterrupt:
        merge_csv_to_excel(tmp_dir, output_path)
        raise
```

With this approach, Excel output works correctly and interrupted runs can resume.

June 14, 2025, Suzhou
