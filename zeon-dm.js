'use strict';
/* Zeon Direct Messages — UI compartilhada Windows/Web. Nenhuma API exclusiva do Electron. */
(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initial=v=>Array.from(String(v||'?').trim())[0]?.toUpperCase()||'?';
  const time=v=>v?new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
  let conf=null, active=false, selected=null, threads=[], profiles=new Map(), reads=new Map(), messages=[], searching=false, results=[],term='', draft='',busy=false;
  let inboxBusy=false, messagesBusy=false, lastRenderedThread='', lastMessageSignature='';
  const api=(command,args={})=>conf.api(command,args);
  const me=()=>conf?.userId()||'';
  const peerId=t=>t&&(t.user_a===me()?t.user_b:t.user_a);
  const current=()=>threads.find(t=>t.id===selected);
  const peer=t=>profiles.get(peerId(t))||{id:peerId(t),handle:'',display_name:'Usuário'};
  const peerName=t=>peer(t).display_name||'Usuário';
  const lastSeen=t=>reads.get(t.id)||null;
  const unread=t=>!!(t.last_message_at&&t.last_sender_id!==me()&&(!lastSeen(t)||new Date(t.last_message_at)>new Date(lastSeen(t))));
  const notify=msg=>conf?.notify(msg);
  const render=()=>conf?.render();
  const setDmRail=()=>{const b=$('#dmHomeButton');if(b){b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.classList.toggle('has-unread',threads.some(unread));}};
  function createSearch(){if($('#dmSearchDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="dmSearchDialog" class="dm-search-dialog" aria-labelledby="dmSearchTitle"><div class="dm-search-inner"><div class="dm-search-head"><div><span class="eyebrow">ZEON · PRIVADO</span><h2 id="dmSearchTitle">Nova conversa</h2><p>Busque pelo @ de quem você quer chamar.</p></div><button type="button" data-dm-action="close-search" class="dm-search-close" aria-label="Fechar">✕</button></div><form id="dmSearchForm" class="dm-search-form"><label for="dmSearchInput">Identificador do usuário</label><div class="dm-search-row"><input id="dmSearchInput" type="text" minlength="2" maxlength="25" autocomplete="off" placeholder="@usuario" required/><button type="submit">Buscar</button></div></form><div id="dmSearchResults" class="dm-search-results" aria-live="polite"></div></div></dialog>`);
  }
  function configure(options){conf=options;createSearch();}
  function reset(){active=false;selected=null;threads=[];profiles=new Map();reads=new Map();messages=[];results=[];term='';draft='';lastRenderedThread='';lastMessageSignature='';setDmRail();$('#dmSearchDialog')?.close?.();}
  function leave(){active=false;selected=null;draft='';setDmRail();}
  async function enter(){if(!me())return;active=true;selected=null;draft='';setDmRail();render();await inbox();render();}
  async function inbox(){if(!conf||!me()||inboxBusy)return;inboxBusy=true;
    try{const data=await api('dmInbox');if(!conf||!me())return;
      threads=data.threads||[];profiles=new Map((data.profiles||[]).map(p=>[p.id,p]));
      reads=new Map((data.reads||[]).map(r=>[r.thread_id,r.seen_at]));
      setDmRail();if(active){renderSidebar();renderHeader();}
      document.dispatchEvent(new CustomEvent('zeon:dm-update'));
    } finally{inboxBusy=false;}
  }
  async function loadMessages(){if(!selected||messagesBusy)return;const id=selected;messagesBusy=true;
    try{const data=await api('dmMessages',{threadId:id});if(id!==selected)return;
      messages=(data||[]).slice().reverse();drawMessages();
      const t=current();if(t?.last_message_at&&(!lastSeen(t)||new Date(t.last_message_at)>new Date(lastSeen(t)))){
        await api('dmMarkRead',{threadId:id});reads.set(id,t.last_message_at);setDmRail();renderSidebar();
      }
    } finally{messagesBusy=false;}
  }
  async function tick(){if(!conf||!me())return;await inbox();if(active&&selected)await loadMessages();}
  function renderSidebar(){if(!active)return;
    $('#groupTitle').textContent='Mensagens';$('#groupSubtitle').textContent='Conversas individuais';
    const label=window.ConsivoProfile?.displayName?.()||'Você';
    $('#footerAvatar').textContent=initial(label);$('#footerName').textContent=label;
    $('#channelList').innerHTML=`<div class="dm-list-header"><span>CONVERSAS PRIVADAS</span><button data-dm-action="search" type="button" aria-label="Nova conversa" title="Nova conversa">＋</button></div><div class="dm-sidebar-list">${threads.length?threads.map(t=>`<button type="button" class="dm-sidebar-item ${t.id===selected?'active':''}" data-dm-action="open" data-id="${esc(t.id)}"><span class="dm-avatar">${esc(initial(peerName(t)))}</span><span class="dm-sidebar-copy"><strong>${esc(peerName(t))}</strong><small>${esc(t.last_message_preview||'Comece a conversa')}</small></span>${unread(t)?'<span class="dm-unread" aria-label="Mensagem não lida"></span>':''}</button>`).join(''):'<div class="dm-sidebar-empty">Nenhuma conversa ainda.<br>Encontre alguém pelo @.</div>'}</div><button type="button" data-dm-action="search" class="dm-new-inline">✉ Nova mensagem</button>`;
  }
  function renderHeader(){if(!active)return;
    const t=current();$('#channelName').textContent=t?peerName(t):'Mensagens privadas';$('#channelKind').textContent='Privado';$('#channelGlyph').textContent='✉';
    $('#sidebarToggle').setAttribute('aria-pressed',String(conf.sidebarOpen()));
    $('.app-shell').classList.toggle('sidebar-hidden',!conf.sidebarOpen());
    $('.app-shell').classList.remove('call-chat-open');
    $('#callChatToggle').hidden=true;$('#inviteButton').hidden=true;
  }
  function renderWorkspace(){if(!active)return;
    const root=$('#workspace');root.className='workspace text-workspace dm-workspace';root.removeAttribute('data-voice-signature');
    const t=current();if(!t){root.innerHTML='<div class="dm-welcome"><div class="dm-welcome-mark">✉</div><h2>Suas conversas no Zeon</h2><p>Envie mensagens privadas sem precisar criar um grupo.</p><button type="button" data-dm-action="search">Começar uma conversa</button></div>';lastRenderedThread='';return;}
    root.innerHTML=`<div class="text-channel-view dm-channel"><div class="dm-chat-title"><div class="dm-avatar dm-avatar-large">${esc(initial(peerName(t)))}</div><div><h2>${esc(peerName(t))}</h2><p>${peer(t).handle?'@'+esc(peer(t).handle):'Mensagem privada · 1:1'}</p></div><button type="button" class="dm-profile-link" data-dm-action="profile" title="Abrir perfil">Ver perfil</button></div><div class="text-messages dm-messages" id="dmMessages" role="log" aria-live="polite"></div><form class="text-composer dm-composer" id="dmComposeForm"><input id="dmComposerInput" maxlength="700" autocomplete="off" placeholder="Mensagem para ${esc(peerName(t))}" aria-label="Mensagem privada" value="${esc(draft)}"/><button type="submit" ${busy?'disabled':''} aria-label="Enviar">➤</button></form></div>`;
    lastRenderedThread=t.id;lastMessageSignature='';drawMessages();
  }
  function drawMessages(){if(!active||!selected||lastRenderedThread!==selected)return;const root=$('#dmMessages');if(!root)return;
    const sig=messages.map(m=>m.id).join('|');if(sig===lastMessageSignature)return;lastMessageSignature=sig;
    const bottom=root.scrollTop+root.clientHeight>=root.scrollHeight-80;
    root.innerHTML=messages.length?messages.map(m=>{const self=m.author_id===me();return `<div class="dm-bubble-row ${self?'mine':'theirs'}"><div class="dm-bubble"><div>${esc(m.body)}</div><time>${esc(time(m.created_at))}</time></div></div>`;}).join(''):'<div class="chat-empty"><strong>Nenhuma mensagem ainda</strong><p>Escreva algo para começar esta conversa privada.</p></div>';
    if(bottom||messages.length<4)root.scrollTop=root.scrollHeight;
  }
  async function openThread(id){if(!threads.some(t=>t.id===id))throw Error('Conversa não encontrada.');active=true;selected=id;messages=[];draft='';lastRenderedThread='';setDmRail();
    document.dispatchEvent(new CustomEvent('zeon:dm-open'));render();await loadMessages();}
  async function startWith(userId){if(busy)return;busy=true;
    try{const t=await api('dmCreate',{userId});await inbox();if(!threads.some(x=>x.id===t.id))threads.unshift({...t,last_message_at:null,last_message_preview:null});
      $('#dmSearchDialog')?.close();active=true;selected=t.id;messages=[];draft='';lastRenderedThread='';
      document.dispatchEvent(new CustomEvent('zeon:dm-open'));render();await loadMessages();
    }finally{busy=false;}
  }
  function showSearch(){createSearch();$('#dmSearchDialog').showModal();$('#dmSearchInput').focus();}
  function renderResults(text=''){const root=$('#dmSearchResults');if(!root)return;
    root.innerHTML=text?`<p class="dm-search-hint">${esc(text)}</p>`:results.length?results.map(p=>`<button type="button" class="dm-result" data-dm-action="start" data-id="${esc(p.id)}"><span class="dm-avatar">${esc(initial(p.display_name))}</span><span><strong>${esc(p.display_name)}</strong><small>@${esc(p.handle)}</small></span><span class="dm-result-arrow">✉</span></button>`).join(''):'<p class="dm-search-hint">Nenhum usuário encontrado.</p>';
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-dm-action]');if(!b)return;
    const a=b.dataset.dmAction,id=b.dataset.id; if(a==='home'){void task(enter);return;}
    if(a==='search'){showSearch();return;}
    if(a==='close-search'){$('#dmSearchDialog')?.close();return;}
    if(a==='open'){void task(()=>openThread(id));return;}
    if(a==='start'){void task(()=>startWith(id));return;}
    if(a==='profile'){const t=current();if(t)window.ConsivoProfile?.openById?.(peerId(t));}
  });
  document.addEventListener('input',e=>{if(e.target.id==='dmComposerInput')draft=e.target.value;});
  document.addEventListener('submit',e=>{
    if(e.target.id==='dmSearchForm'){e.preventDefault();void task(async()=>{
      term=$('#dmSearchInput').value;searching=true;renderResults('Procurando...');
      try{results=await api('dmSearch',{term});renderResults();}finally{searching=false;}
    });return;}
    if(e.target.id==='dmComposeForm'){e.preventDefault();if(busy||!selected||!draft.trim())return;
      const id=selected,text=draft;draft='';const input=$('#dmComposerInput');if(input)input.value='';busy=true;
      void task(async()=>{try{await api('dmSend',{threadId:id,text});await loadMessages();await inbox();}catch(err){draft=text;if(input&&selected===id)input.value=text;throw err;}finally{busy=false;}});
    }
  });
  async function task(fn){try{await fn();}catch(e){notify(e?.message||'Não foi possível acessar as mensagens privadas.');console.error('[Zeon DM]',e);}}
  // Lista pública para a aba Conversas; nenhum acesso direto ao backend extra.
  function snapshot(){return {active,selected,threads:threads.map(t=>({
    id:t.id,name:peerName(t),handle:peer(t).handle||'',
    preview:t.last_message_preview||'',unread:unread(t)
  }))};}
  window.ZeonDM={configure,reset,leave,active:()=>active,enter,tick,
    snapshot,openThread,showSearch,renderSidebar,renderHeader,renderWorkspace,
    openByUserId:id=>task(()=>startWith(id))};
})();
