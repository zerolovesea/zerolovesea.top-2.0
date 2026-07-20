---
title: "LlaMA的工程代码实现"
description: "LlaMA的工程代码实现，包括Tokenizer, RMSNorm, RoPE, Transformer, FFN, generate等。"
pubDate: "2024-01-01 15:20:29"
---

前面讲了一下LlaMA1的架构，现在看一下官方是如何实现它的。

![transformers库中实现的LlaMA架构](/_posts/LlaMA%E7%9A%84%E5%B7%A5%E7%A8%8B%E4%BB%A3%E7%A0%81%E5%AE%9E%E7%8E%B0/240101-6.png)

观察模型架构，可以看到模型由几个比较关键的层组成：是LlaMA自己的Decoder层，一共有40层，每一层包含了自注意力层，旋转位置编码和一个MLP层。MLP层中包含了SiLU激活层，一个前置和一个后置的RMS均方归一化层。在最后输出时又加了一个RMS归一层。

# Tokenizer
分词器的实现主要使用了sentencepiece这个库，具体的实现方式是BPE算法。

> BPE(Byte Pair Encoding)：目的是使用一些子词来编码数据，在LlaMA1中，将数字也分成了最小的单个数字。BPE的三个核心流程是`词表构建`，`语料编码`，`语料解码`。

代码实现：

```python
import os
from logging import getLogger
from typing import List

from sentencepiece import SentencePieceProcessor

logger = getLogger()

class Tokenizer:
    """tokenizing and encoding/decoding text using SentencePiece."""
    def __init__(self, model_path: str):
        """
		使用SentencePiece模型初始化分词器。
		
        Args:
            model_path (str): SentencePiece模型路径。
        """
        # reload tokenizer
        self.sp_model = SentencePieceProcessor(model_file=model_path)
        logger.info(f"Reloaded SentencePiece model from {model_path}")

        # BOS / EOS token IDs
        self.n_words: int = self.sp_model.vocab_size()
        self.bos_id: int = self.sp_model.bos_id()
        self.eos_id: int = self.sp_model.eos_id()
        self.pad_id: int = self.sp_model.pad_id()
        logger.info(
            f"#words: {self.n_words} - BOS ID: {self.bos_id} - EOS ID: {self.eos_id}"
        )

    def encode(self, s: str, bos: bool, eos: bool) -> List[int]:
        """
		将一个字符串编码成Token ID的列表
		
        Args:
            s (str): 被编码的输入字符串。
            bos (bool): 是否在序列的开头添加起始标记。
            eos (bool): 是否附加结束序列标记。

        Returns:
            List[int]: 一个Token ID的列表
        """
        t = self.sp_model.encode(s)
        if bos:
            t = [self.bos_id] + t
        if eos:
            t = t + [self.eos_id]
        return t

    def decode(self, t: List[int]) -> str:
        """
        将一个Token ID的列表解码为字符串。

        Args:
            t (List[int]): 被解码的Token ID列表。

        Returns:
            str: 解码后的字符串。
        """
        return self.sp_model.decode(t)
```
# 模型设置

```python
import math
from dataclasses import dataclass
from typing import Optional, Tuple

import fairscale.nn.model_parallel.initialize as fs_init
import torch
import torch.nn.functional as F
from fairscale.nn.model_parallel.layers import (
    ColumnParallelLinear,
    ParallelEmbedding,
    RowParallelLinear,
)
from torch import nn

@dataclass
class ModelArgs:
    dim: int = 4096
    n_layers: int = 32
    n_heads: int = 32
    n_kv_heads: Optional[int] = None
    vocab_size: int = -1  # defined later by tokenizer
    multiple_of: int = 256  # make SwiGLU hidden layer size multiple of large power of 2
    ffn_dim_multiplier: Optional[float] = None
    norm_eps: float = 1e-5

    max_batch_size: int = 32
    max_seq_len: int = 2048
    
```

# RMS Norm
LLaMa中的另一个创新点是使用了 RMSNorm 归一化函数。我们可以对比一下简单的层归一化：

$\text{LayerNorm}(x) = \gamma \frac{x - \mu}{\sigma} + \beta$

