/* ============================================================
   OXYX STORE — app.js  (PocketBase edition)
   Works with PocketBase hosted on Railway.app
   ============================================================ */

/* ── PocketBase client ── */
const pb = new PocketBase(window.PB_URL || 'https://GANTI-URL.up.railway.app');

/* ── STATE ── */
let CU         = null;   // current user record
let curFilter  = 'all';
let uploadBuild = null;  // { file, name }
let uploadPhoto = null;  // File object
let notifOpen  = false;

/* ── STORAGE KEY for wishlist (still local) ── */
const WL_KEY = '_ox_wl';

/* ============================================================
   UTILS
   ============================================================ */
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtPrice(p) {
  return 'Rp ' + Number(p || 0).toLocaleString('id-ID');
}

function toast(msg, type) {
  type = type || 'info';
  var area = document.getElementById('toastArea');
  if (!area) return;
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transform = 'translateX(26px)';
    el.style.transition = 'all .3s';
    setTimeout(function () { el.remove(); }, 300);
  }, 3200);
}

function animNum(el, target, dur) {
  if (!el) return;
  dur = dur || 1000;
  var start = null;
  function step(ts) {
    if (!start) start = ts;
    var p = Math.min((ts - start) / dur, 1);
    var ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(target * ease);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function timeAgo(dateStr) {
  if (!dateStr) return '--';
  var s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* ============================================================
   VISUAL INIT
   ============================================================ */
function initCursor() {
  var g = document.getElementById('cGlow'), d = document.getElementById('cDot');
  if (!g || !d) return;
  var rx = 0, ry = 0, mx = 0, my = 0;
  document.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    d.style.left = mx + 'px'; d.style.top = my + 'px';
  });
  (function loop() {
    rx += (mx - rx) * 0.1; ry += (my - ry) * 0.1;
    g.style.left = rx + 'px'; g.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();
}

function initReveal() {
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
}

function initTilt() {
  document.addEventListener('mousemove', function (e) {
    document.querySelectorAll('.bcard').forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (Math.abs(e.clientX - r.left - r.width / 2) > 220) {
        c.style.transform = 'perspective(1000px)'; return;
      }
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top)  / r.height - 0.5;
      c.style.transform = 'perspective(1000px) rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 14) + 'deg) translateZ(10px)';
    });
  });
}

function initParticles() {
  var hero = document.querySelector('.hero');
  if (!hero || hero.querySelector('.float-particles')) return;
  var wrap = document.createElement('div'); wrap.className = 'float-particles';
  hero.prepend(wrap);
  var colors = ['rgba(0,255,213,.12)', 'rgba(176,109,255,.1)', 'rgba(255,45,85,.08)', 'rgba(0,255,136,.09)'];
  for (var i = 0; i < 16; i++) {
    var p = document.createElement('div'); p.className = 'fp';
    var sz = Math.random() * 8 + 3, dur = Math.random() * 18 + 12, del = Math.random() * -20;
    p.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;background:' + colors[Math.floor(Math.random() * colors.length)] + ';left:' + (Math.random() * 100) + '%;bottom:' + (Math.random() * 30) + '%;animation-duration:' + dur + 's;animation-delay:' + del + 's;';
    wrap.appendChild(p);
  }
}

function initParallax() {
  var orb = document.querySelector('.orb-3d');
  if (!orb || orb._px) return; orb._px = true;
  document.addEventListener('mousemove', function (e) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    orb.style.transform = 'perspective(800px) rotateY(' + ((e.clientX - cx) / cx * 12) + 'deg) rotateX(' + (-(e.clientY - cy) / cy * 8) + 'deg)';
  });
}

window.addEventListener('scroll', function () {
  var b = document.getElementById('btnTop');
  if (b) b.classList.toggle('show', window.scrollY > 440);
  var nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ============================================================
   LOADER
   ============================================================ */
function runLoader(cb) {
  var bar = document.getElementById('loadBar'), msg = document.getElementById('loadMsg');
  var msgs = ['INITIALIZING...', 'CONNECTING TO SERVER...', 'LOADING ASSETS...', 'CHECKING SESSION...', 'READY'];
  var p = 0, step = 0;
  var iv = setInterval(function () {
    p = Math.min(p + Math.random() * 12 + 6, 100);
    if (bar) bar.style.width = p + '%';
    if (p > step * 25 && step < msgs.length && msg) msg.textContent = msgs[step++];
    if (p >= 100) {
      clearInterval(iv);
      setTimeout(function () {
        var el = document.getElementById('screenLoad');
        if (el) el.classList.add('out');
        setTimeout(cb, 700);
      }, 400);
    }
  }, 130);
}

/* ============================================================
   PASSWORD STRENGTH
   ============================================================ */
function onPwInput(v) {
  var s = 0;
  if (v.length >= 6) s++; if (v.length >= 10) s++;
  if (/[A-Z]/.test(v)) s++; if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
  var labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  var colors = ['#ff2d55', '#ff6b2d', '#ffc432', '#00c8ff', '#00ff88', '#00ffd5'];
  var b = document.getElementById('pwBar'), l = document.getElementById('pwLbl');
  if (b) { b.style.width = (s / 5 * 100) + '%'; b.style.background = colors[Math.min(s, 5)]; }
  if (l) { l.textContent = labels[Math.min(s, 5)]; l.style.color = colors[Math.min(s, 5)]; }
}

function toggleEye(id, btn) {
  var el = document.getElementById(id); if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'text' ? 'hide' : 'show';
}

/* ============================================================
   AUTH
   ============================================================ */
function switchTab(t) {
  document.getElementById('tabL').classList.toggle('active', t === 'login');
  document.getElementById('tabR').classList.toggle('active', t === 'register');
  document.getElementById('fLogin').classList.toggle('active', t === 'login');
  document.getElementById('fReg').classList.toggle('active', t === 'register');
  ['lErr', 'rErr'].forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = ''; });
}

