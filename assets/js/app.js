/* OXYX STORE — app.js */
'use strict';

/* ── CONSTANTS ── */
const SESSION_TTL = 90000;
const PING_MS     = 20000;
const LIVE_TICK   = 1000;

/* ── STORAGE ── */
const K = k => '_ox5_' + k;
function ls(k,d){try{const v=localStorage.getItem(K(k));return v!=null?JSON.parse(v):d;}catch{return d;}}
function ss(k,v){try{localStorage.setItem(K(k),JSON.stringify(v));}catch{}}

/* ── PASSWORD HASH ── */
function hashPw(pw){
  const salt='OXYX_STORE_SECURE_2024';
  const str=salt+pw+[...salt].reverse().join('');
  let h=5381;
  for(let i=0;i<str.length;i++){h=((h<<5)+h)^str.charCodeAt(i);h=h>>>0;}
  let h2=0x811c9dc5;
  for(let i=0;i<str.length;i++){h2^=str.charCodeAt(i);h2=(h2*0x01000193)>>>0;}
  return h.toString(36)+h2.toString(36);
}

/* ── SEED ── */
function seed(){
  if(ls('seeded5',false))return;
  ss('users',[{id:'own001',username:'owner',email:'owner@oxyx.store',pwHash:hashPw('29u39ShSSSSUA'),role:'owner',createdAt:Date.now()-9e6}]);
  ss('builds',[]);ss('bans',[]);ss('sessions',{});ss('staffCodes',[]);
  ss('activityLog',[]);
  ss('seeded5',true);
}

/* ── STATE ── */
let CU=null, CIP='0.0.0.0';
let pingTimer=null, liveTimer=null, liveRem=10;
let curFlt='all';
let uploadedBuild=null, uploadedPhoto=null;

/* ── IP ── */
async function getIP(){
  try{const r=await fetch('https://api.ipify.org?format=json',{signal:AbortSignal.timeout(4000)});const d=await r.json();if(d.ip)CIP=d.ip;}
  catch{CIP='127.'+(navigator.platform.length%256)+'.'+(screen.width%256)+'.1';}
}

/* ── DEVICE DETECT ── */
function detectDevice(){
  const ua=navigator.userAgent.toLowerCase();
  if(/mobi|android|iphone|ipod/.test(ua))return'mobile';
  if(/ipad|tablet/.test(ua))return'tablet';
  return'laptop';
}

