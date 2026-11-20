'use strict';
// Emulação de navegador; Supabase/LiveKit substituídos por fixture isolada.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','mobile-dm');
fs.mkdirSync(out,{recursive:true});
const stub=fs.readFileSync(path.join(__dirname,'mobile-dm-browser.stub.js'),'utf8');
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'};
const server=http.createServer((request,response)=>{
 const p=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
 const file=path.join(root,p==='/'?'index.html':p.replace(/^\/+/,''));
 if(!file.startsWith(root+path.sep)||!types[path.extname(file)]){response.writeHead(404);response.end();return;}
 fs.readFile(file,(error,data)=>{
  if(error){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});response.end(data);
 });
});
async function mount(page){
 await page.route('**/web-bridge.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.desktop={isWeb:true};'}));
 await page.route('**/unified.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:stub}));
 await page.route('**/profile-v080.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.route('**/livekit.bundle.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
}
async function mobile(engine,label,width,height){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await mount(page);
  await page.locator('.zm-item-name',{hasText:'Júlia'}).waitFor({state:'visible'});
  assert.deepEqual(await page.locator('.zm-item-name').allTextContents(),['Júlia','geral','criação']);
  await page.screenshot({path:path.join(out,label+'-conversas.png'),fullPage:true});
  // Geometria real no navegador: dois cards nunca ficam alongados.
  await page.locator('[data-mobile-tab="groups"]').click();
  await page.locator('.zm-item[aria-label="Ressonância"]').click();
  await page.locator('[data-mobile-tab="calls"]').click();
  await page.locator('.zm-item',{hasText:'Sala de voz'}).click();
  await page.locator('.call-person-card').first().waitFor({state:'visible'});
  await page.waitForTimeout(100);
  async function assertCallGeometry(mode){
   const measure=await page.locator('.call-participants').evaluate(grid=>{
    const cards=[...grid.querySelectorAll('.call-person-card')].map(card=>{
     const r=card.getBoundingClientRect();
     return {x:r.x,y:r.y,width:r.width,height:r.height};
    });
    const stage=grid.getBoundingClientRect();
    return {cards,stage:{width:stage.width,height:stage.height}};
   });
   assert.equal(measure.cards.length,2,label+' needs two call cards');
   const [first,second]=measure.cards;
   assert.ok(first.width>50&&first.height>50,label+' tile too small '+JSON.stringify(measure));
   assert.ok(Math.abs(first.width-second.width)<=2&&Math.abs(first.height-second.height)<=2,label+' unequal cards '+JSON.stringify(measure));
   const ratio=first.width/first.height;
   const expected=mode==='landscape'?1.6:0.8;
   assert.ok(Math.abs(ratio-expected)<=0.16,label+' stretched cards (ratio '+ratio+', expected '+expected+')');
   assert.ok(first.height<Math.max(300,measure.stage.height*.75),label+' tile fills stage '+JSON.stringify(measure));
   assert.ok(first.x+first.width<=second.x+2,label+' cards overlap '+JSON.stringify(measure));
  }
  await assertCallGeometry(width>height?'landscape':'portrait');
  await page.screenshot({path:path.join(out,label+'-call-grid.png'),fullPage:true});
  if(label==='android-390'){
   await page.setViewportSize({width:844,height:390});
   await page.waitForTimeout(120);
   await assertCallGeometry('landscape');
   assert.equal(await page.locator('#zeon-mobile-root').evaluate(n=>n.hidden),false);
   await page.screenshot({path:path.join(out,'android-call-grid-landscape.png'),fullPage:true});
   await page.setViewportSize({width,height});
   await page.waitForTimeout(80);
   await assertCallGeometry('portrait');
  }
  // Continuamos a validar as DMs depois de testar o grid, sem reabrir a página.
  await page.locator('[data-mobile-tab="chats"]').click();
  await page.locator('.zm-item-name',{hasText:'Júlia'}).waitFor({state:'visible'});
  await page.locator('.zm-item',{hasText:'Júlia'}).click();
  await page.locator('#dmMessages').waitFor({state:'visible'});
  assert.match(await page.locator('#dmMessages').innerText(),/Oi, vamos testar o Zeon/);
  // Permite finalizar a marcação de leitura antes de enviar (evita corrida com a atualização).
  await page.waitForTimeout(150);
  await page.locator('#dmComposerInput').fill('DM no navegador mobile');
  await page.locator('#dmComposeForm button[type="submit"]').click();
  await page.waitForFunction(()=>window.__sentDms.length===1,{timeout:10000});
  await page.locator('#dmMessages').getByText('DM no navegador mobile').waitFor({timeout:10000});
  assert.equal((await page.evaluate(()=>window.__sentDms)).length,1);
  await page.screenshot({path:path.join(out,label+'-privado.png'),fullPage:true});
  await page.locator('#sidebarToggle').click();
  await page.locator('.zm-home').waitFor({state:'visible'});
  await page.locator('[data-mobile-tab="groups"]').click();
  await page.locator('#zmTitle').getByText('Grupos').waitFor();
  await page.locator('.zm-item',{hasText:'Mesa de RPG'}).click();
  await page.locator('.zm-item-name',{hasText:'sistema'}).waitFor();
  await page.screenshot({path:path.join(out,label+'-grupos.png'),fullPage:true});
  await page.locator('[data-mobile-tab="chats"]').click();
  await page.locator('.zm-item-name',{hasText:'Júlia'}).waitFor();
  if(label==='android-390'){
   await page.setViewportSize({width:1500,height:700});
   assert.equal(await page.locator('#zeon-mobile-root').evaluate(n=>n.hidden),false);
   assert.equal(await page.locator('.zm-bottom-nav').evaluate(n=>getComputedStyle(n).display),'grid');
   await page.screenshot({path:path.join(out,'android-rotacao.png'),fullPage:true});
   await page.setViewportSize({width,height});
  }
  const bounds=await page.evaluate(()=>{
   const n=document.documentElement,b=document.querySelector('.zm-bottom-nav').getBoundingClientRect();
   return {scrollWidth:n.scrollWidth,clientWidth:n.clientWidth,navBottom:b.bottom,height:innerHeight};
  });
  assert.ok(bounds.scrollWidth<=bounds.clientWidth+2,label+' overflow horizontal '+JSON.stringify(bounds));
  assert.ok(bounds.navBottom<=bounds.height+8,label+' nav fora da tela '+JSON.stringify(bounds));
  assert.deepEqual(errors,[],label+' erros JS: '+errors.join('; '));
  console.log('PASS '+label+' — DM + canal + navegação');
  await context.close();
 }finally{await browser.close();}
}
async function desktop(){
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:false,hasTouch:false});
  const page=await context.newPage();await mount(page);
  assert.equal(await page.locator('#zeon-mobile-root').evaluate(n=>n.hidden),true);
  console.log('PASS desktop em janela estreita');
  await context.close();
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  await mobile(chromium,'android-390',390,844);
  await mobile(chromium,'android-320',320,700);
  await mobile(chromium,'android-horizontal',844,390);
  await mobile(webkit,'iphone-390',390,844);
  await desktop();
  console.log('PASS cinco cenários de navegador');
 }finally{server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
