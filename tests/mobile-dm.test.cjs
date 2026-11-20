'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),js=read('mobile.js'),css=read('mobile.css'),dm=read('zeon-dm.js'),shared=read('unified.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mine='11111111-1111-4111-8111-111111111111',julia='22222222-2222-4222-8222-222222222222',kay='33333333-3333-4333-8333-333333333333';
async function fixture(touch=true){
 const dom=new JSDOM(html,{url:'https://zeon.example',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window,d=w.document;
 const state={ready:true,groupId:'g1',groupName:'Projetos',channelId:'t1',role:'owner',
  groups:[{id:'g1',name:'Projetos'},{id:'g2',name:'RPG'}],
  channels:[{id:'t1',name:'geral',type:'text',adminOnly:false},{id:'v1',name:'voice',type:'voice',adminOnly:false}],
  joinedVoiceId:null,joinedVoiceName:'',inCall:false,displayName:'Você'};
 const threads=[{id:'dm1',user_a:mine,user_b:julia,last_message_at:'2026-11-19T13:00:00Z',
    last_sender_id:julia,last_message_preview:'Oi, bora fazer call?'}];
 const profiles=[{id:julia,display_name:'Júlia',handle:'julia'},{id:kay,display_name:'Kay',handle:'kay'}];
 const messages={dm1:[{id:'m1',thread_id:'dm1',author_id:julia,body:'Oi, bora fazer call?',created_at:'2026-11-19T13:00:00Z'}]};
 const called={send:[],created:[],groups:[],channels:[]};
 w.matchMedia=()=>({matches:touch,addEventListener(){},removeEventListener(){}});
 w.requestAnimationFrame=fn=>w.setTimeout(fn,0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
 w.visualViewport={height:840,addEventListener(){}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 d.querySelector('#authGate').hidden=true;
 const own=d.createElement('section');own.id='cv-page';own.hidden=true;d.body.append(own);
 w.ConsivoProfile={openOwn:async()=>{own.hidden=false;},close:()=>{own.hidden=true;return true;}};
 const db=async(cmd,args={})=>{
  if(cmd==='dmInbox')return {threads:threads.slice(),profiles:profiles.slice(),reads:[]};
  if(cmd==='dmMessages')return (messages[args.threadId]||[]).slice().reverse();
  if(cmd==='dmMarkRead')return {};
  if(cmd==='dmSend'){called.send.push(args);messages[args.threadId].push({id:'m'+Date.now(),thread_id:args.threadId,author_id:mine,body:args.text,created_at:new Date().toISOString()});return {};}
  if(cmd==='dmSearch')return profiles.filter(p=>p.handle.includes(args.term.replace('@','').toLowerCase()));
  if(cmd==='dmCreate'){
   called.created.push(args.userId);
   const found=threads.find(x=>x.user_a===args.userId||x.user_b===args.userId);
   if(found)return found;
   const next={id:'dm'+(threads.length+1),user_a:mine,user_b:args.userId};
   threads.push(next);messages[next.id]=[];return next;
  }
  throw Error('Unexpected backend command '+cmd);
 };
 w.eval(dm);
 w.ZeonDM.configure({
  api:db,notify:()=>{},userId:()=>mine,sidebarOpen:()=>false,
  render:()=>{if(w.ZeonDM.active()){
    w.ZeonDM.renderSidebar();w.ZeonDM.renderHeader();w.ZeonDM.renderWorkspace();
   }
   d.dispatchEvent(new w.CustomEvent('zeon:web-render'));
  }
 });
 w.ZeonMobileAdapter={
  snapshot:()=>({...state,groups:[...state.groups],channels:[...state.channels],dmActive:w.ZeonDM.active()}),
  selectGroup:async id=>{
   called.groups.push(id);w.ZeonDM.leave();state.groupId=id;state.groupName=id==='g1'?'Projetos':'RPG';
   state.channels=id==='g1'?[{id:'t1',name:'geral',type:'text'},{id:'v1',name:'voice',type:'voice'}]:[{id:'t2',name:'mesa',type:'text'}];
   d.dispatchEvent(new w.CustomEvent('zeon:web-render'));
  },
  selectChannel:async id=>{called.channels.push(id);w.ZeonDM.leave();state.channelId=id;const room=state.channels.find(x=>x.id===id);if(room?.type==='voice'){state.joinedVoiceId=id;state.inCall=true;}d.dispatchEvent(new w.CustomEvent('zeon:web-render'));},
  newGroup:()=>{},joinGroup:()=>{},newChannel:()=>{},invite:()=>{},settings:()=>{},
  signOut:()=>{},leaveVoice:()=>{}
 };
 w.eval(js);
 await w.ZeonDM.tick();
 await sleep(60);
 return {w,d,state,threads,called,close:()=>dom.window.close()};
}
const labels=d=>Array.from(d.querySelectorAll('.zm-item-name'),n=>n.textContent);
const tap=(d,sel)=>{const node=d.querySelector(sel);assert.ok(node,'missing '+sel);node.click();};
test('carrega JS/CSS mobile após o sistema novo de mensagens privadas',()=>{
 const fileRefs=[...html.matchAll(/src="([^"]+\.js)"/g)].map(x=>x[1]);
 assert.ok(fileRefs.indexOf('zeon-dm.js')<fileRefs.indexOf('unified.js'));
 assert.ok(fileRefs.indexOf('unified.js')<fileRefs.indexOf('mobile.js'));
 assert.ok(html.includes('zeon-dm.css')&&html.includes('mobile.css'));
 for(const file of ['zeon-dm-api.js','zeon-dm.css','zeon-dm.js','mobile.js','mobile.css'])
  assert.ok(fs.existsSync(path.join(root,file)),file);
 for(const file of ['unified.js','mobile.js','zeon-dm.js','web-bridge.js'])
  assert.doesNotThrow(()=>new Function(read(file)),file);
});
test('mobile usa o backend das DMs já existente, sem implementar API paralela',()=>{
 assert.match(shared,/const DM=window.ZeonDM/);
 assert.match(dm,/function snapshot\(\)/);
 assert.match(dm,/window.ZeonDM=\{[\s\S]*snapshot,openThread,showSearch/);
 assert.match(js,/window.ZeonDM\.openThread/);
 assert.match(js,/window.ZeonDM\?\.snapshot/);
 assert.doesNotMatch(js,/\/rest\/v1|\/auth\/v1|fetch\(/);
 assert.match(js,/\(pointer: coarse\) and \(hover: none\)/);
 assert.match(css,/@media \(pointer:coarse\) and \(hover:none\)/);
});
test('a aba Conversas mostra DMs reais e canais do grupo juntos',async()=>{
 const x=await fixture();try{
  assert.equal(x.d.querySelector('#zeon-mobile-root').hidden,false);
  assert.deepEqual(labels(x.d),['Júlia','geral']);
  assert.match(x.d.querySelector('.zm-item-desc').textContent,/Oi, bora fazer call/);
  assert.match(x.d.querySelector('.zm-list-heading').textContent,/CANAIS DE TEXTO/);
 }finally{x.close();}
});
test('abrir conversa privada usa o controlador real e voltar preserva a lista',async()=>{
 const x=await fixture();try{
  tap(x.d,'.zm-item');await sleep(100);
  assert.equal(x.w.ZeonDM.active(),true);
  assert.ok(x.d.querySelector('#dmMessages'));
  assert.equal(x.d.querySelector('#zeon-mobile-root').classList.contains('zm-show-home'),false);
  tap(x.d,'#sidebarToggle');await sleep(35);
  assert.equal(x.d.querySelector('#zeon-mobile-root').classList.contains('zm-show-home'),true);
  assert.deepEqual(labels(x.d),['Júlia','geral']);
 }finally{x.close();}
});
test('mensagem privada é enviada pelo fluxo existente e aparece no histórico',async()=>{
 const x=await fixture();try{
  tap(x.d,'.zm-item');await sleep(100);
  const input=x.d.querySelector('#dmComposerInput');
  input.value='Mensagem nova';input.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  x.d.querySelector('#dmComposeForm').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
  await sleep(100);
  assert.equal(x.called.send.length,1);
  assert.equal(x.called.send[0].text,'Mensagem nova');
  assert.match(x.d.querySelector('#dmMessages').textContent,/Mensagem nova/);
 }finally{x.close();}
});
test('Nova conversa encontra usuário e abre chat sem grupo',async()=>{
 const x=await fixture();try{
  tap(x.d,'#zmNew');
  assert.equal(x.d.querySelector('#dmSearchDialog').open,true);
  const input=x.d.querySelector('#dmSearchInput');input.value='kay';
  x.d.querySelector('#dmSearchForm').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
  await sleep(40);tap(x.d,'.dm-result');await sleep(100);
  assert.deepEqual(x.called.created,[kay]);
  assert.equal(x.w.ZeonDM.active(),true);
  assert.equal(x.d.querySelector('#zeon-mobile-root').classList.contains('zm-show-home'),false);
 }finally{x.close();}
});
test('grupos e canais continuam funcionando sem apagar as DMs',async()=>{
 const x=await fixture();try{
  tap(x.d,'[data-mobile-tab="groups"]');await sleep(40);
  tap(x.d,'.zm-item:nth-child(2)');await sleep(60);
  assert.deepEqual(x.called.groups,['g2']);
  assert.deepEqual(labels(x.d),['Júlia','mesa']);
 }finally{x.close();}
});
test('uma janela estreita de PC com mouse não entra no layout mobile',async()=>{
 const x=await fixture(false);try{
  assert.equal(x.d.querySelector('#zeon-mobile-root').hidden,true);
 }finally{x.close();}
});
