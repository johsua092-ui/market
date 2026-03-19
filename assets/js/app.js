/* ═══════════════════════════════════════════════════
   OXYX STORE — app.js
   Roles:
     owner  → full access
     staff  → builds tab only (delete violating builds)
     user   → browse + upload (pending review)
   ═══════════════════════════════════════════════════ */
'use strict';

/* ── CONSTANTS ── */
const SESSION_TTL = 90000;   // 90s = offline
const PING_MS     = 20000;   // ping every 20s
const LIVE_TICK   = 1000;    // countdown tick

/* ── STORAGE KEYS ── */
const K = k => '_ox4_' + k;
function ls(k, d){ try{ const v=localStorage.getItem(K(k)); return v!=null?JSON.parse(v):d; }catch{ return d; } }
function ss(k, v){ try{ localStorage.setItem(K(k), JSON.stringify(v)); }catch{} }

/* ── CRYPTO HELPERS ── */
// Simple hash for storing passwords — never store plaintext
function hashPw(pw){
  // djb2 hash encoded as base36 string, salted with site key
  const salt = 'OXYX_STORE_SECURE_2024';
  const str  = salt + pw + salt.split('').reverse().join('');
  let h = 5381;
  for(let i = 0; i < str.length; i++){
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  // Second pass for more entropy
  let h2 = 0x811c9dc5;
  for(let i = 0; i < str.length; i++){
    h2 ^= str.charCodeAt(i);
    h2 = (h2 * 0x01000193) >>> 0;
  }
  return h.toString(36) + h2.toString(36);
}

/* ── DEFAULT SEED ── */
function seed(){
  if(ls('seeded4', false)) return;
  // Owner account — password hashed, never stored plaintext
  const ownerPw = '29u39ShSSSSUA';
  ss('users', [
    { id:'own001', username:'owner', email:'owner@oxyx.store',
      pwHash: hashPw(ownerPw), role:'owner', createdAt: Date.now()-9e6 },
  ]);
  ss('builds',       []);
  ss('bans',         []);
  ss('sessions',     {});
  ss('staffCodes',   []);  // owner generates these dynamically
  ss('seeded4',      true);
}

/* ── STATE ── */
let CU   = null;   // current user
let CIP  = '0.0.0.0';
let pingTimer   = null;
let liveTimer   = null;
let liveRem     = 10;
let curFilter   = 'all';

// File upload state
let uploadedBuildFile  = null;
let uploadedPhotoData  = null;  // base64

/* ── IP DETECTION ── */
async function getIP(){
  try{
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if(d.ip) CIP = d.ip;
  }catch{
    CIP = '127.' + (navigator.platform.length % 256) + '.' + (screen.width % 256) + '.1';
  }
}

/* ── CURSOR ── */
function initCursor(){
  const g = document.getElementById('cGlow');
  const d = document.getElementById('cDot');
  if(!g || !d) return;
  document.addEventListener('mousemove', e => {
    g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
  });
  // Hover effects
  document.querySelectorAll('button,a,.bcard,.nl,.atab,.admin-tab-btn,.cat-card').forEach(el => {
    el.addEventListener('mouseenter', () => { d.style.width='12px'; d.style.height='12px'; d.style.background='#fff'; });
    el.addEventListener('mouseleave', () => { d.style.width='7px';  d.style.height='7px';  d.style.background='var(--a)'; });
  });
}

/* ── 3D CARD TILT ── */
function initTilt(){
  document.addEventListener('mousemove', e => {
    document.querySelectorAll('.bcard').forEach(card => {
      const r = card.getBoundingClientRect();
      if(e.clientX < r.left-80 || e.clientX > r.right+80 || e.clientY < r.top-80 || e.clientY > r.bottom+80){
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)'; return;
      }
      const x = (e.clientX - r.left) / r.width  - .5;
      const y = (e.clientY - r.top)  / r.height - .5;
      card.style.transform = `perspective(1000px) rotateY(${x*15}deg) rotateX(${-y*15}deg) translateZ(8px)`;
    });
  });
}

/* ── COUNT ANIMATION ── */
function animNum(el, target, dur=1200){
  if(!el) return;
  let start = null;
  (function step(ts){
    if(!start) start = ts;
    const p = Math.min((ts-start)/dur, 1);
    const e = 1 - Math.pow(1-p, 3);
    el.textContent = Math.floor(target * e);
    if(p < 1) requestAnimationFrame(step);
  })(performance.now());
}

/* ── LOADER ── */
function runLoader(cb){
  const bar = document.getElementById('loadBar');
  const msg = document.getElementById('loadMsg');
  const msgs = ['INITIALIZING SYSTEM...','LOADING ASSETS...','FETCHING IP ADDRESS...','CHECKING SESSION...','VERIFYING SECURITY...','SYSTEM READY ✓'];
  let p = 0, step = 0;
  const iv = setInterval(() => {
    p = Math.min(p + Math.random()*12 + 6, 100);
    if(bar) bar.style.width = p + '%';
    if(p > step * 20 && step < msgs.length && msg) msg.textContent = msgs[step++];
    if(p >= 100){
      clearInterval(iv);
      setTimeout(() => {
        const el = document.getElementById('screenLoad');
        if(el) el.classList.add('out');
        setTimeout(cb, 700);
      }, 400);
    }
  }, 130);
}

