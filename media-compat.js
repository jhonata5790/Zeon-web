'use strict';
/* Consivo v0.6.3 — compatibilidade de mídia. Não inicia captura sozinho. */
(function(root){
  const CAMERA_SIZES=Object.freeze({
    '480':Object.freeze([[854,480],[640,480]]),
    '720':Object.freeze([[1280,720]]),
    '1080':Object.freeze([[1920,1080]])
  });
  const CAMERA_FPS=Object.freeze([15,30,60]);
  const SHARE_SIZES=Object.freeze({'480':[854,480],'720':[1280,720],'1080':[1920,1080],'1440':[2560,1440]});
  const modeKey=(res,fps)=>String(res)+':'+Number(fps);
  function isCameraMode(modes,res,fps){return Array.isArray(modes)&&modes.some(m=>m.res===String(res)&&m.fps===Number(fps));}
  function allowedCameraFps(modes,res){return CAMERA_FPS.filter(f=>isCameraMode(modes,res,f));}
  function chooseCameraMode(modes,res,fps){
    if(!modes?.length)return null;
    const best=[...modes].sort((a,b)=>{
      // Privilegiar o máximo que não supera a resolução/FPS escolhidos.
      const ra=Number(a.res),rb=Number(b.res),r=Number(res),f=Number(fps);
      const score=m=> (Number(m.res)>r?1000:0)+(m.fps>f?200:0)+Math.abs(Number(m.res)-r)/4+Math.abs(m.fps-f);
      return score(a)-score(b)||rb-ra||b.fps-a.fps;
    });
    return best[0];
  }
  function requestCameraConstraints(mode,deviceId=''){
    if(!mode)throw Error('Modo de câmera ainda não confirmado.');
    return {audio:false,video:{
      ...(deviceId?{deviceId:{exact:String(deviceId)}}:{}),
      width:{exact:mode.width},height:{exact:mode.height},
      frameRate:{min:mode.fps,ideal:mode.fps},resizeMode:'none'
    }};
  }
  // Solicita permissão somente ao clicar em Verificar; reutiliza um único track de teste.
  async function probeCamera(media,deviceId='',onProgress=()=>{},cancelled=()=>false){
    if(!media?.getUserMedia)throw Error('Captura de câmera indisponível.');
    const stream=await media.getUserMedia({audio:false,video:deviceId?{deviceId:{exact:String(deviceId)}}:true});
    try{
      const track=stream.getVideoTracks?.()[0];
      if(!track?.applyConstraints||!track?.getSettings)throw Error('O driver não permite verificar as combinações.');
      const modes=[];let checked=0;
      for(const [res,sizes] of Object.entries(CAMERA_SIZES)){
        for(const fps of CAMERA_FPS){
          if(cancelled())throw Error('Verificação cancelada.');
          let found=null;
          for(const [width,height] of sizes){
            try{
              await track.applyConstraints({width:{exact:width},height:{exact:height},frameRate:{min:fps,ideal:fps},resizeMode:'none'});
              if(cancelled())throw Error('Verificação cancelada.');
              const actual=track.getSettings();
              if(actual.width===width&&actual.height===height&&Number(actual.frameRate)>=fps-0.6){
                found={res,fps,width,height};break;
              }
            }catch(error){if(cancelled())throw Error('Verificação cancelada.');}
          }
          if(found)modes.push(found);
          onProgress(++checked,9);
        }
      }
      if(!modes.length)throw Error('Nenhuma combinação foi confirmada. Confira o driver ou as permissões.');
      return modes;
    }finally{stream.getTracks?.().forEach(t=>t.stop());}
  }
  function shareResolutionAllowed(source,res){
    if(!source||!(source.pixelWidth>0&&source.pixelHeight>0))return null;
    const [w,h]=SHARE_SIZES[String(res)]||[Infinity,Infinity];
    // Uma captura não consegue criar detalhes acima da resolução real da fonte.
    return w<=source.pixelWidth&&h<=source.pixelHeight;
  }
  function selectShareResolution(source,res){
    const wanted=String(res);
    if(shareResolutionAllowed(source,wanted)!==false)return wanted;
    const possible=Object.keys(SHARE_SIZES).filter(k=>shareResolutionAllowed(source,k));
    return possible.at(-1)||'480'; // fontes pequenas continuam com captura reduzida, sem alegar HD nativo.
  }
  function shareFpsCapability(track){
    try{
      const max=Number(track?.getCapabilities?.()?.frameRate?.max);
      return max>0?max:null;
    }catch{return null;}
  }
  const api=Object.freeze({CAMERA_SIZES,CAMERA_FPS,SHARE_SIZES,modeKey,isCameraMode,allowedCameraFps,chooseCameraMode,requestCameraConstraints,probeCamera,shareResolutionAllowed,selectShareResolution,shareFpsCapability});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ConsivoMediaCompat=api;
})(typeof window!=='undefined'?window:null);
