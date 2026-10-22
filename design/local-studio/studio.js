const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  file:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  thought:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z M7 10h9 M7 14h6',
  image:'M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4 M15 7h.01',
  blocks:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 14v7 M14 17.5h7',
  translate:'M3 5h11 M8 3v2 M5 5c0 6 7 9 7 9 M12 5c0 6-4 9-9 10 M14 21l4-10 4 10 M15.5 17h5',
  eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  settings:'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',
  plus:'M12 4v16 M4 12h16', upload:'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
  arrow:'M5 12h14 M14 7l5 5-5 5', left:'M14 6l-6 6 6 6',right:'M10 6l6 6-6 6',
  chevron:'M6 9l6 6 6-6',more:'M5 12h.01 M12 12h.01 M19 12h.01',
  folder:'M3 6V4h6l2 3h10v13H3z',check:'M5 13l4 4L19 7',close:'m6 6 12 12M18 6 6 18',
  spark:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  desktop:'M2 3h20v14H2z M8 21h8 M12 17v4',mobile:'M7 2h10v20H7z M11 18h2',
  moon:'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  sun:'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2',
  undo:'M3 10h11a6 6 0 0 1 0 12 M8 5l-5 5 5 5',
  code:'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
  filter:'M3 6h18 M6 12h12 M9 18h6',download:'M12 3v13 M7 11l5 5 5-5 M4 19v3h16v-3',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const btn = (label, action, name, style = '') => `<button class="btn ${style}" data-action="${action}">${name ? icon(name) : ''}${label}</button>`;
const tag = (text, style = '', dot = false) => `<span class="tag ${style}">${dot ? '<span class="status-dot"></span>' : ''}${text}</span>`;
const sampleTitle = '多端同步与ui设计：言录近期的开发记录';
const seedBody = `## 从一个小问题开始\n\n最近在做言录的多端同步。我希望它足够简单，让记录这件事重新变得轻松。\n\n真正困难的不是增加功能，而是让不同设备上的体验保持一致。每一次取舍，都是一次对产品的重新理解。\n\n## 让设计跟着内容走\n\n写作工具应该安静一点。减少干扰，把注意力留给正在发生的想法。\n\n> 好的设计，是让复杂的事情看起来简单。\n\n这是一个设计稿示例。你可以修改正文、插入组件，再查看排版预览。`;
let entries = [
  {id:1,title:sampleTitle,desc:'关于同步、界面，以及那些藏在细节里的产品选择。',date:'2026.10.22',status:'待修改',en:false,format:'md'},
  {id:2,title:'大模型补课：传统llm到reasoning model',desc:'从语言模型到推理模型的演进',date:'2026.10.18',status:'已收录',en:true,format:'mdx'},
  {id:3,title:'生成式推荐：rq-vae',desc:'理解离散语义标识背后的设计',date:'2026.10.12',status:'已收录',en:true,format:'md'},
  {id:4,title:'漫谈推荐系统：pepnet与embedding个性化的多任务学习',desc:'把个性化引入多任务建模',date:'2026.10.05',status:'已收录',en:false,format:'md'},
  {id:5,title:'重读统计学习方法：gdbt及其改进',desc:'重新理解梯度提升树',date:'2026.09.28',status:'待修改',en:false,format:'md'},
  {id:6,title:'python并发编程：多线程实现',desc:'工程实践中的并发与取舍',date:'2026.09.21',status:'已收录',en:true,format:'md'},
  {id:7,title:'写在2023的最后一天',desc:'一些生活的片段',date:'2026.09.15',status:'已收录',en:true,format:'md'},
];
let thoughts = [
  {id:101,date:'2026.10.22 · 10:54',category:'产品',body:'做产品久了，越来越觉得，克制比创造更难。不是每一个想法都需要变成一个功能，有时候把一件小事做顺，就已经很好了。',en:false},
  {id:102,date:'2026.10.18 · 21:30',category:'随笔',body:'给自己留一点没有安排的时间。散步的时候不听播客，吃饭的时候不看屏幕，让注意力重新回到生活里。',en:true},
  {id:103,date:'2026.10.15 · 09:12',category:'工程',body:'代码不是越少越好，而是每一行都能回答：为什么我需要在这里？',en:true},
  {id:104,date:'2026.10.10 · 18:45',category:'学习',body:'理解一个概念最好的方式，是试着用自己的话，把它讲给昨天的自己。',en:false},
];
let current = {...entries[0], body:seedBody};
let writingDraft = current;
let trash = [];
let selected = new Set();
let listFilter = 'all';
let listQuery = '';
let sortDescending = true;
let formatFilter = 'all';
let editMode = 'source';
let saved = true;
let selectedComponent = 'Highlight';
let mediaFolder = 'all';
let translating = false;
let translated = false;
let translationError = false;
let translationText = 'The hard part is not adding features, but keeping the experience consistent across devices. Every trade-off becomes a chance to understand the product again.\n\nWriting tools should be quieter. Reduce the distractions, and leave room for the thoughts taking shape.\n\nGood design makes complex things feel simple.';
let previewMobile = false;
let previewDark = false;
let thoughtEditing = null;
let noticeTimer;
let serial = 200;
const imageBase = '/site/_posts/ai浪潮下的产品实践：言录的开发实录/';
let media = [
  {id:1,name:'20260821-1.png',src:imageBase+'20260821-1.png',size:'项目原图',folder:'言录的开发实录',refs:2},
  {id:2,name:'20260821-4.png',src:imageBase+'20260821-4.png',size:'项目原图',folder:'言录的开发实录',refs:1},
  {id:3,name:'20260725-13.png',src:imageBase+'20260725-13.png',size:'项目原图',folder:'言录的开发实录',refs:1},
];
const components = [
  {name:'Highlight',label:'文字高亮',desc:'为关键观点留一点颜色',ready:true,stage:'<div class="mark-demo">把注意力留给<br><mark>真正重要的事。</mark></div>'},
  {name:'Sidenote',label:'页边注释',desc:'补充说明，不打断阅读',ready:true,stage:'<div class="sidenote-demo"><span>让文字保持<br>自己的节奏。<sup>1</sup></span><span>1: 把额外的想法放在页边，留给愿意多读一点的人。</span></div>'},
  {name:'RevealQuote',label:'揭示引言',desc:'点击展开一段隐藏的观点',ready:true,stage:'<div class="reveal-demo">好的设计，是<br><span>让复杂变得简单</span></div>'},
  {name:'DecisionToggle',label:'决策切换',desc:'在两个观点之间切换比较',ready:false,stage:'<div class="mini-toggle"><span>看到结果</span><span>理解原因</span></div>'},
  {name:'FlipCards',label:'翻转卡片',desc:'卡片正面是结果，背面是原因',ready:false,stage:'<div class="mini-cards"><span>what happened<br><br>看见结果</span><span>the reason why<br><br>理解原因</span></div>'},
  {name:'EnergyMeter',label:'能量刻度',desc:'用交互呈现变化与反馈',ready:false,stage:'<div class="mini-energy"><span class="muted">今天，你的能量还有多少？</span><div></div></div>'},
  {name:'DecisionForm',label:'决策表单',desc:'结构化呈现一段决策过程',ready:false,stage:'<div class="mini-energy"><span class="muted">你会如何做这个决定？</span><div></div></div>'},
  {name:'AgentSimulation',label:'智能体模拟',desc:'观察一组智能体如何协作',ready:false,stage:'<div class="mini-toggle"><span>输入</span><span>协作</span><span>输出</span></div>'},
  {name:'CommitCompare',label:'提交对比',desc:'对照理解一次代码变化',ready:false,stage:'<div class="mini-cards"><span>before<br><br>旧的实现</span><span>after<br><br>新的思路</span></div>'},
];

