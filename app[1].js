/* ==============================
   OXYX STORE — app.js
   Full logic: Auth, IP, Builds,
   Live Monitor, Ban, Admin Panel
   ============================== */
'use strict';

// ============================================================
//  CONSTANTS
// ============================================================
const STAFF_CODES  = ['OXYX-STAFF-2024', 'OXYX-STAFF-ELITE'];
const OWNER_CODES  = ['OXYX-OWNER-MASTER-2024'];
const SESSION_TTL  = 60 * 1000;       // 60s — mark offline
const PING_INTERVAL = 25 * 1000;      // ping every 25s
const LIVE_REFRESH  = 10 * 1000;      // refresh live panel every 10s

// ============================================================
//  DEFAULT DATA SEED
// ============================================================
const SEED_BUILDS = [
  // PREMIUM
  { id:'b01', name:'Dark Eclipse Pro',    type:'premium', price:75000,  cat:'Portfolio, Dark',      desc:'Build portfolio premium dengan tema gelap elegan. Animasi smooth GSAP, glassmorphism panels, dan komponen UI lengkap. Mobile-responsive sempurna.',  icon:'🌑', link:'https://github.com/oxyx-store', featured:true  },
  { id:'b02', name:'Neon Rush Dashboard', type:'premium', price:120000, cat:'Dashboard, Admin',      desc:'Dashboard admin full-featured dengan efek neon cyberpunk. Chart interaktif, data table sortable, sidebar animasi, real-time preview.',                icon:'⚡', link:'https://github.com/oxyx-store', featured:true  },
  { id:'b03', name:'Crystal Ecommerce',   type:'premium', price:200000, cat:'Ecommerce, Shop',      desc:'Toko online lengkap: cart, filter produk, halaman checkout, wishlist, rating produk. UI bersih modern, SEO-friendly.',                               icon:'🛍', link:'https://github.com/oxyx-store', featured:false },
  { id:'b04', name:'Velvet Blog',         type:'premium', price:55000,  cat:'Blog, Editorial',      desc:'Template blog premium editorial dengan typography indah, layout magazine, kategori, search, dark/light mode, dan sistem komentar.',                    icon:'📰', link:'https://github.com/oxyx-store', featured:false },
  { id:'b05', name:'Aurora SaaS',         type:'premium', price:185000, cat:'SaaS, Landing',        desc:'Landing page SaaS premium dengan hero animasi, pricing table interaktif, FAQ accordion, testimonial slider, dan CTA yang dioptimasi conversion.',      icon:'🌌', link:'https://github.com/oxyx-store', featured:true  },
  { id:'b06', name:'Phantom Admin',       type:'premium', price:150000, cat:'Admin, Dashboard',     desc:'Admin panel ultra-dark dengan sidebar collapsible, multi-level navigation, widget statistik, kalender, task manager built-in.',                       icon:'👁', link:'https://github.com/oxyx-store', featured:false },
  { id:'b07', name:'Obsidian Crypto',     type:'premium', price:250000, cat:'Crypto, Finance',      desc:'Crypto dashboard premium: live chart harga, portfolio tracker, watchlist, news feed, alert system. Terintegrasi dengan public API crypto.',             icon:'💎', link:'https://github.com/oxyx-store', featured:false },
  { id:'b08', name:'Cobalt Agency',       type:'premium', price:90000,  cat:'Agency, Company',      desc:'Website company/agency premium dengan halaman layanan, tim, portofolio, blog, dan kontak yang dioptimasi. Animasi scroll reveal.',                     icon:'🔷', link:'https://github.com/oxyx-store', featured:false },
  { id:'b09', name:'Crimson Gaming',      type:'premium', price:110000, cat:'Gaming, Entertainment', desc:'Website gaming dengan hero video background, leaderboard animasi, section game stats, countdown event, dan design yang intens.',                      icon:'🎮', link:'https://github.com/oxyx-store', featured:true  },
  { id:'b10', name:'Diamond SaaS Plus',   type:'premium', price:320000, cat:'SaaS, Full Stack',     desc:'Build SaaS paling lengkap: dashboard, landing, pricing, auth pages, onboarding flow, dan dokumentasi. Siap production.',                              icon:'✦', link:'https://github.com/oxyx-store', featured:false },
  // FREE
  { id:'b11', name:'Neon Lite',           type:'free',    price:0,      cat:'Starter, Dark',        desc:'Starter template gratis dengan tampilan neon modern. HTML/CSS/JS murni, cepat, dan ringan. Cocok untuk pemula.',                                       icon:'💡', link:'https://github.com/oxyx-store', featured:true  },
  { id:'b12', name:'Simple Portfolio',    type:'free',    price:0,      cat:'Portfolio, Minimal',   desc:'Portfolio 1 halaman elegan dan minimalis. Smooth scroll, mobile-friendly, mudah dimodifikasi. Sempurna untuk awal karir developer.',                  icon:'🎨', link:'https://github.com/oxyx-store', featured:true  },
  { id:'b13', name:'Mini Landing Page',   type:'free',    price:0,      cat:'Landing, Simple',      desc:'Landing page gratis dengan hero, fitur, testimonial, dan footer. Clean design, ringan, dan cepat. Siap deploy ke Netlify/Vercel/GitHub Pages.',       icon:'🚀', link:'https://github.com/oxyx-store', featured:false },
  { id:'b14', name:'Blog Starter Kit',    type:'free',    price:0,      cat:'Blog, Content',        desc:'Template blog gratis sederhana dan fungsional. Sistem post list, halaman artikel, kategori, dan halaman about. Mudah dikustomisasi.',                  icon:'📝', link:'https://github.com/oxyx-store', featured:false },
  { id:'b15', name:'Admin Lite',          type:'free',    price:0,      cat:'Admin, Basic',         desc:'Dashboard admin gratis untuk belajar. Sidebar navigation, card statistik, tabel data, dan form CRUD sederhana. Cocok untuk portfolio backend dev.',   icon:'📊', link:'https://github.com/oxyx-store', featured:false },
];

