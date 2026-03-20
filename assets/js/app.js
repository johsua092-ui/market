/* ═══════════════════════════════════════════════════════
   OXYX STORE — app.js v5
   FIX: admin content divs use class="admtab", NOT "atab"
        "atab" is ONLY for auth LOGIN/REGISTER buttons
   ═══════════════════════════════════════════════════════ */
'use strict';

const SESSION_TTL = 90000;
const PING_MS     = 20000;
const LIVE_TICK   = 1000;

/* ── STORAGE ── */
const K = k => '_ox4_' + k;
function ls(k,d){try{const v=localStorage.getItem(K(k));return v!=null?JSON.parse(v):d;}catch{return d;}}
function ss(k,v){try{localStorage.setItem(K(k),JSON.stringify(v));}catch{}}

/* ── HASH ── */
function hashPw(pw){
  const salt='OXYX_STORE_SECURE_2024';
  const str=salt+pw+salt.split('').reverse().join('');
  let h=5381;
  for(let i=0;i<str.length;i++){h=((h<<5)+h)^str.charCodeAt(i);h=h>>>0;}
  let h2=0x811c9dc5;
  for(let i=0;i<str.length;i++){h2^=str.charCodeAt(i);h2=(h2*0x01000193)>>>0;}
  return h.toString(36)+h2.toString(36);
}

/* ── PASSWORD STRENGTH ── */
function pwStrength(pw){
  if(!pw) return {score:0,label:'',color:''};
  let s=0;
  if(pw.length>=6)s++;if(pw.length>=10)s++;
  if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  const L=[{label:'Very Weak',c:'#ff2d55'},{label:'Weak',c:'#ff6b2d'},{label:'Fair',c:'#ffc432'},{label:'Good',c:'#00c8ff'},{label:'Strong',c:'#00ff88'},{label:'Very Strong',c:'#00ffd5'}];
  return{score:s,...L[Math.min(s,5)]};
}
function onPwInput(v){
  const st=pwStrength(v);
  const b=document.getElementById('pwBar'),l=document.getElementById('pwLbl');
  if(b){b.style.width=(st.score/5*100)+'%';b.style.background=st.c;}
  if(l){l.textContent=st.label;l.style.color=st.c;}
}

/* ── SEED ── */
function seed(){
  if(ls('seeded4',false)) return;
  ss('users',[{id:'own001',username:'owner',email:'owner@oxyx.store',pwHash:hashPw('29u39ShSSSSUA'),role:'owner',createdAt:Date.now()-9e6}]);
  ss('builds',[]);ss('bans',[]);ss('sessions',{});ss('staffCodes',[]);
  ss('actLog',[]);ss('announcement','');ss('notifs',[]);
  ss('wishlist',[]);ss('recentViewed',[]);ss('reactions',{});ss('viewCounts',{});
  ss('seeded4',true);
}

/* ── STATE ── */
let CU=null,CIP='0.0.0.0';
let pingTimer=null,liveTimer=null,liveRem=10;
let curFilter='all';
let uploadedBuild=null,uploadedPhoto=null;
let notifOpen=false;

/* ── DEVICE ── */
function getDevice(){
  const ua=navigator.userAgent.toLowerCase();
  if(/mobi|android|iphone|ipod/.test(ua))return'mobile';
  if(/ipad|tablet/.test(ua))return'tablet';
  return'laptop';
}
function devIco(d){return d==='mobile'?'📱':d==='tablet'?'📟':'💻';}

/* ── IP ── */
async function getIP(){
  try{const r=await fetch('https://api.ipify.org?format=json',{signal:AbortSignal.timeout(4000)});const d=await r.json();if(d.ip)CIP=d.ip;}
  catch{CIP='127.'+(navigator.platform.length%256)+'.'+(screen.width%256)+'.1';}
}

/* ── CURSOR ── */
function initCursor(){
  const g=document.getElementById('cGlow'),d=document.getElementById('cDot');
  if(!g||!d)return;
  let gx=0,gy=0,dx=0,dy=0;
  document.addEventListener('mousemove',e=>{dx=e.clientX;dy=e.clientY;d.style.left=dx+'px';d.style.top=dy+'px';});
  (function ag(){gx+=(dx-gx)*.1;gy+=(dy-gy)*.1;g.style.left=gx+'px';g.style.top=gy+'px';requestAnimationFrame(ag);})();
  const sel='button,a,.bcard,.nl,.atab,.admin-tab-btn,.cat-card,.sc,.why-card,.ucrd';
  document.querySelectorAll(sel).forEach(el=>{
    el.addEventListener('mouseenter',()=>{d.style.width='14px';d.style.height='14px';d.style.background='#fff';});
    el.addEventListener('mouseleave',()=>{d.style.width='7px';d.style.height='7px';d.style.background='var(--a)';});
  });
}

/* ── TILT ── */
function initTilt(){
  document.addEventListener('mousemove',e=>{
    document.querySelectorAll('.bcard').forEach(c=>{
      const r=c.getBoundingClientRect();
      if(e.clientX<r.left-100||e.clientX>r.right+100||e.clientY<r.top-100||e.clientY>r.bottom+100){
        c.style.transform='perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';return;
      }
      const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      c.style.transform=`perspective(1000px) rotateY(${x*14}deg) rotateX(${-y*14}deg) translateZ(10px)`;
    });
  });
}

/* ── NUMBER ANIM ── */
function animNum(el,target,dur=1000){
  if(!el)return;let s=null;
  (function step(ts){if(!s)s=ts;const p=Math.min((ts-s)/dur,1),e=1-Math.pow(1-p,3);el.textContent=Math.floor(target*e);if(p<1)requestAnimationFrame(step);})(performance.now());
}

/* ── SCROLL REVEAL ── */
function initReveal(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');obs.unobserve(e.target);}});
  },{threshold:.1});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}

/* ── BACK TO TOP ── */
window.addEventListener('scroll',()=>{
  const b=document.getElementById('btnTop');
  if(b) b.classList.toggle('show',window.scrollY>440);
});

/* ── LOADER ── */
function runLoader(cb){
  const bar=document.getElementById('loadBar'),msg=document.getElementById('loadMsg');
  const msgs=['INITIALIZING SYSTEM...','LOADING ASSETS...','FETCHING IP ADDRESS...','CHECKING SESSION...','VERIFYING SECURITY...','SYSTEM READY ✓'];
  let p=0,step=0;
  const iv=setInterval(()=>{
    p=Math.min(p+Math.random()*12+6,100);
    if(bar)bar.style.width=p+'%';
    if(p>step*20&&step<msgs.length&&msg)msg.textContent=msgs[step++];
    if(p>=100){clearInterval(iv);setTimeout(()=>{const el=document.getElementById('screenLoad');if(el)el.classList.add('out');setTimeout(cb,700);},400);}
  },130);
}

/* ── BAN ── */
function checkBanned(){return ls('bans',[]).some(b=>b.ip===CIP);}
function showBanned(){
  const el=document.getElementById('screenBanned');if(!el)return;
  const ip=document.getElementById('banIpDisplay');if(ip)ip.textContent=CIP;
  el.style.display='flex';
  const a=document.getElementById('screenAuth');if(a)a.style.display='none';
  const m=document.getElementById('mainApp');if(m)m.style.display='none';
}

/* ── AUTH ── */
function switchTab(t){
  document.getElementById('tabL').classList.toggle('active',t==='login');
  document.getElementById('tabR').classList.toggle('active',t==='register');
  document.getElementById('fLogin').classList.toggle('active',t==='login');
  document.getElementById('fReg').classList.toggle('active',t==='register');
  ['lErr','rErr'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='';});
}
function toggleEye(id,btn){
  const el=document.getElementById(id);if(!el)return;
  const s=el.type==='password';el.type=s?'text':'password';btn.textContent=s?'🙈':'👁';
}

function doLogin(){
  const u=document.getElementById('lU').value.trim().toLowerCase();
  const p=document.getElementById('lP').value;
  const err=document.getElementById('lErr');
  if(!u||!p){err.textContent='⚠ Fill in all fields.';return;}
  const users=ls('users',[]);
  const user=users.find(x=>x.username.toLowerCase()===u);
  if(!user){err.textContent='✕ Username not found.';return;}
  if(user.pwHash!==hashPw(p)){err.textContent='✕ Incorrect password.';return;}
  if(user.role==='owner'||user.role==='staff'){
    const sess=ls('sessions',{}),ex=sess[user.id];
    if(ex&&ex.ip&&ex.ip!==CIP&&(Date.now()-ex.lastPing)<SESSION_TTL*2){
      err.textContent=`🔒 Account active from IP ${ex.ip}.`;return;
    }
  }
  recordSession(user.id,user.username,user.role);
  CU=user;ss('activeSession',{id:user.id});
  logAct('join',`<em>${esc(user.username)}</em> logged in`);
  pushNotif(`Welcome back, ${user.username}! 👋`,'info');
  launchApp();
}

