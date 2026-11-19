'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const {join}=require('node:path');

const home=join(__dirname,'..');
const html=readFileSync(join(home,'index.html'),'utf8');
const mobile=readFileSync(join(home,'mobile.js'),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function harness({mobile=true}={}){
  const dom=new JSDOM(html,{url:'https://zeon.example/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window:w}=dom,d=w.document;
  const state={
    ready:true,groupId:'g1',groupName:'Amigos',channelId:'t1',role:'owner',
    joinedVoiceId:null,joinedVoiceName:'',inCall:false,displayName:'Teste',
    groups:[{id:'g1',name:'Amigos'},{id:'g2',name:'Projeto'}],
    channels:[{id:'t1',name:'geral',type:'text',adminOnly:false},
              {id:'v1',name:'sala principal',type:'voice',adminOnly:false}]
  };
  const calls={selectedGroups:[],selectedChannels:[],newGroup:0,joinGroup:0,newChannel:[],invite:0,settings:0,signOut:0,openProfile:0};
  w.matchMedia=query=>({matches:mobile,media:query,addEventListener(){},removeEventListener(){}});
  w.visualViewport={height:780,addEventListener(){}};
  w.requestAnimationFrame=callback=>w.setTimeout(()=>callback(Date.now()),0);
  w.cancelAnimationFrame=id=>w.clearTimeout(id);
  d.getElementById('authGate').hidden=true;
  const profile=d.createElement('section');profile.id='cv-page';profile.hidden=true;d.body.append(profile);
  w.ConsivoProfile={
    openOwn:async()=>{calls.openProfile++;profile.hidden=false;},
    close:()=>{profile.hidden=true;return true;}
  };
  w.ZeonMobileAdapter={
    snapshot:()=>({...state,groups:state.groups.map(x=>({...x})),channels:state.channels.map(x=>({...x}))}),
    selectGroup:async id=>{
      calls.selectedGroups.push(id);state.groupId=id;state.groupName=id==='g1'?'Amigos':'Projeto';
      state.role=id==='g1'?'owner':'member';
      state.channels=id==='g1'?
        [{id:'t1',name:'geral',type:'text',adminOnly:false},{id:'v1',name:'sala principal',type:'voice',adminOnly:false}]:
        [{id:'t2',name:'discussão',type:'text',adminOnly:false}];
      state.channelId=state.channels[0]?.id||null;
      state.inCall=false;state.joinedVoiceId=null;state.joinedVoiceName='';
      d.dispatchEvent(new w.CustomEvent('zeon:web-render'));
    },
    selectChannel:async id=>{
      calls.selectedChannels.push(id);state.channelId=id;
      const room=state.channels.find(c=>c.id===id);
      if(room?.type==='voice'){
        state.inCall=true;state.joinedVoiceId=id;state.joinedVoiceName=room.name;
      }
      d.dispatchEvent(new w.CustomEvent('zeon:web-render'));
    },
    newGroup:()=>{calls.newGroup++;},
    joinGroup:()=>{calls.joinGroup++;},
    newChannel:type=>{calls.newChannel.push(type);},
    invite:()=>{calls.invite++;},
    settings:()=>{calls.settings++;},
    signOut:()=>{calls.signOut++;state.ready=false;d.getElementById('authGate').hidden=false;d.dispatchEvent(new w.CustomEvent('zeon:web-auth'));},
    leaveVoice:async()=>{state.inCall=false;state.joinedVoiceId=null;}
  };
  w.eval(mobile);
  await wait(30);
  return {dom,w,d,state,calls,profile,close:()=>dom.window.close()};
}
const names=d=>[...d.querySelectorAll('.zm-item-name')].map(x=>x.textContent);
const click=(d,selector)=>{
  const el=d.querySelector(selector);assert.ok(el,'elemento não encontrado: '+selector);el.click();
};

test('a tela inicial carrega canais reais, sem mostrar grupos falsos',async()=>{
  const x=await harness();
  try{
    assert.equal(x.d.getElementById('zeon-mobile-root').hidden,false);
    assert.equal(x.d.getElementById('zmTitle').textContent,'Conversas');
    assert.deepEqual(names(x.d),['geral']);
    assert.equal(x.d.querySelectorAll('.zm-bottom-nav button').length,4);
  }finally{x.close();}
});
test('pesquisa filtra canais sem alterar dados',async()=>{
  const x=await harness();
  try{
    const input=x.d.getElementById('zmSearch');input.value='inexistente';
    input.dispatchEvent(new x.w.Event('input',{bubbles:true}));await wait(30);
    assert.deepEqual(names(x.d),[]);
    input.value='ger';input.dispatchEvent(new x.w.Event('input',{bubbles:true}));await wait(30);
    assert.deepEqual(names(x.d),['geral']);
  }finally{x.close();}
});
test('troca de grupo atualiza os canais e a aba',async()=>{
  const x=await harness();
  try{
    click(x.d,'[data-mobile-tab="groups"]');await wait(30);
    assert.deepEqual(names(x.d),['Amigos','Projeto']);
    const project=[...x.d.querySelectorAll('.zm-item')].find(b=>b.textContent.includes('Projeto'));
    assert.ok(project);project.click();await wait(50);
    assert.deepEqual(x.calls.selectedGroups,['g2']);
    assert.deepEqual(names(x.d),['discussão']);
    assert.equal(x.d.getElementById('zmTitle').textContent,'Conversas');
  }finally{x.close();}
});
test('abrir um canal e voltar preserva a navegação',async()=>{
  const x=await harness();
  try{
    click(x.d,'.zm-item');await wait(50);
    assert.deepEqual(x.calls.selectedChannels,['t1']);
    assert.equal(x.d.getElementById('zeon-mobile-root').classList.contains('zm-show-home'),false);
    click(x.d,'#sidebarToggle');await wait(30);
    assert.equal(x.d.getElementById('zeon-mobile-root').classList.contains('zm-show-home'),true);
    assert.equal(x.d.getElementById('zmTitle').textContent,'Conversas');
  }finally{x.close();}
});
test('sala de voz ativa aparece ao retornar para Conversas',async()=>{
  const x=await harness();
  try{
    click(x.d,'[data-mobile-tab="calls"]');await wait(30);
    assert.deepEqual(names(x.d),['sala principal']);
    click(x.d,'.zm-item');await wait(40);
    assert.equal(x.state.joinedVoiceId,'v1');
    click(x.d,'[data-mobile-tab="chats"]');await wait(30);
    assert.equal(x.d.getElementById('zmCallBanner').hidden,false);
    assert.match(x.d.getElementById('zmCallBanner').textContent,/sala principal/);
    click(x.d,'.zm-active-call');await wait(40);
    assert.deepEqual(x.calls.selectedChannels,['v1','v1']);
  }finally{x.close();}
});
test('perfil completo abre e a navegação retorna ao hub',async()=>{
  const x=await harness();
  try{
    click(x.d,'[data-mobile-tab="profile"]');await wait(30);
    assert.equal(x.d.getElementById('zmTitle').textContent,'Meu perfil');
    click(x.d,'.zm-item');await wait(50);
    assert.equal(x.profile.hidden,false);
    assert.equal(x.calls.openProfile,1);
    x.w.ConsivoProfile.close();await wait(30);
    assert.equal(x.d.getElementById('zeon-mobile-root').classList.contains('zm-show-home'),true);
  }finally{x.close();}
});
test('ações de grupo e conta chamam o adaptador compartilhado',async()=>{
  const x=await harness();
  try{
    click(x.d,'[data-mobile-tab="groups"]');await wait(20);
    const add=[...x.d.querySelectorAll('.zm-action')].find(n=>n.textContent.includes('Criar grupo'));add.click();
    const join=[...x.d.querySelectorAll('.zm-action')].find(n=>n.textContent.includes('Entrar por convite'));join.click();
    assert.equal(x.calls.newGroup,1);assert.equal(x.calls.joinGroup,1);
    click(x.d,'[data-mobile-tab="profile"]');await wait(30);
    const signout=[...x.d.querySelectorAll('.zm-action')].find(n=>n.textContent.includes('Sair da conta'));signout.click();
    await wait(30);
    assert.equal(x.calls.signOut,1);
    assert.equal(x.d.getElementById('zeon-mobile-root').hidden,true);
  }finally{x.close();}
});

test('falha ao abrir canal retorna à lista e informa o problema',async()=>{
  const x=await harness();
  try{
    x.w.ZeonMobileAdapter.selectChannel=async()=>{throw Error('Canal indisponível');};
    click(x.d,'.zm-item');await wait(55);
    assert.equal(x.d.getElementById('zeon-mobile-root').classList.contains('zm-show-home'),true);
    assert.match(x.d.getElementById('zmError').textContent,/Canal indisponível/);
  }finally{x.close();}
});
test('teclado de chat fecha e a navegação reaparece ao voltar',async()=>{
  const x=await harness();
  try{
    click(x.d,'.zm-item');await wait(30);
    const input=x.d.createElement('input');input.id='textInput';x.d.body.append(input);
    input.focus();await wait(25);
    assert.equal(x.d.documentElement.classList.contains('zm-chat-typing'),true);
    click(x.d,'#sidebarToggle');await wait(35);
    assert.equal(x.d.documentElement.classList.contains('zm-chat-typing'),false);
    assert.equal(x.d.getElementById('zeon-mobile-root').classList.contains('zm-show-home'),true);
  }finally{x.close();}
});

test('janela estreita no computador mantém o Zeon Desktop',async()=>{
  const x=await harness({mobile:false});
  try{
    assert.equal(x.d.getElementById('zeon-mobile-root').hidden,true);
    assert.equal(x.d.getElementById('authGate').hidden,true);
    assert.equal(x.d.querySelectorAll('.zm-bottom-nav button').length,4);
  }finally{x.close();}
});
