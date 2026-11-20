'use strict';
/* Zeon Web Mobile — fase 1
 * O modo mobile é escolhido pela interação por toque (sem hover), não pela largura.
 * A orientação horizontal conserva a mesma interface.
 * Interface mobile usa o adaptador do Zeon Web: nenhuma conta ou mensagem é simulada.
 * O código não envia dados a servidores fora do backend já configurado no Web.
 */
(() => {
  const mq=window.matchMedia('(pointer: coarse) and (hover: none)');
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
    if(active?.matches?.('#textInput,#callChatInput,#dmComposerInput,#zmSearch'))active.blur();
    updateViewport();
    UI.tab=next;UI.mode='home';UI.notice='';search.value='';schedule();
  }
  function openDmThread(thread){
    if(!window.ZeonDM?.openThread){say('Mensagens privadas indisponíveis.');return;}
    UI.tab='chats';UI.mode='channel';UI.notice='';schedule();
    task(async()=>{
      try{await window.ZeonDM.openThread(thread.id);}
      catch(err){UI.mode='home';throw err;}
    });
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
      chats:'Suas mensagens privadas e canais de texto em um só lugar.',
      groups:'Escolha um espaço para conversar.',
      calls:'Entre em uma sala de voz e converse ao vivo.',
      profile:'Personalize como as pessoas veem você.'
    }[UI.tab];
    const q=search.value.trim().toLocaleLowerCase('pt-BR');
    $('#zmSearchWrap').hidden=UI.tab==='profile';
    newButton.hidden=UI.tab==='profile'||(UI.tab==='calls'&&!['owner','admin'].includes(s.role));
    newButton.title=UI.tab==='groups'?'Criar grupo':UI.tab==='calls'?'Criar sala de voz':'Nova conversa privada';
    newButton.disabled=UI.working;
    $('#zmListTitle').textContent=UI.tab==='chats'?'Mensagens privadas':UI.tab==='groups'?'Seus grupos':UI.tab==='calls'?'Salas de voz':'Sua conta';
    search.placeholder=UI.tab==='groups'?'Buscar grupos':UI.tab==='calls'?'Buscar salas de voz':'Buscar conversas e canais';
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
    if(UI.tab==='chats'){
      action('Nova conversa','chats',()=>{
        if(window.ZeonDM?.showSearch)window.ZeonDM.showSearch();
        else say('A busca de usuários ainda não está disponível.');
      },true);
      const dm=window.ZeonDM?.snapshot?.()||{threads:[]};
      const threads=filtered(dm.threads||[],q);
      $('#zmListCount').textContent=threads.length+' '+(threads.length===1?'conversa':'conversas');
      if(!threads.length){
        list.append(el('p','zm-muted-line',q?'Nenhuma conversa privada encontrada.':'Nenhuma conversa privada ainda. Use Nova conversa para começar.'));
      }
      threads.forEach(thread=>item({
        name:thread.name,description:(thread.preview|| (thread.handle?'@'+thread.handle:'Conversa privada')),
        symbol:(thread.name||'?').slice(0,1).toUpperCase(),
        side:thread.unread?'●':'',
        selected:!!(dm.active&&dm.selected===thread.id),
        onClick:()=>openDmThread(thread)
      }));
      list.append(el('div','zm-list-heading','CANAIS DE TEXTO'+(s.groupName?' · '+s.groupName:'')));
      action('Trocar grupo','groups',()=>setTab('groups'));
      if(s.groupId&&['owner','admin'].includes(s.role))action('Novo canal','plus',()=>adapter()?.newChannel('text'));
      if(!s.groupId){
        list.append(el('p','zm-muted-line','Entre em um grupo para acessar canais de texto.'));
        return;
      }
      const channels=filtered(s.channels.filter(c=>c.type==='text'),q);
      if(!channels.length)list.append(el('p','zm-muted-line',q?'Nenhum canal encontrado.':'Este grupo ainda não tem canais de texto.'));
      channels.forEach(channel=>item({
        name:channel.name,description:'Canal de texto · '+s.groupName,
        symbol:channel.adminOnly?'lock':'channel',selected:!dm.active&&channel.id===s.channelId,
        onClick:()=>openChannel(channel)
      }));
      return;
    }
    if(!s.groupId){
      $('#zmListCount').textContent='';
      empty('Entre em um grupo ou crie um para entrar numa chamada.');
      action('Ver grupos','groups',()=>setTab('groups'),true);
      return;
    }
    action('Trocar grupo','groups',()=>setTab('groups'));
    if(['owner','admin'].includes(s.role))action('Nova sala','plus',()=>adapter()?.newChannel('voice'));
    const channels=filtered(s.channels.filter(c=>c.type==='voice'),q);
    $('#zmListCount').textContent=channels.length+' '+(channels.length===1?'sala':'salas');
    if(!channels.length)empty(q?'Nenhuma sala encontrada.':'Este grupo ainda não tem salas de voz.');
    channels.forEach(channel=>item({
      name:channel.name,
      description:channel.id===s.joinedVoiceId?'Você está nesta chamada':'Sala de voz · '+s.groupName,
      symbol:channel.adminOnly?'lock':'calls',
      side:channel.id===s.joinedVoiceId?'●':'',
      selected:channel.id===s.channelId&&!s.dmActive,
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
  // Tela cheia REAL para transmissões em aparelhos touch.
  // A tela é orientada pelo formato RECEBIDO (videoWidth/videoHeight),
  // não pelo dispositivo do remetente nem pelo tamanho do navegador.
  let fullShare=null;
  const shareIcons=new WeakMap();
  function shareButton(){
    return document.querySelector('.call-broadcast .broadcast-focus-toggle');
  }
  function syncShareButton(){
    if(fullShare&&(!fullShare.stage.isConnected||!document.querySelector('#callSharedScreen'))){
      resetShareFullscreen();
    }
    const button=shareButton();
    if(!button)return;
    const active=!!(fullShare&&fullShare.stage===button.closest('.call-broadcast'));
    const mode=active?'exit':'enter';
    if(button.dataset.zmFullscreenUi===mode)return;
    if(!shareIcons.has(button))shareIcons.set(button,button.innerHTML);
    button.dataset.zmFullscreenUi=mode;
    button.title=active?'Sair da tela cheia':'Assistir em tela cheia';
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-pressed',String(active));
    if(active)button.textContent='×';
    else button.innerHTML=shareIcons.get(button);
  }
  function fullscreenVideoOrientation(video){
    const track=video?.srcObject?.getVideoTracks?.()[0];
    const settings=track?.getSettings?.()||{};
    const width=video?.videoWidth||settings.width||0;
    const height=video?.videoHeight||settings.height||0;
    if(width<2||height<2)return null; // aguarda metadados reais do stream
    if(width/height>1.12)return 'landscape';
    if(height/width>1.12)return 'portrait';
    return null; // fontes quadradas: não forçar uma orientação
  }
  function orientationHint(session,orientation){
    if(!session||fullShare!==session)return;
    let hint=session.stage.querySelector('.zm-share-orientation-hint');
    if(!hint){
      hint=document.createElement('div');
      hint.className='zm-share-orientation-hint';
      hint.setAttribute('role','status');
      session.stage.append(hint);
    }
    hint.textContent=orientation==='landscape'
      ?'Para ver melhor, gire o celular na horizontal.'
      :'Para ver melhor, gire o celular na vertical.';
    hint.hidden=false;
  }
  function clearOrientationHint(session){
    session?.stage?.querySelector('.zm-share-orientation-hint')?.remove();
  }
  async function syncShareOrientation(){
    const session=fullShare;
    if(!session||session.mode!=='element')return;
    const desired=fullscreenVideoOrientation(session.video);
    if(!desired||desired===session.requestedOrientation)return;
    session.requestedOrientation=desired;
    const orientation=window.screen?.orientation;
    if(typeof orientation?.lock!=='function'){
      orientationHint(session,desired);
      return;
    }
    try{
      await orientation.lock(desired);
      if(fullShare===session){
        session.locked=true;
        clearOrientationHint(session);
      }
    }catch(error){
      // Bloqueio de orientação depende do navegador, permissões e SO.
      if(fullShare===session){
        orientationHint(session,desired);
        console.info('[Zeon Mobile] Orientação automática indisponível:',error?.name||error);
      }
    }
  }
  function shareVideoSizeChange(){
    void syncShareOrientation();
  }
  function resetShareFullscreen(){
    const session=fullShare;
    if(!session)return;
    fullShare=null;
    session.video?.removeEventListener('loadedmetadata',shareVideoSizeChange);
    session.video?.removeEventListener('resize',shareVideoSizeChange);
    session.video?.removeEventListener('webkitendfullscreen',onNativeVideoExit);
    session.stage.classList.remove('zm-share-immersive');
    document.body.classList.remove('zm-share-immersive-active');
    clearOrientationHint(session);
    if(session.locked){
      try{window.screen?.orientation?.unlock?.();}catch{}
    }
    syncShareButton();
  }
  function onNativeVideoExit(){
    if(fullShare?.mode==='video')resetShareFullscreen();
  }
  function onFullscreenChanged(){
    if(fullShare?.mode!=='element')return;
    if(document.fullscreenElement===fullShare.stage){
      syncShareButton();
      void syncShareOrientation();
    }else{
      resetShareFullscreen();
    }
  }
  async function exitShareFullscreen(){
    const session=fullShare;
    if(!session)return;
    if(session.mode==='element'&&document.fullscreenElement===session.stage){
      try{await document.exitFullscreen();}catch{resetShareFullscreen();}
    }else if(session.mode==='video'){
      try{session.video?.webkitExitFullscreen?.();}catch{}
      resetShareFullscreen();
    }else{
      resetShareFullscreen();
    }
    if(fullShare===session)resetShareFullscreen();
  }
  async function enterShareFullscreen(stage){
    const video=stage?.querySelector('#callSharedScreen');
    if(!video||fullShare)return;
    const session={stage,video,mode:null,locked:false,requestedOrientation:null};
    fullShare=session;
    video.addEventListener('loadedmetadata',shareVideoSizeChange);
    video.addEventListener('resize',shareVideoSizeChange);
    video.addEventListener('webkitendfullscreen',onNativeVideoExit);
    // requestFullscreen ocorre DIRETAMENTE em resposta ao clique;
    // não esperar outras promises antes para não perder a ativação do usuário.
    if(typeof stage.requestFullscreen==='function'&&document.fullscreenEnabled!==false){
      try{
        session.mode='element';
        await stage.requestFullscreen({navigationUI:'hide'});
        if(fullShare!==session)return;
        if(document.fullscreenElement===stage){
          syncShareButton();
          await syncShareOrientation();
          return;
        }
      }catch(error){
        console.info('[Zeon Mobile] Fullscreen do elemento indisponível:',error?.name||error);
      }
    }
    if(fullShare!==session)return;
    // Safari/iPhone: pode oferecer fullscreen nativo apenas para vídeo.
    if(typeof video.webkitEnterFullscreen==='function'){
      try{
        session.mode='video';
        video.webkitEnterFullscreen();
        syncShareButton();
        return;
      }catch(error){
        console.info('[Zeon Mobile] Fullscreen de vídeo indisponível:',error?.name||error);
      }
    }
    // Último recurso: modo imersivo dentro da página (barra do navegador permanece).
    session.mode='fallback';
    stage.classList.add('zm-share-immersive');
    document.body.classList.add('zm-share-immersive-active');
    syncShareButton();
    const desired=fullscreenVideoOrientation(video);
    if(desired)orientationHint(session,desired);
  }
  function toggleShareFullscreen(stage){
    if(fullShare)void exitShareFullscreen();
    else void enterShareFullscreen(stage);
  }
  document.addEventListener('fullscreenchange',onFullscreenChanged);
  document.addEventListener('webkitfullscreenchange',onFullscreenChanged);
  document.addEventListener('click',event=>{
    if(!mq.matches)return;
    const button=event.target.closest?.('.call-broadcast .broadcast-focus-toggle[data-action="focus"]');
    if(!button)return;
    // Interrompe o antigo "modo foco" do desktop, exclusivo da área da chamada.
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleShareFullscreen(button.closest('.call-broadcast'));
  },true);
  // Nunca reconstrua os vídeos para redimensionar o grid: isso preserva
  // as trilhas LiveKit, a câmera ligada e o indicador de quem está falando.
  let callTileFrame=0;
  let duoFocusRoom=null;
  let duoFocusIdentity=null;
  function switchDuoFocus(card){
    if(!card?.closest('.call-participants.zm-call-duo')||!card.classList.contains('zm-call-pip'))return;
    duoFocusIdentity=card.dataset.person||null;
    adjustCallTiles(); // altera apenas classes e estilos, sem desconectar a câmera
  }
  function adjustCallTiles(){
    if(!mq.matches)return;
    const layout=$('#workspace.voice-workspace .call-layout');
    if(!layout)return;
    const grid=layout.querySelector('.call-participants');
    if(!grid)return;
    if(layout.classList.contains('is-sharing')){
      grid.classList.remove('zm-call-duo');
      grid.querySelectorAll('.call-person-card').forEach(card=>{
        card.classList.remove('zm-call-main','zm-call-pip');
        card.removeAttribute('tabindex');card.removeAttribute('role');
        card.removeAttribute('aria-label');card.removeAttribute('title');
      });
      return;
    }
    const count=grid.querySelectorAll(':scope > .call-person-card, :scope > .call-empty-card').length;
    if(!count)return;
    const width=grid.clientWidth,height=grid.clientHeight;
    if(width<=0||height<=0)return;
    const landscape=window.matchMedia('(orientation: landscape)').matches;
    const room=state()?.joinedVoiceId||null;
    if(duoFocusRoom!==room){duoFocusRoom=room;duoFocusIdentity=null;}
    const cards=[...grid.querySelectorAll(':scope > .call-person-card')];
    // Exatamente duas pessoas: o outro participante fica em destaque;
    // o próprio usuário aparece numa prévia sobreposta, como numa videochamada.
    if(count===2&&cards.length===2){
      grid.classList.add('zm-call-duo');
      grid.classList.remove('zm-call-single','zm-call-many');
      const remote=cards.find(card=>card.dataset.zmLocal!=='true')||cards[0];
      const focus=cards.find(card=>card.dataset.person===duoFocusIdentity)||remote;
      for(const card of cards){
        const pip=card!==focus;
        card.classList.toggle('zm-call-main',!pip);
        card.classList.toggle('zm-call-pip',pip);
        if(pip){
          card.tabIndex=0;
          card.setAttribute('role','button');
          card.setAttribute('aria-label','Trocar participante em destaque');
          card.title='Toque para trocar o destaque';
        }else{
          card.removeAttribute('tabindex');
          card.removeAttribute('role');
          card.removeAttribute('aria-label');
          card.removeAttribute('title');
        }
      }
      const aspect=landscape?1.30:0.75;
      const desiredWidth=landscape
        ?Math.min(width*.26,height*.59*aspect,220)
        :Math.min(width*.35,height*.42*aspect,180);
      const pipWidth=Math.max(78,Math.floor(desiredWidth));
      grid.style.setProperty('--zm-duo-pip-width',pipWidth+'px');
      grid.style.setProperty('--zm-duo-pip-height',Math.floor(pipWidth/aspect)+'px');
      return;
    }
    grid.classList.remove('zm-call-duo');
    for(const card of cards){
      card.classList.remove('zm-call-main','zm-call-pip');
      card.removeAttribute('tabindex');card.removeAttribute('role');
      card.removeAttribute('aria-label');card.removeAttribute('title');
    }
    const columns=count===1?1:2,rows=Math.ceil(count/columns);
    const ratio=landscape?16/10:4/5; // largura / altura
    const gap=landscape?8:10;
    const maxByWidth=Math.max(70,(width-10-(columns-1)*gap)/columns)/ratio;
    const maxByHeight=Math.max(72,(height-24-(rows-1)*gap)/rows);
    const limit=count===1?(landscape?240:390):(landscape?210:290);
    const tileHeight=Math.max(72,Math.floor(Math.min(maxByWidth,maxByHeight,limit)));
    const tileWidth=Math.floor(tileHeight*ratio);
    grid.classList.toggle('zm-call-single',count===1);
    grid.classList.toggle('zm-call-many',count>4||rows*tileHeight+(rows-1)*gap+24>height);
    grid.style.setProperty('--zm-call-tile-height',tileHeight+'px');
    grid.style.setProperty('--zm-call-tile-width',tileWidth+'px');
    grid.style.setProperty('--zm-call-tile-ratio',landscape?'16 / 10':'4 / 5');
  }
  function scheduleCallTiles(){
    if(callTileFrame)return;
    callTileFrame=requestAnimationFrame(()=>{
      callTileFrame=0;
      adjustCallTiles();
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
    syncShareButton();
    scheduleCallTiles();
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
    const typing=!!target?.matches?.('#textInput, #callChatInput, #dmComposerInput');
    document.documentElement.classList.toggle('zm-chat-typing',typing);
    const vv=window.visualViewport;
    if(vv&&typing)document.documentElement.style.setProperty('--zm-visual-height',vv.height+'px');
    else document.documentElement.style.removeProperty('--zm-visual-height');
    if(typing){
      cancelAnimationFrame(keyboardFrame);
      keyboardFrame=requestAnimationFrame(()=>{
        const messages=target?.id==='textInput'?$('#textMessages'):target?.id==='dmComposerInput'?$('#dmMessages'):$('#callMessages');
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
  window.addEventListener('resize',()=>{updateViewport();schedule();scheduleCallTiles();});

  root.addEventListener('click',event=>{
    const tab=event.target.closest('[data-mobile-tab]');
    if(tab){setTab(tab.dataset.mobileTab);return;}
    if(event.target.closest('#zmNew')){
      if(UI.tab==='groups')adapter()?.newGroup();
      else if(UI.tab==='calls')adapter()?.newChannel('voice');
      else if(UI.tab==='chats')window.ZeonDM?.showSearch?.();
    }
  });
  search.addEventListener('input',schedule);
  document.addEventListener('click',event=>{
    if(!mq.matches||event.target.closest('.person-volume-button'))return;
    const card=event.target.closest('.call-person-card.zm-call-pip');
    if(card)switchDuoFocus(card);
  });
  document.addEventListener('keydown',event=>{
    if(!mq.matches||!['Enter',' '].includes(event.key))return;
    const card=event.target.closest?.('.call-person-card.zm-call-pip');
    if(card&&event.target===card){event.preventDefault();switchDuoFocus(card);}
  });
  document.addEventListener('click',event=>{
    if(!mq.matches||!event.target.closest('#sidebarToggle'))return;
    event.preventDefault();event.stopImmediatePropagation();setTab(UI.tab);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!mq.matches||!available())return;
    if(fullShare){
      event.preventDefault();
      event.stopImmediatePropagation();
      void exitShareFullscreen();
      return;
    }
    if(UI.mode==='channel'){event.preventDefault();setTab(UI.tab);}
  });
  document.addEventListener('zeon:web-render',schedule);
  document.addEventListener('zeon:web-auth',schedule);
  document.addEventListener('zeon:dm-update',schedule);
  document.addEventListener('zeon:dm-open',()=>{
    if(!mq.matches)return;
    UI.tab='chats';UI.mode='channel';UI.notice='';schedule();
  });
  mq.addEventListener?.('change',schedule);
  if(!mq.addEventListener)mq.addListener(schedule);
  const gate=$('#authGate');
  if(gate)new MutationObserver(schedule).observe(gate,{attributes:true,attributeFilter:['hidden']});
  // Chamadas podem re-renderizar controles sem disparar o evento geral de interface.
  const stage=$('#workspace'),dock=$('#callDock');
  if(stage){
    new MutationObserver(()=>{adaptMediaButtons();scheduleCallTiles();})
      .observe(stage,{childList:true,subtree:true});
    if(window.ResizeObserver)new ResizeObserver(scheduleCallTiles).observe(stage);
  }
  if(dock)new MutationObserver(()=>{adaptMediaButtons();schedule();}).observe(dock,{childList:true,subtree:true});
  updateViewport();schedule();scheduleCallTiles();
})();