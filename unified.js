'use strict';
// Consivo 0.7.3: a interface original é a única UI; Supabase + LiveKit são as fontes de dados.
(()=>{
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths={
  microphone:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  'microphone-off':'<path d="M9 9v2a3 3 0 0 0 4.5 2.6M15 9V5a3 3 0 0 0-5.8-1M5 10a7 7 0 0 0 12 4.6M19 10a7 7 0 0 1-.5 2.6M12 17v5M8 22h8M2 2l20 20"/>',
  camera:'<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3z"/>',
  'camera-off':'<path d="M3 3l18 18M10 5h5a2 2 0 0 1 2 2v3l5-3v10l-3-1.8M17 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-.7.4-1.3 1-1.7"/>',
  share:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4M12 13V7m0 0-3 3m3-3 3 3"/>',
  floating:'<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="11" y="11" width="8" height="7" rx="1"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  shrink:'<path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6"/>',
  speaker:'<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
  leave:'<path d="M20 16.5v2a2 2 0 0 1-2 2h-2M4 16.5v2a2 2 0 0 0 2 2h2M3 12a9 9 0 0 1 18 0M3 12h18M7 15l3 3m4 0 3-3"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||''}</svg>`;
const PREFKEY='consivo-v06-preferences';
const defaults={microphoneId:'',cameraId:'',speakerId:'',volume:75,sidebarOpen:true,cameraResolution:'720',cameraFps:30,cameraMirror:true,cameraFit:'cover',shareResolution:'1080',shareFps:30};
let prefs={...defaults};try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREFKEY)||'{}')};}catch{}
const compat=window.ConsivoMediaCompat,qual=window.ConsivoCameraQuality,shareQual=window.ConsivoShareQuality;
Object.assign(prefs,qual?.normalize(prefs)||{},shareQual?.normalizeShareSettings(prefs)||{});
const savePrefs=()=>localStorage.setItem(PREFKEY,JSON.stringify(prefs));
const S={status:null,groups:[],group:null,channels:[],channel:null,role:null,room:null,joinedVoice:null,connecting:false,busy:false,sidebarOpen:prefs.sidebarOpen!==false && (!window.desktop?.isWeb || window.innerWidth>740),chatOpen:false,focus:false,poll:null,refreshing:false,modalAction:null,source:null,sources:[],sourceKind:'screen',cameraModes:null};
const LK=()=>window.ConsivoLiveKit;
const api=(command,args={})=>window.desktop.onlineInvoke(command,args);
const group=()=>S.groups.find(g=>g.id===S.group);
const channel=()=>S.channels.find(c=>c.id===S.channel);
const joinedChannel=()=>S.channels.find(c=>c.id===S.joinedVoice);
const displayName=()=>window.ConsivoProfile?.displayName?.()||S.status?.email?.split('@')[0]||'Você';
const initials=v=>Array.from(String(v||'?').trim())[0]?.toUpperCase()||'?';
let toastTimer,modalsBusy=false,seq=0;
const popup=msg=>{const n=$('#toast');n.textContent=String(msg);n.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('visible'),4800);};
const task=async fn=>{try{return await fn();}catch(err){popup(err?.message||'Não foi possível concluir.');console.error('[Zeon]',err);}};
function setConnection(text,good=false){const n=$('#netStatus');n.textContent=text;n.classList.toggle('connected',good);}
function authGate(stage){
 const gate=$('#authGate');gate.hidden=stage==='ready';
 $('#setupScreen').hidden=stage!=='setup';$('#loginScreen').hidden=stage!=='login';$('#loadingScreen').hidden=stage!=='loading';
 $('.app-shell').classList.toggle('auth-locked',stage!=='ready');
 document.dispatchEvent(new CustomEvent('zeon:web-auth'));
}
async function showAuth(){authGate('loading');S.status=await api('status');
 if(!S.status.configured){authGate('setup');setConnection('CONFIGURAR ONLINE');return;}
 if(!S.status.loggedIn){authGate('login');setConnection('DESCONECTADO');return;}
 authGate('ready');setConnection('ONLINE',true);await loadGroups();}
$('#setupForm').addEventListener('submit',e=>{e.preventDefault();void task(async()=>{await api('configure',{url:$('#projectUrl').value,key:$('#projectKey').value});await showAuth();});});
async function auth(method){const email=$('#accountEmail').value,password=$('#accountPassword').value;
  const response=await api(method,{email,password});$('#accountPassword').value='';
  if(response.pendingConfirmation)popup('Confirme o email para entrar.');else await showAuth();}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();void task(()=>auth('signIn'));});
$('#signupBtn').addEventListener('click',()=>void task(()=>auth('signUp')));
$('#signOutBtn').addEventListener('click',()=>void task(async()=>{await leaveVoice();await api('signOut');await showAuth();}));
$('#changeBackendBtn').addEventListener('click',()=>authGate('setup'));
async function loadGroups(){const before=S.group;S.groups=await api('groups');
 S.group=S.groups.some(g=>g.id===before)?before:S.groups[0]?.id||null;
 await selectGroup(S.group,false);renderGroups();}
function renderGroups(){
 $('#groupRail').innerHTML=S.groups.map(g=>`<button class="group-chip ${S.group===g.id?'selected':''}" data-action="group" data-id="${escape(g.id)}" title="${escape(g.name)}" aria-label="Grupo ${escape(g.name)}">${escape(initials(g.name))}</button>`).join('');
}
async function selectGroup(id,reset=true){
 if(S.group!==id&&S.room)await leaveVoice();S.group=id;
 const g=group();S.channels=g?await api('channels',{groupId:g.id}):[];
 S.role=g?await api('memberRole',{groupId:g.id}):null;
 if(reset||!S.channels.some(c=>c.id===S.channel))S.channel=S.channels.find(c=>c.type==='text')?.id||S.channels[0]?.id||null;
 S.chatOpen=false;render();await refreshMessages();startPolling();}
function renderChannels(){const g=group();$('#groupTitle').textContent=g?.name||'Seus grupos';
 $('#groupSubtitle').textContent=g?`${S.channels.length} canais · Grupo privado`:'Crie um grupo ou entre por convite';
 $('#footerAvatar').textContent=initials(displayName());$('#footerName').textContent=displayName();
 const canCreate=['owner','admin'].includes(S.role);
 $('#channelList').innerHTML=['text','voice'].map(type=>`<div class="section-label">CANAIS DE ${type==='text'?'TEXTO':'VOZ'} ${canCreate?`<button class="text-plus" data-action="new-channel" data-type="${type}" title="Novo canal" aria-label="Novo canal">+</button>`:''}</div><div class="channel-list">${S.channels.filter(c=>c.type===type).map(c=>`<div class="room-entry-wrap"><button class="room-entry ${S.channel===c.id?'active':''}" data-action="channel" data-id="${escape(c.id)}"><span class="room-symbol">${type==='text'?'#':'◖))'}</span><span class="room-name">${escape(c.name)}</span>${c.admin_only?'<span class="channel-lock" title="Somente administradores">◆</span>':''}${S.joinedVoice===c.id?'<span class="room-count">●</span>':''}</button></div>`).join('')}</div>`).join('');}
async function selectChannel(id){const next=S.channels.find(x=>x.id===id);if(!next)return;
 S.channel=id;S.chatOpen=false;render();
 if(next.type==='voice'&&S.joinedVoice!==id)await joinVoice(next);
 await refreshMessages();}
