// OXYX STORE - Firebase App
// Full integration: Auth + Firestore + Storage
// Place at: assets/js/firebase-app.js

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, collection,
  query, where, orderBy, onSnapshot,
  serverTimestamp, limit
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  getStorage, ref, uploadBytesResumable,
  getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// -- INIT --
const app  = initializeApp(window.OXYX_FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);
const stor = getStorage(app);

// -- STATE --
let CU = null;
let CUA = null;
let uploadedBuild = null;
let uploadedPhoto = null;
let notifOpen = false;
let curFilter = 'all';
let buildsCache = [];

// -- UTILS --
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  if (!ts) return '--';
  const ms = ts.seconds ? ts.seconds * 1000 : ts;
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function toast(msg, type) {
  type = type || 'info';
  const w = document.getElementById('toastArea');
  if (!w) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    el.style.transform = 'translateX(26px)';
    el.style.transition = 'all .3s';
    setTimeout(function() { el.remove(); }, 300);
  }, 3200);
}

function animNum(el, target, dur) {
  if (!el) return;
  dur = dur || 1000;
  var s = null;
  function step(ts) {
    if (!s) s = ts;
    var p = Math.min((ts - s) / dur, 1);
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(target * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// -- PASSWORD STRENGTH --
function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  var s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  var L = [
    { label: 'Very Weak', c: '#ff2d55' },
    { label: 'Weak',      c: '#ff6b2d' },
    { label: 'Fair',      c: '#ffc432' },
    { label: 'Good',      c: '#00c8ff' },
    { label: 'Strong',    c: '#00ff88' },
    { label: 'Very Strong', c: '#00ffd5' }
  ];
  return Object.assign({ score: s }, L[Math.min(s, 5)]);
}

function onPwInput(v) {
  var st = pwStrength(v);
  var b = document.getElementById('pwBar');
  var l = document.getElementById('pwLbl');
  if (b) { b.style.width = (st.score / 5 * 100) + '%'; b.style.background = st.c; }
  if (l) { l.textContent = st.label; l.style.color = st.c; }
}

// -- CURSOR --
function initCursor() {
  var g = document.getElementById('cGlow');
  var d = document.getElementById('cDot');
  if (!g || !d) return;
  var rx = 0, ry = 0, dx = 0, dy = 0;
  document.addEventListener('mousemove', function(e) {
    dx = e.clientX; dy = e.clientY;
    d.style.left = dx + 'px'; d.style.top = dy + 'px';
  });
  (function ag() {
    rx += (dx - rx) * 0.1; ry += (dy - ry) * 0.1;
    g.style.left = rx + 'px'; g.style.top = ry + 'px';
    requestAnimationFrame(ag);
  })();
}

// -- SCROLL EFFECTS --
window.addEventListener('scroll', function() {
  var b = document.getElementById('btnTop');
  if (b) b.classList.toggle('show', window.scrollY > 440);
  var nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// -- REVEAL --
function initReveal() {
  var obs = new IntersectionObserver(function(es) {
    es.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function(el) { obs.observe(el); });
}

function initTilt() {
  document.addEventListener('mousemove', function(e) {
    document.querySelectorAll('.bcard').forEach(function(c) {
      var r = c.getBoundingClientRect();
      if (Math.abs(e.clientX - r.left - r.width / 2) > 200) {
        c.style.transform = 'perspective(1000px)'; return;
      }
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = 'perspective(1000px) rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 14) + 'deg) translateZ(10px)';
    });
  });
}

function initParticles() {
  var hero = document.querySelector('.hero');
  if (!hero || hero.querySelector('.float-particles')) return;
  var wrap = document.createElement('div');
  wrap.className = 'float-particles';
  hero.prepend(wrap);
  var colors = [
    'rgba(0,255,213,.12)', 'rgba(176,109,255,.1)',
    'rgba(255,45,85,.08)', 'rgba(0,255,136,.09)'
  ];
  for (var i = 0; i < 16; i++) {
    var p = document.createElement('div');
    p.className = 'fp';
    var sz = Math.random() * 8 + 3;
    var dur = Math.random() * 18 + 12;
    var del = Math.random() * -20;
    var col = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;background:' + col +
      ';left:' + (Math.random() * 100) + '%;bottom:' + (Math.random() * 30) +
      '%;animation-duration:' + dur + 's;animation-delay:' + del + 's;';
    wrap.appendChild(p);
  }
}

function initParallax() {
  var orb = document.querySelector('.orb-3d');
  if (!orb || orb._parallax) return;
  orb._parallax = true;
  document.addEventListener('mousemove', function(e) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
    orb.style.transform = 'perspective(800px) rotateY(' + (dx * 12) + 'deg) rotateX(' + (-dy * 8) + 'deg)';
  });
}

// -- LOADER --
function runLoader(cb) {
  var bar = document.getElementById('loadBar');
  var msg = document.getElementById('loadMsg');
  var msgs = [
    'INITIALIZING SYSTEM...',
    'CONNECTING TO DATABASE...',
    'LOADING ASSETS...',
    'CHECKING SESSION...',
    'SYSTEM READY'
  ];
  var p = 0, step = 0;
  var iv = setInterval(function() {
    p = Math.min(p + Math.random() * 12 + 6, 100);
    if (bar) bar.style.width = p + '%';
    if (p > step * 25 && step < msgs.length && msg) msg.textContent = msgs[step++];
    if (p >= 100) {
      clearInterval(iv);
      setTimeout(function() {
        var el = document.getElementById('screenLoad');
        if (el) el.classList.add('out');
        setTimeout(cb, 700);
      }, 400);
    }
  }, 130);
}

// -- BAN CHECK --
function showBanned() {
  var el = document.getElementById('screenBanned');
  if (!el) return;
  var ip = document.getElementById('banIpDisplay');
  if (ip) ip.textContent = CU ? CU.username : '--';
  el.style.display = 'flex';
  document.getElementById('screenAuth').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
}

// ============================
// AUTH
// ============================
function switchTab(t) {
  document.getElementById('tabL').classList.toggle('active', t === 'login');
  document.getElementById('tabR').classList.toggle('active', t === 'register');
  document.getElementById('fLogin').classList.toggle('active', t === 'login');
  document.getElementById('fReg').classList.toggle('active', t === 'register');
  ['lErr', 'rErr'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.textContent = '';
  });
}

function toggleEye(id, btn) {
  var el = document.getElementById(id); if (!el) return;
  var s = el.type === 'password';
  el.type = s ? 'text' : 'password';
  btn.textContent = s ? 'hide' : 'show';
}

async function doLogin() {
  var u = document.getElementById('lU').value.trim();
  var p = document.getElementById('lP').value;
  var err = document.getElementById('lErr');
  if (!u || !p) { err.textContent = 'Fill in all fields.'; return; }
  err.textContent = 'Connecting...';
  try {
    var q2 = query(collection(db, 'users'), where('username', '==', u.toLowerCase()), limit(1));
    var snap = await getDocs(q2);
    if (snap.empty) { err.textContent = 'Username not found.'; return; }
    var userData = snap.docs[0].data();
    await signInWithEmailAndPassword(auth, userData.email, p);
    err.textContent = '';
  } catch(e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      err.textContent = 'Incorrect password.';
    } else if (e.code === 'auth/too-many-requests') {
      err.textContent = 'Too many attempts. Try later.';
    } else {
      err.textContent = 'Login failed: ' + e.message;
    }
  }
}

async function doRegister() {
  var u = document.getElementById('rU').value.trim().toLowerCase();
  var e = document.getElementById('rE').value.trim();
  var p = document.getElementById('rP').value;
  var code = document.getElementById('rC').value.trim().toUpperCase();
  var err = document.getElementById('rErr');
  if (!u || !e || !p) { err.textContent = 'Fill in all fields.'; return; }
  if (u.length < 3) { err.textContent = 'Username min 3 characters.'; return; }
  if (p.length < 6) { err.textContent = 'Password min 6 characters.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { err.textContent = 'Invalid email.'; return; }
  err.textContent = 'Creating account...';
  try {
    var uSnap = await getDocs(query(collection(db, 'users'), where('username', '==', u), limit(1)));
    if (!uSnap.empty) { err.textContent = 'Username already taken.'; return; }
    var role = 'user';
    if (code) {
      var cDoc = await getDoc(doc(db, 'staffCodes', code));
      if (!cDoc.exists() || cDoc.data().used) { err.textContent = 'Invalid or used staff code.'; return; }
      role = 'staff';
      await updateDoc(doc(db, 'staffCodes', code), { used: true, usedBy: u, usedAt: serverTimestamp() });
    }
    var cred = await createUserWithEmailAndPassword(auth, e, p);
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid, username: u, email: e, role: role, createdAt: serverTimestamp()
    });
    err.textContent = '';
    toast('Account created! Logging in...', 'ok');
  } catch(er) {
    if (er.code === 'auth/email-already-in-use') {
      err.textContent = 'Email already registered.';
    } else {
      err.textContent = er.message;
    }
  }
}

