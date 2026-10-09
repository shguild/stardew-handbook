// Read-only audit of official Wiki HTML across all handbook entries and an
// evenly spaced sample of the complete title index. Raw responses stay in test-output.
const {app,net}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {parseDocument}=require('htmlparser2');
const {textContent}=require('domutils');
const {WikiService,sanitizeWiki}=require('../src/wiki.cjs');
const catalog=require('../src/catalog.cjs');
const seed=require('../data/seed.json');
const index=require('../data/index.json');
const out=path.join(__dirname,'..','test-output','article-audit');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function walk(node,fn){fn(node);for(const child of node.children || [])walk(child,fn);}
function inspect(html){
  const cleaned=sanitizeWiki(html);const hidden=[];const markup=[];const text=textContent(parseDocument(cleaned));
  walk(parseDocument(html),node=>{
    const attrs=node.attribs || {};
    if(/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(attrs.style || '') || Object.hasOwn(attrs,'hidden')){
      const value=textContent(node).trim();if(value)hidden.push({tag:node.name,style:attrs.style || '',class:attrs.class || '',text:value.slice(0,220),stillPresent:text.includes(value)});
    }
  });
  walk(parseDocument(cleaned),node=>{
    if(node.type!=='text')return;
    const value=node.data.trim();
    if(/(?:data-[\w-]+|style|class|rowspan|colspan|align|width|height)\s*=\s*["']|\{\{[^}]+\}\}|\[\[[^\]]+\]\]|<(?:span|div|table|td|br)\b|Lua (?:错误|error)/i.test(value))markup.push(value.slice(0,300));
  });
  return {hidden,markup,visibleSortHelpers:(text.match(/data-sort-value\s*=/g) || []).length};
}
app.whenReady().then(async()=>{
  await fs.mkdir(out,{recursive:true});
  const service=new WikiService({cacheDir:out,fetcher:(url,opts)=>net.fetch(url,opts)});
  const titles=[...new Set([...Object.keys(seed),...catalog.categories.flatMap(c=>c.pages),...catalog.seasons.flatMap(s=>s.pages),...Array.from({length:64},(_,i)=>index[Math.floor(i*(index.length-1)/63)].title)])];
  const results=[];let next=0;
  async function worker(){
    while(next<titles.length){const title=titles[next++];const filename=crypto.createHash('sha256').update(title).digest('hex')+'.json';
      try{
        let data;if(process.argv.includes('--cached'))data=JSON.parse(await fs.readFile(path.join(out,filename),'utf8'));else{
          data=await service.api({action:'parse',page:title,prop:'text|revid',redirects:'1',disableeditsection:'1',disabletoc:'1'});
          await fs.writeFile(path.join(out,filename),JSON.stringify(data));
        }
        if(!data.parse?.text?.['*'])throw Error('missing parsed text');
        const result={title,canonicalTitle:data.parse.title,revision:data.parse.revid,...inspect(data.parse.text['*'])};results.push(result);
        if(result.markup.length || result.hidden.some(h=>h.stillPresent))console.log('CHECK',title,JSON.stringify({markup:result.markup,hidden:result.hidden.filter(h=>h.stillPresent).slice(0,4)}));
      }catch(error){results.push({title,error:error.message});console.log('FAIL',title,error.message);}
      if(results.length%20===0)console.log('Progress',results.length+'/'+titles.length);
      if(!process.argv.includes('--cached'))await delay(350);
    }
  }
  await Promise.all([worker(),worker()]);
  const bundled=Object.entries(seed).map(([title,page])=>({title,...inspect(page.html)}));
  const report={at:new Date().toISOString(),version:require('../package.json').version,total:titles.length,successful:results.filter(r=>!r.error).length,bundled,results};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Complete',report.successful+'/'+report.total,'official articles;',bundled.length,'bundled articles');app.quit();
}).catch(error=>{console.error(error);app.exit(1)});
