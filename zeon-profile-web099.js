'use strict';
/* Zeon Web 0.9.9 — preview Web de perfis. Preferências locais por navegador,
   sem migração de banco nem mudanças nas chamadas P2P. */
(() => {
 const $=(q,b=document)=>b.querySelector(q), $$=(q,b=document)=>Array.from(b.querySelectorAll(q));
 const layouts=['mosaic','classic','minimal'],themes=['default','fire-natural','fire-mystic'],fx=['none','fire','bloom','ice','electric','magic'];
 const def=()=>({layout:'mosaic',theme:'default',intensity:65,nameFx:'none',nameFont:'default',feature:'',featureFx:'none',featureWord:'',notes:{}});
 const safe=(p)=>({layout:layouts.includes(p?.layout)?p.layout:'mosaic',theme:themes.includes(p?.theme)?p.theme:'default',
  intensity:Math.max(0,Math.min(100,Number(p?.intensity??65)||0)),nameFx:fx.includes(p?.nameFx)?p.nameFx:'none',
  nameFont:['default','modern','serif','mono','soft','display'].includes(p?.nameFont)?p.nameFont:'default',feature:String(p?.feature||'').slice(0,180),
  featureFx:fx.includes(p?.featureFx)?p.featureFx:'none',featureWord:String(p?.featureWord||'').slice(0,48),
  notes:p?.notes&&typeof p.notes==='object'&&!Array.isArray(p.notes)?p.notes:{}});
 let id='',data=def(),draft=null,lastEdit=false,frame=0,tick=0,queued=false;
 const publicLooks=new Map(),sharedLooks=new Map(),pendingReads=new Set();
 let currentProfileId='',savingLook=false;
 const face=v=>['default','modern','serif','mono','soft','display'].includes(v)?v:'default';
 function fromShared(a){
  const c=def(),p=a||{},mark=Array.isArray(p.featureMarks)?p.featureMarks[0]:null;
  c.layout=layouts.includes(p.layout)?p.layout:'mosaic';
  c.theme=themes.includes(p.theme)?p.theme:'default';
  c.intensity=Math.max(0,Math.min(100,Number(p.themeIntensity??65)||0));
  c.nameFont=face(p.nameFont);c.nameFx=fx.includes(p.nameEffect)?p.nameEffect:'none';
  c.feature=String(p.featureText||p.headline||'').slice(0,180);
  c.featureWord=String(mark?.text||'').slice(0,48);
  c.featureFx=fx.includes(mark?.effect)?mark.effect:'none';
  for(const [key,val] of Object.entries(p.noteStyles||{}).slice(0,16)){
   const m=Array.isArray(val?.marks)?val.marks[0]:null;
   if(m?.text&&fx.includes(m.effect))c.notes[key]={text:String(m.text).slice(0,48),effect:m.effect};
  }
  return safe(c);
 }
 function toShared(c,previous){
  const p=previous&&typeof previous==='object'?JSON.parse(JSON.stringify(previous)):{};
  p.schema=1;p.layout=c.layout;p.theme=c.theme;p.themeIntensity=c.intensity;
  p.nameFont=face(c.nameFont);p.nameEffect=c.nameFx;
  p.headline=String(p.headline||'').slice(0,90);
  p.featureText=String(c.feature||'').slice(0,180);
  p.featureFont=face(p.featureFont);
  const oldMarks=Array.isArray(p.featureMarks)?p.featureMarks:[];
  p.featureMarks=c.featureWord&&c.featureFx!=='none'&&c.feature.includes(c.featureWord)
   ?[{text:c.featureWord,occurrence:0,font:'default',effect:c.featureFx},
      ...oldMarks.filter(m=>m.text!==c.featureWord).slice(0,5)]
   :oldMarks.filter(m=>c.feature.includes(m.text));
  p.noteStyles=p.noteStyles&&typeof p.noteStyles==='object'&&!Array.isArray(p.noteStyles)?p.noteStyles:{};
  for(const [key,val] of Object.entries(c.notes||{}).slice(0,16)){
   if(!/^note_[a-z0-9_-]{3,52}$/i.test(key)||!val?.text||!fx.includes(val.effect))continue;
   const old=p.noteStyles[key]||{},marks=Array.isArray(old.marks)?old.marks:[];
   p.noteStyles[key]={font:face(old.font),marks:[
    {text:String(val.text).slice(0,48),occurrence:0,font:'default',effect:val.effect},
    ...marks.filter(m=>m.text!==val.text).slice(0,5)]};
  }
  return p;
 }
 function loadShared(userId,owner){
  if(!userId||pendingReads.has(userId))return;
  pendingReads.add(userId);
  void window.desktop.onlineInvoke('profileAppearanceRead',{userId}).then(result=>{
   if(result?.appearance){
    sharedLooks.set(userId,result.appearance);
    const next=fromShared(result.appearance);
    if(owner){data=next;if(userId===id)try{localStorage.setItem(key(),JSON.stringify(next));}catch{}}
    else publicLooks.set(userId,next);
   }else if(!owner)publicLooks.set(userId,def());
   if(currentProfileId===userId)queue();
  }).catch(err=>{console.warn('[Zeon perfil compartilhado]',err?.message||err);
   if(!owner)publicLooks.set(userId,def());
   if(currentProfileId===userId)queue();
  }).finally(()=>pendingReads.delete(userId));
 }

 const page=()=>{const e=$('#cv-page');return e&&!e.hidden&&$('.cv-full-shell',e)?e:null;};
 const isOwn=p=>$('.cv-page-top strong',p)?.textContent.trim()==='Meu perfil';
 const isEdit=p=>!!$('[data-cv-action="cancel"]',p);
 const key=()=> 'zeon:web-profile:099:'+id;
 function load(){try{return safe(JSON.parse(localStorage.getItem(key())||'null'));}catch{return def();}}
 async function persist(){
  if(!id||!draft||savingLook)return;
  const snapshot=safe(JSON.parse(JSON.stringify(draft)));
  savingLook=true;
  try{
   const canonical=toShared(snapshot,sharedLooks.get(id));
   const result=await window.desktop.onlineInvoke('profileAppearanceSave',{appearance:canonical});
   sharedLooks.set(id,result?.appearance||canonical);
   data=fromShared(result?.appearance||canonical);
   try{localStorage.setItem(key(),JSON.stringify(data));}catch{}
   queue();
  }catch(err){window.alert('Não foi possível compartilhar a aparência: '+(err?.message||'Falha no servidor.'));}
  finally{savingLook=false;}
 }
 function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
 async function session(){try{const s=await window.desktop?.onlineInvoke?.('status');if(s?.loggedIn&&s.userId!==id){id=s.userId;data=sharedLooks.has(id)?fromShared(sharedLooks.get(id)):load();draft=null;lastEdit=false;queue();}}catch{}}
 const control=(label,kind,k,value,items)=>{const wrap=document.createElement('label');wrap.className='zw-control';wrap.append(document.createTextNode(label));
  const el=document.createElement(kind==='textarea'?'textarea':kind==='range'?'input':'select');el.dataset.zwField=k;
  if(kind==='range'){el.type='range';el.min='0';el.max='100';el.step='5';el.value=value;}
  else if(kind==='textarea'){el.value=value;el.rows=2;el.maxLength=180;}
  else for(const [v,t] of items){const opt=document.createElement('option');opt.value=v;opt.textContent=t;el.append(opt);el.value=value;}
  wrap.append(el);return wrap;};
 const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.zwAction=action;return b;};
 function studio(host,c){
  if($('#zw-web-studio',host))return;
  const section=document.createElement('section');section.id='zw-web-studio';section.className='zw-web-studio';
  const header=document.createElement('h3');header.textContent='✦ Estúdio de Perfis · Web';section.append(header);
  const desc=document.createElement('p');desc.textContent='Personalize seu perfil. Ao salvar, outros usuários conectados verão este visual.';section.append(desc);
  const grid=document.createElement('div');grid.className='zw-controls';
  grid.append(control('Layout','select','layout',c.layout,[['mosaic','Mosaico'],['classic','Clássico'],['minimal','Minimalista']]),
   control('Atmosfera','select','theme',c.theme,[['default','Original'],['fire-natural','🔥 Chama Natural'],['fire-mystic','✧ Chama Mística']]),
   control('Intensidade','range','intensity',c.intensity),control('Fonte do nome','select','nameFont',c.nameFont,[['default','Zeon'],['modern','Moderna'],['serif','Editorial'],['mono','Digital'],['soft','Delicada'],['display','Impactante']]),
   control('Efeito do nome','select','nameFx',c.nameFx,[['none','Nenhum'],['fire','Chamas'],['bloom','Natureza'],['ice','Gelo'],['electric','Eletricidade'],['magic','Magia']]),
   control('Efeito da frase','select','featureFx',c.featureFx,[['none','Nenhum'],['fire','Chamas'],['bloom','Natureza'],['ice','Gelo'],['electric','Eletricidade'],['magic','Magia']]));
  section.append(grid,control('Frase em destaque','textarea','feature',c.feature));
  const line=document.createElement('div');line.className='zw-actions';line.append(button('Aplicar efeito à seleção da frase','mark-feature'),button('Salvar aparência','save'));section.append(line);
  const note=document.createElement('small');note.textContent='Foto, banner e cards continuam sendo salvos pelo botão principal do editor.';section.append(note);
  const cards=$('#cv-card-grid',host);if(cards)cards.before(section);else host.append(section);
 }
 function fxspan(text,kind){const e=document.createElement('span');e.className='zw-fx-text';e.dataset.zwFx=kind;e.append(document.createTextNode(text));const cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');e.append(cv);return e;}
 function titleFx(p,c){const h=$('.cv-identity h2',p);if(!h)return;const txt=h.textContent;if(c.nameFx==='none'){if($('.zw-fx-text',h))h.textContent=txt;return;}
  if(!$('.zw-fx-text',h)){h.replaceChildren(fxspan(txt,c.nameFx));}}
 function featureFx(p,c){const hero=$('.cv-hero-content',p);if(!hero)return;let el=$('.zw-feature',hero);
  if(!c.feature){el?.remove();return;}
  if(!el){el=document.createElement('div');el.className='zw-feature';hero.append(el);}
  const hash=JSON.stringify([c.feature,c.featureFx,c.featureWord]);if(el.dataset.snapshot===hash)return;el.dataset.snapshot=hash;
  el.replaceChildren();const start=c.featureWord&&c.featureFx!=='none'?c.feature.indexOf(c.featureWord):-1;
  if(start<0)el.append(document.createTextNode(c.feature));
  else el.append(document.createTextNode(c.feature.slice(0,start)),fxspan(c.featureWord,c.featureFx),document.createTextNode(c.feature.slice(start+c.featureWord.length)));
 }
 function notesFx(p,c){for(const [noteId,item] of Object.entries(c.notes||{}).slice(0,16)){if(!/^note_[a-z0-9_-]{3,52}$/i.test(noteId)||!fx.includes(item?.effect))continue;
   const box=$$('[data-card]',p).find(x=>x.dataset.card===noteId),body=box&&$('.cv-note-body',box);if(!body||$('.zw-fx-text',body))continue;
   const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const v=n.nodeValue||'',ix=v.indexOf(item.text||'');if(ix<0||!item.text)continue;const f=document.createDocumentFragment();
    f.append(document.createTextNode(v.slice(0,ix)),fxspan(item.text,item.effect),document.createTextNode(v.slice(ix+item.text.length)));n.replaceWith(f);break;}
  }}
 function noteEdit(p){for(const c of $$('.cv-card.cv-note',p)){const pane=$('.cv-card-panel-inner',c),ta=pane&&$('textarea[data-cv-field="body"]',pane);if(!ta||$('.zw-note-fx',pane))continue;
  const row=document.createElement('div');row.className='zw-note-fx';const select=document.createElement('select');
  for(const [v,t] of [['fire','🔥 Chamas'],['bloom','🌿 Natureza'],['ice','❄ Gelo'],['electric','⚡ Eletricidade']]){const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);}
  row.append(select,button('Animar palavra selecionada','mark-note'));row.dataset.card=c.dataset.card;pane.append(row);
  }}
 function attach(p,c){const banner=$('.cv-banner',p),scroll=$('.cv-profile-scroll',p);if(c.theme==='default'||c.intensity===0){
  $$('.zw-flames,.zw-embers',p).forEach(x=>x.remove());return;}
  if(banner&&!$('.zw-flames',banner)){const v=document.createElement('canvas');v.className='zw-flames';v.setAttribute('aria-hidden','true');banner.append(v);}
  if(scroll&&!$('.zw-embers',scroll)){const v=document.createElement('canvas');v.className='zw-embers';v.setAttribute('aria-hidden','true');scroll.prepend(v);}}
 function render(){const p=page();if(!p){lastEdit=false;draft=null;currentProfileId='';return;}if(!id&&isOwn(p))void session();
   const shell=$('.cv-full-shell',p),stage=$('.cv-profile-stage',p);if(!stage)return;
   const own=isOwn(p),edit=own&&isEdit(p);
   if(edit&&!lastEdit)draft=JSON.parse(JSON.stringify(data));
   if(!edit&&lastEdit)draft=null;
   lastEdit=edit;
  const userId=$('.cv-full-shell',p)?.dataset.cvUserId||'';
  if(userId&&userId!==currentProfileId){
   currentProfileId=userId;
   if(!own)publicLooks.delete(userId);
   loadShared(userId,own);
  }
  const c=own?(edit&&draft?draft:data):(publicLooks.get(userId)||def());
   shell.classList.add('zw-profile-web');shell.dataset.zwTheme=c.theme;shell.dataset.zwIntensity=c.intensity;stage.dataset.zwLayout=c.layout;
   const identity=$('.cv-identity',p);if(identity)identity.dataset.zwFont=c.nameFont;
   const hero=$('.cv-hero',p);if(hero&&!$('.zw-pill',hero)){const pill=document.createElement('span');pill.className='zw-pill';pill.textContent=own?'✦ MEU ESPAÇO':'✦ ESPAÇO PESSOAL';$('.cv-banner',hero)?.append(pill);}
   if(own){titleFx(p,c);featureFx(p,c);notesFx(p,c);}
   if(edit){studio(stage,c);noteEdit(p);}else $('#zw-web-studio',p)?.remove();
    const cards=$('#cv-card-grid',stage);
    if(cards&&!$('.zw-section-head',stage)){
      const heading=document.createElement('div');heading.className='zw-section-head';
      const small=document.createElement('small');small.textContent='✦ EXPLORE O PERFIL';
      const title=document.createElement('h3');title.textContent='Meu universo';
      const caption=document.createElement('p');caption.textContent='Um pouco mais sobre quem está por aqui.';
      heading.append(small,title,caption);cards.before(heading);
    }
   attach(p,c);if(!frame)frame=requestAnimationFrame(paint);
 }
 function canvas(c){const r=c.getBoundingClientRect();if(r.width<1||r.height<1)return null;const d=Math.min(devicePixelRatio||1,1.5),w=Math.round(r.width),h=Math.round(r.height);
   if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d);}const ctx=c.getContext('2d');if(!ctx)return null;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);return {ctx,w,h};}
 function flames(c,t,theme,level){
   const obj=canvas(c);if(!obj)return;
   const {ctx,w,h}=obj,p=Math.max(0,Math.min(1,level/100)),mystic=theme==='fire-mystic',seconds=t/1000,TAU=Math.PI*2;
   if(!p)return;
   const noise=n=>{const a=Math.sin(n*127.1+78.233)*43758.5453123;return a-Math.floor(a);};
   const color=(rgb,a)=>'rgba('+rgb.join(',')+','+Math.max(0,Math.min(1,a)).toFixed(3)+')';
   const violet=[174,85,255],blue=[52,158,255],ice=[168,235,255],warm=[255,116,37],gold=[255,205,107];
   function glow(x,y,r,rgb,a){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color(rgb,a));g.addColorStop(.4,color(rgb,a*.34));g.addColorStop(1,color(rgb,0));
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
   }
   ctx.save();ctx.globalCompositeOperation='screen';
   const baseY=h-2;
   glow(w*.28,h*.94,w*.36,mystic?violet:warm,.14*p);
   glow(w*.73,h*.97,w*.39,mystic?blue:gold,.13*p);
   // One continuous, animated fire bed runs from the first to the last pixel.
   if(mystic&&window.ZeonMysticSurface)window.ZeonMysticSurface.draw(ctx,w,h,seconds,level);
   const count=mystic?Math.min(23,Math.max(13,Math.round(w/64))):Math.min(53,Math.max(26,Math.round(w/26)));
   const layers=mystic?1:3;
   for(let layer=0;layer<layers;layer++)for(let i=0;i<count;i++){
     const seed=i*4.31+2.4+layer*211;
     const x=mystic?( .04+.92*noise(seed) )*w:(i+.18+noise(seed)*.65)*w/count;
     const time=seconds*(.45+.5*noise(seed+7))+seed*.55;
     const rising=h*(mystic?.30+.36*noise(seed+5):.19+.25*noise(seed+5))*(.77+.24*Math.sin(time));
     const height=rising*(.8+.35*p);
     const width=mystic?w*(.018+.027*noise(seed+1)):(w/count)*(.50+.35*noise(seed+1));
     const y=baseY-(mystic?1+2*noise(seed+11):0);
     const rgb=mystic?(i%4===0?ice:i%2?blue:violet):(layer===0?warm:gold);
     if(mystic)glow(x,y,width*1.6,rgb,.09*p);
     const points=[],left=[],right=[];
     const steps=mystic?20:12;
     for(let j=0;j<=steps;j++){
       const f=j/steps;
       const sway=Math.sin(f*7.5+time*.8+seed)*width*(.08+.45*f);
       const drift=mystic?Math.sin(time*.67+seed*3.2)*width*.9*f+Math.sin(f*4.1+time*.5+seed)*width*.45*f:Math.sin(time*2.1+seed)*width*.45*f;
       const px=x+sway+drift,py=y-height*f+(mystic?Math.sin(f*8+time+seed)*height*.04*f:0);
       const hw=width*Math.pow(1-f,mystic?.94:.7)*(.63+.14*Math.sin(f*11+time+seed));
       points.push([px,py]);left.push([px-hw,py]);right.push([px+hw*.8,py]);
     }
     const fill=(leftSide,rightSide)=>{
       ctx.beginPath();ctx.moveTo(leftSide[0][0],leftSide[0][1]);
       for(const q of leftSide.slice(1))ctx.lineTo(q[0],q[1]);
       for(let q=rightSide.length-1;q>=0;q--)ctx.lineTo(rightSide[q][0],rightSide[q][1]);
       ctx.closePath();
     };
     const skin=ctx.createLinearGradient(x,y,x,y-height);
     skin.addColorStop(0,color(rgb,(mystic?.38:.19)*p));
     skin.addColorStop(.42,color(rgb,(mystic?.35:.20)*p));
     skin.addColorStop(.75,color(rgb,(mystic?.18:.08)*p));
     skin.addColorStop(1,color(rgb,0));
     fill(left,right);ctx.fillStyle=skin;ctx.shadowColor=color(rgb,.45*p);ctx.shadowBlur=mystic?17:10;ctx.fill();ctx.shadowBlur=0;
     if(mystic){
       const innerL=points.map((q,j)=>[q[0]-width*.24*(1-j/steps),q[1]]);
       const innerR=points.map((q,j)=>[q[0]+width*.17*(1-j/steps),q[1]]);
       const g=ctx.createLinearGradient(x,y,x,y-height);g.addColorStop(0,color(ice,.34*p));g.addColorStop(.55,color(ice,.13*p));g.addColorStop(1,color(ice,0));
       fill(innerL,innerR);ctx.fillStyle=g;ctx.fill();
       ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
       for(let j=1;j<points.length;j++)ctx.lineTo(points[j][0],points[j][1]);
       ctx.strokeStyle=color(ice,.12*p);ctx.lineWidth=.7;ctx.stroke();
     }
   }
   // A connected emission line, not disconnected triangles hovering above the frame.
   const ground=ctx.createLinearGradient(0,h-16,0,h);
   ground.addColorStop(0,'rgba(0,0,0,0)');ground.addColorStop(1,mystic?color(blue,.28*p):color(warm,.27*p));
   ctx.fillStyle=ground;ctx.fillRect(0,h-16,w,16);
   if(mystic&&p>.25&&window.ZeonEnergyArcs){
     window.ZeonEnergyArcs.draw(ctx,w,h,t/1000,{variant:'mystic',intensity:Math.min(100,p*100)});
   }
   for(let i=0;i<(mystic?40:55)*p;i++){
     const n=noise(i*9+15),v=(noise(i*11+4)+seconds*(.045+noise(i*5+18)*.09))%1;
     const x=n*w+Math.sin(seconds*.8+i)*w*.012*v,y=h+3-v*(h+8);
     ctx.fillStyle=color(mystic?(i%4===0?ice:violet):(i%8===0?gold:warm),(.09+.38*noise(i+3))*(1-v)*p);
     ctx.beginPath();ctx.arc(x,y,.55+noise(i*3+22)*1.35,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
  function embers(c,t,mystic,level){const obj=canvas(c);if(!obj)return;const {ctx,w,h}=obj;for(let i=0;i<30*level/100;i++){const x=(Math.sin(i*117)*.5+.5)*w,y=h-(i*41+t*.01*(1+i%3))%h;
   ctx.fillStyle=mystic?'rgba(169,155,255,.30)':'rgba(255,163,87,.30)';ctx.beginPath();ctx.arc(x+Math.sin(t*.0007+i)*15,y,1.5,0,7);ctx.fill();}}
 function word(c,t){const span=c.parentElement;if(!span)return;const obj=canvas(c),txt=span.firstChild?.nodeValue||'';if(!obj||!txt)return;const {ctx,w,h}=obj,s=getComputedStyle(span),size=parseFloat(s.fontSize)||16,eff=span.dataset.zwFx;
   const color=eff==='fire'?'#FFCD90':eff==='bloom'?'#BDF0A7':eff==='ice'?'#B8EFFF':eff==='magic'?'#EED5FF':'#C7CAFF';
   ctx.fillStyle=color;ctx.shadowBlur=5;ctx.shadowColor=eff==='fire'?'#FF7934':eff==='bloom'?'#5FCB69':'#94B9FF';
   ctx.font=s.fontWeight+' '+size+'px '+s.fontFamily;ctx.textBaseline='alphabetic';ctx.fillText(txt,11,11+size*.88);ctx.shadowBlur=0;
   for(let i=0;i<Math.min(18,w/13);i++){const x=11+i*(w-22)/Math.min(18,w/13),y=11+size*.2;
     if(eff==='fire'){const height=8+5*Math.sin(t*.005+i);const g=ctx.createLinearGradient(x,y+10,x,y-height);g.addColorStop(0,'rgba(255,102,28,.75)');g.addColorStop(1,'rgba(255,226,120,0)');ctx.fillStyle=g;
       ctx.beginPath();ctx.moveTo(x-4,y+10);ctx.quadraticCurveTo(x-6,y-height*.3,x+Math.sin(t*.003+i)*4,y-height);ctx.quadraticCurveTo(x+6,y-height*.2,x+4,y+10);ctx.fill();}
     else if(eff==='bloom'){ctx.save();ctx.translate(x+Math.sin(t*.002+i)*4,y);ctx.rotate(t*.0002+i);ctx.fillStyle='#A5E99B';
       for(let j=0;j<4;j++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.ellipse(3,0,3,1.1,0,0,7);ctx.fill();}ctx.restore();}
     else if(eff==='magic'){
       ctx.save();ctx.translate(x,y);ctx.rotate(t*.0003+i);
       ctx.strokeStyle='#DFABFF';ctx.lineWidth=1.1;
       ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,0);
       ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.stroke();ctx.restore();
      }
      else{ctx.strokeStyle=eff==='ice'?'#9BE5FF':'#D0B6FF';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(t*.005+i)*4,y-6);ctx.stroke();}
   }}
 function paint(t){frame=requestAnimationFrame(paint);if(document.hidden||t-tick<35)return;tick=t;const p=page();if(!p)return;const shell=$('.cv-full-shell',p),theme=shell?.dataset.zwTheme,level=Number(shell?.dataset.zwIntensity)||0;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){if(theme!=='default'){const b=$('.zw-flames',p),a=$('.zw-embers',p);if(b)flames(b,t,theme,level);if(a)embers(a,t,theme==='fire-mystic',level);}
   for(const x of $$('.zw-fx-text canvas',p).slice(0,6))word(x,t);}
 }
 document.addEventListener('input',e=>{const el=e.target;if(!draft||!el.matches?.('[data-zw-field]'))return;draft[el.dataset.zwField]=el.dataset.zwField==='intensity'?Number(el.value):el.value;});
 document.addEventListener('change',e=>{if(e.target.matches?.('[data-zw-field]'))queue();});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-zw-action]');if(!b||!draft)return;const p=page();if(!p||!isOwn(p)||!isEdit(p))return;
   const action=b.dataset.zwAction;if(action==='save'){void persist();return;}
   if(action==='mark-feature'){const area=$('#zw-web-studio textarea',p);const val=area?.value||'',word=val.slice(area.selectionStart,area.selectionEnd);if(word&&word.length<=48&&!word.includes('\n')&&draft.featureFx!=='none'){draft.featureWord=word;queue();}return;}
   if(action==='mark-note'){const row=b.closest('.zw-note-fx'),card=$$('[data-card]',p).find(x=>x.dataset.card===row?.dataset.card),ta=card&&$('textarea[data-cv-field="body"]',card);
      const txt=ta?.value.slice(ta.selectionStart,ta.selectionEnd);if(txt&&txt.length<=48&&!txt.includes('\n')){draft.notes[row.dataset.card]={text:txt,effect:$('select',row)?.value||'fire'};queue();}}
 },true);
 document.addEventListener('click',e=>{const action=e.target.closest('[data-cv-action]')?.dataset.cvAction;
  if(action==='cancel'||action==='back'||action==='signout'){draft=null;lastEdit=false;}
  if(action==='save'&&draft)void persist();
 },true);
 new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))queue();}).observe(document.body,{childList:true,subtree:true});
 const gate=$('#authGate');if(gate)new MutationObserver(()=>void session()).observe(gate,{attributes:true,attributeFilter:['hidden']});
 void session();queue();
})();