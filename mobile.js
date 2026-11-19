'use strict';
/* Zeon Web Mobile — fase 1
 * Interface mobile usa o adaptador do Zeon Web: nenhuma conta ou mensagem é simulada.
 * O código não envia dados a servidores fora do backend já configurado no Web.
 */
(() => {
  const mq=window.matchMedia('(max-width: 740px), (max-height: 500px) and (pointer: coarse), (max-width: 1200px) and (pointer: coarse)');
  const $=selector=>document.querySelector(selector);
  const root=document.createElement('div');
  root.id='zeon-mobile-root';
  root.hidden=true;
  root.innerHTML='<section class="zm-home" aria-label="Início do Zeon Mobile">'+
    '<header class="zm-brand"><div class="zm-brand-identity"><div class="zm-logo" aria-hidden="true">Z</div>'+
    '<div><strong>Zeon</strong><small>Seu espaço para conversar</small></div></div>'+
    '<button class="zm-new" type="button" id="zmNew" aria-label="Criar"><span class="zm-add-icon"></span></button></header>'+
    '<div class="zm-heading"><div><span class="zm-eyebrow">ZEON WEB</span>'+
    '<h1 id="zmTitle">Conversas</h1><p id="zmSubtitle"></p></div></div>'+
    '<label class="zm-search" id="zmSearchWrap"><span id="zmSearchIcon"></span>'+
    '<input id="zmSearch" type="search" autocomplete="off" enterkeyhint="search" aria-label="Pesquisar" placeholder="Pesquisar"/>'+
    '</label><div class="zm-call-banner" id="zmCallBanner" hidden></div>'+
    '<div class="zm-section-header"><strong id="zmListTitle"></strong><span id="zmListCount"></span></div>'+
    '<div class="zm-actions" id="zmActions"></div><div class="zm-list" id="zmList"></div>'+
    '<p class="zm-error" id="zmError" role="status" aria-live="polite" hidden></p></section>'+
    '<nav class="zm-bottom-nav" aria-label="Navegação do Zeon">'+
    '<button type="button" data-mobile-tab="chats"><span class="zm-tab-icon"></span><small>Conversas</small></button>'+
    '<button type="button" data-mobile-tab="groups"><span class="zm-tab-icon"></span><small>Grupos</small></button>'+
    '<button type="button" data-mobile-tab="calls"><span class="zm-tab-icon"></span><small>Chamadas</small></button>'+
    '<button type="button" data-mobile-tab="profile"><span class="zm-tab-icon"></span><small>Perfil</small></button></nav>';
  document.body.append(root);

  const icons={
    chats:'<path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.4-4.6A8 8 0 1 1 20 11.5Z"/>',
    groups:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    calls:'<path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M3 13v4a2 2 0 0 0 2 2h2v-8H5a2 2 0 0 0-2 2ZM21 13v4a2 2 0 0 1-2 2h-2v-8h2a2 2 0 0 1 2 2Z"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>',
    channel:'<path d="M5 9h14M4 15h14M11 3 8 21M17 3l-3 18"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    arrow:'<path d="M19 12H5m7 7-7-7 7-7"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    exit:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    share:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M12 16V3m-4 4 4-4 4 4"/>',
    edit:'<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
  };
  function icon(name){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    svg.setAttribute('class','zm-icon');svg.innerHTML=icons[name]||icons.chevron;
    return svg;
  }
  root.querySelectorAll('[data-mobile-tab]').forEach(button=>
    button.querySelector('.zm-tab-icon').append(icon(button.dataset.mobileTab)));
  $('#zmSearchIcon').append(icon('search'));root.querySelector('.zm-add-icon').append(icon('plus'));

  const title=$('#zmTitle'),subtitle=$('#zmSubtitle'),search=$('#zmSearch');
  const list=$('#zmList'),actions=$('#zmActions'),error=$('#zmError');
  const callBanner=$('#zmCallBanner'),newButton=$('#zmNew');
  const UI={tab:'chats',mode:'home',working:false,notice:'',lastAuth:false};
  let pending=false,profileObserver=null,keyboardFrame=0;

  function adapter(){return window.ZeonMobileAdapter;}
  function state(){
    try{return adapter()?.snapshot()||null;}catch{return null;}
  }
  function available(){return !!(mq.matches&&$('#authGate')?.hidden&&state()?.ready);}
  function say(message){
    UI.notice=String(message||'');schedule();
  }
  function task(fn){
    if(UI.working)return;
    UI.working=true;UI.notice='';schedule();
    Promise.resolve().then(fn).catch(e=>{
      console.error('[Zeon Mobile]',e);
      say(e?.message||'Não foi possível concluir esta ação.');
    }).finally(()=>{UI.working=false;schedule();});
  }
  function el(tag,classes,text){
    const node=document.createElement(tag);
    if(classes)node.className=classes;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function action(label,kind,onClick,primary=false){
    const button=el('button','zm-action'+(primary?' zm-primary':''));
    button.type='button';button.append(icon(kind),el('span','',label));
    button.disabled=UI.working;
    button.addEventListener('click',onClick);actions.append(button);
    return button;
  }
  function item({name,description='',symbol='channel',side='',selected=false,onClick}){
    const button=el('button','zm-item'+(selected?' zm-selected':''));
    button.type='button';button.disabled=UI.working;button.setAttribute('aria-label',name);
    const avatar=el('span','zm-avatar');
    if(symbol==='channel'||symbol==='calls'||symbol==='lock'||symbol==='profile')avatar.append(icon(symbol));
    else avatar.textContent=String(symbol||'?').slice(0,2);
    const body=el('span','zm-item-body');
    body.append(el('strong','zm-item-name',name),el('small','zm-item-desc',description));
    const tail=el('span','zm-item-side');
    if(side)tail.append(el('span','zm-item-tag',side));
    tail.append(icon(selected?'check':'chevron'));
    button.append(avatar,body,tail);
    button.addEventListener('click',onClick);
    list.append(button);
  }
  function empty(message){
    const block=el('div','zm-empty');
    block.append(el('div','zm-empty-mark','✦'),el('p','',message));
    list.append(block);
  }
  function setTab(next){
    if(!['chats','groups','calls','profile'].includes(next))return;
    if($('#cv-page')&&!$('#cv-page').hidden){
      if(window.ConsivoProfile?.close?.()===false)return;
    }
    const active=document.activeElement;
    if(active?.matches?.('#textInput,#callChatInput,#zmSearch'))active.blur();
    updateViewport();
    UI.tab=next;UI.mode='home';UI.notice='';search.value='';schedule();
  }
  function openChannel(channel){
    if(!adapter())return;
    UI.tab=channel.type==='voice'?'calls':'chats';
    UI.mode='channel';UI.notice='';schedule();
    task(async()=>{
      try{await adapter().selectChannel(channel.id);}
      catch(err){UI.mode='home';throw err;}
      if(channel.type==='voice'&&state()?.joinedVoiceId!==channel.id){
        UI.mode='home';
        throw Error('A chamada não foi conectada. Confira as permissões de áudio e tente novamente.');
      }
    });
  }
  function chooseGroup(group){
    task(async()=>{
      await adapter().selectGroup(group.id);
      UI.tab='chats';UI.mode='home';search.value='';UI.notice='';
    });
  }
  function returnToCall(s){
    const voice=s.channels.find(c=>c.id===s.joinedVoiceId);
    if(!voice){
      say('A chamada não está disponível no grupo atual.');return;
    }
    openChannel(voice);
  }
  function openOwnProfile(){
    const profile=window.ConsivoProfile;
    if(!profile?.openOwn){say('O perfil ainda não está disponível.');return;}
    UI.mode='profile';UI.notice='';schedule();
    task(async()=>{
      await profile.openOwn();
      const page=$('#cv-page');
      if(!page||page.hidden){
        UI.mode='home';
        throw Error('Não foi possível abrir o perfil. Tente novamente.');
      }
      if(profileObserver)profileObserver.disconnect();
      profileObserver=new MutationObserver(()=>{
        if(page.hidden&&UI.mode==='profile'){UI.mode='home';schedule();}
      });
      profileObserver.observe(page,{attributes:true,attributeFilter:['hidden']});
    });
  }
  function filtered(items,q){return !q?items:items.filter(x=>x.name.toLocaleLowerCase('pt-BR').includes(q));}
  function draw(s){
    const names={chats:'Conversas',groups:'Grupos',calls:'Chamadas',profile:'Meu perfil'};
    title.textContent=names[UI.tab];
    subtitle.textContent={
      chats:s.groupId?'Canais de texto de '+s.groupName+'.':'Seus canais de texto, em um só lugar.',
      groups:'Escolha um espaço para conversar.',
      calls:'Entre em uma sala de voz e converse ao vivo.',
      profile:'Personalize como as pessoas veem você.'
    }[UI.tab];
    const q=search.value.trim().toLocaleLowerCase('pt-BR');
    $('#zmSearchWrap').hidden=UI.tab==='profile';
    newButton.hidden=UI.tab==='profile'||(UI.tab!=='groups'&&!['owner','admin'].includes(s.role));
    newButton.title=UI.tab==='groups'?'Criar grupo':UI.tab==='calls'?'Criar sala de voz':'Criar canal de texto';
    newButton.disabled=UI.working;
    $('#zmListTitle').textContent=UI.tab==='chats'?'Canais de texto':UI.tab==='groups'?'Seus grupos':UI.tab==='calls'?'Salas de voz':'Sua conta';
    search.placeholder=UI.tab==='groups'?'Buscar grupos':UI.tab==='calls'?'Buscar salas de voz':'Buscar canais de texto';
    list.replaceChildren();actions.replaceChildren();callBanner.replaceChildren();
    callBanner.hidden=!s.inCall;
    if(s.inCall){
      const b=el('button','zm-active-call');
      b.type='button';b.append(icon('calls'),el('span','', 'Em chamada: '+(s.joinedVoiceName||'Sala de voz')),icon('chevron'));
      b.addEventListener('click',()=>returnToCall(s));callBanner.append(b);
    }
    if(UI.tab==='profile'){
      $('#zmListCount').textContent='';
      item({name:s.displayName||'Você',description:'Ver e editar seu perfil',symbol:'profile',onClick:openOwnProfile});
      action('Personalizar perfil','edit',openOwnProfile,true);
      action('Configurações','settings',()=>adapter()?.settings());
      action('Sair da conta','exit',()=>adapter()?.signOut());
      return;
    }
    if(UI.tab==='groups'){
      action('Criar grupo','plus',()=>adapter()?.newGroup(),true);
      action('Entrar por convite','share',()=>adapter()?.joinGroup());
      if(s.groupId)action('Copiar convite do grupo','share',()=>adapter()?.invite());
      const groups=filtered(s.groups,q);
      $('#zmListCount').textContent=groups.length+' grupo'+(groups.length===1?'':'s');
      if(!groups.length)empty(q?'Nenhum grupo encontrado.':'Você ainda não participa de grupos. Crie um ou entre com um convite.');
      groups.forEach(group=>item({
        name:group.name,description:group.id===s.groupId?'Grupo selecionado':'Abrir seus canais',
        symbol:group.name.slice(0,1).toUpperCase(),selected:group.id===s.groupId,
        onClick:()=>chooseGroup(group)
      }));
      return;
    }
    if(!s.groupId){
      $('#zmListCount').textContent='';
      empty('Entre em um grupo ou crie um para começar a conversar.');
      action('Ver grupos','groups',()=>setTab('groups'),true);
      return;
    }
    action('Trocar grupo','groups',()=>setTab('groups'));
    if(['owner','admin'].includes(s.role))
      action(UI.tab==='chats'?'Novo canal':'Nova sala','plus',()=>adapter()?.newChannel(UI.tab==='chats'?'text':'voice'));
    if(UI.tab==='chats')action('Convidar','share',()=>adapter()?.invite());
    const type=UI.tab==='chats'?'text':'voice';
    const channels=filtered(s.channels.filter(c=>c.type===type),q);
    $('#zmListCount').textContent=channels.length+' '+(channels.length===1?'canal':'canais');
    if(!channels.length)
      empty(q?'Nenhum canal encontrado.':type==='text'?'Este grupo ainda não tem canais de texto.':'Este grupo ainda não tem salas de voz.');
    channels.forEach(channel=>item({
      name:channel.name,
      description:type==='text'?'Canal de texto · '+s.groupName:
        channel.id===s.joinedVoiceId?'Você está nesta chamada':'Sala de voz · '+s.groupName,
      symbol:channel.adminOnly?'lock':type==='voice'?'calls':'channel',
      side:channel.id===s.joinedVoiceId?'●':'',
      selected:channel.id===s.channelId,
      onClick:()=>openChannel(channel)
    }));
  }
  function syncBackButton(){
    const back=$('#sidebarToggle');
    if(!back)return;
    if(mq.matches){
      back.textContent='←';back.title='Voltar à lista';
      back.setAttribute('aria-label','Voltar à lista');
    }else{
      back.textContent='☰';back.title='Mostrar ou ocultar canais';
      back.setAttribute('aria-label','Abrir ou fechar canais');
    }
  }
  function adaptMediaButtons(){
    if(!mq.matches)return;
    const supported=!!navigator.mediaDevices?.getDisplayMedia;
    const buttons=document.querySelectorAll('#workspace [data-action="share"],#callDock [data-action="share"]');
    buttons.forEach(button=>{
      if(supported)return;
      button.disabled=true;
      button.title='Transmissão de tela indisponível neste navegador';
      button.setAttribute('aria-label','Transmissão de tela indisponível neste navegador');
    });
  }
  function render(){
    pending=false;syncBackButton();
    const s=state(),visible=available();
    root.hidden=!visible;
    if(!visible){
      if(UI.lastAuth){UI.tab='chats';UI.mode='home';UI.notice='';}
      UI.lastAuth=false;return;
    }
    UI.lastAuth=true;
    root.classList.toggle('zm-show-home',UI.mode==='home');
    root.classList.toggle('zm-busy',UI.working);
    root.querySelectorAll('[data-mobile-tab]').forEach(button=>{
      if(button.dataset.mobileTab===UI.tab)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
      button.disabled=UI.working;
    });
    error.hidden=!UI.notice;error.textContent=UI.notice;
    adaptMediaButtons();
    if(UI.mode==='home')draw(s);
  }
  function schedule(){
    if(pending)return;pending=true;requestAnimationFrame(render);
  }
  function updateViewport(){
    if(!mq.matches){
      document.documentElement.classList.remove('zm-chat-typing');
      document.documentElement.style.removeProperty('--zm-visual-height');return;
    }
    const target=document.activeElement;
    const typing=!!target?.matches?.('#textInput, #callChatInput');
    document.documentElement.classList.toggle('zm-chat-typing',typing);
    const vv=window.visualViewport;
    if(vv&&typing)document.documentElement.style.setProperty('--zm-visual-height',vv.height+'px');
    else document.documentElement.style.removeProperty('--zm-visual-height');
    if(typing){
      cancelAnimationFrame(keyboardFrame);
      keyboardFrame=requestAnimationFrame(()=>{
        const messages=target?.id==='textInput'?$('#textMessages'):$('#callMessages');
        if(messages)messages.scrollTop=messages.scrollHeight;
      });
    }
  }
  document.addEventListener('focusin',updateViewport);
  document.addEventListener('focusout',()=>{
    // Aguardar o foco chegar ao próximo elemento antes de reabrir a navegação.
    requestAnimationFrame(updateViewport);
  });
  window.visualViewport?.addEventListener('resize',updateViewport);
  window.addEventListener('resize',()=>{updateViewport();schedule();});

  root.addEventListener('click',event=>{
    const tab=event.target.closest('[data-mobile-tab]');
    if(tab){setTab(tab.dataset.mobileTab);return;}
    if(event.target.closest('#zmNew')){
      if(UI.tab==='groups')adapter()?.newGroup();
      else if(UI.tab==='calls')adapter()?.newChannel('voice');
      else if(UI.tab==='chats')adapter()?.newChannel('text');
    }
  });
  search.addEventListener('input',schedule);
  document.addEventListener('click',event=>{
    if(!mq.matches||!event.target.closest('#sidebarToggle'))return;
    event.preventDefault();event.stopImmediatePropagation();setTab(UI.tab);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!mq.matches||!available())return;
    if(UI.mode==='channel'){event.preventDefault();setTab(UI.tab);}
  });
  document.addEventListener('zeon:web-render',schedule);
  document.addEventListener('zeon:web-auth',schedule);
  mq.addEventListener?.('change',schedule);
  if(!mq.addEventListener)mq.addListener(schedule);
  const gate=$('#authGate');
  if(gate)new MutationObserver(schedule).observe(gate,{attributes:true,attributeFilter:['hidden']});
  // Chamadas podem re-renderizar controles sem disparar o evento geral de interface.
  const stage=$('#workspace'),dock=$('#callDock');
  if(stage)new MutationObserver(adaptMediaButtons).observe(stage,{childList:true,subtree:true});
  if(dock)new MutationObserver(()=>{adaptMediaButtons();schedule();}).observe(dock,{childList:true,subtree:true});
  updateViewport();schedule();
})();