'use strict';
/* Browser-level visual and interaction smoke tests.
 * Chromium emulates Android; WebKit emulates iOS; no actual device or live backend.
 */
const {chromium,webkit}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'artifacts','mobile-browser');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const filepath=path.join(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
 if(!filepath.startsWith(root+path.sep)||!mime[path.extname(filepath)]){res.writeHead(404);res.end();return;}
 fs.readFile(filepath,(err,buf)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(filepath)],'Cache-Control':'no-store'});res.end(buf);
 });
});
const stub=fs.readFileSync(path.join(__dirname,'mobile-browser.stub.js'),'utf8');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function verify(engine,label,width,height){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/web-bridge.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.desktop={isWeb:true};'}));
  await page.route('**/unified.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:stub}));
  await page.route('**/profile-v080.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('**/livekit.bundle.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
  await page.locator('.zm-item').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#zeon-mobile-root').evaluate(n=>n.hidden),false);
  assert.deepEqual(await page.locator('.zm-item-name').allTextContents(),['geral','criação']);
  await page.screenshot({path:path.join(out,label+'-conversas.png'),fullPage:true});
  await page.locator('[data-mobile-tab="groups"]').click();
  assert.equal(await page.locator('#zmTitle').innerText(),'Grupos');
  assert.deepEqual(await page.locator('.zm-item-name').allTextContents(),['Ressonância','Mesa de RPG']);
  await page.screenshot({path:path.join(out,label+'-grupos.png'),fullPage:true});
  await page.locator('.zm-item',{hasText:'Mesa de RPG'}).click();
  await page.locator('.zm-item-name',{hasText:'sistema'}).waitFor();
  await page.locator('.zm-item').first().click();
  await page.locator('.zm-home').waitFor({state:'hidden'});
  assert.equal(await page.locator('#channelName').innerText(),'sistema');
  await page.screenshot({path:path.join(out,label+'-chat.png'),fullPage:true});
  await page.locator('#sidebarToggle').click();
  await page.locator('.zm-home').waitFor({state:'visible'});
  await page.locator('[data-mobile-tab="groups"]').click();
  await page.locator('.zm-item',{hasText:'Ressonância'}).click();
  await page.locator('[data-mobile-tab="calls"]').click();
  await page.locator('.zm-item',{hasText:'Sala de voz'}).click();
  await page.locator('.zm-home').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(out,label+'-chamada.png'),fullPage:true});
  await page.locator('[data-mobile-tab="chats"]').click();
  await page.locator('.zm-active-call').waitFor({state:'visible'});
  assert.match(await page.locator('.zm-active-call').innerText(),/Sala de voz/);
  await page.locator('[data-mobile-tab="profile"]').click();
  assert.equal(await page.locator('#zmTitle').innerText(),'Meu perfil');
  await page.screenshot({path:path.join(out,label+'-perfil.png'),fullPage:true});
  await page.locator('.zm-item').first().click();
  await page.locator('#cv-page').waitFor({state:'visible'});
  await page.locator('[data-cv-action="back"]').click();
  await page.locator('.zm-home').waitFor({state:'visible'});
  const bounds=await page.evaluate(()=>{
   const nav=document.querySelector('.zm-bottom-nav').getBoundingClientRect();
   return {navTop:nav.top,navBottom:nav.bottom,navHeight:nav.height,
           viewportHeight:window.innerHeight,pageWidth:document.documentElement.scrollWidth,
           clientWidth:document.documentElement.clientWidth};
  });
  assert.ok(bounds.navHeight>=60,label+': bottom navigation too small '+JSON.stringify(bounds));
  assert.ok(bounds.navBottom<=height+8,label+': bottom nav offscreen '+JSON.stringify(bounds));
  assert.ok(bounds.pageWidth<=bounds.clientWidth+2,label+': horizontal overflow '+JSON.stringify(bounds));
  assert.deepEqual(errors,[],label+' JavaScript errors: '+errors.join('; '));
  console.log('PASS '+label+' '+width+'x'+height);
  await context.close();
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  await verify(chromium,'android-390',390,844);
  await verify(chromium,'android-320',320,700);
  await verify(webkit,'iphone-390',390,844);
  console.log('3 browser viewport scenarios passed');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
