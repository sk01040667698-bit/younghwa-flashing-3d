/* Private YOUNGHWA messenger: group conversations and file attachments.
 * Deployed inside existing _worker.js auth boundary; never exposes raw storage URLs.
 * Files require a PRIVATE Cloudflare R2 bucket bound as env.MESSENGER_FILES.
 * Hard limit: 10 MiB (10,240 KiB) per file, 1 file/request.
 */
const MAX_FILE_BYTES=10*1024*1024;
const ALLOWED_EXT={
 pdf:'application/pdf',
 hwp:'application/x-hwp',
 hwpx:'application/vnd.hancom.hwpx',
 doc:'application/msword',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const err=(message,status=400)=>json({error:message},status);
const idOK=value=>typeof value==='string'&&(value==='admin'||/^[a-f0-9]{64}$/.test(value));
const groupOK=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const validName=name=>typeof name==='string'&&name.length>0&&name.length<=120&&!/[\x00-\x1f\\/]/.test(name);
function extension(name){const match=String(name||'').toLowerCase().match(/\.([a-z0-9]+)$/);return match?.[1]||''}
function headOK(ext,bytes){
 if(ext==='pdf')return bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45;
 if(ext==='hwp'||ext==='doc')return [208,207,17,224,161,177,26,225].every((x,i)=>bytes[i]===x);
 return bytes[0]===80&&bytes[1]===75&&(bytes[2]===3||bytes[2]===5||bytes[2]===7);
}
function publicAttachment(x){return {id:x.id,name:x.name,size:Number(x.size),mime:x.mime}}
async function approved(db,id){
 if(!idOK(id))return false;
 if(id==='admin')return true;
 const record=await db.prepare("SELECT id FROM yh_browsers WHERE id=? AND status='approved'").bind(id).first();
 return Boolean(record);
}
async function member(db,group,id){
 const row=await db.prepare("SELECT group_id FROM yh_group_members WHERE group_id=? AND member_id=?").bind(group,id).first();
 return Boolean(row);
}
async function groupMeta(db,group){return db.prepare("SELECT id,name,created_by,created_at FROM yh_groups WHERE id=?").bind(group).first()}
async function groupContacts(db,myId){
 const result=await db.prepare("SELECT g.id,g.name,g.created_at,gm.last_read_id FROM yh_groups g JOIN yh_group_members gm ON g.id=gm.group_id WHERE gm.member_id=? ORDER BY g.created_at DESC LIMIT 100").bind(myId).all();
 const groups=[];
 for(const g of result.results||[]){
  const msg=await db.prepare("SELECT id,sender_id,body,sent_at,attachment_id FROM yh_group_messages WHERE group_id=? ORDER BY id DESC LIMIT 1").bind(g.id).first();
  const count=await db.prepare("SELECT COUNT(*) AS amount FROM yh_group_messages WHERE group_id=? AND id>? AND sender_id!=?").bind(g.id,Number(g.last_read_id)||0,myId).first();
  const participants=await db.prepare("SELECT member_id FROM yh_group_members WHERE group_id=? ORDER BY joined_at").bind(g.id).all();
  groups.push({id:g.id,name:g.name,lastBody:msg?.body||'',lastAt:msg?.sent_at||g.created_at,lastSender:msg?.sender_id||null,lastAttachment:!!msg?.attachment_id,unread:Number(count?.amount)||0,members:(participants.results||[]).map(x=>x.member_id)});
 }
 groups.sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)));
 return groups;
}
export async function messengerExtensions({request,env,db,me,path,url,originOK}){
 const myId=me.id,method=request.method;
 const jsonRequest=async()=>{
  if(!originOK())throw Error('origin_not_allowed');
  if(!/application\/json/i.test(request.headers.get('content-type')||''))throw Error('invalid_type');
  const data=await request.text();if(data.length>6000)throw Error('too_large');
  return JSON.parse(data);
 };
 if(path==='/api/messenger/groups'&&method==='GET'){
  return json({groups:await groupContacts(db,myId)});
 }
 if(path==='/api/messenger/group-create'&&method==='POST'){
  let body;try{body=await jsonRequest()}catch(_){return err('요청이 올바르지 않습니다',400)}
  const extra=[...new Set(Array.isArray(body.members)?body.members:[])].filter(x=>x!==myId);
  if(extra.length<2||extra.length>19)return err('단체방은 자신을 포함해 3~20명으로 만들어야 합니다');
  for(const id of extra)if(!await approved(db,id))return err('승인되지 않은 직원을 초대할 수 없습니다',403);
  const name=typeof body.name==='string'&&body.name.trim()?body.name.trim().slice(0,50):'사내 단체 채팅';
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await db.prepare("INSERT INTO yh_groups(id,name,created_by,created_at) VALUES(?,?,?,?)").bind(id,name,myId,now).run();
  for(const memberId of [myId,...extra])await db.prepare("INSERT INTO yh_group_members(group_id,member_id,joined_at,last_read_id) VALUES(?,?,?,0)").bind(id,memberId,now).run();
  return json({id,name,members:[myId,...extra]},201);
 }
 if(path==='/api/messenger/group-invite'&&method==='POST'){
  let body;try{body=await jsonRequest()}catch(_){return err('요청이 올바르지 않습니다')}
  const group=body.group;
  if(!groupOK(group)||!await member(db,group,myId))return err('방에 접근할 수 없습니다',403);
  const extra=[...new Set(Array.isArray(body.members)?body.members:[])].filter(x=>x!==myId);
  if(!extra.length||extra.length>19)return err('초대할 직원을 선택해 주세요');
  const current=await db.prepare("SELECT COUNT(*) AS amount FROM yh_group_members WHERE group_id=?").bind(group).first();
  if(Number(current?.amount||0)+extra.length>20)return err('단체방은 최대 20명입니다');
  const now=new Date().toISOString();
  for(const id of extra){
   if(!await approved(db,id))return err('승인되지 않은 직원은 초대할 수 없습니다',403);
   await db.prepare("INSERT OR IGNORE INTO yh_group_members(group_id,member_id,joined_at,last_read_id) VALUES(?,?,?,0)").bind(group,id,now).run();
  }
  return json({ok:true});
 }
 if(path==='/api/messenger/group-messages'&&method==='GET'){
  const group=url.searchParams.get('group');
  if(!groupOK(group)||!await member(db,group,myId))return err('단체방에 접근할 수 없습니다',403);
  const g=await groupMeta(db,group);
  const participants=await db.prepare("SELECT member_id FROM yh_group_members WHERE group_id=? ORDER BY joined_at").bind(group).all();
  const list=await db.prepare("SELECT id,sender_id,body,sent_at,attachment_id FROM yh_group_messages WHERE group_id=? ORDER BY id DESC LIMIT 100").bind(group).all();
  const values=(list.results||[]).reverse();
  const lastId=values.length?Number(values[values.length-1].id):0;
  await db.prepare("UPDATE yh_group_members SET last_read_id=CASE WHEN last_read_id>? THEN last_read_id ELSE ? END WHERE group_id=? AND member_id=?").bind(lastId,lastId,group,myId).run();
  const enriched=[];
  for(const x of values){
   let attachment=null;
   if(x.attachment_id){
    const row=await db.prepare("SELECT id,name,size,mime FROM yh_messenger_files WHERE id=?").bind(x.attachment_id).first();
    if(row)attachment=publicAttachment(row);
   }
   enriched.push({id:x.id,sender:x.sender_id,body:x.body,sentAt:x.sent_at,attachment});
  }
  return json({group,name:g?.name||'단체 채팅',members:(participants.results||[]).map(x=>x.member_id),messages:enriched});
 }
 if(path==='/api/messenger/group-send'&&method==='POST'){
  let body;try{body=await jsonRequest()}catch(_){return err('요청이 올바르지 않습니다')}
  if(!groupOK(body.group)||!await member(db,body.group,myId))return err('단체방에 접근할 수 없습니다',403);
  if(typeof body.body!=='string'||!body.body.trim()||body.body.length>1000)return err('메시지는 1~1000자로 입력해 주세요');
  const now=new Date().toISOString();
  await db.prepare("INSERT INTO yh_group_messages(group_id,sender_id,body,sent_at,attachment_id) VALUES(?,?,?,?,NULL)").bind(body.group,myId,body.body.trim(),now).run();
  return json({ok:true,sentAt:now});
 }
 if(path==='/api/messenger/upload'&&method==='POST'){
  if(!originOK())return err('잘못된 요청입니다',403);
  if(!env.MESSENGER_FILES)return err('관리자가 R2 파일 저장소(MESSENGER_FILES)를 연결해야 합니다',503);
  const sizeHeader=Number(request.headers.get('content-length')||0);
  if(sizeHeader>MAX_FILE_BYTES+10000)return err('파일 최대 크기는 10MB(10,240KB)입니다',413);
  const kind=url.searchParams.get('kind'),target=url.searchParams.get('to');
  if(kind!=='private'&&kind!=='group')return err('대화방 종류가 올바르지 않습니다');
  if(kind==='private'){
   if(target===myId||!await approved(db,target))return err('승인된 수신자를 선택해 주세요',403);
  }else if(!groupOK(target)||!await member(db,target,myId))return err('단체방에 접근할 수 없습니다',403);
  const filename=decodeURIComponent(request.headers.get('x-yh-file-name')||'');
  if(!validName(filename))return err('파일명이 올바르지 않습니다');
  const ext=extension(filename);
  if(!Object.hasOwn(ALLOWED_EXT,ext))return err('PDF, HWP, HWPX, DOC, DOCX 파일만 첨부할 수 있습니다');
  // Read the file exactly once; Workers memory is limited, hence 10 MiB maximum.
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(!bytes.length||bytes.length>MAX_FILE_BYTES)return err('파일은 10MB(10,240KB) 이하만 업로드할 수 있습니다',413);
  if(!headOK(ext,bytes))return err('파일 내용이 확장자와 일치하지 않습니다');
  const id=crypto.randomUUID(),key='private-messenger/'+id,now=new Date().toISOString();
  await env.MESSENGER_FILES.put(key,bytes,{httpMetadata:{contentType:ALLOWED_EXT[ext]}});
  try{
   await db.prepare("INSERT INTO yh_messenger_files(id,kind,target_id,sender_id,name,mime,size,r2_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,kind,target,myId,filename,ALLOWED_EXT[ext],bytes.length,key,now).run();
   if(kind==='group')await db.prepare("INSERT INTO yh_group_messages(group_id,sender_id,body,sent_at,attachment_id) VALUES(?,?,?,?,?)").bind(target,myId,'📎 '+filename,now,id).run();
  }catch(e){await env.MESSENGER_FILES.delete(key);throw e}
  return json({ok:true,file:publicAttachment({id,name:filename,size:bytes.length,mime:ALLOWED_EXT[ext]})},201);
 }
 if(path==='/api/messenger/file'&&method==='GET'){
  const id=url.searchParams.get('id');
  if(!groupOK(id))return err('파일을 찾을 수 없습니다',404);
  const f=await db.prepare("SELECT id,kind,target_id,sender_id,name,mime,size,r2_key FROM yh_messenger_files WHERE id=?").bind(id).first();
  if(!f)return err('파일을 찾을 수 없습니다',404);
  let canRead=false;
  if(f.kind==='private')canRead=f.sender_id===myId||f.target_id===myId;
  else if(f.kind==='group')canRead=await member(db,f.target_id,myId);
  if(!canRead)return err('이 파일의 대화 참여자가 아닙니다',403);
  if(!env.MESSENGER_FILES)return err('파일 저장소에 연결되지 않았습니다',503);
  const object=await env.MESSENGER_FILES.get(f.r2_key);
  if(!object)return err('파일을 찾을 수 없습니다',404);
  const sanitized=String(f.name||'file').replace(/["\r\n\\]/g,'_').slice(0,120);
  return new Response(object.body,{headers:{
   'Content-Type':'application/octet-stream',
   'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(sanitized),
   'Content-Length':String(object.size),
   'Cache-Control':'private,no-store',
   'X-Content-Type-Options':'nosniff',
   'Content-Security-Policy':"default-src 'none'; sandbox"
  }});
 }
 if(path==='/api/messenger/private-files'&&method==='GET'){
  const peer=url.searchParams.get('peer');
  if(!await approved(db,peer)||peer===myId)return err('대화 상대를 확인해 주세요',403);
  const result=await db.prepare("SELECT id,name,mime,size,sender_id,created_at FROM yh_messenger_files WHERE kind='private' AND ((sender_id=? AND target_id=?) OR (sender_id=? AND target_id=?)) ORDER BY created_at DESC LIMIT 100").bind(myId,peer,peer,myId).all();
  return json({files:(result.results||[]).map(x=>({...publicAttachment(x),sender:x.sender_id,sentAt:x.created_at}))});
 }
 return null;
}
