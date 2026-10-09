const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sanitizeHtml = require('sanitize-html');
const ORIGIN = 'https://zh.stardewvalleywiki.com';
const API = `${ORIGIN}/mediawiki/api.php`;
const TTL = 24 * 60 * 60 * 1000;
const HOSTS = new Set(['zh.stardewvalleywiki.com','stardewvalleywiki.com']);
function isWikiUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && HOSTS.has(u.hostname) && !u.username && !u.password && (!u.port || u.port === '443'); } catch { return false; }
}
function pageUrl(title) { return `${ORIGIN}/${encodeURIComponent(title.replace(/ /g,'_'))}`; }
function checkedTitle(title) {
  if (typeof title !== 'string' || !title.trim() || title.length > 250 || /[\x00-\x1f]/.test(title)) throw Error('请输入有效的词条名称。');
  return title.trim().replace(/_/g,' ');
}
function absolute(value) { try { const url = new URL(value,ORIGIN).href; return isWikiUrl(url) ? url : undefined; } catch { return undefined; } }
function plain(value) {
  return sanitizeHtml(String(value || ''),{allowedTags:[],allowedAttributes:{}}).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
}
function sanitizeWiki(html) {
  return sanitizeHtml(html,{
    allowedTags: ['div','span','p','br','hr','h1','h2','h3','h4','h5','h6','a','img','table','thead','tbody','tfoot','tr','th','td','caption','ul','ol','li','dl','dt','dd','b','strong','i','em','small','sup','sub','blockquote','pre','code','abbr','s','del','u','figure','figcaption'],
    allowedAttributes: {
      '*':['id','class','title','lang','dir','style'], a:['href','title','class','id'],
      img:['src','alt','width','height','loading','class'],
      td:['colspan','rowspan','class','id','style'], th:['colspan','rowspan','scope','class','id','style'],
      table:['class','id','style'], ol:['start'],li:['value']
    },
    allowedStyles: {'*': {'text-align':[/^(left|right|center|justify)$/], 'vertical-align':[/^(top|middle|bottom|baseline)$/], 'white-space':[/^(normal|nowrap|pre-wrap)$/]}},
    allowedSchemes:['https'], allowProtocolRelative:false,
    transformTags:{
      a:(tag,attrs)=>({tagName:tag,attribs:{...attrs,href:attrs.href?.startsWith('#') ? attrs.href : absolute(attrs.href || '')}}),
      img:(tag,attrs)=>({tagName:tag,attribs:{...attrs,src:absolute(attrs.src || ''),loading:'lazy'}})
    },
    exclusiveFilter:frame=> (frame.tag==='img' && !frame.attribs.src) || (frame.tag==='span' && /mw-editsection/.test(frame.attribs.class || ''))
  });
}
class WikiService {
  constructor({cacheDir,fetcher=fetch,index=[],seed={}}={}) {
    this.cacheDir=cacheDir; this.fetcher=fetcher;this.index=index;this.seed=seed;this.memory=new Map();this.pending=new Map();
  }
  async api(params) {
    const url=new URL(API);for(const [key,value] of Object.entries({format:'json',...params})) url.searchParams.set(key,value);
    const response=await this.fetcher(url.href,{signal:AbortSignal.timeout(16000),headers:{'Accept':'application/json','User-Agent':'StardewHandbook/1.0 (personal wiki reader)'}});
    if(!response.ok) throw Error(`Wiki 暂时无法访问（HTTP ${response.status}）。`);
    const body=await response.text();if(body.length>16*1024*1024) throw Error('词条内容过大，请在官方 Wiki 中查看。');
    let data;try{data=JSON.parse(body)}catch{throw Error('Wiki 返回了验证页面或非 JSON 内容，请稍后重试或打开原文。')}
    if(data.error) throw Error(data.error.code==='missingtitle' ? '官方 Wiki 中找不到这个词条，请检查名称或尝试搜索。' : `Wiki 查询失败：${plain(data.error.info)}`);
    return data;
  }
  cachePath(title) { return path.join(this.cacheDir,crypto.createHash('sha256').update(title).digest('hex')+'.json'); }
  async cached(title) {
    if(this.memory.has(title)) return this.memory.get(title);
    let page;
    try {page=JSON.parse(await fs.readFile(this.cachePath(title),'utf8'));if(!page.html || !isWikiUrl(page.url)) page=undefined;}catch{}
    page ||= this.seed[title];
    if(page) this.memory.set(title,page);
    return page;
  }
  async save(title,page) {
    this.memory.set(title,page);this.memory.set(page.title,page);
    await fs.mkdir(this.cacheDir,{recursive:true});const target=this.cachePath(title);const tmp=target+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
    await fs.writeFile(tmp,JSON.stringify(page),'utf8');await fs.rename(tmp,target);
  }
  async page(input,refresh=false) {
    const title=checkedTitle(input);const old=await this.cached(title);
    if(old && !refresh && Date.now()-Date.parse(old.fetchedAt)<TTL) return {...old,html:sanitizeWiki(old.html),cached:true,offline:false};
    if(this.pending.has(title)) return this.pending.get(title);
    const task=(async()=>{
      try{
        const data=await this.api({action:'parse',page:title,prop:'text|sections|revid',redirects:'1',disableeditsection:'1',disabletoc:'1'});
        if(!data.parse?.text?.['*']) throw Error('Wiki 没有返回可读的词条正文。');
        const parsed=data.parse;
        const page={title:parsed.title,html:sanitizeWiki(parsed.text['*']),sections:(parsed.sections || []).map(s=>({anchor:s.anchor,line:plain(s.line),level:Number(s.toclevel)})),url:pageUrl(parsed.title),revision:parsed.revid || null,fetchedAt:new Date().toISOString()};
        try {await this.save(title,page)}catch{} // Reading remains usable on read-only or full disks.
        return {...page,cached:false,offline:false};
      }catch(error){
        if(old) return {...old,html:sanitizeWiki(old.html),cached:true,offline:true,notice:'暂时无法连接 Wiki，正在显示已保存的资料。'};
        throw Error(error.message?.includes('Wiki') ? error.message : '无法连接官方 Wiki。请检查网络，或先查看已缓存的词条。');
      }finally{this.pending.delete(title)}
    })();this.pending.set(title,task);return task;
  }
  suggest(query,limit=8) {
    const q=String(query || '').trim().toLocaleLowerCase();if(!q) return [];
    return this.index.filter(p=>p.title.toLocaleLowerCase().includes(q)).sort((a,b)=>Number(b.title===query)-Number(a.title===query)||a.title.length-b.title.length).slice(0,limit).map(p=>({title:p.title}));
  }
  async search(input,offset=0) {
    const q=checkedTitle(input);
    if(!Number.isInteger(offset)||offset<0||offset>10000) throw Error('无效的搜索页码。');
    try{
      const data=await this.api({action:'query',list:'search',srsearch:q,srnamespace:0,srlimit:20,sroffset:offset,srprop:'snippet'});
      const results=(data.query?.search || []).map(p=>({title:p.title,snippet:plain(p.snippet)}));
      // Full-text search occasionally misses an exact title; title index provides direct access.
      const exact=this.index.find(p=>p.title===q);if(offset===0 && exact && !results.some(p=>p.title===q)) results.unshift({title:q,snippet:'标题匹配 · 点击查看官方词条'});
      return {results,total:data.query?.searchinfo?.totalhits || results.length,next:data.continue?.sroffset ?? null,offline:false};
    }catch{
      const results=this.suggest(q,100).map(p=>({...p,snippet:'离线标题索引 · 已缓存的词条可直接阅读'}));
      return {results,total:results.length,next:null,offline:true,notice:'在线搜索暂不可用，正在显示本地标题匹配。'};
    }
  }
  async category(title,token) {
    const data=await this.api({action:'query',list:'categorymembers',cmtitle:'Category:'+checkedTitle(title),cmnamespace:'0',cmlimit:'60',...(token?{cmcontinue:token}:{})});
    return {results:(data.query?.categorymembers || []).map(p=>({title:p.title})),next:data.continue?.cmcontinue || null};
  }
  async listCached() {
    const entries=new Map(Object.entries(this.seed).map(([title,page])=>[title,{title:page.title || title,fetchedAt:page.fetchedAt,bundled:true}]));
    try {for(const name of await fs.readdir(this.cacheDir)){
      if(!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      try{const page=JSON.parse(await fs.readFile(path.join(this.cacheDir,name),'utf8'));if(isWikiUrl(page.url)) entries.set(page.title,{title:page.title,fetchedAt:page.fetchedAt,bundled:false});}catch{}
    }}catch{}
    return [...entries.values()].sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
  }
  async clearCache() {
    try {for(const name of await fs.readdir(this.cacheDir)) if(/^[a-f0-9]{64}\.json$/.test(name)) await fs.unlink(path.join(this.cacheDir,name));}catch{}
    this.memory.clear();return this.listCached();
  }
}
module.exports={WikiService,sanitizeWiki,isWikiUrl,pageUrl,checkedTitle,plain,ORIGIN,API};
