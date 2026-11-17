import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const original=readFileSync(new URL('./portal-3d.js',import.meta.url),'utf8');
const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const source=original.replace(/export const PUBLIC_KEY=.*?;/,'export const PUBLIC_KEY='+JSON.stringify(keys.publicKey.export({format:'jwk'}))+';');
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function request(kind='flashing',age=0){const url='https://donghyun-3d.pages.dev/portal-3d/'+kind,stamp=String(Date.now()+age);const signature=sign('sha256',Buffer.from('younghwa-studio-v1\nGET\n'+url+'\n'+stamp),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('hex');return new Request(url,{headers:{'X-Younghwa-Time':stamp,'X-Younghwa-Signature':signature}});}
test('signed scope cannot be forged, changed, expired, or supplied by URL',async()=>{
 assert.equal(await mod.verifyStudioRequest(request()),'flashing');assert.equal(await mod.verifyStudioRequest(request('panel')),'panel');
 for(const r of [new Request('https://donghyun-3d.pages.dev/portal-3d/panel'),request('panel',-30000),new Request('https://donghyun-3d.pages.dev/portal-3d/panel?allowed=all'),new Request('https://donghyun-3d.pages.dev/portal-3d/panel',{headers:request().headers}),new Request(request(),{method:'POST'})])assert.equal(await mod.verifyStudioRequest(r),null);
});
test('denied external request never reads source; authorized scope contains only selected model',async()=>{
 let reads=0;const env={ASSETS:{async fetch(){reads++;return new Response(html)}}};
 assert.equal((await mod.portalStudio(new Request('https://donghyun-3d.pages.dev/portal-3d/flashing'),env)).status,403);assert.equal(reads,0);
 for(const kind of ['flashing','panel']){const response=await mod.portalStudio(request(kind),env);assert.equal(response.status,200);const doc=await response.text();assert.equal(doc.includes('const flashingTree='),kind==='flashing');assert.equal(doc.includes('extrudeBentSkin(male48)'),kind==='panel');assert.equal(doc.includes('id="yhuCanvas"'),kind==='panel');assert.equal(doc.includes('id="modelSelect"'),kind==='flashing');assert.ok(!doc.includes('pansooni-messenger.js'));for(const s of doc.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(s[1]);}
});
test('source layout changes fail closed rather than send combined original',()=>{assert.throws(()=>mod.studioDocument('<html>changed</html>','panel'));});
test('legacy approved browser cannot fetch combined HTML, model module or forged portal route',async()=>{
 const workerSource=readFileSync(new URL('./_worker.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 const prelude='const pansooniAI={};const messengerExtensions=()=>null;const PORTAL="https://younghwa-fire-notices.donghyuny.chatgpt.site";const portalStudio=async()=>new Response("denied",{status:403});';
 const worker=(await import('data:text/javascript;base64,'+Buffer.from(prelude+workerSource).toString('base64'))).default;
 let assets=0;
 const db={prepare(sql){return {bind(){return this},async run(){return {}},async all(){return {results:[]}},async first(){return sql.includes('FROM yh_browsers')?{id:'legacy',name:'test',status:'approved'}:null}}}};
 const env={ACCESS_DB:db,ADMIN_PASSWORD:'test-password-not-production',ASSETS:{async fetch(){assets++;return new Response(html)}}};
 for(const path of ['/','/index.html','/index.html?tab=panel','/portal-3d.js','/portal-3d/panel?allowed=all']){
  const r=await worker.fetch(new Request('https://donghyun-3d.pages.dev'+path,{headers:{cookie:'yh_device='+'a'.repeat(64)}}),env);
  assert.ok([302,403].includes(r.status));assert.equal(assets,0);
 }
});
