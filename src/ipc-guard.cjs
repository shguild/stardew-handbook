// Pin the URL Chromium actually commits for our initial loadFile document.
// Windows may represent that path with different case or an 8.3 directory name.
// The pinned URL never follows later navigations, and only the live main frame
// of this exact WebContents is permitted to invoke application IPC.
function createPageGuard(webContents,initialUrl){
  let committedUrl=null;
  webContents.on('did-navigate',(_event,url)=>{
    if(!committedUrl && url.startsWith('file:'))committedUrl=url;
  });
  return {
    isTrusted(event){
      const frame=event.senderFrame;const main=webContents.mainFrame;
      return Boolean(committedUrl && event.sender===webContents && frame && main &&
        frame.processId===main.processId && frame.routingId===main.routingId && frame.url===committedUrl);
    },
    canNavigate(url){return url===(committedUrl || initialUrl);}
  };
}
module.exports={createPageGuard};