async function doLogout() {
  await signOut(auth);
  CU = null; CUA = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('screenAuth').style.display = 'flex';
  toast('Logged out.', 'info');
}

// -- Auth state --
onAuthStateChanged(auth, async function(firebaseUser) {
  if (firebaseUser) {
    CUA = firebaseUser;
    var snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (snap.exists()) {
      CU = Object.assign({ uid: firebaseUser.uid }, snap.data());
      var banSnap = await getDoc(doc(db, 'bans', CU.uid));
      if (banSnap.exists()) { showBanned(); return; }
      launchApp();
    }
  }
});

// ============================
// LAUNCH
// ============================
function launchApp() {
  document.getElementById('screenAuth').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  var nm = document.getElementById('nbNm');
  var av = document.getElementById('nbAv');
  var rc = document.getElementById('nbRc');
  if (nm) nm.textContent = CU.username;
  if (av) av.textContent = CU.username[0].toUpperCase();
  if (rc) { rc.textContent = CU.role.toUpperCase(); rc.className = 'nb-role-chip ' + CU.role; }
  var al = document.getElementById('nl-admin');
  if (al) al.style.display = (CU.role === 'owner' || CU.role === 'staff') ? 'inline' : 'none';
  var pl = document.getElementById('nl-profile');
  if (pl) pl.style.display = 'inline';
  applyTicker();
  goTo('home');
  updateHomeStats();
  setTimeout(function() {
    initReveal(); initParticles(); initParallax();
  }, 200);
}

// ============================
// NAVIGATION
// ============================
function goTo(page) {
  document.querySelectorAll('.sec').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nl').forEach(function(l) { l.classList.remove('active'); });
  var sec = document.getElementById('sec-' + page);
  if (sec) sec.classList.add('active');
  var lnk = document.getElementById('nl-' + page);
  if (lnk) lnk.classList.add('active');
  document.getElementById('nbLinks').classList.remove('open');
  if (page === 'home')    { renderFeatured(); renderRecent(); updateHomeStats(); }
  if (page === 'store')   renderGrid('storeGrid', null, curFilter);
  if (page === 'premium') renderGrid('premGrid', 'premium');
  if (page === 'free')    renderGrid('freeGrid', 'free');
  if (page === 'submit')  renderMyPending();
  if (page === 'admin')   initAdminPanel();
  if (page === 'profile') renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(initReveal, 100);
}

function toggleNav() {
  document.getElementById('nbLinks').classList.toggle('open');
}

// ============================
// TICKER
// ============================
async function applyTicker() {
  try {
    var snap = await getDoc(doc(db, 'config', 'announcement'));
    var msg = snap.exists() ? snap.data().text : '';
    var wrap = document.getElementById('tickerWrap');
    var inner = document.getElementById('tickerInner');
    if (msg && wrap && inner) {
      inner.textContent = msg + '  .  ' + msg + '  .  ' + msg;
      wrap.style.display = 'flex';
    } else if (wrap) {
      wrap.style.display = 'none';
    }
  } catch(e) {}
}

async function saveAnnouncement() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var v = document.getElementById('announceInput').value.trim();
  await setDoc(doc(db, 'config', 'announcement'), { text: v, updatedAt: serverTimestamp() });
  applyTicker();
  toast(v ? 'Announcement published!' : 'Cleared.', 'ok');
}

async function clearAnnouncement() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  await setDoc(doc(db, 'config', 'announcement'), { text: '', updatedAt: serverTimestamp() });
  applyTicker();
  var inp = document.getElementById('announceInput');
  if (inp) inp.value = '';
  toast('Cleared.', 'info');
}

// ============================
// BUILDS - READ
// ============================
async function loadBuilds() {
  var snap = await getDocs(query(
    collection(db, 'builds'),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc')
  ));
  buildsCache = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  return buildsCache;
}

