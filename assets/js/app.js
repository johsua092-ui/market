/* ════════════════════════════════════════════════════════════════
   OXYX STORE — app.js  v4  (1500+ lines)
   ════════════════════════════════════════════════════════════════
   FEATURES:
     ★ Live online counter (navbar + hero + owner panel)
     ★ Owner-ONLY panel — stat cards, admin clock, alert box
     ★ Redesigned Live IP tab — visitor feed, device breakdown,
         activity log, quick-ban from table
     ★ User cards grid view with online/offline status
     ★ Global search overlay (Ctrl+K)
     ★ Announcement ticker (owner sets from panel)
     ★ Scroll-reveal animations (IntersectionObserver)
     ★ Back-to-top button
     ★ Recently added builds on home
     ★ "Why OXYX" section on home
     ★ Wishlist / save builds (heart button)
     ★ View count tracking per build
     ★ Build reactions (👍 🔥 ⭐)
     ★ Notification system (bell icon, dropdown)
     ★ Recently viewed builds sidebar
     ★ Admin: build search / filter
     ★ Admin: featured toggle (⭐)
     ★ Admin: JSON data export
     ★ Admin: clear all builds
     ★ Admin: announcement tools
     ★ Profile page for logged-in user
     ★ Device detection in sessions
     ★ Password strength indicator
     ★ Keyboard shortcuts
   ════════════════════════════════════════════════════════════════ */
'use strict';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const SESSION_TTL   = 90000;   // 90s = offline
const PING_MS       = 20000;   // ping every 20s
const LIVE_TICK     = 1000;    // countdown tick 1s
const MAX_NOTIFS    = 20;      // max notifications stored
const MAX_RECENT    = 6;       // recently viewed builds
const MAX_ACTIVITY  = 80;      // activity log entries

/* ─────────────────────────────────────────────
   STORAGE HELPERS
───────────────────────────────────────────── */
const K = k => '_ox4_' + k;
function ls(k, d) {
  try { const v = localStorage.getItem(K(k)); return v != null ? JSON.parse(v) : d; }
  catch { return d; }
}
function ss(k, v) {
  try { localStorage.setItem(K(k), JSON.stringify(v)); } catch {}
}

/* ─────────────────────────────────────────────
   PASSWORD HASH  (djb2 + fnv double pass)
───────────────────────────────────────────── */
function hashPw(pw) {
  const salt = 'OXYX_STORE_SECURE_2024';
  const str  = salt + pw + salt.split('').reverse().join('');
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) ^ str.charCodeAt(i); h = h >>> 0; }
  let h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h2 ^= str.charCodeAt(i); h2 = (h2 * 0x01000193) >>> 0; }
  return h.toString(36) + h2.toString(36);
}

/* ─────────────────────────────────────────────
   PASSWORD STRENGTH
───────────────────────────────────────────── */
function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw))   score++;
  if (/[0-9]/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Very Weak',  color: '#ff2d55' },
    { label: 'Weak',       color: '#ff6b2d' },
    { label: 'Fair',       color: '#ffc432' },
    { label: 'Good',       color: '#00c8ff' },
    { label: 'Strong',     color: '#00ff88' },
    { label: 'Very Strong',color: '#00ffd5' },
  ];
  return { score, ...levels[Math.min(score, 5)] };
}

/* ─────────────────────────────────────────────
   SEED DEFAULT DATA
───────────────────────────────────────────── */
function seed() {
  if (ls('seeded4', false)) return;
  ss('users', [{
    id: 'own001', username: 'owner', email: 'owner@oxyx.store',
    pwHash: hashPw('29u39ShSSSSUA'), role: 'owner', createdAt: Date.now() - 9e6,
    bio: 'OXYX Store Administrator', avatar: '👑'
  }]);
  ss('builds',       []);
  ss('bans',         []);
  ss('sessions',     {});
  ss('staffCodes',   []);
  ss('actLog',       []);
  ss('announcement', '');
  ss('notifs',       []);
  ss('wishlist',     []);
  ss('recentViewed', []);
  ss('reactions',    {});
  ss('viewCounts',   {});
  ss('seeded4',      true);
}

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let CU            = null;       // Current user
let CIP           = '0.0.0.0';
let pingTimer     = null;
let liveTimer     = null;
let liveRem       = 10;
let curFilter     = 'all';
let uploadedBuild = null;
let uploadedPhoto = null;
let notifOpen     = false;

/* ─────────────────────────────────────────────
   DEVICE DETECTION
───────────────────────────────────────────── */
function getDevice() {
  const ua = navigator.userAgent.toLowerCase();
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/ipad|tablet/.test(ua))              return 'tablet';
  return 'laptop';
}
function deviceIcon(d) {
  return d === 'mobile' ? '📱' : d === 'tablet' ? '📟' : '💻';
}

/* ─────────────────────────────────────────────
   IP DETECTION
───────────────────────────────────────────── */
async function getIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.ip) CIP = d.ip;
  } catch {
    CIP = '127.' + (navigator.platform.length % 256) + '.' + (screen.width % 256) + '.1';
  }
}

/* ─────────────────────────────────────────────
   CUSTOM CURSOR
───────────────────────────────────────────── */
function initCursor() {
  const g = document.getElementById('cGlow');
  const d = document.getElementById('cDot');
  if (!g || !d) return;
  let gx = 0, gy = 0, dx = 0, dy = 0;
  document.addEventListener('mousemove', e => {
    dx = e.clientX; dy = e.clientY;
    d.style.left = dx + 'px'; d.style.top = dy + 'px';
  });
  function animGlow() {
    gx += (dx - gx) * 0.1;
    gy += (dy - gy) * 0.1;
    g.style.left = gx + 'px'; g.style.top = gy + 'px';
    requestAnimationFrame(animGlow);
  }
  animGlow();
  // Hover effects
  const hoverEls = 'button,a,.bcard,.nl,.atab,.admin-tab-btn,.cat-card,.sc,.why-card,.ucrd,.notif-item';
  document.querySelectorAll(hoverEls).forEach(el => {
    el.addEventListener('mouseenter', () => {
      d.style.width = '14px'; d.style.height = '14px';
      d.style.background = '#fff'; d.style.boxShadow = '0 0 14px #fff';
    });
    el.addEventListener('mouseleave', () => {
      d.style.width = '7px'; d.style.height = '7px';
      d.style.background = 'var(--a)'; d.style.boxShadow = '0 0 10px var(--a),0 0 20px rgba(0,255,213,.4)';
    });
  });
}

