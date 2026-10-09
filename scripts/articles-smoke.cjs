// Exercise the shipped app with real 1.0.0 HTML samples from every affected
// canonical article found by audit-articles.cjs. All state is isolated.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const fixtures=require('../tests/fixtures/wiki-price-tables.json');
const root=path.join(__dirname,'..');const out=path.join(root,'test-output');
(async()=>{
  const userDir=path.join(out,'articles-legacy-'+Date.now());await fs.mkdir(path.join(userDir,'articles'),{recursive:true});
  const now=new Date().toISOString();
  for(const sample of fixtures){
    const page={title:sample.title,html:sample.legacyHtml,sections:[],url:sample.url,revision:sample.revision,fetchedAt:now};
    await fs.writeFile(path.join(userDir,'articles',crypto.createHash('sha256').update(sample.title).digest('hex')+'.json'),JSON.stringify(page));
  }
  await fs.writeFile(path.join(userDir,'library.json'),JSON.stringify({favorites:fixtures.map(f=>({title:f.title,addedAt:now})),recent:[],settings:{season:'spring',fontSize:16}}));
  const env={...process.env,HANDBOOK_TEST_DIR:userDir,HANDBOOK_TEST_HIDDEN:'1',HANDBOOK_TEST_OFFLINE:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const packaged=process.argv.includes('--packaged');
  const app=await electron.launch({executablePath:packaged?path.join(root,'dist','win-unpacked','星露谷手册.exe'):require('electron'),args:packaged?[]:[root],env,timeout:30000});
  try{
    const win=await app.firstWindow();const errors=[];win.on('pageerror',e=>errors.push(e.message));await expect(win.locator('.category-card')).toHaveCount(9);
    for(const sample of fixtures){
      await win.locator('#search-input').fill(sample.title);await win.locator('#suggestions button').filter({hasText:sample.title}).first().click();
      await expect(win.locator('.article-heading h1')).toHaveText(sample.title);await expect(win.locator('.favorite-button')).toContainText('已收藏');
      for(const refresh of [false,true]){
        if(refresh){await win.locator('[data-action="refresh-page"]').click();await expect(win.locator('.article-tag')).toHaveText('离线缓存');}
        const text=await win.locator('#article-body').innerText();assert.doesNotMatch(text,/data-sort-value\s*=/,sample.title);
        for(const value of sample.expected)assert.ok(text.includes(value),sample.title+' preserves '+value);
      }
      console.log('PASS: old cache + offline fallback + visible values + favorite:',sample.title);
    }
    assert.deepEqual(errors,[]);await expect(win.locator('#favorite-count')).toHaveText(String(fixtures.length));
    await fs.writeFile(path.join(out,'articles-packaged-smoke.json'),JSON.stringify({passed:true,version:require('../package.json').version,at:new Date().toISOString(),articles:fixtures.map(f=>f.title),cases:fixtures.length*2},null,2));
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
