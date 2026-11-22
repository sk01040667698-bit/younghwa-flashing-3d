import {PUBLIC_KEY,PORTAL,studioDocument} from './portal-3d.js';
const ORIGIN='https://donghyun-3d.pages.dev';
const H={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const cookieName=kind=>'__Host-yh_studio_'+kind;
const setCookie=(r,kind,value,age)=>{r.headers.append('Set-Cookie',cookieName(kind)+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age);return r};
function cookie(request,kind){const parts=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName(kind)+'='));return parts.length===1?parts[0].slice(cookieName(kind).length+1):''}
function denied(status=403){return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>3D 연결 안내</title><body style="background:white;color:#183329;font:16px/1.8 system-ui;padding:32px"><h1>3D 이용 권한을 확인해 주세요</h1><p>세션이 만료되었거나 권한을 확인할 수 없습니다.</p><a href="'+PORTAL+'/accessories">영화 플랫폼에서 다시 열기</a></body></html>',{status,headers:{...H,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}})}
let ready=false;
async function setup(db){if(!db)throw Error('storage');if(ready)return;await db.prepare('CREATE TABLE IF NOT EXISTS yh_portal_studio_sessions(token_hash TEXT PRIMARY KEY,kind TEXT NOT NULL,callback TEXT NOT NULL,expires INTEGER NOT NULL)').run();ready=true;}
export async function verifyHandoff(ticket){
 try{
  if(typeof ticket!=='string'||ticket.length>2000||!/^[A-Za-z0-9_-]+\.[a-f0-9]{128}$/.test(ticket))return null;
  const [payload,signature]=ticket.split('.'),claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))),now=Date.now();
  if(claims.v!==1||claims.iss!==PORTAL||claims.aud!==ORIGIN||!['flashing','panel'].includes(claims.kind)||!/^[a-f0-9]{64}$/.test(claims.jti)||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat>now+5000||claims.exp<=now||claims.exp-claims.iat!==60000)return null;
  const key=await crypto.subtle.importKey('jwk',PUBLIC_KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Uint8Array.from(signature.match(/../g),v=>parseInt(v,16)),enc.encode('younghwa-handoff-v1\n'+payload))?claims:null;
 }catch{return null}
}
async function platform(data){
 const response=await fetch(PORTAL+'/accessories/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(response.status!==200)return null;
 const result=await response.json();return result?.ok===true?result:null;
}
async function session(request,db,kind){
 const token=cookie(request,kind);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const hash=await digest(token),row=await db.prepare('SELECT * FROM yh_portal_studio_sessions WHERE token_hash=? AND kind=? AND expires>?').bind(hash,kind,Date.now()).first();
 if(!row)return null;
 const result=await platform({action:'check',callback:row.callback});
 if(!result||result.kind!==kind||result.expires!==row.expires){await db.prepare('DELETE FROM yh_portal_studio_sessions WHERE token_hash=?').bind(hash).run();return null;}
 return row;
}
// Only presentation code is selected; model and messenger code stay isolated.
const mascotFiles=new Set(['pansooni-dance-restored.webp','pansooni-hip-selected.webp','pansooni-bad-selected.webp','pansooni-heart-dance-hq.webp','pansooni-fire.webp','pansooni-message-alert.webp']);
function mascotMarkup(html,kind,nonce){
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const dance=scripts.filter(s=>s.includes('/* Four preserved dances:'));
 const opacity=scripts.filter(s=>s.includes('/* Store character visibility separately from opacity;'));
 const toggle=html.match(/<button[^>]+id="pansooniToggle"[\s\S]*?<\/button>/)?.[0];
 const slider=html.match(/<label[^>]*class="pansooni-opacity-control"[\s\S]*?<\/label>/)?.[0];
 if(dance.length!==1||opacity.length!==1||!toggle||!slider)return '';
 const css=`.studio-mascot-controls{position:fixed;top:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;z-index:140;background:#172d3e;border:1px solid #59748a;border-radius:12px;padding:7px 10px;color:white;font:12px system-ui}.pansooni-toggle{background:#253b4c;color:white;border:1px solid #7795a8;border-radius:8px;padding:8px;cursor:pointer;white-space:nowrap}.pansooni-opacity-control{display:flex;flex-direction:column;gap:3px;width:110px}.pansooni-opacity-control span{display:flex;justify-content:space-between}.pansooni-opacity-control input{width:100%;margin:0}.pansooni-fire-mascot{position:fixed;left:0;top:0;width:110px;height:110px;object-fit:contain;cursor:grab;touch-action:none;user-select:none;z-index:135;filter:drop-shadow(0 4px 7px #0006)}.pansooni-fire-mascot[hidden]{display:none!important}.pansooni-dragging{cursor:grabbing}@media(max-width:780px){.pansooni-fire-mascot{width:80px;height:80px}.studio-mascot-controls{top:auto;bottom:8px}}`;
 const code=(dance[0]+'\n'+opacity[0]).replaceAll("'assets/","'/studio/"+kind+"/mascot/");
 return '<style>'+css+'</style><div class="studio-mascot-controls">'+toggle+slider+'</div><img class="pansooni-fire-mascot" alt="판순이 · 드래그하여 이동" width="110" height="110" draggable="false"><script nonce="'+nonce+'">'+code+'</script>';
}
export function studioShell(kind,sourceHtml=""){
 const nonce=random();
 const body='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+(kind==='flashing'?'부자재 3D':'샌드위치패널 3D')+'</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}iframe{display:block;border:0;width:100%;height:100%}</style><body><iframe title="3D 작업실" sandbox="allow-scripts allow-downloads" src="/studio/'+kind+'/document"></iframe><script nonce="'+nonce+'">(()=>{let busy=false,stopped=false;const frame=document.querySelector("iframe");async function check(){if(busy||stopped)return;busy=true;try{const r=await fetch("/studio/'+kind+'/status",{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();frame.hidden=false}catch{stopped=true;frame.remove();location.replace("/studio/'+kind+'?expired=1")}finally{busy=false}}setInterval(check,15000);addEventListener("pageshow",check);document.addEventListener("visibilitychange",()=>{if(!document.hidden){frame.hidden=true;check()}})})();</script>'+mascotMarkup(sourceHtml,kind,nonce)+'</body></html>';
 return new Response(body,{headers:{...H,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; frame-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
export async function studioSession(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/studio/'))return null;
 try{
  if(url.origin!==ORIGIN)return denied();
  const db=env.ACCESS_DB;await setup(db);
  if(path==='/studio/handoff'){
   if(request.method!=='POST'||request.headers.get('origin')!==PORTAL||!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type')||''))return denied();
   const reader=request.body?.getReader();if(!reader)return denied();let body='',size=0;const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3000){await reader.cancel();return denied()}body+=decoder.decode(value,{stream:true})}body+=decoder.decode();
   const form=new URLSearchParams(body);if(form.getAll('ticket').length!==1)return denied();
   const ticket=form.get('ticket'),claims=await verifyHandoff(ticket);if(!claims)return denied();
   const grant=await platform({action:'claim',ticket});
   if(!grant||grant.kind!==claims.kind||typeof grant.callback!=='string'||!/^[a-f0-9]{64}$/.test(grant.callback)||!Number.isSafeInteger(grant.expires)||grant.expires<=Date.now()||grant.expires>Date.now()+3600000)return denied();
   const token=random();await db.prepare('DELETE FROM yh_portal_studio_sessions WHERE expires<=?').bind(Date.now()).run();
   await db.prepare('INSERT INTO yh_portal_studio_sessions(token_hash,kind,callback,expires) VALUES(?,?,?,?)').bind(await digest(token),claims.kind,grant.callback,grant.expires).run();
   return setCookie(new Response(null,{status:303,headers:{...H,Location:ORIGIN+'/studio/'+claims.kind}}),claims.kind,token,Math.max(1,Math.floor((grant.expires-Date.now())/1000)));
  }
  const match=/^\/studio\/(flashing|panel)(?:\/(document|status|mascot\/[^/]+))?$/.exec(path);
  if(!match||request.method!=='GET')return denied();
  const [,kind,part]=match;
  if(url.search||!await session(request,db,kind))return setCookie(denied(),kind,'',0);
  if(part?.startsWith('mascot/')){
   const name=part.slice(7);if(!mascotFiles.has(name))return denied();
   const asset=await env.ASSETS.fetch(new Request(new URL('/assets/'+name,ORIGIN)));
   return new Response(asset.body,{status:asset.status,headers:{...H,'Content-Type':'image/webp'}});
  }
  if(part==='status')return Response.json({ok:true},{headers:H});
  if(part==='document'){
   // Direct navigation returns to the trusted shell which performs revocation polling.
   if(request.headers.get('sec-fetch-dest')!=='iframe')return new Response(null,{status:303,headers:{...H,Location:ORIGIN+'/studio/'+kind}});
   const source=await env.ASSETS.fetch(new Request(new URL('/index.html',ORIGIN)));if(!source.ok)return denied(503);
   return new Response(studioDocument(await source.text(),kind),{headers:{...H,'Content-Type':'text/html; charset=utf-8','X-Younghwa-Studio':'scoped-v1','Content-Security-Policy':"sandbox allow-scripts allow-downloads; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; form-action 'none'"}});
  }
  const source=await env.ASSETS.fetch(new Request(new URL('/index.html',ORIGIN)));
  return studioShell(kind,source.ok?await source.text():'');
 }catch{return denied(503)}
}