const SEED_USERS = [
  { id:'own001', username:'owner',  email:'owner@oxyx.store',  password:b64e('ownerOXYX2024!'), role:'owner', createdAt: Date.now()-200000 },
  { id:'stf001', username:'staff1', email:'staff1@oxyx.store', password:b64e('staff1pass2024'), role:'staff', createdAt: Date.now()-180000 },
  { id:'stf002', username:'staff2', email:'staff2@oxyx.store', password:b64e('staff2pass2024'), role:'staff', createdAt: Date.now()-160000 },
];

// ============================================================
//  STORAGE
// ============================================================
function ls(k,fb){ try{ const v=localStorage.getItem('ox_'+k); return v?JSON.parse(v):fb; }catch{ return fb; } }
function ss(k,v){ try{ localStorage.setItem('ox_'+k,JSON.stringify(v)); }catch{} }
function b64e(s){ try{return btoa(unescape(encodeURIComponent(s)));}catch{return btoa(s);} }
function b64d(s){ try{return decodeURIComponent(escape(atob(s)));}catch{return atob(s);} }

function initData(){
  if(!ls('seeded',false)){
    ss('builds',SEED_BUILDS);
    ss('users',SEED_USERS);
    ss('bans',[]);
    ss('sessions',{});
    ss('iplog',{});
    ss('seeded',true);
  }
}

// ============================================================
//  STATE
// ============================================================
let CU   = null;  // current user
let CIP  = '0.0.0.0';
let pingTimer = null;
let liveTimer = null;
let liveCD = 10;
let liveCDTimer = null;
let curFilter = 'all';

// ============================================================
//  GET IP
// ============================================================
async function getIP(){
  const apis = [
    'https://api.ipify.org?format=json',
    'https://ipapi.co/json/',
  ];
  for(const url of apis){
    try{
      const r = await fetch(url, {signal: AbortSignal.timeout(4000)});
      const d = await r.json();
      if(d.ip){ CIP = d.ip; return; }
    }catch{}
  }
  // fallback pseudo-IP from browser fingerprint
  CIP = '127.0.' + (navigator.platform.length % 256) + '.' + (screen.width % 256);
}

// ============================================================
//  CUSTOM CURSOR
// ============================================================
function initCursor(){
  const glow = document.getElementById('cursorGlow');
  const dot  = document.getElementById('cursorDot');
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
    dot.style.left  = e.clientX + 'px';
    dot.style.top   = e.clientY + 'px';
  });
  document.querySelectorAll('button,a,.build-card,.nlink,.atab').forEach(el=>{
    el.addEventListener('mouseenter',()=>{ dot.style.width='14px'; dot.style.height='14px'; dot.style.background='#fff'; });
    el.addEventListener('mouseleave',()=>{ dot.style.width='8px';  dot.style.height='8px';  dot.style.background='var(--acc)'; });
  });
}

