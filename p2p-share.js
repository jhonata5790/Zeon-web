'use strict';
/* Zeon Direct Share 0.5: WebRTC screen/audio P2P with LiveKit data signaling.
 * Compatible with Zeon Windows' zeon.direct-share.v1 protocol.
 */
(function(root,factory){
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ZeonP2PShare=api;
})(typeof window!=='undefined'?window:null,function(){
 const TOPIC='zeon.direct-share.v1',MAX_PACKET=12000;
 const trackViews=new WeakMap();
 function viewTrack(track){
  if(trackViews.has(track))return trackViews.get(track);
  const v={mediaStreamTrack:track,
   attach(el){el.srcObject=new MediaStream([track]);return el;},
   detach(el){if(el){el.pause?.();el.srcObject=null;}return el?[el]:[];}};
  trackViews.set(track,v);return v;
 }
 function create({room,lib,selfId,onChange=()=>{},onRemote=()=>{},onError=()=>{},rtcFactory,iceServers=[{urls:'stun:stun.l.google.com:19302'}]}={}){
  if(!room?.localParticipant?.publishData||!lib?.RoomEvent?.DataReceived||!selfId)throw Error('Chamada P2P indisponível.');
  const PC=rtcFactory||globalThis.RTCPeerConnection;
  if(!PC)throw Error('WebRTC indisponível.');
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const supported=new Set(),outgoing=new Map(),incoming=new Map(),earlyIce=new Map();
  let local=null,settings={},disposed=false;
  const peers=()=>[...room.remoteParticipants.values()].map(p=>p.identity).filter(Boolean);
  function notify(){if(!disposed)onChange({sharing:!!local,peers:supported.size,connected:[...outgoing.values()].filter(e=>e.pc.connectionState==='connected').length,participants:peers().length});}
  async function signal(to,body){
   if(disposed||!peers().includes(to))return;
   const bytes=encoder.encode(JSON.stringify({v:1,...body}));
   if(bytes.byteLength>MAX_PACKET)throw Error('Negociação P2P muito grande.');
   await room.localParticipant.publishData(bytes,{reliable:true,topic:TOPIC,destinationIdentities:[to]});
  }
  function send(to,msg){void signal(to,msg).catch(e=>{if(!disposed)onError(e);});}
  function disposeEntry(e){
   if(!e)return;clearTimeout(e.timeout);
   try{e.pc.ontrack=null;e.pc.onicecandidate=null;e.pc.onconnectionstatechange=null;e.pc.close();}catch{}
  }
  function removeOutgoing(to,signalEnd=true){
   const e=outgoing.get(to);if(!e)return;outgoing.delete(to);disposeEntry(e);
   if(signalEnd)send(to,{type:'end',session:e.session});notify();
  }
  function removeIncoming(from){
   const e=incoming.get(from);if(!e)return;incoming.delete(from);disposeEntry(e);
   onRemote(from,null);notify();
  }
  function entry(to,session,role){
   const pc=new PC({iceServers});
   const e={pc,session,pending:[],stream:typeof MediaStream==='function'?new MediaStream():null};
   pc.onicecandidate=ev=>{if(ev.candidate)send(to,{type:'ice',session,role,candidate:ev.candidate.toJSON?.()||ev.candidate});};
   pc.onconnectionstatechange=()=>{
    if(disposed)return;
    if(pc.connectionState==='connected')clearTimeout(e.timeout);
    if(['failed','closed'].includes(pc.connectionState)){
     if(role==='sender'&&outgoing.get(to)===e)removeOutgoing(to);
     if(role==='viewer'&&incoming.get(to)===e)removeIncoming(to);
    }
    notify();
   };
   return e;
  }
  async function candidate(e,c){
   if(!e||!c)return;
   if(!e.pc.remoteDescription){e.pending.push(c);return;}
   try{await e.pc.addIceCandidate(c);}catch(err){onError(err);}
  }
  async function flush(e){for(const c of e.pending.splice(0))await candidate(e,c);}
  async function offer(to){
   if(disposed||!local||!supported.has(to)||!peers().includes(to)||outgoing.has(to))return;
   const session=crypto.randomUUID(),e=entry(to,session,'sender');outgoing.set(to,e);
   try{
    for(const track of local.getTracks()){
     if(track.readyState!=='live')continue;
     const sender=e.pc.addTrack(track,local);
     if(track.kind==='video'){
      const pars=sender.getParameters?.()||{};
      if(pars.encodings?.length){
       pars.degradationPreference='maintain-framerate';
       if(Number.isFinite(settings.maxBitrate))pars.encodings[0].maxBitrate=settings.maxBitrate;
       if(Number.isFinite(settings.maxFramerate))pars.encodings[0].maxFramerate=settings.maxFramerate;
       try{await sender.setParameters(pars);}catch{}
      }
     }
    }
    await e.pc.setLocalDescription(await e.pc.createOffer());
    if(outgoing.get(to)===e)await signal(to,{type:'offer',session,sdp:e.pc.localDescription});
    e.timeout=setTimeout(()=>{if(!disposed&&outgoing.get(to)===e&&e.pc.connectionState!=='connected')onError(new Error('Conexão direta não estabelecida. Volte para LK.'));},12000);
   }catch(err){removeOutgoing(to);onError(err);}
  }
  async function acceptOffer(from,msg){
   if(typeof msg.session!=='string'||!msg.sdp||typeof msg.sdp.sdp!=='string'||msg.sdp.sdp.length>16000)return;
   removeIncoming(from);
   const e=entry(from,msg.session,'viewer');incoming.set(from,e);
   e.pending.push(...(earlyIce.get(from+':'+msg.session)||[]));earlyIce.delete(from+':'+msg.session);
   e.pc.ontrack=ev=>{
    if(disposed||incoming.get(from)!==e||!e.stream)return;
    if(!e.stream.getTracks().includes(ev.track))e.stream.addTrack(ev.track);
    ev.track.addEventListener?.('ended',()=>{if(incoming.get(from)===e){e.stream.removeTrack(ev.track);onRemote(from,e.stream);}});
    onRemote(from,e.stream);
   };
   try{
    await e.pc.setRemoteDescription(msg.sdp);await flush(e);
    await e.pc.setLocalDescription(await e.pc.createAnswer());
    if(incoming.get(from)===e)await signal(from,{type:'answer',session:msg.session,sdp:e.pc.localDescription});
   }catch(err){removeIncoming(from);onError(err);}
  }
  async function receive(bytes,person,kind,topic){
   if(disposed||topic!==TOPIC||!person?.identity||person.identity===selfId)return;
   const from=person.identity;if(!peers().includes(from))return;
   let msg;try{if(bytes.byteLength>MAX_PACKET)return;msg=JSON.parse(decoder.decode(bytes));}catch{return;}
   if(msg?.v!==1||typeof msg.type!=='string')return;
   if(msg.type==='hello'||msg.type==='hello-ack'){
    supported.add(from);if(msg.type==='hello')send(from,{type:'hello-ack'});
    if(local)void offer(from);notify();return;
   }
   if(msg.type==='offer'){supported.add(from);await acceptOffer(from,msg);notify();return;}
   if(msg.type==='answer'){
    const e=outgoing.get(from);if(!e||e.session!==msg.session||!msg.sdp)return;
    try{await e.pc.setRemoteDescription(msg.sdp);await flush(e);}catch(err){removeOutgoing(from);onError(err);}return;
   }
   if(msg.type==='ice'){
    const e=msg.role==='sender'?incoming.get(from):outgoing.get(from);
    if(e?.session===msg.session)await candidate(e,msg.candidate);
    else if(msg.role==='sender'&&typeof msg.session==='string'&&msg.session.length<100&&msg.candidate){
     const key=from+':'+msg.session,items=earlyIce.get(key)||[];
     if(items.length<16){items.push(msg.candidate);earlyIce.set(key,items);}
    }
    return;
   }
   if(msg.type==='end'&&incoming.get(from)?.session===msg.session)removeIncoming(from);
  }
  function sendHello(){for(const id of peers())send(id,{type:'hello'});}
  function joined(p){if(p?.identity)send(p.identity,{type:'hello'});notify();}
  function left(p){
   const id=p?.identity;if(!id)return;
   supported.delete(id);removeOutgoing(id,false);removeIncoming(id);
   for(const key of earlyIce.keys())if(key.startsWith(id+':'))earlyIce.delete(key);
   notify();
  }
  room.on(lib.RoomEvent.DataReceived,receive);
  room.on(lib.RoomEvent.ParticipantConnected,joined);
  room.on(lib.RoomEvent.ParticipantDisconnected,left);
  const heartbeat=setInterval(sendHello,8000);sendHello();
  async function startSharing(stream,videoSettings={}){
   if(disposed)throw Error('A chamada já foi encerrada.');
   if(!stream?.getVideoTracks?.().some(t=>t.readyState==='live'))throw Error('Nenhum vídeo foi autorizado.');
   stopSharing();local=stream;
   settings={maxBitrate:Math.max(350000,Math.min(8000000,Number(videoSettings.maxBitrate)||4000000)),
    maxFramerate:Math.max(10,Math.min(60,Number(videoSettings.maxFramerate)||30))};
   for(const t of stream.getTracks())t.addEventListener?.('ended',()=>{if(local===stream&&t.kind==='video')stopSharing();},{once:true});
   for(const id of supported)void offer(id);
   sendHello();notify();return true;
  }
  function stopSharing(){
   const prev=local;local=null;
   for(const id of [...outgoing.keys()])removeOutgoing(id);
   for(const t of prev?.getTracks?.()||[])try{t.stop();}catch{}
   notify();
  }
  function getStage(){
   const localVideo=local?.getVideoTracks?.()[0];
   if(localVideo)return {ownerId:selfId,track:viewTrack(localVideo),stream:local,local:true};
   for(const [ownerId,e] of incoming){
    const v=e.stream?.getVideoTracks?.()[0];
    if(v?.readyState==='live')return {ownerId,track:viewTrack(v),stream:e.stream,local:false,pc:e.pc};
   }
   return null;
  }
  async function receiverStats(){
   const e=[...incoming.values()].find(x=>x.stream?.getVideoTracks?.().length&&x.pc.connectionState==='connected');
   if(!e)return null;
   const stats=await e.pc.getStats();let inbound=null,pair=null;
   stats.forEach(v=>{if(v.type==='inbound-rtp'&&v.kind==='video'&&!v.isRemote)inbound=v;
    if(v.type==='candidate-pair'&&v.state==='succeeded'&&v.nominated)pair=v;});
   if(!inbound)return null;
   return {framesPerSecond:inbound.framesPerSecond??null,
    bufferMs:inbound.jitterBufferEmittedCount>0?1000*inbound.jitterBufferDelay/inbound.jitterBufferEmittedCount:null,
    rttMs:Number.isFinite(pair?.currentRoundTripTime)?pair.currentRoundTripTime*1000:null,
    framesDropped:inbound.framesDropped??null};
  }
  function close(){
   if(disposed)return;stopSharing();disposed=true;clearInterval(heartbeat);
   room.off(lib.RoomEvent.DataReceived,receive);room.off(lib.RoomEvent.ParticipantConnected,joined);room.off(lib.RoomEvent.ParticipantDisconnected,left);
   for(const id of [...incoming.keys()])removeIncoming(id);
   for(const id of [...outgoing.keys()])removeOutgoing(id,false);
   supported.clear();earlyIce.clear();
  }
  return Object.freeze({startSharing,stopSharing,getStage,receiverStats,close,sendHello,
   isSharing:()=>!!local,hasSupport:()=>supported.size>0,peerCount:()=>supported.size,
   connectedCount:()=>[...outgoing.values()].filter(e=>e.pc.connectionState==='connected').length,TOPIC});
 }
 return Object.freeze({create,TOPIC});
});
