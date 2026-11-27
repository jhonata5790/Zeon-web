'use strict';
/* Zeon Direct Call 0.9: WebRTC media mesh and private Supabase Realtime signaling.
 * Compatible with Zeon Desktop 0.9: zeon:voice:<uuid>; sources in fixed SDP order.
 */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ZeonDirectCall=api;})(typeof window!=='undefined'?window:null,function(){
const Source=Object.freeze({Microphone:'microphone',Camera:'camera',ScreenShare:'screen_share',ScreenShareAudio:'screen_share_audio'});
const sources=[Source.Microphone,Source.Camera,Source.ScreenShare,Source.ScreenShareAudio],kinds=['audio','video','video','audio'];
const RoomEvent=Object.freeze({ParticipantConnected:'ParticipantConnected',ParticipantDisconnected:'ParticipantDisconnected',TrackSubscribed:'TrackSubscribed',TrackUnsubscribed:'TrackUnsubscribed',TrackPublished:'TrackPublished',TrackUnpublished:'TrackUnpublished',LocalTrackPublished:'LocalTrackPublished',LocalTrackUnpublished:'LocalTrackUnpublished',TrackMuted:'TrackMuted',TrackUnmuted:'TrackUnmuted',ActiveSpeakersChanged:'ActiveSpeakersChanged',Disconnected:'Disconnected'});
const Track={Kind:{Audio:'audio',Video:'video'},Source};
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function publication(media,source,senders){
 const attached=new Set();
 const track={kind:media.kind,mediaStreamTrack:media,attach(el){
  const node=el||document.createElement(media.kind==='audio'?'audio':'video');node.autoplay=true;node.playsInline=true;node.srcObject=new MediaStream([media]);attached.add(node);return node;
 },detach(el){const selected=el?[el]:[...attached];for(const n of selected){if(n.srcObject)n.srcObject=null;attached.delete(n);}return selected;},
 async getSenderStats(){const output=[];for(const sender of senders?.()||[])try{(await sender.getStats()).forEach(v=>{if(v.type==='outbound-rtp'&&!v.isRemote)output.push({...v,type:v.kind||media.kind});});}catch{}return output;}};
 return {source,track,videoTrack:media.kind==='video'?track:null,audioTrack:media.kind==='audio'?track:null,isMuted:false,isSubscribed:true};
}
class Room{
 constructor(){this.localParticipant=null;this.remoteParticipants=new Map();this.activeSpeakers=[];this.listeners=new Map();this.peers=new Map();this.media=new Map();this.connected=false;this.closed=true;this.socket=null;this.counter=0;this.joinRef=null;this.timer=null;this.tokenTimer=null;this.id=null;this.topic=null;}
 on(ev,cb){if(!this.listeners.has(ev))this.listeners.set(ev,new Set());this.listeners.get(ev).add(cb);return this;}
 off(ev,cb){this.listeners.get(ev)?.delete(cb);return this;}
 emit(ev,...args){for(const f of [...(this.listeners.get(ev)||[])])try{f(...args);}catch(e){console.error('[Zeon Direct]',e);}}
 send(event,payload,topic=this.topic){if(this.socket?.readyState!==1)return false;this.socket.send(JSON.stringify({topic,event,payload,ref:String(++this.counter),join_ref:topic===this.topic?this.joinRef:null}));return true;}
 signal(value){if(!this.closed&&this.connected)this.send('broadcast',{type:'broadcast',event:'signal',payload:{...value,from:this.id}});}
 local(identity,name){
  const p={identity,name,trackPublications:new Map(),getTrackPublication(s){return this.trackPublications.get(s)||null;},isMicrophoneEnabled:false,isCameraEnabled:false,isScreenShareEnabled:false,
   setMicrophoneEnabled:async(on,opt)=>{
    if(!on)return this.remove(Source.Microphone);
    if(p.isMicrophoneEnabled)return;
    const stream=await navigator.mediaDevices.getUserMedia({audio:opt?.deviceId?{deviceId:{ideal:opt.deviceId}}:true,video:false});
    try{await this.publish(Source.Microphone,stream.getAudioTracks()[0]);}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
   },
   setCameraEnabled:async(on,opt)=>{
    if(!on)return this.remove(Source.Camera);
    if(p.isCameraEnabled)return;
    const vid={};if(opt?.deviceId)vid.deviceId={ideal:opt.deviceId};if(opt?.resolution){vid.width={ideal:opt.resolution.width};vid.height={ideal:opt.resolution.height};}if(opt?.frameRate)vid.frameRate={ideal:opt.frameRate};
    const stream=await navigator.mediaDevices.getUserMedia({video:Object.keys(vid).length?vid:true,audio:false});
    try{await this.publish(Source.Camera,stream.getVideoTracks()[0]);}catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
   },
   setScreenShareEnabled:async(on,capture={},encoding={})=>{
    if(!on){await this.remove(Source.ScreenShareAudio);await this.remove(Source.ScreenShare);return;}
    if(p.isScreenShareEnabled)return;
    const res=capture?.resolution||{},video={};
    if(res.width)video.width={ideal:res.width};if(res.height)video.height={ideal:res.height};if(res.frameRate)video.frameRate=res.frameRate;
    const stream=await navigator.mediaDevices.getDisplayMedia({video,audio:!!capture.audio});
    try{const v=stream.getVideoTracks()[0];if(!v)throw Error('Nenhuma tela foi selecionada.');
      await this.publish(Source.ScreenShare,v);
      const audio=stream.getAudioTracks()[0];if(audio)await this.publish(Source.ScreenShareAudio,audio);
      v.addEventListener('ended',()=>{if(p.getTrackPublication(Source.ScreenShare)?.track.mediaStreamTrack===v)void p.setScreenShareEnabled(false);},{once:true});
    }catch(e){stream.getTracks().forEach(t=>t.stop());await p.setScreenShareEnabled(false);throw e;}
   },
   publishTrack:async(t,opt={})=>this.publish(opt.source|| (t.kind==='audio'?Source.Microphone:Source.Camera),t),
   unpublishTrack:async(t,stop=true)=>{for(const [s,pub] of p.trackPublications)if(pub.track.mediaStreamTrack===t){await this.remove(s,stop);break;}}
  };
  return p;
 }
 async publish(source,media){
  if(!media||!sources.includes(source)||media.readyState!=='live')throw Error('Trilha de mídia P2P indisponível.');
  await this.remove(source);if(this.closed)throw Error('Chamada encerrada.');
  this.media.set(source,media);
  const pub=publication(media,source,()=>[...this.peers.values()].map(p=>p.transceivers[sources.indexOf(source)]?.sender).filter(Boolean));
  this.localParticipant.trackPublications.set(source,pub);this.flags();
  media.addEventListener?.('ended',()=>{if(this.media.get(source)===media)void this.remove(source);},{once:true});
  const result=await Promise.all([...this.peers.values()].map(async peer=>{
   try{const sender=peer.transceivers[sources.indexOf(source)]?.sender;if(sender)await sender.replaceTrack(media);return {ok:true};}
   catch(error){console.warn('[Zeon Direct] Falha ao enviar '+source,error);return {ok:false,error};}
  }));
  const failed=result.filter(x=>!x.ok);
  if(failed.length){this.emit('NetworkIssue',new Error('Falha ao enviar '+source+' para '+failed.length+' participante(s).'));
   if(failed.length===result.length){this.media.delete(source);this.localParticipant.trackPublications.delete(source);this.flags();throw Error('Falha ao publicar '+source+': '+(failed[0].error?.message||'erro WebRTC'));}
  }
  this.signal({type:'state',sources:[...this.media.keys()]});this.emit(RoomEvent.LocalTrackPublished,pub,this.localParticipant);return pub;
 }
 async remove(source,stop=true){
  const pub=this.localParticipant?.trackPublications.get(source);if(!pub)return;
  this.localParticipant.trackPublications.delete(source);this.media.delete(source);this.flags();
  await Promise.all([...this.peers.values()].map(p=>p.transceivers[sources.indexOf(source)]?.sender?.replaceTrack(null).catch(()=>{})));
  if(stop)try{pub.track.mediaStreamTrack.stop();}catch{}
  this.signal({type:'state',sources:[...this.media.keys()]});this.emit(RoomEvent.LocalTrackUnpublished,pub,this.localParticipant);
 }
 flags(){const p=this.localParticipant;p.isMicrophoneEnabled=this.media.has(Source.Microphone);p.isCameraEnabled=this.media.has(Source.Camera);p.isScreenShareEnabled=this.media.has(Source.ScreenShare);}
 async connect(info){
  if(!info||!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(info.url||'')||!UUID.test(info.channelId||'')||!UUID.test(info.userId||'')||!info.key||!info.accessToken)throw Error('Dados P2P inválidos.');
  if(!this.closed)throw Error('Chamada já iniciada.');
  this.closed=false;this.info=info;this.id=crypto.randomUUID();this.topic='realtime:zeon:voice:'+info.channelId;this.localParticipant=this.local(info.userId,info.name||'Você');
  const url=info.url.replace(/^https:/,'wss:')+'/realtime/v1/websocket?vsn=1.0.0&apikey='+encodeURIComponent(info.key);
  return new Promise((resolve,reject)=>{
   let settled=false;const timer=setTimeout(()=>finish(Error('Tempo limite na sinalização do Supabase.')),15000);
   const finish=(e)=>{if(settled)return;settled=true;clearTimeout(timer);if(e){reject(e);void this.disconnect();}else resolve();};
   try{this.socket=new WebSocket(url);}catch(e){finish(e);return;}
   this.socket.onopen=()=>{
    this.joinRef=String(this.counter+1);
    this.send('phx_join',{access_token:info.accessToken,config:{broadcast:{ack:false,self:false},presence:{enabled:true,key:this.id},postgres_changes:[],private:true}});
    this.timer=setInterval(()=>this.send('heartbeat',{},'phoenix'),20000);
    this.tokenTimer=setInterval(async()=>{if(this.closed||!info.refresh)return;try{const next=await info.refresh();if(next?.accessToken)this.send('access_token',{access_token:next.accessToken});}catch{}},8*60*1000);
   };
   this.socket.onmessage=e=>{
    let msg;try{msg=JSON.parse(e.data);}catch{return;}if(msg.topic!==this.topic)return;
    if(msg.event==='phx_reply'&&msg.ref===this.joinRef){
     if(msg.payload?.status!=='ok'){finish(Error('Supabase recusou a entrada na sala P2P. Verifique as permissões do grupo.'));return;}
     this.connected=true;this.send('presence',{type:'presence',event:'track',payload:{deviceId:this.id,userId:info.userId,name:info.name||'Participante'}});finish();return;
    }
    if(!this.connected)return;
    if(msg.event==='presence_state')this.presence(msg.payload);
    else if(msg.event==='presence_diff')this.diff(msg.payload);
    else if(msg.event==='broadcast'&&msg.payload?.event==='signal')void this.handle(msg.payload.payload);
    else if(msg.event==='phx_close'||msg.event==='phx_error')this.fail();
   };
   this.socket.onerror=()=>{if(!settled)finish(Error('Falha ao conectar ao Supabase Realtime.'));};
   this.socket.onclose=()=>{if(!settled)finish(Error('Sinalização fechada.'));else if(!this.closed)this.fail();};
  });
 }
 presence(data){
  const all=new Map();
  for(const value of Object.values(data||{}))for(const m of value.metas||[])if(m.deviceId&&UUID.test(m.deviceId)&&UUID.test(m.userId)&&m.deviceId!==this.id)all.set(m.deviceId,m);
  for(const id of [...this.peers.keys()])if(!all.has(id))this.drop(id);
  for(const [id,m] of all)if(!this.peers.has(id))this.add(m);
 }
 diff(data){for(const v of Object.values(data?.leaves||{}))for(const m of v.metas||[])if(m.deviceId)this.drop(m.deviceId);
  for(const v of Object.values(data?.joins||{}))for(const m of v.metas||[])if(m.deviceId&&m.deviceId!==this.id&&!this.peers.has(m.deviceId))this.add(m);}
 add(meta){
  if(this.closed||!UUID.test(meta?.deviceId||'')||!UUID.test(meta?.userId||'')||meta.deviceId===this.id||this.peers.has(meta.deviceId)||this.peers.size>=4)return;
  const user={identity:meta.userId+':'+meta.deviceId,name:meta.name||'Participante',trackPublications:new Map(),getTrackPublication(s){return this.trackPublications.get(s)||null;}};
  this.remoteParticipants.set(user.identity,user);this.emit(RoomEvent.ParticipantConnected,user);
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  const peer={id:meta.deviceId,user,pc,transceivers:[],pendingTrackEvents:[],media:new Map(),flags:new Set(),pending:[],candidates:[],offered:false};this.peers.set(peer.id,peer);
  // The offerer allocates slots; Chromium creates the answerer's transceivers from SDP.
  if(this.id<peer.id)peer.transceivers=sources.map((source,i)=>{const t=pc.addTransceiver(kinds[i],{direction:'sendrecv'});const local=this.media.get(source);if(local)void t.sender.replaceTrack(local).catch(()=>{});return t;});
  pc.onicecandidate=e=>{if(!e.candidate)return;const ice=e.candidate.toJSON?.()||e.candidate;if(peer.candidates.length<48)peer.candidates.push(ice);this.signal({to:peer.id,type:'ice',candidate:ice});};
  pc.ontrack=e=>{
   const index=peer.transceivers.findIndex(t=>t===e.transceiver||(e.transceiver?.mid!=null&&t.mid===e.transceiver.mid)||(e.receiver&&t.receiver===e.receiver));if(index<0){peer.pendingTrackEvents.push(e);return;}
   const source=sources[index];peer.media.set(source,e.track);this.sync(peer);
   e.track.addEventListener?.('unmute',()=>this.sync(peer));e.track.addEventListener?.('ended',()=>{if(peer.media.get(source)===e.track){peer.media.delete(source);this.sync(peer);}});
  };
  pc.onconnectionstatechange=()=>{this.emit('NetworkStatus',user,pc.connectionState,pc.iceConnectionState);if(pc.connectionState==='failed')this.emit('NetworkIssue',Error('Conexão direta indisponível: esta rede pode precisar de TURN.'));};
   pc.oniceconnectionstatechange=()=>this.emit('NetworkStatus',user,pc.connectionState,pc.iceConnectionState);
  if(this.id<peer.id)void this.offer(peer);
 }
 async offer(peer){if(peer.offered||this.closed)return;peer.offered=true;
  try{await peer.pc.setLocalDescription(await peer.pc.createOffer());
   const retry=(attempt=0)=>{
    if(this.closed||!this.peers.has(peer.id)||peer.pc.remoteDescription)return;
    this.signal({to:peer.id,type:'offer',sdp:peer.pc.localDescription});
    if(attempt<5)setTimeout(()=>retry(attempt+1),1500*(attempt+1));
   };retry();
  }catch(e){this.emit('NetworkIssue',e);}}
 async handle(data){
  if(this.closed||!data||data.to&&data.to!==this.id||data.from===this.id)return;
  const peer=this.peers.get(data.from);if(!peer)return;
  try{
   if(data.type==='offer'&&data.sdp?.type==='offer'){
    await peer.pc.setRemoteDescription(data.sdp);
    const negotiated=peer.pc.getTransceivers();
    if(negotiated.length<sources.length)throw Error('SDP remoto incompleto.');
    peer.transceivers=negotiated.slice(0,sources.length);
    for(let i=0;i<sources.length;i++){
     const t=peer.transceivers[i];
     if(t.receiver.track.kind!==kinds[i])throw Error('Ordem de trilhas incompatível.');
     t.direction='sendrecv';
     const track=this.media.get(sources[i]);if(track)await t.sender.replaceTrack(track);
    }
    for(const e of peer.pendingTrackEvents.splice(0))peer.pc.ontrack?.(e);
    await this.flush(peer);await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    this.signal({to:peer.id,type:'answer',sdp:peer.pc.localDescription});this.resendCandidates(peer);this.stateTo(peer);
   }
   else if(data.type==='answer'&&data.sdp?.type==='answer'){await peer.pc.setRemoteDescription(data.sdp);await this.flush(peer);this.resendCandidates(peer);this.stateTo(peer);}
   else if(data.type==='ice'&&data.candidate){if(!peer.pc.remoteDescription)peer.pending.push(data.candidate);else await peer.pc.addIceCandidate(data.candidate);}
   else if(data.type==='state'&&Array.isArray(data.sources)){peer.flags=new Set(data.sources.filter(s=>sources.includes(s)));this.sync(peer);}
  }catch(e){console.warn('[Zeon Direct] Negociação:',e?.message);this.emit('NetworkIssue',e);}
 }
 stateTo(peer){this.signal({to:peer.id,type:'state',sources:[...this.media.keys()]});}
  resendCandidates(peer){for(const ice of peer.candidates)this.signal({to:peer.id,type:'ice',candidate:ice});}
  async senderHealth(source=Source.ScreenShare){
   const peers=[];
   for(const peer of this.peers.values()){
    const sender=peer.transceivers[sources.indexOf(source)]?.sender;
    const o={name:peer.user.name,connection:peer.pc.connectionState,track:sender?.track?.readyState||'missing',framesEncoded:null,bytesSent:null};
    try{(await sender?.getStats())?.forEach(v=>{if(v.type==='outbound-rtp'&&(v.kind||v.mediaType)==='video'){o.framesEncoded=v.framesEncoded??null;o.bytesSent=v.bytesSent??null;}});}catch{}
    peers.push(o);
   }
   return {trackState:this.media.get(source)?.readyState||'missing',peers};
  }
  async receptionHealth(identity,source=Source.ScreenShare){
   const peer=[...this.peers.values()].find(p=>p.user.identity===identity);if(!peer)return null;
   const tr=peer.transceivers[sources.indexOf(source)],media=peer.media.get(source)||tr?.receiver.track;
   const h={connection:peer.pc.connectionState||'unknown',ice:peer.pc.iceConnectionState||'unknown',trackState:media?.readyState||'missing',muted:!!media?.muted,announced:peer.flags.has(source),framesDecoded:null,bytesReceived:null,packetsReceived:null};
   try{
    const reports=await (typeof tr?.receiver?.getStats==='function'?tr.receiver.getStats():peer.pc.getStats());
    let inbound;reports.forEach(v=>{if(v.type==='inbound-rtp'&&!v.isRemote&&(v.kind||v.mediaType)==='video'&&(!inbound||v.mid===tr?.mid||v.trackIdentifier===media?.id))inbound=v;});
    if(inbound){h.framesDecoded=inbound.framesDecoded??null;h.bytesReceived=inbound.bytesReceived??null;h.packetsReceived=inbound.packetsReceived??null;
    h.framesReceived=inbound.framesReceived??null;h.packetsLost=inbound.packetsLost??null;
    h.frameWidth=inbound.frameWidth??null;h.frameHeight=inbound.frameHeight??null;
    h.jitter=inbound.jitter??null;h.jitterBufferDelay=inbound.jitterBufferDelay??null;
    h.jitterBufferEmittedCount=inbound.jitterBufferEmittedCount??null;
    h.totalDecodeTime=inbound.totalDecodeTime??null;
    h.framesDropped=inbound.framesDropped??null;h.freezeCount=inbound.freezeCount??null;
    h.totalFreezesDuration=inbound.totalFreezesDuration??null;}
   }catch{}
   return h;
  }
 async flush(peer){for(const c of peer.pending.splice(0))try{await peer.pc.addIceCandidate(c);}catch{}}
 sync(peer){
  for(const source of sources){
   const media=peer.media.get(source)||peer.transceivers[sources.indexOf(source)]?.receiver.track;
   const old=peer.user.trackPublications.get(source);
   const active=peer.flags.has(source)&&media?.readyState==='live';
   if(!active){if(old){peer.user.trackPublications.delete(source);this.emit(RoomEvent.TrackUnsubscribed,old.track,old,peer.user);this.emit(RoomEvent.TrackUnpublished,old,peer.user);}continue;}
   if(old?.track.mediaStreamTrack===media)continue;
   if(old){peer.user.trackPublications.delete(source);this.emit(RoomEvent.TrackUnsubscribed,old.track,old,peer.user);}
   const pub=publication(media,source);peer.user.trackPublications.set(source,pub);
   this.emit(RoomEvent.TrackPublished,pub,peer.user);this.emit(RoomEvent.TrackSubscribed,pub.track,pub,peer.user);
  }
 }
 drop(id){const peer=this.peers.get(id);if(!peer)return;this.peers.delete(id);
  for(const pub of peer.user.trackPublications.values())this.emit(RoomEvent.TrackUnsubscribed,pub.track,pub,peer.user);
  try{peer.pc.close();}catch{}this.remoteParticipants.delete(peer.user.identity);this.emit(RoomEvent.ParticipantDisconnected,peer.user);}
 async startAudio(){for(const el of document.querySelectorAll('#remoteAudio audio'))try{await el.play();}catch{}}
 fail(){if(!this.closed){console.warn('[Zeon Direct] Sinalização interrompida.');void this.disconnect();}}
 async disconnect(){if(this.closed)return;this.closed=true;this.connected=false;clearInterval(this.timer);clearInterval(this.tokenTimer);
  if(this.socket?.readyState===1){try{this.send('presence',{type:'presence',event:'untrack',payload:{}});this.send('phx_leave',{});}catch{}}
  try{this.socket?.close();}catch{}for(const id of [...this.peers.keys()])this.drop(id);
  for(const source of [...this.media.keys()])await this.remove(source);this.emit(RoomEvent.Disconnected);
 }
}
return Object.freeze({Room,RoomEvent,Track,mode:'p2p-supabase',sources});
});