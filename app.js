'use strict';
const menu=document.querySelector('.menu-toggle');const nav=document.querySelector('#nav');
function closeMenu(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&nav.classList.contains('open')){closeMenu();menu.focus();return;}
  if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&(e.key==='z'||e.key==='Z')){
    const t=document.activeElement;
    if(t&&/^(INPUT|TEXTAREA)$/.test(t.tagName))return;
    e.preventDefault();undo();
  }
});

const canvas=document.querySelector('#doodle');const ctx=canvas.getContext('2d');
const hint=document.querySelector('.canvas-hint');const status=document.querySelector('#drawing-status');
const W=1200,H=420,PAPER='#fffdf6',TAU=Math.PI*2,TOL=34;
const DPR=Math.min(window.devicePixelRatio||1,2);
canvas.width=W*DPR;canvas.height=H*DPR;ctx.scale(DPR,DPR);ctx.lineJoin='round';ctx.lineCap='round';
let color='#ed6148',brush='round',size=12,drawing=false,last=null;

const undoBtn=document.querySelector('#undo');
const history=[],HISTORY_MAX=25;
function syncUndo(){undoBtn.disabled=history.length===0;}
function pushHistory(){
  try{history.push(canvas.toDataURL());}catch(err){return;}
  if(history.length>HISTORY_MAX)history.shift();
  syncUndo();
}
function undo(){
  if(!history.length){status.textContent='Nothing to undo yet.';return;}
  const url=history.pop();
  const img=new Image();
  img.onload=()=>{
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0);
    ctx.restore();
    last=null;drawing=false;
    status.textContent='Undid the last step.';
  };
  img.src=url;
  syncUndo();
}
syncUndo();

function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}

function dot(x,y){
  ctx.save();
  if(brush==='eraser'){ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,size*.75,0,TAU);ctx.fill();ctx.restore();return;}
  ctx.fillStyle=color;
  if(brush==='donut'){ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.5,size*.48);ctx.beginPath();ctx.arc(x,y,size*.66,0,TAU);ctx.stroke();}
  else if(brush==='splatter'){for(let i=0;i<5;i++){const a=Math.random()*TAU,d=Math.random()*size*.8;ctx.beginPath();ctx.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,Math.max(1,size*.16),0,TAU);ctx.fill();}}
  else{ctx.shadowColor=color;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(x,y,size/2,0,TAU);ctx.fill();}
  ctx.restore();
}
function strokeTo(p){
  if(!last){dot(p.x,p.y);last=p;return;}
  const dx=p.x-last.x,dy=p.y-last.y,dist=Math.hypot(dx,dy),step=Math.max(1,size*.35),n=Math.max(1,Math.ceil(dist/step));
  for(let i=1;i<=n;i++)dot(last.x+dx*i/n,last.y+dy*i/n);
  last=p;
}

/* Paint-bucket flood fill. Scanline algorithm over the raw pixel buffer so it
   stays fast on the full-resolution canvas. Anti-aliased brush edges are
   treated as a hard boundary: fully transparent pixels (a<=8) belong to an
   empty region, solid ones (a>200) belong to a painted region, and the soft
   pixels between them stop the fill instead of letting it bleed through. */
function floodFill(sx,sy,hex){
  const w=canvas.width,h=canvas.height;
  const px=Math.min(w-1,Math.max(0,Math.round(sx*DPR)));
  const py=Math.min(h-1,Math.max(0,Math.round(sy*DPR)));
  const img=ctx.getImageData(0,0,w,h);const d=img.data;
  const i0=(py*w+px)*4;
  const tr=d[i0],tg=d[i0+1],tb=d[i0+2],ta=d[i0+3];
  const[fr,fg,fb]=rgb(hex);
  const solid=ta>8;
  if(solid&&Math.abs(tr-fr)<=TOL&&Math.abs(tg-fg)<=TOL&&Math.abs(tb-fb)<=TOL)return false;
  const near=solid
    ?i=>d[i+3]>200&&Math.abs(d[i]-tr)<=TOL&&Math.abs(d[i+1]-tg)<=TOL&&Math.abs(d[i+2]-tb)<=TOL
    :i=>d[i+3]<=8;
  const stack=[px,py];
  let filled=0;
  while(stack.length){
    let y=stack.pop(),x=stack.pop();
    let i=(y*w+x)*4;
    while(y>=0&&near(i)){y--;i-=w*4;}
    y++;i+=w*4;
    let spanL=false,spanR=false;
    while(y<h&&near(i)){
      d[i]=fr;d[i+1]=fg;d[i+2]=fb;d[i+3]=255;filled++;
      if(x>0){if(near(i-4)){if(!spanL){stack.push(x-1,y);spanL=true;}}else spanL=false;}
      if(x<w-1){if(near(i+4)){if(!spanR){stack.push(x+1,y);spanR=true;}}else spanR=false;}
      y++;i+=w*4;
    }
  }
  if(!filled)return false;
  ctx.putImageData(img,0,0);
  return true;
}

