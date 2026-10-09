const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');const out=path.join(root,'test-output');
const seed=require('../data/seed.json');
async function check({legacy=false,packaged=false}={}){
  const userDir=path.join(out,'fish-'+(legacy?'legacy-':'live-')+Date.now());await fs.mkdir(userDir,{recursive:true});
  if(legacy){
    // Reproduce the 1.0.0 cache: hidden display:none was stripped, exposing the helper.
    const cached={...seed['鱼'],html:seed['鱼'].html.replace('200金','<span>data-sort-value="200"</span>200金'),fetchedAt:new Date().toISOString()};
    assert.ok(cached.html.includes('data-sort-value="200"'));
    await fs.mkdir(path.join(userDir,'articles'),{recursive:true});await fs.writeFile(path.join(userDir,'articles',crypto.createHash('sha256').update('鱼').digest('hex')+'.json'),JSON.stringify(cached));
    await fs.writeFile(path.join(userDir,'library.json'),JSON.stringify({favorites:[{title:'鱼',addedAt:new Date().toISOString()}],recent:[],settings:{season:'spring',fontSize:16}}));
  }
  const env={...process.env,HANDBOOK_TEST_DIR:userDir,HANDBOOK_TEST_HIDDEN:'1',HANDBOOK_TEST_OFFLINE:legacy?'1':'0'};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({executablePath:packaged?path.join(root,'dist','win-unpacked','星露谷手册.exe'):require('electron'),args:packaged?[]:[root],env,timeout:30000});
  try{
    const win=await app.firstWindow();const errors=[];win.on('pageerror',e=>errors.push(e.message));await expect(win.locator('.category-card')).toHaveCount(9);
    await win.locator('#search-input').fill('鱼');await expect(win.locator('#suggestions')).toBeVisible();await win.locator('#search-input').press('ArrowDown');await win.locator('#search-input').press('Enter');await expect(win.locator('.article-heading h1')).toHaveText('鱼');
    if(!legacy){await win.locator('[data-action="refresh-page"]').click();await expect(win.locator('.article-tag')).toHaveText('官方 Wiki',{timeout:25000});}
    const text=await win.locator('#article-body').innerText();assert.equal(text.includes('data-sort-value='),false);
    for(const value of ['河豚','太阳鱼','200金','250金','夏季'])assert.ok(text.includes(value),value+' remains readable');
    if(legacy){await expect(win.locator('.favorite-button')).toContainText('已收藏');await win.locator('[data-action="refresh-page"]').click();await expect(win.locator('.article-tag')).toHaveText('离线缓存');assert.equal((await win.locator('#article-body').innerText()).includes('data-sort-value='),false);}
    const toc=win.locator('.article-toc button').filter({hasText:'常规鱼类'});const anchor=await toc.getAttribute('data-anchor');
    await win.evaluate(anchor=>{const view=document.querySelector('#view');const el=document.getElementById(anchor);view.style.scrollBehavior='auto';view.scrollTop=el.getBoundingClientRect().top-view.getBoundingClientRect().top+view.scrollTop-15;},anchor);
    await win.waitForFunction(anchor=>{const y=document.getElementById(anchor).getBoundingClientRect().top;const view=document.querySelector('#view').getBoundingClientRect();return y>=view.top&&y<view.top+80;},anchor);
    await win.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const png=await app.evaluate(async({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];await win.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,200));return (await win.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64');});
    await fs.writeFile(path.join(out,legacy?'fish-legacy-fixed.png':'fish-fixed.png'),Buffer.from(png,'base64'));assert.deepEqual(errors,[]);
    console.log('PASS:',legacy?'old cache + offline refresh + existing favorite preserved':'live official fish article + readable names and prices + no sorting code');
  }finally{await app.close();}
}
(async()=>{await fs.mkdir(out,{recursive:true});const packaged=process.argv.includes('--packaged');await check({packaged});await check({legacy:true,packaged});await fs.writeFile(path.join(out,packaged?'fish-packaged-smoke.json':'fish-smoke.json'),JSON.stringify({passed:true,version:require('../package.json').version,at:new Date().toISOString()},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
