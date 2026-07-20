---
title: "论QA问答系统发展史：从Text2Vec到LLM"
description: "问答系统的发展历史，如何实现不同方式的问答系统。"
pubDate: "2024-01-07 15:42:40"
---

周末在家刚好没事，看了一下问答系统的发展历史，在这里实现一下不同时期的QA系统。

# 文本嵌入+文本相似度

我们排开早期的按照规则实现的问答系统，最早被我们了解到的QA系统应该是通过文本嵌入+文本相似度实现的。

首先文本嵌入有多种实现方式，这里大致介绍一下：


文本嵌入是将文本转换为数值向量的过程，使得可以在这些向量之间进行相似性计算。以下是一些经典的文本嵌入模型：

1. TF-IDF（Term Frequency-Inverse Document Frequency）：
   - TF-IDF 是一种统计方法，用于评估一个词对于一个文档集或一个单独的文档的重要性。它基于词频（TF）和逆文档频率（IDF）的乘积来为每个词赋予权重。
2. Word2Vec：
   - Word2Vec 是一种基于神经网络的模型，用于学习词向量。它可以生成具有语义意义的密集向量，捕捉到词之间的上下文关系。
3. GloVe（Global Vectors for Word Representation）：
   - GloVe 是一个基于统计的模型，用于学习词向量。它结合了词共现矩阵的全局统计信息来生成词嵌入。
4. FastText：
   - FastText 是由 Facebook Research 开发的一个模型，它不仅可以生成词向量，还可以处理子词信息。这使得 FastText 在处理稀有词或者未见词时表现得更好。
5. BERT（Bidirectional Encoder Representations from Transformers）：
   - BERT 是一个基于 Transformer 架构的预训练模型，用于生成上下文感知的词嵌入。BERT 考虑了句子的双向信息，使得生成的嵌入可以捕获更丰富的语义信息。
6. ELMo（Embeddings from Language Models）：
   - ELMo 是另一个基于深度双向 LSTM 的模型，用于生成上下文感知的词嵌入。与传统的静态词嵌入不同，ELMo 为每个词生成多个嵌入向量，这些向量捕获了不同的上下文信息。

总之，这些模型的核心思想是通过各自算法将每个字符嵌入成高维向量，这样就可以计算不同文本之间的相似程度。

我们可以使用`sklearn`中的`TfidfVectorizer`实现一个简单的问答系统：

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# 示例的问题和答案数据
questions = [
    "什么是Python?",
    "Python有哪些优点?",
    "如何定义函数?",
    "Python的应用场景是什么?"
]

answers = [
    "Python是一种高级编程语言。",
    "Python有简单易读的语法、丰富的库和广泛的应用场景。",
    "在Python中，函数可以使用def关键字进行定义。",
    "Python在Web开发、数据分析、人工智能等多个领域有广泛的应用。"
]
```

我们有一些问题，以及一些对应的回答，将它们放在一个列表里。随后，我们使用`TfidfVectorizer`将这些问答向量化：

```python
# 使用TF-IDF向量化文本数据
vectorizer = TfidfVectorizer()
tfidf_matrix = vectorizer.fit_transform(questions + answers)

tfidf_matrix

>> <8x12 sparse matrix of type '<class 'numpy.float64'>'
	with 12 stored elements in Compressed Sparse Row format>
```

将问答对嵌入后，可以看到变成了一个8*12的稀疏矩阵。这代表这8句话被嵌入到12维向量。

现在我们准备一个问题，并转化为向量：

```python
user_question = "Python有哪些应用场景?"
user_question_vec = vectorizer.transform([user_question])

user_question_vec

>> <1x12 sparse matrix of type '<class 'numpy.float64'>'
	with 0 stored elements in Compressed Sparse Row format>
```

可以看到问题被转化为了向量，这时候就可以进行相似度搜索了：

```python
similarities = cosine_similarity(user_question_vec, tfidf_matrix)[0]
most_similar_idx = np.argmax(similarities)

answers[most_similar_idx]

>> 'Python是一种高级编程语言。'
```

我们可以简单写成函数来实现这个问答：

```python
def get_most_similar_question(user_question,tfidf_matrix):
    # 首先将输入问题向量化
    user_question_vec = vectorizer.transform([user_question])
    # 计算相似度
    similarities = cosine_similarity(user_question_vec,tfidf_matrix)[0]
    print(similarities)
    most_similar_idx = np.argmax(similarities)
    return answers[most_similar_idx]

# 用户输入问题
user_input = "什么是Python?"

# 获取最相似的问题和答案
most_similar_question = get_most_similar_question(user_input, questions, tfidf_matrix)

print(f"对应的答案是：{corresponding_answer}")

