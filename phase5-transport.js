'use strict';
/* Phase 5: conservative screen-video ceiling supervisor. WebRTC retains GCC,
 * pacing, retransmissions and ICE. Never interpret static content as congestion. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.ZeonTransportEngine=api;})(typeof window!=='undefined'?window:null,function(){
 const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function sample(report,previous){
  const all=[...report.values()],out=all.find(r=>r.type==='outbound-rtp'&&(r.kind||r.mediaType)==='video'&&!r.isRemote);
  if(!out)return null;
  const remote=report.get(out.remoteId),transport=report.get(out.transportId),pair=report.get(transport?.selectedCandidatePairId)||all.find(r=>r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded');
  const dt=previous&&previous.id===out.id?(out.timestamp-previous.timestamp)/1000:0;
  const same=dt>0&&dt<=8;
  const delta=(a,b)=>same&&finite(a)&&finite(b)&&a>=b?a-b:null;
  const sent=delta(out.packetsSent,previous?.packetsSent),lost=remote?.id===previous?.remoteId?delta(remote?.packetsLost,previous?.packetsLost):null;
  const packets=delta(out.packetsSent,previous?.packetsSent),delay=delta(out.totalPacketSendDelay,previous?.totalPacketSendDelay);
  return {id:out.id,timestamp:out.timestamp,packetsSent:out.packetsSent,totalPacketSendDelay:out.totalPacketSendDelay,remoteId:remote?.id,packetsLost:remote?.packetsLost,
   active:sent!==null&&sent>=10,rtt:finite(pair?.currentRoundTripTime)?pair.currentRoundTripTime*1000:finite(remote?.roundTripTime)?remote.roundTripTime*1000:null,
   available:finite(pair?.availableOutgoingBitrate)?pair.availableOutgoingBitrate:null,loss:sent>=20&&lost!==null?Math.min(1,lost/sent):null,
   queue:packets>0&&delay!==null?delay/packets*1000:null,limited:out.qualityLimitationReason==='bandwidth'};
 }
 function policy(base){
  let cap=base,good=0,bad=0,minRtt=null,lastChange=-Infinity,reason='normal';const floor=Math.min(base,Math.max(250000,Math.round(base*.20)));
  function observe(s,now){
   if(!s?.active){good=bad=0;return null;}
   if(finite(s.rtt))minRtt=minRtt===null?s.rtt:Math.min(minRtt,s.rtt);
   const rttPressure=finite(s.rtt)&&minRtt!==null&&s.rtt>=100&&s.rtt-minRtt>=65;
   const queuePressure=finite(s.queue)&&s.queue>=35;
   const lossPressure=finite(s.loss)&&s.loss>=.035;
   const capacityPressure=finite(s.available)&&s.available<cap*.85;
   const pressure=lossPressure||queuePressure||rttPressure||(s.limited&&capacityPressure);
   const healthy=finite(s.rtt)&&!rttPressure&&!queuePressure&&finite(s.available)&&s.available>=cap*1.35&&(s.loss===null||s.loss<.01)&&!s.limited;
   bad=pressure?bad+1:0;good=healthy?good+1:0;
   if(bad>=3&&now-lastChange>=6000&&cap>floor){const budget=finite(s.available)?s.available*.75:cap*.75;return {cap:clamp(Math.round(Math.min(cap*.80,budget)/1000)*1000,floor,cap),reason:'pressure'};}
   if(good>=5&&now-lastChange>=10000&&cap<base)return {cap:Math.min(base,Math.round(cap*1.15/1000)*1000),reason:'recovery'};
   return null;
  }
  function commit(d,now){cap=d.cap;reason=d.reason;lastChange=now;good=bad=0;}
  function reset(){good=bad=0;minRtt=null;}
  return {observe,commit,reset,status:()=>({base,cap,floor,reason,good,bad,minRtt})};
 }
 function create({sender,base,apply,valid,ready,now=()=>performance.now(),schedule=setTimeout,unschedule=clearTimeout}){
  const p=policy(base);let previous=null,timer=null,canceled=false,busy=false,last=null,status='waiting',changes=0,failures=0;
  const live=()=>!canceled&&valid();
  const arm=()=>{if(live()&&timer===null)timer=schedule(()=>{timer=null;void tick();},2000);};
  async function tick(){if(!live()||busy)return;busy=true;let watchdog;
   try{if(!ready()){previous=null;p.reset();status='waiting';return;}
    const report=await Promise.race([sender.getStats(),new Promise(resolve=>{watchdog=schedule(()=>resolve(null),900);})]);
    if(!live()||!ready())return;if(!report){previous=null;p.reset();status='stats-timeout';return;}
    const s=sample(report,previous);previous=s;if(!s){p.reset();status='no-screen-stats';return;}
    last={rttMs:s.rtt,availableBitrate:s.available,loss:s.loss,sendDelayMs:s.queue,active:s.active,bandwidthLimited:s.limited};status='monitoring';
    const d=p.observe(s,now());if(d&&d.cap!==p.status().cap){const result=await apply(d.cap,()=>live()&&ready());if(!live())return;if(result?.status==='applied'){p.commit(d,now());changes++;status=d.reason;}else{p.reset();failures++;status=result?.status||'rejected';}}
   }catch{previous=null;p.reset();status='stats-error';}finally{if(watchdog!==undefined)unschedule(watchdog);busy=false;arm();}
  }
  function cancel(){canceled=true;if(timer!==null)unschedule(timer);timer=null;status='canceled';}
  arm();return {cancel,status:()=>({...p.status(),status,changes,failures,last})};
 }
 return Object.freeze({sample,policy,create});
});