function doRegister(){
  const u=document.getElementById('rU').value.trim().toLowerCase();
  const e=document.getElementById('rE').value.trim();
  const p=document.getElementById('rP').value;
  const code=document.getElementById('rC').value.trim().toUpperCase();
  const err=document.getElementById('rErr');
  if(!u||!e||!p){err.textContent='⚠ Fill in all required fields.';return;}
  if(u.length<3){err.textContent='⚠ Username min 3 characters.';return;}
  if(p.length<6){err.textContent='⚠ Password min 6 characters.';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){err.textContent='⚠ Invalid email format.';return;}
  const users=ls('users',[]);
  if(users.find(x=>x.username.toLowerCase()===u)){err.textContent='✕ Username already taken.';return;}
  if(users.find(x=>x.email.toLowerCase()===e.toLowerCase())){err.textContent='✕ Email already registered.';return;}
  let role='user';
  if(code){
    const staffCodes=ls('staffCodes',[]);
    const ce=staffCodes.find(c=>c.code===code&&!c.used);
    if(!ce){err.textContent='✕ Invalid or used staff code.';return;}
    if(users.filter(x=>x.role==='staff').length>=2){err.textContent='✕ Staff slots full (max 2).';return;}
    role='staff';ce.used=true;ce.usedBy=u;ce.usedAt=Date.now();ss('staffCodes',staffCodes);
  }
  users.push({id:'u'+Date.now(),username:u,email:e,pwHash:hashPw(p),role,createdAt:Date.now()});
  ss('users',users);
  toast('✓ Account created! Please log in.','ok');
  switchTab('login');document.getElementById('lU').value=u;
}

function doLogout(){
  if(CU)clearSession(CU.id);
  clearInterval(pingTimer);stopLiveTimer();clearInterval(window._clkT);
  CU=null;ss('activeSession',null);
  document.getElementById('mainApp').style.display='none';
  document.getElementById('screenAuth').style.display='flex';
  if(typeof initAuthCanvas==='function')initAuthCanvas();
  toast('Logged out.','info');
}

/* ── SESSIONS ── */
function recordSession(uid,username,role){
  const sess=ls('sessions',{}),ex=sess[uid]||{};
  sess[uid]={uid,username,role,ip:CIP,lastPing:Date.now(),online:true,device:getDevice(),joinedAt:ex.joinedAt||Date.now()};
  ss('sessions',sess);
}
function pingSession(){
  if(!CU)return;
  const sess=ls('sessions',{});
  if(sess[CU.id]){sess[CU.id].lastPing=Date.now();sess[CU.id].online=true;sess[CU.id].ip=CIP;ss('sessions',sess);}
}
function clearSession(uid){
  const sess=ls('sessions',{});if(sess[uid]){sess[uid].online=false;sess[uid].lastPing=0;}ss('sessions',sess);
}
function startPing(){clearInterval(pingTimer);pingSession();pingTimer=setInterval(pingSession,PING_MS);}

/* ── LIVE COUNTER ── */
function syncLive(){
  const cnt=Object.values(ls('sessions',{})).filter(r=>(Date.now()-r.lastPing)<SESSION_TTL).length;
  ['navOnlineNum','hsOnline','panelOnlineCount','scOnline'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.textContent=cnt;
  });
}

/* ── ACTIVITY LOG ── */
function logAct(type,msg){
  const log=ls('actLog',[]);log.unshift({type,msg,ts:Date.now()});
  if(log.length>80)log.pop();ss('actLog',log);
}

/* ── NOTIFICATIONS ── */
function pushNotif(msg,type='info'){
  const n=ls('notifs',[]);n.unshift({id:'n'+Date.now(),msg,type,read:false,ts:Date.now()});
  if(n.length>20)n.pop();ss('notifs',n);updateNotifDot();
}
function updateNotifDot(){
  const d=document.getElementById('notifDot');
  const unread=ls('notifs',[]).filter(n=>!n.read).length;
  if(d)d.style.display=unread?'block':'none';
}
function toggleNotifPanel(){
  const p=document.getElementById('notifPanel');if(!p)return;
  notifOpen=!notifOpen;p.style.display=notifOpen?'block':'none';
  if(notifOpen)renderNotifs();
}
function renderNotifs(){
  const el=document.getElementById('notifList');if(!el)return;
  const n=ls('notifs',[]);
  if(!n.length){el.innerHTML='<div class="ni-empty">No notifications</div>';return;}
  el.innerHTML=n.map(x=>`
    <div class="ni-item ${x.read?'':'unread'}">
      <div class="ni-dot ni-${x.type}"></div>
      <div><div class="ni-msg">${esc(x.msg)}</div><div class="ni-tm">${timeAgo(x.ts)}</div></div>
    </div>`).join('');
  const n2=ls('notifs',[]);n2.forEach(x=>x.read=true);ss('notifs',n2);updateNotifDot();
}
function clearNotifs(){ss('notifs',[]);renderNotifs();updateNotifDot();}
document.addEventListener('click',e=>{
  const p=document.getElementById('notifPanel'),b=document.getElementById('notifBtn');
  if(p&&notifOpen&&!p.contains(e.target)&&(!b||!b.contains(e.target))){p.style.display='none';notifOpen=false;}
});

/* ── WISHLIST ── */
function toggleWishlist(id,e){
  e.stopPropagation();
  const wl=ls('wishlist',[]),i=wl.indexOf(id);
  if(i>-1){wl.splice(i,1);toast('Removed from wishlist.','info');}
  else{wl.push(id);toast('❤ Added to wishlist!','ok');pushNotif('Build saved to wishlist!','ok');}
  ss('wishlist',wl);
  document.querySelectorAll(`.wl-btn[data-id="${id}"]`).forEach(btn=>{
    btn.textContent=wl.includes(id)?'❤':'♡';btn.style.color=wl.includes(id)?'var(--r)':'';
  });
  const mb=document.getElementById('mod-wl-'+id);
  if(mb){mb.textContent=wl.includes(id)?'❤ Saved':'♡ Save';mb.style.color=wl.includes(id)?'var(--r)':'';}
}
function isWl(id){return ls('wishlist',[]).includes(id);}

/* ── VIEW COUNTS ── */
function incView(id){const vc=ls('viewCounts',{});vc[id]=(vc[id]||0)+1;ss('viewCounts',vc);}
function getViews(id){return ls('viewCounts',{})[id]||0;}

/* ── REACTIONS ── */
function toggleRx(bid,em,e){
  e.stopPropagation();
  const key=CU?CU.id:'anon';
  const rx=ls('reactions',{});
  if(!rx[bid])rx[bid]={};
  rx[bid][key]===em?delete rx[bid][key]:(rx[bid][key]=em);
  ss('reactions',rx);
  const el=document.getElementById('rxRow_'+bid);
  if(el)el.innerHTML=rxHTML(bid);
}
function getRxCounts(bid){
  const rx=ls('reactions',{})[bid]||{};
  const c={};Object.values(rx).forEach(em=>{c[em]=(c[em]||0)+1;});return c;
}
function rxHTML(bid){
  const c=getRxCounts(bid),ur=CU?(ls('reactions',{})[bid]||{})[CU.id]:null;
  return['👍','🔥','⭐'].map(em=>`<button class="rx-btn${ur===em?' rx-on':''}" onclick="toggleRx('${bid}','${em}',event)">${em} <span>${c[em]||''}</span></button>`).join('');
}

/* ── RECENTLY VIEWED ── */
function pushRV(id){
  const rv=ls('recentViewed',[]).filter(x=>x!==id);
  rv.unshift(id);if(rv.length>6)rv.pop();ss('recentViewed',rv);
}

/* ── AUTO LOGIN ── */
function tryAutoLogin(){
  const saved=ls('activeSession',null);if(!saved)return false;
  const users=ls('users',[]);const u=users.find(x=>x.id===saved.id);if(!u)return false;
  if(u.role==='owner'||u.role==='staff'){
    const sess=ls('sessions',{}),ex=sess[u.id];
    if(ex&&ex.ip&&ex.ip!==CIP&&(Date.now()-ex.lastPing)<SESSION_TTL*2){ss('activeSession',null);return false;}
  }
  CU=u;recordSession(u.id,u.username,u.role);launchApp();return true;
}

/* ── LAUNCH ── */
function launchApp(){
  document.getElementById('screenAuth').style.display='none';
  document.getElementById('mainApp').style.display='block';
  const nm=document.getElementById('nbNm'),av=document.getElementById('nbAv'),rc=document.getElementById('nbRc');
  if(nm)nm.textContent=CU.username;
  if(av)av.textContent=CU.username[0].toUpperCase();
  if(rc){rc.textContent=CU.role.toUpperCase();rc.className='nb-role-chip '+CU.role;}
  const al=document.getElementById('nl-admin');if(al)al.style.display=(CU.role==='owner'||CU.role==='staff')?'inline':'none';
  const pl=document.getElementById('nl-profile');if(pl)pl.style.display='inline';
  startPing();syncLive();setInterval(syncLive,PING_MS);
  updateNotifDot();applyTicker();
  goTo('home');updateHomeStats();
  setTimeout(()=>{initReveal();initParticles();initParallax();updateStatsBanner();},200);
}