>> [1. 0. 0. 0. 0. 0. 0. 0.]
>> 对应的答案是：Python是一种高级编程语言。
```

由于question/answer和TF-IDF矩阵都是一开始就准备好的，这个函数里只需要输入问题和准备好的稀疏矩阵就可以了。可以看到，他从矩阵中找到相似度最高的问题，对应回答中相同的index即是期望看到的回答。

## 特点

这是最早的QA系统实现手段之一。实现简单易懂，原理也并不复杂。然而它有很多不足，首先，它需要提前准备大量的问答对，以适应不同领域的各个问题，其次对于不同的提问形式，它很难给出精准准确的回答。

本质上，作为基于统计的方法，它本质上并没有理解问题的语义，只是找了一个最像的问答对作为回答。

#  语言模型嵌入

TF-IDF使用了基于统计的文本嵌入方式，后续随着NLP的发展，又出现了语言模型。这时候已经能通过语言模型将文本嵌入为更高维的输入了，一定程度上也能够理解语义。

使用Text2Vec进行了实现，它核心使用了transformers库的text2vec-base-chinese嵌入模型：

```python
from text2vec import SentenceModel, cos_sim, semantic_search

# 使用了transformers库的text2vec-base-chinese嵌入模型
embedder = SentenceModel()

# 语料样本库
corpus = [
    '花呗更改绑定银行卡',
    '我什么时候开通了花呗',
    'A man is eating food.',
    'A man is eating a piece of bread.',
    'The girl is carrying a baby.',
    'A man is riding a horse.',
    'A woman is playing violin.',
    'Two men pushed carts through the woods.',
    'A man is riding a white horse on an enclosed ground.',
    'A monkey is playing drums.',
    'A cheetah is running behind its prey.'
]

# 将语料进行嵌入
corpus_embeddings = embedder.encode(corpus)
corpus_embeddings
```

得到的嵌入数据如下：

```python
array([[ 6.53620958e-01, -7.66664222e-02,  9.59622979e-01, ...,
        -6.01225317e-01, -1.67934457e-03,  2.14576736e-01],
       [ 6.70483976e-04, -4.66219693e-01,  8.83835256e-01, ...,
        -6.52768135e-01, -2.59505898e-01, -4.05015022e-01],
       [-6.99393526e-02, -4.93847728e-01,  3.72701913e-01, ...,
         2.30209693e-01, -6.62487626e-01, -1.37236178e-01],
       ...,
       [ 4.95887578e-01, -1.03028201e-01,  1.88396394e-01, ...,
         1.14771016e-01, -1.29482400e+00,  9.49718833e-01],
       [ 5.01094282e-01, -4.13963169e-01, -1.61480501e-01, ...,
         3.57740372e-03, -1.32486129e+00,  3.83615524e-01],
       [-1.52376592e-02,  2.37213261e-02,  4.10200447e-01, ...,
        -2.21184328e-01, -9.90046620e-01, -3.17562759e-01]], dtype=float32)
```

在嵌入之后，得到了一个高维矩阵。我们再准备一些问题：

```python
queries = [
    '如何更换花呗绑定银行卡',
    'A man is eating pasta.',
    'Someone in a gorilla costume is playing a set of drums.',
    'A cheetah chases prey on across a field.']
```

随后我们对其进行遍历以得到回答：

```python
for query in queries:
    query_embedding = embedder.encode(query)
    hits = semantic_search(query_embedding, corpus_embeddings, top_k=3)
    print("\n\n======================\n\n")
    print("Query:", query)
    print("\n语料中最相似的三个回答：")
    hits = hits[0]  
    for hit in hits:
        print(corpus[hit['corpus_id']], "(Score: {:.4f})".format(hit['score']))
```

回答如下：

```python
======================
Query: 如何更换花呗绑定银行卡

语料中最相似的三个回答：
花呗更改绑定银行卡 (Score: 0.8551)
我什么时候开通了花呗 (Score: 0.7212)
A man is eating food. (Score: 0.3118)
======================
Query: A man is eating pasta.

语料中最相似的三个回答：
A man is eating food. (Score: 0.7840)
A man is riding a white horse on an enclosed ground. (Score: 0.6906)
A man is eating a piece of bread. (Score: 0.6831)
======================
Query: Someone in a gorilla costume is playing a set of drums.

语料中最相似的三个回答：
A monkey is playing drums. (Score: 0.6758)
A man is riding a white horse on an enclosed ground. (Score: 0.6351)
The girl is carrying a baby. (Score: 0.5438)
======================
Query: A cheetah chases prey on across a field.

语料中最相似的三个回答：
A cheetah is running behind its prey. (Score: 0.6736)
A man is riding a white horse on an enclosed ground. (Score: 0.5731)
A monkey is playing drums. (Score: 0.4977)
```

同样的，Bert语言模型在一定程度上是这个模型的进一步扩展，这里先按下不表。

## 特点

在一定程度上，这种语言模型只是对传统基于统计的嵌入方式进行了改良，本质检索上并没有脱离相似度的桎梏。当然，后续Bert等语言模型能够进行文本分类，文本续写等任务，但是在问答任务上仍然不是一个很好的解决方案。

# 大语言模型

在大语言模型问世后，基于文本相似度的问答系统一时间被打入冷宫。通过在大量问题语料上进行训练，语言模型能够在输入一个问题时，输出最符合训练语料和语义的回答。这对于之前是一个巨大的跨越。

通过AzureOpenAI进行了简单的调用：

```python
from langchain.chat_models import AzureChatOpenAI

