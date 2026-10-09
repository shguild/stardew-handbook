const {app,net}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {WikiService,isWikiUrl}=require('../src/wiki.cjs');
const catalog=require('../src/catalog.cjs');
const root=path.join(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.mkdir(path.join(root,'assets','wiki'),{recursive:true});
  const service=new WikiService({cacheDir:path.join(root,'test-output','bootstrap-cache'),fetcher:(url,options)=>net.fetch(url,options)});
  const index=[];let token;
  do {
    const data=await service.api({action:'query',list:'allpages',apnamespace:0,aplimit:500,...(token?{apcontinue:token}:{})});
    index.push(...data.query.allpages.map(p=>({title:p.title})));token=data.continue?.apcontinue;await delay(200);
  }while(token);
  await fs.writeFile(path.join(root,'data','index.json'),JSON.stringify(index));console.log('Official title index:',index.length);
  const titles=['草莓','防风草','蓝莓','南瓜','上古水果','阿比盖尔','塞巴斯蒂安','莉亚','海莉','潘妮','山姆','鱼','收集包','春季','姜岛','新手指南'];
  const seed={};const failures=[];const imageUrls=new Set();
  for(const title of titles){
    try{
      const page=await service.page(title,true);seed[title]=page;
      for(const match of page.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
        let url=match[1].replace(/&amp;/g,'&');if(!isWikiUrl(url))continue;
        const u=new URL(url);if(u.pathname.includes('/images/thumb/')) {u.pathname=u.pathname.replace('/images/thumb/','/images/').split('/').slice(0,-1).join('/');url=u.href;}
        imageUrls.add(url);
      }
      console.log('Saved official article:',title);
    }catch(error){failures.push({title,error:error.message});console.log('Skipped:',title,error.message)}await delay(220);
  }
  await fs.writeFile(path.join(root,'data','seed.json'),JSON.stringify(seed));
  const files=[...new Set([...catalog.categories.map(c=>c.icon),...catalog.villagers.map(v=>v.image),...catalog.featured.map(p=>p.image),...catalog.seasons.map(s=>s.icon),'Lost_Book.png','Chest.png','Strawberry.png','Stardrop.png','Leah.png','Sebastian.png','Haley.png','Penny.png','Sam.png'])];
  const imageData=await service.api({action:'query',titles:files.map(file=>'File:'+file).join('|'),prop:'imageinfo',iiprop:'url'});
  const priorityUrls=Object.values(imageData.query.pages).filter(p=>p.imageinfo?.[0]?.url).map(p=>p.imageinfo[0].url);
  let manifest=[];try{manifest=JSON.parse(await fs.readFile(path.join(root,'data','sources.json'),'utf8')).images || [];}catch{}
  for(const url of [...new Set([...priorityUrls,...imageUrls])].slice(0,350)){
    const filename=decodeURIComponent(new URL(url).pathname.split('/').pop());
    if(!/^[\w .()'-]+\.(png|gif|jpe?g)$/i.test(filename))continue;
    try{await fs.access(path.join(root,'assets','wiki',filename));if(!manifest.some(p=>p.filename===filename))manifest.push({filename,url});continue;}catch{}
    try{
      const response=await net.fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok || !response.headers.get('content-type')?.startsWith('image/'))throw Error('not image');
      const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>4*1024*1024)continue;
      await fs.writeFile(path.join(root,'assets','wiki',filename),bytes);if(!manifest.some(p=>p.filename===filename))manifest.push({filename,url});
    }catch{}
    await delay(60);
  }
  const info={fetchedAt:new Date().toISOString(),source:'https://zh.stardewvalleywiki.com',license:'CC BY-NC-SA 3.0',indexCount:index.length,seedTitles:Object.keys(seed),failures,images:manifest};
  await fs.writeFile(path.join(root,'data','sources.json'),JSON.stringify(info,null,2));console.log('Official image assets:',manifest.length);console.log('Bootstrap complete.');app.quit();
}).catch(error=>{console.error(error);app.exit(1)});