// ============================================================
//  MOUSE TILT ON BUILD CARDS (3D effect)
// ============================================================
function initCardTilt(){
  document.addEventListener('mousemove', e => {
    document.querySelectorAll('.build-card').forEach(card => {
      const r = card.getBoundingClientRect();
      if(e.clientX < r.left-60 || e.clientX > r.right+60 ||
         e.clientY < r.top-60  || e.clientY > r.bottom+60){ 
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        return;
      }
      const x = ((e.clientX - r.left) / r.width  - 0.5);
      const y = ((e.clientY - r.top)  / r.height - 0.5);
      card.style.transform = `perspective(1000px) rotateY(${x*18}deg) rotateX(${-y*18}deg) translateZ(8px)`;
    });
  });
}

// ============================================================
//  COUNTER ANIMATION
// ============================================================
function animCount(el, target, dur=1200){
  let start = null, from = 0;
  function step(ts){
    if(!start) start = ts;
    const prog = Math.min((ts-start)/dur, 1);
    const ease = 1 - Math.pow(1-prog, 3);
    el.textContent = Math.floor(from + (target-from)*ease);
    if(prog < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============================================================
//  LOADING SEQUENCE
// ============================================================
function runLoader(cb){
  const bar  = document.getElementById('loadBar');
  const txt  = document.getElementById('loadText');
  const msgs = ['INITIALIZING SYSTEM...','LOADING ASSETS...','CHECKING IP ADDRESS...','VERIFYING SESSION...','SYSTEM READY'];
  let p = 0, step = 0;
  const iv = setInterval(()=>{
    p = Math.min(p + Math.random()*18 + 5, 100);
    bar.style.width = p + '%';
    if(p > step*20 && step < msgs.length){ txt.textContent = msgs[step++]; }
    if(p >= 100){
      clearInterval(iv);
      setTimeout(()=>{
        document.getElementById('loadScreen').classList.add('hide');
        setTimeout(cb, 800);
      }, 400);
    }
  }, 120);
}

// ============================================================
//  BAN CHECK
// ============================================================
function checkBanned(){
  const bans = ls('bans',[]);
  const banned = bans.find(b => b.ip === CIP);
  if(banned){
    document.getElementById('deniedIpShow').textContent = CIP;
    document.getElementById('accessDenied').style.display = 'flex';
    document.getElementById('authOverlay').style.display  = 'none';
    document.getElementById('mainApp').style.display       = 'none';
    return true;
  }
  return false;
}

// ============================================================
//  AUTH
// ============================================================
function switchTab(t){
  document.getElementById('tabLogin').classList.toggle('active', t==='login');
  document.getElementById('tabReg').classList.toggle('active',   t==='register');
  document.getElementById('formLogin').classList.toggle('active', t==='login');
  document.getElementById('formReg').classList.toggle('active',   t==='register');
  document.getElementById('lErr').textContent = '';
  document.getElementById('rErr').textContent = '';
}

function doLogin(){
  const user = document.getElementById('lUser').value.trim().toLowerCase();
  const pass = document.getElementById('lPass').value;
  const errEl = document.getElementById('lErr');

  if(!user || !pass){ errEl.textContent='⚠ Isi semua field.'; return; }

  const users = ls('users',[]);
  const u = users.find(x => x.username.toLowerCase() === user);
  if(!u){ errEl.textContent='✕ Username tidak ditemukan.'; return; }
  if(u.password !== b64e(pass)){ errEl.textContent='✕ Password salah.'; return; }

  // IP single-session enforcement for owner/staff
  if(u.role === 'owner' || u.role === 'staff'){
    const sessions = ls('sessions',{});
    const existing = sessions[u.id];
    if(existing && existing.ip && existing.ip !== CIP){
      const age = Date.now() - (existing.lastPing||0);
      if(age < SESSION_TTL * 3){
        errEl.textContent = `🔒 Akun ini sudah aktif dari IP lain (${existing.ip}).`;
        return;
      }
    }
  }

  // Log IP
  logIP(u.id, u.username, u.role);

  CU = u;
  ss('activeSession', { id:u.id });
  launchApp();
}

function doRegister(){
  const user  = document.getElementById('rUser').value.trim().toLowerCase();
  const email = document.getElementById('rEmail').value.trim();
  const pass  = document.getElementById('rPass').value;
  const code  = document.getElementById('rCode').value.trim().toUpperCase();
  const errEl = document.getElementById('rErr');

  if(!user||!email||!pass){ errEl.textContent='⚠ Isi semua field wajib.'; return; }
  if(user.length < 3){ errEl.textContent='⚠ Username min 3 karakter.'; return; }
  if(pass.length < 6){ errEl.textContent='⚠ Password min 6 karakter.'; return; }

  const users = ls('users',[]);
  if(users.find(u => u.username.toLowerCase() === user)){
    errEl.textContent='✕ Username sudah dipakai.'; return;
  }

  let role = 'user';
  if(code){
    if(OWNER_CODES.includes(code)){
      const ownerExists = users.some(u => u.role === 'owner');
      if(ownerExists){ errEl.textContent='✕ Slot owner sudah penuh.'; return; }
      role = 'owner';
    } else if(STAFF_CODES.includes(code)){
      const staffCount = users.filter(u => u.role==='staff').length;
      if(staffCount >= 2){ errEl.textContent='✕ Slot staff penuh (maks 2).'; return; }
      role = 'staff';
    } else {
      errEl.textContent='✕ Kode tidak valid.'; return;
    }
  }

  users.push({ id:'u'+Date.now(), username:user, email, password:b64e(pass), role, createdAt:Date.now() });
  ss('users', users);
  toast('✓ Akun berhasil dibuat! Silakan login.','ok');
  switchTab('login');
  document.getElementById('lUser').value = user;
}

function doLogout(){
  if(CU){ clearSession(CU.id); }
  clearInterval(pingTimer);
  clearInterval(liveTimer);
  clearInterval(liveCDTimer);
  CU = null;
  ss('activeSession', null);
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authOverlay').style.display = 'flex';
  toast('Berhasil keluar.','info');
}

// ============================================================
//  SESSION / IP TRACKING
// ============================================================
function logIP(uid, username, role){
  const sessions = ls('sessions',{});
  sessions[uid] = { uid, username, role, ip:CIP, lastPing:Date.now(), online:true };
  ss('sessions', sessions);

  const iplog = ls('iplog',{});
  if(!iplog[uid]) iplog[uid] = [];
  const entry = { ip:CIP, ts:Date.now() };
  if(!iplog[uid].find(e=>e.ip===CIP)) iplog[uid].push(entry);
  if(iplog[uid].length > 20) iplog[uid] = iplog[uid].slice(-20);
  ss('iplog', iplog);
}

function pingSession(){
  if(!CU) return;
  const sessions = ls('sessions',{});
  if(sessions[CU.id]){
    sessions[CU.id].lastPing = Date.now();
    sessions[CU.id].online   = true;
    sessions[CU.id].ip       = CIP;
    ss('sessions', sessions);
  }
}

function clearSession(uid){
  const sessions = ls('sessions',{});
  if(sessions[uid]){ sessions[uid].online = false; sessions[uid].lastPing = 0; }
  ss('sessions', sessions);
}

function startPing(){
  clearInterval(pingTimer);
  pingSession();
  pingTimer = setInterval(pingSession, PING_INTERVAL);
}

// ============================================================
//  APP LAUNCH
// ============================================================
function launchApp(){
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainApp').style.display     = 'block';

  // Navbar user info
  document.getElementById('nuName').textContent = CU.username;
  const badge = document.getElementById('nuBadge');
  badge.textContent = CU.role.toUpperCase();
  badge.className   = 'nu-badge ' + CU.role;

  // Show admin panel link
  const adminLink = document.getElementById('nl-admin');
  adminLink.style.display = (CU.role==='owner'||CU.role==='staff') ? 'inline' : 'none';

  // Owner-only admin tabs
  const ownerTabs = document.querySelectorAll('.owner-only');
  ownerTabs.forEach(t => t.style.display = (CU.role==='owner') ? 'inline-block' : 'none');

  startPing();
  goTo('home');
  initCounters();
  setTimeout(initCardTilt, 500);
}

function initCounters(){
  const builds  = ls('builds',[]);
  const users   = ls('users',[]);
  const premium = builds.filter(b=>b.type==='premium').length;
  const free    = builds.filter(b=>b.type==='free').length;

  const hb = document.getElementById('hsBuild');
  const hp = document.getElementById('hsPremium');
  const hf = document.getElementById('hsFree');
  const hu = document.getElementById('hsUsers');
  if(hb) animCount(hb, builds.length);
  if(hp) animCount(hp, premium);
  if(hf) animCount(hf, free);
  if(hu) animCount(hu, users.length);
}

// ============================================================
//  NAVIGATION
// ============================================================
function goTo(page){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nlink').forEach(l=>l.classList.remove('active'));

  const sec  = document.getElementById('sec-'+page);
  const link = document.getElementById('nl-'+page);
  if(sec)  sec.classList.add('active');
  if(link) link.classList.add('active');

  if(page==='store')   renderGrid('storeGrid', null, curFilter);
  if(page==='premium') renderGrid('premGrid', 'premium');
  if(page==='free')    renderGrid('freeGrid', 'free');
  if(page==='home')    renderGrid('featGrid', null, 'all', true);
  if(page==='admin')   initAdminPanel();
  window.scrollTo({top:0, behavior:'smooth'});
}

// ============================================================
//  BUILD RENDERING
// ============================================================
function renderGrid(containerId, typeFilter, filterMode, featuredOnly){
  const el = document.getElementById(containerId);
  if(!el) return;
  let builds = ls('builds',[]);
  if(typeFilter)  builds = builds.filter(b=>b.type===typeFilter);
  if(filterMode && filterMode!=='all') builds = builds.filter(b=>b.type===filterMode);
  if(featuredOnly) builds = builds.filter(b=>b.featured).slice(0,6);

  if(!builds.length){
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">◎</span>BELUM ADA BUILD</div>`;
    return;
  }
  el.innerHTML = builds.map(buildCardHTML).join('');
  setTimeout(initCardTilt, 100);
}

function buildCardHTML(b){
  const isPrem = b.type==='premium';
  const priceLabel = isPrem ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'GRATIS';
  return `<div class="build-card" onclick="openModal('${b.id}')">
    <div class="bc-thumb">
      <div class="bc-thumb-bg"></div>
      <span class="bc-icon">${b.icon||'◈'}</span>
      <span class="bc-badge ${isPrem?'badge-prem':'badge-free'}">${isPrem?'♛ PREMIUM':'✦ FREE'}</span>
    </div>
    <div class="bc-body">
      <div class="bc-tag">${esc(b.cat||'—')}</div>
      <div class="bc-name">${esc(b.name)}</div>
      <div class="bc-desc">${esc(b.desc)}</div>
      <div class="bc-foot">
        <span class="bc-price ${isPrem?'prem-p':'free-p'}">${priceLabel}</span>
        <button class="btn-detail">DETAIL →</button>
      </div>
    </div>
  </div>`;
}

function doFilter(type, btn){
  curFilter = type;
  document.querySelectorAll('.flt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid('storeGrid', null, type);
}

// ============================================================
//  BUILD MODAL
// ============================================================
function openModal(id){
  const builds = ls('builds',[]);
  const b = builds.find(x=>x.id===id);
  if(!b) return;
  const isPrem = b.type==='premium';
  const priceLabel = isPrem ? 'Rp '+Number(b.price).toLocaleString('id-ID') : 'GRATIS';

  document.getElementById('modalBody').innerHTML = `
    <span class="modal-badge ${isPrem?'prem':'free'}">${isPrem?'♛ PREMIUM BUILD':'✦ FREE BUILD'}</span>
    <div class="modal-title">${esc(b.name)}</div>
    <div class="modal-tag">${esc(b.cat)}</div>
    <div class="modal-desc">${esc(b.desc)}</div>
    <div class="modal-price-row">
      <div class="modal-price ${isPrem?'prem':'free'}">${priceLabel}</div>
    </div>
    ${isPrem
      ? `<button class="btn-modal buy" onclick="handleBuy('${b.id}')">💳 BELI SEKARANG</button>`
      : `<a href="${esc(b.link)}" target="_blank" class="btn-modal dl">⬇ DOWNLOAD GRATIS</a>`
    }
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e){
  if(!e || e.target===document.getElementById('modalOverlay')){
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function handleBuy(id){
  toast('💬 Hubungi kami via WhatsApp/Discord untuk proses pembelian!','info');
  closeModal();
}

// ============================================================
//  ADMIN PANEL INIT
// ============================================================
function initAdminPanel(){
  const rb = document.getElementById('adminRB');
  if(rb){ rb.textContent = CU.role.toUpperCase(); rb.className = 'admin-rbadge '+CU.role; }
  renderBuildAdmList();
  renderUserAdmList();
  renderBanList();
  startLiveTimer();
}

function aSwitch(name, btn){
  document.querySelectorAll('.anav').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab = document.getElementById('atab-'+name);
  if(tab) tab.classList.add('active');
  if(name==='live'){ refreshLive(); startLiveTimer(); }
  if(name==='ban')  renderBanList();
  if(name==='users') renderUserAdmList();
  if(name==='builds') renderBuildAdmList();
}

// ============================================================
//  BUILD ADMIN
// ============================================================
function addBuild(){
  const n = document.getElementById('bN').value.trim();
  const t = document.getElementById('bT').value;
  const p = parseInt(document.getElementById('bP').value)||0;
  const c = document.getElementById('bC').value.trim();
  const d = document.getElementById('bD').value.trim();
  const l = document.getElementById('bL').value.trim();
  if(!n||!d){ toast('⚠ Nama & deskripsi wajib.','err'); return; }
  const icons = ['◈','◉','◐','◑','⬡','⬢','△','◇','◆','▽','✦','★'];
  const builds = ls('builds',[]);
  builds.push({ id:'b'+Date.now(), name:n, type:t, price:p, cat:c, desc:d, link:l, icon:icons[Math.floor(Math.random()*icons.length)], featured:false, createdAt:Date.now() });
  ss('builds',builds);
  ['bN','bP','bC','bD','bL'].forEach(id=>{document.getElementById(id).value=''});
  renderBuildAdmList();
  toast('✓ Build ditambahkan!','ok');
}

function deleteBuild(id){
  if(!confirm('Hapus build ini?')) return;
  ss('builds', ls('builds',[]).filter(b=>b.id!==id));
  renderBuildAdmList();
  toast('Build dihapus.','info');
}

function renderBuildAdmList(){
  const el = document.getElementById('buildAdmList');
  if(!el) return;
  const builds = ls('builds',[]);
  if(!builds.length){ el.innerHTML='<div class="empty-state"><span class="empty-icon">◎</span>TIDAK ADA BUILD</div>'; return; }
  el.innerHTML = '<h4 style="font-family:var(--font-m);font-size:0.68rem;color:var(--t3);letter-spacing:0.15em;margin-bottom:12px">DAFTAR BUILD ('+builds.length+')</h4>'+
    builds.map(b=>`
    <div class="adm-item">
      <div class="adm-item-icon">${b.icon}</div>
      <div class="adm-item-info">
        <div class="adm-item-name">${esc(b.name)} <span style="font-family:var(--font-m);font-size:0.6rem;padding:2px 8px;border-radius:3px;background:${b.type==='premium'?'rgba(255,184,0,0.1)':'rgba(0,255,136,0.1)'};color:${b.type==='premium'?'var(--acc4)':'var(--free-c)'};">${b.type.toUpperCase()}</span></div>
        <div class="adm-item-meta">${b.type==='premium'?'Rp '+Number(b.price).toLocaleString('id-ID'):'GRATIS'} · ${esc(b.cat)}</div>
      </div>
      <button class="btn-del" onclick="deleteBuild('${b.id}')">🗑 HAPUS</button>
    </div>`).join('');
}

// ============================================================
//  USER ADMIN
// ============================================================
function renderUserAdmList(){
  const el = document.getElementById('userAdmList');
  if(!el) return;
  const users   = ls('users',[]);
  const sessions= ls('sessions',{});
  el.innerHTML = '<h4 style="font-family:var(--font-m);font-size:0.68rem;color:var(--t3);letter-spacing:0.15em;margin-bottom:12px">DAFTAR USER ('+users.length+')</h4>'+
    users.map(u=>{
      const sess = sessions[u.id];
      const online = sess && (Date.now()-sess.lastPing < SESSION_TTL);
      return `<div class="adm-item">
        <div class="adm-item-icon" style="font-size:1.2rem">${u.role==='owner'?'👑':u.role==='staff'?'🛡':'👤'}</div>
        <div class="adm-item-info">
          <div class="adm-item-name">${esc(u.username)} <span style="font-family:var(--font-m);font-size:0.6rem;padding:2px 8px;border-radius:3px;background:var(--sf2);color:var(--t2)">${u.role.toUpperCase()}</span></div>
          <div class="adm-item-meta">${esc(u.email)} · IP: ${sess?esc(sess.ip):'—'} · <span style="color:${online?'var(--free-c)':'var(--t3)'}">${online?'ONLINE':'OFFLINE'}</span></div>
        </div>
        ${(CU.role==='owner' && u.id!==CU.id)?`<button class="btn-del" onclick="deleteUser('${u.id}')">🗑 HAPUS</button>`:''}
      </div>`;
    }).join('');
}

function deleteUser(id){
  if(!confirm('Hapus user ini?')) return;
  ss('users', ls('users',[]).filter(u=>u.id!==id));
  clearSession(id);
  renderUserAdmList();
  toast('User dihapus.','info');
}

// ============================================================
//  LIVE IP MONITOR
// ============================================================
function refreshLive(){
  const sessions = ls('sessions',{});
  const bans     = ls('bans',[]);
  const bannedIPs= bans.map(b=>b.ip);
  const tbody    = document.getElementById('liveTbody');
  if(!tbody) return;

  const rows = Object.values(sessions);
  const now  = Date.now();
  let onlineCount = 0;

  // Mark stale sessions
  rows.forEach(s => {
    const age = now - (s.lastPing||0);
    s.isOnline = age < SESSION_TTL;
    if(s.isOnline) onlineCount++;
  });

  const lsrOnline  = document.getElementById('lsrOnline');
  const lsrTotal   = document.getElementById('lsrTotal');
  const lsrBanned  = document.getElementById('lsrBanned');
  if(lsrOnline)  lsrOnline.textContent  = onlineCount;
  if(lsrTotal)   lsrTotal.textContent   = rows.length;
  if(lsrBanned)  lsrBanned.textContent  = bans.length;

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--t3);font-family:var(--font-m);font-size:0.75rem;padding:24px">TIDAK ADA SESI AKTIF</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(s => {
    const isBanned = bannedIPs.includes(s.ip);
    const online   = s.isOnline;
    const ago      = timeAgo(s.lastPing||0);
    return `<tr>
      <td style="font-family:var(--font-m)">${esc(s.username)}</td>
      <td><span style="font-size:0.7rem;padding:2px 8px;border-radius:3px;background:var(--sf2);color:var(--t2);font-family:var(--font-m)">${(s.role||'user').toUpperCase()}</span></td>
      <td style="font-family:var(--font-m);color:var(--acc)">${esc(s.ip)}</td>
      <td style="font-family:var(--font-m);color:var(--t2);font-size:0.7rem">${ago}</td>
      <td>${online?'<span class="live-status-online">ONLINE</span>':'<span class="live-status-offline">OFFLINE</span>'}</td>
      <td>${isBanned
        ? `<span style="font-family:var(--font-m);font-size:0.68rem;color:var(--acc2)">BANNED</span>`
        : `<button class="tbl-ban-btn" onclick="quickBan('${esc(s.ip)}','${esc(s.username)}')">🚫 BAN</button>`
      }</td>
    </tr>`;
  }).join('');
}

function startLiveTimer(){
  clearInterval(liveTimer);
  clearInterval(liveCDTimer);
  liveCD = 10;

  liveCDTimer = setInterval(()=>{
    const cd = document.getElementById('liveCD');
    if(cd){ liveCD--; cd.textContent = liveCD; if(liveCD<=0){ liveCD=10; refreshLive(); } }
  }, 1000);
}

// ============================================================
//  BAN SYSTEM
// ============================================================
function doBan(){
  const ip     = document.getElementById('banIp').value.trim();
  const reason = document.getElementById('banReason').value.trim();
  if(!ip){ toast('⚠ Masukkan IP.','err'); return; }
  if(ip === CIP){ toast('✕ Tidak bisa ban IP sendiri.','err'); return; }
  const bans = ls('bans',[]);
  if(bans.find(b=>b.ip===ip)){ toast('✕ IP sudah di-ban.','err'); return; }
  bans.push({ ip, reason:reason||'Melanggar aturan', bannedAt:Date.now(), bannedBy:CU.username });
  ss('bans',bans);
  document.getElementById('banIp').value     = '';
  document.getElementById('banReason').value = '';
  renderBanList();
  toast(`🚫 IP ${ip} berhasil di-ban.`,'ok');
}

function quickBan(ip, username){
  if(!confirm(`Ban IP ${ip} (${username})?`)) return;
  if(ip === CIP){ toast('✕ Tidak bisa ban IP sendiri.','err'); return; }
  const bans = ls('bans',[]);
  if(!bans.find(b=>b.ip===ip)){
    bans.push({ ip, reason:'Banned from live panel', bannedAt:Date.now(), bannedBy:CU.username });
    ss('bans',bans);
    toast(`🚫 IP ${ip} di-ban.`,'ok');
    refreshLive();
  }
}

function unban(ip){
  if(!confirm(`Unban IP ${ip}?`)) return;
  ss('bans', ls('bans',[]).filter(b=>b.ip!==ip));
  renderBanList();
  toast(`✓ IP ${ip} di-unban.`,'ok');
}

function renderBanList(){
  const el = document.getElementById('banList');
  if(!el) return;
  const bans = ls('bans',[]);
  if(!bans.length){
    el.innerHTML='<div class="empty-state"><span class="empty-icon">◎</span>TIDAK ADA IP YANG DI-BAN</div>';
    return;
  }
  el.innerHTML = '<h4 style="font-family:var(--font-m);font-size:0.68rem;color:var(--t3);letter-spacing:0.15em;margin-bottom:12px">IP DIBLOKIR ('+bans.length+')</h4>'+
    bans.map(b=>`<div class="adm-item">
      <div class="adm-item-icon" style="font-size:1.2rem">🚫</div>
      <div class="adm-item-info">
        <div class="adm-item-name" style="color:var(--acc2);font-family:var(--font-m)">${esc(b.ip)}</div>
        <div class="adm-item-meta">Alasan: ${esc(b.reason)} · Di-ban oleh: ${esc(b.bannedBy)} · ${timeAgo(b.bannedAt)}</div>
      </div>
      <button class="btn-sm-unban" onclick="unban('${esc(b.ip)}')">UNBAN</button>
    </div>`).join('');
}

// ============================================================
//  RESET PASSWORD (owner only)
// ============================================================
function doResetPwd(){
  if(CU.role !== 'owner'){ toast('✕ Hanya owner yang bisa reset password.','err'); return; }
  const targetName = document.getElementById('pwdTarget').value.trim().toLowerCase();
  const newPass    = document.getElementById('pwdNew').value;
  const confPass   = document.getElementById('pwdConf').value;
  const errEl      = document.getElementById('pwdErr');

  if(!newPass || !confPass){ errEl.textContent='⚠ Isi semua field.'; return; }
  if(newPass.length < 6){ errEl.textContent='⚠ Password min 6 karakter.'; return; }
  if(newPass !== confPass){ errEl.textContent='✕ Password tidak cocok.'; return; }

  const users = ls('users',[]);
  const uid   = targetName || CU.username;
  const idx   = users.findIndex(u => u.username.toLowerCase() === uid.toLowerCase());

  if(idx === -1){ errEl.textContent='✕ Username tidak ditemukan.'; return; }
  if(users[idx].role === 'owner' && users[idx].id !== CU.id && targetName){
    errEl.textContent='✕ Tidak bisa reset password owner lain.'; return;
  }

  users[idx].password = b64e(newPass);
  ss('users', users);
  if(users[idx].id === CU.id){ CU.password = users[idx].password; }

  document.getElementById('pwdTarget').value = '';
  document.getElementById('pwdNew').value    = '';
  document.getElementById('pwdConf').value   = '';
  errEl.textContent = '';
  toast(`✓ Password "${users[idx].username}" berhasil direset!`,'ok');
}

// ============================================================
//  AUTO-LOGIN
// ============================================================
function tryAutoLogin(){
  const saved = ls('activeSession', null);
  if(!saved) return false;
  const users = ls('users',[]);
  const u = users.find(x => x.id === saved.id);
  if(!u) return false;

  // Check if this session's IP still matches
  if(u.role==='owner'||u.role==='staff'){
    const sessions = ls('sessions',{});
    const sess = sessions[u.id];
    if(sess && sess.ip && sess.ip !== CIP && (Date.now()-sess.lastPing < SESSION_TTL*3)){
      ss('activeSession',null);
      return false;
    }
  }

  CU = u;
  logIP(u.id, u.username, u.role);
  launchApp();
  return true;
}

// ============================================================
//  UTILITIES
// ============================================================
function esc(s){
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts){
  const d = Date.now() - ts;
  const s = Math.floor(d/1000), m=Math.floor(s/60), h=Math.floor(m/60), dy=Math.floor(h/24);
  if(!ts) return '—';
  if(dy>0) return dy+'h lalu';
  if(h>0)  return h+'j lalu';
  if(m>0)  return m+'m lalu';
  if(s>0)  return s+'d lalu';
  return 'baru saja';
}

let toastTimer={};
let toastCnt = 0;
function toast(msg, type='info'){
  const c = document.getElementById('toastContainer');
  if(!c) return;
  const id = 'toast_'+(++toastCnt);
  const el = document.createElement('div');
  el.className = 'toast '+type;
  el.id = id;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(30px)'; el.style.transition='all 0.3s'; setTimeout(()=>el.remove(),300); }, 3000);
}

// ============================================================
//  KEYBOARD
// ============================================================
document.addEventListener('keydown', e => {
  if(e.key==='Escape') closeModal();
  if(e.key==='Enter'){
    const auth = document.getElementById('authOverlay');
    if(auth && auth.style.display!=='none'){
      const loginActive = document.getElementById('formLogin').classList.contains('active');
      if(loginActive) doLogin(); else doRegister();
    }
  }
});

// ============================================================
//  INIT
// ============================================================
(async function init(){
  initData();
  runLoader(async ()=>{
    await getIP();
    if(checkBanned()) return;
    document.getElementById('authOverlay').style.display = 'flex';
    if(!tryAutoLogin()){
      document.getElementById('authOverlay').style.display = 'flex';
    }
    initCursor();
  });
})();

// Prevent body scroll when modal open
document.getElementById('modalOverlay').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