async function doLogin() {
  var u   = document.getElementById('lU').value.trim();
  var pw  = document.getElementById('lP').value;
  var err = document.getElementById('lErr');
  if (!u || !pw) { err.textContent = 'Fill in all fields.'; return; }
  err.textContent = 'Connecting...';
  try {
    // Try login — PocketBase users collection: use email to login
    // username is just for display; login always uses email
    var authData = await pb.collection('users').authWithPassword(u, pw);
    CU = authData.record || pb.authStore.model;
    if (!CU.username) CU.username = CU.name || CU.email.split('@')[0];
    if (!CU.role)     CU.role = 'user';
    err.textContent = '';
    launchApp();
  } catch (e) {
    // Show full error detail to help diagnose PocketBase issues
    var status  = e.status  || 0;
    var msg     = e.message || 'Unknown error';
    var rawData = '';
    try { rawData = JSON.stringify(e.data || e.response || {}); } catch(_) {}

    if (status === 400) {
      err.textContent = 'Wrong email or password.';
    } else if (status === 0 || msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      err.textContent = 'Cannot reach server. Is your PocketBase URL correct in index.html?  URL: ' + (window.PB_URL || 'NOT SET');
    } else if (status === 403) {
      err.textContent = 'Access denied (403). Check API Rules in PocketBase dashboard.';
    } else if (status === 404) {
      err.textContent = 'Collection not found (404). Create the "users" collection in PocketBase.';
    } else if (msg.includes('something went wrong') || status === 500) {
      err.textContent = 'PocketBase server error (500). Check if PocketBase is running on Railway. Detail: ' + rawData;
    } else {
      err.textContent = '[' + status + '] ' + msg;
    }
  }
}

async function doRegister() {
  var u    = document.getElementById('rU').value.trim().toLowerCase();
  var em   = document.getElementById('rE').value.trim();
  var pw   = document.getElementById('rP').value;
  var code = document.getElementById('rC').value.trim().toUpperCase();
  var err  = document.getElementById('rErr');
  if (!u || !em || !pw) { err.textContent = 'Fill in all fields.'; return; }
  if (u.length < 3)     { err.textContent = 'Username min 3 characters.'; return; }
  if (pw.length < 6)    { err.textContent = 'Password min 6 characters.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { err.textContent = 'Invalid email.'; return; }
  err.textContent = 'Creating account...';
  try {
    var role = 'user';
    if (code) {
      try {
        var codeRec = await pb.collection('staffCodes').getFirstListItem('code="' + code + '"&&used=false');
        role = 'staff';
        await pb.collection('staffCodes').update(codeRec.id, { used: true, usedBy: u });
      } catch (ce) { err.textContent = 'Invalid or used staff code.'; return; }
    }

    // Create user — PocketBase built-in users collection
    // username and role are custom fields you add in PocketBase dashboard
    var data = {
      email: em,
      password: pw,
      passwordConfirm: pw
    };
    // Add username + role only if the fields exist (won't break if they don't)
    data.username = u;
    data.role = role;
    data.name = u; // PocketBase default field

    await pb.collection('users').create(data);
    // Auto login after register
    await pb.collection('users').authWithPassword(em, pw);
    CU = pb.authStore.model;
    if (!CU.username) CU.username = u;
    if (!CU.role)     CU.role = role;
    err.textContent = '';
    toast('Account created! Welcome ' + u, 'ok');
    launchApp();
  } catch (e) {
    var status = e.status || 0;
    var msg    = e.message || '';
    var data   = e.data || {};
    if (data.email) {
      err.textContent = 'Email already registered.';
    } else if (data.username) {
      err.textContent = 'Username already taken.';
    } else if (status === 0 || msg.includes('fetch') || msg.includes('Failed to fetch')) {
      err.textContent = 'Cannot reach server. URL set: ' + (window.PB_URL || 'NOT SET');
    } else if (status === 403) {
      err.textContent = 'Access denied (403). Set "Create rule" to empty (allow all) in PocketBase users collection.';
    } else if (status === 404) {
      err.textContent = 'Collection not found. Create "users" collection in PocketBase dashboard.';
    } else if (status === 400) {
      var detail = '';
      try { detail = Object.keys(data).map(function(k){ return k + ': ' + (data[k].message || data[k]); }).join(', '); } catch(_){}
      err.textContent = 'Validation error: ' + (detail || msg);
    } else {
      err.textContent = '[' + status + '] ' + msg;
    }
  }
}

async function doLogout() {
  pb.authStore.clear();
  CU = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('screenAuth').style.display = 'flex';
  toast('Logged out.', 'info');
}

/* Try auto-login from saved session */
async function tryAutoLogin() {
  if (!pb.authStore.isValid) return false;
  try {
    await pb.collection('users').authRefresh();
    CU = pb.authStore.model;
    if (!CU.username) CU.username = CU.email ? CU.email.split('@')[0] : 'user';
    if (!CU.role)     CU.role = 'user';
    return true;
  } catch (e) {
    pb.authStore.clear();
    return false;
  }
}

/* ============================================================
   LAUNCH
   ============================================================ */
function launchApp() {
  document.getElementById('screenAuth').style.display = 'none';
  document.getElementById('mainApp').style.display   = 'block';
  var nm = document.getElementById('nbNm'), av = document.getElementById('nbAv'), rc = document.getElementById('nbRc');
  if (nm) nm.textContent = CU.username;
  if (av) av.textContent = (CU.username || '?')[0].toUpperCase();
  if (rc) { rc.textContent = (CU.role || 'user').toUpperCase(); rc.className = 'nb-role-chip ' + (CU.role || 'user'); }
  var al = document.getElementById('nl-admin');
  if (al) al.style.display = (CU.role === 'owner' || CU.role === 'staff') ? 'inline' : 'none';
  var pl = document.getElementById('nl-profile');
  if (pl) pl.style.display = 'inline';
  applyTicker();
  goTo('home');
  updateHomeStats();
  setTimeout(function () { initReveal(); initParticles(); initParallax(); }, 200);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function goTo(page) {
  document.querySelectorAll('.sec').forEach(function (s) { s.classList.remove('active'); });
  document.querySelectorAll('.nl').forEach(function (l) { l.classList.remove('active'); });
  var sec = document.getElementById('sec-' + page); if (sec) sec.classList.add('active');
  var lnk = document.getElementById('nl-' + page);  if (lnk) lnk.classList.add('active');
  document.getElementById('nbLinks').classList.remove('open');
  if (page === 'home')    { renderFeatured(); renderRecent(); updateHomeStats(); }
  if (page === 'store')   renderGrid('storeGrid', '', curFilter);
  if (page === 'premium') renderGrid('premGrid', 'premium');
  if (page === 'free')    renderGrid('freeGrid',  'free');
  if (page === 'submit')  renderMyPending();
  if (page === 'admin')   initAdminPanel();
  if (page === 'profile') renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(initReveal, 100);
}

function toggleNav() { document.getElementById('nbLinks').classList.toggle('open'); }

/* ============================================================
   TICKER / ANNOUNCEMENT
   ============================================================ */
async function applyTicker() {
  try {
    var rec = await pb.collection('config').getFirstListItem('key="announcement"');
    var msg = rec.value || '';
    var wrap = document.getElementById('tickerWrap'), inner = document.getElementById('tickerInner');
    if (msg && wrap && inner) {
      inner.textContent = msg + '  .  ' + msg + '  .  ' + msg;
      wrap.style.display = 'flex';
    } else if (wrap) wrap.style.display = 'none';
  } catch (e) { var wrap = document.getElementById('tickerWrap'); if (wrap) wrap.style.display = 'none'; }
}

async function saveAnnouncement() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var v = document.getElementById('announceInput').value.trim();
  try {
    var existing = await pb.collection('config').getFirstListItem('key="announcement"');
    await pb.collection('config').update(existing.id, { value: v });
  } catch (e) {
    await pb.collection('config').create({ key: 'announcement', value: v });
  }
  applyTicker(); toast(v ? 'Announcement published!' : 'Cleared.', 'ok');
}

async function clearAnnouncement() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  try {
    var existing = await pb.collection('config').getFirstListItem('key="announcement"');
    await pb.collection('config').update(existing.id, { value: '' });
  } catch (e) {}
  applyTicker();
  var inp = document.getElementById('announceInput'); if (inp) inp.value = '';
  toast('Cleared.', 'info');
}

