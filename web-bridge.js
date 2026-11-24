'use strict';
/* Zeon Web Beta — adaptador de navegador para a API já usada pelo aplicativo Electron.
 * Somente a chave PÚBLICA é distribuída; jamais use service_role/secret aqui.
 */
(() => {
  const CONFIG_KEY='zeon-web-public-config-v1';
  const SESSION_KEY='zeon-web-session-v1';
  const uidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const clean=(s,max=100)=>String(s||'').trim().slice(0,max);
  const uuid=s=>uidPattern.test(String(s||''));
  let config=null,session=null,refreshPromise=null;

  function validateConfig(raw) {
    const url=String(raw?.url||'').trim().replace(/\/+$/,'');
    const key=String(raw?.key||'').trim();
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw Error('Informe a URL HTTPS do seu projeto Supabase.');
    if(!/^sb_publishable_[a-z0-9_-]+$/i.test(key)&&!/^[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(key))throw Error('Use somente a chave pública (publishable ou anon).');
    return {url,key};
  }
  function loadSaved(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
  function saveSession(next){session=next;try{if(next)localStorage.setItem(SESSION_KEY,JSON.stringify(next));else localStorage.removeItem(SESSION_KEY);}catch{}}
  const ready=(async()=>{
    try{const raw=loadSaved(CONFIG_KEY);if(raw)config=validateConfig(raw);}catch{}
    if(!config){
      try{const response=await fetch('./zeon-public-config.json',{cache:'no-store'});
        if(response.ok)config=validateConfig(await response.json());
      }catch{}
    }
    try{const raw=loadSaved(SESSION_KEY);if(raw?.access_token&&raw?.refresh_token)session=raw;}catch{}
  })();

  async function request(route,{method='GET',body=null,authorize=false,headers={},rawBody=null,timeout=15000}={}) {
    if(!config)throw Error('Configure o projeto Supabase para continuar.');
    if(authorize)await ensureSession();
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);
    try {
      const response=await fetch(config.url+route,{
        method,mode:'cors',signal:ctl.signal,
        headers:{apikey:config.key,...(rawBody===null?{'Content-Type':'application/json'}:{}),
          ...(authorize?{Authorization:'Bearer '+session.access_token}:{}),...headers},
        body:rawBody??(body===null?undefined:JSON.stringify(body))
      });
      const text=await response.text();let data;
      try{data=text?JSON.parse(text):null;}catch{data=text;}
      if(!response.ok){
        if(response.status===401&&authorize)throw Error('Sessão inválida ou expirada. Entre novamente.');
        throw Error(String(data?.message||data?.msg||data?.error_description||data?.error||'HTTP '+response.status).slice(0,250));
      }
      return data;
    } catch(error){
      if(error?.name==='AbortError')throw Error('A conexão demorou demais. Tente novamente.');
      if(error instanceof TypeError)throw Error('Falha de rede/CORS. Verifique a conexão e as configurações do Supabase.');
      throw error;
    } finally {clearTimeout(timer);}
  }
  async function ensureSession() {
    if(!session?.refresh_token)throw Error('Faça login para continuar.');
    if(session.access_token&&session.expires_at>Date.now()+60000)return;
    if(!refreshPromise){
      refreshPromise=(async()=>{
        try {
          const data=await request('/auth/v1/token?grant_type=refresh_token',{
            method:'POST',body:{refresh_token:session.refresh_token}
          });
          if(!data?.access_token)throw Error('Sua sessão expirou. Entre novamente.');
          saveSession({...session,access_token:data.access_token,
            refresh_token:data.refresh_token||session.refresh_token,
            expires_at:Date.now()+(data.expires_in||3600)*1000,user:data.user||session.user});
        }catch(err){saveSession(null);throw err;}
      })().finally(()=>{refreshPromise=null;});
    }
    return refreshPromise;
  }
  function publicSession(){return {loggedIn:!!session?.access_token,configured:!!config,
    email:session?.user?.email||'',userId:session?.user?.id||'',persistent:true};}
  function mediaBase(){return config.url+'/storage/v1/object/public/consivo-profile-media/';}
  function requireUUID(value,label='Identificador') {if(!uuid(value))throw Error(label+' inválido.');return value;}
  function validateProfile(data,uid){
    const handle=String(data.handle||'').trim().toLowerCase(),display_name=clean(data.display_name,32),bio=String(data.bio||'').trim();
    const accent_color=String(data.accent_color||'#9066E7'),secondary_color=String(data.secondary_color||'#353267');
    const effect=String(data.effect||'none'),effect_intensity=Number(data.effect_intensity??35);
    const avatar_frame=String(data.avatar_frame||'none'),avatar_decoration=String(data.avatar_decoration||'none');
    if(!/^[a-z0-9_]{3,24}$/.test(handle))throw Error('O @ deve ter entre 3 e 24 caracteres.');
    if(display_name.length<2)throw Error('Nome deve ter pelo menos 2 caracteres.');
    if(bio.length>180)throw Error('Biografia: até 180 caracteres.');
    if(!/^#[0-9a-f]{6}$/i.test(accent_color)||!/^#[0-9a-f]{6}$/i.test(secondary_color))throw Error('Cor inválida.');
    if(!['none','glow','embers','stars','fog','glitch','particles','aurora'].includes(effect))throw Error('Efeito inválido.');
    if(!Number.isInteger(effect_intensity)||effect_intensity<0||effect_intensity>100)throw Error('Intensidade inválida.');
    if(!['none','lilac','gold','ice'].includes(avatar_frame)||!['none','sparkle','orbit'].includes(avatar_decoration))throw Error('Decoração inválida.');
    const mediaPath=(v,kind)=>{
      if(v==null)return null;
      const path=String(v);
      const match=new RegExp('^'+uid+'/'+kind+'-[a-z0-9-]+\\.(png|jpg|jpeg|webp|gif)$');
      if(!match.test(path))throw Error('Caminho de imagem inválido.');
      return path;
    };
    const profile_cards=Array.isArray(data.profile_cards)?data.profile_cards:[];
    if(profile_cards.length>16)throw Error('Máximo de 16 cards.');
    const seenIds=new Set(),singletons=new Set();
    const cards=profile_cards.map(raw=>{
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Card inválido.');
      const type=String(raw.type||''),id=type==='note'?String(raw.id||''):type;
      if(!['bio','badges','joined','interests','note'].includes(type)||!/^[a-zA-Z0-9_-]{2,60}$/.test(id)||seenIds.has(id))throw Error('Card inválido.');
      if(type!=='note'&&singletons.has(type))throw Error('Card duplicado.');
      seenIds.add(id);if(type!=='note')singletons.add(type);
      const title=type==='note'?String(raw.title||''):'';
      const body=['note','interests'].includes(type)?String(raw.body||''):'';
      const tint=type==='note'?String(raw.color||'#3B3054'):'#3B3054';
      if(title.length>60||body.length>(type==='note'?1200:160)||!/^#[0-9a-f]{6}$/i.test(tint))throw Error('Conteúdo do card inválido.');
      return {id,type,title,body,color:tint,visible:raw.visible!==false};
    });
    if(new TextEncoder().encode(JSON.stringify(cards)).length>19000)throw Error('Perfil excede o tamanho permitido.');
    return {id:uid,handle,display_name,bio,accent_color,secondary_color,effect,effect_intensity,avatar_frame,avatar_decoration,
      avatar_path:mediaPath(data.avatar_path,'avatar'),banner_path:mediaPath(data.banner_path,'banner'),profile_cards:cards,updated_at:new Date().toISOString()};
  }
  async function uploadProfileImage(args){
    await ensureSession();
    const kind=['avatar','banner'].includes(args.kind)?args.kind:null;
    const mime=String(args.mime||''),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[mime];
    const b64=String(args.base64||'');
    if(!kind||!ext||!b64||b64.length>11200000||!/^[a-z0-9+/]+={0,2}$/i.test(b64))throw Error('Imagem inválida.');
    const raw=atob(b64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    if(bytes.length===0||bytes.length>(kind==='avatar'?4194304:8388608))throw Error('Imagem muito grande.');
    const png=bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]);
    const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const gif=String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/);
    const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!({'image/png':png,'image/jpeg':jpg,'image/gif':!!gif,'image/webp':webp}[mime]))throw Error('Tipo real da imagem não corresponde ao formato.');
    const path=session.user.id+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
    await request('/storage/v1/object/consivo-profile-media/'+path,{method:'POST',authorize:true,
      rawBody:bytes,headers:{'Content-Type':mime,'cache-control':'3600','x-upsert':'false'},timeout:25000});
    return {path};
  }
  async function invoke(command,arg={}) {
    if(window.ZeonDMApi?.supports(command))return window.ZeonDMApi.run(command,arg,{request,session:{ensure:ensureSession,userId:()=>session?.user?.id}});
    await ready;
    if(command==='status'){
      if(session?.refresh_token){try{await ensureSession();}catch{}}
      return publicSession();
    }
    if(command==='configure'){
      config=validateConfig(arg);localStorage.setItem(CONFIG_KEY,JSON.stringify(config));saveSession(null);return publicSession();
    }
    if(command==='signIn'||command==='signUp'){
      const email=clean(arg.email,254),password=String(arg.password||'');
      if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128)throw Error('Informe email válido e senha de 8 a 128 caracteres.');
      const data=await request(command==='signIn'?'/auth/v1/token?grant_type=password':'/auth/v1/signup',{method:'POST',body:{email,password}});
      if(data?.access_token)saveSession({access_token:data.access_token,refresh_token:data.refresh_token,
        expires_at:Date.now()+(data.expires_in||3600)*1000,user:data.user});
      return {pendingConfirmation:!data?.access_token,...publicSession()};
    }
    if(command==='signOut'){
      if(session?.access_token)try{await request('/auth/v1/logout',{method:'POST',authorize:true});}catch{}
      saveSession(null);return publicSession();
    }
    if(command==='groups')return request('/rest/v1/groups?select=id,name,invite_code,owner_id&order=created_at.asc',{authorize:true});
    if(command==='createGroup'){
      await ensureSession();const name=clean(arg.name,48);if(!name)throw Error('Escreva um nome para o grupo.');
      return request('/rest/v1/groups?select=id,name,invite_code,owner_id',{method:'POST',authorize:true,
        body:{name,owner_id:session.user.id},headers:{Prefer:'return=representation'}});
    }
    if(command==='joinGroup'){
      const code=clean(arg.code,64).toLowerCase();if(!/^[a-f0-9]{16,32}$/.test(code))throw Error('Código de convite inválido.');
      return request('/rest/v1/rpc/join_group_by_code',{method:'POST',authorize:true,body:{invite_code_text:code}});
    }
    if(command==='memberRole'){
      await ensureSession();const gid=requireUUID(arg.groupId,'Grupo');
      const rows=await request('/rest/v1/group_members?select=role&group_id=eq.'+encodeURIComponent(gid)+'&user_id=eq.'+encodeURIComponent(session.user.id),{authorize:true});
      return rows?.[0]?.role||null;
    }
    if(command==='channels'){
      const gid=requireUUID(arg.groupId,'Grupo');return request('/rest/v1/channels?select=id,group_id,name,type,admin_only&group_id=eq.'+encodeURIComponent(gid)+'&order=created_at.asc',{authorize:true});
    }
    if(command==='createChannel'){
      const gid=requireUUID(arg.groupId,'Grupo'),name=clean(arg.name,48),type=arg.type==='voice'?'voice':'text';
      if(!name)throw Error('Escreva um nome para o canal.');
      return request('/rest/v1/channels?select=id,group_id,name,type,admin_only,main',{method:'POST',authorize:true,
        body:{group_id:gid,name,type,admin_only:type==='text'&&!!arg.adminOnly,main:false},headers:{Prefer:'return=representation'}});
    }
    if(command==='messages'){
      const id=requireUUID(arg.channelId,'Canal');
      return request('/rest/v1/messages?select=id,channel_id,author_id,author_name,body,created_at&channel_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=100',{authorize:true});
    }
    if(command==='sendMessage'){
      await ensureSession();const id=requireUUID(arg.channelId,'Canal'),body=clean(arg.text,700);
      if(!body)throw Error('Digite uma mensagem.');
      return request('/rest/v1/messages',{method:'POST',authorize:true,
        body:{channel_id:id,author_id:session.user.id,author_name:clean(session.user?.email?.split('@')[0]||'Participante',30),body},
        headers:{Prefer:'return=minimal'}});
    }
    if(command==='p2pSession'){
      const id=requireUUID(arg.channelId,'Canal');await ensureSession();
      const found=await request('/rest/v1/channels?select=id&type=eq.voice&id=eq.'+encodeURIComponent(id),{authorize:true});
      if(!found?.length)throw Error('Você não tem acesso a este canal de voz.');
      return {url:config.url,key:config.key,accessToken:session.access_token,userId:session.user.id};
    }
    if(command==='profileMine'){
      await ensureSession();const rows=await request('/rest/v1/consivo_profiles?select=*&id=eq.'+encodeURIComponent(session.user.id)+'&limit=1',{authorize:true});
      return {profile:rows?.[0]||null,mediaBase:mediaBase()};
    }
    if(command==='profileRead'){
      const id=requireUUID(arg.userId,'Usuário');const rows=await request('/rest/v1/consivo_profiles?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1',{authorize:true});
      return {profile:rows?.[0]||null,mediaBase:mediaBase()};
    }
    if(command==='profileHandleCheck'){
      await ensureSession();const handle=String(arg.handle||'').trim().toLowerCase();
      if(!/^[a-z0-9_]{3,24}$/.test(handle))return {available:false,invalid:true};
      const rows=await request('/rest/v1/consivo_profiles?select=id&handle=eq.'+encodeURIComponent(handle)+'&limit=1',{authorize:true});
      return {available:!rows.length||rows[0].id===session.user.id};
    }
    if(command==='profileSave'){
      await ensureSession();const input=validateProfile(arg,session.user.id);
      try{
        const rows=await request('/rest/v1/consivo_profiles?on_conflict=id&select=*',{method:'POST',authorize:true,
          body:input,headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
        return {profile:rows?.[0]||null,mediaBase:mediaBase()};
      }catch(err){if(/duplicate|unique|23505/i.test(err.message))throw Error('Este @ já está em uso.');throw err;}
    }
    if(command==='profileUpload')return uploadProfileImage(arg);
    throw Error('Operação indisponível na versão web.');
  }
  const unsupported=()=>{};
  const desktop=Object.freeze({
    isWeb:true,isDesktop:false,
    onlineInvoke:invoke,
    isDebugEnabled:async()=>false,
    ensureMediaPermission:async()=>({granted:!!navigator.mediaDevices&&window.isSecureContext}),
    offerWindowsMediaSettings:async()=>false,
    listCaptureSources:async()=>[],chooseCaptureSource:async()=>false,
    openFloating:()=>{window.alert('Janela flutuante estará disponível na versão Windows do Zeon.');},
    closeFloating:unsupported,focusMain:unsupported,setFloatingMode:unsupported,
    onCallBridge:unsupported,onFloatingClosed:unsupported,onCallAction:unsupported,
    callBridgeSignal:unsupported,sendCallAction:unsupported,onFloatingMode:unsupported
  });
  Object.defineProperty(window,'desktop',{value:desktop,writable:false,configurable:false});
})();
