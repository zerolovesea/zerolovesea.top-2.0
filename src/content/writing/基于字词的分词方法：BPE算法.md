---
title: "基于子词的分词方法：BPE算法"
description: "大语言模型中最重要的编码算法：BPE算法以及代码实现。"
pubDate: "2024-01-01 15:28:07"
---

了解NLP或LLM的同学应该都对文本嵌入不陌生，例如Word2Vec，GloVe等。这些嵌入方法的第一步都是对文本进行分词，随后以各种各样的方式将分词Token转化为编码。

在这过程中，分词这一步经常会被忽视。如果以字母单位进行分词，就会导致词表过大，推理时速度非常冗长，如果单词单位进行分词，就会无法处理未知的词汇。尤其是词库过大时，在上万个单词中计算概率分布，计算量非常大。今天就介绍一下BPE(Byte Pair Encoding)分词算法。这个算法被各大模型广泛使用，用以构建词表。

# 完整分词流程

一个完整的分词流程是这样的：输入句子为：`"I went to New York last week."`

分词器会将这话分为：`['i', 'went', 'to', 'New', 'York', 'last', 'week']` 这就是最普通的分词。然而它无法泛化变位的词关系。例如，当模型学习了`old, older, oldest`，这三个词是不同形态下的一个词。它不知道`smart, smarter, smartest`这是和类似的变位关系。

此外，`old, older, oldest`本身也会被当作三个独立的词进行学习，这等于丢失了很多语言信息。为了解决这个问题，出现了基于子词的分词方法。

# 基于子词的分词方法

