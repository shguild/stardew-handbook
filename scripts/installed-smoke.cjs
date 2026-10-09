const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
function arg(name){const i=process.argv.indexOf(name);assert.ok(i>=0&&process.argv[i+1],name+' required');return process.argv[i+1];}
(async()=>{
  const executablePath=arg('--exe');const userDir=arg('--profile');const stage=arg('--stage');
  const env={...process.env,HANDBOOK_TEST_DIR:userDir,HANDBOOK_TEST_HIDDEN:'1',HANDBOOK_TEST_OFFLINE:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({executablePath,args:[],env,timeout:30000});
  try{
    const win=await app.firstWindow();const errors=[];win.on('pageerror',e=>errors.push(e.message));await expect(win.locator('.category-card')).toHaveCount(9);
    const metadata=await win.evaluate(()=>window.handbook.init());assert.equal(metadata.ok,true);assert.equal(metadata.value.version,require('../package.json').version);assert.equal(metadata.value.bundledCount,16);
    if(stage==='reinstall')assert.ok(metadata.value.state.favorites.some(p=>p.title==='鱼'),'favorite retained after uninstall and reinstall');
    await win.locator('#search-input').fill('鱼');await win.locator('#suggestions button[data-title="鱼"]').click();await expect(win.locator('.article-heading h1')).toHaveText('鱼');
    const text=await win.locator('#article-body').innerText();assert.doesNotMatch(text,/data-sort-value\s*=/);for(const value of ['河豚','太阳鱼','200金','夏季'])assert.ok(text.includes(value),value);
    if(stage==='first')await win.locator('.favorite-button').click();await expect(win.locator('.favorite-button')).toContainText('已收藏');
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(root,'test-output','installed-'+stage+'.json'),JSON.stringify({passed:true,stage,version:metadata.value.version,at:new Date().toISOString(),bundledCount:16,indexCount:metadata.value.indexCount},null,2));
    console.log('PASS: installed application '+stage+' launch, offline Wiki, clean fish content and persisted favorite');
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
