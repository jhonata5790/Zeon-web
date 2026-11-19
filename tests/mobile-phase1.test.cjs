'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const ui=read('mobile.js');
const css=read('mobile.css');
const shared=read('unified.js');
const profile=read('profile-v080.js');

test('todos os scripts locais referenciados pelo HTML existem',()=>{
  for(const [,src] of html.matchAll(/<script\s+src="([^"]+)"/g)){
    if(!src.startsWith('http'))assert.ok(fs.existsSync(path.join(root,src)),'arquivo ausente: '+src);
  }
});
test('os scripts essenciais do mobile carregam na ordem correta',()=>{
  const a=html.indexOf('src="unified.js"');
  const b=html.indexOf('src="profile-v080.js"');
  const c=html.indexOf('src="mobile.js"');
  assert.ok(a>=0&&b>a&&c>b);
  assert.match(html,/href="web-responsive\.css"/);
  assert.match(html,/href="mobile\.css"/);
});
test('JavaScript de navegação, perfil, backend e chamadas tem sintaxe válida',()=>{
  for(const code of [ui,shared,profile,read('web-bridge.js')]){
    assert.doesNotThrow(()=>new Function(code));
  }
});
test('navegação mobile contém todas as quatro abas definidas',()=>{
  const tabs=[...ui.matchAll(/data-mobile-tab="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(tabs,['chats','groups','calls','profile']);
});
test('a navegação usa o estado real e preserva os comandos do Zeon',()=>{
  for(const name of ['snapshot','selectGroup','selectChannel','newGroup','joinGroup',
                      'newChannel','invite','settings','signOut','leaveVoice']){
    assert.match(shared,new RegExp('\\b'+name+'\\s*:'));
  }
  assert.match(shared,/document\.dispatchEvent\(new CustomEvent\('zeon:web-render'\)\)/);
  assert.match(ui,/document\.addEventListener\('zeon:web-render',schedule\)/);
  assert.match(ui,/adapter\(\)\.selectChannel\(channel\.id\)/);
  assert.match(ui,/adapter\(\)\.selectGroup\(group\.id\)/);
});
test('troca de tela e chamadas usam estado real, sem mensagens falsas',()=>{
  assert.match(ui,/s\.joinedVoiceId/);
  assert.match(ui,/s\.inCall/);
  assert.match(ui,/s\.channels\.filter\(c=>c\.type===type\)/);
  assert.doesNotMatch(ui,/fakeMessages|mockMessages|demoMessages/);
  assert.doesNotMatch(ui,/fetch\(['"]https?:\/\//); // nenhuma API nova específica do mobile
});
test('o CSS limita o novo layout ao celular e protege telas de autenticação',()=>{
  assert.match(css,/@media\s*\(max-width:740px\),\s*\(max-height:500px\) and \(pointer:coarse\)/);
  assert.match(ui,/max-height: 500px/);
  assert.match(css,/#zeon-mobile-root\[hidden\]/);
  assert.match(ui,/\$\('#authGate'\)\?\.hidden/);
  assert.match(ui,/state\(\)\?\.ready/);
});
test('o composer preserva o texto e se recupera de falhas de envio',()=>{
  assert.match(shared,/S\.textDrafts/);
  assert.match(shared,/data-channel-id/);
  assert.match(shared,/catch\(err\)\{[\s\S]*current\.value=value/);
  assert.match(css,/\.message\.own/);
});
test('há suporte de rolagem, teclado, foco e barras seguras',()=>{
  assert.match(css,/overscroll-behavior:contain/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/font-size:16px!important/);
  assert.match(ui,/window\.visualViewport\?\.addEventListener\('resize',updateViewport\)/);
  assert.match(ui,/new MutationObserver/);
});
test('ações de conta e perfil continuam disponíveis no mobile',()=>{
  assert.match(ui,/profile\.openOwn\(\)/);
  assert.match(ui,/adapter\(\)\?\.settings\(\)/);
  assert.match(ui,/adapter\(\)\?\.signOut\(\)/);
  assert.match(ui,/window\.ConsivoProfile\?\.close\?\.\(\)===false/);
});
test('modificações não incluem novos arquivos de credenciais nem migrações',()=>{
  assert.ok(fs.existsSync(path.join(root,'zeon-public-config.json')));
  assert.doesNotMatch(ui,/service_role|sb_secret_/);
});