其中：
- $\( x \)$ 是输入向量或矩阵。
- $\( \mu \)$ 表示 $\( x \)$ 的均值。
- $\( \sigma \)$ 是 $\( x \)$ 的标准差。
- $\( \gamma \)$ 用于缩放归一化结果的参数。
- $\( \beta \)$ 用于偏移归一化结果的参数。

LayerNorm是一种标准化方法，它计算一个样本的均值和方差，然后使用这些来对样本进行归一化。这种方法是独立于批量大小的，使得模型更加稳定。在训练时可以理解为对每一句的输入进行归一化。

RMSNorm则是对LayerNorm的一个改进，但移除了其中的均值项，也就是移除了中间的re-center的步骤，可以看作LayerNorm在均值为0时的一个特例。论文通过实验证明，re-center操作不重要。RMSNorm与 LayerNorm不同，它不是使用整个样本的均值和方差，而是使用平方根的均值来归一化，这样做可以降低噪声的影响。

$\text{RMSNorm}(x) = \frac{x}{\sqrt{\text{E}[x^2] + \epsilon}}$

其中：
- $\(x \)$ 是输入向量或矩阵。
- $\( \text{E}[x^2] \)$ 表示 $\( x \)$ 的平方的期望值。
- $\( \epsilon \)$ 是一个小的正常数，用于防止分母为零。

代码实现：

```python
class RMSNorm(torch.nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6):
        """
        初始化RMSNorm归一化层。

        Args:
            dim (int): 输入张量的维度。
            eps (float, optional): 为了数值稳定性（出现0），添加到分母的小值。默认值为1e-6。

        Attributes:
            eps (float): 为了数值稳定性，添加到分母的小值。
            weight (nn.Parameter): 可学习的缩放参数。
        """
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def _norm(self, x):
        """
        对输入张量应用RMSNorm归一化。

        Args:
            x (torch.Tensor): 输入张量。

        Returns:
            torch.Tensor: 归一化后的张量。
        """
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)

    def forward(self, x):
        """
       通过RMSNorm层进行前向传播。

        Args:
            x (torch.Tensor): 输入张量。

        Returns:
            torch.Tensor: 应用RMSNorm后的输出张量。
        """
        output = self._norm(x.float()).type_as(x)
        return output * self.weight
```

# SwiGLU激活函数

LLaMA采用SwiGLU替换了原有的ReLU。这是Swish激活组合和GLU激活函数的组合。

Swish的公式是：$Swish=x\cdot sigmoid(\beta x)$ 也是对输入$\(x \)$乘以一个系数，对$\(x \)$进行限制。

GLU的公式是：$GLU(x)=\sigma(W x+b)\otimes(V x+c)$

两者组合后的SwiGLU公式为：$SwiGLU(x,W,V,b,c,\beta)=Swish_{\beta}(x W+b)\otimes(x V+c)$

# Transformer构建

LlaMA中，每个Transformer块由自注意力层和FFN层组成，随后进行堆叠。

## Attention:

代码实现：

