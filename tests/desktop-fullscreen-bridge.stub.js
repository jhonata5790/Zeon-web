'use strict';
window.desktop={
 isWeb:true,
 async onlineInvoke(cmd,args){
  if(cmd==='status')return {configured:true,loggedIn:true,email:'teste@zeon.example',userId:'u1'};
  if(cmd==='groups')return [{id:'g1',name:'Teste'}];
  if(cmd==='channels')return [{id:'v1',name:'Sala de voz',type:'voice',admin_only:false}];
  if(cmd==='memberRole')return 'owner';
  if(cmd==='messages')return [];
  if(cmd==='livekitToken')return {token:'fake-token',url:'wss://fixture.invalid'};
  if(cmd==='dmInbox')return {threads:[],profiles:[],reads:[]};
  return null;
 }
};
