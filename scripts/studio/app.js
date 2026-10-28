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
let documents=[], drafts=[], assets=[], trash=[], config={}, componentNames=[];
let doc=null, dirty=false, page='collections', query='', language='zh', format='all', pageNumber=1;
let selected=new Set(), assetFolder='', translation=null, translationController=null, previewURL='', previewMobile=false;
let component='Highlight', sourcePosition=0, uploadCount=0, pending=false, draftTimer, toastTimer;
const anchors=[];
const editorScroll=new Map();let renderedId=null;
let componentColor='yellow',componentText='文字内容',componentTeaser='点击展开',componentPreviewURL='',componentLoading=false,componentTimer;
let chatOpen=false,chatController=null;
let quickFocus='';
let propertiesOpen=false;
let editorMode='markdown',richEditor=null,richModule=null,richOwner=null,richBody='',richGeneration=0,componentDialog=false;
let publishState={running:false},publishPlan=null,publishTimer;
let translationTimer=null,translationSaving=0,translationSave=Promise.resolve();
let analyticsData=null,analyticsLoading=false,analyticsError='',analyticsWindow='近7天',analyticsMetric='views';
const chats=new Map();
const componentLabels={Highlight:'高亮标记',Sidenote:'旁注',RevealQuote:'展开引用',DecisionToggle:'决策切换',FlipCards:'翻转卡片',EnergyMeter:'能量指示',DecisionForm:'决策表单',AgentSimulation:'智能体模拟',CommitCompare:'提交对比'};
function singlePicker(id,label,value,options){return `<details class="format-picker"><summary id="${id}" aria-label="${label}">${icon('filter')}<span class="choice-label">${escape(options.find(x=>x[0]===value)?.[1]||value)}</span>${icon('chevron')}</summary><div class="format-options" role="group" aria-label="${label}">${options.map(([key,text,note=''])=>`<button type="button" data-choice="${id}" data-value="${key}" aria-pressed="${key===value}"><span class="format-check">${key===value?icon('check'):''}</span><span>${text}</span><small>${note}</small></button>`).join('')}</div></details>`;}

