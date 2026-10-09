const {chromium,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
const net=require('node:net');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const version=require('../package.json').version;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});}
(async()=>{
  const port=await freePort();const userDir=path.join(root,'test-output','portable-user-'+Date.now());
  const env={...process.env,HANDBOOK_TEST_DIR:userDir,HANDBOOK_TEST_HIDDEN:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(path.join(root,'dist',`Stardew-Handbook-${version}-Windows-x64.exe`),['--remote-debugging-port='+port],{env,windowsHide:true,stdio:'ignore'});
  let spawnError;child.on('error',error=>spawnError=error);let browser;
  try{
    let ready=false;
    for(let i=0;i<90;i++){
      if(spawnError)throw spawnError;
      try{const r=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(800)});if(r.ok){ready=true;break;}}catch{}
      await delay(400);
    }
    assert.ok(ready,'Portable executable opens its Chromium runtime');
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);const win=browser.contexts()[0].pages()[0];
    await expect(win.locator('.category-card')).toHaveCount(9);const metadata=await win.evaluate(()=>window.handbook.init());assert.equal(metadata.ok,true);assert.equal(metadata.value.bundledCount,16);
    await win.locator('.villager-card[data-title="阿比盖尔"]').click();await expect(win.locator('.article-heading h1')).toHaveText('阿比盖尔');assert.ok((await win.locator('#article-body').innerText()).length>1000);
    assert.equal(await win.locator('.statusbar').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true);
    await fs.writeFile(path.join(root,'test-output','portable-smoke.json'),JSON.stringify({passed:true,at:new Date().toISOString(),version:metadata.value.version,indexCount:metadata.value.indexCount,bundledCount:metadata.value.bundledCount},null,2));
    console.log('PASS: portable EXE extracts, starts, initializes and opens official Wiki article');
    await win.evaluate(()=>window.handbook.window('close')).catch(()=>{});
  }finally{
    if(browser)await browser.close().catch(()=>{});
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(15000)]);
    if(child.exitCode===null)child.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