function buildCardHTML(b) {
  var ip = b.type === 'premium';
  var pr = ip ? 'Rp ' + Number(b.price || 0).toLocaleString('id-ID') : 'FREE';
  var thumb = b.photoURL
    ? '<img class="bc-photo" src="' + b.photoURL + '" alt="">'
    : '<span class="bc-icon">diamond</span>';
  var wl = isWl(b.id);
  return '<div class="bcard" onclick="openModal(\'' + b.id + '\')">' +
    '<div class="bc-thumb"><div class="bc-thumb-glow"></div>' + thumb +
    '<span class="bc-badge ' + (ip ? 'bp' : 'bf') + '">' + (ip ? 'PREMIUM' : 'FREE') + '</span>' +
    '<button class="wl-btn" data-id="' + b.id + '" onclick="toggleWishlist(\'' + b.id + '\',event)" style="color:' + (wl ? 'var(--r)' : '') + '">' + (wl ? 'S' : 'o') + '</button>' +
    '</div>' +
    '<div class="bc-body">' +
    '<div class="bc-top-row"><div class="bc-cat">' + esc(b.cat || '--') + '</div>' +
    '<div class="bc-views">views: ' + (b.views || 0) + '</div></div>' +
    '<div class="bc-name">' + esc(b.name) + '</div>' +
    '<div class="bc-desc">' + esc(b.desc) + '</div>' +
    '<div class="bc-foot"><span class="bc-price ' + (ip ? 'pp' : 'fp') + '">' + pr + '</span>' +
    '<button class="btn-view">VIEW</button></div>' +
    '</div></div>';
}

async function renderGrid(cid, typeFilter, fm) {
  var el = document.getElementById(cid);
  if (!el) return;
  el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>LOADING...</div>';
  var builds = await loadBuilds();
  if (typeFilter) builds = builds.filter(function(b) { return b.type === typeFilter; });
  if (fm && fm !== 'all') builds = builds.filter(function(b) { return b.type === fm; });
  if (!builds.length) {
    el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>NO BUILDS YET</div>';
    return;
  }
  el.innerHTML = builds.map(buildCardHTML).join('');
  setTimeout(initTilt, 100);
}

async function renderFeatured() {
  var el = document.getElementById('featGrid');
  if (!el) return;
  var snap = await getDocs(query(
    collection(db, 'builds'),
    where('status', '==', 'approved'),
    where('featured', '==', true),
    limit(6)
  ));
  var builds = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  if (!builds.length) {
    el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>NO FEATURED BUILDS YET</div>';
    return;
  }
  el.innerHTML = builds.map(buildCardHTML).join('');
  setTimeout(initTilt, 100);
}

async function renderRecent() {
  var el = document.getElementById('recentGrid');
  if (!el) return;
  var snap = await getDocs(query(
    collection(db, 'builds'),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    limit(4)
  ));
  var builds = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  if (!builds.length) { el.innerHTML = ''; return; }
  el.innerHTML = builds.map(buildCardHTML).join('');
  setTimeout(initTilt, 100);
}

async function updateHomeStats() {
  var snap = await getDocs(query(collection(db, 'builds'), where('status', '==', 'approved')));
  var builds = snap.docs.map(function(d) { return d.data(); });
  var prem = builds.filter(function(b) { return b.type === 'premium'; }).length;
  var free = builds.filter(function(b) { return b.type === 'free'; }).length;
  var uSnap = await getDocs(collection(db, 'users'));
  animNum(document.getElementById('hsB'), builds.length);
  animNum(document.getElementById('hsP'), prem);
  animNum(document.getElementById('hsF'), free);
  animNum(document.getElementById('hsU'), uSnap.size);
  animNum(document.getElementById('authStatB'), builds.length);
  animNum(document.getElementById('authStatU'), uSnap.size);
  var cp = document.getElementById('ccPrem'); if (cp) cp.textContent = prem + ' builds';
  var cf = document.getElementById('ccFree'); if (cf) cf.textContent = free + ' builds';
}

function applyFilter(type, btn, gridId) {
  curFilter = type;
  document.querySelectorAll('.flt').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderGrid(gridId, null, type);
}

