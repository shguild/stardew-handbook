const {app,BrowserWindow,ipcMain,net,session,shell,protocol}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {WikiService,isWikiUrl}=require('./wiki.cjs');
const {Store}=require('./store.cjs');
const catalog=require('./catalog.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'wiki-image',privileges:{secure:true,standard:true,supportFetchAPI:true,bypassCSP:false}}]);
let mainWindow;
if(process.env.HANDBOOK_TEST_DIR) app.setPath('userData',process.env.HANDBOOK_TEST_DIR);
app.setAppUserModelId('local.stardew.handbook');
const locked=app.requestSingleInstanceLock();
if(!locked) app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(async()=>{
    const dir=app.getPath('userData');const store=new Store(dir);await store.load();
    const dataDir=path.join(__dirname,'..','data');let seed={},index=[];try{seed=JSON.parse(await fs.readFile(path.join(dataDir,'seed.json'),'utf8'));index=JSON.parse(await fs.readFile(path.join(dataDir,'index.json'),'utf8'));}catch{}
    const fetcher=(url,options)=>net.fetch(url,options);
    const wiki=new WikiService({cacheDir:path.join(dir,'articles'),fetcher,seed,index});
    session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    const imageDir=path.join(dir,'images');await fs.mkdir(imageDir,{recursive:true});
    const imagesPending=new Map();
    protocol.handle('wiki-image',async request=>{
      try{
        const url=decodeURIComponent(new URL(request.url).pathname.slice(1));
        if(!isWikiUrl(url) || !new URL(url).pathname.startsWith('/mediawiki/images/')) return new Response('',{status:403});
        const file=path.join(imageDir,crypto.createHash('sha256').update(url).digest('hex')+'.img');
        try{return new Response(await fs.readFile(file),{headers:{'Content-Type':'image/png'}})}catch{}
        let original=decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/^\d+px-/,'');
        if(/^[\w .()'-]+\.(png|gif|jpe?g)$/i.test(original)){
          try{const bundled=path.join(__dirname,'..','assets','wiki',original);await fs.access(bundled);return await net.fetch(pathToFileURL(bundled).href)}catch{}
        }
        if(process.env.HANDBOOK_TEST_OFFLINE==='1') return new Response('',{status:503});
        if(!imagesPending.has(url)) imagesPending.set(url,(async()=>{
          try{const response=await net.fetch(url,{signal:AbortSignal.timeout(9000)});const type=response.headers.get('content-type') || '';if(!response.ok||!type.startsWith('image/'))throw Error('image');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5*1024*1024)throw Error('large');await fs.writeFile(file,bytes);return {bytes,type};}finally{imagesPending.delete(url)}
        })());
        const image=await imagesPending.get(url);return new Response(image.bytes,{headers:{'Content-Type':image.type}});
      }catch{return new Response('',{status:503})}
    });
    if(process.env.HANDBOOK_TEST_OFFLINE==='1') wiki.fetcher=async()=>{throw Error('offline test')};
    const htmlFile=path.join(__dirname,'index.html');const htmlUrl=pathToFileURL(htmlFile).href;
    function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{
      if(event.senderFrame?.url!==htmlUrl || event.sender!==mainWindow?.webContents) throw Error('请求来源无效。');
      try{return {ok:true,value:await fn(...args)}}catch(error){return {ok:false,error:error.message || '操作失败，请重试。'}}
    });}
    handle('init',async()=>({catalog,state:store.snapshot(),indexCount:index.length,version:app.getVersion(),bundledCount:Object.keys(seed).length}));
    handle('suggest',q=>{if(typeof q!=='string'||q.length>250)return [];return wiki.suggest(q)});
    handle('search',(q,offset=0)=>wiki.search(q,offset));
    handle('page',async(title,refresh=false)=>{const page=await wiki.page(title,refresh===true);try{await store.recordRead(page.title)}catch{}return {...page,state:store.snapshot()};});
    handle('category',async(id,token)=>{
      const cat=catalog.categories.find(c=>c.id===id);if(!cat)throw Error('分类不存在。');if(token && (typeof token!=='string'||token.length>500))throw Error('分类页码无效。');
      const curated=cat.pages.filter(title=>index.some(p=>p.title===title)).map(title=>({title}));
      if(!cat.category)return {results:[],curated,offline:false,next:null};
      try {const data=await wiki.category(cat.category,token);return {...data,curated,offline:false};}catch{return {results:[],curated,offline:true,next:null};}
    });
    handle('favorite',title=>store.toggleFavorite(title));
    handle('settings',patch=>store.settings(patch && typeof patch==='object'?patch:{}));
    handle('cached',()=>wiki.listCached());
    handle('clear-cache',async()=>{await wiki.clearCache();for(const file of await fs.readdir(imageDir))if(/^[a-f0-9]{64}\.img$/.test(file))await fs.unlink(path.join(imageDir,file));return wiki.listCached();});
    handle('open-source',async url=>{if(!isWikiUrl(url))throw Error('只能打开官方 Wiki 链接。');await shell.openExternal(url);return true;});
    handle('window',action=>{if(action==='minimize')mainWindow.minimize();else if(action==='maximize'){mainWindow.isMaximized()?mainWindow.unmaximize():mainWindow.maximize();}else if(action==='close')mainWindow.close();return true;});
    mainWindow=new BrowserWindow({width:1380,height:920,minWidth:940,minHeight:650,frame:false,show:false,backgroundColor:'#f7e8c6',title:'星露谷手册',icon:path.join(__dirname,'..','assets','app.ico'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:process.env.HANDBOOK_TEST_HIDDEN!=='1'}});
    mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==htmlUrl)event.preventDefault()});
    mainWindow.once('ready-to-show',()=>{if(process.env.HANDBOOK_TEST_HIDDEN!=='1')mainWindow.show()});
    await mainWindow.loadFile(htmlFile);
  }).catch(error=>{console.error(error);app.quit()});
}
app.on('window-all-closed',()=>app.quit());
