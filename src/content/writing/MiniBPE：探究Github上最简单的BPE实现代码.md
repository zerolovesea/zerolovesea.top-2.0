---
title: "MiniBPE：探究Github上最简单的BPE实现代码"
description: "探究Github上的热门项目，Andrej Karpathy大神实现的最简BPE算法代码。"
pubDate: "2024-03-09 22:12:43"
---

之前在[基于子词的分词方法：BPE算法](https://zerolovesea.github.io/2024/01/01/%E5%9F%BA%E4%BA%8E%E5%AD%97%E8%AF%8D%E7%9A%84%E5%88%86%E8%AF%8D%E6%96%B9%E6%B3%95%EF%BC%9ABPE%E7%AE%97%E6%B3%95/)一文中简单实现了BPE的算法，上个月前OpenAI数据科学家Andrej Karpathy大神在Github上实现了目前最精简的BPE算法的代码，这一项目瞬间冲到了Github日榜并连续霸榜了一周。目前该项目已经拥有7.6k颗星。今天就来探究一下他写的代码细节，学习一下大神的代码规范。

# 项目结构

项目由四个文件组成：一个`base.py`实现`Tokenizer`的抽象化基类。一个`Tokenizer`通常包含三个方法：训练，编码和解码。

`basic.py`继承了`base.py`，里面的`BasicTokenizer`类是BPE算法的核心实现模块。

第三个文件是`regex.py`，里面的`RegexTokenizer`类的作用是使用正则表达式更好的拆分文本。这一部分一般出现在预处理阶段，让文本按照不同类别（字母，数字，标点）进行拆分。

最后一个文件是`gpt4.py`，它实现了`GPT4Tokenizer`类，复现了`tiktoken`库中的`GPT-4`的`Tokenizer`。

# 使用方法

## 调用方法

先上使用方法：

```python
from minbpe import BasicTokenizer
tokenizer = BasicTokenizer()
text = "aaabdaaabac"
tokenizer.train(text, 256 + 3) # 256 are the byte tokens, then do 3 merges
print(tokenizer.encode(text))
# [258, 100, 258, 97, 99]
print(tokenizer.decode([258, 100, 258, 97, 99]))
# aaabdaaabac
tokenizer.save("toy")
```

它的作用是将aaabdaaabac进行三次的合并。它会输出一个新的字符串XdXac，其中X=ZY、Y=ab 和 Z=aa。minbpe将单独的256个字节分配为Token，因此合并后的新字节将从257开始。

上述的例子中，a=97、b=98、c=99、d=100（它们的 ASCII 值）。然后，当 （a，a） 合并到 Z 时，Z 将变为 256。同样，Y 将变为 257 和 X 258。因此，我们从 256 个字节开始，进行 3 次合并以获得上述结果，预期输出为 [258， 100， 258， 97， 99]。

再用项目实现的`GPT4Tokenizer`和`tiktoken`实现的`GPT-4 tokenizer`进行对比：

```python
text = "hello123!!!? (안녕하세요!) 😉"

# tiktoken
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")
print(enc.encode(text))
# [15339, 4513, 12340, 30, 320, 31495, 230, 75265, 243, 92245, 16715, 57037]

# ours
from minbpe import GPT4Tokenizer
tokenizer = GPT4Tokenizer()
print(tokenizer.encode(text))
# [15339, 4513, 12340, 30, 320, 31495, 230, 75265, 243, 92245, 16715, 57037]
```

## 训练方法

这个项目里实现了两种方法，一种方法是不使用正则来处理原文本，这时候直接使用`BasicTokenizer`进行训练。

```python
from minbpe import BasicTokenizer
tokenizer = BasicTokenizer()
tokenizer.train(very_long_training_string, vocab_size=4096)
tokenizer.encode("hello world") # string -> tokens
tokenizer.decode([1000, 2000, 3000]) # tokens -> string
tokenizer.save("mymodel") # writes mymodel.model and mymodel.vocab
tokenizer.load("mymodel.model") # loads the model back, the vocab is just for vis
```

如果要使用正则方法来按类别拆分文本，就使用以下方法：

```python
from minbpe import RegexTokenizer
tokenizer = RegexTokenizer()
tokenizer.train(very_long_training_string, vocab_size=32768)
tokenizer.encode("hello world") # string -> tokens
tokenizer.decode([1000, 2000, 3000]) # tokens -> string
tokenizer.save("tok32k") # writes tok32k.model and tok32k.vocab
tokenizer.load("tok32k.model") # loads the model back from disk
```

如果要添加`special tokens`，代码里也实现了一个方法来注册：

```python
from minbpe import RegexTokenizer
tokenizer = RegexTokenizer()
tokenizer.train(very_long_training_string, vocab_size=32768)
tokenizer.register_special_tokens({"<|endoftext|>": 32768})
tokenizer.encode("<|endoftext|>hello world", allowed_special="all")
```

# 代码分析

## base.py

该文件实现了Toknizer的基类以及其他需要的工具函数。

```python
import unicodedata

def get_stats(ids, counts=None):
    """
    输入一个整数列表，返回一个连续对的计数字典
    例如：[1, 2, 3, 1, 2] -> {(1, 2): 2, (2, 3): 1, (3, 1): 1}
    可以选择更新一个已存在的计数字典
    """
    # 如果没有传入counts，则初始化一个空字典
    counts = {} if counts is None else counts  
    
    # 遍历列表的前后连续对：不断迭代前一个和后一个字符对
    for pair in zip(ids, ids[1:]): 
        counts[pair] = counts.get(pair, 0) + 1 # 不断增加统计数
    return counts
```

`get_stats`实际上是一个比较核心的函数，下面是`merge`函数，将所有的pair都用指定的idx来代替。

```python
def merge(ids, pair, idx):
    """
    在整数列表中，用新的整数idx替换所有连续出现的pair
    例如：ids=[1, 2, 3, 1, 2], pair=(1, 2), idx=4 -> [4, 3, 4]
    """
    newids = []
    i = 0
    while i < len(ids):
        # 如果不是在最后一个位置，并且pair匹配，就替换
        if ids[i] == pair[0] and i < len(ids) - 1 and ids[i+1] == pair[1]:
            newids.append(idx) # 新列表添加
            i += 2 # 指针增加2位
        else:
        	# 如果找不到匹配的，就把原字符加入新列表
            newids.append(ids[i]) 
            i += 1
    return newids
```

接下来是一个辅助函数。在Unicode中，包含一系列控制字符。这是一组特殊的字符，用于控制文本的显示和处理，这些字符通常不可见。控制字符的Unicode范围是U+0000至U+001F和U+007F至U+009F。由于我们将字符编码位Unicode，目标词表中，不需要这些控制字符，所以需要删除它们。

```python
def replace_control_characters(s: str) -> str:
	"""
	将输入文本中，所有的控制字符删除，并返回处理过后的字符串。
	"""
    chars = []
    for ch in s:
        if unicodedata.category(ch)[0] != "C":
            chars.append(ch) # 只要不是控制字符就添加
        else:
            chars.append(f"\\u{ord(ch):04x}") # 其转换为Unicode转义序列
    return "".join(chars)

def render_token(t: bytes) -> str:
    """
    将bytes转为字符串，并清理控制字符
    """
    s = t.decode('utf-8', errors='replace')
    s = replace_control_characters(s)
    return s
```

工具函数写完了，下面是`Tokenizer`的抽象类，抽象类包含了训练，编码，解码，构建词表，保存和加载方法。

```python
class Tokenizer:
    """Base class for Tokenizers"""

    def __init__(self):
        # default: vocab size of 256 (all bytes), no merges, no patterns
        self.merges = {} # (int, int) -> int
        self.pattern = "" # str
        self.special_tokens = {} # str -> int, e.g. {'<|endoftext|>': 100257}
        self.vocab = self._build_vocab() # int -> bytes

    def train(self, text, vocab_size, verbose=False):
        raise NotImplementedError

    def encode(self, text):
        raise NotImplementedError

    def decode(self, ids):
 
        raise NotImplementedError

    def _build_vocab(self):
        # 构建词表，基础词表是256个字节
        vocab = {idx: bytes([idx]) for idx in range(256)}
        
        # (p0,p1) 是pairs
        for (p0, p1), idx in self.merges.items():
            vocab[idx] = vocab[p0] + vocab[p1]
        for special, idx in self.special_tokens.items():
            vocab[idx] = special.encode("utf-8")
        return vocab

    def save(self, file_prefix):
        """
        保存两个文件：file_prefix.vocab 和 file_prefix.model
        - model文件用于load()
        - vocab文件只是一个打印版本，仅供人类检查
        """
        # 写入文件
        model_file = file_prefix + ".model"
        with open(model_file, 'w') as f:
            # 写入版本，模式和合并
            f.write("minbpe v1\n")
            f.write(f"{self.pattern}\n")
            # 写入特殊字符
            f.write(f"{len(self.special_tokens)}\n")
            for special, idx in self.special_tokens.items():
                f.write(f"{special} {idx}\n")
            # 合并字典
            for idx1, idx2 in self.merges:
                f.write(f"{idx1} {idx2}\n")
                
        # 写入词表，这个只是用来看的
        vocab_file = file_prefix + ".vocab"
        inverted_merges = {idx: pair for pair, idx in self.merges.items()}
        with open(vocab_file, "w", encoding="utf-8") as f:
            for idx, token in self.vocab.items():
                s = render_token(token)
              
                if idx in inverted_merges:
                    idx0, idx1 = inverted_merges[idx]
                    s0 = render_token(self.vocab[idx0])
                    s1 = render_token(self.vocab[idx1])
                    f.write(f"[{s0}][{s1}] -> [{s}] {idx}\n")
                else:
                    f.write(f"[{s}] {idx}\n")

    def load(self, model_file):
        """读取模型文件"""
        assert model_file.endswith(".model")
        # 读取模型文件
        merges = {}
        special_tokens = {}
        idx = 256
        with open(model_file, 'r', encoding="utf-8") as f:
            version = f.readline().strip()
            assert version == "minbpe v1"
            self.pattern = f.readline().strip()

            num_special = int(f.readline().strip())
            for _ in range(num_special):
                special, special_idx = f.readline().strip().split()
                special_tokens[special] = int(special_idx)

            for line in f:
                idx1, idx2 = map(int, line.split())
                merges[(idx1, idx2)] = idx
                idx += 1
        self.merges = merges
        self.special_tokens = special_tokens
        self.vocab = self._build_vocab()
```

## basic.py

该文件实现了基本的`Tokenizer`类。首先断言词表的大小大于256，并计算要进行几次merge，也就是去掉256个基本字节后，词表还剩下几个。

```python
from .base import Tokenizer, get_stats, merge

class BasicTokenizer(Tokenizer):

    def __init__(self):
        super().__init__()

    def train(self, text, vocab_size, verbose=False):
        assert vocab_size >= 256
        # 计算merge次数
        num_merges = vocab_size - 256

        # 输入文本预处理
        text_bytes = text.encode("utf-8") # 将文本解码为Utf-8格式
        ids = list(text_bytes) # 每个元素都是0-255之间的整数的列表

        # 迭代地合并最常见的pair，创建新的token
        merges = {} # (int, int) -> int
        vocab = {idx: bytes([idx]) for idx in range(256)} # int -> bytes
        for i in range(num_merges):
            # 统计每个pair出现的次数，返回字典，key是pair，value是出现的次数
            stats = get_stats(ids)
            # 找到出现次数最多的pair
            pair = max(stats, key=stats.get)
            # 为新的token分配一个新的id
            idx = 256 + i
            # 用idx替换ids中所有的pair
            ids = merge(ids, pair, idx)
            # 保存合并
            merges[pair] = idx
            vocab[idx] = vocab[pair[0]] + vocab[pair[1]]
            # 打印
            if verbose:
                print(f"merge {i+1}/{num_merges}: {pair} -> {idx} ({vocab[idx]}) had {stats[pair]} occurrences")

        # 保存类变量
        self.merges = merges # used in encode()
        self.vocab = vocab   # used in decode()

    def decode(self, ids):
        # 解码，输入int组成的列表，返回字符串
        text_bytes = b"".join(self.vocab[idx] for idx in ids)
        text = text_bytes.decode("utf-8", errors="replace")
        return text

    def encode(self, text):
        # 编码，输入字符串，返回int列表
        text_bytes = text.encode("utf-8") # raw bytes
        ids = list(text_bytes) # 0-255 int值的列表
        while len(ids) >= 2:
            # 找到pair中merge index最小的pair
            stats = get_stats(ids)
            pair = min(stats, key=lambda p: self.merges.get(p, float("inf")))
            # 如果没有更多的merge可用，那么key将给每个pair一个inf，min将是列表中的第一个pair
            if pair not in self.merges:
                break # 没有可以继续merge的情况下中断
            # 否则继续merge当前最佳的pair（最少merge次数的index） 
            idx = self.merges[pair]
            ids = merge(ids, pair, idx)
        return ids
```

## regex.py

该文件实现了`RegexTokenizer`，是一个正则处理的类，用于预处理文本，并处理`special tokens`。

```python
import regex as re
from .base import Tokenizer, get_stats, merge

# GPT文本的分词处理模式
# https://github.com/openai/tiktoken/blob/main/tiktoken_ext/openai_public.py
GPT2_SPLIT_PATTERN = r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
GPT4_SPLIT_PATTERN = r"""'(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]++[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+"""

class RegexTokenizer(Tokenizer):

    def __init__(self, pattern=None):
        """
        - pattern: 可选的字符串，用于覆盖默认的（GPT-4分割模式）
        - special_tokens: 特殊token的str -> int字典
          例如：{'<|endoftext|>': 100257}
        """
        super().__init__()
        self.pattern = GPT4_SPLIT_PATTERN if pattern is None else pattern
        self.compiled_pattern = re.compile(self.pattern)
        self.special_tokens = {} # str -> int
        self.inverse_special_tokens = {} # int -> str

    def train(self, text, vocab_size, verbose=False):
        assert vocab_size >= 256
        num_merges = vocab_size - 256

        # 分割文本为文本块
        text_chunks = re.findall(self.compiled_pattern, text)

        # 输入文本预处理
        ids = [list(ch.encode("utf-8")) for ch in text_chunks]

        # 迭代将最常见的组合合并为新的标记
        merges = {} # (int, int) -> int
        vocab = {idx: bytes([idx]) for idx in range(256)} # idx -> bytes
        for i in range(num_merges):
           # 计算每个连续组合出现的次数
            stats = {}
            for chunk_ids in ids:
                # 传入stats将在原地更新它，累加计数
                get_stats(chunk_ids, stats)
            # 找到计数最高的组合
            pair = max(stats, key=stats.get)
            # 铸造一个新的标记：分配下一个可用的id
            idx = 256 + i
            # 用idx替换ids中所有pair的出现
            ids = [merge(chunk_ids, pair, idx) for chunk_ids in ids]
            # 保存merge
            merges[pair] = idx
            vocab[idx] = vocab[pair[0]] + vocab[pair[1]]
            # 打印
            if verbose:
                print(f"merge {i+1}/{num_merges}: {pair} -> {idx} ({vocab[idx]}) had {stats[pair]} occurrences")

        # 保存
        self.merges = merges # used in encode()
        self.vocab = vocab   # used in decode()

    def register_special_tokens(self, special_tokens):
        # special_tokens: 一个特殊的字典 str -> int
        # 例如: {"<|endoftext|>": 100257}
        self.special_tokens = special_tokens
        self.inverse_special_tokens = {v: k for k, v in special_tokens.items()}

    def decode(self, ids):
        part_bytes = []
        for idx in ids:
            if idx in self.vocab:
                part_bytes.append(self.vocab[idx])
            elif idx in self.inverse_special_tokens:
                part_bytes.append(self.inverse_special_tokens[idx].encode("utf-8"))
            else:
                raise ValueError(f"invalid token id: {idx}")
        text_bytes = b"".join(part_bytes)
        text = text_bytes.decode("utf-8", errors="replace")
        return text

    def _encode_chunk(self, text_bytes):
        # 返回 token ids
        # 将所有字节转换为0..255范围内的整数
        ids = list(text_bytes)
        while len(ids) >= 2:
            # 找到pair中merge index最小的pair
            stats = get_stats(ids)
            pair = min(stats, key=lambda p: self.merges.get(p, float("inf")))
            if pair not in self.merges:
                break 

            idx = self.merges[pair]
            ids = merge(ids, pair, idx)
        return ids

    def encode_ordinary(self, text):
        """编码并忽略任何special token。"""
        # 按照正则表达式模式中定义的类别将文本分割为文本块
        text_chunks = re.findall(self.compiled_pattern, text)
        # 所有字符块被单独编码，并在最后合并
        ids = []
        for chunk in text_chunks:
            chunk_bytes = chunk.encode("utf-8") # raw bytes
            chunk_ids = self._encode_chunk(chunk_bytes)
            ids.extend(chunk_ids)
        return ids

    def encode(self, text, allowed_special="none_raise"):
        """
        与encode_ordinary不同，此函数处理特殊token。
        allowed_special: 可以是"all"|"none"|"none_raise"或特殊token的自定义集合
        如果none_raise，则在文本中遇到任何特殊token时会引发错误
        """
        # decode the user desire w.r.t. handling of special tokens
        special = None
        if allowed_special == "all":
            special = self.special_tokens
        elif allowed_special == "none":
            special = {}
        elif allowed_special == "none_raise":
            special = {}
            assert all(token not in text for token in self.special_tokens)
        elif isinstance(allowed_special, set):
            special = {k: v for k, v in self.special_tokens.items() if k in allowed_special}
        else:
            raise ValueError(f"allowed_special={allowed_special} not understood")
        if not special:
            # 如果没有special token,就使用ordinary encoding
            return self.encode_ordinary(text)
        # 否则，我们必须小心处理文本中可能的特殊token
        # 我们通过在文本中出现任何特殊token的确切匹配来处理特殊token
        # 我们可以使用re.split来实现这一点。请注意，将模式括在()中
        # 使其成为捕获组，因此特殊token将被包括在内
        special_pattern = "(" + "|".join(re.escape(k) for k in special) + ")"
        special_chunks = re.split(special_pattern, text)
        # 现在所有特殊字符都与文本的其余部分分开
        # 所有文本块都是分开编码的，然后结果是连接的
        ids = []
        for part in special_chunks:
            if part in special:
                # 这是一个特殊的标记，将其单独编码为特殊情况
                ids.append(special[part])
            else:
                # 这是一个普通的序列，正常编码
                ids.extend(self.encode_ordinary(part))
        return ids
```

## gpt4.py

最后一个文件是`gpt4.py`，实现了基于`RegexTokenizer`的`GPT4Tokenizer`。

```python
import tiktoken
from .regex import RegexTokenizer


def bpe(mergeable_ranks, token, max_rank):
    # 辅助函数，用于在get_gpt4_merges()中重构合并树
    parts = [bytes([b]) for b in token]
    while True:
        min_idx = None
        min_rank = None
        for i, pair in enumerate(zip(parts[:-1], parts[1:])):
            rank = mergeable_ranks.get(pair[0] + pair[1])
            if rank is not None and (min_rank is None or rank < min_rank):
                min_idx = i
                min_rank = rank
        if min_rank is None or (max_rank is not None and min_rank >= max_rank):
            break
        assert min_idx is not None
        parts = parts[:min_idx] + [parts[min_idx] + parts[min_idx + 1]] + parts[min_idx + 2:]
    return parts


def recover_merges(mergeable_ranks):
    # `merges`已经是它们合并状态的字节序列。
    # 因此，我们必须恢复原始的配对。我们可以通过对所有token进行一次小型BPE训练来实现这一点，按顺序进行。
  
    merges = {}
    for token, rank in mergeable_ranks.items():
        if len(token) == 1:
            continue # skip raw bytes
        pair = tuple(bpe(mergeable_ranks, token, max_rank=rank))
        assert len(pair) == 2
        # 恢复对的整数等级
        ix0 = mergeable_ranks[pair[0]]
        ix1 = mergeable_ranks[pair[1]]
        merges[(ix0, ix1)] = rank

    return merges
```

下面是`GPT4Tokenizer`的具体实现：

```python
GPT4_SPLIT_PATTERN = r"""'(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]++[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+"""
GPT4_SPECIAL_TOKENS = {
    '<|endoftext|>': 100257,
    '<|fim_prefix|>': 100258,
    '<|fim_middle|>': 100259,
    '<|fim_suffix|>': 100260,
    '<|endofprompt|>': 100276
}

class GPT4Tokenizer(RegexTokenizer):
    """RegexTokenizer的轻量级包装器，匹配GPT-4的分词器。"""

    def __init__(self):
        super().__init__(pattern=GPT4_SPLIT_PATTERN)
        # 获取官方tokenizer和merges
        enc = tiktoken.get_encoding("cl100k_base")
        mergeable_ranks = enc._mergeable_ranks
        # the merges are those of gpt4, but we have to recover them
        self.merges = recover_merges(mergeable_ranks)
        # 从merges重建vocab
        vocab = {idx: bytes([idx]) for idx in range(256)}
        for (p0, p1), idx in self.merges.items():
            vocab[idx] = vocab[p0] + vocab[p1]
        self.vocab = vocab
        
        # 由于某种原因，与单个字节对应的标记以不同的顺序排列。
        self.byte_shuffle = {i: mergeable_ranks[bytes([i])] for i in range(256)}
        self.inverse_byte_shuffle = {v: k for k, v in self.byte_shuffle.items()}
		# 注册special tokens
        self.register_special_tokens(GPT4_SPECIAL_TOKENS)

    def _encode_chunk(self, text_bytes):
    	# 在我们开始处理字节之前，我们必须对它们进行排列
        text_bytes = bytes(self.byte_shuffle[b] for b in text_bytes)
        ids = super()._encode_chunk(text_bytes)
        return ids

    def decode(self, ids):
    	# 我们必须在解码之前对字节进行反排列
        text_bytes = b"".join(self.vocab[idx] for idx in ids)
        text_bytes = bytes(self.inverse_byte_shuffle[b] for b in text_bytes)
        text = text_bytes.decode("utf-8", errors="replace")
        return text

    def train(self, text, vocab_size, verbose=False):
        raise NotImplementedError

    def save(self, file_prefix):
        raise NotImplementedError("GPT4Tokenizer cannot be saved.")

    def load(self, model_file):
        raise NotImplementedError("GPT4Tokenizer cannot be loaded.")

    def save_vocab(self, vocab_file):
        # 仅用于可视化目的，让我们以与基类完全相同的格式输出GPT-4标记。
        # 简单运行：
        # python -c "from minbpe import GPT4Tokenizer; GPT4Tokenizer().save_vocab('gpt4.vocab')"
    
        from .base import render_token
        vocab = {idx: bytes([self.inverse_byte_shuffle[idx]]) for idx in range(256)}
        for (p0, p1), idx in self.merges.items():
            vocab[idx] = vocab[p0] + vocab[p1]

        inverted_merges = {idx: pair for pair, idx in self.merges.items()}
        with open(vocab_file, "w", encoding="utf-8") as f:
            for idx, token in vocab.items():
                s = render_token(token)
                if idx in inverted_merges:
                    idx0, idx1 = inverted_merges[idx]
                    s0 = render_token(vocab[idx0])
                    s1 = render_token(vocab[idx1])
                    f.write(f"[{s0}][{s1}] -> [{s}] {idx}\n")
                else:
                    f.write(f"[{s}] {idx}\n")
```


2024/3/10 于苏州