/* ============================================================
   BUILDS — READ
   ============================================================ */
function buildFileURL(record) {
  if (!record || !record.buildFile) return '';
  return pb.files.getUrl(record, record.buildFile);
}

function buildPhotoURL(record) {
  if (!record || !record.photo) return '';
  return pb.files.getUrl(record, record.photo, { thumb: '400x300' });
}

function buildCardHTML(b) {
  var ip = b.type === 'premium';
  var pr = ip ? fmtPrice(b.price) : 'FREE';
  var img = b.photo ? buildPhotoURL(b) : '';
  var thumb = img ? '<img class="bc-photo" src="' + img + '" alt="">' : '<span class="bc-icon">o</span>';
  var wl = isWl(b.id);
  return '<div class="bcard" onclick="openModal(\'' + b.id + '\')">' +
    '<div class="bc-thumb"><div class="bc-thumb-glow"></div>' + thumb +
    '<span class="bc-badge ' + (ip ? 'bp' : 'bf') + '">' + (ip ? 'PREMIUM' : 'FREE') + '</span>' +
    '<button class="wl-btn" data-id="' + b.id + '" onclick="toggleWishlist(\'' + b.id + '\',event)" style="color:' + (wl ? 'var(--r)' : '') + '">heart</button></div>' +
    '<div class="bc-body">' +
    '<div class="bc-top-row"><div class="bc-cat">' + esc(b.cat || '--') + '</div><div class="bc-views">views: ' + (b.views || 0) + '</div></div>' +
    '<div class="bc-name">' + esc(b.name) + '</div>' +
    '<div class="bc-desc">' + esc(b.desc) + '</div>' +
    '<div class="bc-foot"><span class="bc-price ' + (ip ? 'pp' : 'fp') + '">' + pr + '</span><button class="btn-view">VIEW</button></div>' +
    '</div></div>';
}

