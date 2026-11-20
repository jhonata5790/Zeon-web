'use strict';
/* Only loaded by the browser test runner as a substitute for unified.js.
 * This file is NEVER imported by the actual Zeon website. */
const s={
 ready:true,groupId:'g1',groupName:'Ressonância',channelId:'t1',role:'owner',
 groups:[{id:'g1',name:'Ressonância'},{id:'g2',name:'Mesa de RPG'}],
 channels:[{id:'t1',name:'geral',type:'text',adminOnly:false},{id:'t2',name:'criação',type:'text',adminOnly:false},{id:'v1',name:'Sala de voz',type:'voice',adminOnly:false}],
 joinedVoiceId:null,joinedVoiceName:'',inCall:false,displayName:'Usuário de Teste'
};
window.__mockState=s;
function updateRoom(){
 if(window.ZeonDM?.active()){
  window.ZeonDM.renderSidebar();window.ZeonDM.renderHeader();window.ZeonDM.renderWorkspace();
  document.dispatchEvent(new CustomEvent('zeon:web-render'));return;
 }
 const c=s.channels.find(x=>x.id===s.channelId);
 document.querySelector('#channelName').textContent=c?.name||'Início';
 const w=document.querySelector('#workspace');
 if(c?.type==='text'){
  w.className='workspace text-workspace';
  w.innerHTML='<div class="text-channel-view"><div class="text-channel-heading"><h2># '+c.name+'</h2></div>'+
   '<div class="text-messages" id="textMessages">'+
   '<div class="message"><span class="avatar">K</span><div><div class="message-meta">Kay <time>13:40</time></div><div class="message-text">Oi! Vamos conversar sobre o projeto?</div></div></div>'+
   '<div class="message own"><span class="avatar">U</span><div><div class="message-meta">Você <time>13:41</time></div><div class="message-text">Bora! O Zeon está ficando bem legal.</div></div></div></div>'+
   '<form class="text-composer" onsubmit="event.preventDefault()"><input id="textInput" placeholder="Mensagem" aria-label="Mensagem"/>'+
   '<button type="submit" aria-label="Enviar">➤</button></form></div>';
 }else{
  w.className='workspace voice-workspace';
  w.innerHTML='<div class="call-layout"><div class="call-participants">'+
   '<article class="call-person-card" data-person="u"><div class="call-person-avatar">U</div><div class="call-person-info"><span class="call-person-name">Usuário de Teste</span></div></article>'+
   '<article class="call-person-card" data-person="j"><div class="call-person-avatar">J</div><div class="call-person-info"><span class="call-person-name">Júlia</span></div></article></div>'+
   '<div class="voice-controls"><button class="voice-control" data-action="mic">Microfone</button>'+
   '<button class="voice-control" data-action="camera">Câmera</button>'+
   '<button class="voice-control" data-action="share">Transmitir</button></div></div>';
 }
 const dock=document.querySelector('#callDock');
 dock.hidden=!s.inCall;
 if(s.inCall)dock.innerHTML='<div class="call-state"><span class="call-indicator">◖))</span>'+
  '<div><strong>Conectado à chamada</strong><small>'+s.joinedVoiceName+'</small></div></div>'+
  '<div class="call-buttons"><button class="dock-button" data-action="mic">M</button>'+
  '<button class="dock-button" data-action="camera">C</button><button class="dock-button" data-action="share">S</button>'+
  '<button class="dock-button end" data-action="leave">Sair</button></div>';
 document.dispatchEvent(new CustomEvent('zeon:web-render'));
}
window.ZeonMobileAdapter={
 snapshot:()=>({...s,groups:s.groups.slice(),channels:s.channels.slice()}),
 selectGroup:async id=>{
  window.ZeonDM?.leave();s.groupId=id;s.groupName=id==='g1'?'Ressonância':'Mesa de RPG';
  s.role=id==='g1'?'owner':'member';s.channels=id==='g1'?
    [{id:'t1',name:'geral',type:'text',adminOnly:false},{id:'t2',name:'criação',type:'text',adminOnly:false},{id:'v1',name:'Sala de voz',type:'voice',adminOnly:false}]:
    [{id:'t3',name:'sistema',type:'text',adminOnly:false}];
  s.channelId=s.channels[0].id;s.inCall=false;s.joinedVoiceId=null;s.joinedVoiceName='';
  updateRoom();
 },
 selectChannel:async id=>{
  window.ZeonDM?.leave();s.channelId=id;const c=s.channels.find(x=>x.id===id);
  if(c?.type==='voice'){s.inCall=true;s.joinedVoiceId=id;s.joinedVoiceName=c.name;}
  updateRoom();
 },
 newGroup:()=>document.querySelector('#modal').showModal(),
 joinGroup:()=>document.querySelector('#modal').showModal(),
 newChannel:()=>{},invite:()=>{},
 settings:()=>document.querySelector('#devicesDialog').showModal(),
 signOut:()=>{s.ready=false;document.querySelector('#authGate').hidden=false;document.dispatchEvent(new CustomEvent('zeon:web-auth'));},
 leaveVoice:async()=>{s.inCall=false;s.joinedVoiceId=null;s.joinedVoiceName='';updateRoom();}
};
window.ConsivoProfile={
 openOwn:async()=>{
  let page=document.querySelector('#cv-page');
  if(!page){
   page=document.createElement('section');page.id='cv-page';page.className='cv-page';
   page.style.cssText='position:absolute;inset:0;z-index:30';
   document.querySelector('.content-area').append(page);
  }
  page.hidden=false;
  page.innerHTML='<div class="cv-page-top"><button data-cv-action="back">← Voltar</button><strong>Seu perfil</strong></div>'+
   '<div class="cv-profile-scroll"><h2>Usuário de Teste</h2><p>Perfil e personalização</p></div>';
  page.querySelector('[data-cv-action="back"]').onclick=()=>{page.hidden=true;};
 },
 close:()=>{const page=document.querySelector('#cv-page');if(page)page.hidden=true;return true;},
 displayName:()=>s.displayName
};


