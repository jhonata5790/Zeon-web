'use strict';
/* Camada unica de chamadas DM: compativel com o processo principal Electron e o bridge Web.
 * Os filtros do navegador sao conveniencia; permissoes efetivas sao garantidas por RLS no Postgres.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZeonDMApi = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validUUID = id => UUID.test(String(id||''));
  const requireUUID = (id,label='Identificador') => {
    if(!validUUID(id)) throw Error(label+(label.endsWith('a')?' inválida.':' inválido.'));
    return String(id).toLowerCase();
  };
  const searchHandle = term => String(term||'').trim().replace(/^@/,'').toLowerCase();
  const pairs = (self,peer) => [self,peer].sort();
  const encoded = encodeURIComponent;
  function safeMessage(value) {
    const text=String(value??'').trim();
    if(!text || text.length>700) throw Error('A mensagem deve ter entre 1 e 700 caracteres.');
    return text;
  }
  const supports = command => ['dmSearch','dmInbox','dmCreate','dmMessages','dmSend','dmMarkRead'].includes(command);
  async function run(command,arg,context) {
    const {request,session} = context;
    if(!supports(command)) throw Error('Comando DM desconhecido.');
    await session.ensure();
    const mine=requireUUID(session.userId(),'Sua conta');
    if(command==='dmSearch'){
      const term=searchHandle(arg.term);
      if(!/^[a-z0-9_]{2,24}$/.test(term))throw Error('Pesquise um @ com pelo menos 2 caracteres.');
      // Apenas perfis publicos; nao consultar emails nem metadados de auth.
      return request('/rest/v1/consivo_profiles?select=id,handle,display_name,avatar_path,accent_color&handle=ilike.'+encoded(term+'*')+'&id=neq.'+encoded(mine)+'&order=handle.asc&limit=12',{authorize:true});
    }
    if(command==='dmInbox'){
      const threads=await request('/rest/v1/zeon_dm_threads?select=id,user_a,user_b,created_at,last_message_at,last_message_preview,last_sender_id&or=(user_a.eq.'+mine+',user_b.eq.'+mine+')&order=last_message_at.desc.nullslast,created_at.desc&limit=200',{authorize:true});
      if(!threads.length)return {threads:[],profiles:[],reads:[]};
      const peers=[...new Set(threads.map(t=>t.user_a===mine?t.user_b:t.user_a).filter(validUUID))];
      const profiles=await request('/rest/v1/consivo_profiles?select=id,handle,display_name,avatar_path,accent_color&id=in.('+peers.join(',')+')',{authorize:true});
      const reads=await request('/rest/v1/zeon_dm_reads?select=thread_id,seen_at&user_id=eq.'+mine+'&thread_id=in.('+threads.map(t=>t.id).join(',')+')',{authorize:true});
      return {threads,profiles,reads};
    }
    if(command==='dmCreate'){
      const peer=requireUUID(arg.userId,'Usuário');
      if(mine===peer)throw Error('Você não pode iniciar uma conversa consigo mesmo.');
      const [user_a,user_b]=pairs(mine,peer);
      const route='/rest/v1/zeon_dm_threads?select=id,user_a,user_b,created_at';
      const query='/rest/v1/zeon_dm_threads?select=id,user_a,user_b,created_at&user_a=eq.'+user_a+'&user_b=eq.'+user_b+'&limit=1';
      let rows=await request(query,{authorize:true});
      if(rows.length)return rows[0];
      try{rows=await request(route,{method:'POST',authorize:true,body:{user_a,user_b},headers:{Prefer:'return=representation'}});}
      catch(err){if(!/duplicate|unique|23505|409/i.test(String(err?.message)))throw err;rows=await request(query,{authorize:true});}
      if(!rows?.[0])throw Error('Não foi possível abrir a conversa.');
      return rows[0];
    }
    const id=requireUUID(arg.threadId,'Conversa');
    if(command==='dmMessages'){
      return request('/rest/v1/zeon_dm_messages?select=id,thread_id,author_id,body,created_at&thread_id=eq.'+id+'&order=created_at.desc,id.desc&limit=100',{authorize:true});
    }
    if(command==='dmSend'){
      return request('/rest/v1/zeon_dm_messages',{method:'POST',authorize:true,body:{thread_id:id,author_id:mine,body:safeMessage(arg.text)},headers:{Prefer:'return=minimal'}});
    }
    if(command==='dmMarkRead'){
      return request('/rest/v1/zeon_dm_reads?on_conflict=thread_id,user_id',{method:'POST',authorize:true,body:{thread_id:id,user_id:mine},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
    }
  }
  return {run,supports,requireUUID,searchHandle,safeMessage,pairs};
});