```python
class Attention(nn.Module):
    def __init__(self, args: ModelArgs):
        """
        初始化注意力模块。

        Args:
            args (ModelArgs): 模型配置参数。

        Attributes:
            n_kv_heads (int): Key/Value头的个数。
            n_local_heads (int): 本地查询头的数量。主要用在分布式场景。
            n_local_kv_heads (int): 本地Key/Value头的数量。主要用在分布式场景。
            n_rep (int): 本地头的重复次数。
            head_dim (int): 每个注意力头的维度大小。
            wq (ColumnParallelLinear): Queries的线性变换。
            wk (ColumnParallelLinear): Keys的线性变换。
            wv (ColumnParallelLinear): Values的线性变换。
            wo (RowParallelLinear): 输出的线性变换。
            cache_k (torch.Tensor): 注意力的Cached keys。
            cache_v (torch.Tensor): 注意力的Cached values。
        """
        super().__init__()

        self.n_local_heads = args.n_heads // fs_init.get_model_parallel_world_size()
        self.head_dim = args.dim // args.n_heads # 4096//32 = 128

        self.wq = ColumnParallelLinear(
            args.dim,
            args.n_heads * self.head_dim,
            bias=False,
            gather_output=False,
            init_method=lambda x: x,
        ) # (4096,4096)
        self.wk = ColumnParallelLinear(
            args.dim,
            args.n_heads * self.head_dim,
            bias=False,
            gather_output=False,
            init_method=lambda x: x,
        ) # (4096,4096)
        self.wv = ColumnParallelLinear(
            args.dim,
            args.n_heads * self.head_dim,
            bias=False,
            gather_output=False,
            init_method=lambda x: x,
        ) # (4096,4096)
        self.wo = RowParallelLinear(
            args.n_heads * self.head_dim,
            args.dim,
            bias=False,
            input_is_parallel=True,
            init_method=lambda x: x,
        ) # (4096,4096)

        self.cache_k = torch.zeros(
            (args.max_batch_size, args.max_seq_len, self.n_local_heads, self.head_dim)
        ).cuda() # (32,2048,n_local_heads,128)
        self.cache_v = torch.zeros(
            (args.max_batch_size, args.max_seq_len, self.n_local_heads, self.head_dim)
        ).cuda() # (32,2048,n_local_heads,128)

    def forward(self, x: torch.Tensor, start_pos: int, freqs_cis: torch.Tensor, mask: Optional[torch.Tensor]):
        """
        注意力模块的前向传播。

        Args:
            x (torch.Tensor):输入张量。
            start_pos (int): 缓存的起始位置。
            freqs_cis (torch.Tensor): 预计算的频率张量。
            mask (torch.Tensor, optional): 注意力掩码张量。

        Returns:
            torch.Tensor: 注意力后的输出张量。

        """
        bsz, seqlen, _ = x.shape
        xq, xk, xv = self.wq(x), self.wk(x), self.wv(x)
		
        # Resize (4096,4096) ==> (batch_size, seq_len, n_local_heads, 128)
        xq = xq.view(bsz, seqlen, self.n_local_heads, self.head_dim)
        xk = xk.view(bsz, seqlen, self.n_local_heads, self.head_dim)
        xv = xv.view(bsz, seqlen, self.n_local_heads, self.head_dim)

        xq, xk = apply_rotary_emb(xq, xk, freqs_cis=freqs_cis)

        self.cache_k = self.cache_k.to(xq)
        self.cache_v = self.cache_v.to(xq)

        self.cache_k[:bsz, start_pos : start_pos + seqlen] = xk
        self.cache_v[:bsz, start_pos : start_pos + seqlen] = xv

        keys = self.cache_k[:bsz, : start_pos + seqlen]
        values = self.cache_v[:bsz, : start_pos + seqlen]
		
        # 转置
        xq = xq.transpose(1, 2) 
        keys = keys.transpose(1, 2)
        values = values.transpose(1, 2)
        scores = torch.matmul(xq, keys.transpose(2, 3)) / math.sqrt(self.head_dim)
        if mask is not None:
            scores = scores + mask  # (batch_size, n_local_heads, seq_len, cache_len + seq_len)
        scores = F.softmax(scores.float(), dim=-1).type_as(xq)
        output = torch.matmul(scores, values)  # (batch_size, n_local_heads, seq_len, head_dim)
        output = output.transpose(
            1, 2
        ).contiguous().view(bsz, seqlen, -1)

        return self.wo(output)
```

## FFN层

FFN层就是简单的前向传播，其中激活函数的选择和位置都进行了改变。

```python
class FeedForward(nn.Module):
    def __init__(
        self,
        dim: int,
        hidden_dim: int,
        multiple_of: int,
    ):
        """
        初始化FeedForward模块。

        Args:
            dim (int): 输入维度。
            hidden_dim (int): 前馈层的隐藏维度。
            multiple_of (int): 确保隐藏维度是此值的倍数。
            ffn_dim_multiplier (float, optional): 隐藏维度的自定义乘数。默认为None。

        Attributes:
            w1 (ColumnParallelLinear): 第一层的线性变换。
            w2 (RowParallelLinear): 第二层的线性变换。
            w3 (ColumnParallelLinear): 第三层的线性变换。

        """
        super().__init__()
        hidden_dim = int(2 * hidden_dim / 3)
        hidden_dim = multiple_of * ((hidden_dim + multiple_of - 1) // multiple_of)

        self.w1 = ColumnParallelLinear(
            dim, hidden_dim, bias=False, gather_output=False, init_method=lambda x: x
        )
        self.w2 = RowParallelLinear(
            hidden_dim, dim, bias=False, input_is_parallel=True, init_method=lambda x: x
        )
        self.w3 = ColumnParallelLinear(
            dim, hidden_dim, bias=False, gather_output=False, init_method=lambda x: x
        )

    def forward(self, x):
        return self.w2(F.silu(self.w1(x)) * self.w3(x))
```

