'use strict';
// Verifica o HTML/CSS mobile real em navegador; backend e mídia são simulados.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','mobile-duo');
fs.mkdirSync(out,{recursive:true});
const stub=fs.readFileSync(path.join(__dirname,'mobile-dm-browser.stub.js'),'utf8');
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
const server=http.createServer((request,response)=>{
 const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
 const p=path.resolve(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
 if(!p.startsWith(root+path.sep)||!types[path.extname(p)]){response.writeHead(404);response.end();return;}
 fs.readFile(p,(error,data)=>{
  if(error){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':types[path.extname(p)],'Cache-Control':'no-store'});response.end(data);
 });
});
async function mount(page){
 await page.route('**/web-bridge.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.desktop={isWeb:true};'}));
 await page.route('**/unified.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:stub}));
 await page.route('**/profile-v080.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/livekit.bundle.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await page.locator('.zm-item-name',{hasText:'Júlia'}).waitFor({state:'visible'});
 await page.locator('[data-mobile-tab="calls"]').click();
 await page.locator('.zm-item[aria-label="Sala de voz"]').click();
 await page.locator('.call-participants.zm-call-duo').waitFor({state:'visible'});
}
async function measure(page){
 return page.locator('.call-participants').evaluate(grid=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const main=grid.querySelector('.zm-call-main'),pip=grid.querySelector('.zm-call-pip');
  return {stage:rect(grid),main:main&&rect(main),pip:pip&&rect(pip),
    mainLocal:main?.dataset.zmLocal,pipLocal:pip?.dataset.zmLocal};
 });
}
function checkGeometry(m,label){
 assert.ok(m.main&&m.pip,label+': spotlight or PiP missing '+JSON.stringify(m));
 assert.ok(m.stage.w>100&&m.stage.h>100,label+': invalid stage '+JSON.stringify(m));
 assert.ok(m.main.w>=m.stage.w*.94&&m.main.h>=m.stage.h*.94,label+': spotlight not large '+JSON.stringify(m));
 assert.ok(m.pip.w<=m.stage.w*.52&&m.pip.h<=m.stage.h*.59,label+': PiP too large '+JSON.stringify(m));
 assert.ok(m.pip.w>=65&&m.pip.h>=65,label+': PiP too small '+JSON.stringify(m));
 assert.ok(m.pip.x>=m.stage.x&&m.pip.y>=m.stage.y,label+': PiP starts outside stage '+JSON.stringify(m));
 assert.ok(m.pip.x+m.pip.w<=m.stage.x+m.stage.w+1,label+': PiP overflows right '+JSON.stringify(m));
 assert.ok(m.pip.y+m.pip.h<=m.stage.y+m.stage.h+1,label+': PiP overflows bottom '+JSON.stringify(m));
}
async function verify(engine,label,width,height){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await mount(page);
  let m=await measure(page);
  checkGeometry(m,label);
  assert.equal(m.mainLocal,'false',label+': remote should be main by default');
  assert.equal(m.pipLocal,'true',label+': self should start as PiP');
  await page.screenshot({path:path.join(out,label+'-chamada.png'),fullPage:true});
  await page.evaluate(()=>{document.querySelector('.call-person-card[data-person="u"]').__persistentCard=true;});
  await page.locator('.zm-call-pip').click();
  m=await measure(page);checkGeometry(m,label+' swapped');
  assert.equal(m.mainLocal,'true',label+': tapping PiP did not change focus');
  assert.equal(await page.evaluate(()=>document.querySelector('.call-person-card[data-person="u"]').__persistentCard),true);
  await page.screenshot({path:path.join(out,label+'-foco-trocado.png'),fullPage:true});
  if(label==='android-390'){
   await page.setViewportSize({width:844,height:390});
   await page.waitForTimeout(130);
   m=await measure(page);checkGeometry(m,'rotated landscape');
   assert.equal(m.mainLocal,'true','rotation reverted focus');
   assert.equal(await page.locator('#zeon-mobile-root').evaluate(n=>n.hidden),false);
   await page.screenshot({path:path.join(out,'android-rotacao.png'),fullPage:true});
   await page.setViewportSize({width,height});
   await page.waitForTimeout(130);checkGeometry(await measure(page),'rotated portrait');
  }
  await page.evaluate(()=>{
   const grid=document.querySelector('.call-participants'),card=document.createElement('article');
   card.className='call-person-card';card.dataset.person='third';card.dataset.zmLocal='false';
   card.innerHTML='<div class="call-person-avatar">T</div>';grid.append(card);
   document.dispatchEvent(new CustomEvent('zeon:web-render'));
  });
  await page.waitForFunction(()=>!document.querySelector('.call-participants')?.classList.contains('zm-call-duo'));
  assert.equal(await page.locator('.call-person-card').count(),3);
  assert.equal(await page.locator('.zm-call-pip').count(),0);
  await page.screenshot({path:path.join(out,label+'-tres-participantes.png'),fullPage:true});
  await page.evaluate(()=>{
   document.querySelector('[data-person="third"]').remove();
   const layout=document.querySelector('.call-layout');
   layout.classList.add('is-sharing');
   layout.querySelector('.call-participants').classList.add('call-participants--compact');
   document.dispatchEvent(new CustomEvent('zeon:web-render'));
  });
  await page.waitForFunction(()=>!document.querySelector('.call-participants')?.classList.contains('zm-call-duo'));
  assert.equal(await page.locator('.zm-call-pip').count(),0);
  assert.deepEqual(errors,[],label+' browser JS errors '+errors.join('; '));
  console.log('PASS '+label+': full main, swappable PiP, three-person grid, sharing');
  await context.close();
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  await verify(chromium,'android-390',390,844);
  await verify(chromium,'android-320',320,700);
  await verify(chromium,'android-horizontal',844,390);
  await verify(webkit,'iphone-390',390,844);
  console.log('PASS quatro formatos e rotação');
 }finally{server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
