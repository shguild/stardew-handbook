const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const testRoot=path.join(__dirname,'..','test-output','unit');
require('node:fs').mkdirSync(testRoot,{recursive:true});
const {WikiService, sanitizeWiki, isWikiUrl, pageUrl, plain} = require('../src/wiki.cjs');
const {Store} = require('../src/store.cjs');

test('external URL allowlist rejects deceptive hosts, credentials and unsafe schemes',()=>{
  assert.equal(isWikiUrl('https://zh.stardewvalleywiki.com/草莓'),true);
  assert.equal(isWikiUrl('https://stardewvalleywiki.com/Strawberry'),true);
  for(const url of ['javascript:alert(1)','file:///etc/passwd','https://stardewvalleywiki.com.evil.test/','https://evil.test/','https://x@zh.stardewvalleywiki.com/','https://zh.stardewvalleywiki.com:4433/']) assert.equal(isWikiUrl(url),false);
  assert.equal(new URL(pageUrl('草莓')).hostname,'zh.stardewvalleywiki.com');
});
test('article sanitizer preserves tables and converts wiki links while removing active content',()=>{
  const html=sanitizeWiki('<script>alert(1)</script><iframe src="https://evil.test"></iframe><table><tr><td rowspan="2">信息</td></tr></table><a href="/%E8%8D%89%E8%8E%93" onclick="x()">草莓</a><a href="javascript:alert(1)">bad</a><img src="https://evil.test/pixel" onerror="x()"><img src="https://stardewvalleywiki.com/mediawiki/images/a/a/a.png">');
  assert.match(html,/<table>/); assert.match(html,/rowspan="2"/);
  assert.match(html,/https:\/\/zh.stardewvalleywiki.com\//);
  assert.doesNotMatch(html,/<script|<iframe|onclick|onerror|javascript:|evil\.test/);
});
test('fish price sort helpers are removed while the visible prices and normal sort cells remain',()=>{
  const html=sanitizeWiki('<table><tr><td><span style="display:none">data-sort-value="200"</span><table><tr><td>200金</td></tr><tr><td>250金</td></tr></table></td><td><span data-sort-value="0">0金</span></td></tr></table><p>河豚 · 夏季</p><code>data-sort-value="这是文档示例"</code>');
  assert.doesNotMatch(html,/<span[^>]*>\s*data-sort-value=/);
  assert.match(html,/200金/);assert.match(html,/250金/);assert.match(html,/0金/);
  assert.match(html,/河豚 · 夏季/);assert.match(html,/<code>data-sort-value=/);
});
test('legacy cached fish helper spans are cleaned on read without needing a download',async t=>{
  const dir=await fs.mkdtemp(path.join(testRoot,'stardew-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));let requests=0;
  const service=new WikiService({cacheDir:dir,fetcher:async()=>{requests++;throw Error('offline')},seed:{'鱼':{title:'鱼',html:'<table><tr><td><span>data-sort-value="200"</span><table><tr><td>200金</td></tr></table></td></tr></table>',sections:[],url:pageUrl('鱼'),fetchedAt:new Date().toISOString()}}});
  const page=await service.page('鱼');assert.equal(page.cached,true);assert.equal(requests,0);
  assert.doesNotMatch(page.html,/data-sort-value=/);assert.match(page.html,/200金/);
});
test('the real bundled fish article has no visible sorting code after sanitizing',()=>{
  const seed=require('../data/seed.json');const html=sanitizeWiki(seed['鱼'].html);
  assert.doesNotMatch(html,/<span[^>]*>\s*data-sort-value=/);
  for(const text of ['河豚','太阳鱼','鲶鱼','200金','夏季'])assert.ok(html.includes(text),text+' remains readable');
});
test('official samples across 25 affected articles preserve prices, recovery values and item names',()=>{
  const fixtures=require('./fixtures/wiki-price-tables.json');assert.equal(fixtures.length,25);
  for(const sample of fixtures){
    assert.match(sample.html,/data-sort-value=/,sample.title+' reproduces the official helper');
    assert.match(sample.legacyHtml,/data-sort-value=/,sample.title+' reproduces the old cache');
    for(const input of [sample.html,sample.legacyHtml]){
      const html=sanitizeWiki(input);const text=plain(html);
      assert.doesNotMatch(text,/data-sort-value\s*=/,sample.title+' has no sorting code');
      for(const value of sample.expected)assert.ok(text.includes(value),sample.title+' preserves '+value);
    }
  }
});
test('all bundled articles are clean and sanitizing them again is stable',()=>{
  const seed=require('../data/seed.json');assert.equal(Object.keys(seed).length,16);
  for(const [title,page] of Object.entries(seed)){
    const html=sanitizeWiki(page.html);assert.equal(sanitizeWiki(html),html,title+' is stable');
    assert.doesNotMatch(plain(html),/data-sort-value\s*=|\{\{[^}]+\}\}|\[\[[^\]]+\]\]/,title+' contains no raw helper or template markup');
  }
});
test('failed online request returns cached article with explicit offline status',async t=>{
  const dir=await fs.mkdtemp(path.join(testRoot,'stardew-test-')); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const service=new WikiService({cacheDir:dir,fetcher:async()=>{throw Error('offline')},index:[{title:'草莓'}],seed:{'草莓':{title:'草莓',html:'<p>官方缓存</p>',sections:[],url:pageUrl('草莓'),fetchedAt:'2026-10-09T00:00:00Z'}}});
  const article=await service.page('草莓',true); assert.equal(article.offline,true);assert.equal(article.cached,true);
  const result=await service.search('草莓');assert.equal(result.offline,true);assert.equal(result.results[0].title,'草莓');
});
test('live parse follows redirects and retains correct canonical source',async t=>{
  const dir=await fs.mkdtemp(path.join(testRoot,'stardew-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const service=new WikiService({cacheDir:dir,fetcher:async()=>new Response(JSON.stringify({parse:{title:'农作物',pageid:42,revid:100,text:{'*':'<p>正文</p>'},sections:[]}})),index:[]});
  const page=await service.page('作物');assert.equal(page.title,'农作物');assert.equal(page.offline,false);assert.equal(page.revision,100);
  const cached=await service.page('作物');assert.equal(cached.cached,true);assert.equal(cached.title,'农作物');
});
test('API errors and unavailable uncached pages are reported honestly',async t=>{
  const dir=await fs.mkdtemp(path.join(testRoot,'stardew-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const service=new WikiService({cacheDir:dir,fetcher:async()=>new Response(JSON.stringify({error:{code:'missingtitle',info:'missing'}}))});
  await assert.rejects(service.page('不存在'),/找不到/);
});
test('favorites and recent reads survive a new Store instance and remain unique',async t=>{
  const dir=await fs.mkdtemp(path.join(testRoot,'stardew-store-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  let store=new Store(dir);await store.load();await store.toggleFavorite('草莓');await store.recordRead('草莓');await store.recordRead('草莓');
  store=new Store(dir);await store.load();assert.equal(store.state.favorites.length,1);assert.equal(store.state.recent.length,1);
  await store.toggleFavorite('草莓');assert.equal(store.state.favorites.length,0);
});