/* Also sprach Zarathustra, as Phish jams it — transcribed from the family's
   tab: the sunrise figure, the Cmin7 bass line, the noodling over it, the riff
   that builds the jam, the C/G–Am–G–C turnaround, and a segue back to the top.

   `s` is the note's rhythmic slot in seconds, not a held length — it is how
   long that note owns before the next one is due, so the phrase keeps its
   proper spacing whatever the brush is doing. Tempo is 120bpm:
   quarter 0.5s, eighth 0.25s, sixteenth 0.125s. */
const MOTIF=[
  /* 1 — sunrise figure: C–G–C, then the major third turns minor */
  {f:130.81,s:1.00},  /* C3   half */
  {f:261.63,s:0.50},  /* C4   quarter */
  {f:392.00,s:0.50},  /* G4   quarter */
  {f:523.25,s:0.50},  /* C5   quarter */
  {f:659.26,s:0.25},  /* E5   eighth */
  {f:622.25,s:1.00},  /* Eb5  half */
  /* 2 — the bass line in Cmin7, eighths:
         C Bb A G E G  |  C Bb A G F G F G F E */
  {f:261.63,s:0.25},  /* C4  */
  {f:233.08,s:0.25},  /* Bb3 */
  {f:220.00,s:0.25},  /* A3  */
  {f:196.00,s:0.25},  /* G3  */
  {f:164.81,s:0.25},  /* E3  */
  {f:196.00,s:0.25},  /* G3  */
  {f:261.63,s:0.25},  /* C4  */
  {f:233.08,s:0.25},  /* Bb3 */
  {f:220.00,s:0.25},  /* A3  */
  {f:196.00,s:0.25},  /* G3  */
  {f:174.61,s:0.25},  /* F3  */
  {f:196.00,s:0.25},  /* G3  */
  {f:174.61,s:0.25},  /* F3  */
  {f:196.00,s:0.25},  /* G3  */
  {f:174.61,s:0.25},  /* F3  */
  {f:164.81,s:0.50},  /* E3   settles */
  /* 3 — the noodling: Eb4 Bb4 C5 C4, then Eb4 Bb4 C5 Bb3 G3 C3 */
  {f:311.13,s:0.25},  /* Eb4 — G string 8 */
  {f:466.16,s:0.25},  /* Bb4 — B string 11 */
  {f:523.25,s:0.25},  /* C5  — high E string 8 */
  {f:261.63,s:0.50},  /* C4  — D string 10 */
  {f:311.13,s:0.25},  /* Eb4 */
  {f:466.16,s:0.25},  /* Bb4 */
  {f:523.25,s:0.25},  /* C5  */
  {f:233.08,s:0.25},  /* Bb3 — D string 8 */
  {f:196.00,s:0.25},  /* G3  — A string 10 */
  {f:130.81,s:0.50},  /* C3  — low E string 8 */
  /* 4 — the riff builds the jam. C/Cm then Cm/C, then the run over C → F → Fm6 → C/G */
  {f:261.63,s:0.50},  /* C4  — D string 10 */
  {f:392.00,s:0.25},  /* G4  — G string 12 */
  {f:523.25,s:0.25},  /* C5  — B string 13 */
  {f:659.26,s:0.25},  /* E5  — B string 17 */
  {f:622.25,s:0.75},  /* Eb5 — B string 16, the Cm */
  {f:261.63,s:0.50},  /* C4  */
  {f:392.00,s:0.25},  /* G4  */
  {f:523.25,s:0.25},  /* C5  */
  {f:622.25,s:0.25},  /* Eb5 */
  {f:659.26,s:0.75},  /* E5  */
  {f:261.63,s:0.25},  /* C4  */
  {f:392.00,s:0.25},  /* G4  */
  {f:523.25,s:0.25},  /* C5  */
  {f:698.46,s:0.25},  /* F5  — B string 18, the F chord */
  {f:440.00,s:0.125}, /* A4  — G string 14 */
  {f:493.88,s:0.125}, /* B4  — G string 16 */
  {f:523.25,s:0.125}, /* C5  — G string 17 */
  {f:587.33,s:0.125}, /* D5  — B string 15 */
  {f:659.26,s:0.125}, /* E5  — B string 17 */
  {f:698.46,s:0.125}, /* F5  — B string 18 */
  {f:783.99,s:0.25},  /* G5  — high E string 15 */
  /* 5 — turnaround into the finale: C/G  Am  G  C */
  {f:659.26,s:0.25},  /* E5  */
  {f:698.46,s:0.25},  /* F5  */
  {f:783.99,s:0.25},  /* G5  */
  {f:880.00,s:0.25},  /* A5  */
  {f:987.77,s:0.25},  /* B5  */
  {f:1046.50,s:1.00}, /* C6   the resolve */
  /* 6 — finale segue: falls to the low C and straight into bar 1 */
  {f:466.16,s:0.25},  /* Bb4 */
  {f:392.00,s:0.25},  /* G4  */
  {f:311.13,s:0.25},  /* Eb4 */
  {f:261.63,s:0.25},  /* C4  */
  {f:130.81,s:1.00}   /* C3   and the jam starts again */
];
let idx=0,nextAt=0,activeUntil=0,audio=null,chimesOn=false,timer=null;
const chimeBtn=document.querySelector('#chimes'),chimeState=document.querySelector('#chime-state');
function seqNote(){
  const m=MOTIF[idx++%MOTIF.length];
  const t=audio.currentTime;
  const hold=Math.min(Math.max(m.s*0.9,0.10),1.5);
  const atk=Math.min(0.02,hold*0.25);
  const o=audio.createOscillator(),g=audio.createGain();
  o.type='triangle';o.frequency.value=m.f;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.17,t+atk);
  g.gain.exponentialRampToValueAtTime(.0001,t+hold);
  o.connect(g);g.connect(audio.destination);
  o.start(t);o.stop(t+hold+.03);
  nextAt=t+m.s;
}
function tick(){
  if(!chimesOn||!audio)return;
  const t=audio.currentTime;
  if(t<activeUntil&&t>=nextAt){
    if(t-nextAt>0.6)nextAt=t;   /* tab was asleep — resync instead of machine-gunning */
    else seqNote();
  }
}
/* Painting wakes the sequencer and keeps it awake; it then keeps its own time. */
function paintWake(){
  if(!audio)return;
  activeUntil=audio.currentTime+0.9;
}
chimeBtn.addEventListener('click',()=>{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){status.textContent='Audio is not available in this browser.';return;}
  if(!audio)audio=new AC();
  if(audio.state==='suspended')audio.resume();
  chimesOn=!chimesOn;
  chimeBtn.setAttribute('aria-pressed',String(chimesOn));
  chimeState.textContent=chimesOn?'on':'off';
  if(chimesOn){
    idx=0;nextAt=audio.currentTime;activeUntil=0;   /* always start at the top */
    if(!timer)timer=setInterval(tick,20);
    status.textContent='Chimes on. Start painting and the jam runs from the top — it keeps its own time, and your brush keeps it going.';
  }else{
    if(timer){clearInterval(timer);timer=null;}
    status.textContent='Chimes off.';
  }
});

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();
  hint.classList.add('hidden');
  const p=point(e);
  if(brush==='fill'){
    pushHistory();
    if(floodFill(p.x,p.y,color)){status.textContent='Filled that area.';}
    else{history.pop();syncUndo();status.textContent='That area is already that colour.';}
    return;
  }
  pushHistory();
  drawing=true;canvas.setPointerCapture(e.pointerId);last=null;strokeTo(p);paintWake();
});
canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);strokeTo(p);paintWake();});
function endDrawing(){drawing=false;last=null;}
canvas.addEventListener('pointerup',endDrawing);canvas.addEventListener('pointercancel',endDrawing);canvas.addEventListener('lostpointercapture',endDrawing);

