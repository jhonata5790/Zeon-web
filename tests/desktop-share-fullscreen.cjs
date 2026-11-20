'use strict';
/* Desktop Web fullscreen integration smoke test.
 * Loads the actual unified.js / styles.css / mobile.js, but stubs
 * Supabase, LiveKit and account data. No real calls or accounts involved.
 */
const {chromium,webkit}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const filename=path.resolve(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
 if(!filename.startsWith(root+path.sep)||!mime[path.extname(filename)]){res.writeHead(404);res.end();return;}
 fs.readFile(filename,(err,data)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(filename)],'Cache-Control':'no-store'});res.end(data);
 });
});
const stub=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
async function start(engine,label,{width=1280,height=800,deny=false}={}){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width,height},isMobile:false,hasTouch:false});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(options=>{
  window.__fsRequests=[];
  window.__fsExits=0;
  window.__fsCurrent=null;
  Object.defineProperty(document,'fullscreenEnabled',{configurable:true,get:()=>true});
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>window.__fsCurrent});
  HTMLElement.prototype.requestFullscreen=function(){
   window.__fsRequests.push({node:this.id,tag:this.tagName,classes:this.className});
   if(options.deny)return Promise.reject(new Error('Fullscreen permission denied by test browser'));
   window.__fsCurrent=this;
   document.dispatchEvent(new Event('fullscreenchange'));
   return Promise.resolve();
  };
  document.exitFullscreen=()=>{
   window.__fsExits++;
   window.__fsCurrent=null;
   document.dispatchEvent(new Event('fullscreenchange'));
   return Promise.resolve();
  };
 },{deny});
 const routes={
  'livekit.bundle.js':stub('desktop-fullscreen-livekit.stub.js'),
  'web-bridge.js':stub('desktop-fullscreen-bridge.stub.js'),
  'zeon-dm.js':stub('desktop-fullscreen-dm.stub.js'),
  'profile-v080.js':'window.ConsivoProfile={displayName:()=> "Teste"};'
 };
 for(const [file,body] of Object.entries(routes))
  await page.route('**/'+file,r=>r.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('#authGate').waitFor({state:'hidden'});
 await page.locator('.room-entry[data-id="v1"]').waitFor({state:'visible'});
 await page.locator('.room-entry[data-id="v1"]').click();
 await page.locator('#callSharedScreen').waitFor({state:'attached'});
 await page.locator('.broadcast-focus-toggle').waitFor({state:'visible'});
 return {browser,context,page,errors,label};
}
async function stop(t){
 await t.context.close();
 await t.browser.close();
}
async function verifyDesktop(engine,label){
 const t=await start(engine,label);
 try{
  const page=t.page;
  assert.equal(await page.locator('#workspace').getAttribute('class'),'workspace voice-workspace');
  const initial=await page.locator('.broadcast-focus-toggle').getAttribute('aria-label');
  assert.match(initial,/tela cheia/i,label+' initial label');
  await page.locator('.broadcast-focus-toggle').click();
  const details=await page.evaluate(()=>({
   current:document.fullscreenElement?.id,
   requests:window.__fsRequests.map(x=>x.node),
   exits:window.__fsExits,
   hasFocus:document.querySelector('.call-layout').classList.contains('share-focused'),
   label:document.querySelector('.broadcast-focus-toggle')?.getAttribute('aria-label')
  }));
  assert.equal(details.current,'workspace',label+' not in real fullscreen host');
  assert.deepEqual(details.requests,['workspace'],label+' fullscreen requested on incorrect node');
  assert.equal(details.hasFocus,false,label+' old focus activated instead of fullscreen');
  assert.match(details.label,/Sair da tela cheia/);
  // The room may redraw videos while a participant joins; the root must survive.
  await page.evaluate(()=>{
   window.__fakeParticipants=3;
   window.__fakeRoom.setParticipants(3);
   window.__fakeRoom.trigger('ParticipantConnected');
  });
  await page.waitForFunction(()=>document.querySelectorAll('.call-person-card').length===3);
  assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'workspace',label+' fullscreen lost after room rerender');
  assert.equal(await page.locator('.broadcast-focus-toggle').getAttribute('aria-label'),'Sair da tela cheia');
  // Exiting through the same button, and subsequently by the browser (Escape).
  await page.locator('.broadcast-focus-toggle').click();
  await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.evaluate(()=>window.__fsExits),1);
  await page.locator('.broadcast-focus-toggle').click();
  assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'workspace');
  await page.evaluate(()=>document.exitFullscreen());
  await page.waitForFunction(()=>!document.fullscreenElement);
  assert.match(await page.locator('.broadcast-focus-toggle').getAttribute('aria-label'),/Colocar transmissão em tela cheia/);
  // If the presenter stops sharing, the app must close native fullscreen.
  await page.locator('.broadcast-focus-toggle').click();
  assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'workspace');
  await page.evaluate(()=>{
   window.__fakeShareActive=false;
   window.__fakeRoom.trigger('TrackUnpublished');
  });
  await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.locator('#callSharedScreen').count(),0,label+' screen element survived stream end');
  assert.deepEqual(t.errors,[],label+' uncaught JS errors');
  console.log('PASS '+label+': fullscreen, exit, Escape, participant rerender, share ending');
 }finally{await stop(t);}
}
async function verifyDenied(){
 const t=await start(chromium,'desktop-denied',{deny:true,width:1200,height:760});
 try{
  const page=t.page;
  await page.locator('.broadcast-focus-toggle').click();
  await page.waitForFunction(()=>document.querySelector('.call-layout')?.classList.contains('share-focused'));
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);
  assert.ok((await page.locator('.broadcast-focus-toggle').getAttribute('aria-label')).includes('Restaurar'));
  await page.locator('.broadcast-focus-toggle').click();
  await page.waitForFunction(()=>!document.querySelector('.call-layout')?.classList.contains('share-focused'));
  assert.deepEqual(t.errors,[]);
  console.log('PASS PC fallback: browser denies native fullscreen');
 }finally{await stop(t);}
}
(async()=>{
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 const code=fs.readFileSync(path.join(root,'unified.js'),'utf8');
 assert.match(css,/#workspace\.voice-workspace:fullscreen \.call-broadcast-video/);
 assert.match(css,/object-fit:contain!important/);
 assert.match(code,/root\.requestFullscreen\(\{navigationUI:'hide'\}\)/);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  await verifyDesktop(chromium,'Chromium Windows-like');
  await verifyDesktop(webkit,'WebKit desktop');
  await verifyDenied();
  console.log('PASS desktop fullscreen test suite');
 }finally{server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
