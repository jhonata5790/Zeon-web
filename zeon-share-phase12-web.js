'use strict';
/* Zeon Share Engine 1.2 Web/mobile — pure, local viewer frame diagnostics.
 * Classification is a hypothesis about what to inspect, never proof.
 */
(function(root,factory){
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ZeonViewerPhase12=api;
})(typeof window!=='undefined'?window:null,function(){
 const n=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
 function analyze(latest,history=[],changes=[]){
  const r=latest||{},f=n(r.displayedFps),d=n(r.droppedFps),
   rx=n(r.receivedFps),decoded=n(r.decodedFps),dropR=n(r.receiverDroppedFps);
  const dropPct=f!==null&&d!==null&&f+d>0?+(100*d/(f+d)).toFixed(1):null;
  const first720=changes.find(e=>n(e.width)>=1280&&n(e.height)>=720)?.second??null;
  let code='waiting',message='Aguardando estatísticas do espectador P2P.';
  if(r.status==='ready'){
   code='monitoring';message='Sem causa comprovada nesta amostra; compare emissão e recepção.';
   if(r.hidden){code='background';message='A aba está em segundo plano. O navegador pode reduzir FPS e suspender a renderização.';}
   else if(n(r.lossPct)!==null&&r.lossPct>3){code='network-loss';message='Perda de pacotes elevada. Investigue a rede.';}
   else if(dropR!==null&&dropR>=3){code='receiver-drop';message='O receptor WebRTC descartou quadros. Investigue buffer, decodificação e pressão de CPU.';}
   else if(dropPct!==null&&dropPct>20&&d>=3){code='playback-drop';message='O navegador descartou muitos quadros de reprodução. Investigue carga gráfica, vídeo em segundo plano e captura recursiva do Zeon.';}
   else if(decoded!==null&&rx!==null&&rx>=10&&decoded<rx*.75){code='decode-behind';message='Quadros chegam mais rápido do que são decodificados. Investigue decodificação.';}
   else if(n(r.decodeMs)!==null&&decoded!==null&&decoded>0&&r.decodeMs>700/decoded){code='decode-pressure';message='Decodificação exige parte elevada do tempo por quadro; investigue o processador de vídeo.';}
   else if(n(r.bufferMs)!==null&&r.bufferMs>100){code='buffer';message='O buffer de reprodução está elevado; investigue instabilidade e jitter.';}
   else if(n(r.width)!==null&&r.width<=640&&n(r.second)!==null&&r.second<=20){code='resolution-ramp';message='A transmissão ainda está em baixa resolução; observe quando sobe para 720p.';}
  }
  return {code,message,playbackDroppedPct:dropPct,
   receiverDroppedFps:dropR,first720pSecond:first720,
   resolutions:changes.slice(-18).map(x=>({second:x.second,width:x.width,height:x.height})),
   samples:history.length};
 }
 return Object.freeze({analyze});
});