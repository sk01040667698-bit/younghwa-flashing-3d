// Server-to-server only. Private signing key stays in the platform runtime secret.
export const PUBLIC_KEY={"kty":"EC","x":"9Npse7GCWcMftLijR4-zzydQeASjo9Pa1oHVi3ch1Zw","y":"tgJrsU7fIyAVgxJjern293r1hBOjO6lbCVdRpDw0SlA","crv":"P-256"};
export const PORTAL='https://younghwa-fire-notices.donghyuny.chatgpt.site';
const encoder=new TextEncoder();
export async function verifyStudioRequest(request){
 try{
  const url=new URL(request.url),match=/^\/portal-3d\/(flashing|panel)$/.exec(url.pathname);
  if(!match||url.search||request.method!=='GET')return null;
  const stamp=request.headers.get('X-Younghwa-Time')||'',signature=request.headers.get('X-Younghwa-Signature')||'';
  if(!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>15000||!/^[a-f0-9]{128}$/.test(signature))return null;
  const key=await crypto.subtle.importKey('jwk',PUBLIC_KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));
  const valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes,encoder.encode('younghwa-studio-v1\nGET\n'+url.origin+url.pathname+'\n'+stamp));
  return valid?match[1]:null;
 }catch{return null}
}
function between(html,start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 if(a<0||b<0||html.indexOf(start,a+start.length)>=0)throw Error('Studio source format changed');
 return html.slice(a,b);
}
// Select server-side BEFORE sending HTML: the other model code is never delivered.
export function studioDocument(html,kind){
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const flash=scripts.filter(s=>s.includes("const canvas=document.getElementById('view'),ctx="));
 const panel=scripts.filter(s=>s.includes('/* YHU-SR visual study:'));
 if(flash.length!==1||panel.length!==1)throw Error('Studio scripts changed');
 const styles=html.match(/<style>[\s\S]*?<\/style>/)?.[0];
 if(!styles)throw Error('Studio styles missing');
 const title=kind==='flashing'?'부자재 3D':'샌드위치패널 3D';
 let body,code;
 if(kind==='flashing'){
  body=between(html,'<div class="shell" id="flashingStudio"','<section id="sandwichStudio"')+
   between(html,'<dialog id="pngPreviewDialog"','<script>');
  code=flash[0];
 }else if(kind==='panel'){
  body=between(html,'<section id="sandwichStudio"','<dialog id="pngPreviewDialog"').replace('aria-labelledby="sandwichStudioTab" hidden','aria-label="샌드위치패널 3D"');
  code=panel[0]+`
document.querySelectorAll('[data-sandwich-type]').forEach(btn=>btn.addEventListener('click',()=>{
 const type=btn.dataset.sandwichType;
 document.querySelectorAll('[data-sandwich-type]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
 document.getElementById('sandwichProductHeading').textContent=type+' 패널';
 document.getElementById('sandwichPreviewTitle').textContent=type+' 제품 준비 중';
}));
`;
 }else throw Error('Unknown studio');
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'+styles+'</head><body><header><strong>YOUNGHWA / '+title+'</strong><span id="versionLabel"></span></header>'+body+'<script>'+code+'</script></body></html>';
}
export async function portalStudio(request,env){
 const kind=await verifyStudioRequest(request);
 if(!kind)return new Response('권한 없음',{status:403,headers:{'Cache-Control':'no-store'}});
 const source=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url)));
 if(!source.ok)return new Response('3D 원본을 불러올 수 없습니다.',{status:503});
 try{return new Response(studioDocument(await source.text(),kind),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Younghwa-Studio':'scoped-v1','X-Content-Type-Options':'nosniff'}});}
 catch{return new Response('3D 원본 구조가 변경되어 권한 분리를 확인해야 합니다.',{status:503});}
}