function renderHeader(){const c=channel();$('#channelName').textContent=c?.name||'Início';$('#channelKind').textContent=c?.type==='voice'?'Voz':'Texto';
 $('#channelGlyph').textContent=c?.type==='voice'?'◖))':'#';$('#sidebarToggle').setAttribute('aria-pressed',String(S.sidebarOpen));
 $('.app-shell').classList.toggle('sidebar-hidden',!S.sidebarOpen);
 const canChat=c?.type==='voice'&&S.joinedVoice===c.id;
 $('#callChatToggle').hidden=!canChat;$('#callChatToggle').textContent=S.chatOpen?'✕ Fechar chat da call':'☰ Chat da call';
 $('.app-shell').classList.toggle('call-chat-open',!!(canChat&&S.chatOpen));
 $('#inviteButton').hidden=!S.group;$('#inviteButton').textContent='✉ Convidar';
}
function render(){renderGroups();renderChannels();renderHeader();renderWorkspace();renderDock();renderCallChat();syncFloat();
 document.dispatchEvent(new CustomEvent('zeon:web-render'));
}
function renderWorkspace(){const c=channel(),root=$('#workspace');
 // Não destrua vídeos enquanto a mesma chamada estiver visível. Recriar o <video>
 // por causa de um evento de voz causava tela preta/piscadas durante a transmissão.
 if(!c||c.type==='text'){
  detach();delete root.dataset.voiceSignature;
  if(!c){root.className='workspace text-workspace';root.innerHTML='<div class="text-channel-heading"><span class="hero-label">ZEON ONLINE</span><h2>Bem-vindo!</h2><p>Crie um grupo ou entre usando o convite dos seus amigos.</p></div>';return;}
  renderText(c);return;
 }
 renderVoice(c);
}
function renderText(c){
 const previous=$('#textInput');S.textDrafts ||= {};
 if(previous?.dataset.channelId)S.textDrafts[previous.dataset.channelId]=previous.value;
 const keepFocus=!!(previous&&document.activeElement===previous&&previous.dataset.channelId===c.id);
 $('#workspace').className='workspace text-workspace';$('#workspace').innerHTML=`<div class="text-channel-view"><div class="text-channel-heading"><div><span class="hero-label">✦ CANAL DE TEXTO</span><h2># ${escape(c.name)}</h2><p>Mensagens sincronizadas com o grupo.</p></div>${c.admin_only?'<span class="hero-badge">◆ SÓ ADMINISTRADORES</span>':''}</div><div class="text-messages" id="textMessages" role="log"></div><form class="text-composer" id="textForm"><input id="textInput" data-channel-id="${escape(c.id)}" maxlength="700" autocomplete="off" placeholder="Mensagem em # ${escape(c.name)}" aria-label="Mensagem" ${c.admin_only&&!['owner','admin'].includes(S.role)?'disabled':''}/><button type="submit" ${c.admin_only&&!['owner','admin'].includes(S.role)?'disabled':''} aria-label="Enviar">➤</button></form></div>`;
 const nextInput=$('#textInput');
 if(nextInput){
   nextInput.value=S.textDrafts[c.id]||'';
   if(keepFocus){nextInput.focus({preventScroll:true});nextInput.setSelectionRange(nextInput.value.length,nextInput.value.length);}
 }
 const msgs=S.messageCache?.[c.id];if(msgs)drawMessages($('#textMessages'),msgs);
}
let bound=[];function detach(){for(const [t,element] of bound){try{t.detach(element);}catch{}}bound=[];}
function liveTrack(pub){return pub?.videoTrack||pub?.audioTrack||pub?.track||null;}
function sourceTrack(person,source){const lib=LK(),pub=lib&&person?.getTrackPublication?.(lib.Track.Source[source]);if(!pub||pub.isMuted||('isSubscribed' in pub&&!pub.isSubscribed))return null;return liveTrack(pub);}
function participants(){return S.room?[S.room.localParticipant,...S.room.remoteParticipants.values()]:[];}
function personLabel(p){return p===S.room?.localParticipant?displayName():(p.name||p.identity||'Participante');}
function stageSource(){if(!S.room)return null;for(const p of participants()){
 const t=sourceTrack(p,'ScreenShare');if(t)return {person:p,track:t};}return null;}
