const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const out=path.join(root,'test-output');
const userDir=path.join(out,'smoke-user-'+Date.now());
async function screenshot(instance,name){const encoded=await instance.evaluate(async({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];await win.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const image=await win.capturePage(undefined,{stayHidden:true,stayAwake:true});return image.toPNG().toString('base64');});await fs.writeFile(path.join(out,name),Buffer.from(encoded,'base64'));}
async function launch(offline=false,packaged=false){
  const env={...process.env,HANDBOOK_TEST_HIDDEN:'1',HANDBOOK_TEST_DIR:userDir,HANDBOOK_TEST_OFFLINE:offline?'1':'0'};delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({executablePath:packaged?path.join(root,'dist','win-unpacked','星露谷手册.exe'):require('electron'),args:packaged?[]:[root],env,timeout:30000});
}
async function run(){
  await fs.mkdir(out,{recursive:true});const errors=[];let instance;
  try{
    instance=await launch(false,process.argv.includes('--packaged'));let win=await instance.firstWindow();
    win.on('pageerror',error=>errors.push(error.message));
    await expect(win.locator('.category-card')).toHaveCount(9);await expect(win.locator('.villager-card')).toHaveCount(6);
    await win.waitForFunction(()=>[...document.querySelectorAll('.villager-card img')].every(img=>img.complete&&img.naturalWidth>0));
    await screenshot(instance,'home.png');console.log('PASS: home, navigation, original Wiki portraits');
    await win.locator('#search-input').fill('草莓');await expect(win.locator('#suggestions')).toBeVisible();await win.locator('#search-input').press('ArrowDown');await win.locator('#search-input').press('Enter');
    await expect(win.locator('.article-heading h1')).toHaveText('草莓',{timeout:25000});assert.ok((await win.locator('#article-body').innerText()).length>100);
    await win.locator('.favorite-button').click();await expect(win.locator('.favorite-button')).toContainText('已收藏');
    await screenshot(instance,'article.png');console.log('PASS: autocomplete, cached official article, favorite');
    await win.locator('.article-toc [data-font="larger"]').click();assert.equal(await win.locator('html').evaluate(el=>el.style.getPropertyValue('--article-size')),'18px');
    await win.locator('#primary-nav [data-view="favorites"]').click();await expect(win.locator('.result-open strong')).toHaveText('草莓');console.log('PASS: favorites, font size');
    await win.locator('#search-input').fill('钓鱼');await win.locator('#search-form').evaluate(form=>form.requestSubmit());await expect(win.locator('#search-results .result-item').first()).toBeVisible({timeout:25000});await expect(win.locator('#status-text')).toContainText('官方 Wiki 搜索');console.log('PASS: live official Wiki full-text search');
    await win.locator('#category-nav [data-category="fish"]').click();await expect(win.locator('.category-page-header h1')).toHaveText('鱼类与钓鱼',{timeout:25000});assert.ok(await win.locator('#category-results .result-item').count()>0);console.log('PASS: live category members');
    await win.locator('.chips [data-title="太阳鱼"]').click();await expect(win.locator('.article-heading h1')).toHaveText('太阳鱼',{timeout:25000});await expect(win.locator('.article-tag')).toHaveText('官方 Wiki');console.log('PASS: uncached live article and source');
    await win.locator('#back-button').click();await expect(win.locator('.category-page-header h1')).toHaveText('鱼类与钓鱼',{timeout:25000});
    await win.locator('#primary-nav [data-view="home"]').click();
    await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,720));await screenshot(instance,'compact.png');
    assert.equal(await win.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('PASS: compact window has no horizontal overflow');
    assert.equal(await win.locator('.statusbar').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),true);console.log('PASS: compact status bar stays inside window');
    await instance.close();instance=await launch(true,process.argv.includes('--packaged'));win=await instance.firstWindow();win.on('pageerror',error=>errors.push(error.message));
    await expect(win.locator('.category-card')).toHaveCount(9);await win.locator('#primary-nav [data-view="favorites"]').click();await expect(win.locator('.result-open strong')).toHaveText('草莓');console.log('PASS: favorites persisted across restarts');
    await win.locator('#search-input').fill('草莓');await win.locator('#search-form').evaluate(form=>form.requestSubmit());await expect(win.locator('.notice')).toContainText('在线搜索暂不可用');await win.locator('#search-results .result-open').first().click();await expect(win.locator('.article-heading h1')).toHaveText('草莓');
    await win.locator('[data-action="refresh-page"]').click();await expect(win.locator('.article-tag')).toHaveText('离线缓存');await expect(win.locator('.notice')).toContainText('暂时无法连接 Wiki');console.log('PASS: explicit offline search and refresh fallback');
    await win.locator('.sidebar-bottom [data-view="cache"]').click();await expect(win.locator('.cache-summary')).toBeVisible();console.log('PASS: cached library');
    await win.locator('.sidebar-bottom [data-view="about"]').click();await expect(win.locator('.about-paper')).toContainText('CC BY-NC-SA 3.0');assert.deepEqual(errors,[]);console.log('PASS: attribution, no renderer errors');
    await fs.writeFile(path.join(out,process.argv.includes('--packaged')?'packaged-smoke.json':'smoke.json'),JSON.stringify({passed:true,at:new Date().toISOString(),rendererErrors:errors},null,2));
  }finally{if(instance)await instance.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1});
