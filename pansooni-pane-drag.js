/* Move/resize Pansooni main AI and staff messenger window.
 * Persist this pane independently from the 1:1 floating chat window.
 * Move using the top title bar; resize using any of four corners.
 */
(function(){
 'use strict';
 const pane=document.getElementById('pansooniChat');
 const handle=pane?.querySelector('.pansooni-chat-head');
 if(!pane||!handle)return;
 const key='yh-pansooni-main-window-geometry-v1';
 const minWidth=295,minHeight=290;
 let geometry={x:0,y:0,w:365,h:510};
 let dragging=null,resizing=null;
 const viewport=()=>({w:Math.max(100,window.innerWidth),h:Math.max(100,window.innerHeight)});
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function apply(){
  const view=viewport(),margin=5;
  const minW=Math.min(minWidth,view.w-2*margin);
  const minH=Math.min(minHeight,view.h-2*margin);
  geometry.w=clamp(geometry.w,minW,view.w-2*margin);
  geometry.h=clamp(geometry.h,minH,view.h-2*margin);
  geometry.x=clamp(geometry.x,margin,view.w-geometry.w-margin);
  geometry.y=clamp(geometry.y,margin,view.h-geometry.h-margin);
  pane.style.left=Math.round(geometry.x)+'px';
  pane.style.top=Math.round(geometry.y)+'px';
  pane.style.width=Math.round(geometry.w)+'px';
  pane.style.height=Math.round(geometry.h)+'px';
  pane.style.right='auto';
  pane.style.bottom='auto';
 }
 function persist(){
  try{localStorage.setItem(key,JSON.stringify(geometry))}catch(_){}
 }
 function restore(){
  const v=viewport();
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}
  if(saved&&['x','y','w','h'].every(k=>Number.isFinite(saved[k]))){
   geometry={x:saved.x,y:saved.y,w:saved.w,h:saved.h};
  }else{
   geometry.w=Math.min(365,v.w-10);
   geometry.h=Math.min(510,Math.max(290,v.h-90));
   geometry.x=v.w-geometry.w-15;
   geometry.y=v.h-geometry.h-15;
  }
  apply();
 }
 handle.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,a,input,[data-pansooni-pane-resize]'))return;
  dragging={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:geometry.x,y:geometry.y};
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
 });
 handle.addEventListener('pointermove',event=>{
  if(!dragging||dragging.id!==event.pointerId)return;
  geometry.x=dragging.x+event.clientX-dragging.clientX;
  geometry.y=dragging.y+event.clientY-dragging.clientY;
  apply();
  event.preventDefault();
 });
 const stopDrag=event=>{
  if(!dragging||dragging.id!==event.pointerId)return;
  dragging=null;
  persist();
 };
 handle.addEventListener('pointerup',stopDrag);
 handle.addEventListener('pointercancel',stopDrag);
 handle.addEventListener('lostpointercapture',stopDrag);
 for(const grip of pane.querySelectorAll('[data-pansooni-pane-resize]')){
  grip.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   resizing={id:event.pointerId,corner:grip.dataset.pansooniPaneResize,startX:event.clientX,startY:event.clientY,...geometry};
   grip.setPointerCapture(event.pointerId);
   event.preventDefault();
   event.stopPropagation();
  });
  grip.addEventListener('pointermove',event=>{
   if(!resizing||resizing.id!==event.pointerId)return;
   const r=resizing,view=viewport(),dx=event.clientX-r.startX,dy=event.clientY-r.startY;
   const left=r.corner.includes('l'),top=r.corner.includes('t');
   const minW=Math.min(minWidth,view.w-10),minH=Math.min(minHeight,view.h-10);
   const rightEdge=r.x+r.w,bottomEdge=r.y+r.h;
   if(left){
    geometry.x=clamp(r.x+dx,5,rightEdge-minW);
    geometry.w=rightEdge-geometry.x;
   }else{
    geometry.x=r.x;
    geometry.w=clamp(r.w+dx,minW,view.w-r.x-5);
   }
   if(top){
    geometry.y=clamp(r.y+dy,5,bottomEdge-minH);
    geometry.h=bottomEdge-geometry.y;
   }else{
    geometry.y=r.y;
    geometry.h=clamp(r.h+dy,minH,view.h-r.y-5);
   }
   apply();
   event.preventDefault();
   event.stopPropagation();
  });
  const end=event=>{
   if(!resizing||resizing.id!==event.pointerId)return;
   resizing=null;
   persist();
  };
  grip.addEventListener('pointerup',end);
  grip.addEventListener('pointercancel',end);
  grip.addEventListener('lostpointercapture',end);
 }
 window.addEventListener('resize',()=>{apply();persist()});
 restore();
})();