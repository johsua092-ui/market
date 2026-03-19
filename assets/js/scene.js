/* OXYX STORE — scene.js */
'use strict';
(function initBG(){
  if(typeof THREE==='undefined')return;
  const c=document.getElementById('bgCanvas');if(!c)return;
  const R=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true});
  R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);R.setClearColor(0,0);
  const S=new THREE.Scene(),C=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,1000);C.position.z=28;
  const N=1200,pos=new Float32Array(N*3),col=new Float32Array(N*3);
  const pal=[new THREE.Color(0x00ffd5),new THREE.Color(0xb06dff),new THREE.Color(0xff2d55),new THREE.Color(0x0055ff)];
  for(let i=0;i<N;i++){pos[i*3]=(Math.random()-.5)*120;pos[i*3+1]=(Math.random()-.5)*120;pos[i*3+2]=(Math.random()-.5)*80;const c2=pal[i%4];col[i*3]=c2.r;col[i*3+1]=c2.g;col[i*3+2]=c2.b;}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('color',new THREE.BufferAttribute(col,3));
  const pts=new THREE.Points(pg,new THREE.PointsMaterial({size:.22,vertexColors:true,transparent:true,opacity:.55,sizeAttenuation:true}));S.add(pts);
  const sh=[];
  function mk(g,color,x,y,z,sc){const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.09}));m.position.set(x,y,z);m.scale.setScalar(sc);m.userData={rx:(Math.random()-.5)*.008,ry:(Math.random()-.5)*.01,rz:(Math.random()-.5)*.006,fy:Math.random()*Math.PI*2,fs:.003+Math.random()*.003,fa:.6+Math.random()*.9,oy:y};S.add(m);sh.push(m);}
  const IC=new THREE.IcosahedronGeometry(1,0),OC=new THREE.OctahedronGeometry(1,0),TT=new THREE.TetrahedronGeometry(1,0);
  mk(IC,0x00ffd5,-24,8,-10,5.5);mk(IC,0xb06dff,20,-5,-16,4.5);mk(IC,0xff2d55,-14,-9,-8,3.5);mk(IC,0x00ffd5,22,13,-22,6);
  mk(OC,0xb06dff,-20,-3,-18,4.5);mk(OC,0x00ffd5,9,16,-14,4);mk(TT,0xff2d55,15,-13,-10,3.5);mk(TT,0xb06dff,-16,15,-18,4.5);
  mk(new THREE.BoxGeometry(1,1,1),0x00ffd5,0,-16,-14,5);
  const tk=new THREE.Mesh(new THREE.TorusKnotGeometry(3,.7,80,8),new THREE.MeshBasicMaterial({color:0x00ffd5,wireframe:true,transparent:true,opacity:.035}));tk.position.set(0,0,-28);S.add(tk);
  let mx=0,my=0,tx=0,ty=0;
  document.addEventListener('mousemove',e=>{mx=(e.clientX/innerWidth-.5)*2;my=(e.clientY/innerHeight-.5)*2;});
  window.addEventListener('resize',()=>{C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();R.setSize(innerWidth,innerHeight);});
  (function loop(){requestAnimationFrame(loop);tx+=(mx*2-tx)*.04;ty+=(-my*1.5-ty)*.04;C.position.x=tx;C.position.y=ty;C.lookAt(S.position);pts.rotation.y+=.0003;tk.rotation.x+=.003;tk.rotation.y+=.004;sh.forEach(m=>{m.rotation.x+=m.userData.rx;m.rotation.y+=m.userData.ry;m.rotation.z+=m.userData.rz;m.userData.fy+=m.userData.fs;m.position.y=m.userData.oy+Math.sin(m.userData.fy)*m.userData.fa;});R.render(S,C);})();
})();

(function initLoadCanvas(){
  const cv=document.getElementById('loadCanvas');if(!cv)return;
  const ctx=cv.getContext('2d');let W=cv.width=innerWidth,H=cv.height=innerHeight;
  window.addEventListener('resize',()=>{W=cv.width=innerWidth;H=cv.height=innerHeight;});
  const ps=Array.from({length:50},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+.3,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3}));
  (function draw(){ctx.clearRect(0,0,W,H);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(0,255,213,.16)';ctx.fill();});requestAnimationFrame(draw);})();
})();

function initAuthCanvas(){
  const cv=document.getElementById('authCanvas');if(!cv)return;
  const ctx=cv.getContext('2d');let W=cv.width=innerWidth,H=cv.height=innerHeight;
  window.addEventListener('resize',()=>{W=cv.width=innerWidth;H=cv.height=innerHeight;});
  const clrs=['rgba(0,255,213,','rgba(176,109,255,','rgba(255,45,85,'];
  const ps=Array.from({length:110},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.44,vy:(Math.random()-.5)*.44,r:Math.random()*1.4+.4,c:clrs[Math.floor(Math.random()*3)]}));
  let mx=-9999,my=-9999;
  document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
  (function draw(){
    ctx.clearRect(0,0,W,H);
    ps.forEach((a,i)=>{ps.slice(i+1).forEach(b=>{const dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(0,255,213,${(1-d/110)*.055})`;ctx.lineWidth=.6;ctx.stroke();}});});
    ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;const dx=p.x-mx,dy=p.y-my,d=Math.sqrt(dx*dx+dy*dy);if(d<80){p.x+=dx/d*1.5;p.y+=dy/d*1.5;}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.c+'.7)';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,p.r+2,0,Math.PI*2);ctx.fillStyle=p.c+'.12)';ctx.fill();});
    requestAnimationFrame(draw);
  })();
}