async function renderGrid(cid, typeFilter, fm) {
  var el = document.getElementById(cid); if (!el) return;
  el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>LOADING...</div>';
  try {
    var filter = 'status="approved"';
    if (typeFilter) filter += '&&type="' + typeFilter + '"';
    else if (fm && fm !== 'all') filter += '&&type="' + fm + '"';
    var res = await pb.collection('builds').getFullList({ filter: filter, sort: '-created' });
    if (!res.length) { el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>NO BUILDS YET</div>'; return; }
    el.innerHTML = res.map(buildCardHTML).join(''); setTimeout(initTilt, 100);
  } catch (e) { el.innerHTML = '<div class="empty-state">Could not load builds.</div>'; }
}

async function renderFeatured() {
  var el = document.getElementById('featGrid'); if (!el) return;
  try {
    var res = await pb.collection('builds').getList(1, 6, { filter: 'status="approved"&&featured=true', sort: '-created' });
    if (!res.items.length) { el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>NO FEATURED BUILDS YET</div>'; return; }
    el.innerHTML = res.items.map(buildCardHTML).join(''); setTimeout(initTilt, 100);
  } catch (e) { el.innerHTML = ''; }
}

async function renderRecent() {
  var el = document.getElementById('recentGrid'); if (!el) return;
  try {
    var res = await pb.collection('builds').getList(1, 4, { filter: 'status="approved"', sort: '-created' });
    if (!res.items.length) { el.innerHTML = ''; return; }
    el.innerHTML = res.items.map(buildCardHTML).join(''); setTimeout(initTilt, 100);
  } catch (e) { el.innerHTML = ''; }
}

async function updateHomeStats() {
  try {
    var res = await pb.collection('builds').getList(1, 1, { filter: 'status="approved"' });
    var prem = await pb.collection('builds').getList(1, 1, { filter: 'status="approved"&&type="premium"' });
    var free = await pb.collection('builds').getList(1, 1, { filter: 'status="approved"&&type="free"' });
    var users = await pb.collection('users').getList(1, 1);
    animNum(document.getElementById('hsB'), res.totalItems);
    animNum(document.getElementById('hsP'), prem.totalItems);
    animNum(document.getElementById('hsF'), free.totalItems);
    animNum(document.getElementById('hsU'), users.totalItems);
    animNum(document.getElementById('authStatB'), res.totalItems);
    animNum(document.getElementById('authStatU'), users.totalItems);
    var cp = document.getElementById('ccPrem'); if (cp) cp.textContent = prem.totalItems + ' builds';
    var cf = document.getElementById('ccFree'); if (cf) cf.textContent = free.totalItems + ' builds';
  } catch (e) {}
}

function applyFilter(type, btn, gridId) {
  curFilter = type;
  document.querySelectorAll('.flt').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderGrid(gridId, '', type);
}

/* ============================================================
   MODAL
   ============================================================ */
async function openModal(id) {
  var b;
  try { b = await pb.collection('builds').getOne(id); } catch (e) { return; }
  /* Increment views */
  pb.collection('builds').update(id, { views: (b.views || 0) + 1 }).catch(function () {});
  var ip  = b.type === 'premium';
  var pr  = ip ? fmtPrice(b.price) : 'FREE';
  var wl  = isWl(id);
  var img = b.photo ? buildPhotoURL(b) : '';
  var html = '';
  if (img) html += '<img class="mod-photo" src="' + img + '" alt="">';
  html += '<div class="mod-top-row">';
  html += '<span class="mod-badge ' + (ip ? 'prem' : 'free') + '">' + (ip ? 'PREMIUM' : 'FREE') + '</span>';
  html += '<button class="mod-wl-btn" id="mod-wl-' + id + '" onclick="toggleWishlist(\'' + id + '\',event)" style="color:' + (wl ? 'var(--r)' : '') + '">' + (wl ? 'Saved' : 'Save') + '</button>';
  html += '</div>';
  html += '<div class="mod-title">' + esc(b.name) + '</div>';
  html += '<div class="mod-meta">' + esc(b.cat || '--');
  if (b.submitter_name) html += ' — By <strong>' + esc(b.submitter_name) + '</strong>';
  html += ' — views: ' + ((b.views || 0) + 1) + '</div>';
  html += '<div class="mod-desc">' + esc(b.desc) + '</div>';
  if (b.contact) html += '<div class="mod-contact">Seller: <strong>' + esc(b.contact) + '</strong></div>';
  if (b.build_file_name) html += '<div class="mod-file-info">File: <strong>' + esc(b.build_file_name) + '</strong></div>';
  html += '<div class="mod-price-row"><div class="mod-price ' + (ip ? 'pp' : 'fp') + '">' + pr + '</div></div>';
  if (ip) {
    html += '<button class="btn-modal-action bma-buy" onclick="handleBuy(\'' + id + '\')">BUY NOW</button>';
  } else {
    if (b.buildFile) {
      html += '<button class="btn-modal-action bma-dl" onclick="handleDL(\'' + id + '\')">DOWNLOAD .BUILD</button>';
    }
    if (b.link) html += '<a href="' + esc(b.link) + '" target="_blank" class="btn-modal-action bma-prev">VIEW PREVIEW</a>';
  }
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
}

async function handleBuy(id) {
  try { var b = await pb.collection('builds').getOne(id); if (b) toast('Contact seller: ' + (b.contact || 'contact admin'), 'info'); } catch (e) {}
  closeModal();
}

async function handleDL(id) {
  try {
    var b = await pb.collection('builds').getOne(id);
    var url = pb.files.getUrl(b, b.buildFile);
    var a = document.createElement('a'); a.href = url; a.download = b.build_file_name || 'build.build'; a.click();
    toast('Downloading...', 'ok');
  } catch (e) { toast('Download failed.', 'err'); }
}

/* ============================================================
   WISHLIST  (local, no server needed)
   ============================================================ */
function isWl(id) { return (JSON.parse(localStorage.getItem(WL_KEY) || '[]')).includes(id); }

function toggleWishlist(id, e) {
  e.stopPropagation();
  var wl = JSON.parse(localStorage.getItem(WL_KEY) || '[]'), i = wl.indexOf(id);
  if (i > -1) { wl.splice(i, 1); toast('Removed from wishlist.', 'info'); }
  else         { wl.push(id);    toast('Added to wishlist!', 'ok'); }
  localStorage.setItem(WL_KEY, JSON.stringify(wl));
  document.querySelectorAll('.wl-btn[data-id="' + id + '"]').forEach(function (btn) {
    btn.textContent = wl.includes(id) ? 'S' : 'o';
    btn.style.color = wl.includes(id) ? 'var(--r)' : '';
  });
  var mb = document.getElementById('mod-wl-' + id);
  if (mb) { mb.textContent = wl.includes(id) ? 'Saved' : 'Save'; mb.style.color = wl.includes(id) ? 'var(--r)' : ''; }
}

/* ============================================================
   UPLOAD / SUBMIT BUILD
   ============================================================ */
function handleBuildFile(input) {
  var file = input.files[0]; if (!file) return;
  var ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (ext !== 'build') {
    input.value = ''; uploadBuild = null;
    var zone = document.getElementById('buildDropZone'), fn = document.getElementById('buildFileName');
    zone.style.borderColor = 'var(--r)'; fn.style.color = 'var(--r)';
    fn.textContent = 'Only .build files allowed  (e.g.  myapp.build)';
    toast('Only .build files accepted', 'err');
    setTimeout(function () { zone.style.borderColor = ''; fn.textContent = ''; fn.style.color = ''; }, 3200);
    return;
  }
  if (file.size > 150 * 1024 * 1024) { input.value = ''; toast('Max 150 MB.', 'err'); return; }
  uploadBuild = { file: file, name: file.name };
  var fn = document.getElementById('buildFileName');
  fn.style.color = 'var(--g)'; fn.textContent = 'Ready: ' + file.name;
  document.getElementById('buildDropZone').style.borderColor = 'var(--g)';
}

function handlePhotoFile(input) {
  var file = input.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Image files only.', 'err'); input.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { toast('Max 5 MB.', 'err'); input.value = ''; return; }
  uploadPhoto = file;
  var reader = new FileReader();
  reader.onload = function (ev) {
    document.getElementById('photoPreviewImg').src = ev.target.result;
    document.getElementById('photoPreviewWrap').style.display = 'flex';
    var ph = document.getElementById('photoPlaceholder'); if (ph) ph.style.display = 'none';
    document.getElementById('photoDropZone').style.borderColor = 'var(--g)';
  };
  reader.readAsDataURL(file);
}

function setIbError(fid, msg) {
  var ib = document.getElementById(fid), parent = ib ? (ib.closest('.ib') || ib.parentElement) : null;
  if (parent) parent.style.borderColor = 'var(--r)';
  var fg = ib ? ib.closest('.fg') : null;
  if (fg) {
    var h = fg.querySelector('.field-hint');
    if (!h) { h = document.createElement('div'); h.className = 'field-hint'; fg.appendChild(h); }
    h.textContent = msg; h.style.color = 'var(--r)'; h.style.fontSize = '.65rem'; h.style.marginTop = '5px'; h.style.fontFamily = 'var(--fm)';
  }
}
function clearIbError(fid) {
  var ib = document.getElementById(fid), parent = ib ? (ib.closest('.ib') || ib.parentElement) : null;
  if (parent) parent.style.borderColor = '';
  var fg = ib ? ib.closest('.fg') : null;
  if (fg) { var h = fg.querySelector('.field-hint'); if (h) h.remove(); }
}

async function submitBuild() {
  var n   = document.getElementById('sbN').value.trim();
  var t   = document.getElementById('sbT').value;
  var p   = parseInt(document.getElementById('sbP').value) || 0;
  var c   = document.getElementById('sbC').value.trim();
  var d   = document.getElementById('sbD').value.trim();
  var l   = document.getElementById('sbL').value.trim();
  var k   = document.getElementById('sbK').value.trim();
  var tos = document.getElementById('sbTos').checked;
  ['sbN', 'sbC', 'sbD', 'sbL', 'sbP'].forEach(clearIbError);
  var hasErr = false;
  function fail(fid, msg) { setIbError(fid, msg); hasErr = true; }
  if (!n) fail('sbN', 'Build name is required.');
  if (!c) fail('sbC', 'Category is required (e.g. Dashboard, Portfolio).');
  if (!d) fail('sbD', 'Description is required.');
  if (!l) fail('sbL', 'Demo link is required.');
  if (t === 'premium' && p <= 0) fail('sbP', 'Price is required for premium builds.');
  if (!uploadBuild) {
    document.getElementById('buildDropZone').style.borderColor = 'var(--r)';
    var fn = document.getElementById('buildFileName');
    fn.style.color = 'var(--r)'; fn.textContent = 'Upload a .build file first.';
    hasErr = true;
  }
  if (!tos) { toast('Confirm that this is your original work.', 'err'); hasErr = true; }
  if (hasErr) { toast('Please fill in all required fields.', 'err'); return; }

  var btn = document.querySelector('.submit-build-btn');
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'UPLOADING...'; }
  try {
    var formData = new FormData();
    formData.append('name',              n);
    formData.append('type',              t);
    formData.append('price',             p);
    formData.append('cat',               c);
    formData.append('desc',              d);
    formData.append('link',              l);
    formData.append('contact',           k);
    formData.append('status',            'pending');
    formData.append('featured',          false);
    formData.append('views',             0);
    formData.append('submitter_id',      CU.id);
    formData.append('submitter_name',    CU.username);
    formData.append('build_file_name',   uploadBuild.name);
    formData.append('buildFile',         uploadBuild.file);
    if (uploadPhoto) formData.append('photo', uploadPhoto);

    await pb.collection('builds').create(formData);
    toast('Build submitted! Pending owner review.', 'ok');
    /* Reset form */
    ['sbN', 'sbP', 'sbC', 'sbD', 'sbL', 'sbK'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('sbTos').checked = false;
    document.getElementById('buildFileName').textContent = ''; document.getElementById('buildDropZone').style.borderColor = '';
    document.getElementById('photoDropZone').style.borderColor = '';
    document.getElementById('photoPreviewWrap').style.display = 'none';
    document.getElementById('photoPreviewImg').src = '';
    var ph = document.getElementById('photoPlaceholder'); if (ph) ph.style.display = '';
    uploadBuild = null; uploadPhoto = null;
    renderMyPending();
  } catch (e) {
    toast('Upload failed: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'SUBMIT BUILD'; }
  }
}

async function renderMyPending() {
  var el = document.getElementById('myPendingList'); if (!el) return;
  try {
    var res = await pb.collection('builds').getFullList({ filter: 'submitter_id="' + CU.id + '"&&status="pending"' });
    if (!res.length) { el.innerHTML = '<div class="usb-empty">No pending builds.</div>'; return; }
    el.innerHTML = res.map(function (b) {
      return '<div class="pend-item"><div class="pend-name">' + esc(b.name) + '</div><div class="pend-status">Awaiting review...</div></div>';
    }).join('');
  } catch (e) { el.innerHTML = ''; }
}

/* ============================================================
   PROFILE
   ============================================================ */
async function renderProfile() {
  var el = document.getElementById('profileContent'); if (!el) return;
  el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>LOADING...</div>';
  try {
    var myBuilds = await pb.collection('builds').getFullList({ filter: 'submitter_id="' + CU.id + '"&&status="approved"' });
    var pending  = await pb.collection('builds').getFullList({ filter: 'submitter_id="' + CU.id + '"&&status="pending"' });
    var wlIds    = JSON.parse(localStorage.getItem(WL_KEY) || '[]');
    var wlBuilds = [];
    for (var i = 0; i < Math.min(wlIds.length, 6); i++) {
      try { var b = await pb.collection('builds').getOne(wlIds[i]); if (b.status === 'approved') wlBuilds.push(b); } catch (e) {}
    }
    var html = '<div class="profile-layout">';
    html += '<div class="profile-card">';
    html += '<div class="pc-avatar">' + (CU.username || '?')[0].toUpperCase() + '</div>';
    html += '<div class="pc-name">' + esc(CU.username) + '</div>';
    html += '<div class="pc-role-chip ch-' + (CU.role || 'user') + '">' + (CU.role || 'user').toUpperCase() + '</div>';
    html += '<div class="pc-email">' + esc(CU.email) + '</div>';
    html += '<div class="pc-stats">';
    html += '<div class="pc-stat"><div class="pc-sn">' + myBuilds.length + '</div><div class="pc-sl">UPLOADS</div></div>';
    html += '<div class="pc-stat"><div class="pc-sn">' + wlIds.length   + '</div><div class="pc-sl">WISHLIST</div></div>';
    html += '<div class="pc-stat"><div class="pc-sn">' + pending.length  + '</div><div class="pc-sl">PENDING</div></div>';
    html += '</div></div><div class="profile-right">';
    if (wlBuilds.length) html += '<div><div class="ps-title">WISHLIST</div><div class="builds-grid">' + wlBuilds.map(buildCardHTML).join('') + '</div></div>';
    if (myBuilds.length) html += '<div><div class="ps-title">MY BUILDS</div><div class="builds-grid">'  + myBuilds.map(buildCardHTML).join('') + '</div></div>';
    if (!wlBuilds.length && !myBuilds.length) html += '<div class="empty-state"><span class="es-icon">o</span>Explore builds and save favorites!</div>';
    html += '</div></div>';
    el.innerHTML = html; setTimeout(initTilt, 100);
  } catch (e) { el.innerHTML = '<div class="empty-state">Could not load profile.</div>'; }
}

/* ============================================================
   SEARCH
   ============================================================ */
function openSearch() {
  var ov = document.getElementById('searchOverlay'); if (!ov) return;
  ov.classList.add('open');
  setTimeout(function () { var inp = document.getElementById('srchInput'); if (inp) { inp.focus(); inp.value = ''; } document.getElementById('srchResults').innerHTML = ''; }, 50);
}
function closeSearch() { document.getElementById('searchOverlay').classList.remove('open'); }

async function doSearch(q) {
  var res = document.getElementById('srchResults'); if (!res) return;
  if (!q.trim()) { res.innerHTML = ''; return; }
  try {
    var ql = q.replace(/"/g, '');
    var items = await pb.collection('builds').getList(1, 8, {
      filter: 'status="approved"&&(name~"' + ql + '"||cat~"' + ql + '"||desc~"' + ql + '")'
    });
    if (!items.items.length) { res.innerHTML = '<div class="sri-empty">No results for "' + esc(q) + '"</div>'; return; }
    res.innerHTML = items.items.map(function (b) {
      var ip = b.type === 'premium', pr = ip ? fmtPrice(b.price) : 'FREE';
      var img = b.photo ? pb.files.getUrl(b, b.photo, { thumb: '60x60' }) : '';
      return '<div class="sri" onclick="closeSearch();openModal(\'' + b.id + '\')">' +
        '<div class="sri-thumb">' + (img ? '<img src="' + img + '" alt="">' : (b.cat || 'o')[0]) + '</div>' +
        '<div><div class="sri-name">' + esc(b.name) + '</div><div class="sri-meta">' + esc(b.cat || '--') + ' - ' + pr + '</div></div>' +
        '<span class="sri-badge ' + (ip ? 'sri-p' : 'sri-f') + '">' + (ip ? 'PREM' : 'FREE') + '</span></div>';
    }).join('');
  } catch (e) { res.innerHTML = '<div class="sri-empty">Search error.</div>'; }
}

/* ============================================================
   NOTIFICATIONS (local)
   ============================================================ */
function toggleNotifPanel() {
  var p = document.getElementById('notifPanel'); if (!p) return;
  notifOpen = !notifOpen; p.style.display = notifOpen ? 'block' : 'none';
}
function clearNotifs() {
  var el = document.getElementById('notifList'); if (el) el.innerHTML = '<div class="ni-empty">No notifications</div>';
  var d = document.getElementById('notifDot'); if (d) d.style.display = 'none';
  notifOpen = false; var p = document.getElementById('notifPanel'); if (p) p.style.display = 'none';
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
async function initAdminPanel() {
  var rb = document.getElementById('adminRoleBadge');
  if (rb) { rb.textContent = (CU.role || 'user').toUpperCase(); rb.className = 'ph-role-badge ' + (CU.role || 'user'); }
  var sg = document.getElementById('statGrid'); if (sg) sg.style.display = CU.role === 'owner' ? 'grid' : 'none';
  startAdminClock(); buildAdminTabs(); refreshAdminStats();
  if (CU.role === 'owner') checkOwnerAlert();
}

function startAdminClock() {
  function tick() { var el = document.getElementById('adminClock'); if (!el) return; el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  tick(); clearInterval(window._clkT); window._clkT = setInterval(tick, 1000);
}

async function refreshAdminStats() {
  if (CU.role !== 'owner') return;
  try {
    var results = await Promise.all([
      pb.collection('builds').getList(1, 1, { filter: 'status="approved"' }),
      pb.collection('builds').getList(1, 1, { filter: 'status="approved"&&type="premium"' }),
      pb.collection('users').getList(1, 1),
      pb.collection('bans').getList(1, 1),
      pb.collection('builds').getList(1, 1, { filter: 'status="pending"' })
    ]);
    animNum(document.getElementById('scBuilds'),  results[0].totalItems, 500);
    animNum(document.getElementById('scPremium'), results[1].totalItems, 500);
    animNum(document.getElementById('scMembers'), results[2].totalItems, 500);
    animNum(document.getElementById('scBanned'),  results[3].totalItems, 500);
    animNum(document.getElementById('scPending'), results[4].totalItems, 500);
    var pb2 = document.getElementById('pendBadge'); if (pb2) pb2.textContent = results[4].totalItems;
  } catch (e) {}
}

async function checkOwnerAlert() {
  try {
    var res = await pb.collection('builds').getList(1, 1, { filter: 'status="pending"' });
    var ab = document.getElementById('ownerAlert'), am = document.getElementById('ownerAlertMsg');
    if (ab && am && res.totalItems > 0) { am.textContent = res.totalItems + ' build(s) pending review.'; ab.style.display = 'flex'; }
    else if (ab) ab.style.display = 'none';
  } catch (e) {}
}

function buildAdminTabs() {
  var nav = document.getElementById('adminTabsNav'); if (!nav) return;
  var io = CU.role === 'owner';
  var tabs = [
    { id: 'builds', label: 'BUILDS',      all: true  },
    { id: 'users',  label: 'USERS',       all: false },
    { id: 'ban',    label: 'BAN',         all: false },
    { id: 'codes',  label: 'STAFF CODES', all: false },
    { id: 'tools',  label: 'TOOLS',       all: false }
  ];
  nav.innerHTML = tabs.filter(function (t) { return t.all || io; }).map(function (t, i) {
    return '<button class="admin-tab-btn' + (i === 0 ? ' active' : '') + '" onclick="switchAdminTab(\'' + t.id + '\',this)">' + t.label + '</button>';
  }).join('');
  ['admtab-users', 'admtab-ban', 'admtab-codes', 'admtab-tools'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.style.display = io ? '' : 'none';
  });
  var ab = document.getElementById('addBuildBox'); if (ab) ab.style.display = io ? '' : 'none';
  var pd = document.getElementById('pendingBox');  if (pd) pd.style.display = io ? '' : 'none';
  document.querySelectorAll('.admtab').forEach(function (t) { t.classList.remove('active'); });
  var first = document.getElementById('admtab-builds'); if (first) first.classList.add('active');
  renderBuildPanel();
}

function switchAdminTab(name, btn) {
  document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('.admtab').forEach(function (t) { t.classList.remove('active'); });
  btn.classList.add('active');
  var tab = document.getElementById('admtab-' + name); if (tab) tab.classList.add('active');
  if (name === 'builds') renderBuildPanel();
  if (name === 'users')  renderUserPanel();
  if (name === 'ban')    renderBanPanel();
  if (name === 'codes')  renderCodesPanel();
  if (name === 'tools') {
    var inp = document.getElementById('announceInput');
    if (inp) pb.collection('config').getFirstListItem('key="announcement"').then(function (r) { inp.value = r.value || ''; }).catch(function () { inp.value = ''; });
  }
  refreshAdminStats();
}

async function adminAddBuild() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var n = document.getElementById('aN').value.trim(), t = document.getElementById('aT').value;
  var p = parseInt(document.getElementById('aP').value) || 0, c = document.getElementById('aC').value.trim();
  var d = document.getElementById('aD').value.trim(), l = document.getElementById('aL').value.trim();
  if (!n || !d) { toast('Name and description required.', 'err'); return; }
  await pb.collection('builds').create({ name: n, type: t, price: p, cat: c, desc: d, link: l, contact: '', status: 'approved', featured: false, views: 0, submitter_id: CU.id, submitter_name: 'owner', build_file_name: '' });
  ['aN', 'aP', 'aC', 'aD', 'aL'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  renderBuildPanel(); updateHomeStats(); refreshAdminStats(); toast('Build added!', 'ok');
}

async function renderBuildPanel() {
  await renderPendingPanel();
  var el = document.getElementById('buildPanelList'); if (!el) return;
  try {
    var res = await pb.collection('builds').getFullList({ filter: 'status="approved"', sort: '-created' });
    if (!res.length) { el.innerHTML = '<div class="empty-state" style="padding:20px">No approved builds yet</div>'; return; }
    el.innerHTML = res.map(function (b) {
      var ip = b.type === 'premium', img = b.photo ? pb.files.getUrl(b, b.photo, { thumb: '60x60' }) : '';
      return '<div class="pl-item"><div class="pl-thumb">' + (img ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover">' : 'o') + '</div>' +
        '<div class="pl-info"><div class="pl-name">' + esc(b.name) + '<span class="chip ' + (ip ? 'ch-prem' : 'ch-free') + '">' + (ip ? 'PREMIUM' : 'FREE') + '</span>' + (b.featured ? '<span class="chip" style="color:var(--gold)">FEATURED</span>' : '') + '</div>' +
        '<div class="pl-meta">' + (ip ? fmtPrice(b.price) : 'FREE') + ' - ' + esc(b.cat || '--') + ' - views: ' + (b.views || 0) + '</div></div>' +
        '<div class="pl-actions">' + (CU.role === 'owner' ? '<button class="btn-feat" onclick="toggleFeatured(\'' + b.id + '\',' + b.featured + ')">' + (b.featured ? 'unfeature' : 'feature') + '</button>' : '') +
        '<button class="btn-del" onclick="deleteBuild(\'' + b.id + '\')">del</button></div></div>';
    }).join('');
  } catch (e) { el.innerHTML = '<div class="empty-state" style="padding:20px">Could not load builds.</div>'; }
}

async function filterAdminBuilds(q) {
  var el = document.getElementById('buildPanelList'); if (!el) return;
  try {
    var filter = 'status="approved"';
    if (q) filter += '&&(name~"' + q.replace(/"/g, '') + '"||cat~"' + q.replace(/"/g, '') + '")';
    var res = await pb.collection('builds').getFullList({ filter: filter, sort: '-created' });
    if (!res.length) { el.innerHTML = '<div class="empty-state" style="padding:18px">No results</div>'; return; }
    el.innerHTML = res.map(function (b) {
      var ip = b.type === 'premium', img = b.photo ? pb.files.getUrl(b, b.photo, { thumb: '60x60' }) : '';
      return '<div class="pl-item"><div class="pl-thumb">' + (img ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover">' : 'o') + '</div>' +
        '<div class="pl-info"><div class="pl-name">' + esc(b.name) + '</div><div class="pl-meta">' + (ip ? fmtPrice(b.price) : 'FREE') + '</div></div>' +
        '<div class="pl-actions">' + (CU.role === 'owner' ? '<button class="btn-feat" onclick="toggleFeatured(\'' + b.id + '\',' + b.featured + ')">' + (b.featured ? 'unfeature' : 'feature') + '</button>' : '') +
        '<button class="btn-del" onclick="deleteBuild(\'' + b.id + '\')">del</button></div></div>';
    }).join('');
  } catch (e) {}
}

async function renderPendingPanel() {
  if (CU.role !== 'owner') return;
  var el = document.getElementById('pendingList'), badge = document.getElementById('pendBadge'); if (!el) return;
  try {
    var res = await pb.collection('builds').getFullList({ filter: 'status="pending"', sort: 'created' });
    if (badge) badge.textContent = res.length;
    if (!res.length) { el.innerHTML = '<div class="empty-state" style="padding:14px">No pending builds</div>'; return; }
    el.innerHTML = res.map(function (b) {
      var img = b.photo ? pb.files.getUrl(b, b.photo, { thumb: '60x60' }) : '';
      return '<div class="pl-item"><div class="pl-thumb">' + (img ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover">' : 'o') + '</div>' +
        '<div class="pl-info"><div class="pl-name">' + esc(b.name) + '<span class="chip ch-pending">PENDING</span></div>' +
        '<div class="pl-meta">By: ' + esc(b.submitter_name || '--') + ' - ' + (b.type === 'premium' ? fmtPrice(b.price) : 'FREE') + ' - <a href="' + esc(b.link || '#') + '" target="_blank" style="color:var(--a)">Preview</a></div></div>' +
        '<div class="pl-actions"><button class="btn-approve" onclick="approveBuild(\'' + b.id + '\')">APPROVE</button><button class="btn-del" onclick="rejectBuild(\'' + b.id + '\')">REJECT</button></div></div>';
    }).join('');
  } catch (e) {}
}

async function deleteBuild(id) {
  if (!confirm('Delete this build?')) return;
  try { await pb.collection('builds').delete(id); } catch (e) {}
  renderBuildPanel(); updateHomeStats(); refreshAdminStats(); toast('Deleted.', 'info');
}

async function toggleFeatured(id, current) {
  if (CU.role !== 'owner') return;
  try { await pb.collection('builds').update(id, { featured: !current }); } catch (e) {}
  renderBuildPanel(); toast(!current ? 'Featured!' : 'Removed.', 'info');
}

async function approveBuild(id) {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  try { await pb.collection('builds').update(id, { status: 'approved' }); } catch (e) {}
  renderBuildPanel(); updateHomeStats(); refreshAdminStats(); toast('Approved!', 'ok');
}

async function rejectBuild(id) {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  if (!confirm('Reject and delete?')) return;
  try { await pb.collection('builds').delete(id); } catch (e) {}
  renderBuildPanel(); refreshAdminStats(); toast('Rejected.', 'info');
}

async function renderUserPanel() {
  if (CU.role !== 'owner') return;
  var grid = document.getElementById('userCardsGrid'); if (!grid) return;
  try {
    var res = await pb.collection('users').getFullList({ sort: 'created' });
    grid.innerHTML = res.map(function (u) {
      return '<div class="ucrd"><div class="ucrd-top"><div class="ucrd-av ' + (u.role || 'user') + '">' + (u.username || '?')[0].toUpperCase() + '</div>' +
        '<div><div class="ucrd-name">' + esc(u.username) + '<span class="chip ch-' + (u.role || 'user') + '">' + (u.role || 'user').toUpperCase() + '</span></div>' +
        '<div class="ucrd-email">' + esc(u.email) + '</div></div></div>' +
        '<div class="ucrd-btns">' + (u.id !== CU.id ? '<button class="btn-ucrd-del" onclick="deleteUser(\'' + u.id + '\')">DELETE</button>' : '') + '</div></div>';
    }).join('');
  } catch (e) {}
}

async function deleteUser(uid) {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  if (!confirm('Delete this user?')) return;
  try { await pb.collection('users').delete(uid); } catch (e) {}
  renderUserPanel(); refreshAdminStats(); toast('User deleted.', 'info');
}

async function doBanIp() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var ip = document.getElementById('banIpIn').value.trim(), rsn = document.getElementById('banRsnIn').value.trim();
  if (!ip) { toast('Enter an identifier.', 'err'); return; }
  try { await pb.collection('bans').create({ ip: ip, reason: rsn || 'Violated rules', bannedBy: CU.username }); } catch (e) {}
  document.getElementById('banIpIn').value = ''; document.getElementById('banRsnIn').value = '';
  renderBanPanel(); refreshAdminStats(); toast(ip + ' banned.', 'ok');
}

async function unbanIp(id) {
  if (!confirm('Unban?')) return;
  try { await pb.collection('bans').delete(id); } catch (e) {}
  renderBanPanel(); refreshAdminStats(); toast('Unbanned.', 'ok');
}

async function renderBanPanel() {
  if (CU.role !== 'owner') return;
  var el = document.getElementById('banPanelList'); if (!el) return;
  try {
    var res = await pb.collection('bans').getFullList({ sort: '-created' });
    if (!res.length) { el.innerHTML = '<div class="empty-state" style="padding:18px">No bans</div>'; return; }
    el.innerHTML = res.map(function (b) {
      return '<div class="pl-item"><div class="pl-thumb">X</div><div class="pl-info"><div class="pl-name" style="color:var(--r)">' + esc(b.ip) + '</div><div class="pl-meta">Reason: ' + esc(b.reason) + ' - By: ' + esc(b.bannedBy) + '</div></div><div class="pl-actions"><button class="btn-unban" onclick="unbanIp(\'' + b.id + '\')">UNBAN</button></div></div>';
    }).join('');
  } catch (e) {}
}

function doResetPassword() {
  toast('Go to PocketBase dashboard > Collections > users to reset passwords.', 'info');
}

async function generateStaffCode() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = 'STAFF-';
  for (var i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (var j = 0; j < 4; j++) code += chars[Math.floor(Math.random() * chars.length)];
  try { await pb.collection('staffCodes').create({ code: code, used: false, createdBy: CU.username }); } catch (e) {}
  var box = document.getElementById('genCodeBox'), val = document.getElementById('genCodeVal');
  if (box) box.style.display = 'block'; if (val) val.textContent = code;
  renderCodesPanel(); toast('Code: ' + code, 'ok');
}

async function revokeCode(id) {
  if (!confirm('Revoke this code?')) return;
  try { await pb.collection('staffCodes').delete(id); } catch (e) {}
  renderCodesPanel(); toast('Revoked.', 'info');
}

async function renderCodesPanel() {
  if (CU.role !== 'owner') return;
  var el = document.getElementById('staffCodeList'); if (!el) return;
  try {
    var res = await pb.collection('staffCodes').getFullList({ sort: '-created' });
    if (!res.length) { el.innerHTML = '<div class="empty-state" style="padding:14px">No codes yet.</div>'; return; }
    el.innerHTML = res.map(function (c) {
      return '<div class="code-row"><div class="cr-code">' + esc(c.code) + '</div><span class="chip ' + (c.used ? 'ch-used' : 'ch-active') + '">' + (c.used ? 'USED' : 'ACTIVE') + '</span>' +
        (c.used ? '<span style="font-family:var(--fm);font-size:.58rem;color:var(--t2)">by ' + esc(c.usedBy || '?') + '</span>' : '<button class="btn-revoke" onclick="revokeCode(\'' + c.id + '\')">REVOKE</button>') + '</div>';
    }).join('');
  } catch (e) {}
}

async function exportData() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  try {
    var results = await Promise.all([pb.collection('builds').getFullList(), pb.collection('users').getFullList(), pb.collection('bans').getFullList()]);
    var data = { exportedAt: new Date().toISOString(), builds: results[0], users: results[1].map(function (u) { return Object.assign({}, u, { password: '[HIDDEN]' }); }), bans: results[2] };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'oxyx-export-' + Date.now() + '.json'; a.click(); URL.revokeObjectURL(url);
    toast('Exported!', 'ok');
  } catch (e) { toast('Export failed.', 'err'); }
}

async function clearAllBuilds() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  if (!confirm('Delete ALL builds permanently?')) return;
  try {
    var res = await pb.collection('builds').getFullList();
    await Promise.all(res.map(function (b) { return pb.collection('builds').delete(b.id); }));
    renderBuildPanel(); updateHomeStats(); refreshAdminStats(); toast('All builds cleared.', 'warn');
  } catch (e) { toast('Failed.', 'err'); }
}

/* ============================================================
   FAQ
   ============================================================ */
function toggleFaq(el) {
  var isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function (x) { x.classList.remove('open'); });
  if (!isOpen) el.classList.add('open');
}

/* ============================================================
   DRAG & DROP
   ============================================================ */
['buildDropZone', 'photoDropZone'].forEach(function (id) {
  var zone = document.getElementById(id); if (!zone) return;
  zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = 'var(--a)'; });
  zone.addEventListener('dragleave', function () { zone.style.borderColor = ''; });
  zone.addEventListener('drop', function (e) {
    e.preventDefault(); zone.style.borderColor = '';
    var file = e.dataTransfer.files[0]; if (!file) return;
    if (id === 'buildDropZone') handleBuildFile({ files: [file] });
    else handlePhotoFile({ files: [file] });
  });
});

/* ============================================================
   KEYBOARD
   ============================================================ */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { closeModal(); closeSearch(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
});

/* ============================================================
   INIT
   ============================================================ */
runLoader(async function () {
  document.getElementById('screenAuth').style.display = 'flex';
  initCursor();
  var loggedIn = await tryAutoLogin();
  if (loggedIn) launchApp();
});