function attachInto(track,node){if(!track||!node)return;try{track.attach(node);node.autoplay=true;node.playsInline=true;node.muted=true;bound.push([track,node]);node.play?.().catch?.(()=>{});}catch{}}
// Identidade da trilha por objeto: uma substituição do MediaStreamTrack invalida a
// estrutura mesmo quando seu identificador textual for reaproveitado.
const voiceTrackIds=new WeakMap();let voiceTrackNumber=0;
function voiceTrackKey(track){if(!track)return '-';if(!voiceTrackIds.has(track))voiceTrackIds.set(track,++voiceTrackNumber);return voiceTrackIds.get(track);}
function refreshVoiceChrome(people,share,focus,joined){
 const root=$('#workspace'),layout=root.querySelector('.call-layout');if(!layout)return;
 layout.classList.toggle('share-focused',focus);
 const grid=layout.querySelector('.call-participants');if(grid){grid.classList.toggle('call-participants--hidden',focus);grid.setAttribute('aria-hidden',String(focus));}
 const speaking=new Set((S.room?.activeSpeakers||[]).map(p=>p.identity));
 for(const card of root.querySelectorAll('.call-person-card'))card.classList.toggle('speaking',speaking.has(card.dataset.person));
 const p=S.room?.localParticipant;
 for(const [type,enabled,glyph] of [['mic',!!p?.isMicrophoneEnabled,'microphone'],['camera',!!p?.isCameraEnabled,'camera'],['share',!!p?.isScreenShareEnabled,'share']]){
  const b=root.querySelector(`.voice-controls [data-action="${type}"]`);if(!b)continue;
  b.classList.toggle('active',enabled);b.disabled=!joined;
  if(b.dataset.state!==String(enabled)){b.dataset.state=String(enabled);b.innerHTML=icon(type==='mic'&&!enabled?'microphone-off':type==='camera'&&!enabled?'camera-off':glyph);}
 }
 const focusButton=root.querySelector('[data-action="focus"]');if(focusButton){const label=focus?'Restaurar participantes':'Maximizar transmissão';focusButton.title=label;focusButton.setAttribute('aria-label',label);if(focusButton.dataset.state!==String(focus)){focusButton.dataset.state=String(focus);focusButton.innerHTML=icon(focus?'shrink':'expand');}}
}
function renderVoice(c){const root=$('#workspace');root.className='workspace voice-workspace';const joined=S.joinedVoice===c.id&&!!S.room;
 const people=joined?participants():[],share=joined?stageSource():null,focus=!!(share&&S.focus);
 const signature=JSON.stringify([c.id,joined,share?.person?.identity||null,voiceTrackKey(share?.track),
  people.map(p=>[p.identity,personLabel(p),voiceTrackKey(sourceTrack(p,'Camera'))])]);
 // Eventos ActiveSpeakersChanged podem chegar várias vezes por segundo.
 // Alteramos apenas classes/controles; o vídeo permanece conectado à mesma trilha.
 if(root.dataset.voiceSignature===signature&&root.querySelector('.call-layout')){
  refreshVoiceChrome(people,share,focus,joined);return;
 }
 const participantHtml=people.length?people.map((p,i)=>{const track=sourceTrack(p,'Camera'),label=personLabel(p),key=escape(p.identity||String(i));
 return `<article class="call-person-card" data-person="${key}">${track?`<video class="call-person-video ${p===S.room.localParticipant&&prefs.cameraMirror?'self-mirror':''}" data-camera="${key}" autoplay muted playsinline></video>`:`<div class="call-person-avatar">${escape(initials(label))}</div>`}<div class="call-person-info"><span class="call-person-name">${escape(label)}</span>${p===S.room.localParticipant?'':`<button type="button" class="person-volume-button" data-action="person-volume" data-id="${key}" title="Ajustar volume de ${escape(label)} somente para você" aria-label="Volume de ${escape(label)}">${icon('speaker')}</button>`}</div></article>`;}).join(''):
 '<div class="call-empty-card"><span>Conectando ao canal de voz…</span></div>';
 // Desanexar ANTES de substituir o DOM, para não abandonar elementos de vídeo antigos.
 detach();root.dataset.voiceSignature=signature;
 root.innerHTML=`<div class="call-layout ${share?'is-sharing':''}">${share?`<section class="call-broadcast"><video id="callSharedScreen" class="call-broadcast-video" autoplay muted playsinline></video><button class="broadcast-focus-toggle" data-action="focus" title="Maximizar transmissão" aria-label="Maximizar transmissão">${icon('expand')}</button><div class="broadcast-label">▣ ${escape(personLabel(share.person))} · Transmissão${share.person===S.room?.localParticipant?' <span id="screenSendStats" aria-live="off"></span>':''}</div></section>`:''}<div class="call-participants ${share?'call-participants--compact':''}">${participantHtml}</div><div class="voice-controls"><button class="voice-control" data-action="mic" aria-label="Microfone" title="Microfone" ${joined?'':'disabled'}>${icon('microphone-off')}</button><button class="voice-control" data-action="camera" aria-label="Câmera" title="Câmera" ${joined?'':'disabled'}>${icon('camera-off')}</button><button class="voice-control" data-action="share" aria-label="Transmitir tela" title="Transmitir tela" ${joined?'':'disabled'}>${icon('share')}</button></div></div>`;
 if(share)attachInto(share.track,root.querySelector('#callSharedScreen'));
 for(const p of people){const t=sourceTrack(p,'Camera');if(t){const node=Array.from(root.querySelectorAll('[data-camera]')).find(n=>n.dataset.camera===p.identity);if(node)attachInto(t,node);}}
 refreshVoiceChrome(people,share,focus,joined);
}
// Estatísticas locais de publicação (somente leitura): ajudam a distinguir CPU e rede
// sem enviar telemetria externa e sem mexer nas configurações do LiveKit Cloud.
let CONSIVO_DEBUG_ENABLED=false;
let lastScreenStats=null;
async function showScreenSendStats(){
 if(!CONSIVO_DEBUG_ENABLED)return;
 const room=S.room,track=sourceTrack(room?.localParticipant,'ScreenShare'),label=$('#screenSendStats');
 if(!room||!track||!label||typeof track.getSenderStats!=='function'){lastScreenStats=null;return;}
 try{
  const all=await track.getSenderStats();
  if(room!==S.room||track!==sourceTrack(S.room?.localParticipant,'ScreenShare')||!label.isConnected)return;
  const stats=all?.filter(s=>s&&s.type==='video').sort((a,b)=>(b.frameWidth*b.frameHeight)-(a.frameWidth*a.frameHeight))[0];
  if(!stats)return;
  const fps=Number(stats.framesPerSecond)||0,at=Number(stats.timestamp)||Date.now(),bytes=Number(stats.bytesSent);
  let speed='';if(lastScreenStats?.track===track&&Number.isFinite(bytes)&&Number.isFinite(lastScreenStats.bytes)&&at>lastScreenStats.at){
   const mbps=Math.max(0,8*(bytes-lastScreenStats.bytes)/(at-lastScreenStats.at)/1000);
   speed=` · ${mbps.toFixed(1)} Mbps`;
  }
  lastScreenStats={track,bytes,at};
  const reason=stats.qualityLimitationReason&&stats.qualityLimitationReason!=='none'?` · Limite: ${stats.qualityLimitationReason}`:'';
  label.textContent=` · Envio ${Math.round(fps)} FPS${speed}${reason}`;
 }catch{/* Alguns drivers não disponibilizam estatísticas do codificador. */}
}
setInterval(()=>void showScreenSendStats(),3000);
function renderDock(){const active=!!S.room;$('#callDock').hidden=!active;
 if(!active){$('#callDock').replaceChildren();return;}
 const p=S.room.localParticipant;$('#callDock').innerHTML=`<div class="call-state"><span class="call-indicator">◖))</span><div><strong>Conectado à chamada</strong><small>${escape(joinedChannel()?.name||'Canal de voz')}</small></div></div><div class="call-buttons"><button class="dock-button ${p.isMicrophoneEnabled?'purple':'off'}" data-action="mic" aria-label="Microfone">${icon(p.isMicrophoneEnabled?'microphone':'microphone-off')}</button><button class="dock-button ${p.isCameraEnabled?'purple':''}" data-action="camera" aria-label="Câmera">${icon(p.isCameraEnabled?'camera':'camera-off')}</button><button class="dock-button ${p.isScreenShareEnabled?'sharing':''}" data-action="share" aria-label="Transmissão">${icon('share')}</button>${window.desktop?.isWeb?'':`<button class="dock-button purple" data-action="floating" title="Janela flutuante" aria-label="Janela flutuante">${icon('floating')}</button>`}<button class="dock-button end" data-action="leave" aria-label="Sair da chamada">${icon('leave')}</button></div>`;
}
function drawMessages(root,records=[]){if(!root)return;const wasBottom=root.scrollTop+root.clientHeight>=root.scrollHeight-100;
 root.innerHTML=records.length?records.map(m=>`<div class="message ${m.author_id&&m.author_id===S.status?.userId?'own':''}" data-author-id="${escape(m.author_id)}"><span class="avatar">${escape(initials(m.author_name))}</span><div><div class="message-meta">${escape(m.author_name||'Participante')} <time>${new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div><div class="message-text">${escape(m.body)}</div></div></div>`).join(''):'<div class="chat-empty"><strong>Sem mensagens ainda</strong><p>Comece uma conversa neste canal.</p></div>';
 if(wasBottom)root.scrollTop=root.scrollHeight;
}
function renderCallChat(){const enabled=!!(S.chatOpen&&channel()?.type==='voice'&&S.joinedVoice===S.channel);
 $('.app-shell').classList.toggle('call-chat-open',enabled);if(!enabled)return;
 $('#callChatRoomName').textContent=joinedChannel()?.name||'';
 drawMessages($('#callMessages'),S.messageCache?.[S.joinedVoice]||[]);
}
function startPolling(){clearInterval(S.poll);if(S.status?.loggedIn)S.poll=setInterval(()=>void task(refreshMessages),4000);}
async function refreshMessages(){if(S.refreshing||!S.status?.loggedIn)return;S.refreshing=true;
 const active=channel()?.type==='text'?S.channel:null,chat=S.chatOpen?S.joinedVoice:null;
 try{S.messageCache ||= {};for(const id of new Set([active,chat].filter(Boolean))){const data=await api('messages',{channelId:id});S.messageCache[id]=data.reverse();}
 if(active===S.channel&&$('#textMessages'))drawMessages($('#textMessages'),S.messageCache[active]);if(chat===S.joinedVoice)renderCallChat();}
 finally{S.refreshing=false;}}
