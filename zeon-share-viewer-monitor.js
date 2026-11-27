'use strict';
/* Zeon Share Engine 1.1 — Web + Web Mobile reception laboratory.
 * Local-only WebRTC metrics; exported report excludes names, identities,
 * network addresses, media and credentials. No transport modifications.
 */
(function(root){
 const n=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
 const change=(a,b)=>n(a)!==null&&n(b)!==null&&a>=b?a-b:null;
 const avg=x=>x.length?x.reduce((sum,v)=>sum+v,0)/x.length:null;
 const fmt=(v,s='',p=1)=>n(v)===null?'N/D':v.toFixed(p)+s;
 let room=null,track=null,identity=null,video=null,viewer=false;
 let t0=0,old=null,last=null,history=[],startupRows=[],working=false,version=0,modal=null,notice='';
 function restart(){t0=Date.now();old=null;last=null;history=[];startupRows=[];version++;notice='';}
 function refreshContext(){
  const x=root.ZeonViewerMonitorContext?.()||{};
  const watching=!!x.room&&!!x.share&&x.share.person!==x.room.localParticipant;
  const nextTrack=x.share?.track?.mediaStreamTrack||x.share?.track||null;
  const nextIdentity=watching?x.share.person?.identity||null:null;
  if(room!==x.room||track!==nextTrack||identity!==nextIdentity||viewer!==watching){
   room=x.room||null;track=nextTrack;identity=nextIdentity;viewer=watching;restart();
  }
  video=x.video||null;
 }
 function button(){
  const dock=document.querySelector('#callDock:not([hidden]) .call-buttons');
  if(!dock||dock.querySelector('[data-zw-monitor]'))return;
  const b=document.createElement('button');b.type='button';b.className='dock-button';
  b.setAttribute('aria-label','Monitoramento da transmissão');b.title='Monitoramento da transmissão';
  b.dataset.zwMonitor='1';
  b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>';
  b.addEventListener('click',open);dock.append(b);
 }
 function playback(){
  try{const q=video?.getVideoPlaybackQuality?.();
   return {shown:n(q?.totalVideoFrames),dropped:n(q?.droppedVideoFrames)};
  }catch{return {shown:null,dropped:null};}
 }
 async function sample(){
  refreshContext();button();
  if(!viewer||!room||!identity||working){if(modal&&!modal.hidden)render();return;}
  working=true;const epoch=version,r=room,p=identity,t=track;
  try{
   const h=await r.receptionHealth(p,'screen_share');
   if(version!==epoch||room!==r||identity!==p||track!==t)return;
   if(!h){last={status:'waiting'};return;}
   const at=Date.now(),dt=old?at-old.at:0,q=playback();
   const bytes=n(h.bytesReceived),decoded=n(h.framesDecoded),received=n(h.framesReceived);
   const packets=n(h.packetsReceived),lost=n(h.packetsLost);
   const b=change(bytes,old?.bytes),df=change(decoded,old?.decoded);
   const bf=change(n(h.jitterBufferDelay),old?.buffer),ef=change(n(h.jitterBufferEmittedCount),old?.emitted);
   const dc=change(n(h.totalDecodeTime),old?.decode),lp=change(lost,old?.lost),rp=change(packets,old?.packets);
   const perSecond=(a,b)=>dt>0&&change(a,b)!==null?1000*change(a,b)/dt:null;
   const seconds=+((at-t0)/1000).toFixed(1);
   const row={second:seconds,status:h.trackState==='live'?'ready':'waiting',
    bitrateMbps:b!==null&&dt>0?+(8*b/dt/1000).toFixed(3):null,
    receivedFps:perSecond(received,old?.received),decodedFps:perSecond(decoded,old?.decoded),
    displayedFps:perSecond(q.shown,old?.shown),droppedFps:perSecond(q.dropped,old?.dropped),
    width:n(h.frameWidth)??n(video?.videoWidth),height:n(h.frameHeight)??n(video?.videoHeight),
    lossPct:lp!==null&&rp!==null&&lp+rp>0?100*lp/(lp+rp):null,
    jitterMs:n(h.jitter)===null?null:1000*h.jitter,
    bufferMs:bf!==null&&ef>0?1000*bf/ef:null,
    decodeMs:dc!==null&&df>0?1000*dc/df:null,
    playing:!!(video?.videoWidth&&video?.readyState>=2&&!video?.paused),
    connection:['new','connecting','connected','disconnected','failed','closed'].includes(h.connection)?h.connection:'unknown'};
   old={at,bytes,decoded,received,packets,lost,shown:q.shown,dropped:q.dropped,
    buffer:n(h.jitterBufferDelay),emitted:n(h.jitterBufferEmittedCount),decode:n(h.totalDecodeTime)};
   last=row;history.push(row);if(history.length>100)history.shift();
   if(seconds<=30.5)startupRows.push(row);
  }catch(e){last={status:'unavailable'};console.warn('[Zeon diagnóstico de recepção]',e?.message||e);}
  finally{working=false;if(modal&&!modal.hidden)render();}
 }
 function startup(){
  const early=startupRows.filter(x=>x.second<=6&&n(x.bitrateMbps)>0);
  const late=startupRows.filter(x=>x.second>=20&&n(x.bitrateMbps)>0);
  const a=avg(early.map(x=>x.bitrateMbps)),b=avg(late.map(x=>x.bitrateMbps));
  const done=viewer&&Date.now()-t0>=30000;
  let stable=null;
  if(done&&late.length>=3&&startupRows.length>=6&&b!==null){
   for(let i=0;i<=startupRows.length-3;i++)
    if(startupRows.slice(i,i+3).every(x=>n(x.bitrateMbps)!==null&&x.bitrateMbps>=b*.8)){
     stable=startupRows[i].second;break;
    }
  }
  return {status:!viewer?'unavailable':done?'complete':'collecting',
   elapsedSeconds:viewer?+Math.min(30,(Date.now()-t0)/1000).toFixed(1):0,
   samples:startupRows.length,initialMbps:a,finalMbps:b,
   bitrateGain:a>0&&b!==null?b/a:null,
   firstFps:avg(startupRows.filter(x=>x.second<=6&&n(x.decodedFps)!==null).map(x=>x.decodedFps)),
   finalFps:avg(startupRows.filter(x=>x.second>=20&&n(x.decodedFps)!==null).map(x=>x.decodedFps)),
   stableAfterSeconds:stable};
 }
 function report(){return JSON.stringify({product:'Zeon Share Engine',
  format:'phase11-web-receiver-1.0',capturedAt:new Date().toISOString(),
  role:viewer?'viewer':'unavailable',startup:startup(),latest:last,samples:history,
  note:'Medições locais do espectador P2P. Estabilização é proxy por bitrate, não nitidez medida. Não mede atraso ponta a ponta. N/D não significa zero. Sem IPs, nomes, identidades, tokens ou mídia.'},null,2);}
 function setup(){
  if(modal?.isConnected)return;
  modal=document.createElement('div');modal.className='zw-viewer-monitor';modal.hidden=true;
  modal.innerHTML='<section class="zw-viewer-sheet" role="dialog" aria-modal="true" aria-label="Monitoramento da transmissão">'+
   '<header><div><small>ZEON SHARE ENGINE · WEB E MOBILE</small><h2>Monitoramento da transmissão</h2></div><button type="button" data-monitor="close" aria-label="Fechar">×</button></header>'+
   '<p id="zw-v-status"></p><div id="zw-v-grid" class="zw-viewer-grid"></div><p id="zw-v-extra"></p>'+
   '<section class="zw-viewer-startup"><h3>Fase 1.1 · Primeiros 30 segundos</h3><p id="zw-v-progress"></p><div id="zw-v-start-grid" class="zw-viewer-grid"></div></section>'+
   '<p class="zw-viewer-note">Dados do espectador. Estabilização ≠ nitidez percebida; RTT ≠ atraso ponta a ponta.</p>'+
   '<footer><span id="zw-v-copy-status" role="status"></span><button type="button" data-monitor="copy">Copiar relatório Fase 1.1</button></footer></section>';
  document.body.append(modal);
  modal.addEventListener('click',e=>{
   const action=e.target.closest('[data-monitor]')?.dataset.monitor;
   if(action==='close'||e.target===modal)modal.hidden=true;
   else if(action==='copy')void copy();
  });
 }
 function label(id,value){const x=modal.querySelector('#'+id);if(x)x.textContent=value;}
 function grid(id,items){
  const host=modal.querySelector('#'+id);host.replaceChildren();
  for(const [name,value] of items){
   const card=document.createElement('div'),a=document.createElement('small'),b=document.createElement('strong');
   a.textContent=name;b.textContent=value;card.append(a,b);host.append(card);
  }
 }
 function render(){
  if(!modal||modal.hidden)return;
  const r=last,s=startup();
  label('zw-v-status',!room?'Entre em uma chamada para monitorar uma transmissão.':
   !viewer?'Este painel mede quem ASSISTE. Abra a transmissão de outra sessão.':
   r?.status==='ready'?(r.playing?'Vídeo P2P reproduzindo.':'Recebendo trilha P2P · aguardando reprodução.'):
   'Aguardando estatísticas da transmissão.');
  grid('zw-v-grid',[
   ['Bitrate recebido',fmt(r?.bitrateMbps,' Mbps',2)],['FPS recebido',fmt(r?.receivedFps,' FPS')],
   ['FPS decodificado',fmt(r?.decodedFps,' FPS')],['FPS exibido',fmt(r?.displayedFps,' FPS')]]);
  label('zw-v-extra','Resolução: '+(n(r?.width)!==null&&n(r?.height)!==null?r.width+' × '+r.height:'N/D')+
   ' · Perda: '+fmt(r?.lossPct,' %',2)+' · Jitter: '+fmt(r?.jitterMs,' ms')+
   ' · Buffer: '+fmt(r?.bufferMs,' ms')+' · Decodificação: '+fmt(r?.decodeMs,' ms'));
  label('zw-v-progress',s.status==='complete'?'30 segundos coletados.':
   s.status==='collecting'?'Coletando automaticamente: '+fmt(s.elapsedSeconds,' / 30 s'):'Aguardando espectador.');
  grid('zw-v-start-grid',[
   ['Bitrate inicial',fmt(s.initialMbps,' Mbps',2)],['Bitrate final',fmt(s.finalMbps,' Mbps',2)],
   ['Evolução',fmt(s.bitrateGain,'×',2)],['FPS inicial → final',fmt(s.firstFps,'')+' → '+fmt(s.finalFps,'')],
   ['Estabilização estimada',fmt(s.stableAfterSeconds,' s')]]);
  label('zw-v-copy-status',notice);
 }
 function open(){setup();modal.hidden=false;render();}
 async function copy(){
  try{await navigator.clipboard.writeText(report());notice='Relatório copiado!';}
  catch{
   const field=document.createElement('textarea');field.value=report();
   modal.querySelector('.zw-viewer-sheet').append(field);field.select();
   try{notice=document.execCommand('copy')?'Relatório copiado!':'Selecione o texto para copiar manualmente.';}
   catch{notice='Selecione o texto para copiar manualmente.';}
   if(notice==='Relatório copiado!')field.remove();
  }
  render();
 }
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)modal.hidden=true;});
 setInterval(()=>void sample(),2000);
 root.ZeonShareViewerMonitor=Object.freeze({open,report,summary:startup,sample});
})(window);
