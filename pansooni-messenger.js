/* Pansooni 1:1 messenger. Private D1 API; no third-party chat service.
 * Existing approved browser cookie = the user's account; admin cookie = admin account.
 * No request reads another person's conversation or notification count.
 */
(function(){
 'use strict';
 const chat=document.getElementById('pansooniChat');
 const panel=document.getElementById('pansooniMessenger');
 const messengerTab=document.getElementById('pansooniMessengerTab');
 const aiTab=document.getElementById('pansooniAiTab');
 const contactSelect=document.getElementById('pansooniPeerSelect');
 const contactStatus=document.getElementById('pansooniPeerStatus');
 const presenceRow=document.getElementById('pansooniPeerPresence');
 const presenceDot=document.getElementById('pansooniPeerPresenceDot');
 const presenceText=document.getElementById('pansooniPeerPresenceText');
 const thread=document.getElementById('pansooniThread');
 const form=document.getElementById('pansooniMessengerForm');
 const input=document.getElementById('pansooniMessengerInput');
 const send=form?.querySelector('button[type=submit]');
 const badge=document.getElementById('pansooniUnreadBadge');
 const mascot=document.querySelector('.pansooni-fire-mascot');
 if(!chat||!panel||!messengerTab||!aiTab||!contactSelect||!presenceRow||!presenceDot||!presenceText||!thread||!form||!input||!send||!badge||!mascot)return;
 const aiSections=[
  document.getElementById('pansooniChatMessages'),
  chat.querySelector('.pansooni-chat-chips'),
  document.getElementById('pansooniChatForm'),
  chat.querySelector('.pansooni-chat-limit')
 ].filter(Boolean);
 let myId='',peer='',contacts=[],unread={},total=0;
 let busy=false,refreshing=false,mode='ai',lastMessageSignature='',lastUnread=0;
 const originHeaders={'content-type':'application/json'};
 function nameOf(id){const item=contacts.find(x=>x.id===id);return item?item.name:'직원'}
 function notice(message){contactStatus.textContent=message}
 function showPeerPresence(){
  const selected=contacts.find(x=>x.id===peer);
  presenceRow.hidden=!selected;
  if(!selected)return;
  const online=selected.online===true;
  presenceDot.classList.toggle('online',online);
  presenceText.textContent=online
   ?'접속 중 · 사이트를 열어둔 상태입니다 (읽음 여부와 별개)'
   :'현재 미접속 · 나중에 접속하면 메시지 알림을 확인할 수 있습니다';
 }
 function renderContacts(){
  for(const option of contactSelect.options){
   if(!option.value)continue;
   const employee=contacts.find(c=>c.id===option.value);
   if(!employee)continue;
   const n=unread[option.value]||0;
   option.textContent=(employee.online?'🟢 ':'⚪ ')+employee.name+' · '+employee.department+
    (employee.pc?' · '+employee.pc:'')+(n?' ('+n+'개 새 메시지)':'');
  }
  showPeerPresence();
 }
 async function sendHeartbeat(){
  if(document.hidden)return;
  try{await api('/api/messenger/presence',{method:'POST',headers:originHeaders,body:'{}'})}catch(_){}
 }
 async function refreshPresence(){
  if(document.hidden||mode!=='messenger'||chat.hidden||!myId)return;
  try{
   const data=await api('/api/messenger/contacts');
   const latest=new Map((data.contacts||[]).map(x=>[x.id,x]));
   contacts=contacts.map(x=>latest.get(x.id)||{...x,online:false});
   renderContacts();
  }catch(_){
   // Do not show a stale green online indicator if status is unavailable.
   contacts=contacts.map(x=>({...x,online:false}));
   renderContacts();
  }
 }
 async function api(url,init){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});
  let body;
  try{body=await response.json()}catch(_){throw Error('서버 응답을 읽을 수 없습니다')}
  if(!response.ok)throw Error(body.error||'메신저 서버 오류');
  return body;
 }
 function badgePosition(){
  const rect=mascot.getBoundingClientRect();
  if(mascot.hidden||!total){
   badge.hidden=true;return;
  }
  badge.hidden=false;
  badge.style.left=Math.round(Math.min(window.innerWidth-31,Math.max(8,rect.right-19)))+'px';
  badge.style.top=Math.round(Math.max(7,Math.min(window.innerHeight-30,rect.top+4)))+'px';
 }
 function syncCount(){
  badge.textContent=total>99?'99+':String(total);
  badge.title='나에게 온 읽지 않은 메시지 '+total+'개';
  messengerTab.textContent='사내 메신저'+(total?' ('+total+')':'');
  renderContacts();
  badgePosition();
 }
 function showMode(next){
  mode=next;
  aiTab.setAttribute('aria-selected',String(next==='ai'));
  messengerTab.setAttribute('aria-selected',String(next==='messenger'));
  panel.hidden=next!=='messenger';
  for(const node of aiSections)node.hidden=next==='messenger';
  if(next==='messenger'){
   if(!myId)loadContacts();
   else{loadUnread();refreshPresence();if(peer)loadMessages();}
  }
 }
 async function loadContacts(){
  try{
   const data=await api('/api/messenger/contacts');
   myId=data.me.id;
   contacts=Array.isArray(data.contacts)?data.contacts:[];
   const wanted=peer;
   contactSelect.replaceChildren();
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='메시지 보낼 직원 선택';contactSelect.append(placeholder);
   for(const item of contacts){
    const option=document.createElement('option');
    option.value=item.id;
    option.textContent=(item.online?'🟢 ':'⚪ ')+item.name+' · '+item.department+(item.pc?' · '+item.pc:'');
    contactSelect.append(option);
   }
   if(wanted&&contacts.some(c=>c.id===wanted)){peer=wanted;contactSelect.value=peer;}
   else if(contacts.length===1){peer=contacts[0].id;contactSelect.value=peer;}
   else{peer='';contactSelect.value='';}
   notice(contacts.length?'초록색은 사이트 접속 중, 흰색은 미접속을 뜻합니다.':'승인된 다른 직원이 아직 없습니다.');
   showPeerPresence();
   await loadUnread();
   if(peer)await loadMessages();
  }catch(e){notice('메신저를 사용할 수 없습니다: '+e.message)}
 }
 async function loadUnread(){
  try{
   const data=await api('/api/messenger/unread');
   total=Math.max(0,Number(data.total)||0);
   unread={};
   for(const x of data.bySender||[])unread[x.sender]=Number(x.count)||0;
   syncCount();
  }catch(_){
   // Do not reveal stale notifications from previous login after access revocation.
   total=0;unread={};syncCount();
  }
 }
 function renderMessages(messages){
  thread.replaceChildren();
  if(!messages.length){
   const tip=document.createElement('div');tip.className='pansooni-messenger-empty';
   tip.textContent='아직 대화가 없습니다. 첫 메시지를 보내보세요.';
   thread.append(tip);
  }
  for(const message of messages){
   const own=message.sender===myId;
   const wrap=document.createElement('div');wrap.className='pansooni-messenger-message '+(own?'outgoing':'incoming');
   const body=document.createElement('div');body.className='pansooni-messenger-text';body.textContent=message.body;
   const meta=document.createElement('div');meta.className='pansooni-messenger-time';
   const when=new Date(message.sentAt);
   meta.textContent=(own?'나':'상대방')+' · '+(Number.isNaN(when.getTime())?'':when.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))+(own&&message.readAt?' · 읽음':'');
   wrap.append(body,meta);thread.append(wrap);
  }
  thread.scrollTop=thread.scrollHeight;
 }
 async function loadMessages(){
  if(!peer||refreshing||mode!=='messenger'||chat.hidden)return;
  refreshing=true;
  const current=peer;
  try{
   const data=await api('/api/messenger/messages?peer='+encodeURIComponent(peer));
   if(current!==peer)return;
   const messages=data.messages||[];
   const signature=messages.map(x=>x.id+':'+(x.readAt||'')).join(',');
   if(signature!==lastMessageSignature){
    renderMessages(messages);lastMessageSignature=signature;
   }
   await loadUnread();
  }catch(e){notice('대화를 불러오지 못했습니다: '+e.message)}
  finally{refreshing=false}
 }
 contactSelect.addEventListener('change',()=>{
  peer=contactSelect.value;lastMessageSignature='';
  thread.replaceChildren();
  if(peer){notice(nameOf(peer)+'님과 1:1 대화 중');loadMessages();}
  else notice('대화할 직원을 선택해 주세요.');
  showPeerPresence();
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const body=input.value.trim();
  if(!peer){notice('받는 직원을 먼저 선택해 주세요.');return}
  if(!body||busy)return;
  busy=true;send.disabled=true;
  try{
   await api('/api/messenger/send',{method:'POST',headers:originHeaders,body:JSON.stringify({recipient:peer,body})});
   input.value='';notice(nameOf(peer)+'님에게 메시지를 보냈습니다.');
   lastMessageSignature='';await loadMessages();
  }catch(err){notice('전송 실패: '+err.message)}
  finally{busy=false;send.disabled=false}
 });
 aiTab.addEventListener('click',()=>showMode('ai'));
 messengerTab.addEventListener('click',()=>showMode('messenger'));
 // Existing click handler opens/closes the Pansooni pane first.
 window.addEventListener('pansooni-open-chat',()=>{
  if(!chat.hidden&&total>0){showMode('messenger');}
 });
 badge.addEventListener('click',e=>{
  e.stopPropagation();
  if(chat.hidden)window.dispatchEvent(new CustomEvent('pansooni-open-chat'));
  if(!chat.hidden)showMode('messenger');
 });
 window.addEventListener('resize',badgePosition);
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){sendHeartbeat();loadUnread();if(mode==='messenger'&&!chat.hidden){refreshPresence();loadMessages()}}
 });
 // Polling without new servers: notifications arrive within about 12 s while
 // the site is open. Browser closed => no desktop push.
 setInterval(()=>{
  badgePosition();
 },240);
 setInterval(()=>{
  if(document.hidden)return;
  loadUnread();
  if(mode==='messenger'&&!chat.hidden){
   refreshPresence();
   if(peer)loadMessages();
  }
 },12000);
 setInterval(sendHeartbeat,30000);
 // Secure API returns only this approved user's unread counts.
 loadUnread();
 sendHeartbeat();
})();