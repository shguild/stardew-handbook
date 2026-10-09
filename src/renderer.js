'use strict';
const $=selector=>document.querySelector(selector);
const view=$('#view');const api=window.handbook;
let catalog,state,meta,route={type:'home'},history=[{type:'home'}],historyIndex=0,revision=0,article=null,suggestionRevision=0,suggestionItems=[],selectedSuggestion=-1,toastTimer;
const esc=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon=(filename,cls='',alt='')=>`<img class="${esc(cls)}" src="../assets/wiki/${esc(filename)}" alt="${esc(alt)}">`;
const isFavorite=title=>state.favorites.some(p=>p.title===title);
const sourceUrl=title=>'https://zh.stardewvalleywiki.com/'+encodeURIComponent(title.replace(/ /g,'_'));
function dateLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});}
async function call(method,...args){const result=await api[method](...args);if(!result?.ok)throw Error(result?.error || '操作失败，请重试。');return result.value;}
function toast(message,error=false){clearTimeout(toastTimer);const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,3500);}
function status(message,offline=false){$('#status-text').innerHTML=`<span class="status-dot"></span>${esc(message)}`;$('.statusbar').classList.toggle('offline',offline);}
function updateLibrary(){
  $('#favorite-count').textContent=state.favorites.length;
  document.documentElement.style.setProperty('--article-size',state.settings.fontSize+'px');
  for(const button of document.querySelectorAll('[data-favorite]')){
    const saved=isFavorite(button.dataset.favorite);button.classList.toggle('saved',saved);button.setAttribute('aria-pressed',String(saved));
    if(button.classList.contains('result-star'))button.textContent=saved?'★':'☆';
    if(button.classList.contains('favorite-button'))button.textContent=saved?'★ 已收藏':'☆ 收藏词条';
  }
}
function loading(text='正在翻开手册……'){return `<div class="loading" role="status"><div class="pixel-loader"><i></i><i></i><i></i></div>${esc(text)}</div>`;}
function heading(title,subtitle,kicker='WIKI FIELD NOTES',actions=''){
  return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions}</div>`;
}
function empty(title,message,actions='',file='Lost_Book.png'){
  return `<div class="empty-state">${icon(file)}<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="empty-actions">${actions}</div></div>`;
}
function resultsMarkup(items,showMeta=false){
  if(!items.length)return '';
  return `<div class="result-list">${items.map(item=>`<div class="result-item"><button class="result-open" data-title="${esc(item.title)}"><strong>${esc(item.title)}</strong>${item.snippet?`<p>${esc(item.snippet)}</p>`:''}${showMeta?`<span class="result-meta">${item.bundled?'随手册附带的官方词条':item.fetchedAt?'下载缓存':'保存于'} ${dateLabel(item.fetchedAt || item.addedAt || item.readAt)}</span>`:''}</button><button class="result-star ${isFavorite(item.title)?'saved':''}" data-favorite="${esc(item.title)}" title="收藏 / 取消收藏" aria-label="收藏 ${esc(item.title)}" aria-pressed="${isFavorite(item.title)}">${isFavorite(item.title)?'★':'☆'}</button><button class="result-arrow" data-title="${esc(item.title)}" aria-label="打开 ${esc(item.title)}">›</button></div>`).join('')}</div>`;
}
function railList(items,limit=5){return `<div class="rail-list">${items.slice(0,limit).map(p=>`<button data-title="${esc(p.title)}">${esc(p.title)}<span>›</span></button>`).join('')}</div>`;}
function home(){
  const season=catalog.seasons.find(s=>s.id===state.settings.season) || catalog.seasons[0];
  return `${heading('欢迎回到山谷。','把想知道的事，放进这本手册里。','YOUR LITTLE VALLEY COMPANION','<span class="heading-tag">✦ 中文百科 · 随时翻阅</span>')}
  <div class="home-grid"><div class="home-main">
    <section class="hero"><div class="hero-copy"><div class="hero-label">${icon('Stardrop.png')}一本属于你的山谷手册</div><h2>在山谷里，<br>每一天都有新发现。</h2><p>从第一颗种子，到最后一颗金核桃。<br>和你一起，把农场生活慢慢过好。</p></div><div class="season-tabs" aria-label="选择季节">${catalog.seasons.map(s=>`<button data-season="${s.id}" class="${s.id===season.id?'active':''}" aria-pressed="${s.id===season.id}">${s.name}</button>`).join('')}</div><button class="hero-go" data-action="focus-search">开始查资料　→</button></section>
    <section><div class="section-title"><h2>翻开百科图鉴</h2><span>9 个分类 · 从这里出发</span></div><div class="category-grid">${catalog.categories.map(c=>`<button class="category-card" data-category="${c.id}">${icon(c.icon)}<div><strong>${esc(c.name)}</strong><small>${esc(c.hint)}</small></div><span class="arrow">›</span></button>`).join('')}</div></section>
    <section><div class="section-title"><h2>去认识小镇的朋友</h2><button data-category="villagers">所有村民　→</button></div><div class="villager-row">${catalog.villagers.map(v=>`<button class="villager-card" data-title="${esc(v.title)}"><div class="portrait">${icon(v.image)}</div><strong>${esc(v.title)}</strong></button>`).join('')}</div></section>
  </div><aside class="home-rail">
    <section class="note-panel season-note"><div class="note-kicker">A NOTE FOR THE SEASON</div><h2>${icon(season.icon)}${esc(season.title)}手记</h2><p>按季节翻阅，<br>看看这一季的山谷。</p><div class="season-links">${season.pages.map(title=>`<button data-title="${esc(title)}">${esc(title)}</button>`).join('')}</div><button class="note-link" data-title="${esc(season.title)}">翻开${esc(season.title)}词条 →</button></section>
    <section class="note-panel"><h2>我的收藏<span>${String(state.favorites.length).padStart(2,'0')}</span></h2>${state.favorites.length?railList(state.favorites,4):`<div class="rail-empty">${icon('Chest.png')}<p>把常查的词条收好，<br>下次就能轻松找到。</p></div>`}<button class="note-link" data-view="favorites">打开我的收藏 →</button></section>
    <section class="note-panel"><h2>最近翻阅<span>RECENT</span></h2>${state.recent.length?railList(state.recent,3):'<div class="rail-empty"><p>每一次探索，<br>都会在这里留下脚印。</p></div>'}</section>
    <div class="wiki-note"><strong>有出处的每一页</strong>资料来自星露谷物语官方中文 Wiki。词条附原文链接与缓存时间。<br><button data-view="about">了解这本手册 →</button></div>
  </aside></div>`;
}
function closeSuggestions(){suggestionRevision++;suggestionItems=[];selectedSuggestion=-1;$('#suggestions').hidden=true;$('#search-input').setAttribute('aria-expanded','false');}
function setRouteChrome(){
  const names={home:'山谷首页',favorites:'我的收藏',recent:'最近翻阅',cache:'离线资料',about:'关于手册',search:'查询资料',page:route.title};
  $('#breadcrumb').textContent=route.type==='category'?catalog.categories.find(c=>c.id===route.id)?.name:names[route.type] || '山谷百科';
  for(const button of document.querySelectorAll('.nav-button'))button.classList.toggle('active',button.dataset.view===route.type || (route.type==='category'&&button.dataset.category===route.id));
  $('#back-button').disabled=historyIndex<=0;$('#forward-button').disabled=historyIndex>=history.length-1;
}
async function navigate(next,record=true){
  route={...next};const current=++revision;closeSuggestions();
  if(record){history=history.slice(0,historyIndex+1);history.push({...route});historyIndex=history.length-1;}
  setRouteChrome();view.scrollTop=0;article=null;
  try{
    switch(route.type){
      case 'home':view.innerHTML=home();status('手册已就绪 · 搜索或选择一个分类开始');break;
      case 'favorites':view.innerHTML=heading('我的收藏','常查的资料，留在最顺手的一页。','MY BOOKMARKS')+(state.favorites.length?resultsMarkup(state.favorites,true):empty('背包里还没有收藏','阅读词条时点一下「收藏词条」，或在搜索结果中点击星星，就能将资料收进这里。','<button data-action="focus-search" class="green-button">搜索一个词条</button><button data-view="home" class="paper-button">回到山谷首页</button>','Chest.png'));status(`${state.favorites.length} 个收藏 · 保存在本机`);break;
      case 'recent':view.innerHTML=heading('最近翻阅','沿着上次的脚印，继续探索山谷。','RECENTLY READ')+(state.recent.length?resultsMarkup(state.recent,true):empty('还没有翻阅记录','打开一个词条，就会在这里留下记录。','<button data-view="home" class="green-button">翻开百科</button>'));status('最近阅读记录 · 保存在本机');break;
      case 'about':view.innerHTML=about();status(`星露谷手册 v${meta.version}`);break;
      case 'cache':{
        view.innerHTML=loading('正在整理离线资料……');const cached=await call('cached');if(current!==revision)return;
        view.innerHTML=heading('离线资料','没网的时候，也能翻翻已经保存的笔记。','OFFLINE LIBRARY',`<div class="heading-actions"><button class="paper-button" data-action="clear-cache">清理下载缓存</button></div>`)+`<div class="cache-summary"><div><strong>${cached.length}</strong><span>可离线阅读的词条</span></div><div><strong>${meta.bundledCount}</strong><span>随手册附带的基础词条</span></div><div><strong>${meta.indexCount.toLocaleString()}</strong><span>本地搜索标题</span></div></div><p class="cache-info">联网阅读的词条会自动保存，打开过的图片也会缓存。离线搜索按标题匹配；首次打开未缓存的词条需要联网。页面中的资料以显示的抓取时间为准，可在词条页刷新。</p>`+resultsMarkup(cached,true);status(`${cached.length} 个词条已保存 · 可离线阅读`);break;
      }
      case 'category':{
        const category=catalog.categories.find(c=>c.id===route.id);view.innerHTML=loading('正在整理百科分类……');const data=await call('category',category.id);if(current!==revision)return;
        const members=data.results.filter(p=>!data.curated.some(c=>c.title===p.title));
        view.innerHTML=`<div class="category-page-header">${icon(category.icon)}<div><div class="eyebrow">VALLEY ENCYCLOPEDIA</div><h1>${esc(category.name)}</h1><p>${esc(category.hint)} · 资料来自官方中文 Wiki</p></div></div><div class="section-title"><h2>常用入口</h2><button data-title="${esc(category.title)}">打开总览词条 →</button></div><div class="chips">${data.curated.map(p=>`<button class="chip" data-title="${esc(p.title)}">${esc(p.title)}</button>`).join('')}</div>${data.offline?'<div class="notice">分类列表暂时无法联网获取。你仍然可以使用常用入口；已有缓存的词条可离线阅读。</div>':''}<div class="section-title"><h2>分类词条</h2><span>官方 Wiki 分类</span></div><div id="category-results">${members.length?resultsMarkup(members):'<p class="page-lead">更多资料可从上方常用入口和总览词条中浏览。</p>'}</div>${data.next?`<button class="paper-button load-more" data-category-next="${esc(data.next)}">加载更多词条</button>`:''}`;
        status(data.offline?'分类离线入口 · 未缓存的内容需要联网':'已连接官方 Wiki · 分类资料已加载',data.offline);break;
      }
      case 'search':{
        $('#search-input').value=route.query;view.innerHTML=loading('正在搜索官方 Wiki……');const data=await call('search',route.query);if(current!==revision)return;
        view.innerHTML=heading(`「${route.query}」的查询结果`,data.offline?`本地标题匹配 · 找到 ${data.results.length} 个词条`:`官方全文查询 · ${data.total} 个匹配结果`,'SEARCH THE VALLEY')+(data.offline?`<div class="notice">${esc(data.notice)}</div>`:'')+`<div id="search-results">${data.results.length?resultsMarkup(data.results):empty('这一页还没有线索','尝试缩短关键词，或使用物品、村民的完整中文名称。','<button data-action="focus-search" class="green-button">重新搜索</button>')}</div>${data.next!==null?`<button class="paper-button load-more" data-search-next="${data.next}">加载更多结果</button>`:''}`;
        status(data.offline?'离线标题搜索 · 已缓存词条可阅读':'官方 Wiki 搜索结果已加载',data.offline);break;
      }
      case 'page':{
        view.innerHTML=loading('正在翻开「'+route.title+'」……');const data=await call('page',route.title,route.refresh || false);if(current!==revision)return;article=data;state=data.state;
        renderArticle(data);status(data.offline?'当前离线 · 正在阅读缓存资料':data.cached?`缓存词条 · 保存于 ${dateLabel(data.fetchedAt)}`:'官方 Wiki 词条已加载并保存',data.offline);break;
      }
      default:view.innerHTML=home();
    }
    updateLibrary();
  }catch(error){
    if(current!==revision)return;
    view.innerHTML=heading('这一页暂时没能打开','稍后再试，或前往官方 Wiki 查看。','A LITTLE PAUSE')+empty('暂时找不到山谷的信号',error.message,`<button class="green-button" data-action="retry">再试一次</button>${route.type==='page'?`<button class="paper-button" data-source="${esc(sourceUrl(route.title))}">打开官方原文</button>`:''}<button class="paper-button" data-view="cache">查看离线资料</button>`);
    status(error.message,true);
  }
}
function renderArticle(data){
  view.innerHTML=`<div class="article-heading"><div><div class="eyebrow">A PAGE FROM THE OFFICIAL WIKI</div><h1>${esc(data.title)}</h1><div class="article-subtitle"><span class="article-tag">${data.offline?'离线缓存':data.cached?'本地缓存':'官方 Wiki'}</span><span>保存时间 ${esc(new Date(data.fetchedAt).toLocaleString('zh-CN'))}</span>${data.revision?`<span>修订 #${data.revision}</span>`:''}</div></div><div class="heading-actions"><button class="paper-button favorite-button ${isFavorite(data.title)?'saved':''}" data-favorite="${esc(data.title)}">${isFavorite(data.title)?'★ 已收藏':'☆ 收藏词条'}</button><button class="paper-button" data-action="refresh-page" aria-label="刷新词条">↻ 刷新</button><button class="paper-button" data-source="${esc(data.url)}">Wiki 原文 ↗</button></div></div>${data.offline?`<div class="notice">${esc(data.notice)} 保存时间见上方；可以点击「刷新」重新获取。</div>`:''}<div class="article-layout"><div class="article-paper"><article class="article-body" id="article-body"></article><div class="article-source">本页资料转载自星露谷物语官方中文 Wiki · <button data-source="${esc(data.url)}">${esc(data.title)} ↗</button><br>内容按 CC BY-NC-SA 3.0 许可提供。游戏图像属于 ConcernedApe。缓存可能滞后于 Wiki 更新，请按需刷新。</div></div><aside class="article-toc"><h2>本页目录</h2><button data-action="scroll-top">词条开头</button>${data.sections.map(s=>`<button class="${s.level>1?'subsection':''}" data-anchor="${esc(s.anchor)}">${esc(s.line)}</button>`).join('')}<div class="toc-divider"></div><div class="font-controls"><span>字号</span><button data-font="smaller" aria-label="减小正文字号">A−</button><button data-font="larger" aria-label="增大正文字号">A+</button></div></aside></div>`;
  const body=$('#article-body');const template=document.createElement('template');template.innerHTML=data.html;
  // The main process sanitizes HTML. Route every remaining image through our cache protocol.
  for(const img of template.content.querySelectorAll('img')){
    const original=img.getAttribute('src');img.setAttribute('src','wiki-image://image/'+encodeURIComponent(original));img.setAttribute('loading','lazy');
  }
  body.replaceChildren(template.content);
  if(route.anchor)setTimeout(()=>scrollToAnchor(route.anchor),100);
}
function scrollToAnchor(anchor){let decoded=anchor;try{decoded=decodeURIComponent(anchor)}catch{}const target=document.getElementById(decoded) || document.getElementById(anchor);if(target && view.contains(target))view.scrollTo({top:target.getBoundingClientRect().top-view.getBoundingClientRect().top+view.scrollTop-15,behavior:'smooth'});}
function about(){return heading('关于这本手册','为你的农场生活，留一盏小灯。','ABOUT THIS HANDBOOK')+`<div class="about-paper"><div class="about-brand"><img src="../assets/mark.svg" alt="手册标志"><div><h2>星露谷手册</h2><p>STARDEW HANDBOOK / v${esc(meta.version)}</p></div></div><div class="about-facts"><div><strong>${meta.indexCount.toLocaleString()}</strong><span>官方 Wiki 标题索引</span></div><div><strong>${meta.bundledCount}</strong><span>随程序附带的官方词条</span></div></div><h3>有出处的资料</h3><p>搜索、词条正文与图像来自星露谷物语官方中文 Wiki。每篇词条都提供原文链接、抓取时间和修订号。联网读取会保存正文；已打开的图片按需缓存。标题索引和少量基础词条随手册附带，全站词条可在联网时查询。</p><button class="paper-button" data-source="https://zh.stardewvalleywiki.com/Stardew_Valley_Wiki">访问官方中文 Wiki ↗</button><h3>收藏只留在你的电脑里</h3><p>收藏、阅读历史、季节选择与缓存保存于 Windows 用户数据目录。本工具无需登录，也不读取游戏存档。可在「离线资料」页查看和清理下载缓存。</p><h3>致谢与许可</h3><p>《星露谷物语》由 ConcernedApe 创作，游戏图片及名称归其权利人所有。本工具为非官方资料查询软件，不代表游戏开发者或 Wiki 编辑团队。感谢官方 Wiki 社区的持续整理。</p><p>Wiki 内容采用 Creative Commons Attribution-NonCommercial-ShareAlike 3.0（CC BY-NC-SA 3.0）许可：署名、非商业使用、相同方式共享。程序自行编写的代码采用 MIT 许可。自绘界面装饰与 Wiki 内容分别标注来源。</p><button class="paper-button" data-source="https://stardewvalleywiki.com/Stardew_Valley_Wiki:Copyrights">查看 Wiki 内容许可 ↗</button><h3>快捷操作</h3><p>Ctrl + K：聚焦搜索　·　↑ / ↓：选择搜索建议　·　Enter：打开建议或搜索<br>Alt + ← / →：返回或前进　·　Esc：关闭搜索建议　·　词条右侧 A− / A+：调整正文字号</p></div>`;}
async function toggleFavorite(title){
  try{state=await call('favorite',title);updateLibrary();toast(isFavorite(title)?'已收进收藏，下次更好找。':'已移出收藏。');if(['favorites','home'].includes(route.type))await navigate(route,false);}catch(error){toast(error.message,true)}
}
async function eventAction(event){
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.window){await call('window',target.dataset.window);return;}
  if(target.dataset.view){await navigate({type:target.dataset.view});return;}
  if(target.dataset.category){await navigate({type:'category',id:target.dataset.category});return;}
  if(target.dataset.title){await navigate({type:'page',title:target.dataset.title});return;}
  if(target.dataset.favorite){await toggleFavorite(target.dataset.favorite);return;}
  if(target.dataset.source){await call('openSource',target.dataset.source);return;}
  if(target.dataset.anchor){scrollToAnchor(target.dataset.anchor);return;}
  if(target.dataset.season){state=await call('settings',{season:target.dataset.season});await navigate({type:'home'},false);return;}
  if(target.dataset.font){const size=Math.max(14,Math.min(20,state.settings.fontSize+(target.dataset.font==='larger'?2:-2)));state=await call('settings',{fontSize:size});updateLibrary();return;}
  if(target.dataset.searchNext){
    const version=revision;target.disabled=true;target.textContent='正在加载……';const data=await call('search',route.query,Number(target.dataset.searchNext));if(version!==revision)return;
    if(data.offline){target.disabled=false;target.textContent='重试加载';toast('暂时无法加载下一页，请稍后重试。',true);return;}
    $('#search-results').insertAdjacentHTML('beforeend',resultsMarkup(data.results));if(data.next===null)target.remove();else{target.dataset.searchNext=data.next;target.disabled=false;target.textContent='加载更多结果';}return;
  }
  if(target.dataset.categoryNext){const version=revision;target.disabled=true;const data=await call('category',route.id,target.dataset.categoryNext);if(version!==revision)return;if(data.offline){target.disabled=false;toast('暂时无法加载更多，请稍后重试。',true);return;}$('#category-results').insertAdjacentHTML('beforeend',resultsMarkup(data.results));if(!data.next)target.remove();else{target.dataset.categoryNext=data.next;target.disabled=false;}return;}
  switch(target.dataset.action){
    case 'focus-search':$('#search-input').focus();$('#search-input').select();break;
    case 'retry':await navigate(route,false);break;
    case 'refresh-page':await navigate({...route,refresh:true},false);break;
    case 'scroll-top':view.scrollTo({top:0,behavior:'smooth'});break;
    case 'clear-cache':{
      const dialog=$('#confirm-dialog');dialog.showModal();dialog.addEventListener('close',async()=>{if(dialog.returnValue==='confirm'){try{await call('clearCache');toast('下载缓存已清理，基础词条已保留。');if(route.type==='cache')await navigate(route,false);}catch(error){toast(error.message,true)}}},{once:true});break;
    }
  }
}
document.addEventListener('click',event=>{
  if(!event.target.closest('.search-box'))closeSuggestions();
  eventAction(event).catch(error=>toast(error.message,true));
});
view.addEventListener('click',async event=>{
  const link=event.target.closest('#article-body a');if(!link)return;event.preventDefault();const href=link.getAttribute('href');if(!href)return;
  try{
    if(href.startsWith('#')){scrollToAnchor(href.slice(1));return;}
    const url=new URL(href);if(url.hostname!=='zh.stardewvalleywiki.com'){await call('openSource',href);return;}
    const title=url.searchParams.get('title') || decodeURIComponent(url.pathname.slice(1)).replace(/_/g,' ');
    if(!title || /^(Special|特殊|文件|File|Category|分类|Template|模板|Help|帮助|Stardew Valley Wiki):/i.test(title) || url.searchParams.has('action')){await call('openSource',href);return;}
    await navigate({type:'page',title,anchor:url.hash.slice(1)});
  }catch(error){toast(error.message,true)}
});
view.addEventListener('error',event=>{
  const img=event.target;if(img.tagName!=='IMG')return;
  if(img.closest('.article-body')){img.classList.add('image-failed');img.title=(img.alt || '图片')+' · 暂时无法加载';return;}
  if(!img.src.endsWith('/mark.svg'))img.src='../assets/mark.svg';
},true);
$('#search-form').addEventListener('submit',event=>{event.preventDefault();const query=$('#search-input').value.trim();if(query)navigate({type:'search',query});else $('#search-input').focus();});
let suggestTimer;
$('#search-input').addEventListener('input',()=>{
  clearTimeout(suggestTimer);const query=$('#search-input').value.trim();const current=++suggestionRevision;selectedSuggestion=-1;
  if(!query){closeSuggestions();return;}
  suggestTimer=setTimeout(async()=>{try{const items=await call('suggest',query);if(current!==suggestionRevision)return;suggestionItems=items;$('#suggestions').innerHTML=items.map((p,i)=>`<button type="button" data-title="${esc(p.title)}" data-suggestion="${i}">${esc(p.title)}<span>打开词条 ↵</span></button>`).join('');$('#suggestions').hidden=!items.length;$('#search-input').setAttribute('aria-expanded',String(Boolean(items.length)));}catch{}},100);
});
$('#search-input').addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeSuggestions();return;}
  if((event.key==='ArrowDown'||event.key==='ArrowUp')&&suggestionItems.length){event.preventDefault();selectedSuggestion=selectedSuggestion<0?(event.key==='ArrowDown'?0:suggestionItems.length-1):(selectedSuggestion+(event.key==='ArrowDown'?1:-1)+suggestionItems.length)%suggestionItems.length;for(const [i,button]of [...$('#suggestions').querySelectorAll('button')].entries())button.classList.toggle('selected',i===selectedSuggestion);}
  if(event.key==='Enter'&&selectedSuggestion>=0){event.preventDefault();navigate({type:'page',title:suggestionItems[selectedSuggestion].title});}
});
$('#back-button').addEventListener('click',()=>{if(historyIndex>0){historyIndex--;navigate(history[historyIndex],false)}});
$('#forward-button').addEventListener('click',()=>{if(historyIndex<history.length-1){historyIndex++;navigate(history[historyIndex],false)}});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#search-input').focus();$('#search-input').select();}
  if(event.altKey&&event.key==='ArrowLeft'){event.preventDefault();$('#back-button').click();}
  if(event.altKey&&event.key==='ArrowRight'){event.preventDefault();$('#forward-button').click();}
});
(async()=>{
  try{
    const data=await call('init');catalog=data.catalog;state=data.state;meta=data;
    $('#category-nav').innerHTML=catalog.categories.map(c=>`<button class="nav-button" data-category="${c.id}">${icon(c.icon)}${esc(c.name)}</button>`).join('');
    $('#index-count').textContent=`${data.indexCount.toLocaleString()} 条百科标题`;$('#sidebar-version').textContent=`DESKTOP v${data.version}`;
    await navigate({type:'home'},false);
  }catch(error){view.innerHTML=empty('手册暂时未能打开',error.message);status('初始化失败',true);}
})();
