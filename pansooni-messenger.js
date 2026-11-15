/* YOUNGHWA Pansooni private messenger — Kakao-style Chats/Friends.
 * The existing approved-browser identity is checked on every server request.
 * Floating 1:1 conversation is independent of the AI pane and 3D viewport.
 * No private conversations are shared with bystanders or the AI model.
 */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const pane=el('pansooniChat'),messenger=el('pansooniMessenger'),tab=el('pansooniMessengerTab'),aiTab=el('pansooniAiTab');
const chatsTab=el('yhChatListTab'),friendsTab=el('yhFriendListTab'),search=el('yhMessengerSearch'),list=el('yhMessengerList'),hint=el('yhMessengerNotice'),count=el('yhChatListCount');
const float=el('yhFloatingThread'),header=el('yhFloatingHeader'),title=el('yhFloatingTitle'),online=el('yhFloatingOnline'),messages=el('yhFloatingMessages'),form=el('yhFloatingForm'),input=el('yhFloatingInput'),send=form?.querySelector('button[type=submit]'),status=el('yhFloatingStatus');
const close=el('yhFloatingClose'),minimize=el('yhFloatingMinimize'),badge=el('pansooniUnreadBadge'),mascot=document.querySelector('.pansooni-fire-mascot');
if(!pane||!messenger||!tab||!aiTab||!chatsTab||!friendsTab||!search||!list||!hint||!count||!float||!header||!title||!online||!messages||!form||!input||!send||!status||!close||!minimize||!badge||!mascot)return;
const aiNodes=[el('pansooniChatMessages'),pane.querySelector('.pansooni-chat-chips'),el('pansooniChatForm'),pane.querySelector('.pansooni-chat-limit')].filter(Boolean);
const saveKey='yh-messenger-floating-geometry-v1';
let myId='',contacts=[],threads=[],unread={},unreadTotal=0,peer='',mode='ai',section='chats',busy=false,loadingMessages=false,lastSignature='';
let win={x:0,y:0,w:385,h:490},moving=null,resizing=null;
const minW=275,minH=260;
function clamp(n,min,max){return Math.min(Math.max(n,min),Math.max(min,max))}
function viewport(){return {w:window.innerWidth,h:window.innerHeight}}
function restore(){
 const v=viewport();
 const saved=(()=>{try{return JSON.parse(localStorage.getItem(saveKey)||'null')}catch(_){return null}})();
 win.w=clamp(Number(saved?.w)||385,Math.min(minW,v.w-12),v.w-12);
 win.h=clamp(Number(saved?.h)||490,Math.min(minH,v.h-12),v.h-12);
 win.x=clamp(Number.isFinite(saved?.x)?saved.x:v.w-win.w-24,5,v.w-win.w-5);
 win.y=clamp(Number.isFinite(saved?.y)?saved.y:v.h-win.h-70,5,v.h-win.h-5);
 layout();
}
function layout(){
 const v=viewport();
 win.w=clamp(win.w,Math.min(minW,v.w-10),v.w-10);
 win.h=clamp(win.h,Math.min(minH,v.h-10),v.h-10);
 win.x=clamp(win.x,5,v.w-win.w-5);
 win.y=clamp(win.y,5,v.h-win.h-5);
 Object.assign(float.style,{width:Math.round(win.w)+'px',height:Math.round(win.h)+'px',left:Math.round(win.x)+'px',top:Math.round(win.y)+'px'});
}
function saveGeometry(){try{localStorage.setItem(saveKey,JSON.stringify(win))}catch(_){}}
function showFloating(){if(!peer)return;float.hidden=false;layout();refreshMessages();input.focus()}
function hideFloating(){float.hidden=true;lastSignature='';renderList()}
function byId(id){return contacts.find(c=>c.id===id)}
function label(id){const c=byId(id);return c?c.name:'상대방'}
function stamp(t){const d=new Date(t);return Number.isNaN(d.getTime())?'':d.toLocaleString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
function detail(t){const d=new Date(t);return Number.isNaN(d.getTime())?'':d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
async function request(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 let data;
 try{data=await response.json()}catch(_){throw Error('서버 응답 오류')}
 if(!response.ok)throw Error(data.error||'서버 오류');
 return data;
}
function badgePosition(){
 const rect=mascot.getBoundingClientRect();
 badge.hidden=mascot.hidden||!unreadTotal;
 if(badge.hidden)return;
 badge.textContent=unreadTotal>99?'99+':String(unreadTotal);
 badge.title='읽지 않은 사내 메시지 '+unreadTotal+'개';
 badge.style.left=Math.round(clamp(rect.right-18,5,window.innerWidth-31))+'px';
 badge.style.top=Math.round(clamp(rect.top+3,5,window.innerHeight-31))+'px';
}
function syncCount(){
 badgePosition();
 count.textContent=unreadTotal?'('+unreadTotal+')':'';
 tab.textContent='사내 메신저'+(unreadTotal?' ('+unreadTotal+')':'');
 if(mode==='messenger'&&!pane.hidden)renderList();
}
function showMode(next){
 mode=next;
 messenger.hidden=next!=='messenger';
 aiTab.setAttribute('aria-selected',String(next==='ai'));
 tab.setAttribute('aria-selected',String(next==='messenger'));
 for(const node of aiNodes)node.hidden=next==='messenger';
 if(next==='messenger')refreshEverything();
}
function setSection(next){
 section=next;
 chatsTab.setAttribute('aria-selected',String(next==='chats'));
 friendsTab.setAttribute('aria-selected',String(next==='friends'));
 search.placeholder=next==='chats'?'대화 상대 검색':'친구 이름 또는 부서 검색';
 search.value='';
 renderList();
}
function personCard(contact,thread){
 const row=document.createElement('button');row.type='button';row.className='yh-person';
 const avatar=document.createElement('span');avatar.className='yh-avatar';avatar.textContent=(contact.name||'?').slice(0,1);
 const dot=document.createElement('span');dot.className='yh-dot'+(contact.online?' online':'');dot.title=contact.online?'현재 접속 중':'현재 미접속';
 avatar.append(dot);
 const body=document.createElement('span');body.className='yh-person-body';
 const name=document.createElement('span');name.className='yh-person-name';name.textContent=contact.name;
 const preview=document.createElement('span');preview.className='yh-person-preview';preview.textContent=thread?thread.lastBody:(contact.department||'')+(contact.online?' · 접속 중':' · 미접속');
 body.append(name,preview);
 const side=document.createElement('span');side.className='yh-person-side';
 if(thread){const time=document.createElement('span');time.className='yh-person-time';time.textContent=stamp(thread.lastAt);side.append(time)}
 const n=unread[contact.id]||0;
 if(n){const bubble=document.createElement('span');bubble.className='yh-person-unread';bubble.textContent=n>99?'99+':String(n);side.append(bubble)}
 row.append(avatar,body,side);
 row.addEventListener('click',()=>openThread(contact.id));
 return row;
}
function renderList(){
 if(messenger.hidden)return;
 list.replaceChildren();
 const q=search.value.trim().toLocaleLowerCase('ko-KR');
 const matches=c=>!q||(c.name+' '+c.department).toLocaleLowerCase('ko-KR').includes(q);
 if(section==='chats'){
  const rows=threads.filter(t=>byId(t.peer)&&matches(byId(t.peer)));
  for(const t of rows)list.append(personCard(byId(t.peer),t));
  if(!rows.length){
   const empty=document.createElement('div');empty.className='yh-list-empty';
   empty.textContent=q?'검색된 대화가 없습니다.':'아직 대화가 없습니다.\n친구 탭에서 상대방을 선택해 대화를 시작하세요.';
   empty.style.whiteSpace='pre-line';list.append(empty);
  }
  hint.textContent='최근 대화순 · 대화 상대 외 다른 직원은 메시지를 볼 수 없습니다.';
 }else{
  const rows=contacts.filter(matches).sort((a,b)=>{
   if(a.online!==b.online)return Number(b.online)-Number(a.online);
   return a.name.localeCompare(b.name,'ko-KR');
  });
  for(const c of rows)list.append(personCard(c,null));
  if(!rows.length){const empty=document.createElement('div');empty.className='yh-list-empty';empty.textContent='일치하는 승인 직원이 없습니다.';list.append(empty)}
  hint.textContent='🟢 사이트 접속 중 · 회색 미접속 (메시지 읽음 여부와 별개)';
 }
}
async function refreshContacts(){
 const data=await request('/api/messenger/contacts');
 myId=data.me.id;contacts=Array.isArray(data.contacts)?data.contacts:[];
 updateThreadHeader();
}
async function refreshThreads(){const data=await request('/api/messenger/threads');threads=Array.isArray(data.threads)?data.threads:[]}
async function refreshUnread(){
 const data=await request('/api/messenger/unread');unreadTotal=Number(data.total)||0;unread={};
 for(const entry of data.bySender||[])unread[entry.sender]=Number(entry.count)||0;
 syncCount();
}
let refreshing=false;
async function refreshEverything(){
 if(refreshing||document.hidden)return;refreshing=true;
 try{
  await refreshContacts();
  await Promise.all([refreshThreads(),refreshUnread()]);
  renderList();
  if(!float.hidden&&peer)refreshMessages();
 }catch(e){hint.textContent='메신저 목록을 불러올 수 없습니다: '+e.message}
 finally{refreshing=false}
}
function updateThreadHeader(){
 const person=byId(peer);
 title.textContent=person?person.name+' · 1:1 대화':'직원 대화';
 online.textContent=!person?'상대방 선택 필요':person.online?'🟢 접속 중 · 아직 읽었다는 뜻은 아닙니다':'⚪ 현재 미접속 · 다음 접속 때 메시지 알림을 받습니다';
}
function renderMessages(items){
 messages.replaceChildren();
 if(!items.length){const empty=document.createElement('div');empty.className='yh-list-empty';empty.textContent='아직 대화가 없습니다. 첫 메시지를 보내 보세요.';messages.append(empty)}
 for(const item of items){
  const mine=item.sender===myId;
  const wrap=document.createElement('div');wrap.className='yh-bubble'+(mine?' mine':'');
  const text=document.createElement('div');text.textContent=item.body;
  const info=document.createElement('div');info.className='yh-bubble-info';info.textContent=detail(item.sentAt)+(mine?(item.readAt?' · 읽음':' · 안 읽음'):'');
  wrap.append(text,info);messages.append(wrap);
 }
 messages.scrollTop=messages.scrollHeight;
}
async function refreshMessages(){
 if(float.hidden||!peer||loadingMessages||document.hidden)return;
 loadingMessages=true;const target=peer;
 try{
  const data=await request('/api/messenger/messages?peer='+encodeURIComponent(target));
  if(target!==peer||float.hidden)return;
  const items=data.messages||[];
  const signature=items.map(x=>x.id+':'+(x.readAt||'')).join(',');
  if(signature!==lastSignature){renderMessages(items);lastSignature=signature}
  await Promise.all([refreshThreads(),refreshUnread()]);
  renderList();
 }catch(e){status.textContent='대화 확인 오류: '+e.message}
 finally{loadingMessages=false}
}
function openThread(id){
 if(!byId(id))return;
 peer=id;lastSignature='';messages.replaceChildren();status.textContent='개인 대화 · 상대방과 나만 볼 수 있습니다.';
 updateThreadHeader();showFloating();
}
async function heartbeat(){
 if(document.hidden)return;
 try{await request('/api/messenger/presence',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})}catch(_){}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const body=input.value.trim();
 if(!body||busy||!peer)return;
 busy=true;send.disabled=true;
 try{
  await request('/api/messenger/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipient:peer,body})});
  input.value='';lastSignature='';status.textContent='메시지를 보냈습니다.';
  await refreshMessages();
 }catch(e){status.textContent='전송 실패: '+e.message}
 finally{send.disabled=false;busy=false}
});
tab.addEventListener('click',()=>showMode('messenger'));
aiTab.addEventListener('click',()=>showMode('ai'));
chatsTab.addEventListener('click',()=>setSection('chats'));
friendsTab.addEventListener('click',()=>setSection('friends'));
search.addEventListener('input',renderList);
close.addEventListener('click',hideFloating);
minimize.addEventListener('click',hideFloating);
window.addEventListener('pansooni-open-chat',()=>{
 if(!pane.hidden&&unreadTotal)showMode('messenger');
});
badge.addEventListener('click',event=>{
 event.stopPropagation();
 if(pane.hidden)window.dispatchEvent(new CustomEvent('pansooni-open-chat'));
 if(!pane.hidden)showMode('messenger');
});
header.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('button'))return;
 moving={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:win.x,y:win.y};
 header.setPointerCapture(event.pointerId);event.preventDefault();
});
header.addEventListener('pointermove',event=>{
 if(!moving||moving.id!==event.pointerId)return;
 win.x=moving.x+event.clientX-moving.startX;
 win.y=moving.y+event.clientY-moving.startY;layout();
});
const finishMove=event=>{if(moving&&moving.id===event.pointerId){moving=null;saveGeometry()}};
header.addEventListener('pointerup',finishMove);
header.addEventListener('pointercancel',finishMove);
for(const grip of float.querySelectorAll('[data-yh-resize]')){
 grip.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  resizing={id:event.pointerId,corner:grip.dataset.yhResize,startX:event.clientX,startY:event.clientY,...win};
  grip.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();
 });
 grip.addEventListener('pointermove',event=>{
  if(!resizing||resizing.id!==event.pointerId)return;
  const x=resizing,dx=event.clientX-x.startX,dy=event.clientY-x.startY;
  const left=x.corner.includes('l'),top=x.corner.includes('t');
  const maxWidth=window.innerWidth-10,maxHeight=window.innerHeight-10;
  const needW=Math.min(minW,maxWidth),needH=Math.min(minH,maxHeight);
  win.w=clamp(left?x.w-dx:x.w+dx,needW,maxWidth);
  win.h=clamp(top?x.h-dy:x.h+dy,needH,maxHeight);
  win.x=left?x.x+x.w-win.w:x.x;
  win.y=top?x.y+x.h-win.h:x.y;
  layout();event.preventDefault();
 });
 const end=event=>{if(resizing&&resizing.id===event.pointerId){resizing=null;saveGeometry()}};
 grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
}
window.addEventListener('resize',()=>{layout();saveGeometry();badgePosition()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){heartbeat();refreshEverything();if(!float.hidden)refreshMessages()}});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!float.hidden&&document.activeElement!==input)hideFloating();
});
setInterval(badgePosition,250);
setInterval(()=>{if(document.hidden)return;refreshEverything();if(!float.hidden)refreshMessages()},12000);
setInterval(heartbeat,30000);
restore();heartbeat();refreshEverything();
})();