async function sendMessage(channelId,text){if(!text?.trim())return;await api('sendMessage',{channelId,text});await refreshMessages();}
async function joinVoice(c){if(!LK())throw Error('Instale as dependências e execute npm run build:media antes de iniciar.');
 await leaveVoice();S.connecting=true;renderWorkspace();
 try{const ticket=await api('livekitToken',{channelId:c.id});if(!ticket?.token||!ticket?.url)throw Error('Token de chamada não retornado.');
 const lib=LK(),room=new lib.Room({adaptiveStream:true,dynacast:true});
 setupRoom(room,lib);await room.connect(ticket.url,ticket.token);
 S.room=room;S.joinedVoice=c.id;S.focus=false;
 try{await room.startAudio();}catch{popup('Clique no Zeon para ativar a reprodução de áudio.');}
 setConnection('NA CHAMADA',true);render();popup('Conectado a '+c.name);
 }catch(err){S.room=null;S.joinedVoice=null;setConnection('ONLINE',true);throw err;}
 finally{S.connecting=false;renderWorkspace();}}
function setupRoom(room,lib){const update=()=>{if(S.room===room){renderWorkspace();renderDock();syncFloat();}};
 for(const name of ['ParticipantConnected','ParticipantDisconnected','TrackSubscribed','TrackUnsubscribed','TrackPublished','TrackUnpublished','LocalTrackPublished','LocalTrackUnpublished','TrackMuted','TrackUnmuted','ActiveSpeakersChanged']){
 const ev=lib.RoomEvent[name];if(ev)room.on(ev,update);}
 room.on(lib.RoomEvent.TrackSubscribed,(t,pub,person)=>{if(t.kind===lib.Track.Kind.Audio){const el=t.attach();el.autoplay=true;el.dataset.remoteAudio='1';el.dataset.personId=person?.identity||'';el.dataset.audioSource=pub?.source===lib.Track.Source.ScreenShareAudio?'screen-share':'microphone';if(prefs.speakerId)el.setSinkId?.(prefs.speakerId).catch?.(()=>{});$('#remoteAudio')?.append(el);applyPersonAudioLevels();}});
 room.on(lib.RoomEvent.TrackUnsubscribed,(t)=>{if(t.kind===lib.Track.Kind.Audio){try{for(const el of t.detach())el.remove();}catch{}}});
 room.on(lib.RoomEvent.Disconnected,()=>{if(S.room===room){S.room=null;S.joinedVoice=null;S.focus=false;setConnection('DESCONECTADO');render();popup('Chamada encerrada.');}});
}
async function leaveVoice(){const room=S.room;S.room=null;S.joinedVoice=null;S.focus=false;
 if(room)await room.disconnect();hidePersonVolumePanel();$('#remoteAudio').replaceChildren();detach();renderDock();syncFloat();}
async function requestPermission(kind){const r=await window.desktop.ensureMediaPermission(kind);return !!r?.granted;}
async function setMedia(kind){const room=S.room;if(!room||S.busy)return;S.busy=true;
 try{const p=room.localParticipant;
 if(kind==='mic'){if(!p.isMicrophoneEnabled&&!await requestPermission('microphone'))return;await p.setMicrophoneEnabled(!p.isMicrophoneEnabled,prefs.microphoneId?{deviceId:prefs.microphoneId}:undefined);}
 if(kind==='camera'){if(!p.isCameraEnabled&&!await requestPermission('camera'))return;
 const dim=window.ConsivoCameraQuality&&{480:[854,480],720:[1280,720],1080:[1920,1080]}[prefs.cameraResolution]||[1280,720];
 await p.setCameraEnabled(!p.isCameraEnabled,{...(prefs.cameraId?{deviceId:prefs.cameraId}:{}),resolution:{width:dim[0],height:dim[1]},frameRate:prefs.cameraFps});}
 if(kind==='share'){if(p.isScreenShareEnabled)await p.setScreenShareEnabled(false);else await openPicker();}
 }catch(err){if(/denied|notallowed|permission/i.test(String(err.message)))void window.desktop.offerWindowsMediaSettings(kind==='mic'?'microphone':'camera');throw err;}
 finally{S.busy=false;renderWorkspace();renderDock();syncFloat();}}
async function openPicker(){if(!S.room)return;
 if(window.desktop?.isWeb){
  if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Seu navegador não oferece compartilhamento de tela.');
  await S.room.localParticipant.setScreenShareEnabled(true);
  return;
 }
 S.sources=await window.desktop.listCaptureSources();S.source=null;S.sourceKind='screen';
 refreshSettingValues();renderSources();$('#capturePicker').showModal();}
function renderSources(){const sources=S.sources.filter(s=>s.type===S.sourceKind);
 $('#captureSources').innerHTML=sources.map(s=>`<button type="button" class="capture-source ${S.source?.id===s.id?'consivo-selected':''}" data-action="pick-source" data-id="${escape(s.id)}">${s.thumbnail?.startsWith('data:image/')?`<img src="${escape(s.thumbnail)}" alt="">`:''}<span>${escape(s.name)}</span></button>`).join('')||'<p class="consivo-help">Nenhuma fonte nesta categoria.</p>';
 $('#captureStartButton').disabled=!S.source;for(const opt of $('#captureResolution').options)opt.disabled=!!(S.source&&compat.shareResolutionAllowed(S.source,opt.value)===false);
 if($('#captureResolution').selectedOptions[0]?.disabled){prefs.shareResolution=compat.selectShareResolution(S.source,prefs.shareResolution);savePrefs();$('#captureResolution').value=prefs.shareResolution;}
 document.querySelectorAll('.capture-tab').forEach(b=>b.classList.toggle('active',b.dataset.type===S.sourceKind));
 $('#captureQualityStatus').textContent=S.source?`Selecionado: ${S.source.name}`:'Selecione um monitor ou janela.';
}
async function startShare(){if(!S.room||!S.source)return;
 const allowed=compat.shareResolutionAllowed(S.source,prefs.shareResolution);if(allowed===false)throw Error('A resolução selecionada é maior que a fonte. Reduza a qualidade.');
 const chosen=await window.desktop.chooseCaptureSource(S.source.id);if(!chosen)throw Error('Fonte indisponível.');
 const dim=shareQual.PROFILES[prefs.shareResolution];$('#capturePicker').close();
 // Capture FPS and encoder FPS are separate limits in LiveKit. The SDK defaults
 // to h1080fps15 for screen publishing if screenShareEncoding is omitted.
 const fps=[15,30,60].includes(Number(prefs.shareFps))?Number(prefs.shareFps):30;
 const baseBitrate=dim.height<=480?1600000:dim.height<=720?2500000:dim.height<=1080?4000000:6000000;
 const maxBitrate=Math.round(baseBitrate*(fps===60?1.5:fps===15?0.7:1));
 await S.room.localParticipant.setScreenShareEnabled(true,
  {resolution:{width:dim.width,height:dim.height,frameRate:fps},contentHint:'motion'},
  {degradationPreference:'maintain-framerate',screenShareEncoding:{maxFramerate:fps,maxBitrate}});
}
let modalKind=null;
function openModal(kind){modalKind=kind;const d=$('#modal');$('#modalInput').value='';
 const titles={group:'Criar grupo',join:'Entrar por convite','channel-text':'Novo canal de texto','channel-voice':'Novo canal de voz'};
 $('#modalTitle').textContent=titles[kind]||'Criar';$('#modalHint').textContent=kind==='join'?'Cole o código enviado por um amigo.':'O grupo e seus canais ficarão disponíveis para os membros.';
 $('#modalLabel').textContent=kind==='join'?'Código de convite':'Nome';$('#adminOnlyLine').hidden=kind!=='channel-text';
 $('#adminOnlyInput').checked=false;d.showModal();$('#modalInput').focus();}