const navigation = [
  ['writing','file','博文','content-nav'],['thoughts','thought','thoughts','content-nav'],['media','image','图片资源','content-nav'],
  ['components','blocks','组件库','workspace-nav'],['translations','translate','翻译工作台','workspace-nav'],['preview','eye','本地预览','workspace-nav'],
];
for (const [route, glyph, label, target] of navigation) {
  $('#'+target).insertAdjacentHTML('beforeend',`<a class="nav-item" href="#${route}" data-nav="${route}" title="${label}">${icon(glyph)}${label}${route==='writing'?'<span class="nav-count" id="writing-count">7</span>':route==='thoughts'?'<span class="nav-count" id="thought-count">4</span>':''}</a>`);
}
$$('[data-icon]').forEach(el => el.innerHTML=icon(el.dataset.icon));
const labels = {collections:'collections',writing:'博文',editor:'博文 / 编辑',thoughts:'thoughts',media:'图片资源',components:'组件库',translations:'翻译工作台',preview:'本地预览',settings:'设置',trash:'回收站'};
const route = () => location.hash.slice(1).split('?')[0] || 'collections';
function navigate(to) {
  if(route()===to) render();
  else location.hash = to;
}
function toast(message) {
  clearTimeout(noticeTimer);
  $('#toast').textContent=message;
  $('#toast').classList.add('show');
  noticeTimer=setTimeout(()=>$('#toast').classList.remove('show'),3600);
}
function head(title,description,actions='') {
  return `<div class="page-head"><div><h1>${title}</h1><p>${description}</p></div><div class="head-actions">${actions}</div></div>`;
}
function renderCollections() {
  const collections=[['writing','博文',entries.length+' documents'],['thoughts','thoughts',thoughts.length+' documents'],['media','图片资源',media.length+' assets']];
  const tools=[['components','组件库','9 components'],['translations','翻译工作台','zh → en'],['preview','本地预览','desktop / mobile'],['settings','设置','workspace settings']];
  const tiles=items=>items.map(([page,label,count])=>`<a class="collection-tile" href="#${page}"><h2>${label}</h2><span class="collection-count">${count}</span><span class="collection-plus">${icon('plus')}</span></a>`).join('');
  return head('collections','')+`<div class="collection-grid">${tiles(collections)}</div><h2 class="collection-heading">tools</h2><div class="collection-grid">${tiles(tools)}</div><div class="workspace-status"><span>zerolovesea.top</span><span>本地文件工作空间 · 演示</span></div>`;
}
function counts() {
  $('#writing-count').textContent=entries.length;
  $('#thought-count').textContent=thoughts.length;
  $('#trash-count').textContent=trash.length;
}
function openEntry(id) {
  const entry=entries.find(item=>item.id===id);
  if(!entry) return;
  if(current.id!==id) current={...entry,body:entry.body||seedBody};
  saved=true;
  navigate('editor');
}
function renderWriting() {
  const rows=entries.filter(item=>(listFilter==='all'||(listFilter==='dirty'&&item.status==='待修改')||(listFilter==='translate'&&!item.en))&&item.title.toLowerCase().includes(listQuery.toLowerCase())&&(formatFilter==='all'||item.format===formatFilter)).sort((a,b)=>sortDescending?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  return head('博文','管理 writing 集合中的 markdown 与 mdx 文件。',btn('导入','import','upload')+btn('新建','new-post','plus','primary'))+
  `<div class="list-meta"><span>${entries.length} documents</span><span>${entries.filter(x=>x.en).length} 个英文版本</span><span>${entries.filter(x=>!x.en).length} 篇待翻译</span></div>
  <div class="tabs-row"><div class="tabs">${[['all','全部内容',entries.length],['dirty','待修改',entries.filter(x=>x.status==='待修改').length],['translate','待翻译',entries.filter(x=>!x.en).length]].map(([value,label,count])=>`<button class="tab ${listFilter===value?'active':''}" data-filter="${value}">${label}<span>${count}</span></button>`).join('')}</div><div class="filter-tools"><label class="searchbox">${icon('search')}<input id="list-search" aria-label="搜索博文" placeholder="搜索博文…" value="${escape(listQuery)}"></label><select class="btn sm" id="format-filter" aria-label="文件类型"><option value="all">全部格式</option><option value="md" ${formatFilter==='md'?'selected':''}>md</option><option value="mdx" ${formatFilter==='mdx'?'selected':''}>mdx</option></select><button class="btn sm" data-action="sort">${icon('filter')}日期 ${sortDescending?'↓':'↑'}</button></div></div>
  ${selected.size?`<div class="bulkbar"><span>已选择 ${selected.size} 篇</span><span class="spacer"></span>${btn('翻译','bulk-translate','translate','sm')}${btn('移至回收站','bulk-delete','trash','sm')}${btn('取消选择','clear-select','','sm ghost')}</div>`:''}
  <div class="responsive-note">左右滑动表格可查看全部字段。</div>
  ${rows.length?`<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="select-all" aria-label="选择当前列表所有博文" ${rows.every(item=>selected.has(item.id))?'checked':''}></th><th>标题</th><th>状态</th><th>语言</th><th>发布日期</th><th>格式</th><th><span class="muted">操作</span></th></tr></thead><tbody>${rows.map(item=>`<tr><td><input type="checkbox" data-select="${item.id}" aria-label="选择 ${escape(item.title)}" ${selected.has(item.id)?'checked':''}></td><td><button class="content-title" data-edit="${item.id}"><span class="file-icon">${icon('file')}</span><span><strong>${escape(item.title)}</strong><small>writing / ${item.id===1?'随手记录':'学习与思考'}</small></span></button></td><td>${tag(item.status,item.status==='待修改'?'warm':'',true)}</td><td><span class="lang"><span>中</span><span class="${item.en?'':'missing'}">en</span></span></td><td class="muted">${item.date}</td><td>${tag(item.format,'muted-tag')}</td><td><button class="row-menu" data-entry-menu="${item.id}" aria-label="管理 ${escape(item.title)}">${icon('more')}</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${icon('search')}<h2>这里暂时没有博文</h2><p>试试其他搜索词，或创建你的第一篇内容。</p>${btn('清除筛选','reset-filter','','sm')}</div>`}
  <div class="table-footer"><span>显示 ${rows.length} 篇 · 本页日期和状态均为设计示例</span><div class="pagination"><button aria-label="上一页" disabled>${icon('left')}</button><span>1 / 1</span><button aria-label="下一页" disabled>${icon('right')}</button></div></div>
  <div class="collection-help"><span>src/content/writing/</span><button data-action="go-components">插入 mdx 组件 ${icon('arrow')}</button></div>`;
}

function renderEditor() {
  return head(current.title?'编辑博文':'新建博文','writing / '+(current.title||'untitled')+'.'+current.format,btn('返回列表','go-writing','left')+btn('预览','go-preview','eye')+btn('保存','save','check','primary'))+
  `<div class="split-layout"><div><div class="paper"><div class="paper-toolbar"><div class="segmented"><button data-edit-mode="source" class="${editMode==='source'?'active':''}">markdown</button><button data-edit-mode="read" class="${editMode==='read'?'active':''}">排版预览</button></div><span id="save-status">${saved?'当前内容已载入 · 演示':'有未保存修改 · 演示'}</span></div><div class="editor-body"><textarea class="editor-title" id="post-title" aria-label="博文标题" placeholder="给这篇文字一个标题">${escape(current.title)}</textarea><textarea class="editor-description" id="post-description" aria-label="博文摘要" placeholder="添加一段简短的摘要…">${escape(current.desc)}</textarea><div class="format-toolbar"><button data-format="heading" aria-label="插入标题">h₂</button><button data-format="bold" aria-label="加粗"><b>b</b></button><button data-format="italic" aria-label="斜体"><i>i</i></button><button data-format="quote" aria-label="引用">“</button><span class="separator"></span><button data-format="link" aria-label="插入链接">${icon('link')}</button><button data-action="upload-image" aria-label="上传图片">${icon('image')}</button><button data-format="code" aria-label="代码块">${icon('code')}</button><span class="separator"></span><button data-action="insert-component" class="btn ghost sm">${icon('blocks')}插入组件</button></div>${editMode==='source'?`<textarea class="source-editor" id="post-body" spellcheck="false" aria-label="markdown 正文">${escape(current.body)}</textarea>`:`<div class="reading-preview">${renderBody(current.body)}</div>`}</div><div class="editor-foot"><span id="editor-file">writing / ${escape(current.title||'未命名')}.${current.format}</span><span>${current.body.length} 字符 · zh-cn</span></div></div><p class="mode-note">${editMode==='source'?'输入正文或插入组件，体验源文件编辑流程。':'此处演示排版；正式版本将调用项目实际渲染器。'}</p></div>
  <aside><section class="side-section"><h3>文档属性 ${tag(current.format,'muted-tag')}</h3><label class="field"><span>发布日期</span><input type="date" id="post-date" value="${current.date.replaceAll('.','-')}"></label><label class="field"><span>文件位置</span><div class="path">src/content/writing/<br>${escape(current.title||'未命名')}.${current.format}</div></label><label class="field"><span>内容状态</span><select id="post-status"><option ${current.status==='待修改'?'selected':''}>待修改</option><option ${current.status==='已收录'?'selected':''}>已收录</option></select><small>站点尚无草稿字段，正式版以独立草稿区隔离。</small></label></section><section class="side-section"><h3>封面图片</h3><button class="cover-upload" data-action="upload-image">${current.cover?`<img src="${escape(current.cover)}" alt="示例封面">`:icon('image')+'<span>选择或拖入一张图片</span><small>点击选择 · 仅浏览器演示</small>'}</button><p class="path section-space">public/_posts/${escape(current.title||'未命名')}/</p></section><section class="side-section"><h3>语言版本</h3><div class="upload-row"><span>简体中文</span>${tag('原文')}</div><div class="upload-row"><span>english</span>${tag(current.en?'已有译文':'尚未翻译',current.en?'':'warm')}</div><button class="side-action" data-action="go-translations">${icon('spark')}打开翻译工作台 ${icon('arrow')}</button></section><section class="side-section"><h3>文档操作</h3><button class="side-action" data-action="history">${icon('clock')}版本与恢复</button><button class="side-action danger-text" data-action="delete-current">${icon('trash')}移至回收站</button></section><div class="notice">保存只影响本地文件。发布到线上是独立操作，不与保存合并。</div></aside></div>`;
}

function renderBody(body) {
  // shortcut: this is a safe layout demonstration, replace with Astro rendering in the functional app.
  return body.split(/\n\s*\n/).map(part=>{
    if(part.startsWith('import ')) return '';
    if(part.startsWith('## ')) return `<h2>${escape(part.slice(3))}</h2>`;
    if(part.startsWith('> ')) return `<blockquote>${escape(part.slice(2))}</blockquote>`;
    if(part.startsWith('<')) return `<div class="block-preview">${icon('blocks')} mdx 组件占位 · 正式预览渲染真实组件</div>`;
    return `<p>${escape(part).replaceAll('\n','<br>')}</p>`;
  }).join('');
}

function renderThoughts() {
  return head('thoughts','管理短内容、分类与语言版本。',btn('导入','import','upload')+btn('新建','focus-thought','plus','primary'))+
  `<div class="thought-layout"><div><div class="tabs-row"><span class="muted">全部想法 · ${thoughts.length} 条示例</span><span class="tag muted-tag">按时间倒序</span></div><div class="thought-feed">${thoughts.length?thoughts.map(item=>`<article class="thought-entry"><div class="thought-meta"><span class="avatar"><img src="/site/favicon-96x96.png" alt="yang zhou"></span><span>${item.date}</span>${tag(item.category,item.category==='产品'?'':'muted-tag')}<span class="lang"><span>中</span><span class="${item.en?'':'missing'}">en</span></span></div><p>${escape(item.body)}</p><div class="thought-actions"><button data-thought-edit="${item.id}">编辑</button><button data-thought-translate="${item.id}">翻译</button><button data-thought-preview="${item.id}">预览</button><button data-thought-delete="${item.id}" aria-label="删除这条想法">${icon('trash')}</button></div></article>`).join(''):'<div class="empty"><h2>从一个小想法开始</h2><p>右侧写下今天值得记住的片段。</p></div>'}</div></div><aside class="thought-compose"><h3>${thoughtEditing?'编辑这条想法':'此刻，在想什么？'}</h3><textarea id="thought-body" placeholder="无需一篇长文，几句话就好。">${escape(thoughtEditing?.body||'')}</textarea><div class="compose-footer"><select class="form-select" id="thought-category" aria-label="想法分类">${['随笔','产品','工程','学习','ai','设计'].map(x=>`<option ${thoughtEditing?.category===x?'selected':''}>${x}</option>`).join('')}</select>${btn(thoughtEditing?'保存修改':'保存想法','save-thought','check','primary sm')}</div><div class="format-toolbar"><button data-action="upload-thought-image" aria-label="上传想法图片">${icon('image')}</button><button data-action="thought-component" aria-label="为想法插入组件">${icon('blocks')}</button><span class="muted" style="margin-left:auto">markdown / mdx</span></div><div class="notice">${thoughtEditing?'保存后更新同一条记录。':'新想法将按日期命名。'}<div class="path">src/content/thought/<br>2026-10-22-10-54.md</div></div><p class="mode-note">示例文字仅用于设计展示，不代表站点真实内容。</p></aside></div>`;
}

function renderMedia() {
  const rows=media.filter(item=>mediaFolder==='all'||item.folder===mediaFolder);
  return head('图片资源','管理图片、内容关联与引用路径。',btn('上传','upload-image','upload','primary'))+
  `<div class="media-layout"><aside class="folder-list"><h3>按内容归档</h3>${['all','言录的开发实录',current.title,'thoughts'].filter((x,i,a)=>a.indexOf(x)===i).map(x=>`<button class="folder ${mediaFolder===x?'active':''}" data-folder="${escape(x)}">${icon('folder')}<span>${x==='all'?'全部图片':escape(x)}</span></button>`).join('')}</aside><div><div class="tabs-row"><span class="muted">${mediaFolder==='all'?'全部图片':escape(mediaFolder)} · ${rows.length} 张</span><span class="muted">点击图片查看引用与路径</span></div>${rows.length?`<div class="media-grid">${rows.map(item=>`<button class="media-card" data-media="${item.id}"><img src="${escape(item.src)}" alt="${escape(item.name)}" loading="lazy"><div class="media-info"><strong>${escape(item.name)}</strong><small>${item.size} <span class="footer-dot">·</span> ${item.refs?'引用 '+item.refs+' 次':'待插入'}</small></div></button>`).join('')}</div>`:`<div class="empty">${icon('image')}<h2>这个目录还没有图片</h2><p>上传后将根据关联的博文或想法自动归档。</p></div>`}<button class="drop-zone button-full" id="drop-zone" data-action="upload-image">${icon('upload')}<strong>拖入图片，剩下的交给工作空间。</strong><p>或点击选择 · png / jpg / webp / gif · 每张不超过 20 mb</p><p>当前目标：${mediaFolder==='thoughts'?'public/_thoughts/&lt;想法文件名&gt;/':'public/_posts/'+escape(mediaFolder==='all'?current.title:mediaFolder)+'/'}</p></button><div class="notice section-space">博文使用现有 _posts 目录。thought 图片拟新增 _thoughts 目录；中英文共用一份资源。</div></div></div>`;
}

function renderComponents() {
  const active=components.find(x=>x.name===selectedComponent);
  return head('组件库','选择组件并配置内容，插入时自动转换为 mdx。',btn('返回编辑器','go-editor','left'))+
  `<div class="tabs-row"><span class="muted">全部组件 · 9 个交互组件</span><span class="tag muted-tag">另有 2 个 cta，见设计说明</span></div><div class="component-layout"><div class="component-grid">${components.map(item=>`<button class="component-card ${selectedComponent===item.name?'selected':''}" data-component="${item.name}"><div class="component-stage">${item.stage}</div><div class="component-info"><h3>${item.label}${tag(item.ready?'可配置':'需参数化',item.ready?'':'muted-tag')}</h3><p>${item.name.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()} · ${item.desc}</p></div></button>`).join('')}</div><aside class="component-inspector"><h3>${active.label}</h3><p class="muted">${active.name} · ${active.ready?'已有公开参数或内容插槽':'现有组件包含固定示例内容'}</p>${componentFields(active)}<div class="code-box" id="component-code">${escape(componentSnippet())}</div>${active.ready?`<div class="notice">插入时自动添加 import，并将 <strong>.md → .mdx</strong>。文件名和内容关联保持一致。</div>`:`<div class="notice warm">正式接入前需为该组件开放内容参数。本稿可演示引用插入，不承诺现有固定内容可编辑。</div>`}${btn('插入当前文档','insert-selected','plus','primary button-full section-space')}<p class="mode-note">示意图用于表达形态，不是组件真实渲染结果。</p></aside></div>`;
}

function componentFields(item) {
  if(item.name==='Highlight') return `<label class="field"><span>高亮文字</span><input id="component-text" value="把注意力留给真正重要的事。"></label><label class="field"><span>颜色</span><select id="component-color"><option value="yellow">柔和黄</option><option value="green">草木绿</option><option value="pink">浅粉</option><option value="blue">雾蓝</option></select></label>`;
  if(item.name==='Sidenote') return '<label class="field"><span>注释编号</span><input id="component-id" value="1"></label><label class="field"><span>注释内容</span><textarea id="component-text">一个不打断阅读的补充说明。</textarea></label>';
  if(item.name==='RevealQuote') return '<label class="field"><span>显示文字</span><input id="component-visible" value="好的设计，是"></label><label class="field"><span>隐藏文字</span><input id="component-text" value="让复杂的事情看起来简单。"></label>';
  return '<p class="muted">先将组件作为整体插入。后续参数化后再开放内容、样式与行为配置。</p>';
}
function componentSnippet() {
  const text=$('#component-text')?.value||'把注意力留给真正重要的事。';
  const jsxText = value => `{${JSON.stringify(value)}}`;
  if(selectedComponent==='Highlight') return `<Highlight color="${$('#component-color')?.value||'yellow'}">${jsxText(text)}</Highlight>`;
  if(selectedComponent==='Sidenote') return `<Sidenote id={${JSON.stringify($('#component-id')?.value||'1')}}>${jsxText(text)}</Sidenote>`;
  if(selectedComponent==='RevealQuote') return `<RevealQuote teaser={${JSON.stringify($('#component-visible')?.value||'好的设计，是')}} quote={${JSON.stringify(text)}} />`;
  return `<${selectedComponent} />`;
}
function addComponent(name,snippet) {
  let body=current.body;
  const importStatement=`import { ${name} } from "@components/interactive";`;
  // shortcut: isolated prototype body has no frontmatter, production must parse frontmatter and imports before conversion.
  if(!body.includes(importStatement)) body=importStatement+'\n\n'+body;
  current.body=body+'\n\n'+snippet+'\n';
  const changed=current.format==='md';
  current.format='mdx';
  saved=false;
  navigate('editor');
  toast(changed?'已演示插入组件、补充 import 与 .md → .mdx 转换':'已演示插入组件，当前文档为 mdx');
}

function translationSource() {
  return current.kind==='thought'?current.body:current.body;
}
function renderTranslations() {
  return head('翻译工作台','对照审核原文与英文版本。',btn('返回编辑器',current.kind==='thought'?'go-thoughts':'go-editor','left'))+
  `<div class="translation-controls"><label class="field"><span>当前内容</span><select id="translation-document"><option value="current">${escape(current.title)}</option>${entries.filter(x=>x.id!==current.id).map(x=>`<option value="${x.id}">${escape(x.title)}</option>`).join('')}</select></label><label class="field"><span>目标语言</span><select aria-label="目标语言"><option>english · en</option></select></label><label class="field"><span>翻译配置</span><select aria-label="翻译配置"><option>自定义模型 · 演示配置</option></select></label>${btn(translating?'正在生成…':translated?'重新翻译':'生成英文译文','translate','spark','primary')}</div>
  ${translating?'<div class="loading-line" role="progressbar" aria-label="正在演示翻译生成"></div>':''}${translationError?'<div class="notice error" role="alert">连接超时（演示）。原文和已有译文未改变。检查模型配置后可重试。</div>':''}
  <div class="translation-grid"><section class="translation-pane"><header><span>简体中文 · 原文</span>${tag('只读','muted-tag')}</header><div class="translation-copy"><h2>${escape(current.title)}</h2>${renderBody(translationSource())}</div></section><section class="translation-pane"><header><span>english · 译文</span>${tag(translated?'等待校对':'尚未生成',translated?'':'muted-tag')}</header>${translated?`<div class="translation-copy"><label class="field"><span>英文标题</span><input id="translation-title" value="${escape(current.kind==='thought'?'A thought on building things':'Syncing across devices: notes on building Yanlu')}"></label><label class="field"><span>英文摘要</span><input id="translation-description" value="A few notes on sync, design, and the choices in between."></label><textarea id="translation-body" aria-label="英文译文正文">${escape(translationText)}</textarea></div>`:`<div class="translation-empty">${icon('translate')}<h3>${translating?'正在让文字走得更远…':'给这篇文字，另一种语言。'}</h3><p class="muted">${translating?'正在演示生成状态，稍后可逐段校对。':'保留代码、公式、链接和 mdx 组件结构。'}</p><p class="muted">演示不会调用模型或消耗额度。</p></div>`}</section></div>
  <div class="translation-bottom"><div class="translation-meta">目标：<span class="path">src/content/${current.kind==='thought'?'thought-en':'writing-en'}/${escape(current.title)}.${current.format}</span><p>译文示例用于展示校对流程，保留同名文件关联。</p></div><div class="actions">${btn('预览译文','preview-translation','eye')}<button class="btn primary" data-action="apply-translation" ${translated?'':'disabled'}>${icon('check')}确认并保存译文</button></div></div>
  <div class="notice">翻译不会覆盖中文原文。正式版本先生成待审核结果，再选择新建或覆盖英文版本；模型密钥仅由本地服务读取。</div>
  <div class="translation-history"><h3>需要时，也能看见问题。</h3><div class="history-row"><span>连接超时、额度不足时保留编辑内容</span><button class="link" data-action="translation-error">查看失败状态</button></div><div class="history-row"><span>配置兼容接口地址、模型名称与环境变量</span><button class="link" data-action="go-settings">模型配置 ${icon('arrow')}</button></div></div>`;
}

function renderPreview() {
  return head('本地预览','检查桌面、手机和深色模式下的页面。',btn('继续编辑',current.kind==='thought'?'go-thoughts':'go-editor','left'))+
  `<div class="preview-controls"><span class="preview-address">localhost · /${current.kind==='thought'?'thoughts':'writings'}/当前文档</span><div class="actions"><div class="segmented"><button data-preview-device="desktop" aria-label="桌面预览" class="${previewMobile?'':'active'}">${icon('desktop')}</button><button data-preview-device="mobile" aria-label="手机预览" class="${previewMobile?'active':''}">${icon('mobile')}</button></div><button class="btn sm" data-action="preview-theme">${icon('moon')}${previewDark?'浅色':'深色'}</button>${btn('刷新','refresh-preview','undo','sm')}</div></div><div class="preview-canvas"><article class="site-preview ${previewMobile?'mobile':''} ${previewDark?'dark':''}"><header class="site-nav"><strong class="site-brand"><img src="/site/favicon-96x96.png" alt="">ZeroLoveSeA</strong><div><span>home</span><span>writings</span><span>thoughts</span></div></header><div class="site-article"><h1>${escape(current.previewEnglish?'Syncing across devices: notes on building Yanlu':current.title)}</h1><div class="byline">${current.date} <span class="footer-dot">·</span> yang zhou <span class="footer-dot">·</span> layout preview</div>${current.previewEnglish?translationText.split('\n\n').map(x=>`<p>${escape(x)}</p>`).join(''):renderBody(current.body)}</div></article></div><div class="preview-label">${icon('eye')}<span>当前是排版设计示意，并非 Astro 页面实时编译。正式版将通过本地隔离预览渲染真实布局、图片与 mdx 组件。</span></div>`;
}

function renderSettings() {
  return head('设置','配置翻译、文件位置与本地预览。',btn('保存','save-settings','check','primary'))+
  `<div class="settings-layout"><nav class="settings-nav" aria-label="设置分区"><a href="#settings" data-scroll="model-config">大模型翻译</a><a href="#settings" data-scroll="file-rules">内容与图片</a><a href="#settings" data-scroll="local-preview">本地预览</a><a href="#settings" data-scroll="safety">保存与恢复</a></nav><div><section class="settings-section" id="model-config"><h2>大模型翻译</h2><p>连接自己的模型服务。使用兼容接口与环境变量，不把密钥写进文章。</p><label class="field"><span>接口地址</span><input id="model-endpoint" type="url" placeholder="https://your-provider.example/v1"><small>示例为空；正式版本由本地服务发起请求。</small></label><div class="field-row"><label class="field"><span>模型名称</span><input id="model-name" placeholder="填写服务商提供的模型名"></label><label class="field"><span>密钥环境变量名</span><input id="model-key" value="STUDIO_LLM_API_KEY" spellcheck="false"></label></div><label class="field"><span>翻译要求</span><textarea>忠实翻译为自然英文，保留作者语气。保持 frontmatter、代码、公式、图片链接、import 与 mdx 组件结构；不翻译组件名、属性名和路径。</textarea></label>${btn('测试连接','test-model','link','sm')}<span class="muted" id="model-result" style="margin-left:10px">未连接 · 设计演示</span></section><section class="settings-section" id="file-rules"><h2>内容与图片</h2><p>沿用项目的文件结构，所有位置清晰可见。</p><div class="field-row"><label class="field"><span>中文博文</span><input value="src/content/writing" readonly></label><label class="field"><span>英文博文</span><input value="src/content/writing-en" readonly></label></div><div class="field-row"><label class="field"><span>中文想法</span><input value="src/content/thought" readonly></label><label class="field"><span>英文想法</span><input value="src/content/thought-en" readonly></label></div><label class="field"><span>博文图片</span><input value="public/_posts/{filename}/" readonly></label><label class="field"><span>想法图片（拟新增）</span><input value="public/_thoughts/{filename}/" readonly></label><div class="toggle-row"><div>插入组件时自动转换 mdx<small>补充 import，保持文件名和语言关联；正式版本校验后再替换。</small></div><label class="switch"><input type="checkbox" checked disabled aria-label="自动转换 mdx 为必要功能"></label></div></section><section class="settings-section" id="local-preview"><h2>本地预览</h2><p>真实版本复用现有站点布局，未保存内容通过隔离预览呈现。</p><label class="field"><span>本地站点地址</span><input value="http://localhost:4321" type="url"></label><label class="field"><span>预览启动方式</span><input value="bun dev" readonly></label><div class="notice">管理平台与站点分开启动。预览未启动时显示“启动本地预览”及错误日志，保留所有修改。</div></section><section class="settings-section" id="safety"><h2>保存与恢复</h2><p>让每次修改可以确认，每次误操作可以回头。</p><div class="toggle-row"><div>覆盖前保留上一个文件版本<small>未来版本保存到本地管理目录，不进入公开内容集合。</small></div><label class="switch"><input type="checkbox" checked aria-label="覆盖前备份"></label></div><div class="toggle-row"><div>删除时先移入回收站<small>默认不删除图片，避免影响其他内容的引用。</small></div><label class="switch"><input type="checkbox" checked disabled aria-label="删除先进入回收站"></label></div><div class="notice warm">本稿不写入磁盘、不保存密钥、不启动部署。配置仅用于展示界面与状态。</div></section></div></div>`;
}

function renderTrash() {
  return head('回收站','恢复已删除的内容，关联图片默认保留。',trash.length?btn('清空回收站','empty-trash','trash'):'')+
  (trash.length?`<div class="table-wrap"><table><thead><tr><th></th><th>内容</th><th>集合</th><th>关联图片</th><th>操作</th></tr></thead><tbody>${trash.map(item=>`<tr><td></td><td>${escape(item.title||item.body.slice(0,30))}</td><td>${tag(item.kind==='thought'?'thought':'writing','muted-tag')}</td><td class="muted">默认保留</td><td><button class="btn sm" data-restore="${item.id}">${icon('undo')}恢复</button></td></tr>`).join('')}</tbody></table></div><div class="notice section-space">真实版本删除前展示中英文版本与图片影响范围。恢复遇到同名文件时先处理冲突。</div>`:`<div class="empty">${icon('trash')}<h2>回收站很干净。</h2><p>从博文列表或想法列表删除一条内容，可以体验删除确认和恢复流程。</p>${btn('回到博文','go-writing','left','sm')}</div>`);
}

function render() {
  const page=route();
  if(current.kind==='thought'&&!['thoughts','translations','preview'].includes(page)) current=writingDraft;
  if(!current.kind) writingDraft=current;
  const active=page==='editor'?'writing':page;
  $$('[data-nav]').forEach(el=>{
    el.classList.toggle('active',el.dataset.nav===active);
    if(el.dataset.nav===active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  $('#crumb').textContent=labels[page]||'博文';
  const views={collections:renderCollections,writing:renderWriting,editor:renderEditor,thoughts:renderThoughts,media:renderMedia,components:renderComponents,translations:renderTranslations,preview:renderPreview,settings:renderSettings,trash:renderTrash};
  $('#main').innerHTML=(views[page]||renderWriting)();
  document.title=`${labels[page]||'博文'} — local studio`;
  if(page==='translations'&&translating) $('[data-action="translate"]').disabled=true;
  counts();
  bindDrop();
}

function modal(title,content,actions='') {
  $('#modal').innerHTML=`<div class="dialog-head"><h2 id="modal-title">${title}</h2><button class="btn icon" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>${content}${actions?`<div class="dialog-actions">${actions}</div>`:''}`;
  if(!$('#modal').open) $('#modal').showModal();
}
function closeModal(){ $('#modal').close(); }

function confirmDelete(items,kind='writing') {
  if(!items.length) return;
  modal('移至回收站？',`<p class="dialog-copy">${items.length===1?'「'+escape(items[0].title||items[0].body.slice(0,28))+'」':'已选择的 '+items.length+' 篇内容'}将从内容列表移除。你可以在回收站中恢复。</p><label class="checkline"><input id="delete-english" type="checkbox">同时移入已有的英文版本（影响范围示意）</label><div class="notice">关联图片保留，避免破坏其他文章的引用。此原型只修改当前浏览器内存。</div>`,btn('取消','close-modal')+btn('确认移入回收站','confirm-delete','trash','danger'));
  $('[data-action="confirm-delete"]').onclick=()=>{
    trash.push(...items.map(item=>({...item,kind})));
    const ids=new Set(items.map(x=>x.id));
    if(kind==='thought') thoughts=thoughts.filter(x=>!ids.has(x.id));
    else entries=entries.filter(x=>!ids.has(x.id));
    selected.clear();closeModal();
    if(route()==='editor') navigate('writing');else render();
    toast('已演示移至回收站，可前往恢复；图片保留');
  };
}

function showSearch() {
  modal('搜索你的内容',`<label class="searchbox">${icon('search')}<input id="search-input" placeholder="输入标题或想法中的文字…" style="width:100%" aria-label="全局搜索"></label><div class="search-results" id="search-results"></div>`);
  const draw=()=>{
    const query=$('#search-input').value.toLowerCase();
    const matches=[...entries.map(x=>({...x,kind:'writing'})),...thoughts.map(x=>({...x,title:x.body.slice(0,48),kind:'thought'}))].filter(x=>x.title.toLowerCase().includes(query));
    $('#search-results').innerHTML=matches.length?matches.map(x=>`<button class="search-result" data-search-id="${x.id}" data-search-kind="${x.kind}">${icon(x.kind==='thought'?'thought':'file')}<span>${escape(x.title)}</span></button>`).join(''):'<p class="muted">没有匹配内容，试试更短的关键词。</p>';
  };
  $('#search-input').oninput=draw;draw();$('#search-input').focus();
}

let uploadContext='writing';
function uploadImage(context='writing') {
  uploadContext=context;
  modal('把图片放进内容里',`<p class="dialog-copy">先关联内容，再自动归档。图片插入后会带上可访问的引用路径。</p><label class="field"><span>归属内容</span><select id="upload-target"><option value="${escape(current.title)}">${escape(context==='thought'?'当前想法 · 2026-10-22-10-54':current.title)}</option>${entries.filter(x=>x.id!==current.id).map(x=>`<option value="${escape(x.title)}">${escape(x.title)}</option>`).join('')}</select></label><div class="notice"><span>目标目录</span><div class="path" id="upload-path">${context==='thought'?'public/_thoughts/2026-10-22-10-54/':'public/_posts/'+escape(current.title)+'/'}</div></div><div id="upload-queue"></div><p class="mode-note">支持 png / jpg / webp / gif，20 mb / 张。重名时正式版保留原文件并生成新文件名。</p>`,btn('取消','close-modal')+btn('选择图片','pick-images','upload','primary'));
  $('#upload-target').onchange=()=>$('#upload-path').textContent=`public/${context==='thought'?'_thoughts':'_posts'}/${$('#upload-target').value}/`;
}

async function stageImages(files) {
  if(!files.length) return;
  const valid=[];
  const allowed=['image/png','image/jpeg','image/webp','image/gif'];
  const folder=uploadContext==='thought'?'thoughts':$('#upload-target')?.value||current.title;
  for(const file of files) {
    if(!allowed.includes(file.type)||file.size>20*1024*1024) {toast('图片类型不支持或超过 20 mb：'+file.name);continue;}
    const src=URL.createObjectURL(file);
    const item={id:++serial,name:file.name,src,size:(file.size/1024).toFixed(0)+' kb · 临时预览',folder,refs:0};
    valid.push(item);
  }
  if(!valid.length) return;
  modal('图片已准备好',`<p class="dialog-copy">以下图片只保存在浏览器临时内存。正式版本会校验文件内容，再写入对应目录。</p>${valid.map(x=>`<div class="upload-row">${icon('image')}<div>${escape(x.name)}<small>${escape(x.size)}</small></div>${tag('待确认')}</div>`).join('')}<label class="field section-space"><span>图片替代文本</span><input id="image-alt" placeholder="简要描述图片内容"></label>`,btn('取消','cancel-staged')+btn('确认并插入','commit-images','check','primary'));
  $('[data-action="cancel-staged"]').onclick=()=>{valid.forEach(x=>URL.revokeObjectURL(x.src));closeModal();};
  $('[data-action="commit-images"]').onclick=()=>{
    const alt=$('#image-alt').value||'图片说明';
    media.push(...valid);
    const markdown=valid.map(x=>`![${alt.replace(/[\[\]\n]/g,'')}](/${uploadContext==='thought'?'_thoughts':'_posts'}/${encodeURIComponent(uploadContext==='thought'?'2026-10-22-10-54':folder)}/${encodeURIComponent(x.name)})`).join('\n');
    if(uploadContext==='thought') {
      const area=$('#thought-body');if(area) area.value+='\n\n'+markdown;
    } else {
      current.body+='\n\n'+markdown;
      current.cover=valid[0].src;
      saved=false;
    }
    closeModal();
    if(route()!=='thoughts') render();
    toast('已演示归档与插入路径；没有写入磁盘');
  };
}

function bindDrop() {
  const areas=$$('#drop-zone, .cover-upload');
  for (const area of areas) {
  area.ondragover=e=>{e.preventDefault();area.classList.add('dragover');};
  area.ondragleave=()=>area.classList.remove('dragover');
  area.ondrop=e=>{e.preventDefault();area.classList.remove('dragover');uploadContext=mediaFolder==='thoughts'?'thought':'writing';stageImages([...e.dataTransfer.files]);};
  }
}

function importFiles() {
  modal('导入 markdown / mdx',`<p class="dialog-copy">把已有文字带进工作空间。先检查 frontmatter、文件名和图片引用，再决定是否保存。</p><label class="field"><span>目标集合</span><select id="import-collection"><option value="writing">博文 · writing</option><option value="thought">想法 · thought</option></select></label><div class="drop-zone" style="min-height:110px">${icon('file')}<strong>选择 .md 或 .mdx 文件</strong><p>本稿演示导入检查，不改动原文件。</p></div><div class="notice section-space">正式版本显示同名冲突、字段缺失和待补图片；不会静默覆盖。</div>`,btn('取消','close-modal')+btn('选择文件','pick-markdown','upload','primary'));
}

const actions={
  'go-writing':()=>navigate('writing'),'go-thoughts':()=>navigate('thoughts'),'go-editor':()=>{current.previewEnglish=false;navigate('editor');},
  'go-components':()=>navigate('components'),'go-preview':()=>{current.previewEnglish=false;navigate('preview');},
  'go-settings':()=>navigate('settings'),'go-translations':()=>{translated=false;translationError=false;navigate('translations');},
  'new-post':()=>{current={id:++serial,title:'',desc:'',date:'2026.10.22',status:'待修改',en:false,format:'md',body:''};saved=false;navigate('editor');},
  'save':()=>{
    if(!current.title.trim()) {toast('请先填写博文标题');$('#post-title')?.focus();return;}
    const existing=entries.find(x=>x.id===current.id);
    if(existing) Object.assign(existing,current);else entries.unshift({...current});
    saved=true;render();toast('已保存到演示内存；没有修改项目文件');
  },
  'sort':()=>{sortDescending=!sortDescending;render();},
  'clear-select':()=>{selected.clear();render();},
  'reset-filter':()=>{listFilter='all';listQuery='';formatFilter='all';render();},
  'bulk-delete':()=>confirmDelete(entries.filter(x=>selected.has(x.id))),
  'delete-current':()=>confirmDelete([{...current}]),
  'bulk-translate':()=>{
    const items=entries.filter(x=>selected.has(x.id));
    modal('翻译所选内容',`<p class="dialog-copy">已选择 ${items.length} 篇。正式版逐篇生成待审核译文，不直接覆盖已有文件。</p>${items.map(x=>`<div class="upload-row">${icon('file')}<span>${escape(x.title)}</span>${tag(x.en?'已有英文':'待翻译',x.en?'':'warm')}</div>`).join('')}`,btn('取消','close-modal')+btn('从第一篇开始','start-bulk','translate','primary'));
    $('[data-action="start-bulk"]').onclick=()=>{current={...items[0],body:items[0].body||seedBody};translated=false;closeModal();navigate('translations');};
  },
  'import':importFiles,'pick-markdown':()=>$('#markdown-input').click(),'close-modal':closeModal,
  'upload-image':()=>uploadImage(),'upload-thought-image':()=>uploadImage('thought'),'pick-images':()=>$('#image-input').click(),
  'insert-component':()=>navigate('components'),'thought-component':()=>{
    modal('给想法插入组件',`<p class="dialog-copy">thought 同样支持 mdx。选择高亮演示后，会在正文中补充 import 与组件引用。</p><div class="notice">正式版将与博文共用完整组件选择器。</div>`,btn('取消','close-modal')+btn('插入高亮示例','insert-thought-component','blocks','primary'));
    $('[data-action="insert-thought-component"]').onclick=()=>{
      const area=$('#thought-body');area.value='import { Highlight } from "@components/interactive";\n\n'+area.value+'\n\n<Highlight>值得留下的想法</Highlight>';closeModal();toast('已演示插入组件，保存时将使用 .mdx');
    };
  },
  'insert-selected':()=>addComponent(selectedComponent,componentSnippet()),
  'focus-thought':()=>{$('#thought-body').focus();$('#thought-body').scrollIntoView({block:'center',behavior:'smooth'});},
  'save-thought':()=>{
    const body=$('#thought-body').value.trim();
    if(!body){toast('先写下一点想法，再保存');$('#thought-body').focus();return;}
    if(thoughtEditing) Object.assign(thoughts.find(x=>x.id===thoughtEditing.id),{body,category:$('#thought-category').value});
    else thoughts.unshift({id:++serial,body,category:$('#thought-category').value,date:'2026.10.22 · 10:54',en:false});
    thoughtEditing=null;render();toast('想法已保存到演示内存；没有写入文件');
  },
  'translate':()=>{
    translating=true;translated=false;translationError=false;render();
    setTimeout(()=>{translating=false;translated=true;if(route()==='translations')render();toast('已生成固定示例译文；未调用大模型');},1400);
  },
  'translation-error':()=>{translationError=true;render();toast('正在展示连接失败状态');},
  'preview-translation':()=>{if(!translated){toast('请先生成示例译文');return;}current.previewEnglish=true;navigate('preview');},
  'apply-translation':()=>{
    modal(current.en?'覆盖现有英文版？':'保存英文版本？',`<p class="dialog-copy">将译文写入对应英文集合的同名文件。中文原文和共用图片不变。</p><div class="notice">此处演示确认流程。正式版本保存前检查组件结构和文件冲突，并保留旧版本。</div>`,btn('返回校对','close-modal')+btn('确认保存译文','confirm-translation','check','primary'));
    $('[data-action="confirm-translation"]').onclick=()=>{
      current.en=true;
      const original=(current.kind==='thought'?thoughts:entries).find(x=>x.id===current.id);if(original)original.en=true;
      closeModal();render();toast('已演示保存英文版本；未写入项目文件');
    };
  },
  'preview-theme':()=>{previewDark=!previewDark;render();},'refresh-preview':()=>{render();toast('已刷新排版示意');},
  'save-settings':()=>toast('已演示保存配置；未写入文件或保存密钥'),
  'test-model':()=>{
    if(!$('#model-endpoint').value.trim()||!$('#model-name').value.trim()){toast('请填写接口地址和模型名称');return;}
    $('#model-result').textContent='连接测试状态示意 · 未实际请求';toast('设计稿未连接模型服务');
  },
  'history':()=>modal('版本与恢复',`<p class="dialog-copy">正式版本在每次覆盖前保存上一版；外部编辑冲突时提供比较与重新加载。</p><div class="upload-row">${icon('clock')}<span>2026.10.22 · 10:54<small>保存前版本 · 示例</small></span>${tag('可恢复')}</div><div class="notice section-space">本稿没有实际版本记录。原文件未被读取或覆盖。</div>`,btn('关闭','close-modal')),
  'empty-trash':()=>{
    modal('永久清空回收站？','<p class="dialog-copy">此操作无法撤回。正式版本需要输入确认词；此处只清空演示内存中的回收站。</p><label class="field"><span>输入「清空」以确认</span><input id="trash-confirm" autocomplete="off"></label>',btn('取消','close-modal')+'<button class="btn danger" id="trash-final" disabled>永久清空</button>');
    $('#trash-confirm').oninput=()=>$('#trash-final').disabled=$('#trash-confirm').value!=='清空';
    $('#trash-final').onclick=()=>{trash=[];closeModal();render();toast('已清空演示回收站');};
  },
};

document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]');if(action&&actions[action.dataset.action])actions[action.dataset.action]();
  const filter=e.target.closest('[data-filter]');if(filter){listFilter=filter.dataset.filter;selected.clear();render();}
  const edit=e.target.closest('[data-edit]');if(edit)openEntry(Number(edit.dataset.edit));
  const menu=e.target.closest('[data-entry-menu]');if(menu){
    const item=entries.find(x=>x.id===Number(menu.dataset.entryMenu));
    modal('管理博文',`<p class="dialog-copy">${escape(item.title)}</p><div class="actions">${btn('编辑内容','menu-edit','file')}${btn('翻译','menu-translate','translate')}${btn('删除','menu-delete','trash')}</div>`);
    $('[data-action="menu-edit"]').onclick=()=>{closeModal();openEntry(item.id);};
    $('[data-action="menu-translate"]').onclick=()=>{current={...item,body:item.body||seedBody};translated=false;closeModal();navigate('translations');};
    $('[data-action="menu-delete"]').onclick=()=>confirmDelete([item]);
  }
  const component=e.target.closest('[data-component]');if(component){selectedComponent=component.dataset.component;render();}
  const mode=e.target.closest('[data-edit-mode]');if(mode){editMode=mode.dataset.editMode;render();}
  const device=e.target.closest('[data-preview-device]');if(device){previewMobile=device.dataset.previewDevice==='mobile';render();}
  const folder=e.target.closest('[data-folder]');if(folder){mediaFolder=folder.dataset.folder;render();}
  const image=e.target.closest('[data-media]');if(image){
    const item=media.find(x=>x.id===Number(image.dataset.media));
    modal('图片详情',`<img class="modal-image" src="${escape(item.src)}" alt="${escape(item.name)}"><label class="field"><span>文件名</span><input value="${escape(item.name)}" readonly></label><label class="field"><span>替代文本</span><input placeholder="描述图片的内容" id="media-alt"></label><p class="path">${item.src.startsWith('/site/')?'public'+escape(item.src.slice(5)):item.folder==='thoughts'?'public/_thoughts/2026-10-22-10-54/'+escape(item.name):'public/_posts/'+escape(item.folder)+'/'+escape(item.name)}</p><p class="dialog-copy section-space">${item.refs?'被 '+item.refs+' 处内容引用（示例）。删除前必须解除引用。':'尚未引用，可以插入当前文档。'}</p>`,btn('关闭','close-modal')+btn('插入文档','insert-media','plus','primary'));
    $('[data-action="insert-media"]').onclick=()=>{current.body+=`\n\n![${($('#media-alt').value||'图片说明').replace(/[\[\]\n]/g,'')}](${item.src.replace('/site','')})`;saved=false;closeModal();navigate('editor');toast('已演示插入图片引用');};
  }
  const thoughtEdit=e.target.closest('[data-thought-edit]');if(thoughtEdit){thoughtEditing={...thoughts.find(x=>x.id===Number(thoughtEdit.dataset.thoughtEdit))};render();$('#thought-body').focus();}
  const thoughtDelete=e.target.closest('[data-thought-delete]');if(thoughtDelete)confirmDelete([thoughts.find(x=>x.id===Number(thoughtDelete.dataset.thoughtDelete))],'thought');
  const thoughtTranslate=e.target.closest('[data-thought-translate]');if(thoughtTranslate){const item=thoughts.find(x=>x.id===Number(thoughtTranslate.dataset.thoughtTranslate));current={...item,title:'想法 · '+item.date,format:item.body.includes('import ')?'mdx':'md',kind:'thought'};translated=false;navigate('translations');}
  const thoughtPreview=e.target.closest('[data-thought-preview]');if(thoughtPreview){const item=thoughts.find(x=>x.id===Number(thoughtPreview.dataset.thoughtPreview));current={...item,title:'想法 · '+item.date,format:'md',kind:'thought'};navigate('preview');}
  const restore=e.target.closest('[data-restore]');if(restore){const item=trash.find(x=>x.id===Number(restore.dataset.restore));if(item.kind==='thought')thoughts.unshift(item);else entries.unshift(item);trash=trash.filter(x=>x.id!==item.id);render();toast('已恢复到演示列表');}
  const search=e.target.closest('[data-search-id]');if(search){closeModal();if(search.dataset.searchKind==='thought'){thoughtEditing={...thoughts.find(x=>x.id===Number(search.dataset.searchId))};navigate('thoughts');}else openEntry(Number(search.dataset.searchId));}
  const scroll=e.target.closest('[data-scroll]');if(scroll){e.preventDefault();$('#'+scroll.dataset.scroll).scrollIntoView({behavior:'smooth'});}
  const format=e.target.closest('[data-format]');if(format){
    const area=$('#post-body');if(!area){toast('切回 markdown 模式后插入格式');return;}
    const selection=area.value.slice(area.selectionStart,area.selectionEnd)||'文字';
    const snippets={heading:'## '+selection,bold:'**'+selection+'**',italic:'*'+selection+'*',quote:'> '+selection,link:'['+selection+'](https://example.com)',code:'```\n'+selection+'\n```'};
    area.setRangeText(snippets[format.dataset.format],area.selectionStart,area.selectionEnd,'end');current.body=area.value;saved=false;$('#save-status').textContent='有未保存修改 · 演示';area.focus();
  }
});

document.addEventListener('input',e=>{
  const id=e.target.id;
  if(id==='post-title'){current.title=e.target.value;saved=false;}
  if(id==='post-description'){current.desc=e.target.value;saved=false;}
  if(id==='post-body'){current.body=e.target.value;saved=false;}
  if(id.startsWith('post-')&&$('#save-status'))$('#save-status').textContent='有未保存修改 · 演示';
  if(id==='list-search'){
    const position=e.target.selectionStart;listQuery=e.target.value;render();$('#list-search').focus();$('#list-search').setSelectionRange(position,position);
  }
  if(id.startsWith('component-')&&$('#component-code'))$('#component-code').textContent=componentSnippet();
  if(id==='translation-body')translationText=e.target.value;
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-select]')){const id=Number(e.target.dataset.select);if(e.target.checked)selected.add(id);else selected.delete(id);render();}
  if(e.target.id==='select-all'){$$('[data-select]').forEach(x=>e.target.checked?selected.add(Number(x.dataset.select)):selected.delete(Number(x.dataset.select)));render();}
  if(e.target.id==='format-filter'){formatFilter=e.target.value;selected.clear();render();}
  if(e.target.id==='post-date'){current.date=e.target.value.replaceAll('-','.');saved=false;}
  if(e.target.id==='post-status'){current.status=e.target.value;saved=false;}
  if(e.target.id==='translation-document'&&e.target.value!=='current'){const item=entries.find(x=>x.id===Number(e.target.value));current={...item,body:item.body||seedBody};translated=false;render();}
});
$('#image-input').onchange=async e=>{await stageImages([...e.target.files]);e.target.value='';};
$('#markdown-input').onchange=async e=>{
  const files=[...e.target.files];e.target.value='';
  if(!files.length)return;
  const target=$('#import-collection')?.value||'writing';
  const details=[];
  for(const file of files){
    if(!/\.(md|mdx)$/i.test(file.name)||file.size>2*1024*1024){details.push({name:file.name,error:'格式不支持或超过 2 mb'});continue;}
    const text=await file.text();
    details.push({name:file.name,error:/^---\r?\n/.test(text)?'仅确认存在 frontmatter 分隔符；字段尚未校验':'缺少 frontmatter，需补全标题和日期'});
  }
  modal('导入检查 · '+(target==='thought'?'thought':'writing'),`<p class="dialog-copy">已读取 ${details.length} 个文件用于展示检查结果，未写入集合。</p>${details.map(x=>`<div class="upload-row">${icon('file')}<div>${escape(x.name)}<small>${escape(x.error)}</small></div>${tag('待校验','warm')}</div>`).join('')}<div class="notice warm section-space">正式版本还需校验必填字段、分类、同名冲突、组件语法和图片路径。当前没有执行内容导入。</div>`,btn('关闭','close-modal'));
};
$('#global-search').onclick=showSearch;
$('#collapse-nav').onclick=()=>{
  const collapsed=document.body.classList.toggle('nav-collapsed');
  $('#collapse-nav').setAttribute('aria-label',collapsed?'展开侧栏':'收起侧栏');
};
$('#studio-theme').onclick=()=>{
  const dark=document.documentElement.classList.toggle('studio-dark');
  $('#studio-theme').setAttribute('aria-label',dark?'切换后台浅色主题':'切换后台深色主题');
  $('#studio-theme').innerHTML=icon(dark?'sun':'moon');
};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showSearch();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'&&route()==='editor'){e.preventDefault();actions.save();}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
render();

export {};
