const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('handbook',{
  init:()=>ipcRenderer.invoke('init'),
  suggest:query=>ipcRenderer.invoke('suggest',query),
  search:(query,offset)=>ipcRenderer.invoke('search',query,offset),
  page:(title,refresh)=>ipcRenderer.invoke('page',title,refresh),
  category:(id,token)=>ipcRenderer.invoke('category',id,token),
  favorite:title=>ipcRenderer.invoke('favorite',title),
  settings:patch=>ipcRenderer.invoke('settings',patch),
  cached:()=>ipcRenderer.invoke('cached'),
  clearCache:()=>ipcRenderer.invoke('clear-cache'),
  openSource:url=>ipcRenderer.invoke('open-source',url),
  window:action=>ipcRenderer.invoke('window',action)
});