基于子词(subword)的分词方法很符合逻辑，英语中有词根的定义，相同的词根在语义上类似。因此，人们尝试提取词根来进行分词。再进一步，又将词根进一步细化，把词根又切分成更小的子词。例如
`unfortunately`可以被拆分为：`un` + `for` + `tun` + `ate` + `ly`。`

总结一下，与传统分词对比，基于子词的分词方法的优势在于：

- 可以更好的处理未知或罕见的词汇。
- 可以学习到词缀之间的关系。
- 分词比单词的词根分词更细。

# BPE算法

BPE算法本身的名字有点不符合分词这个任务类型：Bytes Pair Encoding。其实它来自于一种数据压缩算法。

> BPE算法的核心思想：每一步都将最常见的一对相邻数据单位替换为该数据中没有出现过的一个新单位，反复迭代直到满足停止条件。

假设有需要编码（压缩）的数据`aaabdaaabac`。可以注意到相邻字节对`aa`最常出现，因此我们将用一个新字节 `Z` 替换它。

1. 现在有了 `ZabdZabac`，其中 `Z` =`aa`。下一个常见的字节对是 `ab`，用`Y`替换它。
2. 现在有 `ZYdZYac`，其中`Z` = `aa` ，`Y` = `ab`。剩下的唯一字节对是`ac`，它只有一个，所以我们不对它进行编码。
3. 我们可以递归地使用字节对编码将 `ZY` 编码为 `X`。
4. 我们的数据现在已转换为 `XdXac`，其中 `X` = `ZY`，`Y` = `ab`，`Z` = `aa`。它不能被进一步压缩，因为没有出现多次的字节对。
5. 该算法不断重复此过程，直到不能进一步压缩 ，比如说没有更多高频 byte 对，或是没有没用过的 byte 来进行替换表示了。最后算法会在写出压缩数据前，写出替换 byte 对的替换表。

这个算法在NLP长时间的发展中被引入。在LLM中，脱离了Bytes的层面，而转移到字符层面。在具实现上，采用了以下的步骤：

1. 计算每对相邻字符/子词的频率
2. 找到出现频率最高的相邻字符或子词，并将它们合并成一个新的符号
3. 在词汇表中添加这个新的符号
4. 更新输入文本中的所有相邻字符或子词，用新的符号替换它们
5. 重新计算各对相邻字符或子词的频率，回到步骤2

更具体的流程如下：

1. 把每个文档 $d$ 变成一个个单词，比如你可以简单用空格分词就好
2. 统计每个单词 $w$ 在所有文档中的出现频率，并得到初始的字符集 `alphabet` 作为一开始的 Vocab（包括后面的`</w>`）
3. 先将每个单词划分为一个个 utf-8 char，称为一个划分，比如 `highest -> h, i, g, h, e, s, t`
4. 然后，在每个单词的划分最后面加上 `</w>`，那么现在 `highest -> h, i, g, h, e, s, t, </w>`
5. 重复下面步骤直到满足两个条件中的任意一个：1）Vocab 达到上限。2）达到最大迭代次数

- 找到最经常一起出现的 pair，并记录这个合并规则放在 merge table 里面，同时把合并之后的结果放到 Vocab 里面
- 更新所有单词的划分，假设我们发现` (h, i)` 最经常一起出现，那么 `highest -> hi, g, h, e, s, t, </w>`

> 加入`</w>`是为了标记单词之间的边界。

## 使用BPE编码

完成训练后，将得到一个merge table和一个词表Vocab。当我们需要对一段文本进行处理时，就需要先把文本拆成一个个单词，每个单词拆分成字符。随后遍历merge table，根据规则更新字符的合并策略。

## 示例

假设我们对一段文本统计词频，得到不同单词的频数，随后把每个单词变成一个个 utf-8 字符然后加上`</w>`

```python
{'l o w </w>': 5, 'l o w e r </w>': 2, 'n e w e s t </w>': 6, 'w i d e s t </w>': 3}
```

出现最频繁的字节对是`e`和`s`，共出现了6+3=9次，因此将它们合并：

```python
{'l o w </w>': 5, 'l o w e r </w>': 2, 'n e w es t </w>': 6, 'w i d es t </w>': 3}
```

 现在出现最频繁的字节对是`es`和`t`，共出现了6+3=9次，因此将它们合并：

 ```python
{'l o w </w>': 5, 'l o w e r </w>': 2, 'n e w est </w>': 6, 'w i d est </w>': 3}
 ```

现在出现最频繁的字节对是`est`和`</w>`，共出现了6+3=9次，因此将它们合并：

 ```python
{'l o w </w>': 5, 'l o w e r </w>': 2, 'n e w est</w>': 6, 'w i d est</w>': 3}
 ```

出现最频繁的字节对是`l`和`o`，共出现了5+2=7次，因此将它们合并：

 ```python
{'lo w </w>': 5, 'lo w e r </w>': 2, 'n e w est</w>': 6, 'w i d est</w>': 3}
 ```

出现最频繁的字节对是`lo`和`w`，共出现了5+2=7次，因此将它们合并：

```python
{'low </w>': 5, 'low e r </w>': 2, 'n e w est</w>': 6, 'w i d est</w>': 3}
```

我们一直迭代到预设的字词词表大小或最高频的字节对的频数都为1，就得到了合适的词表。

## 中文分词思路

中文的分词思路也是类似的。我们在编码后，可能会得到这么一句话："W1在W2W3W4里，W5的W6W7W8W9高。"

它对对应的哈希表是：
```
W1 = [无论]
W2 = [英文]
W3 = [还是]
W4 = [中文]
W5 = [词汇]
W6 = [特点]
W7 = [就是]
W8 = [出现]
W9 = [频率]
```

# 代码实现

看了一下网上的源码，比较清晰。代码分成了两个部分，一个是统计词频，一个是合并词。

```python
import re, collections

text = "The aims for this subject is for students to develop an understanding of the main algorithms used in naturallanguage processing, for use in a diverse range of applications including text classification, machine translation, and question answering. Topics to be covered include part-of-speech tagging, n-gram language modelling, syntactic parsing and deep learning. The programming language used is Python, see for more information on its use in the workshops, assignments and installation at home."
# text = 'low '*5 +'lower '*2+'newest '*6 +'widest '*3

def get_vocab(text):
	# 初始化为0
	vocab = collections.defaultdict(int)
    # 去头去尾再根据空格split
    for word in text.strip().split():
        # 给list中每个元素增加空格，并在最后增加结束符号，同时统计单词出现次数
        vocab[' '.join(list(word)) + ' </w>'] += 1
    return vocab
