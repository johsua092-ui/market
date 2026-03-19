/* ═══════════════════════════════════
   OXYX STORE — security.js
   Anti-DevTools & Shortcut Protection
   ═══════════════════════════════════ */
(function(){
  'use strict';

  /* ── Disable right-click context menu ── */
  document.addEventListener('contextmenu', function(e){
    e.preventDefault();
    return false;
  });

  /* ── Block keyboard shortcuts that expose source/devtools ── */
  document.addEventListener('keydown', function(e){
    const k = e.key.toUpperCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // F12 — DevTools
    if(e.key === 'F12'){ e.preventDefault(); e.stopPropagation(); return false; }

    // Ctrl+Shift+I — DevTools
    if(ctrl && shift && k === 'I'){ e.preventDefault(); e.stopPropagation(); return false; }

    // Ctrl+Shift+J — Console
    if(ctrl && shift && k === 'J'){ e.preventDefault(); e.stopPropagation(); return false; }

    // Ctrl+Shift+C — Inspector
    if(ctrl && shift && k === 'C'){ e.preventDefault(); e.stopPropagation(); return false; }

    // Ctrl+U — View Source
    if(ctrl && k === 'U'){ e.preventDefault(); e.stopPropagation(); return false; }

    // Ctrl+S — Save page
    if(ctrl && k === 'S'){ e.preventDefault(); e.stopPropagation(); return false; }

    // Ctrl+A — Select All (outside inputs)
    if(ctrl && k === 'A'){
      const tag = document.activeElement.tagName;
      if(tag !== 'INPUT' && tag !== 'TEXTAREA'){
        e.preventDefault(); return false;
      }
    }

    // Ctrl+P — Print
    if(ctrl && k === 'P'){ e.preventDefault(); e.stopPropagation(); return false; }
  });

  /* ── DevTools size-change detection ── */
  const devToolsThreshold = 160;
  let devToolsOpen = false;

  function detectDevTools(){
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    if(widthDiff > devToolsThreshold || heightDiff > devToolsThreshold){
      if(!devToolsOpen){
        devToolsOpen = true;
        onDevToolsDetected();
      }
    } else {
      devToolsOpen = false;
    }
  }

  function onDevToolsDetected(){
    // Clear sensitive DOM content when devtools detected
    const app = document.getElementById('mainApp');
    if(app && app.style.display !== 'none'){
      // Don't fully break the app — just show warning overlay
      showSecurityWarning();
    }
  }

  function showSecurityWarning(){
    let overlay = document.getElementById('secWarnOverlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'secWarnOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,5,8,.98);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Orbitron,monospace;color:#ff2d55;text-align:center;cursor:default';
      overlay.innerHTML = `
        <div style="font-size:3rem;margin-bottom:20px">⚠</div>
        <div style="font-size:1.2rem;font-weight:900;letter-spacing:.15em;margin-bottom:12px">SECURITY WARNING</div>
        <div style="font-family:Share Tech Mono,monospace;font-size:.75rem;color:#5a7585;letter-spacing:.1em;max-width:400px;line-height:1.8">Developer tools detected.<br>Please close DevTools to continue.</div>
        <button onclick="document.getElementById('secWarnOverlay').remove()" style="margin-top:24px;padding:10px 24px;background:rgba(255,45,85,.1);border:1px solid rgba(255,45,85,.3);border-radius:8px;color:#ff2d55;font-family:Share Tech Mono,monospace;font-size:.7rem;letter-spacing:.1em;cursor:pointer">I UNDERSTAND — CLOSE DEVTOOLS</button>
      `;
      document.body.appendChild(overlay);
    }
  }

  /* Run detection every 1 second */
  setInterval(detectDevTools, 1000);

  /* ── Disable drag on images ── */
  document.addEventListener('dragstart', function(e){
    e.preventDefault();
    return false;
  });

  /* ── Console warning message ── */
  const _consoleWarn = [
    '%c⚠ OXYX STORE — SECURITY WARNING',
    'color:#ff2d55;font-size:20px;font-weight:bold;font-family:monospace',
  ];
  const _consoleWarn2 = [
    '%cThis console is for developer use only.\nDo NOT paste or run any code here — doing so may compromise your account.',
    'color:#5a7585;font-size:14px;font-family:monospace',
  ];

  // Delay to show after load
  setTimeout(function(){
    console.warn(..._consoleWarn);
    console.warn(..._consoleWarn2);
  }, 2000);

  /* ── Override console in production ── */
  // Only override if not in dev mode (allow normal console for owners debugging)
  // We keep console available but add warning

  /* ── Prevent iframe embedding ── */
  if(window.self !== window.top){
    window.top.location = window.self.location;
  }

})();