/* ── TICKER ── */
function applyTicker(){
  const msg=ls('announcement','');
  const wrap=document.getElementById('tickerWrap'),inner=document.getElementById('tickerInner');
  if(msg&&wrap&&inner){inner.textContent=msg+'  ·  '+msg+'  ·  '+msg;wrap.style.display='flex';}
  else if(wrap)wrap.style.display='none';
}
function saveAnnouncement(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const v=document.getElementById('announceInput').value.trim();
  ss('announcement',v);applyTicker();toast(v?'✓ Announcement published!':'Cleared.','ok');
}
function clearAnnouncement(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  ss('announcement','');applyTicker();
  const inp=document.getElementById('announceInput');if(inp)inp.value='';
  toast('Announcement cleared.','info');
}

/* ── NAVIGATION ── */
function goTo(page){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nl').forEach(l=>l.classList.remove('active'));
  const sec=document.getElementById('sec-'+page);if(sec)sec.classList.add('active');
  const lnk=document.getElementById('nl-'+page);if(lnk)lnk.classList.add('active');
  document.getElementById('nbLinks').classList.remove('open');
  if(page==='home'){renderGrid('featGrid',null,'all',true,false);renderGrid('recentGrid',null,'all',false,true);updateHomeStats();setTimeout(updateStatsBanner,300);}
  if(page==='store')renderGrid('storeGrid',null,curFilter);
  if(page==='premium')renderGrid('premGrid','premium');
  if(page==='free')renderGrid('freeGrid','free');
  if(page==='submit')renderMyPending();
  if(page==='admin')initAdminPanel();
  if(page==='profile')renderProfile();
  window.scrollTo({top:0,behavior:'smooth'});setTimeout(initReveal,100);
}
function toggleNav(){document.getElementById('nbLinks').classList.toggle('open');}

/* ── HOME STATS ── */
function updateHomeStats(){
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  const users=ls('users',[]);
  const prem=builds.filter(b=>b.type==='premium').length;
  const free=builds.filter(b=>b.type==='free').length;
  animNum(document.getElementById('hsB'),builds.length);animNum(document.getElementById('hsP'),prem);
  animNum(document.getElementById('hsF'),free);animNum(document.getElementById('hsU'),users.length);
  animNum(document.getElementById('authStatB'),builds.length);animNum(document.getElementById('authStatU'),users.length);
  const cp=document.getElementById('ccPrem');if(cp)cp.textContent=prem+' builds';
  const cf=document.getElementById('ccFree');if(cf)cf.textContent=free+' builds';
}

/* ── SEARCH ── */
function openSearch(){
  const ov=document.getElementById('searchOverlay');if(!ov)return;
  ov.classList.add('open');
  setTimeout(()=>{const inp=document.getElementById('srchInput');if(inp){inp.focus();inp.value='';}document.getElementById('srchResults').innerHTML='';},50);
}
function closeSearch(){document.getElementById('searchOverlay').classList.remove('open');}
function doSearch(q){
  const res=document.getElementById('srchResults');if(!res)return;
  if(!q.trim()){res.innerHTML='';return;}
  const ql=q.toLowerCase();
  const matched=ls('builds',[]).filter(b=>b.status==='approved'&&(b.name.toLowerCase().includes(ql)||(b.cat||'').toLowerCase().includes(ql)||(b.desc||'').toLowerCase().includes(ql))).slice(0,8);
  if(!matched.length){res.innerHTML=`<div class="sri-empty">No results for "${esc(q)}"</div>`;return;}
  res.innerHTML=matched.map(b=>{
    const ip=b.type==='premium',pr=ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE';
    return `<div class="sri" onclick="closeSearch();openModal('${b.id}')">
      <div class="sri-thumb">${b.photoData?`<img src="${b.photoData}" alt="">`:b.icon||'◈'}</div>
      <div><div class="sri-name">${esc(b.name)}</div><div class="sri-meta">${esc(b.cat||'—')} · ${pr} · ${getViews(b.id)} views</div></div>
      <span class="sri-badge ${ip?'sri-p':'sri-f'}">${ip?'♛':'✦'} ${ip?'PREM':'FREE'}</span>
    </div>`;
  }).join('');
}

/* ── GRIDS ── */
function renderGrid(cid,tf,fm,featOnly,recentOnly){
  const el=document.getElementById(cid);if(!el)return;
  let builds=ls('builds',[]).filter(b=>b.status==='approved');
  if(tf)builds=builds.filter(b=>b.type===tf);
  if(fm&&fm!=='all')builds=builds.filter(b=>b.type===fm);
  if(featOnly)builds=builds.filter(b=>b.featured).slice(0,6);
  if(recentOnly)builds=[...builds].sort((a,c)=>c.createdAt-a.createdAt).slice(0,4);
  if(!builds.length){el.innerHTML=`<div class="empty-state"><span class="es-icon">◎</span>NO BUILDS AVAILABLE YET</div>`;return;}
  el.innerHTML=builds.map(buildCardHTML).join('');setTimeout(initTilt,100);
}

function buildCardHTML(b){
  const ip=b.type==='premium',pr=ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE';
  const thumb=b.photoData?`<img class="bc-photo" src="${b.photoData}" alt="">`:`<span class="bc-icon">◈</span>`;
  const wl=isWl(b.id);
  return `<div class="bcard" onclick="openModal('${b.id}')">
    <div class="bc-thumb"><div class="bc-thumb-glow"></div>${thumb}
      <span class="bc-badge ${ip?'bp':'bf'}">${ip?'♛ PREMIUM':'✦ FREE'}</span>
      <button class="wl-btn" data-id="${b.id}" onclick="toggleWishlist('${b.id}',event)" style="color:${wl?'var(--r)':''};">${wl?'❤':'♡'}</button>
    </div>
    <div class="bc-body">
      <div class="bc-top-row"><div class="bc-cat">${esc(b.cat||'—')}</div><div class="bc-views">👁 ${getViews(b.id)}</div></div>
      <div class="bc-name">${esc(b.name)}</div>
      <div class="bc-desc">${esc(b.desc)}</div>
      <div class="bc-foot"><span class="bc-price ${ip?'pp':'fp'}">${pr}</span><button class="btn-view">VIEW →</button></div>
    </div>
  </div>`;
}

