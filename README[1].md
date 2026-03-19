# 🌐 OXYX STORE — Elite Build Marketplace

Website marketplace premium untuk jual-beli online build. Ultra-aesthetic dengan efek 3D, glassmorphism, dan neon glow.

---

## 🚀 Deploy ke GitHub Pages (TANPA SERVER)

1. Buat repository baru di GitHub
2. Upload **semua file** ini:
   ```
   index.html
   style.css
   app.js
   scene.js
   OxyxPanel.ps1
   ```
3. Buka **Settings → Pages → Source: main / root**
4. Website langsung live:
   ```
   https://username.github.io/nama-repo/
   ```

---

## 🔑 Akun Default Website

| Role   | Username | Password          |
|--------|----------|-------------------|
| Owner  | `owner`  | `ownerOXYX2024!`  |
| Staff  | `staff1` | `staff1pass2024`  |
| Staff  | `staff2` | `staff2pass2024`  |

**⚠ Ganti password setelah pertama login via Panel → Reset Password**

---

## 🛡 Kode Registrasi Khusus

| Role  | Kode                   | Slot |
|-------|------------------------|------|
| Staff | `OXYX-STAFF-2024`      | 2    |
| Staff | `OXYX-STAFF-ELITE`     | 2    |
| Owner | `OXYX-OWNER-MASTER-2024` | 1  |

Kode dimasukkan saat **Register** untuk mendapatkan role Staff/Owner.

---

## ⚙️ Fitur

### Website
- ✅ Three.js 3D background (geometri floating + particles)
- ✅ Mouse 3D tilt effect pada build cards
- ✅ Holographic shimmer + neon glow
- ✅ Custom cursor dengan glow
- ✅ Loading screen animasi
- ✅ Login / Register sistem
- ✅ **Single-session IP enforcement** (owner & staff)
- ✅ **Ban IP** — blokir akses permanen dari IP tertentu
- ✅ **Live IP Monitor** (refresh 10 detik)
- ✅ **Reset Password** oleh owner
- ✅ Build management (tambah/hapus)
- ✅ User management
- ✅ 15+ build default (premium & free)
- ✅ Filter build: Semua / Premium / Gratis
- ✅ Modal detail build
- ✅ Toast notification
- ✅ Semua data di localStorage (no server)

### Role & Permission
| Fitur                    | Owner | Staff | User |
|--------------------------|:-----:|:-----:|:----:|
| Tambah build             | ✅    | ✅    | ✗    |
| Hapus build              | ✅    | ✅    | ✗    |
| Live IP Monitor          | ✅    | ✅    | ✗    |
| Ban IP dari panel        | ✅    | ✅    | ✗    |
| Reset password user lain | ✅    | ✗     | ✗    |
| Hapus user               | ✅    | ✗     | ✗    |

---

## 💻 PowerShell Admin Panel (OxyxPanel.ps1)

**TIDAK memerlukan Node.js, npm, atau tools tambahan apapun!**  
Cukup PowerShell bawaan Windows.

### Cara Jalankan:
```
Klik kanan OxyxPanel.ps1 → Run with PowerShell
```

### Atau via terminal:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\OxyxPanel.ps1
```

### Fitur Panel:
1. **Kelola Users** — lihat, hapus user
2. **Kelola Builds** — tambah, hapus build
3. **Monitor Live IP** — lihat sesi aktif
4. **Ban/Unban IP** — blokir & buka IP
5. **Reset Password** — ganti password user
6. **Activity Log** — log semua aksi admin
7. **Export Data** — panduan export dari browser
8. **Import Data** — panduan import ke browser
9. **Buat Akun Baru** — buat user langsung dari PS

### Default Login Panel:
- Username: `owner`
- Password: `ownerOXYX2024!`

---

## 🔐 Sistem IP Whitelist

1. Owner/Staff login → IP otomatis terekam
2. Jika akun sudah login dari IP A, tidak bisa login dari IP B
3. Session dianggap aktif selama 3 menit setelah last ping
4. Ping otomatis setiap 25 detik
5. Owner bisa ban IP dari Live Monitor atau tab Ban IP

---

## 📦 Tech Stack

- **HTML5** — semantic, accessible
- **CSS3** — CSS variables, 3D transforms, glassmorphism
- **JavaScript (ES6+)** — vanilla JS, no framework
- **Three.js r128** — 3D WebGL background (CDN, no download)
- **Google Fonts** — Orbitron, Rajdhani, Share Tech Mono (CDN)
- **PowerShell 5.1+** — admin panel, no dependencies
- **localStorage** — database (no backend needed)

---

> Made with ⚡ by **OXYX STORE**
