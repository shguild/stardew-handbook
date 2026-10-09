const fs=require('node:fs/promises');
const path=require('node:path');
const {checkedTitle}=require('./wiki.cjs');
class Store {
  constructor(dir) {this.dir=dir;this.file=path.join(dir,'library.json');this.queue=Promise.resolve();this.state={favorites:[],recent:[],settings:{season:'spring',fontSize:16}};}
  async load() {
    try{const saved=JSON.parse(await fs.readFile(this.file,'utf8'));
      for(const key of ['favorites','recent']) if(Array.isArray(saved[key])) this.state[key]=saved[key].filter(p=>typeof p?.title==='string' && p.title.length<=250).slice(0,key==='favorites'?250:40);
      if(['spring','summer','fall','winter'].includes(saved.settings?.season)) this.state.settings.season=saved.settings.season;
      if([14,16,18,20].includes(saved.settings?.fontSize)) this.state.settings.fontSize=saved.settings.fontSize;
    }catch{}return this.snapshot();
  }
  snapshot(){return structuredClone(this.state)}
  mutate(fn){this.queue=this.queue.catch(()=>{}).then(async()=>{const next=this.snapshot();fn(next);await fs.mkdir(this.dir,{recursive:true});await fs.writeFile(this.file+'.tmp',JSON.stringify(next,null,2),'utf8');await fs.rename(this.file+'.tmp',this.file);this.state=next;return this.snapshot();});return this.queue;}
  toggleFavorite(input){const title=checkedTitle(input);return this.mutate(state=>{const i=state.favorites.findIndex(p=>p.title===title);if(i>=0)state.favorites.splice(i,1);else{if(state.favorites.length>=250)throw Error('最多可收藏 250 个词条。');state.favorites.unshift({title,addedAt:new Date().toISOString()});}});}
  recordRead(input){const title=checkedTitle(input);return this.mutate(state=>{state.recent=[{title,readAt:new Date().toISOString()},...state.recent.filter(p=>p.title!==title)].slice(0,40);});}
  settings(patch){return this.mutate(state=>{if(['spring','summer','fall','winter'].includes(patch.season))state.settings.season=patch.season;if([14,16,18,20].includes(patch.fontSize))state.settings.fontSize=patch.fontSize;});}
}
module.exports={Store};
