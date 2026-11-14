/* Configuration activation deployment: ACCESS_DB and ADMIN_PASSWORD required. */
/* YOUNGHWA employee browser approval; Cloudflare Pages advanced mode.
 Bind ACCESS_DB (D1) and ADMIN_PASSWORD (encrypted environment secret).
 Fail closed if missing. Never commit credentials to GitHub. */
const enc=new TextEncoder();
const H={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const csp="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";
const style='*{box-sizing:border-box}body{font:16px system-ui,"Malgun Gothic",sans-serif;color:#23332c;background:#f3f7f4;margin:0}main{max-width:850px;margin:35px auto;padding:18px}.kicker{font-weight:700;letter-spacing:2px;color:#087846}h1{font-size:32px}.panel{background:#fff;border:1px solid #d8e7dc;border-radius:18px;padding:26px;margin:22px 0}label{display:block;font-weight:700;margin:14px 0 7px}input,select{font-size:16px;width:100%;padding:13px;border:1px solid #bfcec6;border-radius:9px;background:#fff;color:#23332c}button{padding:12px 17px;border:0;border-radius:9px;background:#008046;color:#fff;font-weight:700;cursor:pointer}button.danger{background:#b14b44}button.soft{background:#e2f1e7;color:#18683f}.row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.item{padding:16px 0;border-top:1px solid #e5ebe7}.sub{color:#68766e;line-height:1.7}.tag{background:#e6f3eb;border-radius:20px;padding:5px 10px;color:#387953}#notice{white-space:pre-wrap}@media(max-width:650px){h1{font-size:25px}.panel{padding:18px}}';
function page(title,content){return new Response('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+style+'</style></head><body><main>'+content+'</main></body></html>',{headers:{...H,'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':csp}})}
const json=(v,s=200)=>Response.json(v,{status:s,headers:H});
const fail=(v,s=400)=>json({error:v},s);
const cookie=(r,n)=>((r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='))||'').slice(n.length+1);
const setCookie=(r,n,v,age)=>{r.headers.append('Set-Cookie',n+'='+v+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+age);return r};
const rand=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const bytesToHex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
async function digest(s){return bytesToHex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
async function hmac(v,k){const key=await crypto.subtle.importKey('raw',enc.encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']);return bytesToHex(await crypto.subtle.sign('HMAC',key,enc.encode(v)))}
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
const originOK=r=>r.headers.get('origin')===new URL(r.url).origin;
async function data(r){if(Number(r.headers.get('content-length')||0)>4000)throw Error('oversized request');const s=await r.text();if(s.length>4000)throw Error('oversized request');return JSON.parse(s)}
/* Only cache a primitive success flag. Never share D1 I/O promises
   between Cloudflare request contexts. */
let schemaInitialized=false;
async function setup(db){
 if(schemaInitialized)return;
 await db.prepare("CREATE TABLE IF NOT EXISTS yh_browsers(id TEXT PRIMARY KEY,name TEXT NOT NULL,department TEXT NOT NULL,pc TEXT NOT NULL,code TEXT NOT NULL,status TEXT NOT NULL,requested TEXT NOT NULL)").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS yh_login(ip TEXT PRIMARY KEY,count INTEGER NOT NULL,started INTEGER NOT NULL)").run();
 schemaInitialized=true;
}
async function browser(r,db){const token=cookie(r,'yh_device');return /^[a-f0-9]{64}$/.test(token)?db.prepare('SELECT * FROM yh_browsers WHERE id=?').bind(await digest(token)).first():null}
async function admin(r,secret){const pieces=cookie(r,'yh_admin').split('.');if(pieces.length!==2||!(/^\d{13}$/.test(pieces[0]))||!(/^[a-f0-9]{64}$/.test(pieces[1]))||Number(pieces[0])<Date.now()||Number(pieces[0])>Date.now()+28800000)return false;return equal(pieces[1],await hmac(pieces[0],secret))}
const field=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\u0000-\u001f<>]/.test(v);
const departments=new Set(['본사','경리부','관리','생산','품질','연구소']);
const accessPage=()=>page('영화 후레싱 3D 직원 신청','<div class="kicker">YOUNGHWA · STAFF ACCESS</div><h1>직원 접속 신청</h1><p class="sub">관리자가 승인한 브라우저에서만 후레싱 3D를 이용할 수 있습니다.</p><p><a href="/admin" style="color:#087846;font-weight:700;text-decoration:underline">관리자는 비밀번호로 바로 로그인하기</a></p><section class="panel"><h2>이 PC의 브라우저 등록</h2><form id="apply"><label>이름</label><input id="name" maxlength="40" placeholder="홍길동" required><label for="department">부서</label><select id="department" required><option value="" selected disabled>부서를 선택하세요</option><option value="본사">본사</option><option value="경리부">경리부</option><option value="관리">관리</option><option value="생산">생산</option><option value="품질">품질</option><option value="연구소">연구소</option></select><label>사용 PC 이름</label><input id="pc" maxlength="60" placeholder="성명을 입력하면 자동으로 표시됩니다" required><p><button>관리자에게 접속 신청</button></p></form><p class="sub" id="status"></p><p id="notice"></p></section><script>const by=id=>document.getElementById(id);async function call(p,opt){const r=await fetch(p,{credentials:"same-origin",...opt}),d=await r.json();if(!r.ok)throw Error(d.error||"오류");return d}by("name").addEventListener("input",()=>{const n=by("name").value.trim();by("pc").value=n?n+" PC":""});async function refresh(){try{const x=await call("/api/status");if(x.status==="approved"){location.replace("/");return}by("apply").hidden=x.status==="pending";by("status").textContent=x.status==="pending"?"승인 대기 중 · 확인번호 "+x.code:x.status==="denied"?"기존 신청이 거절되었습니다. 다시 신청할 수 있습니다.":""}catch(e){by("notice").textContent=e.message}}by("apply").onsubmit=async e=>{e.preventDefault();try{const x=await call("/api/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:by("name").value,department:by("department").value,pc:by("pc").value})});by("notice").textContent="신청 완료 · 확인번호 "+x.code;refresh()}catch(err){by("notice").textContent=err.message}};refresh();setInterval(refresh,15000)</script>');
const adminPage=()=>page('영화 후레싱 3D 관리자','<div class="kicker">YOUNGHWA · ADMINISTRATION</div><div class="row"><h1>접속 승인 · 이용 관리</h1><button class="soft" id="refresh">새로고침</button></div><p class="sub">직원 이름·부서·PC 이름·확인번호를 확인하여 승인하세요. 허용된 브라우저만 접속할 수 있습니다.</p><section class="panel" id="login"><h2>관리자 로그인</h2><form id="loginform"><label>관리자 비밀번호</label><input type="password" id="pwd" required autocomplete="current-password"><p><button>로그인</button></p></form></section><div id="dashboard" hidden><section class="panel"><div class="row"><h2>관리자 전용 바로가기</h2><a href="/" style="display:inline-block;padding:13px 18px;background:#008046;color:#fff;text-decoration:none;border-radius:9px;font-weight:700">후레싱 3D 바로 사용</a></div><p class="sub">관리자는 이 브라우저에서 별도 접속 신청 없이 3D를 이용할 수 있습니다.</p></section><section class="panel"><h2>승인 대기 <span class="tag" id="pendingCount"></span></h2><div id="pending"></div></section><section class="panel"><h2>승인된 브라우저 <span class="tag" id="approvedCount"></span></h2><div id="approved"></div></section><section class="panel"><h2>접속 차단 <span class="tag" id="deniedCount"></span></h2><div id="denied"></div><button class="soft" id="logout">로그아웃</button></section></div><p id="notice"></p><script>const el=id=>document.getElementById(id);async function api(path,opt){const r=await fetch(path,{credentials:"same-origin",...opt}),v=await r.json();if(!r.ok)throw Error(v.error||"오류");return v}function card(x){const d=document.createElement("div");d.className="item";const t=document.createElement("b");t.textContent=x.name+" · "+x.department;d.append(t);const p=document.createElement("p");p.className="sub";p.textContent=x.pc+" · 확인번호 "+x.code+" · 신청 "+x.requested;d.append(p);const row=document.createElement("div");row.className="row";const actions=x.status==="pending"?[["접속 승인","approve",""],["거절","deny","danger"],["등록 삭제","delete","soft"]]:x.status==="approved"?[["접속 차단","deny","danger"],["등록 삭제","delete","soft"]]:[["재승인","approve",""],["등록 삭제","delete","soft"]];for(const [label,action,cls] of actions){const b=document.createElement("button");b.textContent=label;b.className=cls;b.onclick=async()=>{if(action==="delete"&&!confirm("등록을 삭제하시겠습니까?"))return;try{await api("/api/admin/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:x.id,action})});refresh()}catch(e){el("notice").textContent=e.message}};row.append(b)}d.append(row);return d}async function refresh(){try{const data=await api("/api/admin/list");el("login").hidden=true;el("dashboard").hidden=false;for(const k of ["pending","approved","denied"]){const a=data.devices.filter(v=>v.status===k),target=el(k);target.replaceChildren();el(k+"Count").textContent=a.length+(k==="approved"?"대":"건");if(!a.length)target.textContent="등록된 항목이 없습니다.";for(const x of a)target.append(card(x))}el("notice").textContent=""}catch(e){el("dashboard").hidden=true;el("login").hidden=false}}el("loginform").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:el("pwd").value})});el("pwd").value="";refresh()}catch(err){el("notice").textContent=err.message}};el("refresh").onclick=refresh;el("logout").onclick=async()=>{await api("/api/admin/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});location.reload()};refresh()</script>');
export default {
 async fetch(request,env){
  const u=new URL(request.url),p=u.pathname,m=request.method,db=env.ACCESS_DB;
  let phase='START';
  try{
   if(!db)return page('설정 점검','<div class="kicker">YOUNGHWA · STAFF ACCESS</div><h1>데이터베이스 연결 확인 필요</h1><p>Production의 ACCESS_DB가 배포에 반영되지 않았습니다.</p>');
   if(typeof env.ADMIN_PASSWORD!=='string')return page('설정 점검','<div class="kicker">YOUNGHWA · STAFF ACCESS</div><h1>비밀번호 설정 반영 확인 필요</h1><p>Production의 ADMIN_PASSWORD Secret이 배포에 반영되지 않았습니다.</p>');
   if(env.ADMIN_PASSWORD.length<14)return page('설정 점검','<div class="kicker">YOUNGHWA · STAFF ACCESS</div><h1>관리자 비밀번호 길이 확인</h1><p>등록된 관리자 비밀번호가 최소 14자 조건을 충족하지 않습니다. Cloudflare에서 14자 이상으로 변경하고 재배포하세요. 비밀번호를 채팅에 보내지 마세요.</p>');
   phase='DATABASE_INIT';
   await setup(db);
   phase='ROUTING';
   if(p==='/access'&&m==='GET')return accessPage();
   if(p==='/admin'&&m==='GET')return adminPage();
   if(p==='/api/status'&&m==='GET'){if(await admin(request,env.ADMIN_PASSWORD))return json({status:'approved',role:'admin'});const b=await browser(request,db);return json(b?{status:b.status,code:b.code}:{status:'new'});}
   if(p==='/api/apply'&&m==='POST'){
    if(!originOK(request))return fail('유효하지 않은 요청',403);
    const old=await browser(request,db);if(old&&old.status!=='denied')return fail('이미 신청했습니다',409);
    const x=await data(request);if(!field(x.name,40)||!departments.has(x.department)||!field(x.pc,60))return fail('신청 내용을 확인하세요');
    const token=rand(),id=await digest(token),code=rand().slice(0,8).toUpperCase();
    await db.prepare('INSERT INTO yh_browsers(id,name,department,pc,code,status,requested) VALUES(?,?,?,?,?,?,?)').bind(id,x.name.trim(),x.department.trim(),x.pc.trim(),code,'pending',new Date().toISOString()).run();
    return setCookie(json({status:'pending',code}),'yh_device',token,31536000);
   }
   phase='SESSION_VERIFY';
   const authorized=await admin(request,env.ADMIN_PASSWORD);
   if(p==='/api/admin/login'&&m==='POST'){
    if(!originOK(request))return fail('유효하지 않은 요청',403);
    phase='LOGIN_RATE_LIMIT';
    const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown'),now=Date.now(),r=await db.prepare('SELECT * FROM yh_login WHERE ip=?').bind(ip).first();
    if(r&&r.count>=5&&now-r.started<900000)return fail('로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요',429);
    phase='LOGIN_CHECK';
    const x=await data(request);
    if(typeof x.password!=='string'||!equal(await digest(x.password),await digest(env.ADMIN_PASSWORD))){
     const n=r&&now-r.started<900000?r.count+1:1,at=r&&now-r.started<900000?r.started:now;
     await db.prepare('INSERT INTO yh_login(ip,count,started) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET count=excluded.count,started=excluded.started').bind(ip,n,at).run();
     return fail('관리자 비밀번호가 올바르지 않습니다',401);
    }
    await db.prepare('DELETE FROM yh_login WHERE ip=?').bind(ip).run();
    phase='LOGIN_SESSION';
    const exp=String(now+28800000);return setCookie(json({ok:true}),'yh_admin',exp+'.'+await hmac(exp,env.ADMIN_PASSWORD),28800);
   }
   if(p==='/api/admin/logout'&&m==='POST'){if(!originOK(request))return fail('잘못된 요청',403);return setCookie(json({ok:true}),'yh_admin','',0)}
   if(p==='/api/admin/list'&&m==='GET'){
    if(!authorized)return fail('로그인이 필요합니다',401);
    phase='ADMIN_LIST';
    const rows=await db.prepare('SELECT id,name,department,pc,code,status,requested FROM yh_browsers ORDER BY requested DESC LIMIT 1000').all();return json({devices:rows.results});
   }
   if(p==='/api/admin/action'&&m==='POST'){
    if(!authorized||!originOK(request))return fail('권한 없음',403);
    phase='ADMIN_ACTION';
    const x=await data(request);
    if(typeof x.id!=='string'||!/^[a-f0-9]{64}$/.test(x.id)||!['approve','deny','delete'].includes(x.action))return fail('잘못된 요청');
    if(x.action==='delete')await db.prepare('DELETE FROM yh_browsers WHERE id=?').bind(x.id).run();
    else await db.prepare('UPDATE yh_browsers SET status=? WHERE id=?').bind(x.action==='approve'?'approved':'denied',x.id).run();
    return json({ok:true});
   }
   if(p==='/api/admin/version'&&m==='GET'){
    if(!authorized)return fail('관리자 권한이 필요합니다',401);
    phase='ASSET_DIAGNOSTICS';
    const u2=new URL('/index.html',u.origin);
    const r=await env.ASSETS.fetch(new Request(u2.toString(),{method:'GET'}));
    const html=await r.text();
    const versions=[...new Set(html.match(/v3\.\d{2}/g)||[])];
    return json({workerBuild:'diagnostic-2026-11-14',assetHttpStatus:r.status,assetSize:html.length,assetVersions:versions,rootHtml:html.includes('flashingCatalog'),hasInternalAngle:html.includes('오른쪽 사선 내각'),assetsContentType:r.headers.get('content-type')||''});
   }
   if(p.startsWith('/api/'))return fail('없는 경로',404);
   if(m!=='GET'&&m!=='HEAD')return fail('허용되지 않은 요청',405);
   if(!authorized){
    const b=await browser(request,db);
    if(!b||b.status!=='approved')return Response.redirect(u.origin+'/access',302);
   }
   const asset=await env.ASSETS.fetch(request),h=new Headers(asset.headers);h.set('Cache-Control','private,no-store');
   return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers:h});
  }catch(e){
   console.error('Staff access gate',p,'phase:',phase,e?.name,e?.message);
   if(p.startsWith('/api/'))return fail('서버 처리 오류 ('+phase+'). 관리자에게 알려주세요.',503);
   return page('접속 제한','<div class="kicker">YOUNGHWA · STAFF ACCESS</div><h1>접속 확인 중 오류</h1><p>안전을 위해 접속을 제한했습니다. 관리자에게 문의하세요.</p>');
  }
 }
};