// ============================
// MODAL
// ============================
async function openModal(id) {
  var b = buildsCache.find(function(x) { return x.id === id; });
  if (!b) {
    var snap = await getDoc(doc(db, 'builds', id));
    if (!snap.exists()) return;
    b = Object.assign({ id: id }, snap.data());
  }
  updateDoc(doc(db, 'builds', id), { views: (b.views || 0) + 1 }).catch(function() {});
  var ip = b.type === 'premium';
  var pr = ip ? 'Rp ' + Number(b.price || 0).toLocaleString('id-ID') : 'FREE';
  var wl = isWl(id);
  var html = '';
  if (b.photoURL) html += '<img class="mod-photo" src="' + b.photoURL + '" alt="">';
  html += '<div class="mod-top-row">';
  html += '<span class="mod-badge ' + (ip ? 'prem' : 'free') + '">' + (ip ? 'PREMIUM' : 'FREE') + '</span>';
  html += '<button class="mod-wl-btn" id="mod-wl-' + id + '" onclick="toggleWishlist(\'' + id + '\',event)" style="color:' + (wl ? 'var(--r)' : '') + '">' + (wl ? 'Saved' : 'Save') + '</button>';
  html += '</div>';
  html += '<div class="mod-title">' + esc(b.name) + '</div>';
  html += '<div class="mod-meta">' + esc(b.cat || '--');
  if (b.submitterName) html += ' - By ' + esc(b.submitterName);
  html += ' - views: ' + ((b.views || 0) + 1) + '</div>';
  html += '<div class="mod-desc">' + esc(b.desc) + '</div>';
  if (b.contact) html += '<div class="mod-contact">Seller: ' + esc(b.contact) + '</div>';
  if (b.buildFileName) html += '<div class="mod-file-info">File: ' + esc(b.buildFileName) + '</div>';
  html += '<div class="mod-price-row"><div class="mod-price ' + (ip ? 'pp' : 'fp') + '">' + pr + '</div></div>';
  if (ip) {
    html += '<button class="btn-modal-action bma-buy" onclick="handleBuy(\'' + b.id + '\')">BUY NOW</button>';
  } else {
    if (b.buildFileURL) {
      html += '<button class="btn-modal-action bma-dl" onclick="handleDL(\'' + b.id + '\',\'' + esc(b.buildFileURL) + '\',\'' + esc(b.buildFileName || 'build.build') + '\')">DOWNLOAD .BUILD</button>';
    }
    html += '<a href="' + esc(b.link || '#') + '" target="_blank" class="btn-modal-action bma-prev">VIEW PREVIEW</a>';
  }
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function handleBuy(id) {
  var b = buildsCache.find(function(x) { return x.id === id; });
  if (b) toast('Contact seller: ' + (b.contact || 'Contact admin'), 'info');
  closeModal();
}

function handleDL(id, url, fname) {
  var a = document.createElement('a');
  a.href = url; a.download = fname; a.target = '_blank';
  a.click();
  toast('Downloading...', 'ok');
}

// ============================
// WISHLIST
// ============================
function isWl(id) {
  return (JSON.parse(localStorage.getItem('_ox_wl') || '[]')).includes(id);
}

function toggleWishlist(id, e) {
  e.stopPropagation();
  var wl = JSON.parse(localStorage.getItem('_ox_wl') || '[]');
  var i = wl.indexOf(id);
  if (i > -1) { wl.splice(i, 1); toast('Removed from wishlist.', 'info'); }
  else { wl.push(id); toast('Added to wishlist!', 'ok'); }
  localStorage.setItem('_ox_wl', JSON.stringify(wl));
  document.querySelectorAll('.wl-btn[data-id="' + id + '"]').forEach(function(btn) {
    btn.textContent = wl.includes(id) ? 'S' : 'o';
    btn.style.color = wl.includes(id) ? 'var(--r)' : '';
  });
}

// ============================
// UPLOAD BUILD
// ============================
function handleBuildFile(input) {
  var file = input.files[0];
  if (!file) return;
  var ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (ext !== 'build') {
    input.value = ''; uploadedBuild = null;
    var zone = document.getElementById('buildDropZone');
    var fn = document.getElementById('buildFileName');
    zone.style.borderColor = 'var(--r)';
    fn.style.color = 'var(--r)';
    fn.textContent = 'Only .build files allowed (e.g. myapp.build)';
    toast('Only .build files accepted', 'err');
    setTimeout(function() { zone.style.borderColor = ''; fn.textContent = ''; fn.style.color = ''; }, 3200);
    return;
  }
  if (file.size > 150 * 1024 * 1024) {
    input.value = '';
    toast('Max 150 MB.', 'err');
    return;
  }
  uploadedBuild = { file: file, name: file.name };
  var fn = document.getElementById('buildFileName');
  fn.style.color = 'var(--g)';
  fn.textContent = 'Ready: ' + file.name;
  document.getElementById('buildDropZone').style.borderColor = 'var(--g)';
}

function handlePhotoFile(input) {
  var file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Image files only.', 'err'); input.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { toast('Max 5MB.', 'err'); input.value = ''; return; }
  uploadedPhoto = file;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('photoPreviewImg').src = e.target.result;
    document.getElementById('photoPreviewWrap').style.display = 'flex';
    var ph = document.getElementById('photoPlaceholder');
    if (ph) ph.style.display = 'none';
    document.getElementById('photoDropZone').style.borderColor = 'var(--g)';
  };
  reader.readAsDataURL(file);
}

function setIbError(fid, msg) {
  var ib = document.getElementById(fid);
  var parent = ib ? (ib.closest('.ib') || ib.parentElement) : null;
  if (parent) parent.style.borderColor = 'var(--r)';
  var fg = ib ? ib.closest('.fg') : null;
  if (fg) {
    var h = fg.querySelector('.field-hint');
    if (!h) { h = document.createElement('div'); h.className = 'field-hint'; fg.appendChild(h); }
    h.textContent = msg;
    h.style.color = 'var(--r)';
    h.style.fontSize = '.65rem';
    h.style.marginTop = '5px';
    h.style.fontFamily = 'var(--fm)';
  }
}

function clearIbError(fid) {
  var ib = document.getElementById(fid);
  var parent = ib ? (ib.closest('.ib') || ib.parentElement) : null;
  if (parent) parent.style.borderColor = '';
  var fg = ib ? ib.closest('.fg') : null;
  if (fg) { var h = fg.querySelector('.field-hint'); if (h) h.remove(); }
}

async function submitBuild() {
  var n = document.getElementById('sbN').value.trim();
  var t = document.getElementById('sbT').value;
  var p = parseInt(document.getElementById('sbP').value) || 0;
  var c = document.getElementById('sbC').value.trim();
  var d = document.getElementById('sbD').value.trim();
  var l = document.getElementById('sbL').value.trim();
  var k = document.getElementById('sbK').value.trim();
  var tos = document.getElementById('sbTos').checked;
  ['sbN', 'sbC', 'sbD', 'sbL', 'sbP'].forEach(clearIbError);
  var hasError = false;
  function fail(fid, msg) { setIbError(fid, msg); hasError = true; }
  if (!n) fail('sbN', 'Build name is required.');
  if (!c) fail('sbC', 'Category is required (e.g. Dashboard, Portfolio).');
  if (!d) fail('sbD', 'Description is required.');
  if (!l) fail('sbL', 'Demo link is required.');
  if (t === 'premium' && p <= 0) fail('sbP', 'Price is required for premium builds.');
  if (!uploadedBuild) {
    var zone = document.getElementById('buildDropZone');
    var fn = document.getElementById('buildFileName');
    zone.style.borderColor = 'var(--r)';
    fn.style.color = 'var(--r)';
    fn.textContent = 'Upload a .build file first';
    hasError = true;
  }
  if (!tos) { toast('Please confirm this is your original work.', 'err'); hasError = true; }
  if (hasError) { toast('Please fill in all required fields.', 'err'); return; }

  var btn = document.querySelector('.submit-build-btn');
  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'UPLOADING...'; }
  try {
    var buildFileURL = null;
    var photoURL = null;
    var bRef = ref(stor, 'builds/' + CU.uid + '_' + Date.now() + '_' + uploadedBuild.name);
    var bSnap = await new Promise(function(res, rej) {
      var task = uploadBytesResumable(bRef, uploadedBuild.file);
      task.on('state_changed', function(sp) {
        var pct = Math.round(sp.bytesTransferred / sp.totalBytes * 100);
        if (btn) btn.querySelector('span').textContent = 'UPLOADING ' + pct + '%...';
      }, rej, function() { res(task.snapshot); });
    });
    buildFileURL = await getDownloadURL(bSnap.ref);
    if (uploadedPhoto) {
      var pRef = ref(stor, 'photos/' + CU.uid + '_' + Date.now());
      await uploadBytesResumable(pRef, uploadedPhoto);
      photoURL = await getDownloadURL(pRef);
    }
    await addDoc(collection(db, 'builds'), {
      name: n, type: t, price: p, cat: c, desc: d, link: l, contact: k,
      photoURL: photoURL, buildFileURL: buildFileURL, buildFileName: uploadedBuild.name,
      submitterUid: CU.uid, submitterName: CU.username,
      featured: false, status: 'pending', views: 0,
      createdAt: serverTimestamp()
    });
    toast('Build submitted! Pending owner review.', 'ok');
    ['sbN', 'sbP', 'sbC', 'sbD', 'sbL', 'sbK'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('sbTos').checked = false;
    document.getElementById('buildFileName').textContent = '';
    document.getElementById('buildDropZone').style.borderColor = '';
    document.getElementById('photoDropZone').style.borderColor = '';
    document.getElementById('photoPreviewWrap').style.display = 'none';
    document.getElementById('photoPreviewImg').src = '';
    var ph = document.getElementById('photoPlaceholder');
    if (ph) ph.style.display = '';
    uploadedBuild = null; uploadedPhoto = null;
    renderMyPending();
  } catch(er) {
    toast('Upload failed: ' + er.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'SUBMIT BUILD'; }
  }
}