async function submitModal(){const val=$('#modalInput').value.trim();if(!val)return;
 let newGroupId=null; if(modalKind==='group'){const created=await api('createGroup',{name:val});newGroupId=Array.isArray(created)?created[0]?.id:created?.id;}
 if(modalKind==='join')await api('joinGroup',{code:val});
 if(modalKind?.startsWith('channel-'))await api('createChannel',{groupId:S.group,name:val,type:modalKind==='channel-text'?'text':'voice',adminOnly:$('#adminOnlyInput').checked});
 $('#modal').close();if(modalKind?.startsWith('channel-'))await selectGroup(S.group,false);else{S.group=null;await loadGroups();if(newGroupId)await selectGroup(newGroupId);}}
async function refreshDevices(){const items=await navigator.mediaDevices.enumerateDevices();
 for(const [id,kind,key] of [['micSelect','audioinput','microphoneId'],['cameraSelect','videoinput','cameraId'],['speakerSelect','audiooutput','speakerId']]){
 const sel=$('#'+id);sel.innerHTML='<option value="">Padrão do Windows</option>';
 for(const d of items.filter(x=>x.kind===kind)){const op=document.createElement('option');op.value=d.deviceId;op.textContent=d.label||kind;sel.add(op);}sel.value=prefs[key]||'';}}
function refreshSettingValues(){for(const id of ['cameraResolution','cameraFps','cameraFit','shareResolution','shareFps','captureResolution','captureFps']){
 const el=$('#'+id);if(el)el.value=String(id.startsWith('capture')?prefs[id==='captureResolution'?'shareResolution':'shareFps']:prefs[id]);}
 $('#cameraMirror').checked=prefs.cameraMirror;$('#volumeRange').value=prefs.volume;$('#volumeNumber').textContent=prefs.volume+'%';
 $('#cameraQualityStatus').textContent=qual?.requestedLabel(prefs)||'';$('#shareQualityStatus').textContent=shareQual?.requestedLabel(prefs)||'';}
let preview=null,previewBorrowed=false,micPreview=null,micBorrowed=false,micCtx=null,micTimer=null;
function stopMicTest(){
 if(micTimer){clearInterval(micTimer);micTimer=null;}
 micCtx?.close?.().catch?.(()=>{});micCtx=null;
 if(!micBorrowed)micPreview?.getTracks?.().forEach(t=>t.stop());micPreview=null;micBorrowed=false;
 $('#micMeter').style.width='0%';$('#micTestButton').textContent='Iniciar teste';
}
async function testMic(){if(micPreview){stopMicTest();return;}
 const active=sourceTrack(S.room?.localParticipant,'Microphone')?.mediaStreamTrack;
 if(active?.readyState==='live'){micPreview=new MediaStream([active]);micBorrowed=true;}else{
 if(!await requestPermission('microphone'))return;
 micPreview=await navigator.mediaDevices.getUserMedia({audio:prefs.microphoneId?{deviceId:{exact:prefs.microphoneId}}:true,video:false});micBorrowed=false;}
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
 micCtx=new AC();const source=micCtx.createMediaStreamSource(micPreview),analyser=micCtx.createAnalyser();analyser.fftSize=256;source.connect(analyser);
 const samples=new Uint8Array(analyser.fftSize);$('#micTestButton').textContent='Encerrar teste';
 micTimer=setInterval(()=>{analyser.getByteTimeDomainData(samples);let energy=0;for(const v of samples)energy+=((v-128)/128)**2;
 $('#micMeter').style.width=Math.min(100,Math.sqrt(energy/samples.length)*360)+'%';},100);
}
async function testCam(){if(preview){if(!previewBorrowed)preview.getTracks().forEach(t=>t.stop());preview=null;previewBorrowed=false;$('#settingsCamera').srcObject=null;return;}
 const active=sourceTrack(S.room?.localParticipant,'Camera')?.mediaStreamTrack;
 if(active?.readyState==='live'){preview=new MediaStream([active]);previewBorrowed=true;}else{
 if(!await requestPermission('camera'))return;preview=await navigator.mediaDevices.getUserMedia(qual.constraints(prefs,prefs.cameraId));previewBorrowed=false;}
 $('#settingsCamera').srcObject=preview;$('#settingsCamera').play().catch(()=>{});$('#cameraQualityStatus').textContent=qual.actualLabel(preview.getVideoTracks()[0]);}
async function scanCamera(){if(!await requestPermission('camera'))return;
 const status=$('#cameraCompatibilityStatus');status.textContent='Testando resolução e FPS...';
 try{S.cameraModes=await compat.probeCamera(navigator.mediaDevices,prefs.cameraId,(i,n)=>{status.textContent=`Verificando ${i}/${n} modos…`;});
 for(const res of $('#cameraResolution').options)res.disabled=!S.cameraModes.some(m=>m.res===res.value);
 if($('#cameraResolution').selectedOptions[0]?.disabled){$('#cameraResolution').value=S.cameraModes[0].res;prefs.cameraResolution=S.cameraModes[0].res;savePrefs();}
 updateCameraFPS();status.textContent=`${S.cameraModes.length} combinações confirmadas neste dispositivo.`;
 }catch(e){status.textContent=e.message;}}
function updateCameraFPS(){if(!S.cameraModes)return;
 const res=$('#cameraResolution').value;for(const opt of $('#cameraFps').options)opt.disabled=!compat.isCameraMode(S.cameraModes,res,Number(opt.value));
 if($('#cameraFps').selectedOptions[0]?.disabled){$('#cameraFps').value=String(compat.allowedCameraFps(S.cameraModes,res)[0]||30);prefs.cameraFps=Number($('#cameraFps').value);savePrefs();}}
function closeSettings(){stopMicTest();if(!previewBorrowed)preview?.getTracks().forEach(t=>t.stop());preview=null;previewBorrowed=false;$('#settingsCamera').srcObject=null;$('#devicesDialog').close();}
function openSettings(){refreshSettingValues();$('#devicesDialog').showModal();void task(refreshDevices);}
function openFloating(){if(!S.room)return popup('Entre em um canal de voz para abrir a janela flutuante.');window.desktop.openFloating(joinedChannel()?.name||'Chamada');}
// Ponte de vídeo local entre a chamada online e a janela flutuante. O transporte da call continua LiveKit.
let floatingReady=false,peer=null,peerSession=0,mediaKey='';
function mediaEntries(){const entries=[];if(!S.room)return entries;
 for(const p of participants()){const t=sourceTrack(p,'Camera')?.mediaStreamTrack;
 if(t?.readyState==='live')entries.push({type:'camera:'+p.identity,track:t});}
 const share=stageSource();const t=share?.track?.mediaStreamTrack;if(t?.readyState==='live')entries.push({type:'screen',track:t});
 return entries.slice(0,16);}