const collectionOf=id=>id.split('/')[0];
const stemOf=id=>id.split('/')[1].replace(/\.mdx?$/,'');
const isThought=id=>id.startsWith('thought');
const isEnglish=id=>collectionOf(id).endsWith('-en');
const field=(label,id,value='',type='text',extra='')=>`<label class="field"><span>${label}</span><input id="${id}" type="${type}" value="${escape(value)}" ${extra}></label>`;
const metaField=(label,key,type='text')=>field(label,'meta-'+key,(key==='pubDate'?String(doc.meta[key]||'').replace(' ','T').slice(0,19):doc.meta[key])??'',type);
const sourceName=id=>isThought(id)?'随想':'博文';
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),5000);}
async function api(path,data,options={}){
  const response=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:{'x-studio-token':window.STUDIO_TOKEN,...(data===undefined||data instanceof FormData?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data),...options});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'请求失败');return result;
}
function modal(title,content,actions=''){componentDialog=false;$('#modal').classList.remove('component-dialog');$('#modal').innerHTML=`<div class="dialog-head"><h2 id="modal-title">${title}</h2><button class="btn icon" data-action="close" aria-label="关闭">${icon('close')}</button></div>${content}${actions?`<div class="dialog-actions">${actions}</div>`:''}`;if(!$('#modal').open)$('#modal').showModal();}
function close(){componentDialog=false;$('#modal').close();}
function head(title,desc,actions=''){return `<div class="page-head"><div><h1>${title}</h1><p>${escape(desc)}</p></div><div class="head-actions">${actions}</div></div>`;}
async function refresh(){const state=await api('init');documents=state.documents;drafts=state.drafts;config=state.config;componentNames=state.components;}
function counterpart(id){const target=collectionOf(id).replace(/-en$/,'')+(isEnglish(id)?'':'-en');return documents.find(x=>collectionOf(x.id)===target&&stemOf(x.id)===stemOf(id));}
async function persistTranslation(){
  clearTimeout(translationTimer);translationTimer=null;
  if(!translation?.document||translation.saved)return translationSave;
  const {source,...review}=translation;const draft=structuredClone({source:source||doc,translation:review});
  translationSaving++;
  const save=translationSave.catch(()=>{}).then(()=>api('translation-draft',draft));
  translationSave=save.finally(()=>{translationSaving--;window.dispatchEvent(new Event('tidemark-idle'));});
  return translationSave;
}
function scheduleTranslationSave(){clearTimeout(translationTimer);translationTimer=setTimeout(()=>void handle(persistTranslation),350);}
async function restoreTranslation(){
  if(!doc||isEnglish(doc.id))return null;
  const draft=await api('translation-draft?id='+encodeURIComponent(doc.id));
  if(!draft)return null;
  return {...draft.translation,source:draft.source,progress:draft.source.body===doc.body&&JSON.stringify(draft.source.meta)===JSON.stringify(doc.meta)?'已恢复临时译文，等待人工校对':'已恢复临时译文；原文已有修改，请核对'};
}
async function preserve(){await persistTranslation();if(doc&&dirty){await api('draft',doc);drafts=await api('init').then(x=>x.drafts);}}
async function openDoc(id,fromDraft=false){chatController?.abort();chatOpen=false;translationController?.abort();translationController=null;await preserve();doc=fromDraft?structuredClone(drafts.find(x=>x.id===id)):await api('document?id='+encodeURIComponent(id));doc.originalId??=doc.id;dirty=fromDraft;sourcePosition=doc.body.length;translation=await restoreTranslation();previewURL='';go('editor');}
function go(next){if(location.hash.slice(1)===next){page=next;render();}else location.hash=next;}
function newDoc(kind='writing'){
  const collection=kind+(language==='en'?'-en':'');
  const stamp=today();const filename=stamp.replace(/[^0-9]/g,'-')+'-'+crypto.randomUUID().slice(0,6);
  return {id:`${collection}/${filename}.md`,originalId:`${collection}/${filename}.md`,revision:null,meta:{title:kind==='thought'?'随笔 · '+stamp:'',description:'',pubDate:stamp,...(kind==='thought'?{category:'随笔'}:{})},body:''};
}
function ensureDoc(){if(!doc)throw new Error('请先打开或新建一篇内容');}
function markDirty(){dirty=true;const status=$('#save-status');if(status)status.textContent='有未保存修改';clearTimeout(draftTimer);draftTimer=setTimeout(()=>{if(doc&&dirty)api('draft',doc).catch(e=>toast('草稿备份失败：'+e.message));},1000);}
function updateBody(value){
  const old=doc.body;let start=0;while(start<old.length&&start<value.length&&old[start]===value[start])start++;
  let endOld=old.length,endNew=value.length;while(endOld>start&&endNew>start&&old[endOld-1]===value[endNew-1]){endOld--;endNew--;}
  for(const anchor of anchors)if(anchor.id===doc.id&&anchor.pos>start)anchor.pos=anchor.pos>=endOld?anchor.pos+endNew-endOld: endNew;
  doc.body=value;if(isThought(doc.id)){doc.meta.description=value;if($('#extra-meta')&&$('#extra-meta').checkValidity())$('#extra-meta').value=JSON.stringify(doc.meta,null,2);}if($('#character-count'))$('#character-count').textContent=value.length+' 字符';markDirty();
}
async function saveDoc(){ensureDoc();if($('#extra-meta')&&!$('#extra-meta').checkValidity())throw new Error('frontmatter JSON 无效');if(uploadCount)throw new Error('请等待图片上传完成');pending=true;render();try{doc=await api('save',doc);doc.originalId=doc.id;dirty=false;await refresh();toast('已保存');}finally{pending=false;render();}}
async function chooseNew(kind){chatController?.abort();chatOpen=false;translationController?.abort();translationController=null;await preserve();doc=newDoc(kind);dirty=false;translation=null;previewURL='';go('editor');}
const navs=[['writing','file','博文','content-nav'],['thoughts','thought','随想','content-nav'],['media','image','图片资源','content-nav'],['components','blocks','组件库','workspace-nav'],['translations','translate','翻译工作台','workspace-nav'],['preview','eye','本地预览','workspace-nav']];
for(const [name,glyph,label,target]of navs)$('#'+target).insertAdjacentHTML('beforeend',`<a class="nav-item" data-nav="${name}" href="#${name}" title="${label}">${icon(glyph)}${label}<span class="nav-count" data-count="${name}"></span></a>`);
$$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const labels={collections:'概览',writing:'博文',thoughts:'随想',editor:'编辑内容',media:'图片资源',components:'组件库',translations:'翻译工作台',preview:'本地预览',settings:'设置',trash:'回收站',drafts:'本地草稿'};
function render(){
  if(renderedId){if($('#post-body'))editorScroll.set(renderedId+':markdown',$('#post-body').scrollTop);if($('#rich-editor'))editorScroll.set(renderedId+':rich',$('#rich-editor').scrollTop);}
  renderedId=page==='editor'?doc?.id:null;
  document.body.classList.toggle('editing-page',page==='editor'&&Boolean(doc));document.body.classList.toggle('properties-open',propertiesOpen);
  richGeneration++;if(richEditor?.isInitialized)richEditor.unmount();
  const active=page==='editor'?(doc&&isThought(doc.id)?'thoughts':'writing'):page;
  $$('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===active);el.setAttribute('aria-current',el.dataset.nav===active?'page':'false');});
  $$('[data-count]').forEach(el=>{const collection=el.dataset.count==='thoughts'?'thought':el.dataset.count;el.textContent=['writing','thought'].includes(collection)?documents.filter(x=>collectionOf(x.id)===collection).length:'';});
  $('#crumb').textContent=labels[page]||'内容集合';document.title=(labels[page]||'studio')+' — Tidemark';
  const views={collections:renderHome,writing:renderList,thoughts:renderList,editor:renderEditor,media:renderAssets,components:renderComponents,translations:renderTranslation,preview:renderPreview,settings:renderSettings,trash:renderTrash,drafts:renderDrafts};
  $('#main').innerHTML=(views[page]||renderHome)();bindEditor();
}
async function loadAnalytics(force=false){
  if(analyticsLoading)return;analyticsLoading=true;analyticsError='';if(page==='collections')render();
  try{analyticsData=await api('analytics'+(force?'?refresh=1':''));analyticsError=analyticsData.error||'';}
  catch(error){analyticsError=error.message;}
  finally{analyticsLoading=false;if(page==='collections')render();}
}
function analyticsName(key,value){
  if(!value)return '未知';
  if(key==='country'||key==='language')try{return new Intl.DisplayNames(['zh-CN'],{type:key==='country'?'region':'language'}).of(String(value))||value;}catch{}
  return String(value);
}
function renderTrend(series){
  const values=analyticsMetric==='views'?series.values:series.uniques;
  if(!values.length)return '<p class="analytics-empty">暂无趋势数据</p>';
  const max=Math.max(2,Math.ceil(Math.max(...values)/2)*2),x=i=>48+i*812/Math.max(1,values.length-1),y=v=>210-v/max*178;
  const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
  const ticks=[...new Set([0,Math.floor((values.length-1)/2),values.length-1])];
  return `<svg class="analytics-chart" viewBox="0 0 900 260" role="img" aria-label="${analyticsMetric==='views'?'阅读量 PV':'访客 UV'}趋势，时间按本机时区"><title>${analyticsMetric==='views'?'阅读量 PV':'访客 UV'}趋势</title>${[0,.5,1].map(r=>`<line x1="48" y1="${y(max*r)}" x2="860" y2="${y(max*r)}" class="chart-grid"/><text x="36" y="${y(max*r)+4}" text-anchor="end">${Math.round(max*r)}</text>`).join('')}<polyline points="${points}" class="chart-line"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3" class="chart-point" tabindex="0" aria-label="${escape(series.labels[i])}：${v}"><title>${escape(series.labels[i])} · ${v}</title></circle>`).join('')}${ticks.map(i=>`<text x="${x(i)}" y="244" text-anchor="${i===0?'start':i===values.length-1?'end':'middle'}">${escape(series.labels[i])}</text>`).join('')}</svg>`;
}
function renderRanking(rows,key,title,total){
  const max=Math.max(1,...rows.map(r=>r.n));
  const row=(r,i)=>{
    let name=analyticsName(key,r.k);
    if(key==='posts'){const match=documents.find(d=>!isEnglish(d.id)&&(d.slug||stemOf(d.id))===String(r.k));name=match?.meta?.title||r.k||'未知文章';}
    return `<li><span class="rank-index">${i+1}</span><div class="rank-detail"><div class="rank-label"><span title="${escape(name)}">${escape(name)}</span><span>${Number(r.n).toLocaleString('zh-CN')}${key==='posts'?`<small> / ${Number(r.u||0).toLocaleString('zh-CN')} UV</small>`:`<small> · ${total?Math.round(r.n/total*100):0}%</small>`}</span></div><div class="rank-track"><span style="width:${Math.min(100,r.n/max*100)}%"></span></div></div></li>`;
  };
  return `<section class="analytics-ranking"><div class="analytics-section-head"><h2>${title}</h2><span class="muted">${key==='posts'?'PV / UV':'阅读量占比'}${rows.length===50?' · 前 50 项':''}</span></div>${rows.length?`<ol>${rows.slice(0,5).map(row).join('')}</ol>${rows.length>5?`<details><summary>展开其余 ${rows.length-5} 项</summary><ol start="6">${rows.slice(5).map((r,i)=>row(r,i+5)).join('')}</ol></details>`:''}`:'<p class="analytics-empty">此时间段暂无数据</p>'}</section>`;
}
function renderHome(){
  const w=analyticsData?.windows?.[analyticsWindow];
  const controls=singlePicker('analytics-window','统计时间段',analyticsWindow,['今天','近24小时','近7天','近15天','近30天','近半年'].map(x=>[x,x]))+`<button class="btn" data-action="refresh-analytics" ${analyticsLoading?'disabled':''}>${icon('undo')}${analyticsLoading?'更新中…':'刷新数据'}</button>`;
  const header=head('阅读概览','',controls);
  const notice=analyticsError?`<div class="analytics-notice" role="status">${escape(analyticsError)}${analyticsData?' 当前显示上次成功获取的数据。':''}</div>`:'';
  if(!w)return header+notice+`<div class="analytics-empty" role="status">${analyticsLoading?'正在读取线上阅读数据…':'暂无可用统计，点击刷新数据重试。'}</div>`;
  return header+notice+`<div class="analytics-metrics">${[['阅读量','PV',w.views],['独立访客','UV',w.visitors],['访问次数','sessions',w.visits]].map(([label,unit,n])=>`<div><span>${label} <small>${unit}</small></span><strong>${n.toLocaleString('zh-CN')}</strong></div>`).join('')}</div><section class="analytics-trend"><div class="analytics-section-head"><h2>阅读趋势</h2><div class="segmented"><button data-analytics-metric="views" class="${analyticsMetric==='views'?'active':''}" aria-pressed="${analyticsMetric==='views'}">阅读量 PV</button><button data-analytics-metric="visitors" class="${analyticsMetric==='visitors'?'active':''}" aria-pressed="${analyticsMetric==='visitors'}">访客 UV</button></div></div>${renderTrend(w.timeseries)}</section><div class="analytics-rankings">${renderRanking(w.posts,'posts','热门文章',w.views)}${renderRanking(w.country,'country','国家 / 地区',w.views)}${renderRanking(w.city,'city','城市',w.views)}${renderRanking(w.language,'language','访客语言',w.views)}</div><div class="analytics-foot"><span>更新于 ${escape(new Date(analyticsData.generatedAt).toLocaleString('zh-CN'))} · 本机时区 · 15 分钟缓存</span></div><div class="analytics-shortcuts"><a href="#writing">博文 ${icon('arrow')}</a><a href="#thoughts">随想 ${icon('arrow')}</a><a href="#drafts">本地草稿 ${icon('arrow')}</a></div>`;
}
function renderList(){
  const kind=page==='thoughts'?'thought':'writing';const collection=kind+(language==='en'?'-en':'');
  const rows=documents.filter(x=>collectionOf(x.id)===collection&&(!query||String(x.meta?.title||x.id).toLowerCase().includes(query.toLowerCase()))&&(format==='all'||x.format===format)).sort((a,b)=>String(b.meta?.pubDate||'').localeCompare(String(a.meta?.pubDate||'')));
  const pages=Math.max(1,Math.ceil(rows.length/25));pageNumber=Math.min(pageNumber,pages);const shown=rows.slice((pageNumber-1)*25,pageNumber*25);
  return head(page==='thoughts'?'随想':'博文',`src/content/${collection}/`,btn('草稿','drafts','file')+btn('导入','import','upload')+btn('新建','new','plus','primary'))+`<div class="tabs-row"><div class="segmented"><button data-language="zh" class="${language==='zh'?'active':''}">中文</button><button data-language="en" class="${language==='en'?'active':''}">英文</button></div><div class="filter-tools"><label class="searchbox">${icon('search')}<input id="list-query" aria-label="搜索内容" placeholder="搜索标题…" value="${escape(query)}"></label>${singlePicker('format-filter','文件格式',format,[['all','全部格式'],['md','markdown','.md'],['mdx','mdx','.mdx']])}</div></div>${selected.size?`<div class="bulkbar">已选择 ${selected.size} 篇${btn('移至回收站','bulk-delete','trash','sm')}${btn('取消选择','clear-selection','','sm')}</div>`:''}<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="select-page" aria-label="选择本页"></th><th>标题</th><th>语言版本</th><th>发布日期</th><th>格式</th><th>操作</th></tr></thead><tbody>${shown.map(item=>`<tr><td><input type="checkbox" data-select="${escape(item.id)}" aria-label="选择 ${escape(item.meta?.title||item.id)}" ${selected.has(item.id)?'checked':''}></td><td><button class="content-title" data-open="${escape(item.id)}"><span><strong>${escape(item.meta?.title||item.id)}</strong><small>${escape(item.error||item.id)}</small></span></button></td><td>${tag(counterpart(item.id)?'中 / en':'单一版本',counterpart(item.id)?'':'muted-tag')}</td><td class="muted">${escape(String(item.meta?.pubDate||'').slice(0,10))}</td><td>${tag(item.format||'error','muted-tag')}</td><td><button class="row-menu" data-delete="${escape(item.id)}" aria-label="删除 ${escape(item.meta?.title||item.id)}">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>${rows.length?'':`<div class="empty">${icon('file')}<h2>没有匹配内容</h2><p>新建一篇内容，或调整搜索条件。</p></div>`}<div class="table-footer"><span>共 ${rows.length} 篇</span><div class="pagination"><button data-action="prev-page" ${pageNumber===1?'disabled':''} aria-label="上一页">${icon('left')}</button>${pageNumber} / ${pages}<button data-action="next-page" ${pageNumber===pages?'disabled':''} aria-label="下一页">${icon('right')}</button></div></div>`;
}
function renderEditor(){
  if(!doc)return head('编辑内容','先从列表打开内容。')+btn('博文列表','writing','file');
  const sibling=counterpart(doc.id);return head(doc.meta.title?'编辑'+sourceName(doc.id):'新建'+sourceName(doc.id),doc.id,btn('文档属性','toggle-properties','settings')+btn(chatOpen?'收起 AI':'AI 讨论','toggle-chat','spark')+btn('保存草稿','draft','file')+btn('真实预览','preview','eye')+`<button class="btn primary" data-action="save" ${pending?'disabled':''}>${icon('check')}${pending?'保存中…':'保存文件'}</button>`)+`<div class="editor-workbench ${chatOpen?'has-chat':''}"><div class="split-layout"><section><div class="paper"><div class="editor-body">${metaField('标题','title')}<div class="format-toolbar"><button data-format="heading" aria-label="二级标题">h₂</button><button data-format="bold" aria-label="加粗"><b>b</b></button><button data-format="quote" aria-label="引用">“</button><button data-format="code" aria-label="代码块">${icon('code')}</button><button data-action="upload" aria-label="上传图片">${icon('image')}</button><button data-action="components" aria-label="插入组件">${icon('blocks')}</button><button data-format="math" aria-label="块级公式">∑</button><span class="muted editor-drop-hint">拖入图片 / 粘贴截图</span><div class="segmented editor-modes"><button data-action="mode-markdown" class="${editorMode==='markdown'?'active':''}" aria-pressed="${editorMode==='markdown'}">Markdown</button><button data-action="mode-rich" class="${editorMode==='rich'?'active':''}" aria-pressed="${editorMode==='rich'}">富文本</button></div></div>${editorMode==='rich'?'<div id="rich-editor"><p class="muted">正在排版…</p></div>':`<textarea class="source-editor" id="post-body" spellcheck="false" aria-label="正文">${escape(doc.body)}</textarea>`}<div id="upload-status" class="muted" role="status">${uploadCount?'正在上传 '+uploadCount+' 张图片…':''}</div></div><div class="editor-foot"><span>${escape(doc.id)}</span><span id="save-status">${dirty?'有未保存修改':'已载入文件'}</span><span id="character-count">${doc.body.length} 字符</span></div></div></section><aside id="editor-properties"><button class="btn icon properties-close" data-action="toggle-properties" aria-label="收起文档属性">${icon('close')}</button><section class="side-section"><h3>文档属性 ${tag(doc.id.endsWith('.mdx')?'mdx':'md','muted-tag')}</h3>${field('文件名（不随标题变化）','filename',stemOf(doc.id),'text',doc.revision!==null||doc.assetsLocked?'readonly':'')}${metaField('发布日期','pubDate','datetime-local')}${isThought(doc.id)?metaField('分类','category'):metaField('封面 URL','heroImage')}<label class="field"><span>frontmatter（保留其他字段）</span><textarea id="extra-meta" rows="6" aria-label="frontmatter JSON">${escape(JSON.stringify(doc.meta,null,2))}</textarea></label></section><section class="side-section"><h3>语言版本</h3><p class="muted">当前：${isEnglish(doc.id)?'英文':'简体中文'}</p>${sibling?`<button class="side-action" data-open="${escape(sibling.id)}">${icon('translate')}打开${isEnglish(doc.id)?'中文':'英文'}版本</button>`:'<p class="mode-note">暂无关联版本</p>'}${!isEnglish(doc.id)?`<button class="side-action" data-action="translations">${icon('spark')}翻译为英文</button>`:''}</section><section class="side-section"><h3>文档操作</h3><button class="side-action" data-action="versions">${icon('clock')}历史版本</button>${doc.revision?`<button class="side-action danger-text" data-delete="${escape(doc.originalId||doc.id)}">${icon('trash')}移至回收站</button>`:''}<button class="side-action" data-action="media">${icon('image')}当前共享图片</button></section></aside></div>${chatOpen?renderChat():''}</div>`;
}
function renderAssets(){
  const visible=assets.filter(x=>!assetFolder||x.folder===assetFolder);const folders=[...new Set(assets.map(x=>x.folder))];return head('图片资源','上传后归档到文章对应目录；中英文共用。',btn('刷新','refresh-assets','undo')+btn('上传到当前文章','upload','upload','primary'))+`<div class="media-layout"><aside class="folder-list"><h3>内容目录</h3><button class="folder ${!assetFolder?'active':''}" data-folder="">${icon('folder')}全部图片</button>${folders.map(x=>`<button class="folder ${assetFolder===x?'active':''}" data-folder="${escape(x)}">${icon('folder')}<span>${escape(x)}</span></button>`).join('')}</aside><section><p class="muted">${visible.length} 张 · ${doc?'当前文章：'+escape(doc.meta.title||stemOf(doc.id)):'先打开一篇内容再上传'}</p><div class="media-grid section-space">${visible.map((item,index)=>`<button class="media-card" data-asset="${assets.indexOf(item)}"><img src="${escape(item.url)}" alt="${escape(item.name)}" loading="lazy"><div class="media-info"><strong>${escape(item.name)}</strong><small>${Math.ceil(item.size/1024)} kb · ${item.refs.length} 处引用</small></div></button>`).join('')}</div>${visible.length?'':'<div class="empty"><h2>这个目录还没有图片</h2><p>可从编辑页面拖入或粘贴。</p></div>'}</section></div>`;
}
function chatKey(){return doc?.id.replace(/\.mdx?$/,'');}
function currentChat(){const key=chatKey();if(!chats.has(key))chats.set(key,{messages:[],input:'',pending:'',includeBody:true,images:new Set(),available:[],error:'',model:null});return chats.get(key);}
function renderChat(){const state=currentChat();return `<aside class="chat-panel" aria-label="AI 写作讨论"><header><div><h2>一起推敲这篇内容</h2><span class="muted">${escape(config.model||'请先设置模型')}</span></div><button class="btn icon" data-action="toggle-chat" aria-label="收起 AI 讨论">${icon('close')}</button></header><div class="chat-log" role="log" aria-label="对话记录">${state.messages.length?'':'<div class="chat-empty"><h3>从一个问题开始</h3><p>讨论结构、核对观点，或看看图片怎样配文。建议不会自动改写正文。</p></div>'}${state.messages.map(m=>`<article class="chat-message ${m.role}"><span>${m.role==='user'?'你':'AI'}</span><div class="${m.role==='assistant'?'chat-markdown':''}">${m.role==='assistant'&&m.html?m.html:escape(m.text)}</div></article>`).join('')}${state.pending?`<article class="chat-message user"><span>你</span><div>${escape(state.pending)}</div></article><p class="muted" role="status">正在思考…</p>`:''}</div>${state.model?`<div class="chat-model muted">配置：${escape(state.model.configuredModel)} · 返回：${escape(state.model.returnedModel)}</div>`:''}<div class="chat-context"><label><input type="checkbox" id="chat-body" ${state.includeBody?'checked':''}>附带当前正文</label><button class="btn sm" data-action="chat-images">选择正文图片${state.images.size?' · '+state.images.size:''}</button>${state.available.length?`<div class="chat-images">${state.available.map(image=>`<label title="${escape(image.name)}"><input type="checkbox" data-chat-image="${escape(image.url)}" ${state.images.has(image.url)?'checked':''} ${image.size>4*1024*1024?'disabled':''}><img src="${escape(image.url.startsWith('/_posts/')||image.url.startsWith('/_thoughts/')?image.url:'/site'+image.url)}" alt="${escape(image.name)}"><span>${escape(image.name)}</span></label>`).join('')}</div>`:''}</div>${state.error?`<p class="chat-error" role="alert">${escape(state.error)}</p>`:''}<div class="chat-compose"><label class="sr-only" for="chat-input">讨论问题</label><textarea id="chat-input" placeholder="这里的论证够充分吗？" rows="3" maxlength="20000">${escape(state.input)}</textarea><div class="chat-send"><button class="btn sm" data-action="clear-chat" ${state.pending?'disabled':''}>新建讨论</button>${state.pending?btn('停止','cancel-chat','close'):btn('发送','send-chat','arrow','primary')}</div></div></aside>`;}
function updateChat(){const panel=$('.chat-panel');if(panel&&chatOpen&&page==='editor'){panel.outerHTML=renderChat();const log=$('.chat-log');log.scrollTop=log.scrollHeight;}}
async function sendChat(){
  ensureDoc();if(chatController)return;const state=currentChat(),question=state.input.trim();if(!question)throw new Error('先写下想讨论的问题');
  if(state.messages.length>=18)throw new Error('本对话已达到长度限制，请新建讨论');
  const controller=new AbortController();chatController=controller;state.pending=question;state.input='';state.error='';updateChat();
  try{const result=await api('chat',{document:structuredClone(doc),includeBody:state.includeBody,images:[...state.images],messages:[...state.messages,{role:'user',text:question}]},{signal:controller.signal});state.messages.push({role:'user',text:question},{role:'assistant',text:result.text,html:result.html});state.model=result;}
  catch(error){state.error=error.name==='AbortError'?'已停止；可以修改问题后重试。':error.message;if(!state.input)state.input=question;}
  finally{state.pending='';if(chatController===controller)chatController=null;updateChat();}
}
function componentSnippet(){
  const text=componentText;const literal=value=>JSON.stringify(value);
  if(component==='Highlight')return `<Highlight color="${componentColor}">{${literal(text)}}</Highlight>`;
  if(component==='Sidenote')return `<Sidenote id={${literal($('#component-id')?.value||'1')}}>{${literal(text)}}</Sidenote>`;
  if(component==='RevealQuote')return `<RevealQuote teaser={${literal(componentTeaser)}} quote={${literal(text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'))}} />`;
  return `<${component} />`;
}
function componentFrameURL(){const params=new URLSearchParams({component,text:componentText,teaser:componentTeaser,color:componentColor});return componentPreviewURL+'?'+params;}
function syncComponentPreview(){clearTimeout(componentTimer);componentTimer=setTimeout(()=>{const frame=$('#component-live');if(frame&&componentPreviewURL)frame.src=componentFrameURL();},300);}
async function startComponents(){if(componentLoading)return;componentLoading=true;refreshComponents();try{componentPreviewURL=(await api('component-preview',{})).url;}finally{componentLoading=false;refreshComponents();}}
function renderComponents(inDialog=false){return (inDialog?'':head('组件库','使用项目原组件与样式，预览区可直接操作；插入时自动转换为 mdx。',doc?btn('返回编辑','editor','left'):''))+`<div class="component-layout"><section><div class="component-tabs" role="group" aria-label="选择组件">${componentNames.map(name=>`<button data-component="${name}" aria-pressed="${component===name}">${componentLabels[name]||name}</button>`).join('')}</div><div class="component-live-head"><h2>${componentLabels[component]}</h2><span class="path">${component}</span></div>${componentPreviewURL?`<iframe id="component-live" class="component-live" title="${componentLabels[component]}实际效果" src="${escape(componentFrameURL())}" sandbox="allow-scripts allow-same-origin"></iframe>`:`<div class="empty"><h2>${componentLoading?'正在编译真实组件…':'组件预览已暂停'}</h2><p>按需启动一个隔离 Astro 进程，关闭窗口时自动停止。</p>${btn(componentLoading?'编译中…':'启动组件预览','start-components','eye')}</div>`}</section><aside class="component-inspector"><h3>${componentLabels[component]}</h3>${['Highlight','Sidenote','RevealQuote'].includes(component)?field('内容','component-text',componentText):''}${component==='Highlight'?`<div class="field"><span>颜色</span>${singlePicker('component-color','高亮颜色',componentColor,[['yellow','黄色'],['green','绿色'],['pink','粉色'],['blue','蓝色']])}</div>`:''}${component==='Sidenote'?field('编号','component-id',String(Math.max(0,...[...(doc?.body||'').matchAll(/<Sidenote\s+id=(?:"(\d+)"|\{"(\d+)"\})/g)].map(x=>Number(x[1]||x[2])))+1)):''}${component==='RevealQuote'?field('显示文字','component-teaser',componentTeaser):''}<p class="component-help">${componentHelp[component]}</p><h4 class="component-example">用法示例</h4><div class="code-box" id="component-code">${escape(componentSnippet())}</div><div class="notice">将在之前记录的光标位置插入，并添加组件 import。${doc?'当前：'+escape(doc.meta.title||stemOf(doc.id)):'请先打开或新建内容。'}</div>${btn('插入文档','insert-component','plus','primary button-full section-space')}</aside></div>`;}
function renderTranslation(){
  if(!doc)return head('翻译工作台','先从列表打开一篇中文内容。')+btn('打开博文','writing','file');
  return head('翻译工作台',doc.id,btn('模型设置','settings','settings')+btn('返回编辑','editor','left'))+`<div class="notice">正文将发送到 ${escape(config.endpoint)}。配置模型：${escape(config.model)}。公式、代码、链接和组件会作为不可改写结构保护。</div><div class="translation-controls section-space">${btn(translationController?'重新生成（取消当前）':'生成英文版','translate','spark','primary')}${translationController?btn('取消生成','cancel-translate','close'):''}<span class="muted" id="translation-progress">${translation?.progress||''}</span></div><div id="model-report" class="notice ${translation?.models?.some(x=>x.returnedModel!==x.configuredModel)?'warm':''}">${escape(modelReport())}</div><div class="translation-grid section-space"><section class="translation-pane"><header>中文原文 · 只读</header><div class="translation-copy"><h2>${escape(doc.meta.title)}</h2><pre class="translation-source">${escape(doc.body)}</pre></div></section><section class="translation-pane"><header>英文 · 人工校对</header><div class="translation-copy">${translation?.document?field('标题','translated-title',translation.document.meta.title)+(isThought(doc.id)?'':field('摘要','translated-description',translation.document.meta.description))+(isThought(doc.id)?field('分类','translated-category',translation.document.meta.category):'')+`<textarea id="translated-body" class="translation-source" aria-label="英文正文">${escape(translation.document.body)}</textarea>`:'<p class="muted">译文会先在这里显示，确认后才写入英文集合。</p>'}</div></section></div><div class="translation-bottom"><span class="path">${translation?.document?escape('src/content/'+translation.document.id):''}</span><div class="actions">${translation?.document?btn('预览译文','preview-translated','eye')+btn('确认保存英文版','save-translated','check','primary'):''}</div></div>`;
}
function modelReport(){const models=translation?.models;if(!models?.length)return '接口返回的 model 将与配置模型并列展示。';return [...new Set(models.map(x=>`配置：${x.configuredModel} / 返回：${x.returnedModel}`))].join('；');}
function renderPreview(){return head('本地预览',doc?doc.id:'请选择内容',doc?btn('返回编辑','editor','left')+btn('重新编译当前内容','build-preview','undo','primary'):'')+`<div class="preview-controls"><span class="preview-address">${escape(previewURL||'尚未启动隔离预览')}</span><div class="actions"><button class="btn sm" data-action="preview-device">${icon(previewMobile?'desktop':'mobile')}${previewMobile?'桌面宽度':'手机宽度'}</button>${previewURL?`<a class="btn sm" href="${escape(previewURL)}" target="_blank" rel="noopener">独立窗口</a>`:''}</div></div><div class="preview-canvas">${previewURL?`<iframe class="live-preview ${previewMobile?'phone':''}" title="真实 Astro 页面预览" src="${escape(previewURL)}" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`:`<div class="empty"><h2>${pending?'正在启动 Astro…':'使用真实站点布局预览'}</h2><p>内容保存在隔离工作区，使用同一套布局、MDX 组件、图片与 KaTeX 渲染。不会写入正式集合。</p>${doc?`<button class="btn primary" data-action="build-preview" ${pending?'disabled':''}>启动预览</button>`:''}</div>`}</div>`;}
function renderSettings(){return head('设置','模型配置和密钥保存在本机，重启后自动恢复。',btn('保存设置','save-settings','check','primary'))+`<div class="settings-layout"><nav class="settings-nav"><a href="#settings">自定义 Claude</a><a href="#drafts">本地草稿</a></nav><div><section class="settings-section"><h2>Anthropic Messages</h2><p>使用 x-api-key 与 anthropic-version，不使用 OpenAI Chat Completions。</p>${field('基础 endpoint','model-endpoint',config.endpoint,'url')}${field('配置模型','model-name',config.model)}${field('max_tokens（输出达到上限时阻止保存）','model-max',config.maxTokens,'number','min="256" max="32000"')}${field('API key（留空保留已保存密钥）','model-key','','password','autocomplete="new-password"')}<p class="muted">${config.hasKey?'已配置密钥，重启后可继续使用':'未配置密钥，可设置环境变量 STUDIO_LLM_API_KEY 或在此输入。'} · 完整密钥不会回显，也不会随网站发布。</p><div class="actions section-space">${btn('测试当前已保存配置','test-model','link')}${btn('清除保存的密钥','clear-key','trash','ghost')}</div><div id="test-result" class="notice section-space">最终路径追加 /v1/messages；配置与返回模型名不同时允许使用并提示。</div></section><section class="settings-section"><h2>本地文件与恢复</h2><p>正式内容：src/content。图片：public/_posts 与 public/_thoughts。草稿、备份、回收站及预览位于 .local-studio。</p><div class="notice">只绑定 127.0.0.1。保存不会提交 Git、推送或部署。覆盖前保留旧版本，冲突时停止保存。</div></section></div></div>`;}
function renderDrafts(){return head('本地草稿','位于 .local-studio/drafts，不参与站点构建。')+(drafts.length?`<div class="table-wrap"><table><thead><tr><th></th><th>文档</th><th>备份时间</th><th>操作</th></tr></thead><tbody>${drafts.map(x=>`<tr><td></td><td><button data-draft="${escape(x.id)}" class="link">${escape(x.meta?.title||x.id)}</button><div class="path">${escape(x.id)}</div></td><td>${escape(x.savedAt||'')}</td><td><button class="btn sm" data-discard="${escape(x.id)}">丢弃草稿</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><h2>暂无本地草稿</h2><p>编辑内容后会自动备份草稿，也可手动保存。</p></div>');}
function renderTrash(){return head('回收站','内容可以恢复，图片默认保留。',trash.length?btn('永久清空','clear-trash','trash'):'')+(trash.length?`<div class="table-wrap"><table><thead><tr><th></th><th>内容</th><th>移除时间</th><th>操作</th></tr></thead><tbody>${trash.map(x=>`<tr><td></td><td>${x.ids.map(escape).join('<br>')}</td><td>${escape(x.date)}</td><td><button class="btn sm" data-restore="${x.token}">恢复</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><h2>回收站为空</h2><p>删除内容会先移到这里，不直接永久删除。</p></div>');}
function dropPosition(area,x,y){
  const box=area.getBoundingClientRect(),style=getComputedStyle(area),mirror=document.createElement('div');
  for(const property of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','padding','border','boxSizing','wordSpacing','tabSize'])mirror.style[property]=style[property];
  Object.assign(mirror.style,{position:'fixed',left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',whiteSpace:'pre-wrap',overflowWrap:'break-word',overflow:'hidden',opacity:'0',zIndex:'9999'});
  const text=document.createTextNode(area.value+'\n');mirror.append(text);document.body.append(mirror);mirror.scrollTop=area.scrollTop;
  const caret=document.caretPositionFromPoint?.(x,y);const range=!caret?document.caretRangeFromPoint?.(x,y):null;
  const node=caret?.offsetNode||range?.startContainer;const position=node===text?(caret?.offset??range.startOffset):area.selectionStart;mirror.remove();return Math.min(area.value.length,position);
}
function focusQuickWrite(){
  if(!quickFocus)return;
  const target=quickFocus==='writing'?$('#meta-title'):$('#post-body')||$('#rich-editor .rich-document');
  if(target){target.focus();quickFocus='';}
}
function bindEditor(){
  if($('#rich-editor')){void handle(async()=>{try{await mountRich();}catch(error){editorMode='markdown';render();throw error;}});return;}
  const area=$('#post-body');if(!area)return;
  area.setSelectionRange(sourcePosition,sourcePosition);area.scrollTop=editorScroll.get(doc.id+':markdown')||0;focusQuickWrite();
  area.addEventListener('select',()=>sourcePosition=area.selectionStart);
  area.addEventListener('click',()=>sourcePosition=area.selectionStart);
  area.addEventListener('keyup',()=>sourcePosition=area.selectionStart);
  area.addEventListener('paste',event=>{const files=[...event.clipboardData.items].filter(x=>x.kind==='file').map(x=>x.getAsFile()).filter(x=>x&&x.type.startsWith('image/'));if(files.length){event.preventDefault();void handle(()=>uploadImages(files,area.selectionStart));}});
  area.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('Files')){event.preventDefault();area.classList.add('dragover');}});
  area.addEventListener('dragleave',()=>area.classList.remove('dragover'));
  area.addEventListener('drop',event=>{area.classList.remove('dragover');if(!event.dataTransfer.files.length)return;event.preventDefault();void handle(()=>uploadImages([...event.dataTransfer.files],dropPosition(area,event.clientX,event.clientY)));});
}
async function uploadImages(files,position=sourcePosition){
  ensureDoc();const current=doc;current.assetsLocked=true;const anchor={id:current.id,pos:position};anchors.push(anchor);uploadCount+=files.length;
  const updateStatus=()=>{if($('#upload-status'))$('#upload-status').textContent=uploadCount?'正在上传 '+uploadCount+' 张图片…':'';};updateStatus();
  try{
    for(const file of files){
      try{
        if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)&&!(file.type===''&&/\.(png|jpe?g|webp|gif)$/i.test(file.name)))throw new Error('仅支持 png / jpg / webp / gif');
        const form=new FormData();form.set('id',current.id);form.set('file',file);
        const result=await api('upload',form);
        const text=`\n\n![${file.name.replace(/[\[\]\n]/g,'').replace(/\.[^.]+$/,'')||'图片说明'}](${result.url})\n\n`;
        const next=current.body.slice(0,anchor.pos)+text+current.body.slice(anchor.pos);
        if(doc===current){const insertedAt=anchor.pos;updateBody(next);anchor.pos=insertedAt+text.length;const area=$('#post-body');if(area){area.value=doc.body;area.setSelectionRange(anchor.pos,anchor.pos);sourcePosition=anchor.pos;}else if(editorMode==='rich'&&page==='editor')await mountRich();}
        else{current.body=next;anchor.pos+=text.length;await api('draft',current);}
        toast((result.reused?'复用相同图片：':'已复制图片：')+result.name);
      }catch(error){toast('上传失败，可重新拖入重试：'+error.message);}
      finally{uploadCount--;updateStatus();}
    }
    await api('draft',current);if(page==='media'){assets=await api('assets');render();}
  }finally{anchors.splice(anchors.indexOf(anchor),1);}
}
async function loadPage(next){await persistTranslation();page=next;if(page==='translations'&&doc&&!translation?.document&&!translationController)translation=await restoreTranslation();if(page==='media')assets=await api('assets');if(page==='trash')trash=await api('trash');if(page==='drafts')await refresh();render();if(page==='collections')void loadAnalytics();if(page==='components'&&!componentPreviewURL)await startComponents();}
async function buildPreview(document=doc){
  if(!document)throw new Error('请先打开内容');const ownerId=doc?.id;previewURL='';pending=true;page='preview';if(location.hash!=='#preview')location.hash='preview';render();
  try{const result=await api('preview',document);if(doc?.id!==ownerId)return;previewURL=result.url;toast('真实 Astro 预览已就绪');}finally{pending=false;render();}
}
async function generateTranslation(){
  ensureDoc();if(isEnglish(doc.id))throw new Error('请选择中文内容');await persistTranslation();const previous=translation,source=structuredClone(doc);translationController?.abort();const controller=new AbortController();translationController=controller;translation={progress:'准备翻译…',models:[]};render();
  try{
    const response=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json','x-studio-token':window.STUDIO_TOKEN},body:JSON.stringify(source),signal:controller.signal});
    if(!response.ok){const error=await response.json();throw new Error(error.error);}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',completed=false;
    while(true){const {value,done}=await reader.read();if(translationController!==controller||doc?.id!==source.id)return;buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);if(event.type==='error')throw new Error(event.error);if(event.type==='progress'){translation.progress=event.total?`正文 ${event.done} / ${event.total}`:'翻译标题与摘要…';translation.models=event.models||[];if($('#translation-progress'))$('#translation-progress').textContent=translation.progress;if($('#model-report'))$('#model-report').textContent=modelReport();}if(event.type==='result'){translation={...event,source,progress:'翻译完成，正在暂存…'};await persistTranslation();translation.progress='译文已自动暂存，等待人工校对';completed=true;}}if(done)break;}
    if(!completed)throw new Error('翻译连接中断，未收到完整结果');toast('译文已自动暂存，确认保存后才写入英文集合');
  }catch(error){if(translationController===controller&&!translation?.document)translation=previous;if(error.name==='AbortError')toast('已取消翻译');else throw error;}
  finally{if(translationController===controller)translationController=null;if(page==='translations')render();}
}
async function deleteDocuments(items){
  if(!items.length)return;modal('移至回收站？',`<p class="dialog-copy">将移除以下本地文件，关联图片保留。</p><div class="path">${items.map(x=>escape(x.id)).join('<br>')}</div><label class="checkline"><input id="delete-english" type="checkbox">同时移除对应英文版本</label>`,btn('取消','close')+btn('确认移除','confirm-delete','trash','danger'));
  $('#modal [data-action="confirm-delete"]').onclick=()=>handle(async()=>{
    const english=$('#delete-english').checked;for(const item of items)await api('delete',{id:item.id,revision:item.revision,english});
    close();selected.clear();if(doc&&items.some(x=>x.id===(doc.originalId||doc.id))){clearTimeout(draftTimer);doc=null;dirty=false;}
    await refresh();go('trash');trash=await api('trash');render();toast('已移至本地回收站');
  });
}
async function showAsset(index){
  const asset=assets[index];modal('图片详情',`<img class="modal-image" src="${escape(asset.url)}" alt="${escape(asset.name)}"><p class="path">public${escape(decodeURIComponent(asset.url))}</p><p class="dialog-copy section-space">${asset.refs.length?'引用文档：'+asset.refs.map(escape).join('、'):'尚未被已保存内容引用'}</p>${field('替代文本','asset-alt',asset.name)}`,btn('关闭','close')+btn('移除未引用图片','delete-image','trash')+btn('插入当前文档','insert-image','plus','primary'));
  $('#modal [data-action="insert-image"]').onclick=()=>handle(async()=>{ensureDoc();const alt=$('#asset-alt').value.replace(/[\[\]\n]/g,'');updateBody(doc.body.slice(0,sourcePosition)+`\n\n![${alt}](${asset.url})\n\n`+doc.body.slice(sourcePosition));close();go('editor');});
  $('#modal [data-action="delete-image"]').onclick=()=>handle(async()=>{await api('delete-asset',{url:asset.url});close();assets=await api('assets');render();toast('已移至本地 removed-images，可从磁盘找回');});
}
async function importFiles(files){
  const collection=(page==='thoughts'?'thought':'writing')+(language==='en'?'-en':'');let count=0;let first=null;const errors=[];
  for(const file of files){try{if(!/\.mdx?$/i.test(file.name)||file.size>2_000_000)throw new Error('需要 2 mb 内的 md / mdx');const parsed=await api('parse',{id:collection+'/'+file.name,raw:await file.text()});parsed.originalId=parsed.id;parsed.revision=null;await api('draft',parsed);first??=parsed;count++;}catch(error){errors.push(file.name+'：'+error.message);}}
  await refresh();if(first){await preserve();doc=first;dirty=true;go('editor');}if(errors.length)modal('导入结果',`<p class="dialog-copy">${count} 个文件已读取到草稿，尚未写入正式集合。</p><p>${errors.map(escape).join('<br>')}</p>`,btn('关闭','close'));else toast(`已导入 ${count} 个草稿；检查后保存，同名文件不会覆盖`);
}
async function versions(){ensureDoc();const list=await api('versions?id='+encodeURIComponent(doc.originalId||doc.id));modal('历史版本',`<p class="dialog-copy">覆盖前自动备份。选择版本只载入编辑器，确认保存后才替换当前文件。</p>${list.map((x,i)=>`<button class="search-result" data-version="${i}">${escape(x.date)} · ${escape(x.id)}</button>`).join('')||'<p class="muted">尚无历史版本</p>'}`);$$('[data-version]',$('#modal')).forEach(button=>button.onclick=()=>handle(async()=>{const version=list[Number(button.dataset.version)];const parsed=await api('parse',{id:doc.id,raw:version.raw});doc.meta=parsed.meta;updateBody(parsed.body);close();render();toast('已载入历史版本，保存前不会覆盖文件');}));}
function showSearch(){modal('搜索内容',`<label class="searchbox">${icon('search')}<input id="global-query" placeholder="搜索标题…" style="width:100%" aria-label="搜索全部内容"></label><div id="global-results" class="search-results"></div>`);const draw=()=>{$('#global-results').innerHTML=documents.filter(x=>String(x.meta?.title||x.id).toLowerCase().includes($('#global-query').value.toLowerCase())).slice(0,40).map(x=>`<button class="search-result" data-open="${escape(x.id)}">${icon('file')}${escape(x.meta?.title||x.id)}</button>`).join('');};$('#global-query').oninput=draw;draw();$('#global-query').focus();}

const componentHelp={
  Highlight:'为行内文字添加高亮。选择颜色并填写内容；放在段落中即可使用。',
  Sidenote:'在正文中显示旁注标记，阅读时展开注释。每条旁注使用唯一编号，内容填写注释文字。',
  RevealQuote:'先显示提示语，点击后展开引用。填写提示语与引用原文。',
  DecisionToggle:'可交互的二选一决策演示。独立成段插入，无需参数；点击选项查看反馈。',
  FlipCards:'点击翻转卡片查看正反两面的内容。独立成段插入，无需参数。',
  EnergyMeter:'拖动能量控制条，体验不同状态下的效果。独立成段插入，无需参数。',
  DecisionForm:'填写决策问题并查看交互反馈。独立成段插入，无需参数。',
  AgentSimulation:'运行项目内置的智能体模拟。独立成段插入，在预览中使用运行与重置操作。',
  CommitCompare:'展示提交前后的代码对比。独立成段插入，无需参数，在预览中切换查看。',
};
function showComponents(){
  modal('插入组件',renderComponents(true));componentDialog=true;$('#modal').classList.add('component-dialog');
}
function refreshComponents(){if(componentDialog)showComponents();else if(page==='components')render();}
function capturePosition(normalize=true){if(editorMode==='rich'&&richEditor&&richOwner===doc){if(normalize&&doc.body!==richEditor.getMarkdown()){updateBody(richEditor.getMarkdown());richBody=doc.body;}sourcePosition=richModule.markdownPosition(richEditor);}else sourcePosition=$('#post-body')?.selectionStart??sourcePosition;}
async function switchMode(mode){
  if(editorMode===mode)return;
  if(uploadCount)throw new Error('请等待图片上传完成');
  if(mode==='rich')await api('rich-prepare',{id:doc.id,body:doc.body});
  capturePosition(false);editorMode=mode;render();
}
async function mountRich(){
  const generation=++richGeneration, owner=doc,body=doc.body,host=$('#rich-editor');if(!host)return;
  richModule??=await import('/client/rich-editor.js');
  if(generation!==richGeneration||doc!==owner||!host.isConnected)return;
  if(richEditor&&richOwner===owner&&richBody===body){host.replaceChildren();richEditor.mount(host);host.scrollTop=editorScroll.get(owner.id+':rich')||0;focusQuickWrite();return;}
  const prepared=await api('rich-prepare',{id:owner.id,body});
  if(generation!==richGeneration||doc!==owner||doc.body!==body||!host.isConnected)return;
  richEditor?.destroy();host.replaceChildren();richOwner=owner;richBody=body;
  richEditor=richModule.createRich(host,prepared,{
    documentId:owner.id,
    onUpdate:({editor})=>{if(doc!==owner)return;updateBody(editor.getMarkdown());richBody=doc.body;sourcePosition=richModule.markdownPosition(editor);},
    onSelectionUpdate:({editor})=>{if(doc===owner)sourcePosition=richModule.markdownPosition(editor);},
    onEditRaw:(raw,apply)=>{modal('编辑源码','<label class="field"><span>组件 / 公式源码</span><textarea id="raw-source" rows="10"></textarea></label>',btn('取消','close')+btn('应用','apply-raw','check','primary'));$('#raw-source').value=raw;$('#modal [data-action="apply-raw"]').onclick=()=>handle(async()=>{apply($('#raw-source').value);close();});},
    editorProps:{handlePaste:(view,event)=>{const files=[...event.clipboardData?.files||[]].filter(x=>x.type.startsWith('image/'));if(!files.length)return false;event.preventDefault();capturePosition();void handle(()=>uploadImages(files));return true;},handleDrop:(view,event)=>{const files=[...event.dataTransfer?.files||[]];if(!files.length)return false;event.preventDefault();const pos=view.posAtCoords({left:event.clientX,top:event.clientY});if(pos)richEditor.commands.setTextSelection(pos.pos);capturePosition();void handle(()=>uploadImages(files));return true;}},
  });
  host.scrollTop=editorScroll.get(owner.id+':rich')||0;focusQuickWrite();
}
function formatRich(type){
  if(!richEditor)return;const chain=richEditor.chain().focus();
  if(type==='heading')chain.toggleHeading({level:2}).run();
  if(type==='bold')chain.toggleBold().run();
  if(type==='quote')chain.toggleBlockquote().run();
  if(type==='code')chain.toggleCodeBlock().run();
  if(type==='math')chain.insertContent({type:'rawBlock',attrs:{kind:'math',raw:'$$\nE = mc^2\n$$'}}).run();
}
async function showPublish(){
  publishState=await api('publish-status');
  if(publishState.running){showPublishProgress();pollPublish();return;}
  if(dirty)throw new Error('请先保存当前内容，再发布网站');
  publishPlan=await api('publish-plan');
  modal('发布网站','<p class="dialog-copy">执行 bun d：自动同步远程改动，构建网站，将项目全部改动提交并推送到 main，然后部署。请检查本次清单。</p><pre class="publish-files">'+escape(publishPlan.changes||'没有文件改动，仍将构建并部署')+'</pre><details class="publish-command"><summary>查看执行命令</summary><pre>'+escape(publishPlan.script)+'</pre></details>',btn('取消','close')+btn('确认发布','confirm-publish','upload','primary'));
}
async function startPublish(){
  if(!publishPlan)throw new Error('请先查看发布清单');
  publishState=await api('publish',{fingerprint:publishPlan.fingerprint,confirmation:'发布网站'});showPublishProgress();pollPublish();
}
function showPublishProgress(){
  modal(publishState.running?'正在发布网站':publishState.exitCode===0?'网站已发布':'发布未完成','<p class="dialog-copy" id="publish-summary">'+(publishState.running?'正在执行 bun d，完成前请保持应用运行。':publishState.exitCode===0?'构建、推送和部署已完成。':'命令已停止，请根据下方输出处理后重试。')+'</p><pre class="publish-files publish-log" id="publish-log"></pre>',btn('关闭','close')+(publishState.running?'':btn('重新查看清单','publish-review','undo')));$('#publish-log').textContent=publishState.log||'准备执行…';
}
function pollPublish(){
  clearTimeout(publishTimer);publishTimer=setTimeout(()=>handle(async()=>{
    try{publishState=await api('publish-status');$('#publish-site').textContent=publishState.running?'发布中…':'发布网站';const output=$('#publish-log');if(output){output.textContent=publishState.log;output.scrollTop=output.scrollHeight;if(!publishState.running)showPublishProgress();}if(publishState.running)pollPublish();else toast(publishState.exitCode===0?'网站发布完成':'发布失败，请查看输出');}
    catch(error){pollPublish();throw error;}
  }),1000);
}

async function handle(work){try{await work();}catch(error){toast(error.message||'操作失败');}finally{window.dispatchEvent(new Event('tidemark-idle'));}}
const actions={
  'refresh-analytics':()=>loadAnalytics(true),
  'publish-review':showPublish,
  publish:showPublish,'confirm-publish':startPublish,
  'mode-markdown':()=>switchMode('markdown'),'mode-rich':()=>switchMode('rich'),
  'start-components':startComponents,
  'toggle-properties':()=>{propertiesOpen=!propertiesOpen;document.body.classList.toggle('properties-open',propertiesOpen);},
  'toggle-chat':()=>{ensureDoc();chatOpen=!chatOpen;render();},
  'send-chat':sendChat,'cancel-chat':()=>chatController?.abort(),
  'clear-chat':()=>{if(chatController)return;chats.delete(chatKey());updateChat();},
  'chat-images':async()=>{const state=currentChat();state.available=await api('chat-images',{document:doc});state.images=new Set([...state.images].filter(url=>state.available.some(x=>x.url===url)));if(!state.available.length)toast('当前正文和封面没有可发送的本地图片');updateChat();},

  close,save:saveDoc,new:()=>chooseNew(page==='thoughts'?'thought':'writing'),drafts:()=>go('drafts'),draft:async()=>{ensureDoc();await api('draft',doc);await refresh();toast('已保存在本地草稿区，未写入正式集合');},
  writing:()=>go('writing'),editor:()=>go('editor'),components:async()=>{ensureDoc();capturePosition();componentDialog=true;showComponents();if(!componentPreviewURL)await startComponents();},media:()=>{if(doc)assetFolder=stemOf(doc.id);go('media');},translations:()=>{ensureDoc();go('translations');},settings:()=>go('settings'),preview:()=>buildPreview(),
  'build-preview':()=>buildPreview(),'preview-device':()=>{previewMobile=!previewMobile;render();},
  upload:()=>{ensureDoc();capturePosition();$('#image-input').click();},import:()=>$('#markdown-input').click(),
  'prev-page':()=>{pageNumber--;render();},'next-page':()=>{pageNumber++;render();},'clear-selection':()=>{selected.clear();render();},
  'bulk-delete':()=>deleteDocuments(documents.filter(x=>selected.has(x.id))),
  'refresh-assets':async()=>{assets=await api('assets');render();},
  'insert-component':async()=>{ensureDoc();const snippet=componentSnippet();const result=await api('component',{id:doc.id,body:doc.body,name:component,snippet,position:sourcePosition});doc.id=doc.id.replace(/\.md$/,'.mdx');updateBody(result.body);close();go('editor');toast('已插入组件并转换为 mdx；保存后更新文件');},
  translate:generateTranslation,'cancel-translate':()=>translationController?.abort(),
  'preview-translated':()=>buildPreview(translation.document),
  'save-translated':async()=>{
    if(!translation?.document)throw new Error('没有可保存译文');
    modal('保存英文版？',`<p class="dialog-copy">${escape(translation.document.id)}${translation.document.revision?' 已存在，覆盖前将保存历史版本。':' 将新建。'}中文原文和图片不变。</p>`,btn('返回校对','close')+btn('确认保存','confirm-translation','check','primary'));
    $('#modal [data-action="confirm-translation"]').onclick=()=>handle(async()=>{translation.document=await api('save',translation.document);translation.document.originalId=translation.document.id;translation.saved=true;clearTimeout(translationTimer);translationTimer=null;await translationSave.catch(()=>{});translationSave=Promise.resolve();await api('translation-draft',{id:translation.source?.id||doc.id,discard:true});close();await refresh();render();toast('英文版本已写入本地文件');});
  },
  'save-settings':async()=>{config=await api('settings',{endpoint:$('#model-endpoint').value,model:$('#model-name').value,maxTokens:Number($('#model-max').value),key:$('#model-key').value});render();toast('设置和密钥已保存，重启后自动恢复');},
  'clear-key':async()=>{config=await api('settings',{...config,clearKey:true});render();toast('已清除保存的密钥');},
  'test-model':async()=>{const target=$('#test-result');target.textContent='正在测试…';try{const result=await api('test-model',{});target.textContent=`${result.success?'连接测试通过':'已连接，但返回文本不匹配'} · 配置模型：${result.configuredModel} · 接口返回：${result.returnedModel}`;}catch(error){target.textContent=error.message;throw error;}},
  versions,
  'clear-trash':()=>{modal('永久清空回收站','<p class="dialog-copy">清空后无法通过回收站恢复。图片不受影响。</p>'+field('输入“清空”确认','clear-confirm'),btn('取消','close')+btn('永久清空','confirm-clear','trash','danger'));$('#modal [data-action="confirm-clear"]').onclick=()=>handle(async()=>{await api('clear-trash',{confirmation:$('#clear-confirm').value});close();trash=await api('trash');render();toast('回收站已清空');});},
};
document.addEventListener('click',event=>void handle(async()=>{
  if(!event.target.closest('.format-picker'))$$('.format-picker[open]').forEach(x=>x.removeAttribute('open'));
  const choice=event.target.closest('[data-choice]');if(choice){const id=choice.dataset.choice,value=choice.dataset.value;if(id==='analytics-window'){analyticsWindow=value;render();$('#analytics-window')?.focus();}else if(id==='format-filter'){format=value;pageNumber=1;render();$('#format-filter')?.focus();}else if(id==='component-color'){componentColor=value;const picker=choice.closest('details');picker.querySelector('.choice-label').textContent=choice.children[1].textContent;picker.querySelectorAll('[data-choice]').forEach(x=>{x.setAttribute('aria-pressed',String(x.dataset.value===value));x.querySelector('.format-check').innerHTML=x.dataset.value===value?icon('check'):'';});picker.removeAttribute('open');picker.querySelector('summary').focus();$('#component-code').textContent=componentSnippet();syncComponentPreview();}return;}
  const metric=event.target.closest('[data-analytics-metric]');if(metric){analyticsMetric=metric.dataset.analyticsMetric;render();$(`[data-analytics-metric="${analyticsMetric}"]`)?.focus();return;}
  const fileFormat=event.target.closest('[data-file-format]');if(fileFormat){format=fileFormat.dataset.fileFormat;pageNumber=1;render();$('#format-filter')?.focus();return;}
  const action=event.target.closest('[data-action]');if(action&&actions[action.dataset.action]){await actions[action.dataset.action]();return;}
  const open=event.target.closest('[data-open]');if(open){close();await openDoc(open.dataset.open);return;}
  const draft=event.target.closest('[data-draft]');if(draft){await openDoc(draft.dataset.draft,true);return;}
  const discard=event.target.closest('[data-discard]');if(discard){modal('丢弃本地草稿？','<p class="dialog-copy">仅删除本地草稿备份，正式内容不变。</p>',btn('取消','close')+btn('确认丢弃','confirm-discard','trash','danger'));$('#modal [data-action="confirm-discard"]').onclick=()=>handle(async()=>{await api('discard-draft',{id:discard.dataset.discard});close();await refresh();render();});return;}
  const remove=event.target.closest('[data-delete]');if(remove){const item=documents.find(x=>x.id===remove.dataset.delete);await deleteDocuments(item?[item]:[]);return;}
  const restore=event.target.closest('[data-restore]');if(restore){await api('restore',{token:restore.dataset.restore});trash=await api('trash');await refresh();render();toast('内容已恢复');return;}
  const lang=event.target.closest('[data-language]');if(lang){language=lang.dataset.language;selected.clear();pageNumber=1;render();return;}
  const folder=event.target.closest('[data-folder]');if(folder){assetFolder=folder.dataset.folder;render();return;}
  const asset=event.target.closest('[data-asset]');if(asset){await showAsset(Number(asset.dataset.asset));return;}
  const item=event.target.closest('[data-component]');if(item){component=item.dataset.component;refreshComponents();return;}
  const formatButton=event.target.closest('[data-format]');if(formatButton){if(editorMode==='rich'){formatRich(formatButton.dataset.format);return;}const area=$('#post-body');const selection=area.value.slice(area.selectionStart,area.selectionEnd)||'内容';const snippets={heading:'## '+selection,bold:'**'+selection+'**',quote:'> '+selection,code:'```\n'+selection+'\n```',math:'$$\nE = mc^2\n$$'};area.setRangeText(snippets[formatButton.dataset.format],area.selectionStart,area.selectionEnd,'end');updateBody(area.value);sourcePosition=area.selectionStart;area.focus();}
}));
document.addEventListener('input',event=>{
  const target=event.target,id=target.id;
  if(id==='chat-input')currentChat().input=target.value;
  if(id==='component-text')componentText=target.value;
  if(id==='component-teaser')componentTeaser=target.value;
  if(id==='post-body'){updateBody(target.value);sourcePosition=target.selectionStart;}
  if(id.startsWith('meta-')){doc.meta[id.slice(5)]=target.value;if($('#extra-meta'))$('#extra-meta').value=JSON.stringify(doc.meta,null,2);markDirty();}
  if(id==='extra-meta'){try{const meta=JSON.parse(target.value);if(!meta||Array.isArray(meta)||typeof meta!=='object')throw 0;doc.meta=meta;markDirty();target.setCustomValidity('');}catch{target.setCustomValidity('需要有效的 JSON 对象');}}
  if(id==='list-query'){query=target.value;pageNumber=1;const selection=target.selectionStart;render();$('#list-query').focus();$('#list-query').setSelectionRange(selection,selection);}
  if(id.startsWith('component-')&&$('#component-code')){$('#component-code').textContent=componentSnippet();syncComponentPreview();}
  if(id.startsWith('translated-')&&translation?.document){const key=id.slice(11);if(key==='body'){translation.document.body=target.value;if(isThought(translation.document.id))translation.document.meta.description=target.value;}else translation.document.meta[key]=target.value;translation.saved=false;scheduleTranslationSave();}
});
document.addEventListener('change',event=>void handle(async()=>{
  const target=event.target;
  if(target.id==='chat-body')currentChat().includeBody=target.checked;
  if(target.dataset.chatImage){const state=currentChat();if(target.checked&&state.images.size>=4){target.checked=false;throw new Error('每次最多选择 4 张图片');}target.checked?state.images.add(target.dataset.chatImage):state.images.delete(target.dataset.chatImage);}
  if(target.dataset.select){target.checked?selected.add(target.dataset.select):selected.delete(target.dataset.select);render();}
  if(target.id==='select-page'){$$('[data-select]').forEach(x=>target.checked?selected.add(x.dataset.select):selected.delete(x.dataset.select));render();}
  if(target.id==='filename'&&doc.revision===null&&!doc.assetsLocked){const filename=target.value.trim();if(!filename||/[<>:"/\\|?*\x00-\x1f]/.test(filename)||filename.startsWith('.'))throw new Error('文件名包含无效字符');const previousChatKey=chatKey();doc.id=collectionOf(doc.id)+'/'+filename+(doc.id.endsWith('.mdx')?'.mdx':'.md');doc.originalId=doc.id;if(chats.has(previousChatKey)){chats.set(chatKey(),chats.get(previousChatKey));chats.delete(previousChatKey);}markDirty();render();}
}));
$('#modal').addEventListener('close',()=>{componentDialog=false;});
$('#image-input').onchange=event=>{const files=[...event.target.files];event.target.value='';void handle(()=>uploadImages(files));};
$('#markdown-input').onchange=event=>{const files=[...event.target.files];event.target.value='';void handle(()=>importFiles(files));};
$('#global-search').onclick=showSearch;
$('#studio-theme').onclick=()=>{const dark=document.documentElement.classList.toggle('studio-dark');$('#studio-theme').innerHTML=icon(dark?'sun':'moon');$('#studio-theme').setAttribute('aria-label',dark?'切换后台浅色主题':'切换后台深色主题');};
$('#collapse-nav').onclick=()=>{const collapsed=document.body.classList.toggle('nav-collapsed');$('#collapse-nav').setAttribute('aria-label',collapsed?'展开侧栏':'收起侧栏');};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('.format-picker[open]')){const picker=$('.format-picker[open]');picker.removeAttribute('open');picker.querySelector('summary').focus();event.preventDefault();}if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&event.target.id==='chat-input'){event.preventDefault();void handle(sendChat);}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void handle(saveDoc);}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();showSearch();}});
let nativeReady=false,nativeBackground=0;
const nativeBusy=()=>translationTimer!==null||translationSaving>0||publishState.running||dirty||uploadCount>0||pending||componentLoading||translationController!==null||chatController!==null;
async function stopPreview(){
  if(pending||componentLoading)throw new Error('请等待当前操作完成后再停止预览');
  await api('preview-stop',{});previewURL='';componentPreviewURL='';if(page==='preview'||page==='components')render();
}
window.studioNative = Object.freeze({
  get ready(){return nativeReady;}, isBusy:nativeBusy, isPublishing:()=>publishState.running,
  async quickWrite(kind){
    if(!['thought','writing'].includes(kind))throw new Error('不支持的内容类型');
    if(publishState.running||pending||uploadCount||componentLoading)throw new Error('请等待发布、上传或编译完成后再新建内容');
    if(translation?.document)throw new Error('请先保存或结束译文校对，再新建内容');
    if($('#extra-meta')&&!$('#extra-meta').checkValidity())throw new Error('请先修正 frontmatter JSON');
    quickFocus=kind;
    try{await chooseNew(kind);close();quickFocus=kind;focusQuickWrite();}catch(error){quickFocus='';throw error;}
  },
  save:()=>{void handle(saveDoc);}, search:showSearch, stopPreview,
  async overview(){await preserve();go('collections');},
  foreground(){nativeBackground++;},
  async refreshContent(){await refresh();if(!dirty)render();},
  async background(){
    const generation=++nativeBackground;
    while(publishState.running||pending||componentLoading||uploadCount||translationController||chatController)await new Promise(resolve=>window.addEventListener('tidemark-idle',resolve,{once:true}));
    if(generation!==nativeBackground)return null;
    await stopPreview();
    await persistTranslation();
    if(generation!==nativeBackground||nativeBusy()||chatOpen||[...chats.values()].some(x=>x.input||x.messages.length)||page==='settings'||$('#modal').open||(doc&&doc.revision===null))return null;
    sourcePosition=$('#post-body')?.selectionStart??sourcePosition;
    return JSON.stringify({id:doc?.originalId||doc?.id,page,sourcePosition,language,format,query,pageNumber,assetFolder,previewMobile,dark:document.documentElement.classList.contains('studio-dark')});
  },
  async restore(raw){
    const state=JSON.parse(raw);
    language=state.language;format=state.format;query=state.query;pageNumber=state.pageNumber;assetFolder=state.assetFolder;previewMobile=state.previewMobile;
    document.documentElement.classList.toggle('studio-dark',state.dark);
    $('#studio-theme').innerHTML=icon(state.dark?'sun':'moon');
    $('#studio-theme').setAttribute('aria-label',state.dark?'切换后台浅色主题':'切换后台深色主题');
    if(state.id){doc=await api('document?id='+encodeURIComponent(state.id));doc.originalId=doc.id;}
    sourcePosition=state.sourcePosition||0;
    await loadPage(state.page);location.hash=state.page;
    $('#post-body')?.setSelectionRange(sourcePosition,sourcePosition);
  }
});
window.addEventListener('beforeunload',event=>{if(nativeBusy()){event.preventDefault();event.returnValue='';}});
window.addEventListener('hashchange',()=>void handle(()=>loadPage(location.hash.slice(1)||'collections')));
try{await refresh();await loadPage(location.hash.slice(1)||'collections');}catch(error){$('#main').innerHTML=head('无法连接本地服务',error.message)+btn('刷新','reload','undo');actions.reload=()=>location.reload();}

nativeReady=true;window.dispatchEvent(new Event('tidemark-ready'));