async function renderMyPending() {
  var el = document.getElementById('myPendingList');
  if (!el) return;
  var snap = await getDocs(query(
    collection(db, 'builds'),
    where('submitterUid', '==', CU.uid),
    where('status', '==', 'pending')
  ));
  if (snap.empty) { el.innerHTML = '<div class="usb-empty">No pending builds.</div>'; return; }
  el.innerHTML = snap.docs.map(function(d) {
    return '<div class="pend-item"><div class="pend-name">' + esc(d.data().name) + '</div>' +
      '<div class="pend-status">Awaiting review...</div></div>';
  }).join('');
}

// ============================
// PROFILE
// ============================
async function renderProfile() {
  var el = document.getElementById('profileContent');
  if (!el) return;
  el.innerHTML = '<div class="empty-state"><span class="es-icon">o</span>LOADING...</div>';
  var wlIds = JSON.parse(localStorage.getItem('_ox_wl') || '[]');
  var mySnap = await getDocs(query(
    collection(db, 'builds'),
    where('submitterUid', '==', CU.uid),
    where('status', '==', 'approved')
  ));
  var myBuilds = mySnap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  var pendSnap = await getDocs(query(
    collection(db, 'builds'),
    where('submitterUid', '==', CU.uid),
    where('status', '==', 'pending')
  ));
  var wlBuilds = [];
  for (var i = 0; i < Math.min(wlIds.length, 6); i++) {
    var s2 = await getDoc(doc(db, 'builds', wlIds[i]));
    if (s2.exists() && s2.data().status === 'approved') {
      wlBuilds.push(Object.assign({ id: s2.id }, s2.data()));
    }
  }
  var html = '<div class="profile-layout">';
  html += '<div class="profile-card">';
  html += '<div class="pc-avatar">' + CU.username[0].toUpperCase() + '</div>';
  html += '<div class="pc-name">' + esc(CU.username) + '</div>';
  html += '<div class="pc-role-chip ch-' + CU.role + '">' + CU.role.toUpperCase() + '</div>';
  html += '<div class="pc-email">' + esc(CU.email) + '</div>';
  html += '<div class="pc-stats">';
  html += '<div class="pc-stat"><div class="pc-sn">' + myBuilds.length + '</div><div class="pc-sl">UPLOADS</div></div>';
  html += '<div class="pc-stat"><div class="pc-sn">' + wlIds.length + '</div><div class="pc-sl">WISHLIST</div></div>';
  html += '<div class="pc-stat"><div class="pc-sn">' + pendSnap.size + '</div><div class="pc-sl">PENDING</div></div>';
  html += '</div></div>';
  html += '<div class="profile-right">';
  if (wlBuilds.length) {
    html += '<div><div class="ps-title">WISHLIST</div><div class="builds-grid">' + wlBuilds.map(buildCardHTML).join('') + '</div></div>';
  }
  if (myBuilds.length) {
    html += '<div><div class="ps-title">MY BUILDS</div><div class="builds-grid">' + myBuilds.map(buildCardHTML).join('') + '</div></div>';
  }
  if (!wlBuilds.length && !myBuilds.length) {
    html += '<div class="empty-state"><span class="es-icon">o</span>Explore builds and save favorites!</div>';
  }
  html += '</div></div>';
  el.innerHTML = html;
  setTimeout(initTilt, 100);
}

// ============================
// SEARCH
// ============================
function openSearch() {
  var ov = document.getElementById('searchOverlay');
  if (!ov) return;
  ov.classList.add('open');
  setTimeout(function() {
    var inp = document.getElementById('srchInput');
    if (inp) { inp.focus(); inp.value = ''; }
    document.getElementById('srchResults').innerHTML = '';
  }, 50);
}

function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
}

async function doSearch(q) {
  var res = document.getElementById('srchResults');
  if (!res) return;
  if (!q.trim()) { res.innerHTML = ''; return; }
  var ql = q.toLowerCase();
  var all = await loadBuilds();
  var matched = all.filter(function(b) {
    return (b.name || '').toLowerCase().includes(ql) ||
           (b.cat  || '').toLowerCase().includes(ql) ||
           (b.desc || '').toLowerCase().includes(ql);
  }).slice(0, 8);
  if (!matched.length) { res.innerHTML = '<div class="sri-empty">No results for "' + esc(q) + '"</div>'; return; }
  res.innerHTML = matched.map(function(b) {
    var ip = b.type === 'premium';
    var pr = ip ? 'Rp ' + Number(b.price || 0).toLocaleString('id-ID') : 'FREE';
    return '<div class="sri" onclick="closeSearch();openModal(\'' + b.id + '\')">' +
      '<div class="sri-thumb">' + (b.photoURL ? '<img src="' + b.photoURL + '" alt="">' : (b.cat ? b.cat[0] : 'o')) + '</div>' +
      '<div><div class="sri-name">' + esc(b.name) + '</div><div class="sri-meta">' + esc(b.cat || '--') + ' - ' + pr + '</div></div>' +
      '<span class="sri-badge ' + (ip ? 'sri-p' : 'sri-f') + '">' + (ip ? 'PREM' : 'FREE') + '</span>' +
      '</div>';
  }).join('');
}