const __me='11111111-1111-4111-8111-111111111111';
const __peer='22222222-2222-4222-8222-222222222222';
const __dmThreads=[{id:'dm-1',user_a:__me,user_b:__peer,last_message_at:'2026-11-19T10:00:00Z',last_sender_id:__peer,last_message_preview:'Oi, vamos testar o Zeon?'}];
const __dmProfiles=[{id:__peer,display_name:'Júlia',handle:'julia'},{id:'33333333-3333-4333-8333-333333333333',display_name:'Kay',handle:'kay'}];
const __dmMessages={'dm-1':[{id:'m1',author_id:__peer,body:'Oi, vamos testar o Zeon?',created_at:'2026-11-19T10:00:00Z'}]};
window.__sentDms=[];
window.ZeonDM.configure({
 userId:()=>__me,sidebarOpen:()=>false,notify:console.error,render:updateRoom,
 api:async(cmd,args={})=>{
  if(cmd==='dmInbox')return {threads:__dmThreads.slice(),profiles:__dmProfiles.slice(),reads:[]};
  if(cmd==='dmMessages')return (__dmMessages[args.threadId]||[]).slice().reverse();
  if(cmd==='dmMarkRead')return {};
  if(cmd==='dmSend'){window.__sentDms.push(args);__dmMessages[args.threadId].push({id:'m'+Date.now(),author_id:__me,body:args.text,created_at:new Date().toISOString()});return {};}
  if(cmd==='dmSearch')return __dmProfiles.filter(x=>x.handle.includes(args.term.replace('@','')));
  if(cmd==='dmCreate'){const t={id:'dm-2',user_a:__me,user_b:args.userId};__dmThreads.push(t);__dmMessages[t.id]=[];return t;}
  throw Error('Unexpected command '+cmd);
 }
});

document.querySelector('#authGate').hidden=true;
document.querySelector('#footerName').textContent=s.displayName;
updateRoom();

window.setTimeout(()=>void window.ZeonDM.tick(),40);