/* ─────────────────────────────────────────────
   3D CARD TILT
───────────────────────────────────────────── */
function initTilt() {
  document.addEventListener('mousemove', e => {
    document.querySelectorAll('.bcard').forEach(card => {
      const r = card.getBoundingClientRect();
      if (e.clientX < r.left-100 || e.clientX > r.right+100 || e.clientY < r.top-100 || e.clientY > r.bottom+100) {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)'; return;
      }
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(1000px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(10px)`;
    });
  });
  document.querySelectorAll('.bcard').forEach(c => {
    c.addEventListener('mouseleave', () => {
      c.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
    });
  });
}

/* ─────────────────────────────────────────────
   NUMBER ANIMATION
───────────────────────────────────────────── */
function animNum(el, target, dur = 1000) {
  if (!el) return;
  let start = null;
  (function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(target * e);
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}

/* ─────────────────────────────────────────────
   SCROLL REVEAL
───────────────────────────────────────────── */
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ─────────────────────────────────────────────
   BACK-TO-TOP
───────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const b = document.getElementById('btnTop');
  if (b) b.classList.toggle('show', window.scrollY > 440);
  // Navbar shadow on scroll
  const nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 10);
});

/* ─────────────────────────────────────────────
   LOADING SCREEN
───────────────────────────────────────────── */
function runLoader(cb) {
  const bar  = document.getElementById('loadBar');
  const msg  = document.getElementById('loadMsg');
  const msgs = ['INITIALIZING SYSTEM...', 'LOADING ASSETS...', 'FETCHING IP ADDRESS...',
                'CHECKING SESSION...', 'VERIFYING SECURITY...', 'SYSTEM READY ✓'];
  let p = 0, step = 0;
  const iv = setInterval(() => {
    p = Math.min(p + Math.random() * 12 + 6, 100);
    if (bar) bar.style.width = p + '%';
    if (p > step * 20 && step < msgs.length && msg) msg.textContent = msgs[step++];
    if (p >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        const el = document.getElementById('screenLoad');
        if (el) el.classList.add('out');
        setTimeout(cb, 700);
      }, 400);
    }
  }, 130);
}

/* ─────────────────────────────────────────────
   BAN CHECK
───────────────────────────────────────────── */
function checkBanned() { return ls('bans', []).some(b => b.ip === CIP); }
function showBanned() {
  const el = document.getElementById('screenBanned'); if (!el) return;
  const ip = document.getElementById('banIpDisplay'); if (ip) ip.textContent = CIP;
  el.style.display = 'flex';
  const auth = document.getElementById('screenAuth'); if (auth) auth.style.display = 'none';
  const app  = document.getElementById('mainApp');   if (app)  app.style.display  = 'none';
}

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */
function switchTab(t) {
  document.getElementById('tabL').classList.toggle('active', t === 'login');
  document.getElementById('tabR').classList.toggle('active', t === 'register');
  document.getElementById('fLogin').classList.toggle('active', t === 'login');
  document.getElementById('fReg').classList.toggle('active', t === 'register');
  ['lErr', 'rErr'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function toggleEye(id, btn) {
  const el = document.getElementById(id); if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// Password strength meter in register form
function onPwInput(val) {
  const st = pwStrength(val);
  const bar = document.getElementById('pwStrBar');
  const lbl = document.getElementById('pwStrLbl');
  if (!bar || !lbl) return;
  bar.style.width  = (st.score / 5 * 100) + '%';
  bar.style.background = st.color;
  lbl.textContent  = st.label;
  lbl.style.color  = st.color;
}

function doLogin() {
  const u     = document.getElementById('lU').value.trim().toLowerCase();
  const p     = document.getElementById('lP').value;
  const errEl = document.getElementById('lErr');
  if (!u || !p) { errEl.textContent = '⚠ Please fill in all fields.'; return; }
  const users = ls('users', []);
  const user  = users.find(x => x.username.toLowerCase() === u);
  if (!user)              { errEl.textContent = '✕ Username not found.';   return; }
  if (user.pwHash !== hashPw(p)) { errEl.textContent = '✕ Incorrect password.'; return; }
  // Single-session enforcement for owner/staff
  if (user.role === 'owner' || user.role === 'staff') {
    const sess = ls('sessions', {}), ex = sess[user.id];
    if (ex && ex.ip && ex.ip !== CIP && (Date.now() - ex.lastPing) < SESSION_TTL * 2) {
      errEl.textContent = `🔒 Account active from another IP (${ex.ip}).`; return;
    }
  }
  recordSession(user.id, user.username, user.role);
  CU = user;
  ss('activeSession', { id: user.id });
  logAct('join', `<em>${esc(user.username)}</em> logged in`);
  pushNotif(`Welcome back, ${user.username}! 👋`, 'info');
  launchApp();
}

function doRegister() {
  const u     = document.getElementById('rU').value.trim().toLowerCase();
  const e     = document.getElementById('rE').value.trim();
  const p     = document.getElementById('rP').value;
  const code  = document.getElementById('rC').value.trim().toUpperCase();
  const errEl = document.getElementById('rErr');
  if (!u || !e || !p)                              { errEl.textContent = '⚠ Fill in all required fields.';       return; }
  if (u.length < 3)                                { errEl.textContent = '⚠ Username min 3 characters.';         return; }
  if (p.length < 6)                                { errEl.textContent = '⚠ Password min 6 characters.';         return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))      { errEl.textContent = '⚠ Invalid email format.';              return; }
  if (!/^[a-z0-9_\.]+$/.test(u))                  { errEl.textContent = '⚠ Username: letters, numbers, _ only.'; return; }
  const users = ls('users', []);
  if (users.find(x => x.username.toLowerCase() === u)) { errEl.textContent = '✕ Username already taken.';   return; }
  if (users.find(x => x.email.toLowerCase() === e.toLowerCase())) { errEl.textContent = '✕ Email already registered.'; return; }
  let role = 'user';
  if (code) {
    const staffCodes = ls('staffCodes', []);
    const ce = staffCodes.find(c => c.code === code && !c.used);
    if (!ce)                                          { errEl.textContent = '✕ Invalid or used staff code.'; return; }
    if (users.filter(x => x.role === 'staff').length >= 2) { errEl.textContent = '✕ Staff slots full (max 2).'; return; }
    role = 'staff';
    ce.used = true; ce.usedBy = u; ce.usedAt = Date.now();
    ss('staffCodes', staffCodes);
  }
  users.push({ id: 'u' + Date.now(), username: u, email: e, pwHash: hashPw(p),
    role, createdAt: Date.now(), bio: '', avatar: '' });
  ss('users', users);
  toast('✓ Account created! Please log in.', 'ok');
  switchTab('login');
  document.getElementById('lU').value = u;
}

function doLogout() {
  if (CU) clearSession(CU.id);
  clearInterval(pingTimer);
  stopLiveTimer();
  clearInterval(window._clkT);
  CU = null; ss('activeSession', null);
  document.getElementById('mainApp').style.display    = 'none';
  document.getElementById('screenAuth').style.display = 'flex';
  if (typeof initAuthCanvas === 'function') initAuthCanvas();
  toast('Logged out successfully.', 'info');
}

/* ─────────────────────────────────────────────
   SESSIONS
───────────────────────────────────────────── */
function recordSession(uid, username, role) {
  const sess = ls('sessions', {}), ex = sess[uid] || {};
  sess[uid] = {
    uid, username, role, ip: CIP, lastPing: Date.now(),
    online: true, device: getDevice(), joinedAt: ex.joinedAt || Date.now()
  };
  ss('sessions', sess);
}
function pingSession() {
  if (!CU) return;
  const sess = ls('sessions', {});
  if (sess[CU.id]) {
    sess[CU.id].lastPing = Date.now(); sess[CU.id].online = true; sess[CU.id].ip = CIP;
    ss('sessions', sess);
  }
}
function clearSession(uid) {
  const sess = ls('sessions', {});
  if (sess[uid]) { sess[uid].online = false; sess[uid].lastPing = 0; }
  ss('sessions', sess);
}
function startPing() { clearInterval(pingTimer); pingSession(); pingTimer = setInterval(pingSession, PING_MS); }

/* ─────────────────────────────────────────────
   LIVE COUNTER  (syncs all live number elements)
───────────────────────────────────────────── */
function syncLive() {
  const sess  = ls('sessions', {});
  const cnt   = Object.values(sess).filter(r => (Date.now() - r.lastPing) < SESSION_TTL).length;
  ['navOnlineNum', 'hsOnline', 'panelOnlineCount', 'scOnline'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = cnt;
  });
}

/* ─────────────────────────────────────────────
   ACTIVITY LOG
───────────────────────────────────────────── */
function logAct(type, msg) {
  const log = ls('actLog', []);
  log.unshift({ type, msg, ts: Date.now() });
  if (log.length > MAX_ACTIVITY) log.pop();
  ss('actLog', log);
}

/* ─────────────────────────────────────────────
   NOTIFICATIONS
───────────────────────────────────────────── */
function pushNotif(msg, type = 'info') {
  const notifs = ls('notifs', []);
  notifs.unshift({ id: 'n' + Date.now(), msg, type, read: false, ts: Date.now() });
  if (notifs.length > MAX_NOTIFS) notifs.pop();
  ss('notifs', notifs);
  updateNotifBadge();
}
function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  const unread = ls('notifs', []).filter(n => !n.read).length;
  if (badge) { badge.textContent = unread; badge.style.display = unread ? 'flex' : 'none'; }
}
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  notifOpen = !notifOpen;
  panel.style.display = notifOpen ? 'block' : 'none';
  if (notifOpen) renderNotifPanel();
}
function renderNotifPanel() {
  const el = document.getElementById('notifList'); if (!el) return;
  const notifs = ls('notifs', []);
  if (!notifs.length) { el.innerHTML = '<div class="notif-empty">No notifications</div>'; return; }
  el.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="readNotif('${n.id}')">
      <div class="ni-dot ni-${n.type}"></div>
      <div class="ni-body"><div class="ni-msg">${esc(n.msg)}</div><div class="ni-tm">${timeAgo(n.ts)}</div></div>
    </div>`).join('');
  // Mark all as read
  const notifs2 = ls('notifs', []);
  notifs2.forEach(n => n.read = true);
  ss('notifs', notifs2);
  updateNotifBadge();
}
function readNotif(id) {
  const notifs = ls('notifs', []);
  const i = notifs.findIndex(n => n.id === id); if (i < 0) return;
  notifs[i].read = true; ss('notifs', notifs); updateNotifBadge();
}
function clearAllNotifs() {
  ss('notifs', []); renderNotifPanel(); updateNotifBadge();
}
// Close notif panel when clicking outside
document.addEventListener('click', e => {
  const panel = document.getElementById('notifPanel');
  const btn   = document.getElementById('notifBtn');
  if (panel && notifOpen && !panel.contains(e.target) && (!btn || !btn.contains(e.target))) {
    panel.style.display = 'none'; notifOpen = false;
  }
});

/* ─────────────────────────────────────────────
   WISHLIST
───────────────────────────────────────────── */
function toggleWishlist(id, e) {
  e.stopPropagation();
  const wl = ls('wishlist', []);
  const i  = wl.indexOf(id);
  if (i > -1) { wl.splice(i, 1); toast('Removed from wishlist.', 'info'); }
  else { wl.push(id); toast('❤ Added to wishlist!', 'ok'); pushNotif('Build saved to wishlist!', 'ok'); }
  ss('wishlist', wl);
  // Update button icon
  document.querySelectorAll(`.wl-btn[data-id="${id}"]`).forEach(btn => {
    btn.textContent = wl.includes(id) ? '❤' : '♡';
    btn.style.color = wl.includes(id) ? 'var(--r)' : '';
  });
}
function isWishlisted(id) { return ls('wishlist', []).includes(id); }

/* ─────────────────────────────────────────────
   VIEW COUNTS
───────────────────────────────────────────── */
function incrementView(id) {
  const vc = ls('viewCounts', {});
  vc[id] = (vc[id] || 0) + 1;
  ss('viewCounts', vc);
}
function getViews(id) { return ls('viewCounts', {})[id] || 0; }

/* ─────────────────────────────────────────────
   REACTIONS  (👍 🔥 ⭐)
───────────────────────────────────────────── */
function toggleReaction(buildId, emoji, e) {
  e.stopPropagation();
  const key = CU ? CU.id : 'anon';
  const rx  = ls('reactions', {});
  if (!rx[buildId]) rx[buildId] = {};
  const cur = rx[buildId][key];
  if (cur === emoji) { delete rx[buildId][key]; }
  else { rx[buildId][key] = emoji; }
  ss('reactions', rx);
  // Re-render reaction row if modal open
  const rrow = document.getElementById('rxRow_' + buildId);
  if (rrow) rrow.innerHTML = renderReactionHTML(buildId);
}
function getReactionCounts(buildId) {
  const rx = ls('reactions', {})[buildId] || {};
  const counts = {};
  Object.values(rx).forEach(em => { counts[em] = (counts[em] || 0) + 1; });
  return counts;
}
function renderReactionHTML(buildId) {
  const counts = getReactionCounts(buildId);
  const userRx = CU ? (ls('reactions', {})[buildId] || {})[CU.id] : null;
  return ['👍', '🔥', '⭐'].map(em => {
    const cnt = counts[em] || 0;
    const active = userRx === em;
    return `<button class="rx-btn${active ? ' rx-active' : ''}"
      onclick="toggleReaction('${buildId}','${em}',event)">
      ${em} <span>${cnt || ''}</span>
    </button>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   RECENTLY VIEWED
───────────────────────────────────────────── */
function pushRecentViewed(id) {
  const rv = ls('recentViewed', []).filter(x => x !== id);
  rv.unshift(id);
  if (rv.length > MAX_RECENT) rv.pop();
  ss('recentViewed', rv);
}

/* ─────────────────────────────────────────────
   AUTO LOGIN
───────────────────────────────────────────── */
function tryAutoLogin() {
  const saved = ls('activeSession', null); if (!saved) return false;
  const users = ls('users', []);
  const u     = users.find(x => x.id === saved.id); if (!u) return false;
  if (u.role === 'owner' || u.role === 'staff') {
    const sess = ls('sessions', {}), ex = sess[u.id];
    if (ex && ex.ip && ex.ip !== CIP && (Date.now() - ex.lastPing) < SESSION_TTL * 2) {
      ss('activeSession', null); return false;
    }
  }
  CU = u; recordSession(u.id, u.username, u.role); launchApp(); return true;
}

/* ─────────────────────────────────────────────
   LAUNCH APP
───────────────────────────────────────────── */
function launchApp() {
  document.getElementById('screenAuth').style.display = 'none';
  document.getElementById('mainApp').style.display    = 'block';
  // Navbar user info
  const nm = document.getElementById('nbNm');
  const av = document.getElementById('nbAv');
  const rc = document.getElementById('nbRc');
  if (nm) nm.textContent = CU.username;
  if (av) av.textContent = (CU.avatar || CU.username[0]).toUpperCase();
  if (rc) { rc.textContent = CU.role.toUpperCase(); rc.className = 'nb-role-chip ' + CU.role; }
  // Show/hide nav links
  const adminLink = document.getElementById('nl-admin');
  if (adminLink) adminLink.style.display = (CU.role === 'owner' || CU.role === 'staff') ? 'inline' : 'none';
  const profileLink = document.getElementById('nl-profile');
  if (profileLink) profileLink.style.display = 'inline';
  startPing();
  syncLive();
  setInterval(syncLive, PING_MS);
  updateNotifBadge();
  applyTicker();
  goTo('home');
  updateHomeStats();
  setTimeout(initReveal, 200);
}

/* ─────────────────────────────────────────────
   ANNOUNCEMENT TICKER
───────────────────────────────────────────── */
function applyTicker() {
  const msg  = ls('announcement', '');
  const wrap = document.getElementById('tickerWrap');
  const txt  = document.getElementById('tickerText');
  if (msg && wrap && txt) {
    txt.textContent = msg + '  ·  ' + msg + '  ·  ' + msg;
    wrap.style.display = 'flex';
  } else if (wrap) {
    wrap.style.display = 'none';
  }
}
function saveAnnouncement() {
  if (CU.role !== 'owner') { toast('✕ Owner only.', 'err'); return; }
  const v = document.getElementById('announceInput').value.trim();
  ss('announcement', v); applyTicker();
  toast(v ? '✓ Announcement published!' : 'Announcement cleared.', v ? 'ok' : 'info');
}
function clearAnnouncement() {
  if (CU.role !== 'owner') { toast('✕ Owner only.', 'err'); return; }
  ss('announcement', ''); applyTicker();
  const inp = document.getElementById('announceInput'); if (inp) inp.value = '';
  toast('Announcement cleared.', 'info');
}

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function goTo(page) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nl').forEach(l => l.classList.remove('active'));
  const sec  = document.getElementById('sec-' + page);
  const link = document.getElementById('nl-' + page);
  if (sec)  sec.classList.add('active');
  if (link) link.classList.add('active');
  document.getElementById('nbLinks').classList.remove('open');
  // Page-specific init
  if (page === 'home') {
    renderGrid('featGrid',   null, 'all', true, false);
    renderGrid('recentGrid', null, 'all', false, true);
    updateHomeStats();
  }
  if (page === 'store')   renderGrid('storeGrid',  null, curFilter);
  if (page === 'premium') renderGrid('premGrid',   'premium');
  if (page === 'free')    renderGrid('freeGrid',   'free');
  if (page === 'submit')  renderMyPending();
  if (page === 'admin')   initAdminPanel();
  if (page === 'profile') renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(initReveal, 100);
}
function toggleNav() { document.getElementById('nbLinks').classList.toggle('open'); }

/* ─────────────────────────────────────────────
   HOME STATS
───────────────────────────────────────────── */
function updateHomeStats() {
  const builds = ls('builds', []).filter(b => b.status === 'approved');
  const users  = ls('users',  []);
  const prem   = builds.filter(b => b.type === 'premium').length;
  const free   = builds.filter(b => b.type === 'free').length;
  animNum(document.getElementById('hsB'),  builds.length);
  animNum(document.getElementById('hsP'),  prem);
  animNum(document.getElementById('hsF'),  free);
  animNum(document.getElementById('hsU'),  users.length);
  animNum(document.getElementById('authStatB'), builds.length);
  animNum(document.getElementById('authStatU'), users.length);
  const cp = document.getElementById('ccPrem'); if (cp) cp.textContent = prem + ' builds';
  const cf = document.getElementById('ccFree'); if (cf) cf.textContent = free + ' builds';
}

/* ─────────────────────────────────────────────
   SEARCH OVERLAY
───────────────────────────────────────────── */
function openSearch() {
  const ov = document.getElementById('searchOverlay'); if (!ov) return;
  ov.classList.add('open');
  setTimeout(() => {
    const inp = document.getElementById('srchInput');
    if (inp) { inp.focus(); inp.value = ''; }
    const res = document.getElementById('srchResults'); if (res) res.innerHTML = '';
  }, 50);
}
function closeSearch() {
  const ov = document.getElementById('searchOverlay'); if (ov) ov.classList.remove('open');
}
function doSearch(q) {
  const res = document.getElementById('srchResults'); if (!res) return;
  if (!q.trim()) { res.innerHTML = ''; return; }
  const ql = q.toLowerCase();
  const matched = ls('builds', []).filter(b =>
    b.status === 'approved' && (
      b.name.toLowerCase().includes(ql) ||
      (b.cat  || '').toLowerCase().includes(ql) ||
      (b.desc || '').toLowerCase().includes(ql)
    )
  ).slice(0, 8);
  if (!matched.length) {
    res.innerHTML = `<div class="sri-empty">No builds found for "<em>${esc(q)}</em>"</div>`;
    return;
  }
  res.innerHTML = matched.map(b => {
    const ip = b.type === 'premium';
    const pr = ip ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE';
    return `<div class="sri" onclick="closeSearch();openModal('${b.id}')">
      <div class="sri-thumb">${b.photoData ? `<img src="${b.photoData}" alt="">` : (b.icon || '◈')}</div>
      <div><div class="sri-name">${esc(b.name)}</div><div class="sri-meta">${esc(b.cat || '—')} · ${pr} · ${getViews(b.id)} views</div></div>
      <span class="sri-badge ${ip ? 'sri-p' : 'sri-f'}">${ip ? '♛ PREM' : '✦ FREE'}</span>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   BUILD GRIDS
───────────────────────────────────────────── */
function renderGrid(cid, typeFilter, filterMode, featOnly, recentOnly) {
  const el = document.getElementById(cid); if (!el) return;
  let builds = ls('builds', []).filter(b => b.status === 'approved');
  if (typeFilter)  builds = builds.filter(b => b.type === typeFilter);
  if (filterMode && filterMode !== 'all') builds = builds.filter(b => b.type === filterMode);
  if (featOnly)    builds = builds.filter(b => b.featured).slice(0, 6);
  if (recentOnly)  builds = [...builds].sort((a, c) => c.createdAt - a.createdAt).slice(0, 4);
  if (!builds.length) {
    el.innerHTML = `<div class="empty-state"><span class="es-icon">◎</span>NO BUILDS AVAILABLE YET</div>`;
    return;
  }
  el.innerHTML = builds.map(buildCardHTML).join('');
  setTimeout(initTilt, 100);
}

function buildCardHTML(b) {
  const ip = b.type === 'premium';
  const pr = ip ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE';
  const thumb = b.photoData
    ? `<img class="bc-photo" src="${b.photoData}" alt="${esc(b.name)}">`
    : `<span class="bc-icon">◈</span>`;
  const wl = isWishlisted(b.id);
  return `<div class="bcard" onclick="openModal('${b.id}')">
    <div class="bc-thumb">
      <div class="bc-thumb-glow"></div>${thumb}
      <span class="bc-badge ${ip ? 'bp' : 'bf'}">${ip ? '♛ PREMIUM' : '✦ FREE'}</span>
      <button class="wl-btn" data-id="${b.id}" onclick="toggleWishlist('${b.id}',event)"
        style="color:${wl ? 'var(--r)' : ''}">${wl ? '❤' : '♡'}</button>
    </div>
    <div class="bc-body">
      <div class="bc-top-row">
        <div class="bc-cat">${esc(b.cat || '—')}</div>
        <div class="bc-views">👁 ${getViews(b.id)}</div>
      </div>
      <div class="bc-name">${esc(b.name)}</div>
      <div class="bc-desc">${esc(b.desc)}</div>
      <div class="bc-foot">
        <span class="bc-price ${ip ? 'pp' : 'fp'}">${pr}</span>
        <button class="btn-view">VIEW →</button>
      </div>
    </div>
  </div>`;
}

function applyFilter(type, btn, gridId) {
  curFilter = type;
  document.querySelectorAll('.flt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid(gridId, null, type);
}

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
function openModal(id) {
  const b = ls('builds', []).find(x => x.id === id); if (!b) return;
  incrementView(id);
  pushRecentViewed(id);
  logAct('view', `<em>${esc(CU.username)}</em> viewed <em>${esc(b.name)}</em>`);
  const ip = b.type === 'premium';
  const pr = ip ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE';
  const wl = isWishlisted(id);
  document.getElementById('modalContent').innerHTML = `
    ${b.photoData ? `<img class="mod-photo" src="${b.photoData}" alt="${esc(b.name)}">` : ''}
    <div class="mod-top-row">
      <span class="mod-badge ${ip ? 'prem' : 'free'}">${ip ? '♛ PREMIUM' : '✦ FREE'}</span>
      <div class="mod-actions-row">
        <button class="wl-btn-lg wl-btn" data-id="${id}" onclick="toggleWishlist('${id}',event)"
          style="color:${wl ? 'var(--r)' : ''}">${wl ? '❤ Saved' : '♡ Save'}</button>
      </div>
    </div>
    <div class="mod-title">${esc(b.name)}</div>
    <div class="mod-meta">
      ${esc(b.cat)} ${b.submitter && b.submitter !== 'owner' ? `· By <strong>${esc(b.submitter)}</strong>` : ''}
      · 👁 ${getViews(id)} views
    </div>
    <div class="mod-desc">${esc(b.desc)}</div>
    ${b.contact ? `<div class="mod-contact">📞 Seller: <strong>${esc(b.contact)}</strong></div>` : ''}
    ${b.buildFileName ? `<div class="mod-file-info">📦 File: <strong>${esc(b.buildFileName)}</strong></div>` : ''}
    <div class="mod-price-row">
      <div class="mod-price ${ip ? 'pp' : 'fp'}">${pr}</div>
    </div>
    <!-- Reactions -->
    <div class="rx-row" id="rxRow_${id}">${renderReactionHTML(id)}</div>
    ${ip
      ? `<button class="btn-modal-action bma-buy" onclick="handleBuy('${b.id}')">💳 BUY NOW</button>`
      : `${b.buildFileName ? `<button class="btn-modal-action bma-dl" onclick="handleDL('${b.id}')">⬇ DOWNLOAD .BUILD FILE</button>` : ''}
         <a href="${esc(b.link || '#')}" target="_blank" class="btn-modal-action bma-prev">🔗 VIEW PREVIEW</a>`
    }`;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
}
function handleBuy(id) {
  const b = ls('builds', []).find(x => x.id === id);
  if (b) { logAct('view', `<em>${esc(CU.username)}</em> wants to buy <em>${esc(b.name)}</em>`); toast(`💬 Contact seller: ${b.contact || 'Contact admin for purchase'}`, 'info'); }
  closeModal();
}
function handleDL(id) {
  const b = ls('builds', []).find(x => x.id === id);
  if (!b || !b.buildFileData) { toast('⚠ Build file not available.', 'err'); return; }
  const by = atob(b.buildFileData), ab = new ArrayBuffer(by.length), ia = new Uint8Array(ab);
  for (let i = 0; i < by.length; i++) ia[i] = by.charCodeAt(i);
  const blob = new Blob([ab], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = b.buildFileName || 'build.build'; a.click();
  URL.revokeObjectURL(url);
  toast('⬇ Downloading ' + b.buildFileName, 'ok');
}

/* ─────────────────────────────────────────────
   FILE UPLOAD HANDLERS
───────────────────────────────────────────── */
function handleBuildFile(input) {
  const file = input.files[0]; if (!file) return;
  if (!file.name.toLowerCase().endsWith('.build')) { toast('✕ Only .build files accepted.', 'err'); input.value = ''; return; }
  if (file.size > 50 * 1024 * 1024) { toast('✕ File too large (max 50MB).', 'err'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    uploadedBuild = { name: file.name, data: btoa(String.fromCharCode(...new Uint8Array(e.target.result))) };
    document.getElementById('buildFileName').textContent = '✓ ' + file.name;
    document.getElementById('buildDropZone').style.borderColor = 'var(--fr)';
  };
  reader.readAsArrayBuffer(file);
}
function handlePhotoFile(input) {
  const file = input.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('✕ Only image files accepted.', 'err'); input.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { toast('✕ Image too large (max 5MB).', 'err'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    uploadedPhoto = e.target.result;
    document.getElementById('photoPreviewImg').src   = uploadedPhoto;
    document.getElementById('photoPreviewWrap').style.display = 'flex';
    const ph = document.getElementById('photoPlaceholder'); if (ph) ph.style.display = 'none';
    document.getElementById('photoDropZone').style.borderColor = 'var(--fr)';
  };
  reader.readAsDataURL(file);
}
// Drag and drop
['buildDropZone', 'photoDropZone'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById(id); if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.style.borderColor = 'var(--a)'; });
    zone.addEventListener('dragleave', ()   => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.style.borderColor = '';
      const file = e.dataTransfer.files[0]; if (!file) return;
      if (id === 'buildDropZone') handleBuildFile({ files: [file], value: '' });
      else                        handlePhotoFile({ files: [file], value: '' });
    });
  });
});

/* ─────────────────────────────────────────────
   SUBMIT BUILD
───────────────────────────────────────────── */
function submitBuild() {
  const n   = document.getElementById('sbN').value.trim();
  const t   = document.getElementById('sbT').value;
  const p   = parseInt(document.getElementById('sbP').value) || 0;
  const c   = document.getElementById('sbC').value.trim();
  const d   = document.getElementById('sbD').value.trim();
  const l   = document.getElementById('sbL').value.trim();
  const k   = document.getElementById('sbK').value.trim();
  const tos = document.getElementById('sbTos').checked;
  if (!n)              { toast('⚠ Build name is required.', 'err');   return; }
  if (!d)              { toast('⚠ Description is required.', 'err');  return; }
  if (!l)              { toast('⚠ Preview link is required.', 'err'); return; }
  if (!uploadedBuild)  { toast('⚠ Please upload a .build file.', 'err'); return; }
  if (!tos)            { toast('⚠ Please confirm originality.', 'err'); return; }
  const builds = ls('builds', []);
  builds.push({
    id: 'b' + Date.now(), name: n, type: t, price: p, cat: c, desc: d, link: l, contact: k,
    photoData: uploadedPhoto, buildFileName: uploadedBuild.name, buildFileData: uploadedBuild.data,
    submitter: CU.username, featured: false, status: 'pending', createdAt: Date.now()
  });
  ss('builds', builds);
  logAct('upload', `<em>${esc(CU.username)}</em> submitted <em>${esc(n)}</em>`);
  pushNotif(`Build "${n}" submitted! Awaiting owner review.`, 'info');
  // Reset form
  ['sbN', 'sbP', 'sbC', 'sbD', 'sbL', 'sbK'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('sbTos').checked = false;
  document.getElementById('buildFileName').textContent = '';
  document.getElementById('buildDropZone').style.borderColor  = '';
  document.getElementById('photoDropZone').style.borderColor  = '';
  document.getElementById('photoPreviewWrap').style.display   = 'none';
  document.getElementById('photoPreviewImg').src = '';
  const ph = document.getElementById('photoPlaceholder'); if (ph) ph.style.display = '';
  uploadedBuild = null; uploadedPhoto = null;
  toast('✓ Build submitted! Pending owner review.', 'ok');
  renderMyPending();
}

function renderMyPending() {
  const el = document.getElementById('myPendingList'); if (!el) return;
  const mine = ls('builds', []).filter(b => b.submitter === CU.username && b.status === 'pending');
  if (!mine.length) { el.innerHTML = '<div class="usb-empty">No pending builds.</div>'; return; }
  el.innerHTML = mine.map(b => `
    <div class="pend-item">
      <div class="pend-name">${esc(b.name)}</div>
      <div class="pend-status">⏳ Awaiting review...</div>
    </div>`).join('');
}

/* ─────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────── */
function renderProfile() {
  const el = document.getElementById('profileContent'); if (!el) return;
  const builds    = ls('builds', []).filter(b => b.submitter === CU.username && b.status === 'approved');
  const pending   = ls('builds', []).filter(b => b.submitter === CU.username && b.status === 'pending');
  const wl        = ls('wishlist', []);
  const wlBuilds  = ls('builds', []).filter(b => wl.includes(b.id) && b.status === 'approved');
  const rv        = ls('recentViewed', []);
  const rvBuilds  = rv.map(id => ls('builds', []).find(b => b.id === id)).filter(Boolean).slice(0, 4);
  el.innerHTML = `
    <div class="profile-layout">
      <!-- LEFT: Info card -->
      <div class="profile-card">
        <div class="pc-avatar">${(CU.avatar || CU.username[0]).toUpperCase()}</div>
        <div class="pc-name">${esc(CU.username)}</div>
        <div class="pc-role-chip ch-${CU.role}">${CU.role.toUpperCase()}</div>
        <div class="pc-email">${esc(CU.email)}</div>
        <div class="pc-stats">
          <div class="pc-stat"><div class="pc-sn">${builds.length}</div><div class="pc-sl">Uploads</div></div>
          <div class="pc-stat"><div class="pc-sn">${wl.length}</div><div class="pc-sl">Wishlist</div></div>
          <div class="pc-stat"><div class="pc-sn">${pending.length}</div><div class="pc-sl">Pending</div></div>
        </div>
      </div>
      <!-- RIGHT: Content -->
      <div class="profile-right">
        ${wlBuilds.length ? `
        <div class="profile-section">
          <h3 class="ps-title">❤ WISHLIST</h3>
          <div class="builds-grid">${wlBuilds.map(buildCardHTML).join('')}</div>
        </div>` : ''}
        ${rvBuilds.length ? `
        <div class="profile-section">
          <h3 class="ps-title">🕐 RECENTLY VIEWED</h3>
          <div class="builds-grid">${rvBuilds.map(buildCardHTML).join('')}</div>
        </div>` : ''}
        ${builds.length ? `
        <div class="profile-section">
          <h3 class="ps-title">📦 MY BUILDS</h3>
          <div class="builds-grid">${builds.map(buildCardHTML).join('')}</div>
        </div>` : ''}
        ${!wlBuilds.length && !rvBuilds.length && !builds.length ? `
        <div class="empty-state"><span class="es-icon">👤</span>Start by exploring and saving builds!</div>` : ''}
      </div>
    </div>`;
  setTimeout(initTilt, 100);
}

/* ════════════════════════════════════════════
   ADMIN / OWNER PANEL
   ════════════════════════════════════════════ */
function initAdminPanel() {
  const rb = document.getElementById('adminRoleBadge');
  const st = document.getElementById('adminSubText');
  const cr = document.getElementById('phCrown');
  if (rb) { rb.textContent = CU.role.toUpperCase(); rb.className = 'ph-role-badge ' + CU.role; }
  if (st) st.textContent = CU.role === 'owner' ? 'Full system access' : 'Staff — Manage Builds Only';
  if (cr) cr.style.display = CU.role === 'owner' ? 'block' : 'none';
  // Stat grid — owner only
  const sg = document.getElementById('statGrid'); if (sg) sg.style.display = CU.role === 'owner' ? 'grid' : 'none';
  startAdminClock();
  buildAdminTabs();
  refreshStatCards();
  if (CU.role === 'owner') checkOwnerAlert();
}

function startAdminClock() {
  const tick = () => {
    const el = document.getElementById('adminClock'); if (!el) return;
    el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  clearInterval(window._clkT); window._clkT = setInterval(tick, 1000);
}

function refreshStatCards() {
  if (CU.role !== 'owner') return;
  const builds  = ls('builds', []).filter(b => b.status === 'approved');
  const pending = ls('builds', []).filter(b => b.status === 'pending');
  const users   = ls('users',  []);
  const sess    = ls('sessions', {});
  const online  = Object.values(sess).filter(s => (Date.now() - s.lastPing) < SESSION_TTL).length;
  syncLive();
  animNum(document.getElementById('scOnline'),  online,            500);
  animNum(document.getElementById('scBuilds'),  builds.length,     500);
  animNum(document.getElementById('scPremium'), builds.filter(b => b.type === 'premium').length, 500);
  animNum(document.getElementById('scMembers'), users.length,      500);
  animNum(document.getElementById('scPending'), pending.length,    500);
  animNum(document.getElementById('scBanned'),  ls('bans', []).length, 500);
  const pb = document.getElementById('pendBadge'); if (pb) pb.textContent = pending.length;
}

function checkOwnerAlert() {
  const pending  = ls('builds', []).filter(b => b.status === 'pending').length;
  const alertBox = document.getElementById('ownerAlert');
  const alertMsg = document.getElementById('ownerAlertMsg');
  if (alertBox && alertMsg && pending > 0) {
    alertMsg.textContent = `${pending} build${pending > 1 ? 's' : ''} pending review — check the Builds tab.`;
    alertBox.style.display = 'flex';
  } else if (alertBox) alertBox.style.display = 'none';
}

function buildAdminTabs() {
  const nav = document.getElementById('adminTabsNav'); if (!nav) return;
  const io  = CU.role === 'owner';
  const tabs = [
    { id: 'builds',   label: '📦 BUILDS',     all: true  },
    { id: 'users',    label: '👥 USERS',       all: false },
    { id: 'live',     label: '📡 LIVE <span style="color:var(--r);animation:livePing 1.5s infinite;font-size:.7em">●</span>', all: false },
    { id: 'ban',      label: '🚫 BAN IP',      all: false },
    { id: 'pwd',      label: '🔑 RESET PWD',   all: false },
    { id: 'codes',    label: '🎫 STAFF CODES', all: false },
    { id: 'tools',    label: '📢 TOOLS',       all: false },
  ];
  nav.innerHTML = tabs.filter(t => t.all || io).map((t, i) =>
    `<button class="admin-tab-btn${i === 0 ? ' active' : ''}" onclick="switchAdminTab('${t.id}',this)">${t.label}</button>`
  ).join('');
  ['atab-users', 'atab-live', 'atab-ban', 'atab-pwd', 'atab-codes', 'atab-tools'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = io ? '' : 'none';
  });
  const ab = document.getElementById('addBuildBox');  if (ab) ab.style.display = io ? '' : 'none';
  const pb = document.getElementById('pendingBox');   if (pb) pb.style.display = io ? '' : 'none';
  document.querySelectorAll('.admc').forEach(t => t.classList.remove('active'));
  const first = document.getElementById('atab-builds'); if (first) first.classList.add('active');
  renderBuildPanel();
}

function switchAdminTab(name, btn) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admc').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const tab = document.getElementById('atab-' + name); if (tab) tab.classList.add('active');
  if (name === 'live')   { refreshLive(); startLiveTimer(); }
  if (name === 'ban')    renderBanPanel();
  if (name === 'users')  renderUserPanel();
  if (name === 'codes')  renderStaffCodesPanel();
  if (name === 'builds') renderBuildPanel();
  if (name === 'tools')  { const inp = document.getElementById('announceInput'); if (inp) inp.value = ls('announcement', '') || ''; }
  refreshStatCards();
}

/* ── BUILDS PANEL ── */
function adminAddBuild() {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  const n = document.getElementById('aN').value.trim(), t = document.getElementById('aT').value;
  const p = parseInt(document.getElementById('aP').value) || 0;
  const c = document.getElementById('aC').value.trim(), d = document.getElementById('aD').value.trim();
  const l = document.getElementById('aL').value.trim();
  if (!n || !d) { toast('⚠ Name and description are required.', 'err'); return; }
  const builds = ls('builds', []);
  builds.push({ id: 'b' + Date.now(), name: n, type: t, price: p, cat: c, desc: d, link: l,
    contact: '', photoData: null, buildFileName: null, buildFileData: null,
    submitter: 'owner', featured: false, status: 'approved', createdAt: Date.now() });
  ss('builds', builds);
  ['aN', 'aP', 'aC', 'aD', 'aL'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderBuildPanel(); updateHomeStats(); refreshStatCards();
  toast('✓ Build added!', 'ok');
}

function renderBuildPanel() {
  renderPendingPanel();
  const el = document.getElementById('buildPanelList'); if (!el) return;
  const builds = ls('builds', []).filter(b => b.status === 'approved');
  if (!builds.length) { el.innerHTML = '<div class="empty-state" style="padding:20px"><span class="es-icon" style="font-size:1.4rem">◎</span>No approved builds yet</div>'; return; }
  renderBuildListHTML(el, builds);
}

function filterAdminBuilds(q) {
  const el = document.getElementById('buildPanelList'); if (!el) return;
  const all = ls('builds', []).filter(b => b.status === 'approved');
  const filtered = q ? all.filter(b =>
    b.name.toLowerCase().includes(q.toLowerCase()) ||
    (b.cat || '').toLowerCase().includes(q.toLowerCase())
  ) : all;
  if (!filtered.length) { el.innerHTML = '<div class="empty-state" style="padding:18px">No builds match "' + esc(q) + '"</div>'; return; }
  renderBuildListHTML(el, filtered);
}

function renderBuildListHTML(el, builds) {
  el.innerHTML = builds.map(b => {
    const ip    = b.type === 'premium';
    const thumb = b.photoData
      ? `<img src="${b.photoData}" style="width:100%;height:100%;object-fit:cover">`
      : (b.icon || '◈');
    return `<div class="pl-item">
      <div class="pl-thumb">${thumb}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(b.name)}
          <span class="chip ${ip ? 'ch-prem' : 'ch-free'}">${ip ? 'PREMIUM' : 'FREE'}</span>
          ${b.featured ? '<span class="chip" style="background:rgba(255,196,50,.1);color:var(--gold)">⭐ FEATURED</span>' : ''}
          ${b.submitter && b.submitter !== 'owner' ? `<span style="font-family:var(--fm);font-size:.57rem;color:var(--t2)">by ${esc(b.submitter)}</span>` : ''}
        </div>
        <div class="pl-meta">${ip ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE'} · ${esc(b.cat)} ${b.buildFileName ? '· 📦 ' + esc(b.buildFileName) : ''} · 👁 ${getViews(b.id)}</div>
      </div>
      <div class="pl-actions">
        ${CU.role === 'owner' ? `<button class="btn-feat" onclick="toggleFeatured('${b.id}')">${b.featured ? '⭐' : '☆'}</button>` : ''}
        <button class="btn-del" onclick="deleteBuild('${b.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function renderPendingPanel() {
  if (CU.role !== 'owner') return;
  const el    = document.getElementById('pendingList');
  const badge = document.getElementById('pendBadge');
  if (!el) return;
  const pending = ls('builds', []).filter(b => b.status === 'pending');
  if (badge) badge.textContent = pending.length;
  if (!pending.length) { el.innerHTML = '<div class="empty-state" style="padding:14px">✓ No pending builds</div>'; return; }
  el.innerHTML = pending.map(b => `
    <div class="pl-item">
      <div class="pl-thumb">${b.photoData ? `<img src="${b.photoData}" style="width:100%;height:100%;object-fit:cover">` : '📦'}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(b.name)}<span class="chip ch-pending">PENDING</span></div>
        <div class="pl-meta">By: ${esc(b.submitter)} · ${b.type === 'premium' ? 'Rp ' + Number(b.price).toLocaleString('id-ID') : 'FREE'} · ${b.buildFileName ? '📦 ' + esc(b.buildFileName) : 'no file'} · <a href="${esc(b.link || '#')}" target="_blank" style="color:var(--a);text-decoration:none">Preview ↗</a></div>
      </div>
      <div class="pl-actions">
        <button class="btn-approve" onclick="approveBuild('${b.id}')">✓ APPROVE</button>
        <button class="btn-del"     onclick="rejectBuild('${b.id}')">✕ REJECT</button>
      </div>
    </div>`).join('');
}

function deleteBuild(id) {
  if (!confirm('Delete this build?')) return;
  ss('builds', ls('builds', []).filter(b => b.id !== id));
  renderBuildPanel();
  renderGrid('storeGrid', null, curFilter);
  renderGrid('featGrid',  null, 'all', true, false);
  renderGrid('recentGrid', null, 'all', false, true);
  updateHomeStats(); refreshStatCards();
  toast('Build deleted.', 'info');
}
function toggleFeatured(id) {
  if (CU.role !== 'owner') return;
  const builds = ls('builds', []), i = builds.findIndex(b => b.id === id); if (i < 0) return;
  builds[i].featured = !builds[i].featured; ss('builds', builds);
  renderBuildPanel();
  toast(builds[i].featured ? '⭐ Marked as featured!' : 'Removed from featured.', 'info');
}
function approveBuild(id) {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  const builds = ls('builds', []), i = builds.findIndex(b => b.id === id); if (i < 0) return;
  builds[i].status = 'approved'; ss('builds', builds);
  renderBuildPanel(); updateHomeStats(); refreshStatCards();
  toast('✓ Build approved!', 'ok');
}
function rejectBuild(id) {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  if (!confirm('Reject and delete this build?')) return;
  ss('builds', ls('builds', []).filter(b => b.id !== id));
  renderBuildPanel(); refreshStatCards();
  toast('Build rejected and removed.', 'info');
}

/* ── USERS PANEL ── */
function renderUserPanel() {
  if (CU.role !== 'owner') return;
  const grid = document.getElementById('userCardsGrid'); if (!grid) return;
  const users = ls('users', []), sess = ls('sessions', {});
  grid.innerHTML = users.map(u => {
    const s  = sess[u.id];
    const on = s && (Date.now() - s.lastPing) < SESSION_TTL;
    return `<div class="ucrd">
      <div class="ucrd-top">
        <div class="ucrd-av ${u.role}">${(u.avatar || u.username[0]).toUpperCase()}</div>
        <div>
          <div class="ucrd-name">${esc(u.username)}<span class="chip ch-${u.role}">${u.role.toUpperCase()}</span></div>
          <div class="ucrd-email">${esc(u.email)}</div>
        </div>
      </div>
      <div class="ucrd-mid">
        <div class="ucrd-ip">${s ? esc(s.ip) : '—'}${s && s.device ? ' · ' + deviceIcon(s.device) : ''}</div>
        <div class="ucrd-st ${on ? 'on' : 'off'}">${on ? '● ONLINE' : '○ offline'}</div>
      </div>
      <div class="ucrd-btns">
        ${u.id !== CU.id ? `<button class="btn-ucrd-del" onclick="deleteUser('${u.id}')">🗑 DELETE</button>` : ''}
        <button style="flex:1;padding:6px;background:var(--sf);border:1px solid var(--bd2);border-radius:6px;color:var(--t2);font-family:var(--fm);font-size:.6rem;cursor:pointer">👁 VIEW</button>
      </div>
    </div>`;
  }).join('');
}
function deleteUser(id) {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  if (!confirm('Delete this user?')) return;
  ss('users', ls('users', []).filter(u => u.id !== id));
  clearSession(id); renderUserPanel(); refreshStatCards();
  toast('User deleted.', 'info');
}

/* ── LIVE IP PANEL ── */
function refreshLive() {
  if (CU.role !== 'owner') return;
  const sess  = ls('sessions', {});
  const bans  = ls('bans', []).map(b => b.ip);
  const rows  = Object.values(sess);
  const now   = Date.now();
  let online  = 0;
  rows.forEach(r => { r.isOnline = (now - r.lastPing) < SESSION_TTL; if (r.isOnline) online++; });
  ['lsOnline', 'navOnlineNum', 'panelOnlineCount', 'scOnline', 'hsOnline'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = online;
  });
  const elT = document.getElementById('lsTotal');
  const elB = document.getElementById('lsBanned');
  if (elT) elT.textContent = rows.length;
  if (elB) elB.textContent = ls('bans', []).length;
  renderVisitorFeed(rows, bans);
  renderDeviceBreakdown(rows);
  renderActivityFeed();
}

function renderVisitorFeed(rows, bans) {
  const feed = document.getElementById('visitorFeed'); if (!feed) return;
  if (!rows.length) { feed.innerHTML = '<div style="padding:20px;font-family:var(--fm);font-size:.7rem;color:var(--t3);text-align:center">No active sessions</div>'; return; }
  feed.innerHTML = rows.map(r => `
    <div class="vr-item">
      <div class="vr-av ${r.role || 'user'}">${(r.username || '?')[0].toUpperCase()}</div>
      <div class="vr-info">
        <div class="vr-top">${esc(r.username)}<span class="chip ch-${r.role || 'user'}">${(r.role || 'user').toUpperCase()}</span>${deviceIcon(r.device)}</div>
        <div class="vr-bot">IP: ${esc(r.ip)} · joined ${timeAgo(r.joinedAt || r.lastPing)} · ${r.device || 'unknown'}</div>
      </div>
      <div class="vr-right">
        <div class="vr-st ${r.isOnline ? 'on' : 'off'}">${r.isOnline ? '● ONLINE' : '○ offline'}</div>
        ${!bans.includes(r.ip) ? `<button class="tbl-ban-btn" onclick="quickBanIp('${esc(r.ip)}','${esc(r.username)}')">🚫</button>` : `<span style="font-family:var(--fm);font-size:.55rem;color:var(--r)">BANNED</span>`}
      </div>
    </div>`).join('');
}

function renderDeviceBreakdown(rows) {
  const el = document.getElementById('deviceBars'); if (!el) return;
  const c  = { laptop: 0, mobile: 0, tablet: 0 };
  rows.filter(r => r.isOnline).forEach(r => { c[r.device || 'laptop']++; });
  const total = rows.filter(r => r.isOnline).length || 1;
  el.innerHTML = ['laptop', 'mobile', 'tablet'].map(d => {
    const pct = Math.round((c[d] / total) * 100);
    return `<div class="dev-row">
      <span class="dev-lbl">${deviceIcon(d)} ${d.toUpperCase()}</span>
      <div class="dev-bw"><div class="dev-bar ${d}" style="width:${pct}%"></div></div>
      <span class="dev-val">${c[d]}</span>
    </div>`;
  }).join('');
}

function renderActivityFeed() {
  const el = document.getElementById('activityFeed'); if (!el) return;
  const log = ls('actLog', []).slice(0, 10);
  const tm  = { join: { cls: 'ad-j', ico: '●' }, upload: { cls: 'ad-u', ico: '↑' }, view: { cls: 'ad-v', ico: '👁' } };
  if (!log.length) { el.innerHTML = '<div style="font-family:var(--fm);font-size:.7rem;color:var(--t3);padding:10px">No activity yet.</div>'; return; }
  el.innerHTML = log.map(a => {
    const t = tm[a.type] || { cls: 'ad-v', ico: '●' };
    return `<div class="act-row"><div class="act-dot ${t.cls}">${t.ico}</div><div class="act-body"><div class="act-msg">${a.msg}</div><div class="act-tm">${timeAgo(a.ts)}</div></div></div>`;
  }).join('');
}

function startLiveTimer() { stopLiveTimer(); liveRem = 10; liveTimer = setInterval(() => { liveRem--; const cd = document.getElementById('liveCountdown'); if (cd) cd.textContent = liveRem; if (liveRem <= 0) { liveRem = 10; refreshLive(); } }, LIVE_TICK); }
function stopLiveTimer()  { clearInterval(liveTimer); }

/* ── BAN PANEL ── */
function doBanIp() {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  const ip  = document.getElementById('banIpIn').value.trim();
  const rsn = document.getElementById('banRsnIn').value.trim();
  if (!ip) { toast('⚠ Enter an IP address.', 'err'); return; }
  if (ip === CIP) { toast('✕ Cannot ban your own IP.', 'err'); return; }
  const bans = ls('bans', []);
  if (bans.find(b => b.ip === ip)) { toast('IP already banned.', 'warn'); return; }
  bans.push({ ip, reason: rsn || 'Violated rules', bannedBy: CU.username, bannedAt: Date.now() });
  ss('bans', bans);
  document.getElementById('banIpIn').value  = '';
  document.getElementById('banRsnIn').value = '';
  renderBanPanel(); refreshStatCards();
  toast(`🚫 IP ${ip} banned.`, 'ok');
}
function quickBanIp(ip, username) {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  if (!confirm(`Ban IP ${ip} (${username})?`)) return;
  if (ip === CIP) { toast('✕ Cannot ban own IP.', 'err'); return; }
  const bans = ls('bans', []);
  if (!bans.find(b => b.ip === ip)) {
    bans.push({ ip, reason: 'Banned via live monitor', bannedBy: CU.username, bannedAt: Date.now() });
    ss('bans', bans);
  }
  refreshLive(); renderBanPanel(); refreshStatCards();
  toast(`🚫 ${ip} banned.`, 'ok');
}
function unbanIp(ip) {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  if (!confirm(`Unban IP ${ip}?`)) return;
  ss('bans', ls('bans', []).filter(b => b.ip !== ip));
  renderBanPanel(); refreshStatCards();
  toast(`✓ ${ip} unbanned.`, 'ok');
}
function renderBanPanel() {
  if (CU.role !== 'owner') return;
  const el = document.getElementById('banPanelList'); if (!el) return;
  const bans = ls('bans', []);
  if (!bans.length) { el.innerHTML = '<div class="empty-state" style="padding:18px">✓ No banned IPs</div>'; return; }
  el.innerHTML = bans.map(b => `
    <div class="pl-item">
      <div class="pl-thumb" style="font-size:1.2rem">🚫</div>
      <div class="pl-info">
        <div class="pl-name" style="color:var(--r);font-family:var(--fm)">${esc(b.ip)}</div>
        <div class="pl-meta">Reason: ${esc(b.reason)} · By: ${esc(b.bannedBy)} · ${timeAgo(b.bannedAt)}</div>
      </div>
      <div class="pl-actions"><button class="btn-unban" onclick="unbanIp('${esc(b.ip)}')">UNBAN</button></div>
    </div>`).join('');
}

/* ── RESET PASSWORD ── */
function doResetPassword() {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  const target = document.getElementById('pwdTarget').value.trim().toLowerCase();
  const np     = document.getElementById('pwdNew').value;
  const cp     = document.getElementById('pwdConf').value;
  const errEl  = document.getElementById('pwdErr');
  if (!np || !cp)   { errEl.textContent = '⚠ Please fill in all fields.';         return; }
  if (np.length < 6) { errEl.textContent = '⚠ Password min 6 characters.';        return; }
  if (np !== cp)     { errEl.textContent = '✕ Passwords do not match.';            return; }
  const users   = ls('users', []);
  const tgtName = target || CU.username;
  const idx     = users.findIndex(u => u.username.toLowerCase() === tgtName);
  if (idx < 0) { errEl.textContent = '✕ Username not found.'; return; }
  if (users[idx].role === 'owner' && users[idx].id !== CU.id && target) {
    errEl.textContent = "✕ Cannot reset another owner's password."; return;
  }
  users[idx].pwHash = hashPw(np);
  ss('users', users);
  if (users[idx].id === CU.id) CU.pwHash = users[idx].pwHash;
  document.getElementById('pwdTarget').value = '';
  document.getElementById('pwdNew').value    = '';
  document.getElementById('pwdConf').value   = '';
  errEl.textContent = '';
  toast(`✓ Password for "${users[idx].username}" reset!`, 'ok');
}

/* ── STAFF CODES ── */
function generateStaffCode() {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'STAFF-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const codes = ls('staffCodes', []);
  codes.unshift({ code, used: false, createdBy: CU.username, createdAt: Date.now() });
  ss('staffCodes', codes);
  const box = document.getElementById('genCodeBox');
  const val = document.getElementById('genCodeVal');
  if (box) box.style.display = 'block';
  if (val) val.textContent   = code;
  renderStaffCodesPanel();
  toast(`✓ New staff code: ${code}`, 'ok');
}
function revokeStaffCode(code) {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  if (!confirm(`Revoke code ${code}?`)) return;
  ss('staffCodes', ls('staffCodes', []).filter(c => c.code !== code));
  renderStaffCodesPanel();
  toast(`Code ${code} revoked.`, 'info');
}
function renderStaffCodesPanel() {
  if (CU.role !== 'owner') return;
  const el    = document.getElementById('staffCodeList'); if (!el) return;
  const codes = ls('staffCodes', []);
  if (!codes.length) { el.innerHTML = '<div class="empty-state" style="padding:14px">No codes generated yet.</div>'; return; }
  el.innerHTML = codes.map(c => `
    <div class="code-row">
      <div class="cr-code">${esc(c.code)}</div>
      <span class="chip ${c.used ? 'ch-used' : 'ch-active'}">${c.used ? 'USED' : 'ACTIVE'}</span>
      ${c.used ? `<span style="font-family:var(--fm);font-size:.58rem;color:var(--t2)">by ${esc(c.usedBy || '?')}</span>` : `<button class="btn-revoke" onclick="revokeStaffCode('${esc(c.code)}')">REVOKE</button>`}
    </div>`).join('');
}

/* ── EXPORT / CLEAR ── */
function exportData() {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  const data = {
    exportedAt:  new Date().toISOString(),
    builds:      ls('builds', []),
    users:       ls('users',  []).map(u => ({ ...u, pwHash: '[HIDDEN]' })),
    bans:        ls('bans',   []),
    sessions:    ls('sessions', {}),
    staffCodes:  ls('staffCodes', []),
    viewCounts:  ls('viewCounts', {}),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'oxyx-store-' + Date.now() + '.json'; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Data exported!', 'ok');
}
function clearAllBuilds() {
  if (CU.role !== 'owner') { toast('✕ Owner access only.', 'err'); return; }
  if (!confirm('⚠ Delete ALL builds permanently?')) return;
  ss('builds', []);
  renderBuildPanel(); updateHomeStats(); refreshStatCards();
  toast('All builds cleared.', 'warn');
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(ts) {
  if (!ts) return '—';
  const d  = Date.now() - ts;
  const s  = Math.floor(d / 1000);
  const m  = Math.floor(s / 60);
  const h  = Math.floor(m / 60);
  const dy = Math.floor(h / 24);
  if (dy > 0) return dy + 'd ago';
  if (h  > 0) return h  + 'h ago';
  if (m  > 0) return m  + 'm ago';
  if (s  > 0) return s  + 's ago';
  return 'just now';
}
let _tc = 0;
function toast(msg, type = 'info') {
  const w = document.getElementById('toastArea'); if (!w) return;
  const el = document.createElement('div');
  el.className   = 'toast ' + type;
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(26px)';
    el.style.transition = 'all .3s';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ─────────────────────────────────────────────
   KEYBOARD SHORTCUTS
───────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  // Esc — close overlays
  if (e.key === 'Escape') { closeModal(); closeSearch(); }
  // Ctrl+K — open search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  // Enter — submit auth form
  if (e.key === 'Enter') {
    const auth = document.getElementById('screenAuth');
    if (auth && auth.style.display !== 'none') {
      document.getElementById('fLogin').classList.contains('active') ? doLogin() : doRegister();
    }
  }
  // G+H — go home
  if (!e.ctrlKey && !e.metaKey && e.key === 'h' && document.activeElement.tagName === 'BODY') goTo('home');
});

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
(async function main() {
  seed();
  runLoader(async () => {
    await getIP();
    if (checkBanned()) { showBanned(); return; }
    document.getElementById('screenAuth').style.display = 'flex';
    if (typeof initAuthCanvas === 'function') initAuthCanvas();
    updateHomeStats();
    if (!tryAutoLogin()) { /* show auth screen */ }
    initCursor();
  });
})();