function applyFilter(type,btn,gridId){
  curFilter=type;document.querySelectorAll('.flt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderGrid(gridId,null,type);
}

/* ── MODAL ── */
function openModal(id){
  const b=ls('builds',[]).find(x=>x.id===id);if(!b)return;
  incView(id);pushRV(id);logAct('view',`<em>${esc(CU.username)}</em> viewed <em>${esc(b.name)}</em>`);
  const ip=b.type==='premium',pr=ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE';
  const wl=isWl(id);
  document.getElementById('modalContent').innerHTML=`
    ${b.photoData?`<img class="mod-photo" src="${b.photoData}" alt="">`: ''}
    <div class="mod-top-row">
      <span class="mod-badge ${ip?'prem':'free'}">${ip?'♛ PREMIUM':'✦ FREE'}</span>
      <button class="mod-wl-btn" id="mod-wl-${id}" onclick="toggleWishlist('${id}',event)" style="color:${wl?'var(--r)':''}">${wl?'❤ Saved':'♡ Save'}</button>
    </div>
    <div class="mod-title">${esc(b.name)}</div>
    <div class="mod-meta">${esc(b.cat)}${b.submitter&&b.submitter!=='owner'?` · By <strong>${esc(b.submitter)}</strong>`:''} · 👁 ${getViews(id)}</div>
    <div class="mod-desc">${esc(b.desc)}</div>
    ${b.contact?`<div class="mod-contact">📞 Seller: <strong>${esc(b.contact)}</strong></div>`:''}
    ${b.buildFileName?`<div class="mod-file-info">📦 File: <strong>${esc(b.buildFileName)}</strong></div>`:''}
    <div class="mod-price-row"><div class="mod-price ${ip?'pp':'fp'}">${pr}</div></div>
    <div class="rx-row" id="rxRow_${id}">${rxHTML(id)}</div>
    ${ip?`<button class="btn-modal-action bma-buy" onclick="handleBuy('${b.id}')">💳 BUY NOW</button>`
       :`${b.buildFileName?`<button class="btn-modal-action bma-dl" onclick="handleDL('${b.id}')">⬇ DOWNLOAD .BUILD FILE</button>`:''}
         <a href="${esc(b.link||'#')}" target="_blank" class="btn-modal-action bma-prev">🔗 VIEW PREVIEW</a>`}`;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(e){if(!e||e.target===document.getElementById('modalOverlay'))document.getElementById('modalOverlay').classList.remove('open');}
function handleBuy(id){const b=ls('builds',[]).find(x=>x.id===id);if(b)toast(`💬 Contact seller: ${b.contact||'Contact admin'}`, 'info');closeModal();}
function handleDL(id){
  const b=ls('builds',[]).find(x=>x.id===id);
  if(!b||!b.buildFileData){toast('⚠ File not available.','err');return;}
  const by=atob(b.buildFileData),ab=new ArrayBuffer(by.length),ia=new Uint8Array(ab);
  for(let i=0;i<by.length;i++)ia[i]=by.charCodeAt(i);
  const blob=new Blob([ab],{type:'application/octet-stream'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=b.buildFileName||'build.build';a.click();
  URL.revokeObjectURL(url);toast('⬇ Downloading...','ok');
}

/* ── FILE UPLOAD ── */
function handleBuildFile(input){
  const file=input.files[0];if(!file)return;

  // ── STRICT: must end with .build only ──
  const fname=file.name;
  const ext=fname.slice(fname.lastIndexOf('.')+1).toLowerCase();

  if(ext!=='build'){
    // Clear input
    input.value='';uploadedBuild=null;
    // Show inline error on drop zone
    const zone=document.getElementById('buildDropZone');
    zone.style.borderColor='var(--r)';
    const fn=document.getElementById('buildFileName');
    fn.style.color='var(--r)';
    fn.textContent='✕ Invalid format — only .build files accepted  (e.g. myapp.build)';
    // Toast with example
    toast('✕ Only .build files allowed  ·  Example: myapp.build','err');
    // Reset border after 3s
    setTimeout(()=>{zone.style.borderColor='';fn.textContent='';fn.style.color='';},3200);
    return;
  }

  if(file.size>150*1024*1024){
    input.value='';
    toast('✕ File too large — maximum size is 150 MB.','err');
    return;
  }

  const reader=new FileReader();
  reader.onload=e=>{
    uploadedBuild={name:fname,data:btoa(String.fromCharCode(...new Uint8Array(e.target.result)))};
    const fn=document.getElementById('buildFileName');
    fn.style.color='var(--g)';
    fn.textContent='✓ '+fname;
    const zone=document.getElementById('buildDropZone');
    zone.style.borderColor='var(--g)';
    clearFieldError('buildDropZone');
  };
  reader.readAsArrayBuffer(file);
}
function handlePhotoFile(input){
  const file=input.files[0];if(!file)return;
  if(!file.type.startsWith('image/')){toast('✕ Image files only.','err');input.value='';return;}
  if(file.size>5*1024*1024){toast('✕ Max 5MB.','err');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    uploadedPhoto=e.target.result;
    document.getElementById('photoPreviewImg').src=uploadedPhoto;
    document.getElementById('photoPreviewWrap').style.display='flex';
    const ph=document.getElementById('photoPlaceholder');if(ph)ph.style.display='none';
    document.getElementById('photoDropZone').style.borderColor='var(--fr)';
  };
  reader.readAsDataURL(file);
}
['buildDropZone','photoDropZone'].forEach(id=>{
  document.addEventListener('DOMContentLoaded',()=>{
    const zone=document.getElementById(id);if(!zone)return;
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='var(--a)';});
    zone.addEventListener('dragleave',()=>zone.style.borderColor='');
    zone.addEventListener('drop',e=>{e.preventDefault();zone.style.borderColor='';const file=e.dataTransfer.files[0];if(!file)return;if(id==='buildDropZone')handleBuildFile({files:[file],value:''});else handlePhotoFile({files:[file],value:''}); });
  });
});

/* ── SUBMIT BUILD ── */

/* Helpers: highlight / clear field errors */
function setFieldError(id,msg){
  const el=document.getElementById(id);if(!el)return;
  el.style.borderColor='var(--r)';
  let hint=el.parentElement.querySelector('.field-hint');
  if(!hint){hint=document.createElement('div');hint.className='field-hint';el.parentElement.appendChild(hint);}
  hint.textContent='⚠ '+msg;
  hint.style.color='var(--r)';hint.style.fontSize='.65rem';
  hint.style.marginTop='5px';hint.style.fontFamily='var(--fm)';
}
function clearFieldError(id){
  const el=document.getElementById(id);if(!el)return;
  el.style.borderColor='';
  const hint=el.parentElement?.querySelector('.field-hint');if(hint)hint.remove();
}
function setIbError(fieldId,msg){
  const ib=document.getElementById(fieldId)?.closest('.ib')||document.getElementById(fieldId)?.parentElement;
  if(ib){ib.style.borderColor='var(--r)';}
  const fg=document.getElementById(fieldId)?.closest('.fg');
  if(fg){
    let hint=fg.querySelector('.field-hint');
    if(!hint){hint=document.createElement('div');hint.className='field-hint';fg.appendChild(hint);}
    hint.textContent='⚠ '+msg;
    hint.style.color='var(--r)';hint.style.fontSize='.65rem';
    hint.style.marginTop='5px';hint.style.fontFamily='var(--fm)';
  }
}
function clearIbError(fieldId){
  const ib=document.getElementById(fieldId)?.closest('.ib')||document.getElementById(fieldId)?.parentElement;
  if(ib)ib.style.borderColor='';
  const fg=document.getElementById(fieldId)?.closest('.fg');
  if(fg){const h=fg.querySelector('.field-hint');if(h)h.remove();}
}

function submitBuild(){
  const n=document.getElementById('sbN').value.trim(),t=document.getElementById('sbT').value;
  const p=parseInt(document.getElementById('sbP').value)||0;
  const c=document.getElementById('sbC').value.trim(),d=document.getElementById('sbD').value.trim();
  const l=document.getElementById('sbL').value.trim(),k=document.getElementById('sbK').value.trim();
  const tos=document.getElementById('sbTos').checked;

  // Clear all previous errors
  ['sbN','sbC','sbD','sbL','sbK','sbP'].forEach(clearIbError);
  clearFieldError('buildDropZone');

  let hasError=false;
  function fail(fieldId,msg,isIb=true){
    if(isIb) setIbError(fieldId,msg);
    else setFieldError(fieldId,msg);
    hasError=true;
  }

  // ── REQUIRED FIELD CHECKS ──
  if(!n)            fail('sbN','Build name is required.');
  if(!c)            fail('sbC','Category is required  (e.g. Dashboard, Portfolio, Landing Page).');
  if(!d)            fail('sbD','Description is required — describe your build features.');
  if(!l)            fail('sbL','Demo link is required  (e.g. https://your-demo.vercel.app).');
  if(t==='premium'&&p<=0) fail('sbP','Price is required for premium builds.');

  // ── .BUILD FILE CHECK ──
  if(!uploadedBuild){
    const zone=document.getElementById('buildDropZone');
    zone.style.borderColor='var(--r)';
    const fn=document.getElementById('buildFileName');
    fn.style.color='var(--r)';
    fn.textContent='⚠ You must upload a .build file  (e.g. myapp.build)';
    hasError=true;
  }

  // ── TOS CHECK ──
  if(!tos){
    const tosRow=document.getElementById('sbTos')?.closest('.tos-row');
    if(tosRow){tosRow.style.outline='1px solid var(--r)';tosRow.style.borderRadius='6px';}
    toast('⚠ Please confirm this is your original work.','err');
    hasError=true;
  }

  if(hasError){
    toast('⚠ Please fill in all required fields before submitting.','err');
    // Scroll to first error
    const firstErr=document.querySelector('.field-hint,#buildDropZone[style*="var(--r)"]');
    if(firstErr) firstErr.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  const builds=ls('builds',[]);
  builds.push({id:'b'+Date.now(),name:n,type:t,price:p,cat:c,desc:d,link:l,contact:k,photoData:uploadedPhoto,buildFileName:uploadedBuild.name,buildFileData:uploadedBuild.data,submitter:CU.username,featured:false,status:'pending',createdAt:Date.now()});
  ss('builds',builds);
  logAct('upload',`<em>${esc(CU.username)}</em> submitted <em>${esc(n)}</em>`);
  pushNotif(`Build "${n}" submitted! Awaiting review.`,'info');
  ['sbN','sbP','sbC','sbD','sbL','sbK'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('sbTos').checked=false;
  document.getElementById('buildFileName').textContent='';
  document.getElementById('buildDropZone').style.borderColor='';
  document.getElementById('photoDropZone').style.borderColor='';
  document.getElementById('photoPreviewWrap').style.display='none';
  document.getElementById('photoPreviewImg').src='';
  const ph=document.getElementById('photoPlaceholder');if(ph)ph.style.display='';
  uploadedBuild=null;uploadedPhoto=null;
  toast('✓ Build submitted! Pending owner review.','ok');renderMyPending();
}
function renderMyPending(){
  const el=document.getElementById('myPendingList');if(!el)return;
  const mine=ls('builds',[]).filter(b=>b.submitter===CU.username&&b.status==='pending');
  if(!mine.length){el.innerHTML='<div class="usb-empty">No pending builds.</div>';return;}
  el.innerHTML=mine.map(b=>`<div class="pend-item"><div class="pend-name">${esc(b.name)}</div><div class="pend-status">⏳ Awaiting review...</div></div>`).join('');
}

/* ── PROFILE PAGE ── */
function renderProfile(){
  const el=document.getElementById('profileContent');if(!el)return;
  const builds=ls('builds',[]).filter(b=>b.submitter===CU.username&&b.status==='approved');
  const wl=ls('wishlist',[]);
  const wlBuilds=ls('builds',[]).filter(b=>wl.includes(b.id)&&b.status==='approved');
  const rv=ls('recentViewed',[]).map(id=>ls('builds',[]).find(b=>b.id===id)).filter(Boolean).slice(0,4);
  el.innerHTML=`
    <div class="profile-layout">
      <div class="profile-card">
        <div class="pc-avatar">${CU.username[0].toUpperCase()}</div>
        <div class="pc-name">${esc(CU.username)}</div>
        <div class="pc-role-chip ch-${CU.role}">${CU.role.toUpperCase()}</div>
        <div class="pc-email">${esc(CU.email)}</div>
        <div class="pc-stats">
          <div class="pc-stat"><div class="pc-sn">${builds.length}</div><div class="pc-sl">UPLOADS</div></div>
          <div class="pc-stat"><div class="pc-sn">${wl.length}</div><div class="pc-sl">WISHLIST</div></div>
          <div class="pc-stat"><div class="pc-sn">${ls('builds',[]).filter(b=>b.submitter===CU.username&&b.status==='pending').length}</div><div class="pc-sl">PENDING</div></div>
        </div>
      </div>
      <div class="profile-right">
        ${wlBuilds.length?`<div><div class="ps-title">❤ WISHLIST</div><div class="builds-grid">${wlBuilds.map(buildCardHTML).join('')}</div></div>`:''}
        ${rv.length?`<div><div class="ps-title">🕐 RECENTLY VIEWED</div><div class="builds-grid">${rv.map(buildCardHTML).join('')}</div></div>`:''}
        ${builds.length?`<div><div class="ps-title">📦 MY BUILDS</div><div class="builds-grid">${builds.map(buildCardHTML).join('')}</div></div>`:''}
        ${!wlBuilds.length&&!rv.length&&!builds.length?`<div class="empty-state"><span class="es-icon">👤</span>Explore builds and save favorites!</div>`:''}
      </div>
    </div>`;
  setTimeout(initTilt,100);
}

/* ═════════════════════════════════════
   ADMIN PANEL
   NOTE: uses .admtab (NOT .atab) for content
   ═════════════════════════════════════ */
function initAdminPanel(){
  const rb=document.getElementById('adminRoleBadge'),st=document.getElementById('adminSubTxt'),cr=document.getElementById('phCrown');
  if(rb){rb.textContent=CU.role.toUpperCase();rb.className='ph-role-badge '+CU.role;}
  if(st)st.innerHTML=CU.role==='owner'?`Full system access · <span id="adminClock" style="color:var(--a)"></span>`:'Staff — Manage Builds Only';
  if(cr)cr.style.display=CU.role==='owner'?'block':'none';
  const sg=document.getElementById('statGrid');if(sg)sg.style.display=CU.role==='owner'?'grid':'none';
  startAdminClock();buildAdminTabs();refreshStats();
  if(CU.role==='owner')checkOwnerAlert();
}

function startAdminClock(){
  const tick=()=>{const el=document.getElementById('adminClock');if(!el)return;el.textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});};
  tick();clearInterval(window._clkT);window._clkT=setInterval(tick,1000);
}

function refreshStats(){
  if(CU.role!=='owner')return;
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  const pending=ls('builds',[]).filter(b=>b.status==='pending');
  const users=ls('users',[]);
  const online=Object.values(ls('sessions',{})).filter(s=>(Date.now()-s.lastPing)<SESSION_TTL).length;
  syncLive();
  animNum(document.getElementById('scOnline'),online,500);
  animNum(document.getElementById('scBuilds'),builds.length,500);
  animNum(document.getElementById('scPremium'),builds.filter(b=>b.type==='premium').length,500);
  animNum(document.getElementById('scMembers'),users.length,500);
  animNum(document.getElementById('scPending'),pending.length,500);
  animNum(document.getElementById('scBanned'),ls('bans',[]).length,500);
  const pb=document.getElementById('pendBadge');if(pb)pb.textContent=pending.length;
}

function checkOwnerAlert(){
  const p=ls('builds',[]).filter(b=>b.status==='pending').length;
  const ab=document.getElementById('ownerAlert'),am=document.getElementById('ownerAlertMsg');
  if(ab&&am&&p>0){am.textContent=`${p} build${p>1?'s':''} pending review.`;ab.style.display='flex';}
  else if(ab)ab.style.display='none';
}

function buildAdminTabs(){
  const nav=document.getElementById('adminTabsNav');if(!nav)return;
  const io=CU.role==='owner';
  const tabs=[
    {id:'builds',label:'📦 BUILDS',all:true},
    {id:'users', label:'👥 USERS', all:false},
    {id:'live',  label:'📡 LIVE <span style="color:var(--r);animation:livePing 1.5s infinite;font-size:.7em">●</span>',all:false},
    {id:'ban',   label:'🚫 BAN IP',all:false},
    {id:'pwd',   label:'🔑 RESET PWD',all:false},
    {id:'codes', label:'🎫 STAFF CODES',all:false},
    {id:'tools', label:'📢 TOOLS',all:false},
  ];
  nav.innerHTML=tabs.filter(t=>t.all||io).map((t,i)=>
    `<button class="admin-tab-btn${i===0?' active':''}" onclick="switchAdminTab('${t.id}',this)">${t.label}</button>`
  ).join('');
  // Show/hide owner-only admtab sections
  ['admtab-users','admtab-live','admtab-ban','admtab-pwd','admtab-codes','admtab-tools'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display=io?'':'none';
  });
  const ab=document.getElementById('addBuildBox');if(ab)ab.style.display=io?'':'none';
  const pb=document.getElementById('pendingBox');if(pb)pb.style.display=io?'':'none';
  // Activate first tab
  document.querySelectorAll('.admtab').forEach(t=>t.classList.remove('active'));
  const first=document.getElementById('admtab-builds');if(first)first.classList.add('active');
  renderBuildPanel();
}

function switchAdminTab(name,btn){
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.admtab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab=document.getElementById('admtab-'+name);if(tab)tab.classList.add('active');
  if(name==='live'){refreshLive();startLiveTimer();}
  if(name==='ban')renderBanPanel();
  if(name==='users')renderUserPanel();
  if(name==='codes')renderCodesPanel();
  if(name==='builds')renderBuildPanel();
  if(name==='tools'){const inp=document.getElementById('announceInput');if(inp)inp.value=ls('announcement','')||'';}
  refreshStats();
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
  renderBuildPanel();updateHomeStats();refreshStats();toast('✓ Build added!','ok');
}

function renderBuildPanel(){
  renderPendingPanel();
  const el=document.getElementById('buildPanelList');if(!el)return;
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  if(!builds.length){el.innerHTML='<div class="empty-state" style="padding:20px"><span class="es-icon" style="font-size:1.4rem">◎</span>No approved builds yet</div>';return;}
  renderBuildListHTML(el,builds);
}

function filterAdminBuilds(q){
  const el=document.getElementById('buildPanelList');if(!el)return;
  const all=ls('builds',[]).filter(b=>b.status==='approved');
  const filtered=q?all.filter(b=>b.name.toLowerCase().includes(q.toLowerCase())||(b.cat||'').toLowerCase().includes(q.toLowerCase())):all;
  if(!filtered.length){el.innerHTML='<div class="empty-state" style="padding:18px">No results for "'+esc(q)+'"</div>';return;}
  renderBuildListHTML(el,filtered);
}

function renderBuildListHTML(el,builds){
  el.innerHTML=builds.map(b=>{
    const ip=b.type==='premium';
    const thumb=b.photoData?`<img src="${b.photoData}" style="width:100%;height:100%;object-fit:cover">`:(b.icon||'◈');
    return `<div class="pl-item">
      <div class="pl-thumb">${thumb}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(b.name)}<span class="chip ${ip?'ch-prem':'ch-free'}">${ip?'PREMIUM':'FREE'}</span>${b.featured?'<span class="chip" style="background:rgba(255,196,50,.1);color:var(--gold)">⭐</span>':''}${b.submitter&&b.submitter!=='owner'?`<span style="font-family:var(--fm);font-size:.57rem;color:var(--t2)">by ${esc(b.submitter)}</span>`:''}</div>
        <div class="pl-meta">${ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE'} · ${esc(b.cat)} ${b.buildFileName?'· 📦 '+esc(b.buildFileName):''} · 👁 ${getViews(b.id)}</div>
      </div>
      <div class="pl-actions">
        ${CU.role==='owner'?`<button class="btn-feat" onclick="toggleFeatured('${b.id}')">${b.featured?'⭐':'☆'}</button>`:''}
        <button class="btn-del" onclick="deleteBuild('${b.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function renderPendingPanel(){
  if(CU.role!=='owner')return;
  const el=document.getElementById('pendingList'),badge=document.getElementById('pendBadge');if(!el)return;
  const pending=ls('builds',[]).filter(b=>b.status==='pending');
  if(badge)badge.textContent=pending.length;
  if(!pending.length){el.innerHTML='<div class="empty-state" style="padding:14px">✓ No pending builds</div>';return;}
  el.innerHTML=pending.map(b=>`
    <div class="pl-item">
      <div class="pl-thumb">${b.photoData?`<img src="${b.photoData}" style="width:100%;height:100%;object-fit:cover">`:'📦'}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(b.name)}<span class="chip ch-pending">PENDING</span></div>
        <div class="pl-meta">By: ${esc(b.submitter)} · ${b.type==='premium'?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE'} · ${b.buildFileName?'📦 '+esc(b.buildFileName):'no file'} · <a href="${esc(b.link||'#')}" target="_blank" style="color:var(--a);text-decoration:none">Preview ↗</a></div>
      </div>
      <div class="pl-actions">
        <button class="btn-approve" onclick="approveBuild('${b.id}')">✓ APPROVE</button>
        <button class="btn-del"     onclick="rejectBuild('${b.id}')">✕ REJECT</button>
      </div>
    </div>`).join('');
}

function deleteBuild(id){
  if(!confirm('Delete this build?'))return;
  ss('builds',ls('builds',[]).filter(b=>b.id!==id));
  renderBuildPanel();renderGrid('storeGrid',null,curFilter);renderGrid('featGrid',null,'all',true,false);renderGrid('recentGrid',null,'all',false,true);
  updateHomeStats();refreshStats();toast('Build deleted.','info');
}
function toggleFeatured(id){
  if(CU.role!=='owner')return;
  const builds=ls('builds',[]),i=builds.findIndex(b=>b.id===id);if(i<0)return;
  builds[i].featured=!builds[i].featured;ss('builds',builds);renderBuildPanel();toast(builds[i].featured?'⭐ Featured!':'Removed from featured.','info');
}
function approveBuild(id){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const builds=ls('builds',[]),i=builds.findIndex(b=>b.id===id);if(i<0)return;
  builds[i].status='approved';ss('builds',builds);renderBuildPanel();updateHomeStats();refreshStats();toast('✓ Approved!','ok');
}
function rejectBuild(id){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm('Reject and delete?'))return;
  ss('builds',ls('builds',[]).filter(b=>b.id!==id));renderBuildPanel();refreshStats();toast('Rejected.','info');
}

/* ── USERS ── */
function renderUserPanel(){
  if(CU.role!=='owner')return;
  const grid=document.getElementById('userCardsGrid');if(!grid)return;
  const users=ls('users',[]),sess=ls('sessions',{});
  grid.innerHTML=users.map(u=>{
    const s=sess[u.id],on=s&&(Date.now()-s.lastPing)<SESSION_TTL;
    return `<div class="ucrd">
      <div class="ucrd-top">
        <div class="ucrd-av ${u.role}">${u.username[0].toUpperCase()}</div>
        <div><div class="ucrd-name">${esc(u.username)}<span class="chip ch-${u.role}">${u.role.toUpperCase()}</span></div><div class="ucrd-email">${esc(u.email)}</div></div>
      </div>
      <div class="ucrd-mid">
        <div class="ucrd-ip">${s?esc(s.ip):'—'}${s&&s.device?' '+devIco(s.device):''}</div>
        <div class="ucrd-st ${on?'on':'off'}">${on?'● ONLINE':'○ offline'}</div>
      </div>
      <div class="ucrd-btns">
        ${u.id!==CU.id?`<button class="btn-ucrd-del" onclick="deleteUser('${u.id}')">🗑 DELETE</button>`:''}
        <button style="flex:1;padding:6px;background:var(--sf);border:1px solid var(--bd2);border-radius:6px;color:var(--t2);font-family:var(--fm);font-size:.6rem;cursor:pointer">👁 VIEW</button>
      </div>
    </div>`;
  }).join('');
}
function deleteUser(id){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm('Delete this user?'))return;
  ss('users',ls('users',[]).filter(u=>u.id!==id));clearSession(id);renderUserPanel();refreshStats();toast('User deleted.','info');
}

/* ── LIVE IP ── */
function refreshLive(){
  if(CU.role!=='owner')return;
  const sess=ls('sessions',{}),bans=ls('bans',[]).map(b=>b.ip),rows=Object.values(sess),now=Date.now();
  let online=0;rows.forEach(r=>{r.isOnline=(now-r.lastPing)<SESSION_TTL;if(r.isOnline)online++;});
  ['lsOnline','navOnlineNum','panelOnlineCount','scOnline','hsOnline'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=online;});
  const elT=document.getElementById('lsTotal'),elB=document.getElementById('lsBanned');
  if(elT)elT.textContent=rows.length;if(elB)elB.textContent=ls('bans',[]).length;
  // Visitor feed
  const feed=document.getElementById('visitorFeed');if(feed){
    if(!rows.length){feed.innerHTML='<div style="padding:18px;font-family:var(--fm);font-size:.7rem;color:var(--t3);text-align:center">No active sessions</div>';}
    else feed.innerHTML=rows.map(r=>`
      <div class="vr-item">
        <div class="vr-av ${r.role||'user'}">${(r.username||'?')[0].toUpperCase()}</div>
        <div class="vr-info">
          <div class="vr-top">${esc(r.username)}<span class="chip ch-${r.role||'user'}">${(r.role||'user').toUpperCase()}</span>${devIco(r.device)}</div>
          <div class="vr-bot">IP: ${esc(r.ip)} · joined ${timeAgo(r.joinedAt||r.lastPing)}</div>
        </div>
        <div class="vr-right">
          <div class="vr-st ${r.isOnline?'on':'off'}">${r.isOnline?'● ONLINE':'○ offline'}</div>
          ${!bans.includes(r.ip)?`<button class="btn-qban" onclick="quickBan('${esc(r.ip)}','${esc(r.username)}')">🚫</button>`:`<span style="font-family:var(--fm);font-size:.55rem;color:var(--r)">BANNED</span>`}
        </div>
      </div>`).join('');
  }
  // Device breakdown
  const dEl=document.getElementById('deviceBars');if(dEl){
    const c={laptop:0,mobile:0,tablet:0};rows.filter(r=>r.isOnline).forEach(r=>{c[r.device||'laptop']++;});
    const total=rows.filter(r=>r.isOnline).length||1;
    dEl.innerHTML=['laptop','mobile','tablet'].map(d=>{
      const pct=Math.round((c[d]/total)*100);
      return `<div class="dev-row"><span class="dev-lbl">${devIco(d)} ${d.toUpperCase()}</span><div class="dev-bw"><div class="dev-bar ${d}" style="width:${pct}%"></div></div><span class="dev-val">${c[d]}</span></div>`;
    }).join('');
  }
  // Activity
  const aEl=document.getElementById('activityFeed');if(aEl){
    const log=ls('actLog',[]).slice(0,10);
    const tm={join:{cls:'ad-j',ico:'●'},upload:{cls:'ad-u',ico:'↑'},view:{cls:'ad-v',ico:'👁'}};
    if(!log.length){aEl.innerHTML='<div style="font-family:var(--fm);font-size:.7rem;color:var(--t3);padding:10px">No activity yet.</div>';}
    else aEl.innerHTML=log.map(a=>{const t=tm[a.type]||{cls:'ad-v',ico:'●'};return `<div class="act-row"><div class="act-dot ${t.cls}">${t.ico}</div><div class="act-body"><div class="act-msg">${a.msg}</div><div class="act-tm">${timeAgo(a.ts)}</div></div></div>`;}).join('');
  }
}
function startLiveTimer(){stopLiveTimer();liveRem=10;liveTimer=setInterval(()=>{liveRem--;const cd=document.getElementById('liveCountdown');if(cd)cd.textContent=liveRem;if(liveRem<=0){liveRem=10;refreshLive();}},LIVE_TICK);}
function stopLiveTimer(){clearInterval(liveTimer);}

/* ── BAN ── */
function doBanIp(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const ip=document.getElementById('banIpIn').value.trim(),rsn=document.getElementById('banRsnIn').value.trim();
  if(!ip){toast('⚠ Enter IP.','err');return;}
  if(ip===CIP){toast('✕ Cannot ban own IP.','err');return;}
  const bans=ls('bans',[]);if(bans.find(b=>b.ip===ip)){toast('Already banned.','warn');return;}
  bans.push({ip,reason:rsn||'Violated rules',bannedBy:CU.username,bannedAt:Date.now()});ss('bans',bans);
  document.getElementById('banIpIn').value='';document.getElementById('banRsnIn').value='';
  renderBanPanel();refreshStats();toast(`🚫 IP ${ip} banned.`,'ok');
}
function quickBan(ip,username){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm(`Ban IP ${ip} (${username})?`))return;
  if(ip===CIP){toast('✕ Cannot ban own IP.','err');return;}
  const bans=ls('bans',[]);if(!bans.find(b=>b.ip===ip)){bans.push({ip,reason:'Banned via live monitor',bannedBy:CU.username,bannedAt:Date.now()});ss('bans',bans);}
  refreshLive();renderBanPanel();refreshStats();toast(`🚫 ${ip} banned.`,'ok');
}
function unbanIp(ip){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm(`Unban IP ${ip}?`))return;
  ss('bans',ls('bans',[]).filter(b=>b.ip!==ip));renderBanPanel();refreshStats();toast(`✓ ${ip} unbanned.`,'ok');
}
function renderBanPanel(){
  if(CU.role!=='owner')return;
  const el=document.getElementById('banPanelList');if(!el)return;
  const bans=ls('bans',[]);
  if(!bans.length){el.innerHTML='<div class="empty-state" style="padding:18px">✓ No banned IPs</div>';return;}
  el.innerHTML=bans.map(b=>`
    <div class="pl-item">
      <div class="pl-thumb" style="font-size:1.2rem">🚫</div>
      <div class="pl-info">
        <div class="pl-name" style="color:var(--r);font-family:var(--fm)">${esc(b.ip)}</div>
        <div class="pl-meta">Reason: ${esc(b.reason)} · By: ${esc(b.bannedBy)} · ${timeAgo(b.bannedAt)}</div>
      </div>
      <div class="pl-actions"><button class="btn-unban" onclick="unbanIp('${esc(b.ip)}')">UNBAN</button></div>
    </div>`).join('');
}

/* ── RESET PWD ── */
function doResetPassword(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const target=document.getElementById('pwdTarget').value.trim().toLowerCase();
  const np=document.getElementById('pwdNew').value,cp=document.getElementById('pwdConf').value;
  const errEl=document.getElementById('pwdErr');
  if(!np||!cp){errEl.textContent='⚠ Fill all fields.';return;}
  if(np.length<6){errEl.textContent='⚠ Min 6 characters.';return;}
  if(np!==cp){errEl.textContent='✕ Passwords do not match.';return;}
  const users=ls('users',[]),tgtName=target||CU.username;
  const idx=users.findIndex(u=>u.username.toLowerCase()===tgtName);
  if(idx<0){errEl.textContent='✕ Username not found.';return;}
  if(users[idx].role==='owner'&&users[idx].id!==CU.id&&target){errEl.textContent="✕ Cannot reset another owner's password.";return;}
  users[idx].pwHash=hashPw(np);ss('users',users);
  if(users[idx].id===CU.id)CU.pwHash=users[idx].pwHash;
  document.getElementById('pwdTarget').value='';document.getElementById('pwdNew').value='';document.getElementById('pwdConf').value='';errEl.textContent='';
  toast(`✓ Password for "${users[idx].username}" reset!`,'ok');
}

/* ── STAFF CODES ── */
function generateStaffCode(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='STAFF-';for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];code+='-';for(let i=0;i<4;i++)code+=chars[Math.floor(Math.random()*chars.length)];
  const codes=ls('staffCodes',[]);codes.unshift({code,used:false,createdBy:CU.username,createdAt:Date.now()});ss('staffCodes',codes);
  const box=document.getElementById('genCodeBox'),val=document.getElementById('genCodeVal');
  if(box)box.style.display='block';if(val)val.textContent=code;
  renderCodesPanel();toast(`✓ Code: ${code}`,'ok');
}
function revokeCode(code){
  if(!confirm(`Revoke ${code}?`))return;
  ss('staffCodes',ls('staffCodes',[]).filter(c=>c.code!==code));renderCodesPanel();toast('Revoked.','info');
}
function renderCodesPanel(){
  if(CU.role!=='owner')return;
  const el=document.getElementById('staffCodeList');if(!el)return;
  const codes=ls('staffCodes',[]);
  if(!codes.length){el.innerHTML='<div class="empty-state" style="padding:14px">No codes yet.</div>';return;}
  el.innerHTML=codes.map(c=>`
    <div class="code-row">
      <div class="cr-code">${esc(c.code)}</div>
      <span class="chip ${c.used?'ch-used':'ch-active'}">${c.used?'USED':'ACTIVE'}</span>
      ${c.used?`<span style="font-family:var(--fm);font-size:.58rem;color:var(--t2)">by ${esc(c.usedBy||'?')}</span>`:`<button class="btn-revoke" onclick="revokeCode('${esc(c.code)}')">REVOKE</button>`}
    </div>`).join('');
}

/* ── EXPORT / TOOLS ── */
function exportData(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  const data={exportedAt:new Date().toISOString(),builds:ls('builds',[]),users:ls('users',[]).map(u=>({...u,pwHash:'[HIDDEN]'})),bans:ls('bans',[]),sessions:ls('sessions',{}),staffCodes:ls('staffCodes',[]),viewCounts:ls('viewCounts',{})};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='oxyx-store-'+Date.now()+'.json';a.click();URL.revokeObjectURL(url);
  toast('✓ Data exported!','ok');
}
function clearAllBuilds(){
  if(CU.role!=='owner'){toast('✕ Owner only.','err');return;}
  if(!confirm('⚠ Delete ALL builds permanently?'))return;
  ss('builds',[]);renderBuildPanel();updateHomeStats();refreshStats();toast('All builds cleared.','warn');
}

/* ── UTILS ── */
function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function timeAgo(ts){if(!ts)return '—';const d=Date.now()-ts,s=Math.floor(d/1000),m=Math.floor(s/60),h=Math.floor(m/60),dy=Math.floor(h/24);if(dy>0)return dy+'d ago';if(h>0)return h+'h ago';if(m>0)return m+'m ago';if(s>0)return s+'s ago';return 'just now';}
function toast(msg,type='info'){
  const w=document.getElementById('toastArea');if(!w)return;
  const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;w.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(26px)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300);},3200);
}

/* ── KEYBOARD ── */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeSearch();}
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSearch();}
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

/* ─────────────────────────────────
   EFFECTS & NEW FEATURES (v5.1)
───────────────────────────────── */

/* FAQ accordion */
function toggleFaq(el){
  const isOpen=el.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(x=>x.classList.remove('open'));
  if(!isOpen) el.classList.add('open');
}

/* Stats banner counters */
function updateStatsBanner(){
  const builds=ls('builds',[]).filter(b=>b.status==='approved');
  const users=ls('users',[]);
  const online=Object.values(ls('sessions',{})).filter(r=>(Date.now()-r.lastPing)<SESSION_TTL).length;
  animNum(document.getElementById('sbBuilds'),builds.length,1400);
  animNum(document.getElementById('sbMembers'),users.length,1400);
  animNum(document.getElementById('sbOnlineStat'),online,800);
}

/* Floating particles behind hero */
function initParticles(){
  const hero=document.querySelector('.hero');if(!hero)return;
  if(hero.querySelector('.float-particles'))return;
  const wrap=document.createElement('div');wrap.className='float-particles';
  hero.prepend(wrap);
  const colors=['rgba(0,255,213,.12)','rgba(176,109,255,.1)','rgba(255,45,85,.08)','rgba(0,255,136,.09)'];
  for(let i=0;i<16;i++){
    const p=document.createElement('div');p.className='fp';
    const size=Math.random()*8+3,dur=Math.random()*18+12,delay=Math.random()*-20;
    p.style.cssText=`width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};left:${Math.random()*100}%;bottom:${Math.random()*30}%;animation-duration:${dur}s;animation-delay:${delay}s;`;
    wrap.appendChild(p);
  }
}



/* Mouse parallax on orb */
function initParallax(){
  const orb=document.querySelector('.orb-3d');if(!orb)return;
  if(orb._parallax) return; orb._parallax=true;
  document.addEventListener('mousemove',e=>{
    const cx=window.innerWidth/2,cy=window.innerHeight/2;
    const dx=(e.clientX-cx)/cx,dy=(e.clientY-cy)/cy;
    orb.style.transform=`perspective(800px) rotateY(${dx*12}deg) rotateX(${-dy*8}deg)`;
  });
}

/* ════════════════════════════════════════════════════
   INTERACTIVE EFFECTS v6
   ════════════════════════════════════════════════════ */

/* ── NAVBAR scroll class ── */
window.addEventListener('scroll',()=>{
  const nb=document.getElementById('navbar');
  if(nb) nb.classList.toggle('scrolled', window.scrollY>60);
});

/* ── MAGNETIC CURSOR on hero buttons ── */
function initMagnetic(){
  document.querySelectorAll('.hbtn,.btn-logout,.pb-btn,.action-btn').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.28;
      const y=(e.clientY-r.top-r.height/2)*.28;
      el.style.transform=`translate(${x}px,${y}px) scale(1.04)`;
    });
    el.addEventListener('mouseleave',()=>{ el.style.transform=''; });
  });
}

/* ── CLICK RIPPLE on any button ── */
function initRipple(){
  document.querySelectorAll('.hbtn,.pb-btn,.admin-tab-btn,.flt,.btn-logout,.action-btn,.submit-build-btn').forEach(el=>{
    el.addEventListener('click',e=>{
      const r=el.getBoundingClientRect();
      const rip=document.createElement('span');
      const size=Math.max(r.width,r.height);
      rip.style.cssText=`
        position:absolute;border-radius:50%;
        width:${size}px;height:${size}px;
        left:${e.clientX-r.left-size/2}px;
        top:${e.clientY-r.top-size/2}px;
        background:rgba(255,255,255,.18);
        transform:scale(0);
        animation:rippleOut .55s ease-out forwards;
        pointer-events:none;z-index:99;
      `;
      el.style.position='relative';
      el.style.overflow='hidden';
      el.appendChild(rip);
      setTimeout(()=>rip.remove(), 600);
    });
  });
}
/* inject ripple keyframe once */
if(!document.getElementById('rippleStyle')){
  const st=document.createElement('style');
  st.id='rippleStyle';
  st.textContent='@keyframes rippleOut{to{transform:scale(2.5);opacity:0}}';
  document.head.appendChild(st);
}

/* ── CARD HOVER GLOW follow cursor ── */
function initCardGlow(){
  document.querySelectorAll('.bcard,.why-card,.sc,.ucrd').forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      const x=((e.clientX-r.left)/r.width)*100;
      const y=((e.clientY-r.top)/r.height)*100;
      card.style.setProperty('--mx',x+'%');
      card.style.setProperty('--my',y+'%');
      card.style.background=`radial-gradient(circle at ${x}% ${y}%, rgba(0,255,213,.05) 0%, transparent 60%), var(--bg3)`;
    });
    card.addEventListener('mouseleave',()=>{
      card.style.background='';
    });
  });
}

/* ── COUNTER glow when number changes ── */
function flashCount(el){
  if(!el) return;
  el.style.transition='transform .2s, color .2s';
  el.style.transform='scale(1.2)';
  el.style.color='var(--a)';
  setTimeout(()=>{el.style.transform='';el.style.color='';}, 350);
}

/* ── ORBITRON HERO TEXT: mouse-track glow ── */
function initTextGlow(){
  const h1=document.querySelector('.hero-h1');
  if(!h1) return;
  document.addEventListener('mousemove',e=>{
    const r=h1.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const dx=e.clientX-cx, dy=e.clientY-cy;
    const dist=Math.hypot(dx,dy);
    const maxD=500;
    if(dist<maxD){
      const intensity=1-(dist/maxD);
      h1.style.filter=`drop-shadow(${dx*.03}px ${dy*.03}px ${intensity*18}px rgba(0,255,213,${intensity*.5}))`;
    } else {
      h1.style.filter='';
    }
  });
}

/* ── STATS BANNER numbers: count on visible ── */
function initStatsBannerObserver(){
  const sb=document.querySelector('.stats-banner');
  if(!sb || sb._observed) return;
  sb._observed=true;
  const obs=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){
      updateStatsBanner();
      obs.disconnect();
    }
  },{threshold:.3});
  obs.observe(sb);
}

/* ── PARTICLE BURST on logo click ── */
function initOrbBurst(){
  const orb=document.querySelector('.orb-core');
  if(!orb) return;
  orb.addEventListener('click',()=>{
    const colors=['var(--a)','var(--v)','var(--r)','var(--g)','var(--gold)'];
    const parent=orb.parentElement;
    for(let i=0;i<18;i++){
      const p=document.createElement('div');
      const angle=Math.random()*Math.PI*2;
      const dist=60+Math.random()*80;
      const dur=600+Math.random()*400;
      p.style.cssText=`
        position:absolute;width:5px;height:5px;
        border-radius:50%;pointer-events:none;z-index:10;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        top:50%;left:50%;
        animation:burstP ${dur}ms ease-out forwards;
        --bx:${Math.cos(angle)*dist}px;--by:${Math.sin(angle)*dist}px;
      `;
      parent.style.position='relative';
      parent.appendChild(p);
      setTimeout(()=>p.remove(), dur+50);
    }
    if(!document.getElementById('burstStyle')){
      const st=document.createElement('style');
      st.id='burstStyle';
      st.textContent='@keyframes burstP{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + var(--bx)),calc(-50% + var(--by))) scale(0);opacity:0}}';
      document.head.appendChild(st);
    }
  });
}

/* ── SECTION TRANSITION: stagger children ── */
function staggerSection(page){
  const sec=document.getElementById('sec-'+page);
  if(!sec) return;
  const children=[...sec.querySelectorAll('.bcard,.why-card,.cat-card,.faq-item,.stat,.ucrd')];
  children.forEach((el,i)=>{
    el.style.opacity='0';
    el.style.transform='translateY(24px)';
    setTimeout(()=>{
      el.style.transition='opacity .5s cubic-bezier(.16,1,.3,1), transform .5s cubic-bezier(.16,1,.3,1)';
      el.style.opacity='1';
      el.style.transform='translateY(0)';
    }, i*55+80);
  });
}

/* ── INIT ALL INTERACTIVE EFFECTS ── */
function initAllInteractive(){
  initMagnetic();
  initRipple();
  initCardGlow();
  initTextGlow();
  initOrbBurst();
  initStatsBannerObserver();
  // re-init on section change
  const _origGoTo2=goTo;
  window._goToPatched=true;
}

/* Patch goTo once to run stagger on navigate */
(function patchGoTo(){
  const orig=goTo;
  goTo=function(page){
    orig(page);
    setTimeout(()=>staggerSection(page),120);
    setTimeout(initMagnetic,300);
    setTimeout(initRipple,300);
    setTimeout(initCardGlow,300);
  };
})();

/* Attach to launchApp flow */
document.addEventListener('DOMContentLoaded',()=>{
  const check=setInterval(()=>{
    if(document.getElementById('mainApp').style.display==='block'){
      clearInterval(check);
      setTimeout(initAllInteractive, 500);
    }
  },200);
});

/* ════════════════════════════════════════════
   CONTINUATION v6.1
   ════════════════════════════════════════════ */

/* ── SCROLL PROGRESS BAR ── */
(function initScrollProgress(){
  const bar = document.getElementById('scrollProgress');
  if(!bar) return;
  window.addEventListener('scroll', ()=>{
    const d = document.documentElement;
    const pct = (window.scrollY / (d.scrollHeight - d.clientHeight)) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  }, { passive: true });
})();

/* ── SECTION BUILD COUNTS ── */
function updateSectionCounts(){
  const builds = ls('builds',[]).filter(b=>b.status==='approved');
  const all = builds.length;
  const prem = builds.filter(b=>b.type==='premium').length;
  const free = builds.filter(b=>b.type==='free').length;
  const c1 = document.getElementById('cntStore');
  const c2 = document.getElementById('cntPrem');
  const c3 = document.getElementById('cntFree');
  if(c1) c1.textContent = all + ' builds';
  if(c2) c2.textContent = prem + ' builds';
  if(c3) c3.textContent = free + ' builds';
}

/* ── LIVE PRICE FORMATTER (IDR) ── */
function initPriceFormatter(){
  const priceInput = document.getElementById('sbP');
  const typeSelect = document.getElementById('sbT');
  if(!priceInput || !typeSelect) return;

  // Create hint element
  let hint = priceInput.closest('.fg')?.querySelector('.price-hint');
  if(!hint){
    hint = document.createElement('div');
    hint.className = 'price-hint';
    priceInput.closest('.fg')?.appendChild(hint);
  }

  function updateHint(){
    const val = parseInt(priceInput.value) || 0;
    const type = typeSelect.value;
    if(type === 'premium' && val > 0){
      hint.textContent = '→ Rp ' + val.toLocaleString('id-ID');
      hint.classList.add('show');
    } else if(type === 'premium' && val === 0){
      hint.textContent = '⚠ Set a price for premium builds';
      hint.style.color = 'var(--gold)';
      hint.classList.add('show');
    } else {
      hint.classList.remove('show');
    }
  }
  priceInput.addEventListener('input', updateHint);
  typeSelect.addEventListener('change', ()=>{
    clearIbError('sbP');
    updateHint();
  });
  updateHint();
}

/* ── UPLOAD ZONE: drag visual feedback ── */
function initUploadZoneEffects(){
  const bZone = document.getElementById('buildDropZone');
  if(!bZone) return;
  bZone.addEventListener('dragenter', ()=> bZone.classList.add('drag-over'));
  bZone.addEventListener('dragleave', ()=> bZone.classList.remove('drag-over'));
  bZone.addEventListener('drop',      ()=> bZone.classList.remove('drag-over'));
}

/* ── SUBMIT: show loading spinner during read ── */
const _origSubmitBuild = submitBuild;
function submitBuild(){
  _origSubmitBuild();
}

/* ── TOS: clear error on check ── */
function initTosCheck(){
  const tos = document.getElementById('sbTos');
  if(!tos) return;
  tos.addEventListener('change', ()=>{
    const row = tos.closest('.tos-row');
    if(row) row.classList.remove('tos-err');
  });
}

/* ── PATCH submitBuild to use tos-err class ── */
(function patchTosError(){
  const origSub = submitBuild;
  window._tosPatched = true;
  // The tos error styling is handled in app.js submitBuild inline
  // Just ensure tos-err class is applied
  const origFn = window.submitBuild;
})();

/* ── FOOTER LINKS: scroll top on navigate ── */
function initFooterLinks(){
  document.querySelectorAll('.sf-link, .sf-tag').forEach(el=>{
    el.style.cursor = 'pointer';
  });
}

/* ── SECTION: update counts on navigate ── */
const _goToOrig6 = goTo;
goTo = function(page){
  _goToOrig6(page);
  setTimeout(updateSectionCounts, 150);
};

/* ── MASTER INIT (called when app launches) ── */
const _origLaunchApp6 = launchApp;
launchApp = function(){
  _origLaunchApp6();
  setTimeout(()=>{
    updateSectionCounts();
    initPriceFormatter();
    initUploadZoneEffects();
    initTosCheck();
    initFooterLinks();
  }, 400);
};
