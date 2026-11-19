'use strict';
/* Zeon Mobile beta 0.1
 * Navegacao por toque baseada nos componentes reais do Zeon Web.
 * Nao cria conversas privadas ficticias nem duplica a conexao com Supabase.
 */
(() => {
  const mq=window.matchMedia('(max-width: 740px)');
  const $=selector=>document.querySelector(selector);
  const root=document.createElement('div');
  root.id='zeon-mobile-root';
  root.hidden=true;
  root.innerHTML=`
    <section class="zeon-mobile-home" aria-label="Início mobile">
      <header class="zeon-mobile-brand">
        <div style="display:flex;align-items:center;gap:11px">
          <div class="zeon-mobile-brand-mark" aria-hidden="true">Z</div>
          <div><strong>Zeon</strong><small>Seu espaço para conversar</small></div>
        </div>
        <button class="zeon-mobile-icon-button" type="button" data-mobile-action="create" aria-label="Criar grupo">+</button>
      </header>
      <h1 class="zeon-mobile-title" id="zeonMobileTitle">Conversas</h1>
      <p class="zeon-mobile-subtitle" id="zeonMobileSubtitle"></p>
      <label class="zeon-mobile-search"><span aria-hidden="true">⌕</span><input id="zeonMobileSearch" type="search" autocomplete="off" placeholder="Pesquisar" aria-label="Pesquisar itens" /></label>
      <div class="zeon-mobile-actions" id="zeonMobileActions"></div>
      <div class="zeon-mobile-list" id="zeonMobileList"></div>
    </section>
    <nav class="zeon-mobile-nav" aria-label="Navegação principal">
      <button class="zeon-mobile-tab" type="button" data-mobile-tab="chats"><span aria-hidden="true">▤</span><small>Conversas</small></button>
      <button class="zeon-mobile-tab" type="button" data-mobile-tab="groups"><span aria-hidden="true">◉</span><small>Grupos</small></button>
      <button class="zeon-mobile-tab" type="button" data-mobile-tab="calls"><span aria-hidden="true">◖))</span><small>Chamadas</small></button>
      <button class="zeon-mobile-tab" type="button" data-mobile-tab="profile"><span aria-hidden="true">♙</span><small>Perfil</small></button>
    </nav>`;
  document.body.append(root);
  const title=$('#zeonMobileTitle'),subtitle=$('#zeonMobileSubtitle');
  const list=$('#zeonMobileList'),actions=$('#zeonMobileActions'),search=$('#zeonMobileSearch');
  let tab='chats',home=true;

  function isReady(){return $('#authGate')?.hidden===true;}
  function tabs(){
    root.querySelectorAll('[data-mobile-tab]').forEach(button=>{
      if(button.dataset.mobileTab===tab)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }
  function button(label,handler){
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.addEventListener('click',handler);return b;
  }
  function item(name,description,initial,trailing,handler){
    const row=document.createElement('button');row.type='button';row.className='zeon-mobile-item';
    const avatar=document.createElement('span');avatar.className='zeon-mobile-avatar';avatar.textContent=initial;
    const body=document.createElement('span');body.className='zeon-mobile-item-body';
    const strong=document.createElement('span');strong.className='zeon-mobile-item-name';strong.textContent=name;
    const small=document.createElement('span');small.className='zeon-mobile-item-description';small.textContent=description;
    const tail=document.createElement('span');tail.className='zeon-mobile-item-trailing';tail.textContent=trailing;
    body.append(strong,small);row.append(avatar,body,tail);
    row.addEventListener('click',handler);list.append(row);
  }
  function empty(message){
    const n=document.createElement('div');n.className='zeon-mobile-empty';n.textContent=message;list.append(n);
  }
  function action(label,handler){actions.append(button(label,handler));}
  function nativeAction(type){
    const target=document.querySelector('[data-action="'+type+'"]');if(target)target.click();
  }
  function show(next){
    if(tab==='profile'&&next!=='profile')window.ConsivoProfile?.close?.();
    tab=next;home=next!=='profile';
    if(next==='profile'){
      if(window.ConsivoProfile?.openOwn)void window.ConsivoProfile.openOwn();
      else $('#footerAvatar')?.click();
    }
    search.value='';sync();
  }
  function showChannel(native,type){
    home=false;tab=type==='voice'?'calls':'chats';
    native.click();sync();
  }
  function channelButtons(type){
    const containers=$$('#channelList .channel-list');
    return containers[type==='voice'?1:0]?.querySelectorAll('.room-entry')||[];
  }
  function $$(selector){return [...document.querySelectorAll(selector)];}
  function selectedGroup(){return $('#groupTitle')?.textContent?.trim()||'Seu grupo';}
  function draw(){
    title.textContent={chats:'Conversas',groups:'Grupos',calls:'Chamadas'}[tab]||'Conversas';
    subtitle.textContent={
      chats:'Canais de texto de '+selectedGroup()+'. Conversas privadas virão em uma próxima etapa.',
      groups:'Seus espaços e comunidades.',
      calls:'Entre nas salas de voz do grupo '+selectedGroup()+'.'
    }[tab]||'';
    search.placeholder=tab==='groups'?'Pesquisar grupos':tab==='calls'?'Pesquisar chamadas':'Pesquisar conversas';
    list.replaceChildren();actions.replaceChildren();
    const q=search.value.trim().toLocaleLowerCase('pt-BR');
    if(tab==='groups'){
      action('Criar grupo',()=>nativeAction('new-group'));
      action('Entrar com convite',()=>nativeAction('join-group'));
      const groups=$$('#groupRail .group-chip');
      let count=0;
      for(const b of groups){
        const name=(b.getAttribute('aria-label')||b.title||'Grupo').replace(/^Grupo\s+/,'');
        if(q&&!name.toLocaleLowerCase('pt-BR').includes(q))continue;
        count++;
        item(name,b.classList.contains('selected')?'Grupo selecionado':'Abrir canais',name.slice(0,1).toUpperCase(),'›',()=>{
          b.click();tab='chats';home=true;search.value='';sync();
        });
      }
      if(!count)empty(q?'Nenhum grupo encontrado.':'Você ainda não tem grupos. Crie um ou entre usando convite.');
      return;
    }
    if(tab==='calls'){
      const joined=$('#callDock .call-state strong')?.textContent?.trim();
      if(joined){
        const call=button('◖))  '+joined+' — Voltar à chamada',()=>{
          const active=$('#channelList .room-entry-wrap:has(.room-count) .room-entry');
          if(active)showChannel(active,'voice');
          else{home=false;sync();}
        });
        call.className='zeon-mobile-call-return';actions.append(call);
      }
    }
    const type=tab==='calls'?'voice':'text';
    const rows=[...channelButtons(type)];
    let count=0;
    for(const b of rows){
      const name=b.querySelector('.room-name')?.textContent?.trim()||'Canal';
      if(q&&!name.toLocaleLowerCase('pt-BR').includes(q))continue;
      count++;
      const connected=Boolean(b.closest('.room-entry-wrap')?.querySelector('.room-count'));
      const desc=type==='voice'
        ?(connected?'Você está nesta chamada':'Canal de voz · '+selectedGroup())
        :'Canal de texto · '+selectedGroup();
      item(name,desc,type==='voice'?'◖))':'#',connected?'●':'›',()=>showChannel(b,type));
    }
    if(!count){
      empty(q?'Nenhum canal encontrado.':type==='voice'
        ?'Não há canais de voz neste grupo.': 'Ainda não há canais de texto neste grupo.');
      if(!q)action('Ver grupos',()=>show('groups'));
    }
  }
  function sync(){
    const visible=mq.matches&&isReady();
    root.hidden=!visible;
    if(!visible)return;
    root.classList.toggle('home-visible',home);
    tabs();if(home)draw();
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-mobile-tab]');
    if(b)show(b.dataset.mobileTab);
    if(e.target.closest('[data-mobile-action="create"]'))nativeAction('new-group');
  });
  search.addEventListener('input',()=>{if(home)draw();});
  document.addEventListener('click',e=>{
    if(!mq.matches)return;
    if(e.target.closest('#sidebarToggle')){
      e.preventDefault();e.stopImmediatePropagation();show('groups');return;
    }
  },true);
  const watch=new MutationObserver(sync);
  for(const id of ['authGate','groupRail','channelList','callDock']){
    const el=document.getElementById(id);
    if(el)watch.observe(el,{attributes:id==='authGate',attributeFilter:id==='authGate'?['hidden']:undefined,childList:id!=='authGate',subtree:id!=='authGate'});
  }
  mq.addEventListener?.('change',sync);
  sync();
})();