llm = AzureChatOpenAI(
                        azure_endpoint=XXXXX,
                        openai_api_version=XXXXX,
                        deployment_name=XXXXX,
                        temperature=XXXXX,
                        openai_api_key=XXXXX,
                        openai_api_type=XXXXX,
                        streaming=XXXXX)

llm.predict('Python是什么？')

>> 'Python是一种高级编程语言，由Guido van Rossum于1989年开发。它具有简洁、易读、易学的特点，被广泛应用于软件开发、数据分析、人工智能等领域。Python具有丰富的标准库和第三方库，可以用于开发各种类型的应用程序。它支持面向对象编程、函数式编程和过程式编程等多种编程范式。Python的语法简洁明了，代码可读性强，因此被称为“优雅的编程语言”。'
```

## 特点

大语言模型经过了上亿问答语料的学习，它能够通过学到过的内容，找到最符合人类逻辑的下一个输出。由于问题是对Python的询问，它从上文中找到了最有可能出现的回答，并以人类能够理解的方式进行输出。

然而，由于生成语言模型以生成符合语义的句子为目的，因此它无法判断输出的内容是否准确，这也是它目前备受诟病的缺陷之一。

# 基于RAG的大语言模型QA系统

前面提到基于统计的检索方法并不能以符合语义的方式输出回答，而是调用原文。那么现在我们有了会说人话的大语言模型，能不能将它们结合在一起呢？

基于这个思想，出现了RAG（检索增强生成）。通过结合输入问题和检索到的相关内容，大语言模型将得到的内容进行包装，使得其能够输出合理的，符合语义的回答。

通过Langchain和ChromaDB进行了简单的实现：

```python
from langchain.embeddings import SentenceTransformerEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import Chroma
from langchain.document_loaders import TextLoader

# 从本地导入语料
loader = TextLoader('state_of_the_union.txt')
documents = loader.load()

# 将文本进行切块
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
docs = text_splitter.split_documents(documents)

# 将语料嵌入后存入向量数据库
embeddings = SentenceTransformerEmbeddings()
db = Chroma.from_documents(docs, embeddings)
 
```

首先，我们可以看一下简单的相似度搜索会得到什么样的回答：

```python
query = "What did the president say about Ketanji Brown Jackson"
docs = db.similarity_search(query)
print(docs[0].page_content)

>> Tonight. I call on the Senate to: Pass the Freedom to Vote Act. Pass the John Lewis Voting Rights Act. And while you’re at it, pass the Disclose Act so Americans can know who is funding our elections. 
```

可以看到，基于相似度搜索只返回了原文中相似的部分。

同样也可以看一下得分：

```python
docs = db.similarity_search_with_score(query)
docs[0]

>> (Document(page_content='Tonight. I call on the Senate to: Pass the Freedom to Vote Act. Pass the John Lewis Voting Rights Act. And while you’re at it, pass the Disclose Act so Americans can know who is funding our elections. \n\nTonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service. \n\nOne of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court. \n\nAnd I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence.', metadata={'source': 'state_of_the_union.txt'}),
 1.2032095193862915)
```

现在，我们引入大语言模型，让它理解问题和原文内容，并包装出合理的回答。

```python
from langchain.prompts import ChatPromptTemplate

template = """You are an assistant for question-answering tasks.
Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know.
Use three sentences maximum and keep the answer concise.
Question: {question}
Context: {context}
Answer:
"""
prompt = ChatPromptTemplate.from_template(template)
```

在设定好输入提示词模板后，我们可以构建一个思维链。在这个链之中，内容是一个检索器，问题是一个可执行的输入，这两个东西被填入提示词模板后，交给大语言模型，并规定输出的格式是字符串：

```python
from langchain.schema.runnable import RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser

rag_chain = (
    {"context": retriever,  "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

query = "What did the president say about Justice Breyer"
rag_chain.invoke(query)

>> The president thanked Justice Stephen Breyer for his service and acknowledged his dedication to serving the country.\n
```

可以看到，输出的回答更符合人类的理解。

## 持久化

最后，我们可以将输入的文本向量持久化在数据库中：

```python
vectordb = Chroma.from_documents(documents=documents, embedding=embeddings, persist_directory='db')
vectordb.persist()
vectordb = None
```

在调用时如下操作：

```python
vectordb = Chroma(persist_directory='db', embedding_function=embeddings)
retriever = db.as_retriever(search_type="mmr")
retriever.get_relevant_documents(query)[0]
```

2024/1/7 于苏州家中