// ============================
// ADMIN PANEL
// ============================
async function initAdminPanel() {
  var rb = document.getElementById('adminRoleBadge');
  if (rb) { rb.textContent = CU.role.toUpperCase(); rb.className = 'ph-role-badge ' + CU.role; }
  var sg = document.getElementById('statGrid');
  if (sg) sg.style.display = CU.role === 'owner' ? 'grid' : 'none';
  startAdminClock();
  buildAdminTabs();
  refreshAdminStats();
  if (CU.role === 'owner') checkOwnerAlert();
}

function startAdminClock() {
  function tick() {
    var el = document.getElementById('adminClock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  clearInterval(window._clkT);
  window._clkT = setInterval(tick, 1000);
}

async function refreshAdminStats() {
  if (CU.role !== 'owner') return;
  var results = await Promise.all([
    getDocs(query(collection(db, 'builds'), where('status', '==', 'approved'))),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'bans')),
    getDocs(query(collection(db, 'builds'), where('status', '==', 'pending')))
  ]);
  var builds = results[0].docs.map(function(d) { return d.data(); });
  animNum(document.getElementById('scBuilds'),  builds.length, 500);
  animNum(document.getElementById('scPremium'), builds.filter(function(b) { return b.type === 'premium'; }).length, 500);
  animNum(document.getElementById('scMembers'), results[1].size, 500);
  animNum(document.getElementById('scBanned'),  results[2].size, 500);
  animNum(document.getElementById('scPending'), results[3].size, 500);
  var pb = document.getElementById('pendBadge');
  if (pb) pb.textContent = results[3].size;
}

async function checkOwnerAlert() {
  var snap = await getDocs(query(collection(db, 'builds'), where('status', '==', 'pending')));
  var ab = document.getElementById('ownerAlert');
  var am = document.getElementById('ownerAlertMsg');
  if (ab && am && snap.size > 0) {
    am.textContent = snap.size + (snap.size > 1 ? ' builds' : ' build') + ' pending review.';
    ab.style.display = 'flex';
  } else if (ab) {
    ab.style.display = 'none';
  }
}

function buildAdminTabs() {
  var nav = document.getElementById('adminTabsNav');
  if (!nav) return;
  var io = CU.role === 'owner';
  var tabs = [
    { id: 'builds', label: 'BUILDS',     all: true  },
    { id: 'users',  label: 'USERS',      all: false },
    { id: 'ban',    label: 'BAN',        all: false },
    { id: 'pwd',    label: 'RESET PWD',  all: false },
    { id: 'codes',  label: 'STAFF CODES',all: false },
    { id: 'tools',  label: 'TOOLS',      all: false }
  ];
  nav.innerHTML = tabs.filter(function(t) { return t.all || io; }).map(function(t, i) {
    return '<button class="admin-tab-btn' + (i === 0 ? ' active' : '') + '" onclick="switchAdminTab(\'' + t.id + '\',this)">' + t.label + '</button>';
  }).join('');
  ['admtab-users', 'admtab-ban', 'admtab-pwd', 'admtab-codes', 'admtab-tools'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = io ? '' : 'none';
  });
  var ab = document.getElementById('addBuildBox'); if (ab) ab.style.display = io ? '' : 'none';
  var pb = document.getElementById('pendingBox');  if (pb) pb.style.display = io ? '' : 'none';
  document.querySelectorAll('.admtab').forEach(function(t) { t.classList.remove('active'); });
  var first = document.getElementById('admtab-builds'); if (first) first.classList.add('active');
  renderBuildPanel();
}