function floatState(){return {joined:!!S.room,roomName:joinedChannel()?.name||'',nickname:displayName(),micOn:!!S.room?.localParticipant?.isMicrophoneEnabled,cameraOn:!!S.room?.localParticipant?.isCameraEnabled,sharing:!!stageSource(),focus:!!S.focus,people:participants().map(p=>({id:p.identity,name:personLabel(p),micOn:p.isMicrophoneEnabled,cameraOn:!!sourceTrack(p,'Camera'),speaking:!!S.room?.activeSpeakers?.some(a=>a.identity===p.identity)})),screenOwner:stageSource()?personLabel(stageSource().person):'',cameraMirror:prefs.cameraMirror,cameraFit:prefs.cameraFit};}
function stopPeer(){peerSession++;peer?.close();peer=null;}
function syncFloat(){if(!floatingReady)return;window.desktop.callBridgeSignal({type:'state',state:floatState()});void sendFloatTracks();}
function waitIce(pc){if(pc.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{const finish=()=>{pc.removeEventListener('icegatheringstatechange',done);clearTimeout(to);resolve();};const done=()=>{if(pc.iceGatheringState==='complete')finish();};pc.addEventListener('icegatheringstatechange',done);const to=setTimeout(finish,3000);done();});}
async function sendFloatTracks(){if(!floatingReady)return;const entries=mediaEntries(),key=entries.map(v=>v.type+':'+v.track.id).join('|');if(key===mediaKey)return;mediaKey=key;stopPeer();window.desktop.callBridgeSignal({type:'reset'});
 if(!entries.length)return;const current=++peerSession,pc=new RTCPeerConnection({iceServers:[]});peer=pc;const types={};
 try{for(const item of entries){const tx=pc.addTransceiver(item.track,{direction:'sendonly'});types[tx.mid||String(pc.getTransceivers().length-1)]=item.type;}
 const offer=await pc.createOffer();await pc.setLocalDescription(offer);await waitIce(pc);
 // Os mids só estão definidos de forma estável depois da oferta.
 const mids={};pc.getTransceivers().forEach((tx,i)=>{if(entries[i])mids[String(tx.mid)]=entries[i].type;});
 if(peer===pc&&floatingReady)window.desktop.callBridgeSignal({type:'offer',session:current,sdp:pc.localDescription.sdp,midTypes:mids});
 }catch{if(peer===pc){stopPeer();window.desktop.callBridgeSignal({type:'reset'});}}}
window.desktop?.onCallBridge?.(async msg=>{if(msg?.type==='ready'){floatingReady=true;mediaKey='';syncFloat();}
 if(msg?.type==='answer'&&msg.session===peerSession&&peer){try{await peer.setRemoteDescription({type:'answer',sdp:msg.sdp});}catch{}}
 if(msg?.type==='ice'&&msg.session===peerSession&&peer&&msg.candidate)try{await peer.addIceCandidate(msg.candidate);}catch{}});
window.desktop?.onFloatingClosed?.(()=>{floatingReady=false;mediaKey='';stopPeer();});
window.desktop?.onCallAction?.(a=>{if(a==='mic')void task(()=>setMedia('mic'));if(a==='camera')void task(()=>setMedia('camera'));if(a==='start-share'&&!S.room?.localParticipant?.isScreenShareEnabled)void task(()=>setMedia('share'));if(a==='stop-share'&&S.room?.localParticipant?.isScreenShareEnabled)void task(()=>setMedia('share'));if(a==='toggle-focus'&&stageSource()){S.focus=!S.focus;renderWorkspace();syncFloat();}if(a==='leave')void task(leaveVoice);});
// Volume individual: configuração de reprodução somente deste dispositivo.
// Não altera microfone, permissões, volume transmitido nem dados do Supabase.
const PERSON_AUDIO_KEY='consivo-person-volumes-v079';
let personVolumeValues={},personVolumeScope=null;
const personVolumeLastAudible=new Map();
function loadPersonVolumeValues(){
 const scope=PERSON_AUDIO_KEY+':'+String(S.status?.email||'local').toLowerCase();
 if(scope===personVolumeScope)return;
 personVolumeScope=scope;personVolumeValues={};personVolumeLastAudible.clear();
 try{const saved=JSON.parse(localStorage.getItem(scope)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))personVolumeValues=saved;}catch{}
}
let personVolumeCurrent=null,personVolumePanel=null;
function personVolumePercent(identity){
 loadPersonVolumeValues();
 const value=Number(personVolumeValues[String(identity)]);
 return Object.prototype.hasOwnProperty.call(personVolumeValues,String(identity))&&Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):100;
}
function audioOutputLevel(identity,source='microphone'){
 const master=Math.max(0,Math.min(100,Number(prefs.volume)||0))/100;
 // Som compartilhado (ScreenShareAudio) permanece no volume mestre.
 const personal=source==='screen-share'?1:personVolumePercent(identity)/100;
 return Math.max(0,Math.min(1,master*personal));
}
function applyPersonAudioLevels(){
 const container=$('#remoteAudio');if(!container)return;
 for(const el of container.querySelectorAll('audio')){
  el.volume=audioOutputLevel(el.dataset.personId||'',el.dataset.audioSource||'microphone');
 }
}
function savePersonVolume(identity,value){
 loadPersonVolumeValues();
 if(!S.room?.remoteParticipants?.has(String(identity)))return;
 const percent=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
 if(percent>0)personVolumeLastAudible.set(String(identity),percent);
 personVolumeValues[String(identity)]=percent;
 try{localStorage.setItem(personVolumeScope,JSON.stringify(personVolumeValues));}catch{}
 applyPersonAudioLevels();
 if(personVolumeCurrent===String(identity))refreshPersonVolumePanel();
}
function ensurePersonVolumePanel(){
 if(personVolumePanel)return personVolumePanel;
 const panel=document.createElement('section');panel.id='personVolumePanel';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Volume individual');
 panel.innerHTML=`<div class="person-volume-head"><strong id="personVolumeName">Participante</strong><button type="button" id="personVolumeClose" title="Fechar" aria-label="Fechar">×</button></div>
  <label for="personVolumeSlider">Volume somente para você: <output id="personVolumeAmount">100%</output></label>
  <input id="personVolumeSlider" type="range" min="0" max="100" step="1" value="100" />
  <div class="person-volume-actions"><button id="personVolumeMute" type="button">Silenciar para mim</button><button id="personVolumeReset" type="button">Restaurar 100%</button></div>
  <small>Não altera o volume que outras pessoas recebem.</small>`;
 document.body.append(panel);personVolumePanel=panel;
 panel.querySelector('#personVolumeSlider').addEventListener('input',e=>{if(personVolumeCurrent)savePersonVolume(personVolumeCurrent,e.target.value);});
 panel.querySelector('#personVolumeMute').addEventListener('click',()=>{if(!personVolumeCurrent)return;const n=personVolumePercent(personVolumeCurrent);savePersonVolume(personVolumeCurrent,n?0:(personVolumeLastAudible.get(personVolumeCurrent)||100));});
 panel.querySelector('#personVolumeReset').addEventListener('click',()=>{if(personVolumeCurrent)savePersonVolume(personVolumeCurrent,100);});
 panel.querySelector('#personVolumeClose').addEventListener('click',hidePersonVolumePanel);
 return panel;
}
function refreshPersonVolumePanel(){
 if(!personVolumePanel||!personVolumeCurrent)return;
 const person=S.room?.remoteParticipants?.get(personVolumeCurrent);if(!person){hidePersonVolumePanel();return;}
 const n=personVolumePercent(personVolumeCurrent);
 personVolumePanel.querySelector('#personVolumeName').textContent=personLabel(person);
 personVolumePanel.querySelector('#personVolumeAmount').textContent=n+'%';
 personVolumePanel.querySelector('#personVolumeSlider').value=String(n);
 personVolumePanel.querySelector('#personVolumeMute').textContent=n?'Silenciar para mim':'Reativar áudio';
}
function hidePersonVolumePanel(){if(personVolumePanel)personVolumePanel.hidden=true;personVolumeCurrent=null;}
function openPersonVolumePanel(anchor,identity){
 const person=S.room?.remoteParticipants?.get(String(identity));if(!person)return;
 personVolumeCurrent=String(identity);const panel=ensurePersonVolumePanel();panel.hidden=false;refreshPersonVolumePanel();
 const rect=anchor.getBoundingClientRect(),w=panel.offsetWidth||275,h=panel.offsetHeight||175;
 panel.style.left=Math.max(8,Math.min(window.innerWidth-w-8,rect.right-w))+'px';
 panel.style.top=Math.max(8,Math.min(window.innerHeight-h-8,rect.bottom+7))+'px';
}
document.addEventListener('pointerdown',e=>{if(personVolumePanel&&!personVolumePanel.hidden&&!personVolumePanel.contains(e.target)&&!e.target.closest('[data-action="person-volume"]'))hidePersonVolumePanel();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&personVolumePanel&&!personVolumePanel.hidden)hidePersonVolumePanel();});

