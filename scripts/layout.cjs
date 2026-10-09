const {_electron:electron}=require('@playwright/test');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const version=require('../package.json').version;
(async()=>{
 const env={...process.env,HANDBOOK_TEST_DIR:path.join(root,'test-output','layout-user'),HANDBOOK_TEST_HIDDEN:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const dev=process.argv.includes('--dev');const portable=process.argv.includes('--portable');
 const app=await electron.launch({executablePath:dev?require('electron'):path.join(root,'dist',portable?`Stardew-Handbook-${version}-Windows-x64.exe`:'win-unpacked/星露谷手册.exe'),env,args:dev?[root]:[],timeout:30000});
 try{
  const win=await app.firstWindow();await win.waitForSelector('.category-card');
  for(const [width,height] of [[1380,920],[980,720]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);
   await win.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const dims=await win.evaluate(()=>{const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};return {width:innerWidth,height:innerHeight,view:rect('#view'),status:rect('.statusbar'),workspace:rect('.workspace'),shell:rect('.app-shell')};});
   console.log(JSON.stringify(dims));assert.ok(dims.status.bottom<=dims.height+1,'status bar fits window');assert.ok(dims.view.height>100);
  }
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