function switchAdminTab(name, btn) {
  document.querySelectorAll('.admin-tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.admtab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  var tab = document.getElementById('admtab-' + name); if (tab) tab.classList.add('active');
  if (name === 'builds') renderBuildPanel();
  if (name === 'users')  renderUserPanel();
  if (name === 'ban')    renderBanPanel();
  if (name === 'codes')  renderCodesPanel();
  if (name === 'tools') {
    var inp = document.getElementById('announceInput');
    if (inp) getDoc(doc(db, 'config', 'announcement')).then(function(s) {
      inp.value = s.exists() ? s.data().text : '';
    });
  }
  refreshAdminStats();
}

async function adminAddBuild() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var n = document.getElementById('aN').value.trim();
  var t = document.getElementById('aT').value;
  var p = parseInt(document.getElementById('aP').value) || 0;
  var c = document.getElementById('aC').value.trim();
  var d = document.getElementById('aD').value.trim();
  var l = document.getElementById('aL').value.trim();
  if (!n || !d) { toast('Name and description required.', 'err'); return; }
  await addDoc(collection(db, 'builds'), {
    name: n, type: t, price: p, cat: c, desc: d, link: l, contact: '',
    photoURL: null, buildFileURL: null, buildFileName: null,
    submitterUid: 'owner', submitterName: 'owner',
    featured: false, status: 'approved', views: 0, createdAt: serverTimestamp()
  });
  ['aN', 'aP', 'aC', 'aD', 'aL'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  renderBuildPanel(); updateHomeStats(); refreshAdminStats();
  toast('Build added!', 'ok');
}

async function renderBuildPanel() {
  await renderPendingPanel();
  var el = document.getElementById('buildPanelList'); if (!el) return;
  var snap = await getDocs(query(collection(db, 'builds'), where('status', '==', 'approved'), orderBy('createdAt', 'desc')));
  if (snap.empty) { el.innerHTML = '<div class="empty-state" style="padding:20px">No approved builds yet</div>'; return; }
  el.innerHTML = snap.docs.map(function(d) {
    var b = Object.assign({ id: d.id }, d.data()); var ip = b.type === 'premium';
    return '<div class="pl-item">' +
      '<div class="pl-thumb">' + (b.photoURL ? '<img src="' + b.photoURL + '" style="width:100%;height:100%;object-fit:cover">' : 'o') + '</div>' +
      '<div class="pl-info">' +
      '<div class="pl-name">' + esc(b.name) + '<span class="chip ' + (ip ? 'ch-prem' : 'ch-free') + '">' + (ip ? 'PREMIUM' : 'FREE') + '</span>' + (b.featured ? '<span class="chip" style="color:var(--gold)">FEAT</span>' : '') + '</div>' +
      '<div class="pl-meta">' + (ip ? 'Rp ' + Number(b.price || 0).toLocaleString('id-ID') : 'FREE') + ' - ' + esc(b.cat || '--') + ' - views: ' + (b.views || 0) + '</div>' +
      '</div>' +
      '<div class="pl-actions">' +
      (CU.role === 'owner' ? '<button class="btn-feat" onclick="toggleFeatured(\'' + b.id + '\',' + b.featured + ')">' + (b.featured ? 'unfeature' : 'feature') + '</button>' : '') +
      '<button class="btn-del" onclick="deleteBuild(\'' + b.id + '\',\'' + esc(b.buildFileURL || '') + '\')">del</button>' +
      '</div></div>';
  }).join('');
}

async function filterAdminBuilds(q) {
  var el = document.getElementById('buildPanelList'); if (!el) return;
  var snap = await getDocs(query(collection(db, 'builds'), where('status', '==', 'approved')));
  var filtered = snap.docs.filter(function(d) {
    var b = d.data();
    return !q || (b.name || '').toLowerCase().includes(q.toLowerCase()) || (b.cat || '').toLowerCase().includes(q.toLowerCase());
  });
  if (!filtered.length) { el.innerHTML = '<div class="empty-state" style="padding:18px">No results</div>'; return; }
  el.innerHTML = filtered.map(function(d) {
    var b = Object.assign({ id: d.id }, d.data()); var ip = b.type === 'premium';
    return '<div class="pl-item">' +
      '<div class="pl-thumb">' + (b.photoURL ? '<img src="' + b.photoURL + '" style="width:100%;height:100%;object-fit:cover">' : 'o') + '</div>' +
      '<div class="pl-info"><div class="pl-name">' + esc(b.name) + '</div><div class="pl-meta">' + (ip ? 'Rp ' + Number(b.price || 0).toLocaleString('id-ID') : 'FREE') + '</div></div>' +
      '<div class="pl-actions">' +
      (CU.role === 'owner' ? '<button class="btn-feat" onclick="toggleFeatured(\'' + b.id + '\',' + b.featured + ')">' + (b.featured ? 'unfeature' : 'feature') + '</button>' : '') +
      '<button class="btn-del" onclick="deleteBuild(\'' + b.id + '\',\'' + esc(b.buildFileURL || '') + '\')">del</button>' +
      '</div></div>';
  }).join('');
}

async function renderPendingPanel() {
  if (CU.role !== 'owner') return;
  var el = document.getElementById('pendingList');
  var badge = document.getElementById('pendBadge');
  if (!el) return;
  var snap = await getDocs(query(collection(db, 'builds'), where('status', '==', 'pending'), orderBy('createdAt', 'asc')));
  if (badge) badge.textContent = snap.size;
  if (snap.empty) { el.innerHTML = '<div class="empty-state" style="padding:14px">No pending builds</div>'; return; }
  el.innerHTML = snap.docs.map(function(d) {
    var b = Object.assign({ id: d.id }, d.data());
    return '<div class="pl-item">' +
      '<div class="pl-thumb">' + (b.photoURL ? '<img src="' + b.photoURL + '" style="width:100%;height:100%;object-fit:cover">' : 'o') + '</div>' +
      '<div class="pl-info"><div class="pl-name">' + esc(b.name) + '<span class="chip ch-pending">PENDING</span></div>' +
      '<div class="pl-meta">By: ' + esc(b.submitterName || '--') + ' - ' + (b.type === 'premium' ? 'Rp ' + Number(b.price || 0).toLocaleString('id-ID') : 'FREE') + ' - <a href="' + esc(b.link || '#') + '" target="_blank" style="color:var(--a)">Preview</a></div></div>' +
      '<div class="pl-actions"><button class="btn-approve" onclick="approveBuild(\'' + b.id + '\')">APPROVE</button>' +
      '<button class="btn-del" onclick="rejectBuild(\'' + b.id + '\')">REJECT</button></div></div>';
  }).join('');
}

async function deleteBuild(id, fileURL) {
  if (!confirm('Delete this build?')) return;
  await deleteDoc(doc(db, 'builds', id));
  if (fileURL) { try { await deleteObject(ref(stor, fileURL)); } catch(e) {} }
  renderBuildPanel(); updateHomeStats(); refreshAdminStats();
  toast('Build deleted.', 'info');
}

async function toggleFeatured(id, current) {
  if (CU.role !== 'owner') return;
  await updateDoc(doc(db, 'builds', id), { featured: !current });
  renderBuildPanel();
  toast(!current ? 'Featured!' : 'Removed from featured.', 'info');
}

async function approveBuild(id) {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  await updateDoc(doc(db, 'builds', id), { status: 'approved' });
  renderBuildPanel(); updateHomeStats(); refreshAdminStats();
  toast('Approved!', 'ok');
}

async function rejectBuild(id) {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  if (!confirm('Reject and delete?')) return;
  await deleteDoc(doc(db, 'builds', id));
  renderBuildPanel(); refreshAdminStats();
  toast('Rejected.', 'info');
}

async function renderUserPanel() {
  if (CU.role !== 'owner') return;
  var grid = document.getElementById('userCardsGrid'); if (!grid) return;
  var snap = await getDocs(collection(db, 'users'));
  grid.innerHTML = snap.docs.map(function(d) {
    var u = Object.assign({ id: d.id }, d.data());
    return '<div class="ucrd">' +
      '<div class="ucrd-top"><div class="ucrd-av ' + u.role + '">' + (u.username || '?')[0].toUpperCase() + '</div>' +
      '<div><div class="ucrd-name">' + esc(u.username) + '<span class="chip ch-' + u.role + '">' + u.role.toUpperCase() + '</span></div>' +
      '<div class="ucrd-email">' + esc(u.email) + '</div></div></div>' +
      '<div class="ucrd-btns">' + (u.uid !== CU.uid ? '<button class="btn-ucrd-del" onclick="deleteUser(\'' + u.id + '\')">DELETE</button>' : '') + '</div></div>';
  }).join('');
}

async function deleteUser(uid) {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  if (!confirm('Delete this user?')) return;
  await deleteDoc(doc(db, 'users', uid));
  renderUserPanel(); refreshAdminStats();
  toast('User deleted.', 'info');
}

async function doBanIp() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var ip  = document.getElementById('banIpIn').value.trim();
  var rsn = document.getElementById('banRsnIn').value.trim();
  if (!ip) { toast('Enter identifier.', 'err'); return; }
  await setDoc(doc(db, 'bans', ip), { ip: ip, reason: rsn || 'Violated rules', bannedBy: CU.username, bannedAt: serverTimestamp() });
  document.getElementById('banIpIn').value = '';
  document.getElementById('banRsnIn').value = '';
  renderBanPanel(); refreshAdminStats();
  toast(ip + ' banned.', 'ok');
}