// Todas as ações passam pela UI compartilhada.
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.dataset.id;
 if(a==='person-volume'){openPersonVolumePanel(b,id);return;}
 if(a==='group')void task(()=>selectGroup(id));if(a==='channel')void task(()=>selectChannel(id));
 if(a==='new-group')openModal('group');if(a==='join-group')openModal('join');if(a==='new-channel')openModal('channel-'+b.dataset.type);
 if(a==='toggle-sidebar'){S.sidebarOpen=!S.sidebarOpen;prefs.sidebarOpen=S.sidebarOpen;savePrefs();renderHeader();}
 if(a==='toggle-call-chat'){S.chatOpen=!S.chatOpen;renderHeader();renderCallChat();void task(refreshMessages);}
 if(a==='settings')openSettings();if(a==='close-devices')closeSettings();if(a==='test-mic')void task(testMic);if(a==='test-camera')void task(testCam);
 if(a==='scan-camera')void task(scanCamera);if(a==='refresh-sources')void task(async()=>{S.sources=await window.desktop.listCaptureSources();renderSources();});
 if(a==='source-filter'){S.sourceKind=b.dataset.type;S.source=null;renderSources();}
 if(a==='pick-source'){S.source=S.sources.find(x=>x.id===id)||null;renderSources();}
 if(a==='start-capture')void task(startShare);if(a==='close-capture')$('#capturePicker').close();
 if(a==='mic'||a==='camera'||a==='share')void task(()=>setMedia(a));
 if(a==='leave')void task(leaveVoice);if(a==='floating')openFloating();
 if(a==='focus'&&stageSource()){S.focus=!S.focus;renderWorkspace();syncFloat();}
 if(a==='invite-message'&&group()){void task(async()=>{try{await navigator.clipboard.writeText(group().invite_code);popup('Convite copiado.');}catch{popup('Código do convite: '+group().invite_code);}});}
});
$('#cancelModal').onclick=()=>$('#modal').close();
$('#modalForm').addEventListener('submit',e=>{e.preventDefault();void task(submitModal);});
document.addEventListener('submit',e=>{if(!['textForm','callChatForm'].includes(e.target.id))return;e.preventDefault();
 const form=e.target,voice=form.id==='callChatForm',id=voice?S.joinedVoice:S.channel;
 const input=form.querySelector('input');if(!id||!input?.value.trim())return;
 const value=input.value;input.value='';
 if(!voice){S.textDrafts ||= {};S.textDrafts[id]='';}
 void task(async()=>{try{await sendMessage(id,value);}
 catch(err){
  const current=voice?$('#callChatInput'):$('#textInput');
  const sameChannel=voice?S.joinedVoice===id:S.channel===id;
  if(current&&sameChannel){
   current.value=value+(current.value?' '+current.value:'');
   if(!voice)S.textDrafts[id]=current.value;
  }else if(!voice)S.textDrafts[id]=value;
  throw err;
 }
 });});