document.querySelectorAll('.swatch').forEach(button=>button.addEventListener('click',()=>{color=button.dataset.color;document.querySelectorAll('.swatch').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});status.textContent=button.getAttribute('aria-label')+' selected.';}));
document.querySelectorAll('.brush').forEach(button=>button.addEventListener('click',()=>{
  brush=button.dataset.brush;
  document.querySelectorAll('.brush').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
  canvas.style.cursor=brush==='fill'?'cell':'crosshair';
  status.textContent=button.textContent+' tool selected.';
}));
const sizeInput=document.querySelector('#brush-size');sizeInput.addEventListener('input',()=>{size=Number(sizeInput.value);status.textContent='Brush size '+size+'.';});

undoBtn.addEventListener('click',undo);
document.querySelector('#clear').addEventListener('click',()=>{pushHistory();ctx.clearRect(0,0,W,H);hint.classList.remove('hidden');last=null;status.textContent='Drawing space cleared. Ready for a new idea.';});
document.querySelector('#save').addEventListener('click',()=>{const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const out=output.getContext('2d');out.fillStyle=PAPER;out.fillRect(0,0,output.width,output.height);out.drawImage(canvas,0,0);output.toBlob(blob=>{if(!blob){status.textContent='The drawing could not be saved. Please try again.';return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='my-little-color.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='Your doodle is ready to save as my-little-color.png.';},'image/png');});
const prompts=['draw a flower that’s never existed before.','give a fish the most surprising colors you can imagine.','draw the sound of your favorite song.','turn three wiggly lines into a friendly creature.','make a garden using only circles and dots.','draw a bird with a wonderfully unexpected hairstyle.','invent a leaf from an imaginary planet.','draw something small that made you smile today.'];let promptIndex=0;document.querySelector('#new-prompt').addEventListener('click',()=>{promptIndex=(promptIndex+1)%prompts.length;document.querySelector('#prompt').textContent='A little nudge: '+prompts[promptIndex];});