print(get_vocab(text))
```

```python
def get_stats(vocab):
"""
这个函数遍历词汇表中的所有单词，并计算彼此相邻的一对标记。

EXAMPLE:
    word = 'T h e <\w>'
    这个单词可以两两组合成： [('T', 'h'), ('h', 'e'), ('e', '<\w>')]
    
输入:
    vocab: Dict[str, int]  # vocab统计了词语出现的词频
    
输出:
    pairs: Dict[Tuple[str, str], int] # 字母对，pairs统计了单词对出现的频率
"""
    pairs = collections.defaultdict(int)
    
    for word,freq in vocab.items():
        
        # 遍历每一个word里面的symbol，去凑所有的相邻两个内容
        symbols = word.split()
        for i in range(len(symbols)-1):
            pairs[(symbols[i],symbols[i+1])] += freq

    return pairs
```

合并高频字符对：

```python

def merge_vocab(pair, v_in):
	"""
    EXAMPLE:
        word = 'T h e <\w>'
        pair = ('e', '<\w>')
        word_after_merge = 'T h e<\w>'

    输入:
        pair: Tuple[str, str] # 需要合并的字符对
        v_in: Dict[str, int]  # 合并前的vocab

    输出:
        v_out: Dict[str, int] # 合并后的vocab

    注意:
        当合并word 'Th e<\w>'中的字符对 ('h', 'e')时，'Th'和'e<\w>'字符对不能被合并。
    """
    v_out = {}
    # 把pair拆开，然后用空格合并起来，然后用\把空格转义
    bigram = re.escape(' '.join(pair))
    # 自定义一个正则规则, (?<!\S)h\ e(?!\S) 只有前面、后面不是非空白字符(\S)(意思前后得是没东西的)，才匹配h\ e，这样就可以把Th\ e<\w>排除在外
    p = re.compile(r'(?<!\S)' + bigram + r'(?!\S)')
    
    for v in v_in:
        # 遍历当前的vocabulary，找到匹配正则的v时，才用合并的pair去替换变成新的pair new，如果没有匹配上，那就保持原来的。
        # 比如pair当前是'h'和'e'，然后遍历vocabulary，找到符合前后都没有东西只有'h\ e'的时候就把他们并在一起变成'he'
        new = p.sub(''.join(pair),v)
        # 然后新的合并的数量就是当前vocabulary里面pair对应的数量
        v_out[new] = v_in[v]
    return v_out

def get_tokens(vocab):
    tokens = collections.defaultdict(int)
    for word, freq in vocab.items():
        word_tokens = word.split()
        for token in word_tokens:
            tokens[token] += freq
    return tokens


# Get free book from Gutenberg
# wget http://www.gutenberg.org/cache/epub/16457/pg16457.txt
# vocab = get_vocab('pg16457.txt')

vocab = get_vocab(text)
print("Vocab =", vocab)
print('==========')
print('Tokens Before BPE')
tokens = get_tokens(vocab)
print('Tokens: {}'.format(tokens))
print('Number of tokens: {}'.format(len(tokens)))
print('==========')

#about 100 merges we start to see common words
num_merges = 100
for i in range(num_merges):
    pairs = get_stats(vocab)
    if not pairs:
        break
    
    # vocabulary里面pair出现次数最高的作为最先合并的pair
    best = max(pairs, key=pairs.get)
    
    # 先给他合并了再说，当然这里不操作也没什么，到merge_vocab里面都一样
    new_token = ''.join(best)
    vocab = merge_vocab(best, vocab)
    print('Iter: {}'.format(i))
    print('Best pair: {}'.format(best))
    # add new token to the vocab
    tokens[new_token] = pairs[best]
    # deduct frequency for tokens have been merged
    tokens[best[0]] -= pairs[best]
    tokens[best[1]] -= pairs[best]
    print('Tokens: {}'.format(tokens))
    print('Number of tokens: {}'.format(len(tokens)))
    print('==========')
    print('vocab, ', vocab)