## Transformer Block

注意力层和FFN层合并后就是一个单独的Transformer块。

```python
class TransformerBlock(nn.Module):
    def __init__(self, layer_id: int, args: ModelArgs):
        """
        初始化TransformerBlock。

        Args:
            layer_id (int): 层的标识符。
            args (ModelArgs): 模型配置参数。

        Attributes:
            n_heads (int): 注意力头的数量。
            dim (int): 模型的维度大小。
            head_dim (int): 每个注意力头的维度大小。
            attention (Attention): 注意力模块。
            feed_forward (FeedForward): 前馈模块。
            layer_id (int): 层的标识符。
            attention_norm (RMSNorm): 注意力输出的层归一化。
            ffn_norm (RMSNorm): 前馈输出的层归一化。

        """
        super().__init__()
        self.n_heads = args.n_heads # 32
        self.dim = args.dim # 4096
        self.head_dim = args.dim // args.n_heads # 4096//32 = 128
        self.attention = Attention(args)
        self.feed_forward = FeedForward(
            dim=args.dim, hidden_dim=4 * args.dim, multiple_of=args.multiple_of
        )
        self.layer_id = layer_id
        self.attention_norm = RMSNorm(args.dim, eps=args.norm_eps)
        self.ffn_norm = RMSNorm(args.dim, eps=args.norm_eps)

    def forward(self, x: torch.Tensor, start_pos: int, freqs_cis: torch.Tensor, mask: Optional[torch.Tensor]):
        """
        执行TransformerBlock的前向传播。

        Args:
            x (torch.Tensor): 输入张量。
            start_pos (int): 注意力缓存的起始位置。
            freqs_cis (torch.Tensor): 预计算的余弦和正弦频率。
            mask (torch.Tensor, optional): 注意力的掩码张量。默认为None。

        Returns:
            torch.Tensor: 应用注意力和前馈层后的输出张量。

        """
        h = x + self.attention.forward(self.attention_norm(x), start_pos, freqs_cis, mask)
        out = h + self.feed_forward.forward(self.ffn_norm(h))
        return out
```

## Transformer

最后把transformer块合并一下，加上Embedding层，就是一个完整的Transformer结构了。

Forward部分，先对输入的token做token embedding，然后添加位置信息。对于decoder模型，为了防止标签泄漏，需要掩码，所以做了一个上三角的掩码矩阵。接下来就是逐层的计算transformer。

```python
class Transformer(nn.Module):
    def __init__(self, params: ModelArgs):
        """
        初始化Transformer模型。

        Args:
            params (ModelArgs): 模型配置参数。
            
        Attributes:
            params (ModelArgs): 模型配置参数。
            vocab_size (int): 词汇表大小。
            n_layers (int): 模型中的层数。
            tok_embeddings (ParallelEmbedding): Token嵌入。
            layers (torch.nn.ModuleList): Transformer块的列表。
            norm (RMSNorm): 模型输出的层归一化。
            output (ColumnParallelLinear): 最终输出的线性层。
            freqs_cis (torch.Tensor): 预计算的余弦和正弦频率。

        """
        super().__init__()
        self.params = params
        self.vocab_size = params.vocab_size # -1
        self.n_layers = params.n_layers # 32

        self.tok_embeddings = ParallelEmbedding(
            params.vocab_size, params.dim, init_method=lambda x: x
        )  # (-1,4096)

        self.layers = torch.nn.ModuleList()
        
        # 逐层添加
        for layer_id in range(params.n_layers):
            self.layers.append(TransformerBlock(layer_id, params))

        self.norm = RMSNorm(params.dim, eps=params.norm_eps)
        self.output = ColumnParallelLinear(
            params.dim, params.vocab_size, bias=False, init_method=lambda x: x
        ) # (4096,-1)

        self.freqs_cis = precompute_freqs_cis(
            self.params.dim // self.params.n_heads, self.params.max_seq_len * 2
        )

    @torch.inference_mode()
    def forward(self, tokens: torch.Tensor, start_pos: int):
        """
        执行Transformer模型的前向传播。

        Args:
            tokens (torch.Tensor): 输入的token索引。
            start_pos (int): 注意力缓存的起始位置。

        Returns:
            torch.Tensor: 应用Transformer模型后的输出logits。

        """
        _bsz, seqlen = tokens.shape
        h = self.tok_embeddings(tokens)
        self.freqs_cis = self.freqs_cis.to(h.device)
        freqs_cis = self.freqs_cis[start_pos : start_pos + seqlen]

        mask = None
        if seqlen > 1:
            mask = torch.full((1, 1, seqlen, seqlen), float("-inf"), device=tokens.device)
            mask = torch.triu(mask, diagonal=start_pos + 1).type_as(h)

        for layer in self.layers:
            h = layer(h, start_pos, freqs_cis, mask)
        h = self.norm(h)
        output = self.output(h[:, -1, :])  # only compute last logits
        return output.float()
```

