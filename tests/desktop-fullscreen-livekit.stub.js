'use strict';
// Apenas para testes. A Beta real continua usando Supabase e LiveKit.
window.__fakeShareActive=true;
window.__fakeParticipants=2;
window.__fakeCalls=[];
window.__fakeRoom=null;
const sources={ScreenShare:'ScreenShare',Camera:'Camera',ScreenShareAudio:'ScreenShareAudio'};
const screenTrack={attach(node){node.dataset.fixtureVideo='1';return node;},detach(){return [];}};
function publication(track){return track?{videoTrack:track,isMuted:false,isSubscribed:true}:null;}
function makePerson(id,local=false){
 return {
  identity:id,name:local?'Você':'Pessoa remota',
  isMicrophoneEnabled:false,isCameraEnabled:false,isScreenShareEnabled:local?false:true,
  getTrackPublication(type){
   if(type==='ScreenShare'&&!local&&window.__fakeShareActive)return publication(screenTrack);
   return null;
  }
 };
}
class Room{
 constructor(){
  this.localParticipant=makePerson('self',true);
  this.remoteParticipants=new Map();
  this.activeSpeakers=[];
  this.listeners=new Map();
  this.setParticipants(window.__fakeParticipants);
  window.__fakeRoom=this;
 }
 setParticipants(count){
  this.remoteParticipants=new Map();
  for(let i=1;i<count;i++)this.remoteParticipants.set('remote'+i,makePerson('remote'+i));
 }
 on(event,cb){
  if(!this.listeners.has(event))this.listeners.set(event,[]);
  this.listeners.get(event).push(cb);
 }
 trigger(event){for(const cb of this.listeners.get(event)||[])cb();}
 async connect(){window.__fakeCalls.push('connect');}
 async startAudio(){window.__fakeCalls.push('audio');}
 async disconnect(){window.__fakeCalls.push('disconnect');this.trigger('Disconnected');}
}
window.ConsivoLiveKit={
 Room,
 Track:{Source:sources,Kind:{Audio:'audio',Video:'video'}},
 RoomEvent:Object.fromEntries([
  'ParticipantConnected','ParticipantDisconnected','TrackSubscribed','TrackUnsubscribed',
  'TrackPublished','TrackUnpublished','LocalTrackPublished','LocalTrackUnpublished',
  'TrackMuted','TrackUnmuted','ActiveSpeakersChanged','Disconnected'
 ].map(k=>[k,k]))
};