document.addEventListener('change',e=>{const key={micSelect:'microphoneId',cameraSelect:'cameraId',speakerSelect:'speakerId'}[e.target.id];
 if(key){prefs[key]=e.target.value;if(key==='speakerId')for(const audio of $('#remoteAudio').querySelectorAll('audio'))audio.setSinkId?.(prefs.speakerId||'default').catch?.(()=>{});if(key==='cameraId'){S.cameraModes=null;$('#cameraCompatibilityStatus').textContent='Faça nova verificação para esta câmera.';}savePrefs();return;}
 if(['cameraResolution','cameraFps','cameraFit','shareResolution','shareFps','captureResolution','captureFps'].includes(e.target.id)){
 const map={captureResolution:'shareResolution',captureFps:'shareFps'},id=map[e.target.id]||e.target.id;
 prefs[id]=id.endsWith('Fps')?Number(e.target.value):e.target.value;savePrefs();if(id==='cameraResolution')updateCameraFPS();refreshSettingValues();}
 if(e.target.id==='cameraMirror'){prefs.cameraMirror=e.target.checked;savePrefs();}
});
$('#volumeRange').addEventListener('input',e=>{prefs.volume=Number(e.target.value);savePrefs();$('#volumeNumber').textContent=prefs.volume+'%';applyPersonAudioLevels();});
$('#devicesDialog').addEventListener('close',()=>{stopMicTest();if(!previewBorrowed)preview?.getTracks().forEach(t=>t.stop());preview=null;previewBorrowed=false;});
// Consivo Desktop v0.7.7 — painel de diagnóstico APENAS no modo Debug local.
// A autorização vem do processo principal (CONSIVO_DEBUG=1 e aplicativo não empacotado).
let consivoDebugPanel=null;
let consivoDebugTimer=null;
let consivoDebugLast=null;
let consivoDebugVideo=null;
let consivoDebugVideoLast=null;
const debugNumber=(value,digits=0)=>Number.isFinite(Number(value))?Number(value).toFixed(digits):'N/D';
const debugDelta=(current,previous)=>Number.isFinite(Number(current))&&Number.isFinite(Number(previous))?Math.max(0,Number(current)-Number(previous)):null;
const debugRate=(delta,ms)=>delta!==null&&ms>0?delta*1000/ms:null;
function debugPanelText(text){const el=consivoDebugPanel?.querySelector('[data-debug-report]');if(el)el.textContent=text;}
async function debugReceiverTick(){
 if(!CONSIVO_DEBUG_ENABLED||!consivoDebugPanel||consivoDebugPanel.hidden)return;
 const state=S.room,screen=stageSource(),track=screen?.track;
 if(!state||!track){consivoDebugLast=null;consivoDebugVideoLast=null;debugPanelText('Sem transmissão de tela ativa.\nEntre numa chamada e inicie uma transmissão.');return;}
 const local=screen.person===state.localParticipant;
 const now=Date.now();
 try{
  let stat=null;
  if(local&&typeof track.getSenderStats==='function'){
   const items=await track.getSenderStats();stat=items?.filter(x=>x?.type==='video').sort((a,b)=>(b.frameWidth||0)*(b.frameHeight||0)-(a.frameWidth||0)*(a.frameHeight||0))[0];
  }else if(!local&&typeof track.getReceiverStats==='function'){
   stat=await track.getReceiverStats();
  }
  if(S.room!==state||stageSource()?.track!==track)return;
  if(!stat){consivoDebugLast=null;debugPanelText('LiveKit não disponibilizou estatísticas desta trilha.\nTipo: '+(local?'envio local':'recepção remota'));return;}
  const previous=consivoDebugLast?.track===track&&consivoDebugLast?.local===local?consivoDebugLast:null;
  const ms=previous?now-previous.at:0;
  const received=debugRate(debugDelta(stat.framesReceived,previous?.stats?.framesReceived),ms);
  const decoded=debugRate(debugDelta(stat.framesDecoded,previous?.stats?.framesDecoded),ms);
  const dropped=debugDelta(stat.framesDropped,previous?.stats?.framesDropped);
  const bytes=debugRate(debugDelta(local?stat.bytesSent:stat.bytesReceived,previous?.stats?.bytes),ms);
  const lost=debugDelta(stat.packetsLost,previous?.stats?.packetsLost);
  const packetCount=debugDelta(stat.packetsReceived,previous?.stats?.packetsReceived);
  const loss=lost!==null&&packetCount!==null&&lost+packetCount>0?100*lost/(lost+packetCount):null;
  const video=$('#callSharedScreen');
  let displayed=null;
  if(video&&video.isConnected&&typeof video.getVideoPlaybackQuality==='function'){
   const q=video.getVideoPlaybackQuality();
   if(consivoDebugVideo===video&&consivoDebugVideoLast){displayed=debugRate(debugDelta(q.totalVideoFrames,consivoDebugVideoLast.frames),now-consivoDebugVideoLast.at);}
   consivoDebugVideo=video;consivoDebugVideoLast={frames:q.totalVideoFrames,at:now};
  }else{consivoDebugVideo=null;consivoDebugVideoLast=null;}
  consivoDebugLast={track,local,at:now,stats:{...stat,bytes:local?stat.bytesSent:stat.bytesReceived}};
  const lines=[
   local?'TRILHA: envio local':'TRILHA: recepção remota',
   'Resolução: '+(stat.frameWidth&&stat.frameHeight?`${stat.frameWidth} × ${stat.frameHeight}`:'N/D'),
   local?'FPS enviado: '+debugNumber(stat.framesPerSecond,1):'FPS recebido: '+debugNumber(received,1),
   ...(!local?['FPS decodificado: '+debugNumber(decoded,1),'FPS exibido (vídeo): '+debugNumber(displayed,1),'Quadros descartados (intervalo): '+debugNumber(dropped,0),'Perda de pacotes (intervalo): '+(loss===null?'N/D':loss.toFixed(1)+'%')]:[]),
   'Bitrate medido: '+(bytes===null?'N/D':(bytes*8/1e6).toFixed(2)+' Mbps'),
   'Camada efetiva: não exposta por esta métrica',
   'Codec: '+String(stat.mimeType||'N/D'),
   'Estado: '+String(track.streamState||'ativo')
  ];
  debugPanelText(lines.join('\n'));
 }catch(err){debugPanelText('Falha ao consultar estatísticas do LiveKit.\n'+String(err?.message||err).slice(0,130));}
}
async function initConsivoDebug(){
 let permitted=false;
 try{permitted=await window.desktop?.isDebugEnabled?.();}catch{}
 if(!permitted)return;
 CONSIVO_DEBUG_ENABLED=true;
 const panel=document.createElement('aside');panel.id='consivo-debug-panel';
 panel.setAttribute('aria-label','Diagnóstico de mídia Consivo');
 panel.style.cssText='position:fixed;top:112px;right:16px;z-index:100000;max-width:360px;width:calc(100vw - 32px);padding:12px 14px;border-radius:12px;border:1px solid #8876dd;background:rgba(17,17,30,.96);box-shadow:0 10px 36px rgba(0,0,0,.45);color:#f7f7ff;font:12px/1.55 ui-monospace,Consolas,monospace;pointer-events:auto';
 panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><strong style="color:#b9a4ff;font-size:13px">CONSIVO • DEBUG</strong><button type="button" data-debug-close style="background:#38334f;color:#fff;border:0;border-radius:6px;padding:5px 9px;cursor:pointer">Ocultar</button></div><div data-debug-report style="white-space:pre-line;margin-top:8px">Aguardando transmissão...</div><small style="display:block;opacity:.7;margin-top:7px">Somente neste PC • atualização a cada 2 s • Ctrl+Shift+D</small>';
 document.body.append(panel);consivoDebugPanel=panel;
 panel.querySelector('[data-debug-close]').addEventListener('click',()=>{panel.hidden=true;});
 window.addEventListener('keydown',ev=>{if(ev.ctrlKey&&ev.shiftKey&&ev.code==='KeyD'){ev.preventDefault();panel.hidden=!panel.hidden;if(!panel.hidden)void debugReceiverTick();}});
 consivoDebugTimer=setInterval(()=>void debugReceiverTick(),2000);
 void debugReceiverTick();
}
void initConsivoDebug();

// A interface Web Mobile pode usar estas ações sem acessar o estado interno ou duplicar o backend.
window.ZeonMobileAdapter=Object.freeze({
 snapshot:()=>({
  ready:!!S.status?.loggedIn,groupId:S.group,channelId:S.channel,role:S.role,
  groups:S.groups.map(g=>({id:g.id,name:g.name})),
  channels:S.channels.map(c=>({id:c.id,name:c.name,type:c.type,adminOnly:!!c.admin_only})),
  groupName:group()?.name||'',joinedVoiceId:S.joinedVoice,
  joinedVoiceName:joinedChannel()?.name||'',inCall:!!S.room,
  displayName:displayName()
 }),
 selectGroup:id=>selectGroup(id),
 selectChannel:id=>selectChannel(id),
 newGroup:()=>openModal('group'),
 joinGroup:()=>openModal('join'),
 newChannel:type=>openModal(type==='voice'?'channel-voice':'channel-text'),
 invite:()=>$('#inviteButton').click(),
 settings:()=>openSettings(),
 signOut:()=>$('#signOutBtn').click(),
 leaveVoice:()=>leaveVoice()
});
window.addEventListener('beforeunload',()=>{clearInterval(S.poll);stopPeer();stopMicTest();void leaveVoice();});
$('#remoteAudio').replaceChildren();authGate('loading');void showAuth().catch(err=>{authGate('login');setConnection('FALHA DE CONEXÃO');popup('Não foi possível carregar a conta: '+(err?.message||'erro de rede'));});
})();