# Generation

代码的最后一部分是模型的生成部分：

第一部分是代码的依赖库以及输出的格式。

```python
import json
import os
import sys
import time
from pathlib import Path
from typing import List, Literal, Optional, Tuple, TypedDict

import torch
import torch.nn.functional as F
from fairscale.nn.model_parallel.initialize import (
    get_model_parallel_rank,
    initialize_model_parallel,
    model_parallel_is_initialized,
)

from llama.model import ModelArgs, Transformer
from llama.tokenizer import Tokenizer

Role = Literal["system", "user", "assistant"]

class Message(TypedDict):
    role: Role
    content: str

class CompletionPrediction(TypedDict, total=False):
    generation: str
    tokens: List[str]  # not required
    logprobs: List[float]  # not required

class ChatPrediction(TypedDict, total=False):
    generation: Message
    tokens: List[str]  # not required
    logprobs: List[float]  # not required


Dialog = List[Message]

B_INST, E_INST = "[INST]", "[/INST]"
B_SYS, E_SYS = "<<SYS>>\n", "\n<</SYS>>\n\n"

SPECIAL_TAGS = [B_INST, E_INST, "<<SYS>>", "<</SYS>>"]
UNSAFE_ERROR = "Error: special tags are not allowed as part of the prompt."
```

第二部分是模型实例类，其中包含了构建模型，生成推理结果。