```

输出如下：

```python
==========
Tokens Before BPE
Tokens: defaultdict(<class 'int'>, {'l': 7, 'o': 7, 'w': 16, '</w>': 16, 'e': 17, 'r': 2, 'n': 6, 's': 9, 't': 9, 'i': 3, 'd': 3})
Number of tokens: 11
==========
Iter: 0
Best pair: ('e', 's')
Tokens: defaultdict(<class 'int'>, {'l': 7, 'o': 7, 'w': 16, '</w>': 16, 'e': 8, 'r': 2, 'n': 6, 'es': 9, 't': 9, 'i': 3, 'd': 3})
Number of tokens: 11
==========
Iter: 1
Best pair: ('es', 't')
Tokens: defaultdict(<class 'int'>, {'l': 7, 'o': 7, 'w': 16, '</w>': 16, 'e': 8, 'r': 2, 'n': 6, 'est': 9, 'i': 3, 'd': 3})
Number of tokens: 10
==========
Iter: 2
Best pair: ('est', '</w>')
Tokens: defaultdict(<class 'int'>, {'l': 7, 'o': 7, 'w': 16, '</w>': 7, 'e': 8, 'r': 2, 'n': 6, 'est</w>': 9, 'i': 3, 'd': 3})
Number of tokens: 10
==========
Iter: 3
Best pair: ('l', 'o')
Tokens: defaultdict(<class 'int'>, {'lo': 7, 'w': 16, '</w>': 7, 'e': 8, 'r': 2, 'n': 6, 'est</w>': 9, 'i': 3, 'd': 3})
Number of tokens: 9
==========
Iter: 4
Best pair: ('lo', 'w')
Tokens: defaultdict(<class 'int'>, {'low': 7, '</w>': 7, 'e': 8, 'r': 2, 'n': 6, 'w': 9, 'est</w>': 9, 'i': 3, 'd': 3})
Number of tokens: 9
==========
```

至此，我们通过输入文本，得到了一个分词的词表。下面就需要对文本进行编码和解码。

# 编码

对于编码，需要对文本中每个单词进行拆分，并遍历词表，寻找是否有token是当前单词的子字符串。从最长的 token 迭代到最短的 token，尝试将每个单词中的子字符串替换为 token。 最终，我们将迭代所有 token，并将所有子字符串替换为 token。 如果仍然有子字符串没被替换但所有 token 都已迭代完毕，则将剩余的子词替换为特殊 token，如 <unk>

例如：

```python
["the</w>", "highest</w>", "mountain</w>"]

# 排好序的subword表
# 长度 6         5           4        4         4       4          2
["errrr</w>", "tain</w>", "moun", "est</w>", "high", "the</w>", "a</w>"]

# 迭代结果
"the</w>" -> ["the</w>"]
"highest</w>" -> ["high", "est</w>"]
"mountain</w>" -> ["moun", "tain</w>"]
```

代码实现：

```python
def get_tokens_from_vocab(vocab):
    tokens_frequencies = collections.defaultdict(int)
    vocab_tokenization = {}
    for word, freq in vocab.items():
        # 看vocabulary里面的token频率，相当于上面的code中的tokens去除freq为0的
        word_tokens = word.split()
        for token in word_tokens:
            tokens_frequencies[token] += freq
        # vocab和其对应的tokens
        vocab_tokenization[''.join(word_tokens)] = word_tokens
    return tokens_frequencies, vocab_tokenization

def measure_token_length(token):
    
    # 如果token最后四个元素是 < / w >
    if token[-4:] == '</w>':
        # 那就返回除了最后四个之外的长度再加上1(结尾)
        return len(token[:-4]) + 1
    else:
        # 如果这个token里面没有结尾就直接返回当前长度
        return len(token)
    