/* ── CURSOR ── */
function initCursor(){
  const g=document.getElementById('cGlow'),d=document.getElementById('cDot');
  if(!g||!d)return;
  document.addEventListener('mousemove',e=>{g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';});
  document.querySelectorAll('button,a,.bcard,.nl,.adm-tab-btn,.cat').forEach(el=>{
    el.addEventListener('mouseenter',()=>{d.style.width='12px';d.style.height='12px';d.style.background='#fff';});
    el.addEventListener('mouseleave',()=>{d.style.width='7px';d.style.height='7px';d.style.background='var(--a)';});
  });
}

/* ── CARD TILT ── */
function initTilt(){
  document.addEventListener('mousemove',e=>{
    document.querySelectorAll('.bcard').forEach(c=>{
      const r=c.getBoundingClientRect();
      if(e.clientX<r.left-80||e.clientX>r.right+80||e.clientY<r.top-80||e.clientY>r.bottom+80){c.style.transform='perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';return;}
      const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      c.style.transform=`perspective(1000px) rotateY(${x*15}deg) rotateX(${-y*15}deg) translateZ(8px)`;
    });
  });
}

/* ── COUNTER ANIMATION ── */
function animN(el,target,dur=1000){
  if(!el)return;let s=null;
  (function step(ts){if(!s)s=ts;const p=Math.min((ts-s)/dur,1),e=1-Math.pow(1-p,3);el.textContent=Math.floor(target*e);if(p<1)requestAnimationFrame(step);})(performance.now());
}

/* ── LOADER ── */
function runLoader(cb){
  const bar=document.getElementById('loadBar'),msg=document.getElementById('loadMsg');
  const msgs=['INITIALIZING SYSTEM...','LOADING ASSETS...','FETCHING IP ADDRESS...','CHECKING SESSION...','VERIFYING SECURITY...','SYSTEM READY ✓'];
  let p=0,s=0;
  const iv=setInterval(()=>{
    p=Math.min(p+Math.random()*12+6,100);if(bar)bar.style.width=p+'%';
    if(p>s*20&&s<msgs.length&&msg)msg.textContent=msgs[s++];
    if(p>=100){clearInterval(iv);setTimeout(()=>{const el=document.getElementById('screenLoad');if(el)el.classList.add('out');setTimeout(cb,700);},400);}
  },130);
}

/* ── BAN CHECK ── */
function checkBanned(){return ls('bans',[]).some(b=>b.ip===CIP);}
function showBanned(){
  const el=document.getElementById('screenBanned');if(!el)return;
  const ip=document.getElementById('banIpShow');if(ip)ip.textContent=CIP;
  el.style.display='flex';
  document.getElementById('screenAuth').style.display='none';
  document.getElementById('mainApp').style.display='none';
}

/* ── AUTH ── */
function switchTab(t){
  document.getElementById('tabL').classList.toggle('active',t==='login');
  document.getElementById('tabR').classList.toggle('active',t==='register');
  document.getElementById('fLogin').classList.toggle('active',t==='login');
  document.getElementById('fReg').classList.toggle('active',t==='register');
  document.getElementById('lErr').textContent='';
  document.getElementById('rErr').textContent='';
}
function toggleEye(id,btn){const el=document.getElementById(id);if(!el)return;const s=el.type==='password';el.type=s?'text':'password';btn.textContent=s?'🙈':'👁';}

function doLogin(){
  const u=document.getElementById('lU').value.trim().toLowerCase();
  const p=document.getElementById('lP').value;
  const err=document.getElementById('lErr');
  if(!u||!p){err.textContent='⚠ Please fill in all fields.';return;}
  const users=ls('users',[]);
  const user=users.find(x=>x.username.toLowerCase()===u);
  if(!user){err.textContent='✕ Username not found.';return;}
  if(user.pwHash!==hashPw(p)){err.textContent='✕ Incorrect password.';return;}
  if(user.role==='owner'||user.role==='staff'){
    const sess=ls('sessions',{});const ex=sess[user.id];
    if(ex&&ex.ip&&ex.ip!==CIP&&(Date.now()-ex.lastPing)<SESSION_TTL*2){
      err.textContent=`🔒 Account already active from IP ${ex.ip}.`;return;
    }
  }
  recordSession(user.id,user.username,user.role);
  CU=user;ss('activeSession',{id:user.id});
  logActivity('join',`<em>${esc(user.username)}</em> logged in`);
  launchApp();
}

function doRegister(){
  const u=document.getElementById('rU').value.trim().toLowerCase();
  const e=document.getElementById('rE').value.trim();
  const p=document.getElementById('rP').value;
  const code=document.getElementById('rC').value.trim().toUpperCase();
  const err=document.getElementById('rErr');
  if(!u||!e||!p){err.textContent='⚠ Please fill in all required fields.';return;}
  if(u.length<3){err.textContent='⚠ Username must be at least 3 characters.';return;}
  if(p.length<6){err.textContent='⚠ Password must be at least 6 characters.';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){err.textContent='⚠ Invalid email format.';return;}
  const users=ls('users',[]);
  if(users.find(x=>x.username.toLowerCase()===u)){err.textContent='✕ Username already taken.';return;}
  if(users.find(x=>x.email.toLowerCase()===e.toLowerCase())){err.textContent='✕ Email already registered.';return;}
  let role='user';
  if(code){
    const codes=ls('staffCodes',[]);
    const ce=codes.find(c=>c.code===code&&!c.used);
    if(!ce){err.textContent='✕ Invalid or already used staff code.';return;}
    if(users.filter(x=>x.role==='staff').length>=2){err.textContent='✕ Staff slots full (max 2).';return;}
    role='staff';
    ce.used=true;ce.usedBy=u;ce.usedAt=Date.now();
    ss('staffCodes',codes);
  }
  users.push({id:'u'+Date.now(),username:u,email:e,pwHash:hashPw(p),role,createdAt:Date.now()});
  ss('users',users);
  toast('✓ Account created! Please log in.','ok');
  switchTab('login');document.getElementById('lU').value=u;
}

function doLogout(){
  if(CU)clearSession(CU.id);
  clearInterval(pingTimer);stopLiveTimer();
  CU=null;ss('activeSession',null);
  document.getElementById('mainApp').style.display='none';
  document.getElementById('screenAuth').style.display='flex';
  if(typeof initAuthCanvas==='function')initAuthCanvas();
  toast('Logged out.','info');
}

/* ── SESSIONS ── */
function recordSession(uid,username,role){
  const sess=ls('sessions',{});
  sess[uid]={uid,username,role,ip:CIP,lastPing:Date.now(),online:true,device:detectDevice(),joinedAt:sess[uid]?sess[uid].joinedAt:Date.now()};
  ss('sessions',sess);
}
function pingSession(){
  if(!CU)return;
  const sess=ls('sessions',{});
  if(sess[CU.id]){sess[CU.id].lastPing=Date.now();sess[CU.id].online=true;sess[CU.id].ip=CIP;ss('sessions',sess);}
}
function clearSession(uid){const sess=ls('sessions',{});if(sess[uid]){sess[uid].online=false;sess[uid].lastPing=0;}ss('sessions',sess);}
function startPing(){clearInterval(pingTimer);pingSession();pingTimer=setInterval(pingSession,PING_MS);}

/* ── LIVE COUNTER (navbar) ── */
function updateLiveCounter(){
  const sess=ls('sessions',{});
  const count=Object.values(sess).filter(r=>(Date.now()-r.lastPing)<SESSION_TTL).length;
  const el=document.getElementById('liveCountNum');if(el)el.textContent=count;
}

/* ── ACTIVITY LOG ── */
function logActivity(type,msg){
  const log=ls('activityLog',[]);
  log.unshift({type,msg,ts:Date.now()});
  if(log.length>50)log.pop();
  ss('activityLog',log);
}

/* ── AUTO LOGIN ── */
function tryAutoLogin(){
  const saved=ls('activeSession',null);if(!saved)return false;
  const users=ls('users',[]);const u=users.find(x=>x.id===saved.id);if(!u)return false;
  if(u.role==='owner'||u.role==='staff'){
    const sess=ls('sessions',{});const ex=sess[u.id];
    if(ex&&ex.ip&&ex.ip!==CIP&&(Date.now()-ex.lastPing)<SESSION_TTL*2){ss('activeSession',null);return false;}
  }
  CU=u;recordSession(u.id,u.username,u.role);launchApp();return true;
}

/* ── LAUNCH ── */
function launchApp(){
  document.getElementById('screenAuth').style.display='none';
  document.getElementById('mainApp').style.display='block';
  const nm=document.getElementById('nbNm'),av=document.getElementById('nbAv'),rc=document.getElementById('nbRc');
  if(nm)nm.textContent=CU.username;if(av)av.textContent=CU.username[0].toUpperCase();
  if(rc){rc.textContent=CU.role.toUpperCase();rc.className='nb-chip '+CU.role;}
  const al=document.getElementById('nl-admin');if(al)al.style.display=(CU.role==='owner'||CU.role==='staff')?'inline':'none';
  startPing();
  updateLiveCounter();
  setInterval(updateLiveCounter,PING_MS);
  goTo('home');updateHomeStats();setTimeout(initTilt,600);
}

/* ── NAV ── */
function goTo(page){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nl').forEach(l=>l.classList.remove('active'));
  const sec=document.getElementById('sec-'+page);if(sec)sec.classList.add('active');
  const lnk=document.getElementById('nl-'+page);if(lnk)lnk.classList.add('active');
  document.getElementById('nbLinks').classList.remove('open');
  if(page==='home'){renderGrid('featGrid',null,'all',true);updateHomeStats();}
  if(page==='store')renderGrid('storeGrid',null,curFlt);
  if(page==='premium')renderGrid('premGrid','premium');
  if(page==='free')renderGrid('freeGrid','free');
  if(page==='submit')renderMyPending();
  if(page==='admin')initAdminPanel();
  window.scrollTo({top:0,behavior:'smooth'});
}
function toggleNav(){document.getElementById('nbLinks').classList.toggle('open');}

/* ── HOME STATS ── */
function updateHomeStats(){
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  const users=ls('users',[]);
  const prem=builds.filter(b=>b.type==='premium').length;
  const free=builds.filter(b=>b.type==='free').length;
  animN(document.getElementById('hsB'),builds.length);animN(document.getElementById('hsP'),prem);
  animN(document.getElementById('hsF'),free);animN(document.getElementById('hsU'),users.length);
  animN(document.getElementById('authStatB'),builds.length);animN(document.getElementById('authStatU'),users.length);
  const cp=document.getElementById('ccP');if(cp)cp.textContent=prem+' builds';
  const cf=document.getElementById('ccF');if(cf)cf.textContent=free+' builds';
}

/* ── BUILD GRIDS ── */
function renderGrid(cid,tf,fm,feat){
  const el=document.getElementById(cid);if(!el)return;
  let builds=ls('builds',[]).filter(b=>b.status==='approved');
  if(tf)builds=builds.filter(b=>b.type===tf);
  if(fm&&fm!=='all')builds=builds.filter(b=>b.type===fm);
  if(feat)builds=builds.filter(b=>b.featured).slice(0,6);
  if(!builds.length){el.innerHTML=`<div class="empty-st"><span class="es-ico">◎</span>NO BUILDS AVAILABLE YET</div>`;return;}
  el.innerHTML=builds.map(buildCardHTML).join('');setTimeout(initTilt,100);
}
function buildCardHTML(b){
  const ip=b.type==='premium',pr=ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE';
  const thumb=b.photoData?`<img class="bc-photo" src="${b.photoData}" alt="">`:`<span class="bc-ico">◈</span>`;
  return `<div class="bcard" onclick="openModal('${b.id}')">
    <div class="bc-thumb"><div class="bc-tg"></div>${thumb}<span class="bc-badge ${ip?'bp':'bf2'}">${ip?'♛ PREMIUM':'✦ FREE'}</span></div>
    <div class="bc-body"><div class="bc-cat">${esc(b.cat||'—')}</div><div class="bc-name">${esc(b.name)}</div>
    <div class="bc-desc">${esc(b.desc)}</div>
    <div class="bc-foot"><span class="bc-price ${ip?'pp':'fp'}">${pr}</span><button class="btn-view">VIEW →</button></div></div></div>`;
}
function applyFlt(type,btn,gid){curFlt=type;document.querySelectorAll('.flt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderGrid(gid,null,type);}

/* ── MODAL ── */
function openModal(id){
  const b=ls('builds',[]).find(x=>x.id===id);if(!b)return;
  const ip=b.type==='premium',pr=ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE';
  logActivity('view',`<em>${esc(CU.username)}</em> viewed <em>${esc(b.name)}</em>`);
  document.getElementById('modalContent').innerHTML=`
    ${b.photoData?`<img class="mod-photo" src="${b.photoData}" alt="">`:''}
    <span class="mod-badge ${ip?'prem':'free'}">${ip?'♛ PREMIUM':'✦ FREE'}</span>
    <div class="mod-title">${esc(b.name)}</div>
    <div class="mod-meta">${esc(b.cat)}${b.submitter&&b.submitter!=='owner'?` · By: ${esc(b.submitter)}`:''}</div>
    <div class="mod-desc">${esc(b.desc)}</div>
    ${b.contact?`<div class="mod-contact">📞 Seller: <strong>${esc(b.contact)}</strong></div>`:''}
    ${b.buildFileName?`<div class="mod-file">📦 ${esc(b.buildFileName)}</div>`:''}
    <div class="mod-pr-row"><div class="mod-price ${ip?'pp':'fp'}">${pr}</div></div>
    ${ip?`<button class="btn-ma bma-buy" onclick="handleBuy('${b.id}')">💳 BUY NOW</button>`
       :`${b.buildFileData?`<button class="btn-ma bma-dl" onclick="handleDL('${b.id}')">⬇ DOWNLOAD .BUILD</button>`:''}<a href="${esc(b.link||'#')}" target="_blank" class="btn-ma bma-prev">🔗 PREVIEW</a>`}`;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(e){if(!e||e.target===document.getElementById('modalOverlay'))document.getElementById('modalOverlay').classList.remove('open');}
function handleBuy(id){const b=ls('builds',[]).find(x=>x.id===id);logActivity('buy',`<em>${esc(CU.username)}</em> bought <em>${esc(b?.name||'')}</em>`);if(b)toast(`Contact seller: ${b.contact||'Contact admin'}`, 'info');closeModal();}
function handleDL(id){
  const b=ls('builds',[]).find(x=>x.id===id);if(!b||!b.buildFileData){toast('File not available.','err');return;}
  const by=atob(b.buildFileData),ab=new ArrayBuffer(by.length),ia=new Uint8Array(ab);
  for(let i=0;i<by.length;i++)ia[i]=by.charCodeAt(i);
  const blob=new Blob([ab],{type:'application/octet-stream'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=b.buildFileName||'build.build';a.click();URL.revokeObjectURL(url);
  toast('⬇ Downloading...','ok');
}

/* ── FILE UPLOAD ── */
function onBuildFile(input){
  const file=input.files[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.build')){toast('✕ Only .build files accepted.','err');input.value='';return;}
  if(file.size>50*1024*1024){toast('✕ File too large (max 50MB).','err');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    uploadedBuild={name:file.name,data:btoa(String.fromCharCode(...new Uint8Array(e.target.result)))};
    document.getElementById('buildFName').textContent='✓ '+file.name;
    document.getElementById('buildDZ').style.borderColor='var(--fr)';
  };
  reader.readAsArrayBuffer(file);
}
function onPhotoFile(input){
  const file=input.files[0];if(!file)return;
  if(!file.type.startsWith('image/')){toast('✕ Image files only.','err');input.value='';return;}
  if(file.size>5*1024*1024){toast('✕ Image too large (max 5MB).','err');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    uploadedPhoto=e.target.result;
    document.getElementById('photoPrevImg').src=uploadedPhoto;
    document.getElementById('photoPrev').style.display='flex';
    document.getElementById('photoHolder').style.display='none';
    document.getElementById('photoDZ').style.borderColor='var(--fr)';
  };
  reader.readAsDataURL(file);
}

/* ── SUBMIT BUILD ── */
function submitBuild(){
  const n=document.getElementById('sbN').value.trim(),t=document.getElementById('sbT').value;
  const p=parseInt(document.getElementById('sbP').value)||0,c=document.getElementById('sbC').value.trim();
  const d=document.getElementById('sbD').value.trim(),l=document.getElementById('sbL').value.trim();
  const k=document.getElementById('sbK').value.trim(),tos=document.getElementById('sbTos').checked;
  if(!n){toast('⚠ Build name required.','err');return;}
  if(!d){toast('⚠ Description required.','err');return;}
  if(!l){toast('⚠ Preview link required.','err');return;}
  if(!uploadedBuild){toast('⚠ Please upload a .build file.','err');return;}
  if(!tos){toast('⚠ Please confirm originality.','err');return;}
  const builds=ls('builds',[]);
  builds.push({id:'b'+Date.now(),name:n,type:t,price:p,cat:c,desc:d,link:l,contact:k,photoData:uploadedPhoto,buildFileName:uploadedBuild.name,buildFileData:uploadedBuild.data,submitter:CU.username,featured:false,status:'pending',createdAt:Date.now()});
  ss('builds',builds);
  logActivity('upload',`<em>${esc(CU.username)}</em> submitted <em>${esc(n)}</em>`);
  ['sbN','sbP','sbC','sbD','sbL','sbK'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('sbTos').checked=false;
  document.getElementById('buildFName').textContent='';
  document.getElementById('buildDZ').style.borderColor='';document.getElementById('photoDZ').style.borderColor='';
  document.getElementById('photoPrev').style.display='none';document.getElementById('photoHolder').style.display='';
  uploadedBuild=null;uploadedPhoto=null;
  toast('✓ Build submitted! Pending owner review.','ok');renderMyPending();
}
function renderMyPending(){
  const el=document.getElementById('myPendList');if(!el)return;
  const mine=ls('builds',[]).filter(b=>b.submitter===CU.username&&b.status==='pending');
  if(!mine.length){el.innerHTML='<div class="usb-empty">No pending builds.</div>';return;}
  el.innerHTML=mine.map(b=>`<div class="pend-itm"><div class="pend-nm">${esc(b.name)}</div><div class="pend-st">⏳ Awaiting review...</div></div>`).join('');
}

/* ════════════════════════════
   ADMIN PANEL
════════════════════════════ */
function initAdminPanel(){
  const rb=document.getElementById('adminRoleBadge'),st=document.getElementById('adminSubTxt');
  if(rb){rb.textContent=CU.role.toUpperCase();rb.className='adm-role-pill '+CU.role;}
  if(st)st.innerHTML=CU.role==='owner'?'Owner — Full System Access · <span id="adminClock" style="color:var(--a)"></span>':'Staff — Manage Builds Only';
  startAdminClock();buildAdminTabs();updateStatCards();
}

function startAdminClock(){
  const tick=()=>{const el=document.getElementById('adminClock');if(!el)return;el.textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});};
  tick();clearInterval(window._clkT);window._clkT=setInterval(tick,1000);
}

function updateStatCards(){
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  const users=ls('users',[]);
  const sess=ls('sessions',{});
  const online=Object.values(sess).filter(s=>(Date.now()-s.lastPing)<SESSION_TTL).length;
  animN(document.getElementById('asc-online'),online);
  animN(document.getElementById('asc-builds'),builds.length);
  animN(document.getElementById('asc-premium'),builds.filter(b=>b.type==='premium').length);
  animN(document.getElementById('asc-members'),users.length);
  animN(document.getElementById('asc-banned'),ls('bans',[]).length);
  const lc=document.getElementById('liveCountNum');if(lc)lc.textContent=online;
}

function buildAdminTabs(){
  const nav=document.getElementById('adminTabsNav');if(!nav)return;
  const io=CU.role==='owner';
  const tabs=[
    {id:'builds',label:'📦 BUILDS',all:true},
    {id:'users', label:'👥 USERS', all:false},
    {id:'live',  label:'📡 LIVE IP <span style="color:var(--r);animation:lp 1.5s infinite;font-size:.7em">●</span>',all:false},
    {id:'ban',   label:'🚫 BAN IP', all:false},
    {id:'pwd',   label:'🔑 RESET PWD',all:false},
    {id:'codes', label:'🎫 STAFF CODES',all:false},
  ];
  nav.innerHTML=tabs.filter(t=>t.all||io).map((t,i)=>`<button class="adm-tab-btn${i===0?' active':''}" onclick="switchAdmTab('${t.id}',this)">${t.label}</button>`).join('');
  ['atab-users','atab-live','atab-ban','atab-pwd','atab-codes'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=io?'':'none';});
  const ab=document.getElementById('addBuildBox');if(ab)ab.style.display=io?'':'none';
  const pb=document.getElementById('pendingBox');if(pb)pb.style.display=io?'':'none';
  document.querySelectorAll(".admc").forEach(t=>t.classList.remove("active"));
  const first=document.getElementById('atab-builds');if(first)first.classList.add('active');
  renderBuildPanel();
}

function switchAdmTab(name,btn){
  document.querySelectorAll('.adm-tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll(".admc").forEach(t=>t.classList.remove("active"));
  btn.classList.add('active');
  const tab=document.getElementById('atab-'+name);if(tab)tab.classList.add('active');
  if(name==='live'){refreshLive();startLiveTimer();}
  if(name==='ban')renderBanPanel();
  if(name==='users')renderUserPanel();
  if(name==='codes')renderCodesPanel();
  if(name==='builds')renderBuildPanel();
  updateStatCards();
}

/* ── BUILDS ── */
function adminAddBuild(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const n=document.getElementById('aN').value.trim(),t=document.getElementById('aT').value;
  const p=parseInt(document.getElementById('aP').value)||0,c=document.getElementById('aC').value.trim();
  const d=document.getElementById('aD').value.trim(),l=document.getElementById('aL').value.trim();
  if(!n||!d){toast('⚠ Name and description required.','err');return;}
  const builds=ls('builds',[]);
  builds.push({id:'b'+Date.now(),name:n,type:t,price:p,cat:c,desc:d,link:l,contact:'',photoData:null,buildFileName:null,buildFileData:null,submitter:'owner',featured:false,status:'approved',createdAt:Date.now()});
  ss('builds',builds);
  ['aN','aP','aC','aD','aL'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderBuildPanel();updateHomeStats();updateStatCards();toast('✓ Build added!','ok');
}

function renderBuildPanel(){
  renderPendingPanel();
  const tbody=document.getElementById('buildTblBody');if(!tbody)return;
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  if(!builds.length){tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:24px;font-family:var(--fm);font-size:.7rem;color:var(--t3)">No approved builds yet</td></tr>`;return;}
  tbody.innerHTML=builds.map(b=>{
    const ip=b.type==='premium';
    const th=b.photoData?`<div class="btbl-th"><img src="${b.photoData}" alt=""></div>`:`<div class="btbl-th">${b.icon||'◈'}</div>`;
    return `<tr>
      <td><div class="btbl-nc">${th}<div><div class="btbl-nm">${esc(b.name)}</div><div class="btbl-ct">${esc(b.cat)}</div></div></div></td>
      <td><span class="chip ${ip?'ch-prem':'ch-free'}">${ip?'PREMIUM':'FREE'}</span></td>
      <td class="btbl-pr ${ip?'pp':'fp'}">${ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE'}</td>
      <td style="font-family:var(--fm);font-size:.64rem;color:var(--t2)">${esc(b.submitter||'owner')}</td>
      <td><span class="chip ch-appr">APPROVED</span></td>
      <td><div class="btbl-acts">
        <button class="btn-xs bx-del" onclick="deleteBuild('${b.id}')">🗑</button>
        ${CU.role==='owner'?`<button class="btn-xs bx-star" onclick="toggleFeatured('${b.id}')" title="${b.featured?'Remove featured':'Mark featured'}">${b.featured?'★':'☆'}</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

function renderPendingPanel(){
  if(CU.role!=='owner')return;
  const el=document.getElementById('pendingList'),badge=document.getElementById('pendBadge');if(!el)return;
  const pending=ls('builds',[]).filter(b=>b.status==='pending');
  if(badge)badge.textContent=pending.length;
  if(!pending.length){el.innerHTML='<div style="padding:12px;font-family:var(--fm);font-size:.7rem;color:var(--t3)">✓ No pending builds</div>';return;}
  el.innerHTML=pending.map(b=>`
    <div class="pl-item">
      <div class="pl-thumb">${b.photoData?`<img src="${b.photoData}" alt="">`:'📦'}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(b.name)}<span class="chip ch-pend">PENDING</span></div>
        <div class="pl-meta">By: ${esc(b.submitter)} · ${b.type==='premium'?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE'} ${b.buildFileName?'· 📦 '+esc(b.buildFileName):'· no file'}</div>
      </div>
      <div class="pl-acts">
        <button class="btn-xs bx-appr" onclick="approveBuild('${b.id}')">✓ APPROVE</button>
        <button class="btn-xs bx-del"  onclick="rejectBuild('${b.id}')">✕ REJECT</button>
      </div>
    </div>`).join('');
}

function filterBuildList(query){
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  const filtered=query?builds.filter(b=>b.name.toLowerCase().includes(query.toLowerCase())||(b.cat||'').toLowerCase().includes(query.toLowerCase())):builds;
  const tbody=document.getElementById('buildTblBody');if(!tbody)return;
  if(!filtered.length){tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:18px;font-family:var(--fm);font-size:.7rem;color:var(--t3)">No builds found</td></tr>`;return;}
  tbody.innerHTML=filtered.map(b=>{
    const ip=b.type==='premium';
    return `<tr>
      <td><div class="btbl-nc"><div class="btbl-th">${b.photoData?`<img src="${b.photoData}" alt="">`:b.icon||'◈'}</div><div><div class="btbl-nm">${esc(b.name)}</div><div class="btbl-ct">${esc(b.cat)}</div></div></div></td>
      <td><span class="chip ${ip?'ch-prem':'ch-free'}">${ip?'PREMIUM':'FREE'}</span></td>
      <td class="btbl-pr ${ip?'pp':'fp'}">${ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE'}</td>
      <td style="font-family:var(--fm);font-size:.64rem;color:var(--t2)">${esc(b.submitter||'owner')}</td>
      <td><span class="chip ch-appr">APPROVED</span></td>
      <td><div class="btbl-acts"><button class="btn-xs bx-del" onclick="deleteBuild('${b.id}')">🗑</button></div></td>
    </tr>`;}).join('');
}

function deleteBuild(id){
  if(!confirm('Delete this build?'))return;
  ss('builds',ls('builds',[]).filter(b=>b.id!==id));
  renderBuildPanel();renderGrid('storeGrid',null,curFlt);renderGrid('featGrid',null,'all',true);
  updateHomeStats();updateStatCards();toast('Build deleted.','info');
}
function approveBuild(id){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const b=ls('builds',[]);const i=b.findIndex(x=>x.id===id);if(i<0)return;
  b[i].status='approved';ss('builds',b);
  renderBuildPanel();updateHomeStats();updateStatCards();toast('✓ Build approved!','ok');
}
function rejectBuild(id){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm('Reject and delete?'))return;
  ss('builds',ls('builds',[]).filter(b=>b.id!==id));renderBuildPanel();toast('Build rejected.','info');
}
function toggleFeatured(id){
  if(CU.role!=='owner')return;
  const b=ls('builds',[]);const i=b.findIndex(x=>x.id===id);if(i<0)return;
  b[i].featured=!b[i].featured;ss('builds',b);renderBuildPanel();
  toast(b[i].featured?'⭐ Marked as featured!':'Removed from featured.','info');
}

/* ── USERS ── */
function renderUserPanel(){
  if(CU.role!=='owner')return;
  const grid=document.getElementById('userCardGrid');if(!grid)return;
  const users=ls('users',[]),sess=ls('sessions',{});
  grid.innerHTML=users.map(u=>{
    const s=sess[u.id],on=s&&(Date.now()-s.lastPing)<SESSION_TTL;
    return `<div class="ucrd">
      <div class="ucrd-top">
        <div class="ucrd-av ${u.role}">${u.username[0].toUpperCase()}</div>
        <div><div class="ucrd-nm">${esc(u.username)}<span class="chip ch-${u.role}">${u.role.toUpperCase()}</span></div><div class="ucrd-em">${esc(u.email)}</div></div>
      </div>
      <div class="ucrd-row">
        <div class="ucrd-ip">${s?esc(s.ip):'—'} ${s&&s.device?'· '+s.device:''}</div>
        <div class="ucrd-on ${on?'on':'off'}">${on?'● ONLINE':'○ offline'}</div>
      </div>
      <div class="ucrd-acts">
        ${u.id!==CU.id?`<button class="btn-ucrd-del" onclick="deleteUser('${u.id}')">🗑 DELETE</button>`:''}
        <button style="flex:1;padding:6px;background:var(--sf);border:1px solid var(--bd2);border-radius:6px;color:var(--t2);font-family:var(--fm);font-size:.6rem;cursor:pointer">👁 VIEW</button>
      </div>
    </div>`;
  }).join('');
}
function deleteUser(id){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm('Delete this user?'))return;
  ss('users',ls('users',[]).filter(u=>u.id!==id));clearSession(id);renderUserPanel();updateStatCards();toast('User deleted.','info');
}

/* ── LIVE IP ── */
function refreshLive(){
  if(CU.role!=='owner')return;
  const sess=ls('sessions',{}),bans=ls('bans',[]).map(b=>b.ip),rows=Object.values(sess),now=Date.now();
  let online=0;rows.forEach(r=>{r.isOnline=(now-r.lastPing)<SESSION_TTL;if(r.isOnline)online++;});
  const e=id=>document.getElementById(id);
  if(e('lsOnline'))e('lsOnline').textContent=online;
  if(e('lsTotal'))e('lsTotal').textContent=rows.length;
  if(e('lsBanned'))e('lsBanned').textContent=ls('bans',[]).length;
  const lc=e('liveCountNum');if(lc)lc.textContent=online;
  const sc=e('asc-online');if(sc)sc.textContent=online;
  renderVisitorFeed(rows,bans);
  renderDeviceBreakdown(rows);
  renderActivityFeed();
}

function renderVisitorFeed(rows,bans){
  const feed=document.getElementById('visitorFeed');if(!feed)return;
  if(!rows.length){feed.innerHTML='<div style="padding:20px;font-family:var(--fm);font-size:.7rem;color:var(--t3);text-align:center">No active sessions</div>';return;}
  const devIco=d=>d==='mobile'?'📱':d==='tablet'?'📱':'💻';
  feed.innerHTML=rows.map(r=>`
    <div class="vr">
      <div class="vr-av ${r.role||'user'}">${(r.username||'?')[0].toUpperCase()}</div>
      <div class="vr-info">
        <div class="vr-nr">${esc(r.username)}<span class="chip ch-${r.role||'user'}">${(r.role||'user').toUpperCase()}</span>${devIco(r.device)}</div>
        <div class="vr-mt">IP: ${esc(r.ip)} · joined ${timeAgo(r.joinedAt||r.lastPing)}</div>
      </div>
      <div class="vr-right">
        <div class="vr-st ${r.isOnline?'on':'off'}">${r.isOnline?'● ONLINE':'○ offline'}</div>
        <div class="vr-dev">${r.device||'unknown'}</div>
      </div>
    </div>`).join('');
}

function renderDeviceBreakdown(rows){
  const el=document.getElementById('deviceBars');if(!el)return;
  const counts={laptop:0,mobile:0,tablet:0};
  rows.filter(r=>r.isOnline).forEach(r=>{counts[r.device||'laptop']++;});
  const total=rows.filter(r=>r.isOnline).length||1;
  el.innerHTML=['laptop','mobile','tablet'].map(d=>{
    const pct=Math.round((counts[d]/total)*100);
    return `<div class="dev-row">
      <span class="dev-lbl">${d.toUpperCase()}</span>
      <div class="dev-bw"><div class="dev-b ${d}" style="width:${pct}%"></div></div>
      <span class="dev-val">${counts[d]}</span>
    </div>`;}).join('');
}

function renderActivityFeed(){
  const el=document.getElementById('activityList');if(!el)return;
  const log=ls('activityLog',[]).slice(0,8);
  const typeMap={join:{cls:'ad-join',ico:'●'},buy:{cls:'ad-buy',ico:'💰'},upload:{cls:'ad-upload',ico:'↑'},view:{cls:'ad-view',ico:'👁'}};
  if(!log.length){el.innerHTML='<div style="font-family:var(--fm);font-size:.7rem;color:var(--t3);padding:12px">No activity yet.</div>';return;}
  el.innerHTML=log.map(a=>{const t=typeMap[a.type]||{cls:'ad-view',ico:'●'};
    return `<div class="act-it"><div class="act-dot ${t.cls}">${t.ico}</div><div class="act-body"><div class="act-msg">${a.msg}</div><div class="act-tm">${timeAgo(a.ts)}</div></div></div>`;}).join('');
}

function startLiveTimer(){
  stopLiveTimer();liveRem=10;
  liveTimer=setInterval(()=>{liveRem--;const cd=document.getElementById('liveCountdown');if(cd)cd.textContent=liveRem;if(liveRem<=0){liveRem=10;refreshLive();}},LIVE_TICK);
}
function stopLiveTimer(){clearInterval(liveTimer);}

/* ── BAN ── */
function doBanIp(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const ip=document.getElementById('banIpIn').value.trim(),rsn=document.getElementById('banRsnIn').value.trim();
  if(!ip){toast('⚠ Enter IP address.','err');return;}
  if(ip===CIP){toast('✕ Cannot ban your own IP.','err');return;}
  const bans=ls('bans',[]);if(bans.find(b=>b.ip===ip)){toast('IP already banned.','warn');return;}
  bans.push({ip,reason:rsn||'Violated rules',bannedBy:CU.username,bannedAt:Date.now()});ss('bans',bans);
  document.getElementById('banIpIn').value='';document.getElementById('banRsnIn').value='';
  renderBanPanel();updateStatCards();toast(`🚫 IP ${ip} banned.`,'ok');
}
function unbanIp(ip){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm(`Unban IP ${ip}?`))return;
  ss('bans',ls('bans',[]).filter(b=>b.ip!==ip));renderBanPanel();updateStatCards();toast(`✓ ${ip} unbanned.`,'ok');
}
function quickBan(ip,username){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm(`Ban IP ${ip} (${username})?`))return;
  if(ip===CIP){toast('✕ Cannot ban own IP.','err');return;}
  const bans=ls('bans',[]);
  if(!bans.find(b=>b.ip===ip)){bans.push({ip,reason:'Banned via live panel',bannedBy:CU.username,bannedAt:Date.now()});ss('bans',bans);}
  refreshLive();renderBanPanel();updateStatCards();toast(`🚫 ${ip} banned.`,'ok');
}
function renderBanPanel(){
  if(CU.role!=='owner')return;
  const el=document.getElementById('banPanelList');if(!el)return;
  const bans=ls('bans',[]);
  if(!bans.length){el.innerHTML='<div style="padding:16px;font-family:var(--fm);font-size:.7rem;color:var(--t3);text-align:center">✓ No banned IPs</div>';return;}
  el.innerHTML=bans.map(b=>`
    <div class="pl-item">
      <div class="pl-thumb" style="font-size:1.2rem">🚫</div>
      <div class="pl-info">
        <div class="pl-name" style="color:var(--r);font-family:var(--fm)">${esc(b.ip)}</div>
        <div class="pl-meta">Reason: ${esc(b.reason)} · By: ${esc(b.bannedBy)} · ${timeAgo(b.bannedAt)}</div>
      </div>
      <div class="pl-acts"><button class="btn-xs bx-unban" onclick="unbanIp('${esc(b.ip)}')">UNBAN</button></div>
    </div>`).join('');
}

/* ── RESET PWD ── */
function doResetPassword(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const tgt=document.getElementById('pwdTarget').value.trim().toLowerCase();
  const np=document.getElementById('pwdNew').value,cp=document.getElementById('pwdConf').value;
  const err=document.getElementById('pwdErr');
  if(!np||!cp){err.textContent='⚠ Fill all fields.';return;}
  if(np.length<6){err.textContent='⚠ Min 6 characters.';return;}
  if(np!==cp){err.textContent='✕ Passwords do not match.';return;}
  const users=ls('users',[]),target=tgt||CU.username;
  const idx=users.findIndex(u=>u.username.toLowerCase()===target);
  if(idx<0){err.textContent='✕ Username not found.';return;}
  if(users[idx].role==='owner'&&users[idx].id!==CU.id&&tgt){err.textContent='✕ Cannot reset another owner.';return;}
  users[idx].pwHash=hashPw(np);ss('users',users);
  if(users[idx].id===CU.id)CU.pwHash=users[idx].pwHash;
  document.getElementById('pwdTarget').value='';document.getElementById('pwdNew').value='';document.getElementById('pwdConf').value='';
  err.textContent='';toast(`✓ Password for "${users[idx].username}" reset!`,'ok');
}

/* ── STAFF CODES ── */
function generateStaffCode(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='STAFF-';for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];code+='-';for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];
  const codes=ls('staffCodes',[]);
  codes.unshift({code,used:false,createdBy:CU.username,createdAt:Date.now()});
  ss('staffCodes',codes);
  const box=document.getElementById('lastCodeBox');if(box)box.style.display='block';
  const txt=document.getElementById('lastCodeText');if(txt)txt.textContent=code;
  renderCodesPanel();toast(`✓ Code generated: ${code}`,'ok');
}
function revokeCode(code){
  if(!confirm(`Revoke code ${code}?`))return;
  ss('staffCodes',ls('staffCodes',[]).filter(c=>c.code!==code));renderCodesPanel();toast('Code revoked.','info');
}
function renderCodesPanel(){
  if(CU.role!=='owner')return;
  const el=document.getElementById('staffCodeList');if(!el)return;
  const codes=ls('staffCodes',[]);
  if(!codes.length){el.innerHTML='<div style="font-family:var(--fm);font-size:.7rem;color:var(--t3);text-align:center;padding:14px">No codes yet.</div>';return;}
  el.innerHTML=codes.map(c=>`
    <div class="code-row">
      <div class="cr-code">${esc(c.code)}</div>
      <span class="chip ${c.used?'ch-used':'ch-active'}">${c.used?'USED':'ACTIVE'}</span>
      ${!c.used?`<button class="btn-xs bx-revoke" onclick="revokeCode('${esc(c.code)}')">REVOKE</button>`:''}
    </div>`).join('');
}

/* ── UTILS ── */
function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function timeAgo(ts){if(!ts)return '—';const d=Date.now()-ts,s=Math.floor(d/1000),m=Math.floor(s/60),h=Math.floor(m/60),dy=Math.floor(h/24);if(dy>0)return dy+'d ago';if(h>0)return h+'h ago';if(m>0)return m+'m ago';if(s>0)return s+'s ago';return 'just now';}
let _tc=0;
function toast(msg,type='info'){const w=document.getElementById('toastArea');if(!w)return;const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;w.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(26px)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300);},3200);}

/* ── KEYBOARD ── */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeModal();
  if(e.key==='Enter'){const auth=document.getElementById('screenAuth');if(auth&&auth.style.display!=='none'){document.getElementById('fLogin').classList.contains('active')?doLogin():doRegister();}}
});

/* ── INIT ── */
(async function main(){
  seed();
  runLoader(async()=>{
    await getIP();
    if(checkBanned()){showBanned();return;}
    document.getElementById('screenAuth').style.display='flex';
    if(typeof initAuthCanvas==='function')initAuthCanvas();
    updateHomeStats();
    if(!tryAutoLogin()){}
    initCursor();
  });
})();
