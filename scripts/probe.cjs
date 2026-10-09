const {app,net}=require('electron');
const {WikiService}=require('../src/wiki.cjs');
app.whenReady().then(async()=>{
 const wiki=new WikiService({fetcher:(url,options)=>net.fetch(url,options)});
 const cats=await wiki.api({action:'query',titles:'阿比盖尔|收集包',prop:'categories',cllimit:500});console.log('CATEGORIES',JSON.stringify(cats.query.pages));
 const files=['Sunfish.png','Golden_Walnut.png','Farm_Map.png','Stardrop.png','Penny.png','Sam.png','Book.png','Chest.png','Bundle.png','Farm.png','Map.png'];
 const data=await wiki.api({action:'query',titles:files.map(f=>'File:'+f).join('|'),prop:'imageinfo',iiprop:'url'});console.log('FILES',JSON.stringify(data.query.pages));
 app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