```python
class Llama:
    @staticmethod
    def build(
        ckpt_dir: str,
        tokenizer_path: str,
        max_seq_len: int,
        max_batch_size: int,
        model_parallel_size: Optional[int] = None,
        seed: int = 1,
    ) -> "Llama":
        """
        构建一个Llama实例，通过初始化和加载预训练模型。

        Args:
            ckpt_dir (str): 包含检查点文件的目录路径。
            tokenizer_path (str): tokenizer文件的路径。
            max_seq_len (int): 输入文本的最大序列长度。
            max_batch_size (int): 推理的最大批量大小。
            model_parallel_size (Optional[int], optional): 模型并行进程的数量。
			如果未提供，将从环境中确定。默认为None。

        Returns:
            Llama: 带有加载的模型和分词器的Llama类的实例。

        Raises:
            AssertionError: 如果指定目录中没有检查点文件，或者模型并行大小与检查点文件的数量不匹配。

        Note:
            此方法会初始化分布式进程组，将设备设置为CUDA，并加载预训练模型和分词器。

        """
        if not torch.distributed.is_initialized():
            torch.distributed.init_process_group("nccl")
        if not model_parallel_is_initialized():
            if model_parallel_size is None:
                model_parallel_size = int(os.environ.get("WORLD_SIZE", 1))
            initialize_model_parallel(model_parallel_size)

        local_rank = int(os.environ.get("LOCAL_RANK", 0))
        torch.cuda.set_device(local_rank)

        # seed must be the same in all processes
        torch.manual_seed(seed)

        if local_rank > 0:
            sys.stdout = open(os.devnull, "w")

        start_time = time.time()
        checkpoints = sorted(Path(ckpt_dir).glob("*.pth"))
        assert len(checkpoints) > 0, f"no checkpoint files found in {ckpt_dir}"
        assert model_parallel_size == len(
            checkpoints
        ), f"Loading a checkpoint for MP={len(checkpoints)} but world size is {model_parallel_size}"
        ckpt_path = checkpoints[get_model_parallel_rank()]
        checkpoint = torch.load(ckpt_path, map_location="cpu")
        with open(Path(ckpt_dir) / "params.json", "r") as f:
            params = json.loads(f.read())

        model_args: ModelArgs = ModelArgs(
            max_seq_len=max_seq_len,
            max_batch_size=max_batch_size,
            **params,
        )
        tokenizer = Tokenizer(model_path=tokenizer_path)
        model_args.vocab_size = tokenizer.n_words
        torch.set_default_tensor_type(torch.cuda.HalfTensor)
        model = Transformer(model_args)
        model.load_state_dict(checkpoint, strict=False)
        print(f"Loaded in {time.time() - start_time:.2f} seconds")

        return Llama(model, tokenizer)

    def __init__(self, model: Transformer, tokenizer: Tokenizer):
        self.model = model
        self.tokenizer = tokenizer

    @torch.inference_mode()
    def generate(
        self,
        prompt_tokens: List[List[int]],
        max_gen_len: int,
        temperature: float = 0.6,
        top_p: float = 0.9,
        logprobs: bool = False,
        echo: bool = False,
    ) -> Tuple[List[List[int]], Optional[List[List[float]]]]:
        """
        基于提供的提示使用语言生成模型生成文本序列。

        Args:
            prompt_tokens (List[List[int]]): Tokenized prompts的列表, 其中每个提示表示为整数列表。
            max_gen_len (int): 生成文本序列的最大长度。
            temperature (float, optional): 控制采样中随机性的温度值。默认为0.6。
            top_p (float, optional): 核心采样的top-p概率阈值。默认为0.9。
            logprobs (bool, optional): 指示是否计算Token对数概率的标志。默认为False。
            echo (bool, optional): 指示是否在生成的输出中包括提示Token的标志。默认为False。

        Returns:
            Tuple[List[List[int]], Optional[List[List[float]]]]: 包含生成的Token序列的元组，如果logprobs为True，则包含相应的Token对数概率。

        Note:
            此方法使用提供的提示作为生成文本的基础。它使用核心采样（nucleus sampling）来产生具有控制随机性的文本。
			如果logprobs为True，则为每个生成的Token计算Token对数概率。
        """
        params = self.model.params
        bsz = len(prompt_tokens)
        assert bsz <= params.max_batch_size, (bsz, params.max_batch_size)

        min_prompt_len = min(len(t) for t in prompt_tokens)
        max_prompt_len = max(len(t) for t in prompt_tokens)
        assert max_prompt_len <= params.max_seq_len
        total_len = min(params.max_seq_len, max_gen_len + max_prompt_len)

        pad_id = self.tokenizer.pad_id
        tokens = torch.full((bsz, total_len), pad_id, dtype=torch.long, device="cuda")
        for k, t in enumerate(prompt_tokens):
            tokens[k, : len(t)] = torch.tensor(t, dtype=torch.long, device="cuda")
        if logprobs:
            token_logprobs = torch.zeros_like(tokens, dtype=torch.float)

        prev_pos = 0
        eos_reached = torch.tensor([False] * bsz, device="cuda")
        input_text_mask = tokens != pad_id
        if min_prompt_len == total_len:
            logits = self.model.forward(tokens, prev_pos)
            token_logprobs = -F.cross_entropy(
                input=logits.transpose(1, 2),
                target=tokens,
                reduction="none",
                ignore_index=pad_id,
            )

        for cur_pos in range(min_prompt_len, total_len):
            logits = self.model.forward(tokens[:, prev_pos:cur_pos], prev_pos)
            if temperature > 0:
                probs = torch.softmax(logits[:, -1] / temperature, dim=-1)
                next_token = sample_top_p(probs, top_p)
            else:
                next_token = torch.argmax(logits[:, -1], dim=-1)

            next_token = next_token.reshape(-1)
            # only replace token if prompt has already been generated
            next_token = torch.where(
                input_text_mask[:, cur_pos], tokens[:, cur_pos], next_token
            )
            tokens[:, cur_pos] = next_token
            if logprobs:
                token_logprobs[:, prev_pos + 1 : cur_pos + 1] = -F.cross_entropy(
                    input=logits.transpose(1, 2),
                    target=tokens[:, prev_pos + 1 : cur_pos + 1],
                    reduction="none",
                    ignore_index=pad_id,
                )
            eos_reached |= (~input_text_mask[:, cur_pos]) & (
                next_token == self.tokenizer.eos_id
            )
            prev_pos = cur_pos
            if all(eos_reached):
                break

        if logprobs:
            token_logprobs = token_logprobs.tolist()
        out_tokens, out_logprobs = [], []
        for i, toks in enumerate(tokens.tolist()):
            # cut to max gen len
            start = 0 if echo else len(prompt_tokens[i])
            toks = toks[start : len(prompt_tokens[i]) + max_gen_len]
            probs = None
            if logprobs:
                probs = token_logprobs[i][start : len(prompt_tokens[i]) + max_gen_len]
            # cut to eos tok if any
            if self.tokenizer.eos_id in toks:
                eos_idx = toks.index(self.tokenizer.eos_id)
                toks = toks[:eos_idx]
                probs = probs[:eos_idx] if logprobs else None
            out_tokens.append(toks)
            out_logprobs.append(probs)
        return (out_tokens, out_logprobs if logprobs else None)

    def text_completion(
        self,
        prompts: List[str],
        temperature: float = 0.6,
        top_p: float = 0.9,
        max_gen_len: Optional[int] = None,
        logprobs: bool = False,
        echo: bool = False,
    ) -> List[CompletionPrediction]:
        """
        对一组提示词使用语言生成模型进行文本补完。

        Args:
            prompts (List[str]): 需要补完的文本提示词列表。
            temperature (float, optional): 控制采样中随机性的温度值。默认为0.6。
            top_p (float, optional): 核心采样的top-p概率阈值。默认为0.9。
            max_gen_len (Optional[int], optional): 生成完成序列的最大长度。
如果未提供，将设置为模型的最大序列长度减1。
            logprobs (bool, optional): 指示是否计算Token对数概率的标志。默认为False。
            echo (bool, optional): 指示是否在生成的输出中包括提示Token的标志。默认为False。

        Returns:
            List[CompletionPrediction]: 完成预测的列表，每个预测包含生成的文本完成。

        Note:
            此方法为提供的提示词生成文本补完，并使用核心采样引入控制随机性。
            如果logprobs被设置为True，则为每个生成的Token计算对数概率。

        """
        if max_gen_len is None:
            max_gen_len = self.model.params.max_seq_len - 1
        prompt_tokens = [self.tokenizer.encode(x, bos=True, eos=False) for x in prompts]
        generation_tokens, generation_logprobs = self.generate(
            prompt_tokens=prompt_tokens,
            max_gen_len=max_gen_len,
            temperature=temperature,
            top_p=top_p,
            logprobs=logprobs,
            echo=echo,
        )
        if logprobs:
            return [
                {
                    "generation": self.tokenizer.decode(t),
                    "tokens": [self.tokenizer.decode(x) for x in t],
                    "logprobs": logprobs_i,
                }
                for t, logprobs_i in zip(generation_tokens, generation_logprobs)
            ]
        return [{"generation": self.tokenizer.decode(t)} for t in generation_tokens]

    def chat_completion(
        self,
        dialogs: List[Dialog],
        temperature: float = 0.6,
        top_p: float = 0.9,
        max_gen_len: Optional[int] = None,
        logprobs: bool = False,
    ) -> List[ChatPrediction]:
        """
      
        使用语言生成模型，对一个交谈对话的列表生成assistant回复。

        Args:
            dialogs (List[Dialog]): 会话对话的列表，其中每个对话都是消息列表。
            temperature (float, optional): 控制采样中随机性的温度值。默认为0.6。
            top_p (float, optional): 核心采样的top-p概率阈值。默认为0.9。
            max_gen_len (Optional[int], optional): 生成响应序列的最大长度。如果未提供，将设置为模型的最大序列长度减1。
            logprobs (bool, optional): 指示是否计算Token对数概率的标志。默认为False。
            
        Returns:
            List[ChatPrediction]: 聊天预测列表，每个预测包含assistant生成的响应。

        Raises:
            AssertionError: 如果对话中的最后一条消息不是来自用户。
            AssertionError: 如果对话角色不按照所需的'user'、'assistant'和可选的'system'顺序。

        Note:
            此方法为提供的会话对话生成assistant的响应。
            它使用核心采样引入文本生成中的控制随机性。
            如果logprobs设置为True，则将为每个生成的Token计算对数概率。

        """
        if max_gen_len is None:
            max_gen_len = self.model.params.max_seq_len - 1
        prompt_tokens = []
        unsafe_requests = []
        for dialog in dialogs:
            unsafe_requests.append(
                any([tag in msg["content"] for tag in SPECIAL_TAGS for msg in dialog])
            )
            if dialog[0]["role"] == "system":
                dialog = [
                    {
                        "role": dialog[1]["role"],
                        "content": B_SYS
                        + dialog[0]["content"]
                        + E_SYS
                        + dialog[1]["content"],
                    }
                ] + dialog[2:]
            assert all([msg["role"] == "user" for msg in dialog[::2]]) and all(
                [msg["role"] == "assistant" for msg in dialog[1::2]]
            ), (
                "model only supports 'system', 'user' and 'assistant' roles, "
                "starting with 'system', then 'user' and alternating (u/a/u/a/u...)"
            )
            dialog_tokens: List[int] = sum(
                [
                    self.tokenizer.encode(
                        f"{B_INST} {(prompt['content']).strip()} {E_INST} {(answer['content']).strip()} ",
                        bos=True,
                        eos=True,
                    )
                    for prompt, answer in zip(
                        dialog[::2],
                        dialog[1::2],
                    )
                ],
                [],
            )
            assert (
                dialog[-1]["role"] == "user"
            ), f"Last message must be from user, got {dialog[-1]['role']}"
            dialog_tokens += self.tokenizer.encode(
                f"{B_INST} {(dialog[-1]['content']).strip()} {E_INST}",
                bos=True,
                eos=False,
            )
            prompt_tokens.append(dialog_tokens)

        generation_tokens, generation_logprobs = self.generate(
            prompt_tokens=prompt_tokens,
            max_gen_len=max_gen_len,
            temperature=temperature,
            top_p=top_p,
            logprobs=logprobs,
        )
        if logprobs:
            return [
                {
                    "generation": {
                        "role": "assistant",
                        "content": self.tokenizer.decode(t)
                        if not unsafe
                        else UNSAFE_ERROR,
                    },
                    "tokens": [self.tokenizer.decode(x) for x in t],
                    "logprobs": logprobs_i,
                }
                for t, logprobs_i, unsafe in zip(
                    generation_tokens, generation_logprobs, unsafe_requests
                )
            ]
        return [
            {
                "generation": {
                    "role": "assistant",
                    "content": self.tokenizer.decode(t) if not unsafe else UNSAFE_ERROR,
                }
            }
            for t, unsafe in zip(generation_tokens, unsafe_requests)
        ]
```

最后一部分是top-p采样的代码。

```python
def sample_top_p(probs, p):
    """
    在概率分布上执行top-p（核心）采样。

    Args:
        probs (torch.Tensor): 概率分布张量。
        p (float): 用于top-p采样的概率阈值。

    Returns:
        torch.Tensor: 采样的Token索引。

    Note:
        Top-p抽样选择了最小的一组Token，其累积概率超过阈值p，并根据选择的Token对分布进行重新归一化。

    """
    probs_sort, probs_idx = torch.sort(probs, dim=-1, descending=True)
    probs_sum = torch.cumsum(probs_sort, dim=-1)
    mask = probs_sum - probs_sort > p
    probs_sort[mask] = 0.0
    probs_sort.div_(probs_sort.sum(dim=-1, keepdim=True))
    next_token = torch.multinomial(probs_sort, num_samples=1)
    next_token = torch.gather(probs_idx, -1, next_token)
    return next_token
```

2024/1/1 于苏州家中