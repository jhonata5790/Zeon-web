'use strict';
/* Consivo v0.6.2: preferências de câmera, sem ligar dispositivos automaticamente. */
(function(global){
  const RESOLUTIONS=Object.freeze({'480':[854,480],'720':[1280,720],'1080':[1920,1080]});
  const FPS=[15,30,60];
  function normalize(settings){
    const resolution=String(settings?.cameraResolution??'720');
    const requestedFps=Number(settings?.cameraFps);
    return {
      cameraResolution:Object.hasOwn(RESOLUTIONS,resolution)?resolution:'720',
      cameraFps:FPS.includes(requestedFps)?requestedFps:30,
      cameraMirror:settings?.cameraMirror!==false,
      cameraFit:settings?.cameraFit==='contain'?'contain':'cover'
    };
  }
  function constraints(settings,deviceId=''){
    const value=normalize(settings);
    const [width,height]=RESOLUTIONS[value.cameraResolution];
    return {audio:false,video:{
      ...(deviceId?{deviceId:{exact:String(deviceId)}}:{}),
      width:{ideal:width},height:{ideal:height},
      aspectRatio:{ideal:16/9},frameRate:{ideal:value.cameraFps,max:value.cameraFps}
    }};
  }
  function requestedLabel(settings){const p=normalize(settings);return `${p.cameraResolution}p · ${p.cameraFps} FPS solicitados`;}
  function actualLabel(track){
    if(!track?.getSettings)return 'Qualidade efetiva indisponível neste dispositivo.';
    const settings=track.getSettings()||{};
    const dimensions=Number.isFinite(settings.width)&&Number.isFinite(settings.height)
      ?`${settings.width} × ${settings.height}`:'Resolução não informada';
    const frames=Number.isFinite(settings.frameRate)?` · ${Number(settings.frameRate.toFixed(1))} FPS`:' · FPS não informado';
    return `Câmera ativa: ${dimensions}${frames}`;
  }
  global.ConsivoCameraQuality=Object.freeze({normalize,constraints,requestedLabel,actualLabel});
})(window);
