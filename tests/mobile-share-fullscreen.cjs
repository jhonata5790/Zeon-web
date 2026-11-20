'use strict';
// Testes de interação no navegador: mídia, fullscreen e rotação são simulados.
// Verifica a integração real de mobile.js + mobile.css + index.html, sem backend.
const {chromium,webkit}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
const stub=fs.readFileSync(path.join(__dirname,'mobile-dm-browser.stub.js'),'utf8');
const source=fs.readFileSync(path.join(root,'mobile.js'),'utf8');
const css=fs.readFileSync(path.join(root,'mobile.css'),'utf8');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
 if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404);res.end();return;}
 fs.readFile(file,(err,contents)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store'});res.end(contents);
 });
});
async function pageFor(engine,name,opts={}){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(opts.mockFullscreen){
  await page.addInitScript(()=>{
   window.__orientationCalls=[];
   window.__fullscreenActions=[];
   window.__fullShareElement=null;
   Object.defineProperty(document,'fullscreenEnabled',{configurable:true,get:()=>true});
   Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>window.__fullShareElement});
   HTMLElement.prototype.requestFullscreen=function(){
    window.__fullscreenActions.push('enter');
    window.__fullShareElement=this;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
   };
   document.exitFullscreen=()=>{
    window.__fullscreenActions.push('exit');
    window.__fullShareElement=null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
   };
   Object.defineProperty(window.screen,'orientation',{configurable:true,value:{
    lock:async type=>{window.__orientationCalls.push(type);},
    unlock:()=>{window.__orientationCalls.push('unlock');}
   }});
  });
 }
 await page.route('**/web-bridge.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.desktop={isWeb:true};'}));
 await page.route('**/unified.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:stub}));
 await page.route('**/profile-v080.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/livekit.bundle.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('[data-mobile-tab="calls"]').click();
 await page.locator('.zm-item[aria-label="Sala de voz"]').click();
 await page.locator('.call-layout').waitFor({state:'visible'});
 await page.evaluate(()=>{
  const layout=document.querySelector('.call-layout');
  layout.classList.add('is-sharing');
  const stage=document.createElement('section');
  stage.className='call-broadcast';
  stage.innerHTML='<video id="callSharedScreen" class="call-broadcast-video" playsinline muted></video>'+
    '<button type="button" class="broadcast-focus-toggle" data-action="focus" aria-label="Maximizar transmissão">⛶</button>'+
    '<div class="broadcast-label">Tela de teste</div>';
  layout.prepend(stage);
  window.__videoSize={w:1920,h:1080};
  const video=stage.querySelector('video');
  Object.defineProperty(video,'videoWidth',{configurable:true,get:()=>window.__videoSize.w});
  Object.defineProperty(video,'videoHeight',{configurable:true,get:()=>window.__videoSize.h});
  window.__legacyFocusClicks=0;
  document.addEventListener('click',event=>{
   if(event.target.closest('[data-action="focus"]'))window.__legacyFocusClicks++;
  });
 });
 await page.locator('.broadcast-focus-toggle').waitFor({state:'visible'});
 return {browser,context,page,errors,name};
}
async function close(f){
 await f.context.close();await f.browser.close();
}
function focus(page){return page.locator('.broadcast-focus-toggle');}
async function nativeMocked(){
 const f=await pageFor(chromium,'android-mock',{mockFullscreen:true});
 try{
  const p=f.page;
  await focus(p).click();
  await p.waitForFunction(()=>window.__orientationCalls.includes('landscape'));
  let data=await p.evaluate(()=>({
   full:document.fullscreenElement===document.querySelector('.call-broadcast'),
   actions:window.__fullscreenActions,
   locks:window.__orientationCalls,
   old:window.__legacyFocusClicks,
   stream:document.querySelector('.call-broadcast').dataset.zmStreamOrientation
  }));
  assert.equal(data.full,true,'fullscreen element not requested');
  assert.deepEqual(data.actions,['enter']);
  assert.deepEqual(data.locks,['landscape'],'PC source must request landscape');
  assert.equal(data.old,0,'legacy in-page focus must not also run');
  assert.equal(data.stream,'landscape');
  assert.match(await focus(p).getAttribute('aria-label'),/Sair da tela cheia/);
  await p.evaluate(()=>{
   window.__videoSize={w:720,h:1280};
   document.querySelector('#callSharedScreen').dispatchEvent(new Event('resize'));
  });
  await p.waitForFunction(()=>window.__orientationCalls.includes('portrait'));
  data=await p.evaluate(()=>window.__orientationCalls);
  assert.deepEqual(data,['landscape','portrait'],'mobile portrait share must relock to portrait');
  await focus(p).click();
  await p.waitForFunction(()=>window.__fullscreenActions.includes('exit'));
  assert.equal(await p.evaluate(()=>!!document.fullscreenElement),false);
  assert.equal(await p.evaluate(()=>window.__orientationCalls.includes('unlock')),true);
  assert.match(await focus(p).getAttribute('aria-label'),/Assistir em tela cheia/);
  assert.deepEqual(f.errors,[]);
  console.log('PASS Android: requestFullscreen, landscape->portrait, focus interception, exit/unlock');
 }finally{await close(f);}
}
async function delayedStream(){
 const f=await pageFor(chromium,'android-delayed',{mockFullscreen:true});
 try{
  const p=f.page;
  await p.evaluate(()=>{window.__videoSize={w:0,h:0};});
  await focus(p).click();
  assert.deepEqual(await p.evaluate(()=>window.__orientationCalls),[],'dimensions unknown must not force rotation');
  await p.evaluate(()=>{
   window.__videoSize={w:1080,h:1920};
   document.querySelector('#callSharedScreen').dispatchEvent(new Event('loadedmetadata'));
  });
  await p.waitForFunction(()=>window.__orientationCalls.includes('portrait'));
  assert.deepEqual(f.errors,[]);
  console.log('PASS Android: orientation waits for metadata; portrait phone source');
 }finally{await close(f);}
}
async function fallback(engine,label){
 const f=await pageFor(engine,label,{mockFullscreen:false});
 try{
  const p=f.page;
  await p.evaluate(()=>{
   const stage=document.querySelector('.call-broadcast');
   stage.requestFullscreen=undefined;
   const video=stage.querySelector('video');
   video.webkitEnterFullscreen=()=>{throw new Error('native video fullscreen unavailable');};
   Object.defineProperty(document,'fullscreenEnabled',{configurable:true,get:()=>false});
   Object.defineProperty(window.screen,'orientation',{configurable:true,value:{}});
  });
  await focus(p).click();
  await p.locator('.call-broadcast.zm-share-immersive').waitFor({state:'visible'});
  const result=await p.locator('.call-broadcast').evaluate(stage=>({
   position:getComputedStyle(stage).position,
   videoFit:getComputedStyle(stage.querySelector('video')).objectFit,
   hint:stage.querySelector('.zm-share-orientation-hint')?.textContent||'',
   width:stage.getBoundingClientRect().width,
   viewport:document.documentElement.clientWidth
  }));
  assert.equal(result.position,'fixed');
  assert.equal(result.videoFit,'contain');
  assert.match(result.hint,/horizontal/);
  assert.ok(result.width>=result.viewport*.95,'fallback is not viewport-wide');
  await focus(p).click();
  assert.equal(await p.locator('.call-broadcast.zm-share-immersive').count(),0);
  assert.deepEqual(f.errors,[]);
  console.log('PASS '+label+': graceful fullscreen fallback with rotate hint');
 }finally{await close(f);}
}
(async()=>{
 assert.match(source,/requestFullscreen\(\{navigationUI:'hide'\}\)/);
 assert.match(source,/orientation\.lock\(desired\)/);
 assert.match(css,/call-broadcast:fullscreen/);
 assert.match(css,/object-fit:contain!important/);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  await nativeMocked();
  await delayedStream();
  await fallback(chromium,'android-no-fullscreen');
  await fallback(webkit,'iphone-unsupported');
  console.log('PASS share fullscreen + auto orientation compatibility suite');
 }finally{server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