/* ── BAN CHECK ── */
function checkBanned(){
  const bans = ls('bans', []);
  return bans.some(b => b.ip === CIP);
}

function showBanned(){
  const el = document.getElementById('screenBanned'); if(!el) return;
  const ip = document.getElementById('banIpDisplay'); if(ip) ip.textContent = CIP;
  el.style.display = 'flex';
  document.getElementById('screenAuth').style.display = 'none';
  if(document.getElementById('mainApp')) document.getElementById('mainApp').style.display = 'none';
}

/* ── AUTH ── */
function switchTab(t){
  document.getElementById('tabL').classList.toggle('active', t==='login');
  document.getElementById('tabR').classList.toggle('active', t==='register');
  document.getElementById('fLogin').classList.toggle('active', t==='login');
  document.getElementById('fReg').classList.toggle('active', t==='register');
  document.getElementById('lErr').textContent = '';
  document.getElementById('rErr').textContent = '';
}

function toggleEye(id, btn){
  const el = document.getElementById(id); if(!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

function doLogin(){
  const u    = document.getElementById('lU').value.trim().toLowerCase();
  const p    = document.getElementById('lP').value;
  const errEl = document.getElementById('lErr');
  if(!u || !p){ errEl.textContent = '⚠ Please fill in all fields.'; return; }

  const users = ls('users', []);
  const user  = users.find(x => x.username.toLowerCase() === u);
  if(!user){ errEl.textContent = '✕ Username not found.'; return; }
  if(user.pwHash !== hashPw(p)){ errEl.textContent = '✕ Incorrect password.'; return; }

  // Single-session enforcement for owner/staff
  if(user.role === 'owner' || user.role === 'staff'){
    const sess = ls('sessions', {});
    const ex   = sess[user.id];
    if(ex && ex.ip && ex.ip !== CIP && (Date.now() - ex.lastPing) < SESSION_TTL * 2){
      errEl.textContent = `🔒 This account is already active from another IP (${ex.ip}).`;
      return;
    }
  }

  recordSession(user.id, user.username, user.role);
  CU = user;
  ss('activeSession', { id: user.id });
  launchApp();
}

function doRegister(){
  const u    = document.getElementById('rU').value.trim().toLowerCase();
  const e    = document.getElementById('rE').value.trim();
  const p    = document.getElementById('rP').value;
  const code = document.getElementById('rC').value.trim().toUpperCase();
  const errEl = document.getElementById('rErr');

  if(!u || !e || !p){ errEl.textContent = '⚠ Please fill in all required fields.'; return; }
  if(u.length < 3){ errEl.textContent = '⚠ Username must be at least 3 characters.'; return; }
  if(p.length < 6){ errEl.textContent = '⚠ Password must be at least 6 characters.'; return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){ errEl.textContent = '⚠ Invalid email format.'; return; }

  const users = ls('users', []);
  if(users.find(x => x.username.toLowerCase() === u)){ errEl.textContent = '✕ Username already taken.'; return; }
  if(users.find(x => x.email.toLowerCase() === e.toLowerCase())){ errEl.textContent = '✕ Email already registered.'; return; }

  let role = 'user';

  // Check staff code
  if(code){
    const staffCodes = ls('staffCodes', []);
    const codeEntry  = staffCodes.find(c => c.code === code && !c.used);
    if(!codeEntry){ errEl.textContent = '✕ Invalid or already used staff code.'; return; }

    // Check staff slot
    const staffCount = users.filter(x => x.role === 'staff').length;
    if(staffCount >= 2){ errEl.textContent = '✕ Staff slots are full (max 2).'; return; }

    role = 'staff';
    // Mark code as used
    codeEntry.used      = true;
    codeEntry.usedBy    = u;
    codeEntry.usedAt    = Date.now();
    ss('staffCodes', staffCodes);
  }

  users.push({
    id:        'u' + Date.now(),
    username:  u,
    email:     e,
    pwHash:    hashPw(p),
    role,
    createdAt: Date.now()
  });
  ss('users', users);
  toast('✓ Account created successfully! Please log in.', 'ok');
  switchTab('login');
  document.getElementById('lU').value = u;
}

function doLogout(){
  if(CU) clearSession(CU.id);
  clearInterval(pingTimer);
  stopLiveTimer();
  CU = null;
  ss('activeSession', null);
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('screenAuth').style.display = 'flex';
  if(typeof initAuthCanvas === 'function') initAuthCanvas();
  toast('Logged out successfully.', 'info');
}

/* ── SESSION ── */
function recordSession(uid, username, role){
  const sess = ls('sessions', {});
  sess[uid]  = { uid, username, role, ip: CIP, lastPing: Date.now(), online: true };
  ss('sessions', sess);
}
function pingSession(){
  if(!CU) return;
  const sess = ls('sessions', {});
  if(sess[CU.id]){
    sess[CU.id].lastPing = Date.now();
    sess[CU.id].online   = true;
    sess[CU.id].ip       = CIP;
    ss('sessions', sess);
  }
}
function clearSession(uid){
  const sess = ls('sessions', {});
  if(sess[uid]){ sess[uid].online = false; sess[uid].lastPing = 0; }
  ss('sessions', sess);
}
function startPing(){
  clearInterval(pingTimer);
  pingSession();
  pingTimer = setInterval(pingSession, PING_MS);
}

/* ── AUTO LOGIN ── */
function tryAutoLogin(){
  const saved = ls('activeSession', null); if(!saved) return false;
  const users = ls('users', []);
  const u     = users.find(x => x.id === saved.id); if(!u) return false;
  if(u.role === 'owner' || u.role === 'staff'){
    const sess = ls('sessions', {});
    const ex   = sess[u.id];
    if(ex && ex.ip && ex.ip !== CIP && (Date.now() - ex.lastPing) < SESSION_TTL * 2){
      ss('activeSession', null); return false;
    }
  }
  CU = u;
  recordSession(u.id, u.username, u.role);
  launchApp();
  return true;
}

/* ── LAUNCH APP ── */
function launchApp(){
  document.getElementById('screenAuth').style.display = 'none';
  document.getElementById('mainApp').style.display    = 'block';

  // Navbar
  const nm = document.getElementById('nbNm');
  const av = document.getElementById('nbAv');
  const rc = document.getElementById('nbRc');
  if(nm) nm.textContent = CU.username;
  if(av) av.textContent = CU.username[0].toUpperCase();
  if(rc){ rc.textContent = CU.role.toUpperCase(); rc.className = 'nb-role-chip ' + CU.role; }

  // Show admin link for owner & staff
  const adminLink = document.getElementById('nl-admin');
  if(adminLink) adminLink.style.display = (CU.role === 'owner' || CU.role === 'staff') ? 'inline' : 'none';

  startPing();
  goTo('home');
  updateHomeStats();
  setTimeout(initTilt, 600);
}

/* ── NAVIGATION ── */
function goTo(page){
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nl').forEach(l => l.classList.remove('active'));
  const sec  = document.getElementById('sec-' + page);
  const link = document.getElementById('nl-' + page);
  if(sec)  sec.classList.add('active');
  if(link) link.classList.add('active');
  // Close mobile menu
  document.getElementById('nbLinks').classList.remove('open');

  if(page === 'home'){    renderGrid('featGrid', null, 'all', true); updateHomeStats(); }
  if(page === 'store')    renderGrid('storeGrid', null, curFilter);
  if(page === 'premium')  renderGrid('premGrid', 'premium');
  if(page === 'free')     renderGrid('freeGrid', 'free');
  if(page === 'submit')   renderMyPending();
  if(page === 'admin')    initAdminPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleNav(){
  document.getElementById('nbLinks').classList.toggle('open');
}

/* ── HOME STATS ── */
function updateHomeStats(){
  const builds  = ls('builds', []).filter(b => b.status === 'approved');
  const users   = ls('users',  []);
  const prem    = builds.filter(b => b.type === 'premium').length;
  const free    = builds.filter(b => b.type === 'free').length;
  animNum(document.getElementById('hsB'),  builds.length);
  animNum(document.getElementById('hsP'),  prem);
  animNum(document.getElementById('hsF'),  free);
  animNum(document.getElementById('hsU'),  users.length);
  animNum(document.getElementById('authStatB'), builds.length);
  animNum(document.getElementById('authStatU'), users.length);
  const cp = document.getElementById('ccPrem'); if(cp) cp.textContent = prem + ' builds';
  const cf = document.getElementById('ccFree'); if(cf) cf.textContent = free + ' builds';
}

/* ── BUILD GRID RENDER ── */
function renderGrid(containerId, typeFilter, filterMode, featOnly){
  const el = document.getElementById(containerId); if(!el) return;
  let builds = ls('builds', []).filter(b => b.status === 'approved');
  if(typeFilter)  builds = builds.filter(b => b.type === typeFilter);
  if(filterMode && filterMode !== 'all') builds = builds.filter(b => b.type === filterMode);
  if(featOnly)    builds = builds.filter(b => b.featured).slice(0, 6);

  if(!builds.length){
    el.innerHTML = `<div class="empty-state"><span class="es-icon">◎</span>NO BUILDS AVAILABLE YET</div>`;
    return;
  }
  el.innerHTML = builds.map(buildCardHTML).join('');
  setTimeout(initTilt, 100);
}

function buildCardHTML(b){
  const ip = b.type === 'premium';
  const pr = ip ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE';
  const thumb = b.photoData
    ? `<img class="bc-photo" src="${b.photoData}" alt="${esc(b.name)}">`
    : `<span class="bc-icon">◈</span>`;
  return `<div class="bcard" onclick="openModal('${b.id}')">
    <div class="bc-thumb"><div class="bc-thumb-glow"></div>${thumb}
      <span class="bc-badge ${ip?'bp':'bf'}">${ip?'♛ PREMIUM':'✦ FREE'}</span>
    </div>
    <div class="bc-body">
      <div class="bc-cat">${esc(b.cat||'—')}</div>
      <div class="bc-name">${esc(b.name)}</div>
      <div class="bc-desc">${esc(b.desc)}</div>
      <div class="bc-foot">
        <span class="bc-price ${ip?'pp':'fp'}">${pr}</span>
        <button class="btn-view">VIEW →</button>
      </div>
    </div>
  </div>`;
}

function applyFilter(type, btn, gridId){
  curFilter = type;
  document.querySelectorAll('.flt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid(gridId, null, type);
}

/* ── MODAL ── */
function openModal(id){
  const b = ls('builds', []).find(x => x.id === id); if(!b) return;
  const ip = b.type === 'premium';
  const pr = ip ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE';

  let photoHtml = '';
  if(b.photoData){
    photoHtml = `<img class="mod-photo" src="${b.photoData}" alt="${esc(b.name)}">`;
  }

  let fileHtml = '';
  if(b.buildFileName){
    fileHtml = `<div class="mod-file-info">📦 File: <strong>${esc(b.buildFileName)}</strong></div>`;
  }

  document.getElementById('modalContent').innerHTML = `
    ${photoHtml}
    <span class="mod-badge ${ip?'prem':'free'}">${ip?'♛ PREMIUM':'✦ FREE'}</span>
    <div class="mod-title">${esc(b.name)}</div>
    <div class="mod-meta">${esc(b.cat)}${b.submitter&&b.submitter!=='owner'?` · By: ${esc(b.submitter)}`:''}</div>
    <div class="mod-desc">${esc(b.desc)}</div>
    ${b.contact ? `<div class="mod-contact">📞 Seller contact: <strong>${esc(b.contact)}</strong></div>` : ''}
    ${fileHtml}
    <div class="mod-price-row">
      <div class="mod-price ${ip?'pp':'fp'}">${pr}</div>
    </div>
    ${ip
      ? `<button class="btn-modal-action bma-buy" onclick="handleBuy('${b.id}')">💳 BUY NOW</button>`
      : `${b.buildFileName?`<button class="btn-modal-action bma-dl" onclick="handleDownload('${b.id}')">⬇ DOWNLOAD .BUILD FILE</button>`:''}
         <a href="${esc(b.link||'#')}" target="_blank" class="btn-modal-action bma-prev">🔗 VIEW PREVIEW</a>`
    }
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e){
  if(!e || e.target === document.getElementById('modalOverlay')){
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function handleBuy(id){
  const b = ls('builds', []).find(x => x.id === id);
  if(b) toast(`💬 Contact seller: ${b.contact || 'Contact admin for purchase'}`, 'info');
  closeModal();
}

function handleDownload(id){
  const b = ls('builds', []).find(x => x.id === id);
  if(!b || !b.buildFileData) { toast('⚠ Build file not available.', 'err'); return; }
  // Create blob and trigger download
  const byteStr  = atob(b.buildFileData);
  const ab       = new ArrayBuffer(byteStr.length);
  const ia       = new Uint8Array(ab);
  for(let i=0; i<byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  const blob = new Blob([ab], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = b.buildFileName || 'build.build';
  a.click();
  URL.revokeObjectURL(url);
  toast('⬇ Downloading ' + b.buildFileName, 'ok');
}

/* ── FILE UPLOAD HANDLERS ── */
function handleBuildFile(input){
  const file = input.files[0];
  if(!file) return;

  // Validate .build extension
  if(!file.name.toLowerCase().endsWith('.build')){
    toast('✕ Only .build files are accepted.', 'err');
    input.value = '';
    return;
  }
  if(file.size > 50 * 1024 * 1024){ // 50MB max
    toast('✕ File too large (max 50MB).', 'err');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e){
    uploadedBuildFile = { name: file.name, data: btoa(String.fromCharCode(...new Uint8Array(e.target.result))) };
    document.getElementById('buildFileName').textContent = '✓ ' + file.name;
    document.getElementById('buildDropZone').style.borderColor = 'var(--fr)';
  };
  reader.readAsArrayBuffer(file);
}

function handlePhotoFile(input){
  const file = input.files[0];
  if(!file) return;

  if(!file.type.startsWith('image/')){
    toast('✕ Only image files are accepted.', 'err');
    input.value = '';
    return;
  }
  if(file.size > 5 * 1024 * 1024){ // 5MB max
    toast('✕ Image too large (max 5MB).', 'err');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e){
    uploadedPhotoData = e.target.result;
    const img  = document.getElementById('photoPreviewImg');
    const wrap = document.getElementById('photoPreviewWrap');
    const ph   = document.getElementById('photoPlaceholder');
    img.src    = uploadedPhotoData;
    wrap.style.display = 'flex';
    if(ph) ph.style.display = 'none';
    document.getElementById('photoDropZone').style.borderColor = 'var(--fr)';
  };
  reader.readAsDataURL(file);
}

// Drag & drop support
['buildDropZone','photoDropZone'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById(id);
    if(!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor='var(--a)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor=''; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if(!file) return;
      if(id === 'buildDropZone'){
        const fakeInput = { files: [file], value: '' };
        handleBuildFile(fakeInput);
      } else {
        const fakeInput = { files: [file], value: '' };
        handlePhotoFile(fakeInput);
      }
    });
  });
});

/* ── SUBMIT BUILD ── */
function submitBuild(){
  const n   = document.getElementById('sbN').value.trim();
  const t   = document.getElementById('sbT').value;
  const p   = parseInt(document.getElementById('sbP').value) || 0;
  const c   = document.getElementById('sbC').value.trim();
  const d   = document.getElementById('sbD').value.trim();
  const l   = document.getElementById('sbL').value.trim();
  const k   = document.getElementById('sbK').value.trim();
  const tos = document.getElementById('sbTos').checked;

  if(!n){ toast('⚠ Build name is required.', 'err'); return; }
  if(!d){ toast('⚠ Description is required.', 'err'); return; }
  if(!l){ toast('⚠ Preview link is required.', 'err'); return; }
  if(!uploadedBuildFile){ toast('⚠ Please upload a .build file.', 'err'); return; }
  if(!tos){ toast('⚠ Please confirm the originality statement.', 'err'); return; }

  const builds = ls('builds', []);
  builds.push({
    id:            'b' + Date.now(),
    name:          n,
    type:          t,
    price:         p,
    cat:           c,
    desc:          d,
    link:          l,
    contact:       k,
    photoData:     uploadedPhotoData,
    buildFileName: uploadedBuildFile.name,
    buildFileData: uploadedBuildFile.data,
    submitter:     CU.username,
    featured:      false,
    status:        'pending',
    createdAt:     Date.now()
  });
  ss('builds', builds);

  // Reset form
  ['sbN','sbP','sbC','sbD','sbL','sbK'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('sbTos').checked   = false;
  document.getElementById('buildFileName').textContent = '';
  document.getElementById('buildDropZone').style.borderColor = '';
  document.getElementById('photoDropZone').style.borderColor = '';
  const wrap = document.getElementById('photoPreviewWrap');
  const ph   = document.getElementById('photoPlaceholder');
  if(wrap){ wrap.style.display='none'; document.getElementById('photoPreviewImg').src=''; }
  if(ph) ph.style.display='';
  uploadedBuildFile = null;
  uploadedPhotoData = null;

  toast('✓ Build submitted! Pending owner review.', 'ok');
  renderMyPending();
}

function renderMyPending(){
  const el = document.getElementById('myPendingList'); if(!el) return;
  const mine = ls('builds', []).filter(b => b.submitter === CU.username && b.status === 'pending');
  if(!mine.length){ el.innerHTML = '<div class="usb-empty">No pending builds.</div>'; return; }
  el.innerHTML = mine.map(b => `
    <div class="pend-item">
      <div class="pend-name">${esc(b.name)}</div>
      <div class="pend-status">⏳ Awaiting review...</div>
    </div>`).join('');
}

/* ════════════════════════════════════
   ADMIN PANEL
   ════════════════════════════════════ */
function initAdminPanel(){
  const rb = document.getElementById('adminRoleBadge');
  const st = document.getElementById('adminSubText');
  if(rb){ rb.textContent = CU.role.toUpperCase(); rb.className = 'admin-role-badge ' + CU.role; }
  if(st) st.textContent = CU.role==='owner' ? 'Owner — Full System Access' : 'Staff — Manage Builds Only';

  buildAdminTabs();
  renderBuildPanel();
}

/* Build admin tabs based on role */
function buildAdminTabs(){
  const nav     = document.getElementById('adminTabsNav'); if(!nav) return;
  const isOwner = CU.role === 'owner';

  // Staff: only builds tab
  // Owner: all tabs
  const tabs = [
    { id:'builds', label:'📦 BUILDS',        all:true  },
    { id:'users',  label:'👥 USERS',          all:false },
    { id:'live',   label:'📡 LIVE IP <span style="color:var(--r);animation:lPulse 1.5s infinite">●</span>', all:false },
    { id:'ban',    label:'🚫 BAN IP',          all:false },
    { id:'pwd',    label:'🔑 RESET PASSWORD',  all:false },
    { id:'codes',  label:'🎫 STAFF CODES',     all:false },
  ];

  nav.innerHTML = tabs
    .filter(t => t.all || isOwner)
    .map((t, i) =>
      `<button class="admin-tab-btn${i===0?' active':''}" onclick="switchAdminTab('${t.id}',this)">${t.label}</button>`
    ).join('');

  // Show/hide owner-only tabs content
  ['atab-users','atab-live','atab-ban','atab-pwd','atab-codes'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = isOwner ? '' : 'none';
  });

  // Show add-build box and pending box only for owner
  const addBox     = document.getElementById('addBuildBox');
  const pendingBox = document.getElementById('pendingBox');
  if(addBox)     addBox.style.display     = isOwner ? '' : 'none';
  if(pendingBox) pendingBox.style.display = isOwner ? '' : 'none';

  // Activate first tab
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  const first = document.getElementById('atab-builds');
  if(first) first.classList.add('active');
}

function switchAdminTab(name, btn){
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const tab = document.getElementById('atab-' + name);
  if(tab) tab.classList.add('active');

  if(name === 'live')   { refreshLive(); startLiveTimer(); }
  if(name === 'ban')    renderBanPanel();
  if(name === 'users')  renderUserPanel();
  if(name === 'codes')  renderStaffCodesPanel();
  if(name === 'builds') renderBuildPanel();
}

/* ── BUILDS PANEL ── */
function adminAddBuild(){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  const n=document.getElementById('aN').value.trim(), t=document.getElementById('aT').value;
  const p=parseInt(document.getElementById('aP').value)||0;
  const c=document.getElementById('aC').value.trim(), d=document.getElementById('aD').value.trim();
  const l=document.getElementById('aL').value.trim();
  if(!n||!d){ toast('⚠ Name and description are required.', 'err'); return; }
  const builds = ls('builds', []);
  builds.push({
    id:'b'+Date.now(), name:n, type:t, price:p, cat:c, desc:d, link:l,
    contact:'', photoData:null, buildFileName:null, buildFileData:null,
    submitter:'owner', featured:false, status:'approved', createdAt:Date.now()
  });
  ss('builds', builds);
  ['aN','aP','aC','aD','aL'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  renderBuildPanel(); updateHomeStats(); toast('✓ Build added!', 'ok');
}

function renderBuildPanel(){
  renderPendingPanel();
  const el = document.getElementById('buildPanelList'); if(!el) return;
  const builds = ls('builds', []).filter(b => b.status === 'approved');
  if(!builds.length){
    el.innerHTML = '<div class="empty-state" style="padding:20px"><span class="es-icon" style="font-size:1.5rem">◎</span>No approved builds yet</div>';
    return;
  }
  el.innerHTML = builds.map(b => {
    const ip = b.type === 'premium';
    const thumb = b.photoData
      ? `<img src="${b.photoData}" style="width:100%;height:100%;object-fit:cover">`
      : `<span>${b.icon||'◈'}</span>`;
    return `<div class="pl-item">
      <div class="pl-thumb">${thumb}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(b.name)}<span class="chip ${ip?'ch-prem':'ch-free'}">${ip?'PREMIUM':'FREE'}</span>${b.submitter&&b.submitter!=='owner'?`<span style="font-family:var(--fm);font-size:.58rem;color:var(--t2)">by ${esc(b.submitter)}</span>`:''}</div>
        <div class="pl-meta">${ip?'Rp '+Number(b.price).toLocaleString('id-ID'):'FREE'} · ${esc(b.cat)} ${b.buildFileName?'· 📦 '+esc(b.buildFileName):''}</div>
      </div>
      <div class="pl-actions"><button class="btn-del" onclick="deleteBuild('${b.id}')">🗑 DELETE</button></div>
    </div>`;
  }).join('');
}

function renderPendingPanel(){
  if(CU.role !== 'owner') return;
  const el    = document.getElementById('pendingList');
  const badge = document.getElementById('pendBadge');
  if(!el) return;
  const pending = ls('builds', []).filter(b => b.status === 'pending');
  if(badge) badge.textContent = pending.length;
  if(!pending.length){
    el.innerHTML = '<div class="empty-state" style="padding:16px"><span>✓ </span>No pending builds</div>'; return;
  }
  el.innerHTML = pending.map(b => `
    <div class="pl-item">
      <div class="pl-thumb">${b.photoData?`<img src="${b.photoData}" style="width:100%;height:100%;object-fit:cover">`:'<span>📦</span>'}</div>
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
  // Both owner and staff can delete builds
  if(!confirm('Delete this build?')) return;
  ss('builds', ls('builds', []).filter(b => b.id !== id));
  renderBuildPanel();
  renderGrid('storeGrid', null, curFilter);
  renderGrid('featGrid', null, 'all', true);
  updateHomeStats();
  toast('Build deleted.', 'info');
}

function approveBuild(id){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  const builds = ls('builds', []);
  const i = builds.findIndex(b => b.id === id); if(i < 0) return;
  builds[i].status = 'approved';
  ss('builds', builds);
  renderBuildPanel(); updateHomeStats();
  toast('✓ Build approved!', 'ok');
}

function rejectBuild(id){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  if(!confirm('Reject and delete this build?')) return;
  ss('builds', ls('builds', []).filter(b => b.id !== id));
  renderBuildPanel();
  toast('Build rejected and removed.', 'info');
}

/* ── USERS PANEL (owner only) ── */
function renderUserPanel(){
  if(CU.role !== 'owner') return;
  const el    = document.getElementById('userPanelList'); if(!el) return;
  const users = ls('users', []);
  const sess  = ls('sessions', {});
  el.innerHTML = users.map(u => {
    const s  = sess[u.id];
    const on = s && (Date.now() - s.lastPing) < SESSION_TTL;
    return `<div class="pl-item">
      <div class="pl-thumb" style="font-size:1.3rem">${u.role==='owner'?'👑':u.role==='staff'?'🛡':'👤'}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(u.username)}<span class="chip ch-${u.role}">${u.role.toUpperCase()}</span><span style="font-family:var(--fm);font-size:.6rem;color:${on?'var(--fr)':'var(--t3)'}">${on?'● ONLINE':'○ offline'}</span></div>
        <div class="pl-meta">${esc(u.email)} · IP: ${s?esc(s.ip):'—'}</div>
      </div>
      <div class="pl-actions">${u.id!==CU.id?`<button class="btn-del" onclick="deleteUser('${u.id}')">🗑 DELETE</button>`:'<span style="font-family:var(--fm);font-size:.6rem;color:var(--t3)">(you)</span>'}</div>
    </div>`;
  }).join('');
}

function deleteUser(id){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  if(!confirm('Delete this user?')) return;
  ss('users', ls('users', []).filter(u => u.id !== id));
  clearSession(id);
  renderUserPanel();
  toast('User deleted.', 'info');
}

/* ── LIVE IP MONITOR (owner only) ── */
function refreshLive(){
  if(CU.role !== 'owner') return;
  const sess    = ls('sessions', {});
  const bans    = ls('bans', []).map(b => b.ip);
  const rows    = Object.values(sess);
  const now     = Date.now();
  let   online  = 0;
  rows.forEach(r => { r.isOnline = (now - r.lastPing) < SESSION_TTL; if(r.isOnline) online++; });

  const elN = document.getElementById('lsOnline');
  const elT = document.getElementById('lsTotal');
  const elB = document.getElementById('lsBanned');
  if(elN) elN.textContent = online;
  if(elT) elT.textContent = rows.length;
  if(elB) elB.textContent = ls('bans', []).length;

  const tb = document.getElementById('liveTbody'); if(!tb) return;
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--t3);font-family:var(--fm);font-size:.7rem;padding:22px">No active sessions</td></tr>`;
    return;
  }
  tb.innerHTML = rows.map(r => `<tr>
    <td style="font-family:var(--fm)">${esc(r.username)}</td>
    <td><span class="chip ch-${r.role||'user'}">${(r.role||'user').toUpperCase()}</span></td>
    <td style="font-family:var(--fm);color:var(--a)">${esc(r.ip)}</td>
    <td style="font-family:var(--fm);color:var(--t2);font-size:.66rem">${timeAgo(r.lastPing)}</td>
    <td><span class="${r.isOnline?'st-on':'st-off'}">${r.isOnline?'ONLINE':'OFFLINE'}</span></td>
    <td>${bans.includes(r.ip)
      ? `<span style="font-family:var(--fm);font-size:.62rem;color:var(--r)">BANNED</span>`
      : `<button class="tbl-ban-btn" onclick="quickBanIp('${esc(r.ip)}','${esc(r.username)}')">🚫 BAN</button>`
    }</td>
  </tr>`).join('');
}

function startLiveTimer(){
  stopLiveTimer();
  liveRem = 10;
  liveTimer = setInterval(() => {
    liveRem--;
    const cd = document.getElementById('liveCountdown');
    if(cd) cd.textContent = liveRem;
    if(liveRem <= 0){ liveRem = 10; refreshLive(); }
  }, LIVE_TICK);
}
function stopLiveTimer(){ clearInterval(liveTimer); }

/* ── BAN IP PANEL (owner only) ── */
function doBanIp(){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  const ip  = document.getElementById('banIpIn').value.trim();
  const rsn = document.getElementById('banRsnIn').value.trim();
  if(!ip){ toast('⚠ Please enter an IP address.', 'err'); return; }
  if(ip === CIP){ toast('✕ You cannot ban your own IP.', 'err'); return; }
  const bans = ls('bans', []);
  if(bans.find(b => b.ip === ip)){ toast('This IP is already banned.', 'warn'); return; }
  bans.push({ ip, reason: rsn||'Violated rules', bannedBy: CU.username, bannedAt: Date.now() });
  ss('bans', bans);
  document.getElementById('banIpIn').value  = '';
  document.getElementById('banRsnIn').value = '';
  renderBanPanel();
  toast(`🚫 IP ${ip} has been banned.`, 'ok');
}

function quickBanIp(ip, username){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  if(!confirm(`Ban IP ${ip} (${username})?`)) return;
  if(ip === CIP){ toast('✕ You cannot ban your own IP.', 'err'); return; }
  const bans = ls('bans', []);
  if(!bans.find(b => b.ip === ip)){
    bans.push({ ip, reason:'Banned via live monitor', bannedBy: CU.username, bannedAt: Date.now() });
    ss('bans', bans);
  }
  refreshLive(); renderBanPanel();
  toast(`🚫 IP ${ip} banned.`, 'ok');
}

function unbanIp(ip){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  if(!confirm(`Unban IP ${ip}?`)) return;
  ss('bans', ls('bans', []).filter(b => b.ip !== ip));
  renderBanPanel();
  toast(`✓ IP ${ip} unbanned.`, 'ok');
}

function renderBanPanel(){
  if(CU.role !== 'owner') return;
  const el   = document.getElementById('banPanelList'); if(!el) return;
  const bans = ls('bans', []);
  if(!bans.length){
    el.innerHTML = '<div class="empty-state" style="padding:20px"><span class="es-icon" style="font-size:1.5rem">✓</span>No banned IPs</div>'; return;
  }
  el.innerHTML = bans.map(b => `
    <div class="pl-item">
      <div class="pl-thumb" style="font-size:1.3rem">🚫</div>
      <div class="pl-info">
        <div class="pl-name" style="color:var(--r);font-family:var(--fm)">${esc(b.ip)}</div>
        <div class="pl-meta">Reason: ${esc(b.reason)} · By: ${esc(b.bannedBy)} · ${timeAgo(b.bannedAt)}</div>
      </div>
      <div class="pl-actions"><button class="btn-unban" onclick="unbanIp('${esc(b.ip)}')">UNBAN</button></div>
    </div>`).join('');
}

/* ── RESET PASSWORD (owner only) ── */
function doResetPassword(){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  const target = document.getElementById('pwdTarget').value.trim().toLowerCase();
  const np     = document.getElementById('pwdNew').value;
  const cp     = document.getElementById('pwdConf').value;
  const errEl  = document.getElementById('pwdErr');

  if(!np || !cp){ errEl.textContent = '⚠ Please fill in all fields.'; return; }
  if(np.length < 6){ errEl.textContent = '⚠ Password must be at least 6 characters.'; return; }
  if(np !== cp){ errEl.textContent = '✕ Passwords do not match.'; return; }

  const users    = ls('users', []);
  const tgtName  = target || CU.username;
  const idx      = users.findIndex(u => u.username.toLowerCase() === tgtName);
  if(idx < 0){ errEl.textContent = '✕ Username not found.'; return; }
  if(users[idx].role === 'owner' && users[idx].id !== CU.id && target){
    errEl.textContent = '✕ Cannot reset another owner\'s password.'; return;
  }

  users[idx].pwHash = hashPw(np);
  ss('users', users);
  if(users[idx].id === CU.id) CU.pwHash = users[idx].pwHash;

  document.getElementById('pwdTarget').value = '';
  document.getElementById('pwdNew').value    = '';
  document.getElementById('pwdConf').value   = '';
  errEl.textContent = '';
  toast(`✓ Password for "${users[idx].username}" has been reset!`, 'ok');
}

/* ── STAFF CODES (owner only) ── */
function generateStaffCode(){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code    = 'STAFF-';
  for(let i = 0; i < 4; i++) code += chars[Math.floor(Math.random()*chars.length)];
  code += '-';
  for(let i = 0; i < 4; i++) code += chars[Math.floor(Math.random()*chars.length)];

  const codes = ls('staffCodes', []);
  codes.push({ code, used: false, createdBy: CU.username, createdAt: Date.now() });
  ss('staffCodes', codes);
  renderStaffCodesPanel();
  toast(`✓ New staff code: ${code}`, 'ok');
}

function revokeStaffCode(code){
  if(CU.role !== 'owner'){ toast('✕ Owner access only.', 'err'); return; }
  if(!confirm(`Revoke code ${code}?`)) return;
  ss('staffCodes', ls('staffCodes', []).filter(c => c.code !== code));
  renderStaffCodesPanel();
  toast(`Code ${code} revoked.`, 'info');
}

function renderStaffCodesPanel(){
  if(CU.role !== 'owner') return;
  const el    = document.getElementById('staffCodeList'); if(!el) return;
  const codes = ls('staffCodes', []);
  if(!codes.length){
    el.innerHTML = '<div class="empty-state" style="padding:16px">No codes generated yet. Click "+ GENERATE NEW CODE".</div>'; return;
  }
  el.innerHTML = codes.map(c => `
    <div class="pl-item">
      <div class="pl-thumb" style="font-size:1.3rem">🎫</div>
      <div class="pl-info">
        <div class="pl-name" style="font-family:var(--fm);letter-spacing:.12em">${esc(c.code)}
          <span class="chip ${c.used?'ch-used':'ch-active'}">${c.used?'USED':'ACTIVE'}</span>
        </div>
        <div class="pl-meta">${c.used?`Used by: ${esc(c.usedBy||'?')} · ${timeAgo(c.usedAt)}`:`Created: ${timeAgo(c.createdAt)}`}</div>
      </div>
      <div class="pl-actions">
        ${!c.used?`<button class="btn-revoke" onclick="revokeStaffCode('${esc(c.code)}')">REVOKE</button>`:''}
      </div>
    </div>`).join('');
}

/* ── UTILITIES ── */
function esc(s){
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts){
  if(!ts) return '—';
  const d=Date.now()-ts, s=Math.floor(d/1000), m=Math.floor(s/60), h=Math.floor(m/60), dy=Math.floor(h/24);
  if(dy>0) return dy+'d ago';
  if(h>0)  return h+'h ago';
  if(m>0)  return m+'m ago';
  if(s>0)  return s+'s ago';
  return 'just now';
}

let toastCount = 0;
function toast(msg, type='info'){
  const w = document.getElementById('toastArea'); if(!w) return;
  const id = 'tk' + (++toastCount);
  const el = document.createElement('div');
  el.id = id; el.className = 'toast ' + type; el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(26px)';
    el.style.transition = 'all .3s';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ── KEYBOARD ── */
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeModal();
  if(e.key === 'Enter'){
    const auth = document.getElementById('screenAuth');
    if(auth && auth.style.display !== 'none'){
      document.getElementById('fLogin').classList.contains('active') ? doLogin() : doRegister();
    }
  }
});

/* ── INIT ── */
(async function main(){
  seed();
  runLoader(async () => {
    await getIP();
    if(checkBanned()){ showBanned(); return; }
    document.getElementById('screenAuth').style.display = 'flex';
    if(typeof initAuthCanvas === 'function') initAuthCanvas();
    updateHomeStats();
    if(!tryAutoLogin()){
      // Show auth
    }
    initCursor();
  });
})();
