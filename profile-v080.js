'use strict';
// Consivo 0.8.0 beta 7 — estilos dinâmicos compatíveis com CSP.
// Isolado das trilhas LiveKit e das funções de chamadas.
(()=>{
  const $=(s,el=document)=>el.querySelector(s), $$=(s,el=document)=>[...el.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=(name,args={})=>window.desktop.onlineInvoke(name,args);
  const templateCards=()=>[
    {id:'bio',type:'bio',visible:true}, {id:'badges',type:'badges',visible:true},
    {id:'joined',type:'joined',visible:true}, {id:'interests',type:'interests',visible:true,body:''}
  ];
  const defaults={display_name:'',handle:'',bio:'',avatar_path:null,banner_path:null,
    accent_color:'#9066E7',secondary_color:'#353267',effect:'none',effect_intensity:35,
    avatar_frame:'none',avatar_decoration:'none',profile_cards:templateCards(),account_created_at:null};
  const effects=['none','glow','embers','stars','fog','glitch','particles','aurora'];
  const frames=['none','lilac','gold','ice']; const decorations=['none','sparkle','orbit'];
  const cardTypes=['bio','badges','joined','interests','note'];
  const baseMedia='consivo-profile-media';
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min));
  const color=(v,fallback)=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v).toUpperCase():fallback;
  const isUuid=v=>/^[0-9a-f-]{36}$/i.test(String(v||''));
  const normalizeCards=raw=>{
    if(!Array.isArray(raw)||!raw.length)return templateCards();
    const seen=new Set(),items=[];
    for(const x of raw.slice(0,16)){
      const type=String(x?.type||'');if(!cardTypes.includes(type))continue;
      if(type!=='note'&&seen.has(type))continue;
      const id=type==='note'?String(x?.id||'').slice(0,60):type;
      if(!/^[a-zA-Z0-9_-]{2,60}$/.test(id)||seen.has(id))continue;
      seen.add(id);if(type!=='note')seen.add(type);
      items.push({id,type,visible:x?.visible!==false,title:type==='note'?String(x?.title||'Nota').slice(0,60):'',
        body:(type==='note'||type==='interests')?String(x?.body||'').slice(0,type==='note'?1200:160):'',
        color:type==='note'?color(x?.color,'#3B3054'):''});
    }
    return items.length?items:templateCards();
  };
  const norm=p=>({...defaults,...p,accent_color:color(p?.accent_color,defaults.accent_color),
    secondary_color:color(p?.secondary_color,defaults.secondary_color),
    effect:effects.includes(p?.effect)?p.effect:'none',effect_intensity:clamp(p?.effect_intensity,0,100),
    avatar_frame:frames.includes(p?.avatar_frame)?p.avatar_frame:'none',
    avatar_decoration:decorations.includes(p?.avatar_decoration)?p.avatar_decoration:'none',
    profile_cards:normalizeCards(p?.profile_cards)});
  const snap=p=>JSON.stringify({display_name:p?.display_name||'',handle:p?.handle||'',bio:p?.bio||'',
    avatar_path:p?.avatar_path||null,banner_path:p?.banner_path||null,
    accent_color:color(p?.accent_color,defaults.accent_color),secondary_color:color(p?.secondary_color,defaults.secondary_color),
    effect:p?.effect||'none',effect_intensity:Number(p?.effect_intensity)||0,
    avatar_frame:p?.avatar_frame||'none',avatar_decoration:p?.avatar_decoration||'none',
    profile_cards:normalizeCards(p?.profile_cards)});
  let me=null,myId=null,mediaBase='',draft=null,editing=false,pageId=null,openProfile=null,
    activeCard=null,focusMenu=null,catalogAt=null,sessionFor=null,sessionLoading=false,onboarding=false,quickId=null,saving=false;
  let baseline='',onboardError=false;let focusTab='image',focusColor='main',colorHsl=null;const tempUrls=new Set();
  function getMedia(path){if(!path||!mediaBase)return '';return mediaBase+String(path).split('/').map(encodeURIComponent).join('/');}
  const img=(p,kind)=>editing&&draft?.[kind+'Preview']?draft[kind+'Preview']:getMedia(p?.[kind+'_path']);
  function avatar(p,small=false){const url=img(p,'avatar');return `<span class="cv-avatar ${small?'small':''} frame-${esc(p.avatar_frame)}">${url?`<img src="${esc(url)}" alt="">`:esc((p.display_name||'C').charAt(0).toUpperCase())}${p.avatar_decoration!=='none'&&!small?`<i class="cv-deco deco-${esc(p.avatar_decoration)}" aria-hidden="true"></i>`:''}</span>`;}
  function host(){let n=$('#cv-page');if(n)return n;const work=$('#workspace');if(!work)return null;
    const parent=work.parentElement,shell=document.createElement('div');shell.className='cv-workspace-shell';parent.insertBefore(shell,work);shell.append(work);
    n=document.createElement('section');n.id='cv-page';n.className='cv-page';n.hidden=true;n.setAttribute('aria-label','Perfil Zeon');shell.append(n);return n;}
  function root(){let n=$('#cv-root');if(n)return n;n=document.createElement('div');n.id='cv-root';document.body.append(n);return n;}
  function note(message,error=false){const n=$('#cv-notice');if(n){n.textContent=message;n.classList.toggle('error',error);}}
  function dirty(){return Boolean(editing&&draft&&(snap(draft)!==baseline||draft.avatarFile||draft.bannerFile));}
  function saveButton(){const b=$('#cv-page [data-cv-action="save"]');if(b)b.disabled=!dirty()||saving;}
  function cleanup(){for(const url of tempUrls)URL.revokeObjectURL(url);tempUrls.clear();}
  function closeQuick(){const n=$('#cv-quick');if(n)n.remove();quickId=null;}
  function closeFocus(){focusMenu=null;focusTab='image';focusColor='main';const overlay=$('#cv-focus-layer');overlay?.remove();$$('.cv-focus').forEach(n=>n.classList.remove('cv-focus'));}
  function closePage(force=false){if(editing&&dirty()&&!force&&!window.confirm('Descartar alterações não salvas?'))return false;
    pageId=null;editing=false;draft=null;colorHsl=null;openProfile=null;activeCard=null;catalogAt=null;closeFocus();closeQuick();cleanup();const n=$('#cv-page');if(n)n.hidden=true;$('#workspace')?.removeAttribute('aria-hidden');return true;}
  const displayDate=v=>{if(!v)return 'Data indisponível';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}):'Data indisponível';};
  function safeLink(raw){try{const v=new URL(raw);return ['https:','http:'].includes(v.protocol)?v.href:null;}catch{return null;}}
  // Markdown intencionalmente limitado. Escapa HTML sempre antes de interpretar formatação.
  function formatNote(raw){const s=String(raw||'').slice(0,1200),out=[];
    function inline(text){let result=esc(text);
      result=result.replace(/\[([^\]\n]{1,70})\]\((https?:\/\/[^\s)]+)\)/gi,(_,label,url)=>{const safe=safeLink(url);return safe?`<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`:label;});
      return result.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>');}
    for(const line of s.split('\n')){const item=line.match(/^\s*[-•] (.*)$/);out.push(item?`<div class="cv-line-item">• ${inline(item[1])}</div>`:`<div>${inline(line)||'&nbsp;'}</div>`);}return out.join('');
  }
  const gradient=p=>`linear-gradient(115deg, ${color(p?.accent_color,defaults.accent_color)}, ${color(p?.secondary_color,defaults.secondary_color)})`;
  function hero(p){const banner=img(p,'banner'),canEdit=editing&&pageId===myId;
    return `<div class="cv-hero ${focusMenu?'cv-focus':''}">
      <div class="cv-banner">${banner?`<img src="${esc(banner)}" alt="">`:''}
        ${effectLayer(p.effect,'cv-banner-fx')}
        ${canEdit?'<button class="cv-hover-edit cv-banner-edit" data-cv-action="focus-banner" aria-label="Editar banner" title="Editar banner"><span>✎</span></button>':''}
      </div>
      <div class="cv-hero-content"><div class="cv-avatar-wrap">${avatar(p)}
        ${canEdit?'<button class="cv-hover-edit cv-avatar-edit" data-cv-action="focus-avatar" aria-label="Editar avatar" title="Editar avatar"><span>✎</span></button>':''}</div>
        <div class="cv-identity">${canEdit?`<input id="cv-display-name" aria-label="Nome de exibição" maxlength="32" value="${esc(p.display_name)}"><div class="cv-handle-edit"><span>@</span><input id="cv-handle" aria-label="Identificador" maxlength="24" value="${esc(p.handle)}"></div>`:
      `<h2>${esc(p.display_name||'Sem nome')}</h2><p>@${esc(p.handle)}</p>`}</div>
      </div></div>`;}
  const badgeText=[{label:'Primeiro perfil',symbol:'✦'}];
  function cardBody(card,p){switch(card.type){
    case 'bio':return `<div class="cv-card-text">${esc(p.bio||'Adicione uma apresentação ao seu perfil.')}</div>`;
    case 'joined':return `<div class="cv-date">◷ ${esc(displayDate(p.account_created_at))}</div>`;
    case 'badges':return `<div class="cv-badges">${badgeText.map(b=>`<span class="cv-badge">${b.symbol} ${esc(b.label)}</span>`).join('')}</div>`;
    case 'interests':return card.body?`<div class="cv-tags">${card.body.split(',').map(s=>s.trim()).filter(Boolean).slice(0,8).map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:'<div class="cv-card-muted">Adicione seus interesses.</div>';
    case 'note':return `<div class="cv-note-body">${formatNote(card.body)}</div>`;
    default:return '';
  }}
  const labels={bio:'Sobre mim',badges:'Insígnias',joined:'Membro desde',interests:'Interesses',note:'Nota'};
  const symbols={bio:'◉',badges:'✦',joined:'◷',interests:'♧',note:'▤'};
  function cardEditor(card,p){const noteCard=card.type==='note',textCard=card.type==='bio'||noteCard||card.type==='interests';
    let fields='';if(noteCard)fields+=`<label>Título<input data-cv-field="title" maxlength="60" value="${esc(card.title)}"></label>`;
    if(textCard){fields+=`<label>${card.type==='interests'?'Interesses (separe com vírgulas)':'Texto'}<textarea data-cv-field="${card.type==='bio'?'bio':'body'}" maxlength="${card.type==='bio'?180:card.type==='interests'?160:1200}" rows="${noteCard?5:3}">${esc(card.type==='bio'?p.bio:card.body)}</textarea></label>`;
      if(noteCard)fields+=`<div class="cv-format-bar"><button type="button" data-cv-format="bold" title="Negrito"><b>B</b></button><button type="button" data-cv-format="italic" title="Itálico"><i>I</i></button><button type="button" data-cv-format="list" title="Lista">☷</button><button type="button" data-cv-format="link" title="Inserir link">↗</button></div>`;}
    if(noteCard)fields+=`<div class="cv-color-dots" aria-label="Cor da nota">${['#3B3054','#234456','#335143','#604331','#5D304A'].map(c=>`<button type="button" class="${card.color===c?'selected':''}" data-cv-note-color="${c}" aria-label="Cor ${c}"></button>`).join('')}</div>`;
    if(card.type==='badges')fields+='<p class="cv-hint">Primeiro perfil é uma insígnia inicial. Outras conquistas virão depois.</p>';
    if(card.type==='joined')fields+='<p class="cv-hint">A data vem da sua conta e não pode ser alterada.</p>';
    return `<div class="cv-card-panel-inner">${fields}<div class="cv-card-panel-actions"><button type="button" data-cv-action="toggle-card" data-card="${esc(card.id)}">${card.visible?'◉ Ocultar card':'◌ Mostrar card'}</button>${noteCard?`<button type="button" class="cv-danger" data-cv-action="remove-card" data-card="${esc(card.id)}">Excluir nota</button>`:''}</div></div>`;
  }
  function cardTemplate(card,p){const active=editing&&activeCard===card.id,visible=card.visible!==false;
    return `<article class="cv-card ${visible?'':'cv-card-hidden'} ${card.type==='note'?'cv-note':''}" data-card="${esc(card.id)}">
      <div class="cv-card-top">${editing?`<button class="cv-grip" draggable="true" title="Arrastar card" aria-label="Arrastar card">⋮⋮</button>`:''}
        <span class="cv-card-title">${symbols[card.type]} ${esc(card.type==='note'?(card.title||'Nota'):labels[card.type])}</span>
        ${editing?`<button class="cv-card-pencil" title="Editar card" aria-label="Editar ${esc(card.title||labels[card.type])}" data-cv-action="edit-card" data-card="${esc(card.id)}">✎</button>`:''}</div>
      <div class="cv-card-content">${!visible?'<span class="cv-card-muted">Oculto do perfil público</span>':cardBody(card,p)}</div>
      <div class="cv-card-panel ${active?'cv-panel-enter':''}" aria-hidden="${!active}"><div class="cv-card-panel-clip">${active?cardEditor(card,p):''}</div></div>
      ${editing?`<button type="button" class="cv-add-between" title="Inserir card após este" data-cv-action="add-at" data-index="${p.profile_cards.findIndex(x=>x.id===card.id)+1}">+</button>`:''}
    </article>`;
  }
  function catalog(p){if(!editing||catalogAt===null)return '';
    const types=[{type:'note',title:'Nota',icon:'▤'},{type:'bio',title:'Sobre mim',icon:'◉'},
      {type:'badges',title:'Insígnias',icon:'✦'},{type:'joined',title:'Membro desde',icon:'◷'},{type:'interests',title:'Interesses',icon:'♧'}].filter(t=>t.type==='note'||!p.profile_cards.some(c=>c.type===t.type));
    return `<div class="cv-library-layer"><button class="cv-library-backdrop" data-cv-action="close-library" aria-label="Fechar biblioteca"></button><div class="cv-library" role="dialog" aria-label="Adicionar card">
      <div class="cv-library-head"><strong>Adicionar card</strong><button data-cv-action="close-library" aria-label="Fechar">×</button></div>
      <div class="cv-library-items">${types.map(t=>`<button data-cv-action="create-card" data-type="${t.type}"><span>${t.icon}</span>${t.title}</button>`).join('')}</div>
    </div></div>`;
  }
  const focusTabs=[
    {id:'image',label:'Imagem',icon:'▧'}, {id:'colors',label:'Cores',icon:'◉'},
    {id:'effects',label:'Efeitos',icon:'✧'}, {id:'adjust',label:'Ajustes',icon:'☷'}
  ];
  const effectLabels={none:'Nenhum',glow:'Brilho',embers:'Brasas',stars:'Estrelas',fog:'Neblina',
    glitch:'Glitch',particles:'Partículas',aurora:'Aurora'};
  const effectIcons={none:'○',glow:'✧',embers:'♨',stars:'✦',fog:'≋',glitch:'⌁',particles:'⁙',aurora:'❋'};
  const effectDescriptions={
    none:'Perfil sem animação.',
    glow:'Reflexos luminosos e halos que se movem suavemente.',
    embers:'Brasas douradas sobem enquanto uma luz quente pulsa.',
    stars:'Céu estrelado, pontos cintilantes e uma estrela cadente.',
    fog:'Camadas de névoa atravessam o perfil em velocidades diferentes.',
    glitch:'Varreduras e deslocamentos digitais com toques cromáticos.',
    particles:'Pequenos orbes flutuam de maneira suave e contínua.',
    aurora:'Faixas coloridas de luz se movem como uma aurora.'
  };
  // Elementos declarativos; as animações ficam integralmente no CSS.
  // Sem timers, scripts externos nem CSS inline, para respeitar a CSP.
  function effectLayer(effect,place){
    return `<div class="cv-fx ${place} cv-effect-${esc(effect)}" aria-hidden="true">${'<i></i>'.repeat(12)}</div>`;
  }
  function updateEffectPreview(effect){
    $$('.cv-fx').forEach(el=>{
      el.classList.remove(...effects.map(v=>'cv-effect-'+v));
      el.classList.add('cv-effect-'+effect);
    });
    const name=$('[data-cv-effect-name]');if(name)name.textContent=effectLabels[effect];
    const description=$('[data-cv-effect-description]');if(description)description.textContent=effectDescriptions[effect];
  }
  function bannerEditor(p){
    const bannerUrl=img(p,'banner');
    const key=focusColor==='main'?'accent_color':'secondary_color';
    const chosen=p[key],hsl=colorHsl?.[focusColor]||toHsl(chosen),hasImage=Boolean(bannerUrl);
    const tabs=`<div class="cv-banner-tabs" role="tablist" aria-label="Ferramentas do banner">${focusTabs.map(t=>
      `<button type="button" role="tab" aria-selected="${focusTab===t.id}" class="cv-banner-tab ${focusTab===t.id?'active':''}"
        data-cv-action="banner-tab" data-tab="${t.id}"><span aria-hidden="true">${t.icon}</span><small>${t.label}</small></button>`).join('')}</div>`;
    let content='';
    if(focusTab==='image'){
      content=`<div class="cv-banner-tab-panel cv-banner-image-tab" role="tabpanel">
        <div class="cv-banner-section-title"><strong>Imagem do banner</strong><span>PNG, JPG, WebP ou GIF</span></div>
        <button type="button" class="cv-tool-button cv-tool-primary" data-cv-action="change-banner">▧ <span>${hasImage?'Trocar imagem':'Escolher imagem'}</span><span aria-hidden="true">↗</span></button>
        ${hasImage?'<button type="button" class="cv-tool-button cv-tool-quiet" data-cv-action="remove-banner">Remover imagem</button>':''}
      </div>`;
    } else if(focusTab==='colors'){
      content=`<div class="cv-banner-tab-panel cv-banner-colors-tab" role="tabpanel">
        <div class="cv-banner-section-title"><strong>Cores do perfil</strong><span>Duas cores, uma escolha de cada vez</span></div>
        ${hasImage?'<div class="cv-color-image-note">O banner tem uma imagem que cobre o gradiente. Remova-a na aba Imagem para visualizar as cores.</div>':''}
        <div class="cv-color-choice" role="group" aria-label="Qual cor editar">
          <button type="button" class="cv-color-select ${focusColor==='main'?'active':''}" aria-pressed="${focusColor==='main'}" data-cv-action="banner-color" data-color="main"><i></i><span>Principal</span></button>
          <button type="button" class="cv-color-select ${focusColor==='second'?'active':''}" aria-pressed="${focusColor==='second'}" data-cv-action="banner-color" data-color="second"><i></i><span>Secundária</span></button>
        </div>
        <div class="cv-color-current"><span>Prévia da cor</span><i></i></div>
        <label class="cv-custom-range"><span>Tonalidade</span><input class="cv-hue-slider" aria-label="Tonalidade" type="range" min="0" max="360" value="${hsl.h}" data-cv-hsl="${focusColor}-h"></label>
        <div class="cv-color-range-pair">
          <label class="cv-custom-range"><span>Saturação</span><input class="cv-saturation-slider" aria-label="Saturação" type="range" min="0" max="100" value="${hsl.s}" data-cv-hsl="${focusColor}-s"></label>
          <label class="cv-custom-range"><span>Luminosidade</span><input class="cv-luminance-slider" aria-label="Luminosidade" type="range" min="15" max="85" value="${hsl.l}" data-cv-hsl="${focusColor}-l"></label>
        </div>
      </div>`;
    } else if(focusTab==='effects'){
      content=`<div class="cv-banner-tab-panel cv-banner-effects-tab" role="tabpanel">
        <div class="cv-banner-section-title"><strong>Efeitos animados</strong><span>Uma atmosfera única para o seu perfil</span></div>
        <div class="cv-fx-preview">
          ${effectLayer(p.effect,'cv-fx-demo')}
          <strong data-cv-effect-name>${effectLabels[p.effect]}</strong><small>Prévia do efeito</small>
        </div>
        <p class="cv-fx-description" data-cv-effect-description>${effectDescriptions[p.effect]}</p>
        <div class="cv-effect-options" role="group" aria-label="Escolha um efeito">
          ${effects.map(v=>`<button class="cv-effect-option ${p.effect===v?'active':''}" type="button" aria-pressed="${p.effect===v}" data-cv-action="select-effect" data-effect="${v}"><span aria-hidden="true">${effectIcons[v]}</span><small>${effectLabels[v]}</small></button>`).join('')}
        </div>
        <label class="cv-custom-range cv-effect-strength"><span>Intensidade <output data-cv-strength>${p.effect_intensity}%</output></span><input type="range" class="cv-effect-slider" data-cv-style="effect_intensity" min="0" max="100" value="${p.effect_intensity}" ${p.effect==='none'?'disabled':''}></label>
        <div class="cv-fx-strength-hints"><span>Discreto</span><span>Intenso</span></div>
      </div>`;
    } else {
      content=`<div class="cv-banner-tab-panel cv-banner-adjust-tab" role="tabpanel">
        <div class="cv-banner-section-title"><strong>Ajustes rápidos</strong><span>Redefinir apenas o que precisar</span></div>
        <button type="button" class="cv-tool-button" data-cv-action="reset-colors">◉ <span>Restaurar cores padrão</span></button>
        <button type="button" class="cv-tool-button" data-cv-action="reset-effect">✧ <span>Remover efeito do perfil</span></button>
        ${hasImage?'<button type="button" class="cv-tool-button cv-tool-quiet" data-cv-action="remove-banner">▧ <span>Remover imagem do banner</span></button>':''}
      </div>`;
    }
    return `${tabs}${content}`;
  }
  function focusPanel(p){if(!focusMenu)return '';
    const isAvatar=focusMenu==='avatar';
    const controls=isAvatar?`<div class="cv-focus-options"><button data-cv-action="change-avatar">▧ Alterar imagem</button>
       <label>Moldura<select data-cv-style="avatar_frame">${frames.map((v,i)=>`<option value="${v}" ${p.avatar_frame===v?'selected':''}>${['Nenhuma','Lilás','Dourada','Gelo'][i]}</option>`).join('')}</select></label>
       <label>Decoração<select data-cv-style="avatar_decoration">${decorations.map((v,i)=>`<option value="${v}" ${p.avatar_decoration===v?'selected':''}>${['Nenhuma','Brilho','Órbita'][i]}</option>`).join('')}</select></label></div>`:bannerEditor(p);
    return `<div class="cv-focus-layer" id="cv-focus-layer"><button class="cv-focus-shade" data-cv-action="close-focus" aria-label="Fechar editor"></button><div class="cv-focus-spotlight" aria-hidden="true"></div>
      <div class="cv-focus-menu ${isAvatar?'cv-avatar-menu':'cv-banner-menu'}" role="dialog" aria-modal="true" aria-label="Personalizar ${isAvatar?'avatar':'banner'}">
        <div class="cv-focus-title"><strong>${isAvatar?'Avatar':'Editar banner'}</strong><button data-cv-action="close-focus" title="Fechar" aria-label="Fechar">×</button></div>${controls}
      </div></div>`;
  }
  // Cor HSL editável sem expor códigos na interface.
  function toHsl(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);let [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min,h=0,s=0,l=(max+min)/2;
    if(d){s=d/(1-Math.abs(2*l-1));switch(max){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}
      h=(h*60+360)%360;}return {h:Math.round(h),s:Math.round(s*100),l:Math.round(l*100)};}
  function fromHsl(h,s,l){h=((Number(h)%360)+360)%360;s=clamp(s,0,100)/100;l=clamp(l,0,100)/100;
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();}
  // A CSP do Electron permite CSSStyleDeclaration.setProperty, mas bloqueia
  // atributos style= inseridos por innerHTML e style.cssText.
  // Sempre aplicar estilos variáveis após criar os elementos DOM.
  function applyDynamicStyles(p){
    const scope=$('#cv-page');if(!scope)return;
    const shell=$('.cv-full-shell',scope);
    if(shell){
      shell.style.setProperty('--cv-a',color(p.accent_color,defaults.accent_color));
      shell.style.setProperty('--cv-b',color(p.secondary_color,defaults.secondary_color));
      shell.style.setProperty('--cv-intensity',String(clamp(p.effect_intensity,0,100)/100));
    }
    const banner=$('.cv-banner',scope);if(banner)banner.style.backgroundImage=gradient(p);
    $$('.cv-note[data-card]',scope).forEach(el=>{
      const card=p.profile_cards.find(c=>c.id===el.dataset.card);
      if(card)el.style.setProperty('--cv-card-tint',color(card.color,'#3B3054'));
    });
    $$('[data-cv-note-color]',scope).forEach(el=>
      el.style.setProperty('--dot',color(el.dataset.cvNoteColor,'#3B3054')));
    if(focusMenu==='banner'){
      $$('.cv-color-select',scope).forEach(el=>{
        const swatch=el.querySelector('i');
        if(swatch)swatch.style.setProperty('--sw',el.dataset.color==='main'?p.accent_color:p.secondary_color);
      });
      const chosen=focusColor==='main'?p.accent_color:p.secondary_color;
      $('.cv-color-current',scope)?.style.setProperty('--sw',chosen);
      const hsl=colorHsl?.[focusColor]||toHsl(chosen);
      $('.cv-saturation-slider',scope)?.style.setProperty('--cv-hue',String(hsl.h));
      const luminance=$('.cv-luminance-slider',scope);
      if(luminance){luminance.style.setProperty('--cv-hue',String(hsl.h));luminance.style.setProperty('--cv-sat',String(hsl.s)+'%');}
      $('.cv-effect-slider',scope)?.style.setProperty('--cv-range-value',String(p.effect_intensity)+'%');
    }
  }
  function renderPage(scrollTop){const h=$('#cv-page');if(!h||!pageId)return;
    const own=pageId===myId,p=norm(editing?draft:openProfile);
    if(!openProfile){h.innerHTML='<div class="cv-empty"><button data-cv-action="back">Voltar</button>Perfil não configurado.</div>';return;}
    const previous=scrollTop??$('#cv-page .cv-profile-scroll')?.scrollTop??0;
    h.innerHTML=`<div data-cv-user-id="${esc(pageId)}" class="cv-full-shell ${editing?'cv-editing':''}">
      <header class="cv-page-top"><button class="cv-icon" data-cv-action="back" title="Voltar">←</button><strong>${own?'Meu perfil':'Perfil'}</strong>
        <div class="cv-top-actions">${own?editing?`<button class="cv-save" data-cv-action="save" disabled>✓ Salvar</button><button class="cv-cancel" data-cv-action="cancel">Cancelar</button>`:
        `<button class="cv-edit-main" data-cv-action="edit" title="Editar perfil" aria-label="Editar perfil">✎</button>`:`<button class="cv-save" data-cv-action="message" data-id="${esc(pageId)}">✉ Mensagem</button>`}</div>
      </header>
      ${effectLayer(p.effect,'cv-page-effect')}
      <div class="cv-profile-scroll"><div class="cv-profile-stage">
        ${hero(p)}
        <div class="cv-cards-toolbar">${editing?`<button class="cv-add-general" data-cv-action="add-at" data-index="${p.profile_cards.length}">+ Adicionar card</button>`:''}</div>
        <div class="cv-card-grid" id="cv-card-grid">${p.profile_cards.filter(c=>editing||c.visible).map(c=>cardTemplate(c,p)).join('')}</div>
        <span id="cv-notice" role="status" aria-live="polite"></span>
      </div></div>${catalog(p)}${focusPanel(p)}
    </div>`;
    applyDynamicStyles(p);
    const scroll=$('#cv-page .cv-profile-scroll');if(scroll)scroll.scrollTop=previous;
    saveButton();
    if(activeCard)requestAnimationFrame(()=>{$(`#cv-card-grid [data-card="${CSS.escape(activeCard)}"] .cv-card-panel`)?.classList.add('open');});
    if(focusMenu)requestAnimationFrame(positionFocus);
  }
  function positionFocus(){const panel=$('#cv-focus-layer .cv-focus-menu'),layer=$('#cv-focus-layer');if(!panel||!layer||!focusMenu)return;
    const target=focusMenu==='avatar'?$('.cv-avatar-wrap'):$('.cv-banner');if(!target)return;
    const a=target.getBoundingClientRect(),base=layer.getBoundingClientRect();
    const spotlight=$('.cv-focus-spotlight',layer);
    if(spotlight){
      spotlight.style.left=(a.left-base.left)+'px';spotlight.style.top=(a.top-base.top)+'px';
      spotlight.style.width=a.width+'px';spotlight.style.height=a.height+'px';
      spotlight.classList.toggle('avatar',focusMenu==='avatar');
      spotlight.classList.toggle('banner',focusMenu==='banner');
      if(focusMenu==='avatar')spotlight.innerHTML=target.querySelector('.cv-avatar')?.outerHTML||'';
      else {spotlight.style.background='linear-gradient(115deg,var(--cv-a),var(--cv-b))';
        const source=editing&&draft?draft:openProfile;
        spotlight.style.setProperty('--cv-a',color(source?.accent_color,defaults.accent_color));
        spotlight.style.setProperty('--cv-b',color(source?.secondary_color,defaults.secondary_color));
        spotlight.innerHTML=(target.querySelector('img')?.outerHTML||'')+(target.querySelector('.cv-banner-fx')?.outerHTML||'');}
    }
    let x=focusMenu==='avatar'?a.right-base.left+15:a.left+a.width/2-base.left-panel.offsetWidth/2;
    let y=focusMenu==='avatar'?a.top-base.top:a.bottom-base.top+8;
    x=clamp(x,12,Math.max(12,base.width-panel.offsetWidth-12));
    y=clamp(y,8,Math.max(8,base.height-panel.offsetHeight-10));
    panel.style.left=x+'px';panel.style.top=y+'px';
  }
  async function showPage(id){if(!id)return;closeQuick();if(editing&&!closePage())return;pageId=id;editing=false;draft=null;activeCard=null;focusMenu=null;
    const h=host();if(!h)return;h.hidden=false;$('#workspace')?.setAttribute('aria-hidden','true');h.innerHTML='<div class="cv-loading">Carregando perfil…</div>';
    try{const r=id===myId?{profile:me,mediaBase}:await api('profileRead',{userId:id});if(pageId!==id)return;
      mediaBase=r?.mediaBase||mediaBase;openProfile=r?.profile?norm(r.profile):null;renderPage(0);}
    catch{h.innerHTML='<div class="cv-error">Não foi possível abrir o perfil.<button data-cv-action="back">Voltar</button></div>';}}
  async function showQuick(id,anchor){if(!isUuid(id))return;closeQuick();quickId=id;
    try{const r=id===myId?{profile:me,mediaBase}:await api('profileRead',{userId:id});if(quickId!==id)return;
      mediaBase=r.mediaBase||mediaBase;const p=norm(r.profile||{...defaults,id,display_name:'Perfil não configurado'});
      const n=document.createElement('div');n.className='cv-quick';n.id='cv-quick';n.innerHTML=`<div class="cv-quick-banner"></div><div class="cv-quick-info">${avatar({...p,avatar_path:/\.gif$/i.test(p.avatar_path||'')?null:p.avatar_path,avatar_frame:'none',avatar_decoration:'none'},true)}<div><strong>${esc(p.display_name)}</strong><small>@${esc(p.handle)}</small></div></div><p>${esc(p.bio)}</p><button data-cv-action="full" data-id="${esc(id)}">Ver perfil</button>${id===myId?'':`<button data-cv-action="message" data-id="${esc(id)}">✉ Mensagem</button>`}`;
      root().append(n);const quickBanner=$('.cv-quick-banner',n);if(quickBanner){quickBanner.style.setProperty('--cv-a',p.accent_color);quickBanner.style.setProperty('--cv-b',p.secondary_color);}
      const rect=anchor.getBoundingClientRect();n.style.left=Math.max(8,Math.min(innerWidth-330,rect.left))+'px';n.style.top=Math.max(8,Math.min(innerHeight-310,rect.bottom+8))+'px';}
    catch(err){console.warn('[Consivo quick]',err);}}
  function edit(){if(pageId!==myId||!me)return;editing=true;draft=norm(me);colorHsl={main:toHsl(draft.accent_color),second:toHsl(draft.secondary_color)};baseline=snap(draft);activeCard=null;focusMenu=null;catalogAt=null;renderPage();}
  function cancel(){if(saving)return;editing=false;draft=null;colorHsl=null;activeCard=null;focusMenu=null;catalogAt=null;cleanup();renderPage(0);}
  function updateFields(e){if(!editing||!draft)return;const el=e.target;
    if(el.id==='cv-display-name'){draft.display_name=el.value;saveButton();return;}
    if(el.id==='cv-handle'){draft.handle=el.value.toLowerCase().replace(/[^a-z0-9_]/g,'');if(el.value!==draft.handle)el.value=draft.handle;saveButton();return;}
    const field=el.dataset.cvField;if(field&&activeCard){const card=draft.profile_cards.find(x=>x.id===activeCard);if(!card)return;
      if(field==='bio')draft.bio=el.value;
      else if(field==='title')card.title=el.value;
      else if(field==='body')card.body=el.value;
      const current=$(`#cv-card-grid [data-card="${CSS.escape(activeCard)}"]`);
      if(field==='title'){$('.cv-card-title',current).textContent='▤ '+(card.title||'Nota');}
      else if(field==='body'&&card.type==='note'){$('.cv-note-body',current).innerHTML=formatNote(card.body);}
      else if(field==='bio'){$('.cv-card-text',current).textContent=draft.bio||'Adicione uma apresentação ao seu perfil.';}
      else if(field==='body'&&card.type==='interests'){$('.cv-card-content',current).innerHTML=cardBody(card,draft);}
      saveButton();return;
    }
    if(el.dataset.cvStyle){const k=el.dataset.cvStyle;draft[k]=k==='effect_intensity'?clamp(el.value,0,100):el.value;
      if(k==='effect'||k==='effect_intensity'){updateEffectPreview(draft.effect);$('#cv-page .cv-full-shell')?.style.setProperty('--cv-intensity',String(draft.effect_intensity/100));
        const out=$('[data-cv-strength]');if(out)out.textContent=draft.effect_intensity+'%';if(k==='effect_intensity')el.style.setProperty('--cv-range-value',draft.effect_intensity+'%');}
      if(k==='avatar_frame'||k==='avatar_decoration'){
        const wrap=$('.cv-avatar-wrap');if(wrap)wrap.querySelector('.cv-avatar')?.remove();wrap?.insertAdjacentHTML('afterbegin',avatar(draft));
      }
      saveButton();if(focusMenu&&k!=='effect_intensity')positionFocus();return;}
    if(el.dataset.cvHsl){const [which,comp]=el.dataset.cvHsl.split('-');
      if(!['main','second'].includes(which)||!['h','s','l'].includes(comp))return;
      if(!colorHsl)colorHsl={main:toHsl(draft.accent_color),second:toHsl(draft.secondary_color)};
      const key=which==='main'?'accent_color':'secondary_color';
      colorHsl[which]={...colorHsl[which],[comp]:Number(el.value)};
      const current=colorHsl[which];draft[key]=fromHsl(current.h,current.s,current.l);
      const shell=$('#cv-page .cv-full-shell');shell?.style.setProperty(which==='main'?'--cv-a':'--cv-b',draft[key]);
      const banner=$('#cv-page .cv-banner');if(banner)banner.style.backgroundImage=gradient(draft);
      const spot=$('.cv-focus-spotlight');spot?.style.setProperty(which==='main'?'--cv-a':'--cv-b',draft[key]);
      $$('.cv-color-select').forEach(button=>{const swatch=button.querySelector('i');if(swatch)swatch.style.setProperty('--sw',button.dataset.color==='main'?draft.accent_color:draft.secondary_color);});
      const preview=$('.cv-color-current');if(preview)preview.style.setProperty('--sw',draft[key]);
      const sat=$('.cv-saturation-slider'),lum=$('.cv-luminance-slider');if(sat)sat.style.setProperty('--cv-hue',current.h);if(lum){lum.style.setProperty('--cv-hue',current.h);lum.style.setProperty('--cv-sat',current.s+'%');}
      saveButton();}
  }
  function openCard(id){if(!editing)return;const before=activeCard,scroll=$('#cv-page .cv-profile-scroll')?.scrollTop??0;
    if(before){const old=$(`#cv-card-grid [data-card="${CSS.escape(before)}"] .cv-card-panel`);old?.classList.remove('open');}
    if(before===id){activeCard=null;setTimeout(()=>{if(activeCard===null)renderPage(scroll);},205);return;}
    activeCard=id;catalogAt=null;renderPage(scroll);}
  function newCard(type){if(!draft||!cardTypes.includes(type))return;if(type!=='note'&&draft.profile_cards.some(x=>x.type===type))return;
    if(draft.profile_cards.length>=16){note('Limite de 16 cards por perfil.',true);catalogAt=null;renderPage();return;}
    const id=type==='note'?'note_'+Math.random().toString(36).slice(2,10):type;
    const c={id,type,visible:true,title:type==='note'?'Nova nota':'',body:'',color:'#3B3054'};
    draft.profile_cards.splice(clamp(catalogAt,0,draft.profile_cards.length),0,c);catalogAt=null;activeCard=id;renderPage();}
  function reorder(from,to){if(!draft||from===to||from<0||to<0)return;const list=draft.profile_cards;
    if(from>=list.length||to>=list.length)return;const [item]=list.splice(from,1);list.splice(to,0,item);activeCard=null;renderPage();}
  function wrapSelection(type){const area=$(`#cv-card-grid [data-card="${CSS.escape(activeCard||'')}"] textarea[data-cv-field="body"]`);if(!area)return;
    const a=area.selectionStart,b=area.selectionEnd,sel=area.value.slice(a,b);let insert=sel,start=a,end=b;
    if(type==='bold')insert='**'+(sel||'texto')+'**';
    if(type==='italic')insert='*'+(sel||'texto')+'*';
    if(type==='list')insert=sel?sel.split('\n').map(s=>'- '+s).join('\n'):'- item';
    if(type==='link'){const link=window.prompt('Endereço do link (https://)');const safe=safeLink(link);if(!safe)return;insert='['+(sel||'link')+']('+safe+')';}
    area.setRangeText(insert,a,b,'select');const c=draft.profile_cards.find(x=>x.id===activeCard);if(c)c.body=area.value;
    const show=$(`#cv-card-grid [data-card="${CSS.escape(activeCard)}"] .cv-note-body`);if(show)show.innerHTML=formatNote(area.value);saveButton();area.focus();}
  function selectFile(kind){const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';input.style.display='none';document.body.append(input);
    input.addEventListener('change',()=>{if(input.files?.[0])setFile(kind,input.files[0]);input.remove();},{once:true});input.click();}
  function setFile(kind,file){if(!draft)return;const allowed=['image/png','image/jpeg','image/webp','image/gif'];
    if(!allowed.includes(file.type)||file.size>(kind==='avatar'?4194304:8388608)){note('Formato ou tamanho inválido. Avatar até 4 MB, banner até 8 MB.',true);return;}
    const prev=draft[kind+'Preview'];if(prev){URL.revokeObjectURL(prev);tempUrls.delete(prev);}
    const url=URL.createObjectURL(file);tempUrls.add(url);draft[kind+'File']=file;draft[kind+'Preview']=url;
    if(kind==='avatar'){const node=$('.cv-avatar-wrap .cv-avatar');if(node)node.outerHTML=avatar(draft);}
    else{const ban=$('.cv-banner');if(ban){ban.querySelector('img')?.remove();ban.insertAdjacentHTML('afterbegin',`<img alt="" src="${esc(url)}">`);}}
    saveButton();note('');if(focusMenu)positionFocus();}
  const b64=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Erro ao ler imagem.'));r.onload=()=>resolve(String(r.result).split(',')[1]);r.readAsDataURL(file);});
  async function save(){if(!dirty()||saving||!draft)return;const input=norm(draft);
    input.display_name=String(input.display_name||'').trim();input.handle=String(input.handle||'').trim().toLowerCase();
    if(input.display_name.length<2||input.display_name.length>32){note('Nome: use de 2 a 32 caracteres.',true);return;}
    if(!/^[a-z0-9_]{3,24}$/.test(input.handle)){note('@: use 3 a 24 letras, números ou _.',true);return;}
    if(input.bio.length>180){note('Biografia: até 180 caracteres.',true);return;}
    saving=true;saveButton();note('Salvando…');
    try{const checked=await api('profileHandleCheck',{handle:input.handle});if(!checked.available)throw Error('Este @ já está em uso.');
      for(const kind of ['avatar','banner'])if(draft[kind+'File']){const f=draft[kind+'File'];const uploaded=await api('profileUpload',{kind,mime:f.type,base64:await b64(f)});input[kind+'_path']=uploaded.path;}
      const r=await api('profileSave',{display_name:input.display_name,handle:input.handle,bio:input.bio,
        avatar_path:input.avatar_path,banner_path:input.banner_path,accent_color:input.accent_color,
        secondary_color:input.secondary_color,effect:input.effect,effect_intensity:input.effect_intensity,
        avatar_frame:input.avatar_frame,avatar_decoration:input.avatar_decoration,profile_cards:input.profile_cards});
      me=norm(r.profile);openProfile=me;mediaBase=r.mediaBase||mediaBase;editing=false;draft=null;colorHsl=null;focusMenu=null;activeCard=null;
      cleanup();renderPage(0);const name=$('#footerName'),icon=$('#footerAvatar');if(name)name.textContent=me.display_name;if(icon)icon.textContent=me.display_name[0]?.toUpperCase()||'C';
    }catch(err){note(err?.message||'Erro ao salvar o perfil.',true);}finally{saving=false;saveButton();}}
  function onboardingView(){if(onboarding)return;onboarding=true;const n=document.createElement('div');n.id='cv-onboarding';n.className='cv-onboarding';
    n.innerHTML=`<form id="cv-create-form" class="cv-create-form"><div class="cv-create-mark">◉</div><h1>Seu espaço no Zeon</h1><p>Como você quer ser conhecido?</p>
      <label for="cv-first-name">Nome de exibição</label><input id="cv-first-name" minlength="2" maxlength="32" required placeholder="Seu nome" autocomplete="nickname">
      <label for="cv-first-handle">Identificador</label><div class="cv-at-input"><span>@</span><input id="cv-first-handle" minlength="3" maxlength="24" required placeholder="seunome"></div>
      <div class="cv-initial-preview"><span class="cv-avatar small" id="cv-preview-avatar">C</span><div><strong id="cv-preview-name">Seu nome</strong><small id="cv-preview-handle">@seunome</small></div></div>
      <span id="cv-first-error" role="alert"></span><button id="cv-create-submit" class="cv-primary" type="submit">Criar perfil →</button>
      <button class="cv-link" data-cv-action="signout" type="button">Sair da conta</button></form>`;root().append(n);$('#cv-first-name')?.focus();}
  async function createProfile(event){event.preventDefault();const btn=$('#cv-create-submit');btn.disabled=true;$('#cv-first-error').textContent='';
    try{const name=$('#cv-first-name').value.trim(),handle=$('#cv-first-handle').value.trim().toLowerCase();
      if(name.length<2||name.length>32||!/^[a-z0-9_]{3,24}$/.test(handle))throw Error('Confira nome e identificador.');
      const available=await api('profileHandleCheck',{handle});if(!available.available)throw Error('Este @ já está em uso.');
      const r=await api('profileSave',{...defaults,display_name:name,handle});me=norm(r.profile);mediaBase=r.mediaBase||mediaBase;
      $('#cv-onboarding')?.remove();onboarding=false;$('#footerName')&&( $('#footerName').textContent=me.display_name );
      await showPage(myId);
    }catch(err){$('#cv-first-error').textContent=err?.message||'Erro ao criar perfil.';}finally{if(btn.isConnected)btn.disabled=false;}}
  async function inspect(){if(!$('#authGate')?.hidden){if(pageId)closePage(true);closeQuick();$('#cv-onboarding')?.remove();onboarding=false;sessionFor=null;return;}
    if(sessionLoading)return;sessionLoading=true;
    try{const s=await api('status');if(!s?.loggedIn||!s?.userId||sessionFor===s.userId)return;myId=s.userId;
      const r=await api('profileMine');me=r?.profile?norm(r.profile):null;mediaBase=r?.mediaBase||mediaBase;sessionFor=myId;
      if(!me)onboardingView();else{const name=$('#footerName'),av=$('#footerAvatar');if(name)name.textContent=me.display_name;if(av)av.textContent=me.display_name[0]?.toUpperCase()||'C';}}
    catch(err){console.warn('[Zeon perfil]',err);if(!$('#cv-setup-error')){const n=document.createElement('div');n.id='cv-setup-error';n.className='cv-onboarding';n.innerHTML='<div class="cv-create-form"><h2>Perfil indisponível</h2><p>Não foi possível conectar ao perfil.</p><button data-cv-action="retry" class="cv-primary">Tentar novamente</button></div>';root().append(n);}}
    finally{sessionLoading=false;}}
  document.addEventListener('input',e=>{
    if(e.target.id==='cv-first-name'||e.target.id==='cv-first-handle'){
      const n=$('#cv-first-name'),h=$('#cv-first-handle');if(h)h.value=h.value.toLowerCase().replace(/[^a-z0-9_]/g,'');
      const name=n?.value||'Seu nome';$('#cv-preview-name').textContent=name;$('#cv-preview-avatar').textContent=name[0]?.toUpperCase()||'C';$('#cv-preview-handle').textContent='@'+(h?.value||'seunome');}
    if(editing)updateFields(e);
  });
  document.addEventListener('change',e=>{if(editing&&!e.target?.dataset?.cvHsl)updateFields(e);});
  document.addEventListener('submit',e=>{if(e.target.id==='cv-create-form')void createProfile(e);});
  document.addEventListener('click',e=>{
    const format=e.target.closest('[data-cv-format]');if(format){wrapSelection(format.dataset.cvFormat);return;}
    const colorButton=e.target.closest('[data-cv-note-color]');if(colorButton&&activeCard&&draft){const c=draft.profile_cards.find(x=>x.id===activeCard);if(c)c.color=colorButton.dataset.cvNoteColor;
      const current=$(`#cv-card-grid [data-card="${CSS.escape(activeCard)}"]`);current?.style.setProperty('--cv-card-tint',c.color);
      $$('.cv-color-dots button',current).forEach(n=>n.classList.toggle('selected',n===colorButton));saveButton();return;}
    const action=e.target.closest('[data-cv-action]');if(action){const type=action.dataset.cvAction;
      if(type==='back'){closePage();return;}if(type==='edit'){edit();return;}if(type==='cancel'){cancel();return;}if(type==='save'){void save();return;}
      if(type==='full'){void showPage(action.dataset.id);return;}if(type==='message'){const id=action.dataset.id||pageId;closeQuick();closePage(true);void window.ZeonDM?.openByUserId(id);return;}if(type==='retry'){$('#cv-setup-error')?.remove();sessionFor=null;void inspect();return;}
      if(type==='signout'){void api('signOut').finally(()=>location.reload());return;}
      if(type==='edit-card'){closeFocus();openCard(action.dataset.card);return;}
      if(type==='add-at'){catalogAt=Number(action.dataset.index);activeCard=null;renderPage();return;}
      if(type==='close-library'){catalogAt=null;renderPage();return;}
      if(type==='create-card'){newCard(action.dataset.type);return;}
      if(type==='toggle-card'){const card=draft?.profile_cards.find(x=>x.id===action.dataset.card);if(card){card.visible=!card.visible;renderPage();}return;}
      if(type==='remove-card'){const id=action.dataset.card;const card=draft?.profile_cards.find(x=>x.id===id);if(card?.type==='note'){draft.profile_cards=draft.profile_cards.filter(x=>x.id!==id);activeCard=null;renderPage();}return;}
      if(type==='focus-avatar'||type==='focus-banner'){focusMenu=type==='focus-avatar'?'avatar':'banner';focusTab='image';focusColor='main';activeCard=null;renderPage();return;}
      if(type==='banner-tab'&&focusMenu==='banner'){if(focusTabs.some(t=>t.id===action.dataset.tab)){focusTab=action.dataset.tab;renderPage();}return;}
      if(type==='banner-color'&&focusMenu==='banner'){focusColor=action.dataset.color==='second'?'second':'main';renderPage();return;}
      if(type==='select-effect'&&focusMenu==='banner'&&draft){const v=action.dataset.effect;if(!effects.includes(v))return;
        draft.effect=v;updateEffectPreview(v);
        $$('.cv-effect-option').forEach(btn=>{const selected=btn.dataset.effect===v;btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));});
        const strength=$('.cv-effect-slider');if(strength)strength.disabled=v==='none';saveButton();return;}
      if(type==='reset-colors'&&draft){draft.accent_color=defaults.accent_color;draft.secondary_color=defaults.secondary_color;colorHsl={main:toHsl(draft.accent_color),second:toHsl(draft.secondary_color)};renderPage();return;}
      if(type==='reset-effect'&&draft){draft.effect='none';draft.effect_intensity=35;renderPage();return;}
      if(type==='close-focus'){closeFocus();renderPage();return;}
      if(type==='change-avatar'||type==='change-banner'){selectFile(type==='change-avatar'?'avatar':'banner');return;}
      if(type==='remove-banner'&&draft){draft.banner_path=null;draft.bannerFile=null;draft.bannerPreview=null;renderPage();return;}
    }
    if(e.target.closest('#cv-quick'))return;if($('#cv-quick'))closeQuick();if(onboarding)return;
    if(e.target.closest('[data-action="channel"],[data-action="group"],[data-dm-action="home"]')){closePage();return;}
    if(e.target.closest('[data-action],button,input,textarea,select'))return;
    const own=e.target.closest('#footerAvatar,#footerName');if(own){void showPage(myId);return;}
    const participant=e.target.closest('.call-person-card[data-person]');if(participant&&e.target.closest('.call-person-avatar,.call-person-video')){void showQuick(participant.dataset.person,participant);return;}
    const msg=e.target.closest('.message[data-author-id] .avatar');if(msg){void showQuick(msg.closest('.message').dataset.authorId,msg);}
  });
  let dragging=null;
  document.addEventListener('dragstart',e=>{const grip=e.target.closest('.cv-grip');if(!editing||!grip)return;
    const card=grip.closest('[data-card]');dragging=card?.dataset.card;e.dataTransfer?.setData('text/plain',dragging||'');if(e.dataTransfer)e.dataTransfer.effectAllowed='move';card?.classList.add('dragging');});
  document.addEventListener('dragover',e=>{const target=e.target.closest('#cv-card-grid [data-card]');if(!editing||!dragging||!target)return;e.preventDefault();
    $$('.cv-drop-target').forEach(n=>n.classList.remove('cv-drop-target'));target.classList.add('cv-drop-target');});
  document.addEventListener('drop',e=>{const target=e.target.closest('#cv-card-grid [data-card]');if(!editing||!dragging||!target)return;e.preventDefault();
    const from=draft.profile_cards.findIndex(x=>x.id===dragging),to=draft.profile_cards.findIndex(x=>x.id===target.dataset.card);dragging=null;reorder(from,to);});
  document.addEventListener('dragend',()=>{dragging=null;$$('.cv-drop-target,.dragging').forEach(n=>n.classList.remove('cv-drop-target','dragging'));});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;
    if(catalogAt!==null){catalogAt=null;renderPage();return;}if(focusMenu){closeFocus();renderPage();return;}if($('#cv-quick'))closeQuick();});
  window.addEventListener('resize',()=>{if(focusMenu)positionFocus();});
  const gate=$('#authGate');if(gate)new MutationObserver(()=>void inspect()).observe(gate,{attributes:true,attributeFilter:['hidden']});
  void inspect();window.ConsivoProfile={openOwn:()=>showPage(myId),openById:showPage,close:closePage,displayName:()=>me?.display_name||null};
})();