async function unbanIp(ip) {
  if (!confirm('Unban ' + ip + '?')) return;
  await deleteDoc(doc(db, 'bans', ip));
  renderBanPanel(); refreshAdminStats();
  toast(ip + ' unbanned.', 'ok');
}

async function renderBanPanel() {
  if (CU.role !== 'owner') return;
  var el = document.getElementById('banPanelList'); if (!el) return;
  var snap = await getDocs(collection(db, 'bans'));
  if (snap.empty) { el.innerHTML = '<div class="empty-state" style="padding:18px">No bans</div>'; return; }
  el.innerHTML = snap.docs.map(function(d) {
    var b = d.data();
    return '<div class="pl-item">' +
      '<div class="pl-thumb">X</div>' +
      '<div class="pl-info"><div class="pl-name" style="color:var(--r)">' + esc(b.ip) + '</div>' +
      '<div class="pl-meta">Reason: ' + esc(b.reason) + ' - By: ' + esc(b.bannedBy) + '</div></div>' +
      '<div class="pl-actions"><button class="btn-unban" onclick="unbanIp(\'' + esc(b.ip) + '\')">UNBAN</button></div></div>';
  }).join('');
}

function doResetPassword() {
  toast('Go to Firebase Console > Authentication > Users to reset passwords.', 'info');
}

async function generateStaffCode() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = 'STAFF-';
  for (var i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (var j = 0; j < 4; j++) code += chars[Math.floor(Math.random() * chars.length)];
  await setDoc(doc(db, 'staffCodes', code), { code: code, used: false, createdBy: CU.username, createdAt: serverTimestamp() });
  var box = document.getElementById('genCodeBox');
  var val = document.getElementById('genCodeVal');
  if (box) box.style.display = 'block';
  if (val) val.textContent = code;
  renderCodesPanel();
  toast('Code: ' + code, 'ok');
}

async function revokeCode(code) {
  if (!confirm('Revoke ' + code + '?')) return;
  await deleteDoc(doc(db, 'staffCodes', code));
  renderCodesPanel();
  toast('Revoked.', 'info');
}

async function renderCodesPanel() {
  if (CU.role !== 'owner') return;
  var el = document.getElementById('staffCodeList'); if (!el) return;
  var snap = await getDocs(collection(db, 'staffCodes'));
  if (snap.empty) { el.innerHTML = '<div class="empty-state" style="padding:14px">No codes yet.</div>'; return; }
  el.innerHTML = snap.docs.map(function(d) {
    var c = d.data();
    return '<div class="code-row"><div class="cr-code">' + esc(c.code) + '</div>' +
      '<span class="chip ' + (c.used ? 'ch-used' : 'ch-active') + '">' + (c.used ? 'USED' : 'ACTIVE') + '</span>' +
      (c.used ? '<span style="font-family:var(--fm);font-size:.58rem;color:var(--t2)">by ' + esc(c.usedBy || '?') + '</span>'
               : '<button class="btn-revoke" onclick="revokeCode(\'' + esc(c.code) + '\')">REVOKE</button>') +
      '</div>';
  }).join('');
}

async function exportData() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  var results = await Promise.all([
    getDocs(collection(db, 'builds')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'bans'))
  ]);
  var data = {
    exportedAt: new Date().toISOString(),
    builds: results[0].docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }),
    users:  results[1].docs.map(function(d) { return Object.assign({ id: d.id }, d.data(), { pwHash: '[HIDDEN]' }); }),
    bans:   results[2].docs.map(function(d) { return d.data(); })
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'oxyx-store-' + Date.now() + '.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Exported!', 'ok');
}

async function clearAllBuilds() {
  if (CU.role !== 'owner') { toast('Owner only.', 'err'); return; }
  if (!confirm('Delete ALL builds permanently?')) return;
  var snap = await getDocs(collection(db, 'builds'));
  await Promise.all(snap.docs.map(function(d) { return deleteDoc(d.ref); }));
  renderBuildPanel(); updateHomeStats(); refreshAdminStats();
  toast('All builds cleared.', 'warn');
}

// ============================
// MISC
// ============================
function toggleFaq(el) {
  var isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function(x) { x.classList.remove('open'); });
  if (!isOpen) el.classList.add('open');
}

function toggleNotifPanel() {
  var p = document.getElementById('notifPanel'); if (!p) return;
  notifOpen = !notifOpen;
  p.style.display = notifOpen ? 'block' : 'none';
}

function clearNotifs() {
  var el = document.getElementById('notifList');
  if (el) el.innerHTML = '<div class="ni-empty">No notifications</div>';
  var d = document.getElementById('notifDot'); if (d) d.style.display = 'none';
  notifOpen = false;
  var p = document.getElementById('notifPanel'); if (p) p.style.display = 'none';
}

// -- Drag & Drop --
['buildDropZone', 'photoDropZone'].forEach(function(id) {
  var zone = document.getElementById(id); if (!zone) return;
  zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.style.borderColor = 'var(--a)'; });
  zone.addEventListener('dragleave', function() { zone.style.borderColor = ''; });
  zone.addEventListener('drop', function(e) {
    e.preventDefault(); zone.style.borderColor = '';
    var file = e.dataTransfer.files[0]; if (!file) return;
    if (id === 'buildDropZone') handleBuildFile({ files: [file], value: '' });
    else handlePhotoFile({ files: [file], value: '' });
  });
});

// -- Keyboard --
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeModal(); closeSearch(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
});

// ============================
// INIT
// ============================
runLoader(function() {
  document.getElementById('screenAuth').style.display = 'flex';
  initCursor();
});

// Export to window for HTML onclick handlers
Object.assign(window, {
  switchTab, toggleEye, doLogin, doRegister, doLogout,
  goTo, toggleNav,
  openSearch, closeSearch, doSearch,
  openModal, closeModal, handleBuy, handleDL,
  toggleWishlist,
  handleBuildFile, handlePhotoFile, submitBuild, clearIbError,
  applyFilter, toggleFaq,
  renderProfile, initAdminPanel, switchAdminTab,
  adminAddBuild, filterAdminBuilds,
  approveBuild, rejectBuild, deleteBuild, toggleFeatured,
  renderUserPanel, deleteUser,
  doBanIp, unbanIp, doResetPassword,
  generateStaffCode, revokeCode,
  saveAnnouncement, clearAnnouncement,
  exportData, clearAllBuilds,
  onPwInput, toggleNotifPanel, clearNotifs
});