# 如果vocabulary里面找不到要拆分的词，就根据已经有的token现拆
def tokenize_word(string, sorted_tokens, unknown_token='</u>'):
    
    # base case，没词进来了，那拆的结果就是空的
    if string == '':
        return []
    # 已有的sorted tokens没有了，那就真的没这个词了
    if sorted_tokens == []:
        return [unknown_token] * len(string)

    # 记录拆分结果
    string_tokens = []
    
    # iterate over all tokens to find match
    for i in range(len(sorted_tokens)):
        token = sorted_tokens[i]
        
        # 自定义一个正则，然后要把token里面包含句号的变成[.]
        token_reg = re.escape(token.replace('.', '[.]'))
        
        # 在当前string里面遍历，找到每一个match token的开始和结束位置，比如string=good，然后token是o，输出[(2,2),(3,3)]?
        matched_positions = [(m.start(0), m.end(0)) for m in re.finditer(token_reg, string)]
        # if no match found in the string, go to next token
        if len(matched_positions) == 0:
            continue
        # 因为要拆分这个词，匹配上的token把这个word拆开了，那就要拿到除了match部分之外的substring，所以这里要拿match的start
        substring_end_positions = [matched_position[0] for matched_position in matched_positions]
        substring_start_position = 0
        
        
        # 如果有匹配成功的话，就会进入这个循环
        for substring_end_position in substring_end_positions:
            # slice for sub-word
            substring = string[substring_start_position:substring_end_position]
            # tokenize this sub-word with tokens remaining 接着用substring匹配剩余的sorted token，因为刚就匹配了一个
            string_tokens += tokenize_word(string=substring, sorted_tokens=sorted_tokens[i+1:], unknown_token=unknown_token)
            # 先把sorted token里面匹配上的记下来
            string_tokens += [token]
            substring_start_position = substring_end_position + len(token)
        # tokenize the remaining string 去除前头的substring，去除已经匹配上的，后面还剩下substring_start_pos到结束的一段substring没看
        remaining_substring = string[substring_start_position:]
        # 接着匹配
        string_tokens += tokenize_word(string=remaining_substring, sorted_tokens=sorted_tokens[i+1:], unknown_token=unknown_token)
        break
    else:
        # return list of unknown token if no match is found for the string
        string_tokens = [unknown_token] * len(string)
        
    return string_tokens

"""
该函数生成一个所有标记的列表，按其长度（第一键）和频率（第二键）排序。

EXAMPLE:
    token frequency dictionary before sorting: {'natural': 3, 'language':2, 'processing': 4, 'lecture': 4}
    sorted tokens: ['processing', 'language', 'lecture', 'natural']
    
INPUT:
    token_frequencies: Dict[str, int] # Counter for token frequency
    
OUTPUT:
    sorted_token: List[str] # Tokens sorted by length and frequency

"""
def sort_tokens(tokens_frequencies):
    # 对 token_frequencies里面的东西，先进行长度排序，再进行频次，sorted是从低到高所以要reverse
    sorted_tokens_tuple = sorted(tokens_frequencies.items(), key=lambda item:(measure_token_length(item[0]),item[1]), reverse=True)
    
    # 然后只要tokens不要频次
    sorted_tokens = [token for (token, freq) in sorted_tokens_tuple]

    return sorted_tokens

#display the vocab
tokens_frequencies, vocab_tokenization = get_tokens_from_vocab(vocab)

#sort tokens by length and frequency
sorted_tokens = sort_tokens(tokens_frequencies)
print("Tokens =", sorted_tokens, "\n")

#print("vocab tokenization: ", vocab_tokenization)

sentence_1 = 'I like natural language processing!'
sentence_2 = 'I like natural languaaage processing!'
sentence_list = [sentence_1, sentence_2]

for sentence in sentence_list:
    
    print('==========')
    print("Sentence =", sentence)
    
    for word in sentence.split():
        word = word + "</w>"

        print('Tokenizing word: {}...'.format(word))
        if word in vocab_tokenization:
            print(vocab_tokenization[word])
        else:
            print(tokenize_word(string=word, sorted_tokens=sorted_tokens, unknown_token='</u>'))
```

# 解码

解码则是将所有Token进行合并：

```python
# 编码序列
["the</w>", "high", "est</w>", "moun", "tain</w>"]

# 解码序列
"the</w> highest</w> mountain</w>"
```

# HuggingFace实现

HF提供了比较快捷的调用接口。

```python
from tokenizers import CharBPETokenizer

# Instantiate tokenizer
tokenizer = CharBPETokenizer()

tokenizer.train_from_iterator(
    corpus,
    vocab_size=17,
    min_frequency=2,
)
```

# 优点和缺点

优点：

BPE的优点前面已经提到，它比单词级别的分词表更细颗粒度，并一定程度保持了语义关系。并且也适用于一些未知的单词。

缺点：

BPE是基于统计的算法，如果语料规模小，效果不一定好。

2024/1/2 于苏州家中