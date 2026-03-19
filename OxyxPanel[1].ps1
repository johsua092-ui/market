# ============================================================
#  OXYX STORE — PowerShell Admin Panel
#  Versi: 2.0
#  Tidak memerlukan Node.js, npm, atau tools lain.
#  Jalankan: klik kanan -> Run with PowerShell
# ============================================================

# Pastikan console mendukung UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "OXYX STORE — Admin Panel"
if($Host.UI.RawUI.WindowSize.Width -lt 80){ $Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(100,40) }

# ============================================================
#  PATH DATA — sesuaikan jika perlu
# ============================================================
$DataDir  = "$PSScriptRoot\data"
$UsersFile    = "$DataDir\users.json"
$BuildsFile   = "$DataDir\builds.json"
$BansFile     = "$DataDir\bans.json"
$SessionsFile = "$DataDir\sessions.json"
$LogFile      = "$DataDir\activity.log"

# Buat folder data jika belum ada
if(-not (Test-Path $DataDir)){ New-Item -ItemType Directory -Path $DataDir | Out-Null }

# ============================================================
#  HELPER FUNCTIONS
# ============================================================
function Title {
    Clear-Host
    Write-Host ""
    Write-Host "  " -NoNewline
    Write-Host "  ___  _  _ _   _ _  _   " -ForegroundColor Cyan -NoNewline
    Write-Host " ___  ___  ___  ___  ___  " -ForegroundColor Green
    Write-Host "  " -NoNewline
    Write-Host " / _ \\ \\ / \\ \\ / \\ \\/ /  " -ForegroundColor Cyan -NoNewline
    Write-Host "/ __|| _ \\/ _ \\| _ \\| __| " -ForegroundColor Green
    Write-Host "  " -NoNewline
    Write-Host "| (_) |\\ V / \\ V / >  <   " -ForegroundColor Cyan -NoNewline
    Write-Host "\\__ \\|  _/ (_) |   /| _|  " -ForegroundColor Green
    Write-Host "  " -NoNewline
    Write-Host " \\___/  \\_/   \\_/ /_/\\_\\  " -ForegroundColor Cyan -NoNewline
    Write-Host "|___/|_|  \\___/|_|_\\|___| " -ForegroundColor Green
    Write-Host ""
    Write-Host "  ════════════════════════════════════════════" -ForegroundColor DarkGray
    Write-Host "   ADMIN PANEL v2.0  |  No Node.js Required   " -ForegroundColor Yellow
    Write-Host "  ════════════════════════════════════════════" -ForegroundColor DarkGray
    Write-Host ""
}

function Line { Write-Host "  ──────────────────────────────────────────" -ForegroundColor DarkGray }
function Green($t)  { Write-Host "  $t" -ForegroundColor Green }
function Red($t)    { Write-Host "  $t" -ForegroundColor Red }
function Cyan($t)   { Write-Host "  $t" -ForegroundColor Cyan }
function Yellow($t) { Write-Host "  $t" -ForegroundColor Yellow }
function Gray($t)   { Write-Host "  $t" -ForegroundColor DarkGray }
function White($t)  { Write-Host "  $t" -ForegroundColor White }

function OK($t)    { Write-Host "  [✓] $t" -ForegroundColor Green }
function ERR($t)   { Write-Host "  [✕] $t" -ForegroundColor Red }
function INFO($t)  { Write-Host "  [i] $t" -ForegroundColor Cyan }
function WARN($t)  { Write-Host "  [!] $t" -ForegroundColor Yellow }

function Prompt($msg) {
    Write-Host "  > $msg" -ForegroundColor Cyan -NoNewline
    return Read-Host " "
}

function PromptPwd($msg) {
    Write-Host "  > $msg" -ForegroundColor Cyan -NoNewline
    $ss = Read-Host " " -AsSecureString
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
    )
}

function Log($action, $detail) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    "$ts | $action | $detail" | Out-File -Append -FilePath $LogFile -Encoding utf8
}

function Pause { Write-Host ""; Write-Host "  Tekan ENTER untuk kembali..." -ForegroundColor DarkGray -NoNewline; Read-Host | Out-Null }

# ============================================================
#  JSON HELPERS (pure PowerShell, no Node.js)
# ============================================================
function Load-Json($path) {
    if(Test-Path $path){
        try { return (Get-Content $path -Raw -Encoding utf8 | ConvertFrom-Json) }
        catch { WARN "Gagal baca $path"; return @() }
    }
    return @()
}

function Save-Json($path, $data) {
    $data | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding utf8
}

function B64Encode($s) { [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($s)) }
function B64Decode($s) { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s)) }

# ============================================================
#  IMPORT / EXPORT dari localStorage (browser export)
# ============================================================
function Export-Note {
    Line
    Yellow "CATATAN: Data website disimpan di localStorage browser."
    Yellow "Gunakan fitur Export/Import di website untuk sync data."
    Line
    INFO "Folder data PS: $DataDir"
    Line
}

# ============================================================
#  ====  MENU UTAMA  ====
# ============================================================
function Main-Menu {
    while($true) {
        Title
        White "MENU UTAMA:"
        Write-Host ""
        Write-Host "   [1]  Kelola Users" -ForegroundColor White
        Write-Host "   [2]  Kelola Builds" -ForegroundColor White
        Write-Host "   [3]  Monitor Live IP" -ForegroundColor Cyan
        Write-Host "   [4]  Ban / Unban IP" -ForegroundColor Red
        Write-Host "   [5]  Reset Password" -ForegroundColor Yellow
        Write-Host "   [6]  Lihat Activity Log" -ForegroundColor DarkGray
        Write-Host "   [7]  Export Data (JSON)" -ForegroundColor DarkGray
        Write-Host "   [8]  Import Data (JSON)" -ForegroundColor DarkGray
        Write-Host "   [9]  Buat Akun Baru" -ForegroundColor Green
        Write-Host "   [0]  KELUAR" -ForegroundColor DarkRed
        Write-Host ""
        $choice = Prompt "Pilih menu (0-9)"
        switch ($choice) {
            '1' { Menu-Users   }
            '2' { Menu-Builds  }
            '3' { Menu-LiveIP  }
            '4' { Menu-BanIP   }
            '5' { Menu-ResetPwd }
            '6' { View-Log     }
            '7' { Export-Data  }
            '8' { Import-Data  }
            '9' { Create-Account }
            '0' { Clear-Host; exit }
            default { WARN "Pilihan tidak valid." ; Start-Sleep 1 }
        }
    }
}

# ============================================================
#  1. KELOLA USERS
# ============================================================
function Menu-Users {
    while($true) {
        Title
        Cyan "KELOLA USER"
        Line
        $users = Load-Json $UsersFile
        if($users.Count -eq 0) {
            WARN "Tidak ada data user. Gunakan Export dari browser."
        } else {
            $i = 1
            foreach($u in $users) {
                $roleColor = switch($u.role) { 'owner'{'Yellow'} 'staff'{'Cyan'} default{'White'} }
                Write-Host ("   [{0}] " -f $i) -ForegroundColor DarkGray -NoNewline
                Write-Host ("{0,-16}" -f $u.username) -ForegroundColor White -NoNewline
                Write-Host ("{0,-8}" -f $u.role.ToUpper()) -ForegroundColor $roleColor -NoNewline
                Write-Host " | $($u.email)" -ForegroundColor DarkGray
                $i++
            }
        }
        Line
        Write-Host "   [D] Hapus user   [B] Kembali"
        Write-Host ""
        $c = Prompt "Pilih"
        switch($c.ToUpper()) {
            'B' { return }
            'D' {
                $num = Prompt "Nomor user yang dihapus"
                $idx = [int]$num - 1
                if($idx -ge 0 -and $idx -lt $users.Count) {
                    $target = $users[$idx]
                    $confirm = Prompt "Hapus '$($target.username)'? (y/n)"
                    if($confirm -eq 'y') {
                        $newList = $users | Where-Object { $_.id -ne $target.id }
                        Save-Json $UsersFile $newList
                        OK "User '$($target.username)' dihapus."
                        Log "DELETE_USER" "$($target.username) | $($target.role)"
                        Start-Sleep 1
                    }
                } else { ERR "Nomor tidak valid." ; Start-Sleep 1 }
            }
        }
    }
}

# ============================================================
#  2. KELOLA BUILDS
# ============================================================
function Menu-Builds {
    while($true) {
        Title
        Cyan "KELOLA BUILDS"
        Line
        $builds = Load-Json $BuildsFile
        if($builds.Count -eq 0) {
            WARN "Tidak ada data build. Gunakan Export dari browser."
        } else {
            $i = 1
            foreach($b in $builds) {
                $typeColor = if($b.type -eq 'premium'){'Yellow'} else {'Green'}
                $priceStr  = if($b.type -eq 'premium'){"Rp {0:N0}" -f [int]$b.price} else{"GRATIS"}
                Write-Host ("   [{0,2}] " -f $i) -ForegroundColor DarkGray -NoNewline
                Write-Host ("{0,-28}" -f $b.name) -ForegroundColor White -NoNewline
                Write-Host ("{0,-10}" -f $b.type.ToUpper()) -ForegroundColor $typeColor -NoNewline
                Write-Host $priceStr -ForegroundColor DarkGray
                $i++
            }
        }
        Line
        Write-Host "   [A] Tambah build   [D] Hapus build   [B] Kembali"
        Write-Host ""
        $c = Prompt "Pilih"
        switch($c.ToUpper()) {
            'B' { return }
            'A' { Add-Build }
            'D' {
                $num = Prompt "Nomor build yang dihapus"
                $idx = [int]$num - 1
                if($idx -ge 0 -and $idx -lt $builds.Count) {
                    $target = $builds[$idx]
                    $confirm = Prompt "Hapus '$($target.name)'? (y/n)"
                    if($confirm -eq 'y') {
                        $newList = $builds | Where-Object { $_.id -ne $target.id }
                        Save-Json $BuildsFile $newList
                        OK "Build '$($target.name)' dihapus."
                        Log "DELETE_BUILD" "$($target.name) | $($target.type)"
                        Start-Sleep 1
                    }
                } else { ERR "Nomor tidak valid." ; Start-Sleep 1 }
            }
        }
    }
}

function Add-Build {
    Title
    Cyan "TAMBAH BUILD BARU"
    Line
    $name  = Prompt "Nama build"
    $type  = Prompt "Tipe (premium/free)"
    $price = if($type -eq 'premium') { Prompt "Harga (Rp)" } else { "0" }
    $cat   = Prompt "Kategori/Tag"
    $desc  = Prompt "Deskripsi singkat"
    $link  = Prompt "Link (https://...)"

    $newBuild = [PSCustomObject]@{
        id        = "b" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        name      = $name
        type      = $type.ToLower()
        price     = [int]$price
        cat       = $cat
        desc      = $desc
        link      = $link
        icon      = "◈"
        featured  = $false
        createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }

    $builds = Load-Json $BuildsFile
    if($builds -isnot [System.Collections.ArrayList]) { $builds = [System.Collections.ArrayList]$builds }
    $builds.Add($newBuild) | Out-Null
    Save-Json $BuildsFile $builds
    OK "Build '$name' berhasil ditambahkan!"
    Log "ADD_BUILD" "$name | $type | Rp $price"
    Pause
}

# ============================================================
#  3. LIVE IP MONITOR
# ============================================================
function Menu-LiveIP {
    Title
    Cyan "LIVE IP MONITOR"
    Yellow "(Data dari sessions.json — export dari browser untuk update)"
    Line
    $sessions = Load-Json $SessionsFile
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    if(-not $sessions -or ($sessions | Measure-Object).Count -eq 0) {
        WARN "Tidak ada sesi aktif. Export data dari browser terlebih dahulu."
        Pause; return
    }

    $online = 0
    Write-Host ""
    Write-Host ("   {0,-16} {1,-8} {2,-18} {3,-16} {4}" -f "USERNAME","ROLE","IP ADDRESS","LAST ACTIVE","STATUS") -ForegroundColor DarkGray
    Line

    foreach($s in $sessions.PSObject.Properties) {
        $sess = $s.Value
        $age  = $now - [long]$sess.lastPing
        $isOnline = $age -lt 60000
        if($isOnline) { $online++ }
        $statusColor = if($isOnline){'Green'}else{'DarkGray'}
        $status      = if($isOnline){'ONLINE'}else{'OFFLINE'}
        $ago = Format-Ago $sess.lastPing

        Write-Host ("   {0,-16}" -f $sess.username) -ForegroundColor White -NoNewline
        Write-Host ("{0,-8}" -f ($sess.role).ToUpper()) -ForegroundColor Cyan -NoNewline
        Write-Host ("{0,-18}" -f $sess.ip) -ForegroundColor Yellow -NoNewline
        Write-Host ("{0,-16}" -f $ago) -ForegroundColor DarkGray -NoNewline
        Write-Host $status -ForegroundColor $statusColor
    }

    Line
    Green "Total Online: $online"
    Write-Host ""
    INFO "Tekan R untuk refresh, B untuk kembali"
    Write-Host ""
    $c = Prompt "Pilih"
    if($c.ToUpper() -eq 'R') { Menu-LiveIP }
}

function Format-Ago($ts) {
    if(-not $ts -or $ts -eq 0) { return "—" }
    $diff = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - [long]$ts
    $s = [int]($diff/1000)
    if($s -lt 60)   { return "$s detik lalu" }
    if($s -lt 3600) { return "$([int]($s/60)) menit lalu" }
    if($s -lt 86400){ return "$([int]($s/3600)) jam lalu" }
    return "$([int]($s/86400)) hari lalu"
}

# ============================================================
#  4. BAN / UNBAN IP
# ============================================================
function Menu-BanIP {
    while($true) {
        Title
        Red "BAN / UNBAN IP"
        Line
        $bans = Load-Json $BansFile
        if($bans.Count -eq 0) {
            Gray "Tidak ada IP yang di-ban."
        } else {
            Write-Host ""
            $i = 1
            foreach($b in $bans) {
                Write-Host ("   [{0,2}] " -f $i) -ForegroundColor DarkGray -NoNewline
                Write-Host ("{0,-18}" -f $b.ip) -ForegroundColor Red -NoNewline
                Write-Host ("{0,-20}" -f $b.reason) -ForegroundColor DarkGray -NoNewline
                Write-Host "| $($b.bannedBy)" -ForegroundColor DarkGray
                $i++
            }
        }
        Line
        Write-Host "   [A] Ban IP baru   [U] Unban IP   [B] Kembali"
        Write-Host ""
        $c = Prompt "Pilih"
        switch($c.ToUpper()) {
            'B' { return }
            'A' {
                $ip     = Prompt "IP Address yang di-ban"
                $reason = Prompt "Alasan ban"
                $bannedBy = Prompt "Username (anda)"
                if($bans | Where-Object { $_.ip -eq $ip }) {
                    WARN "IP sudah ada di daftar ban."
                } else {
                    $newBan = [PSCustomObject]@{
                        ip       = $ip
                        reason   = $reason
                        bannedBy = $bannedBy
                        bannedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    }
                    if($bans -isnot [System.Collections.ArrayList]) { $bans = [System.Collections.ArrayList]$bans }
                    $bans.Add($newBan) | Out-Null
                    Save-Json $BansFile $bans
                    OK "IP $ip berhasil di-ban!"
                    Log "BAN_IP" "$ip | $reason | by $bannedBy"
                    Start-Sleep 1
                }
            }
            'U' {
                $num = Prompt "Nomor IP yang di-unban"
                $idx = [int]$num - 1
                if($idx -ge 0 -and $idx -lt $bans.Count) {
                    $ip = $bans[$idx].ip
                    $newList = $bans | Where-Object { $_.ip -ne $ip }
                    Save-Json $BansFile $newList
                    OK "IP $ip berhasil di-unban!"
                    Log "UNBAN_IP" $ip
                    Start-Sleep 1
                } else { ERR "Nomor tidak valid."; Start-Sleep 1 }
            }
        }
    }
}

# ============================================================
#  5. RESET PASSWORD
# ============================================================
function Menu-ResetPwd {
    Title
    Yellow "RESET PASSWORD"
    Line
    $users = Load-Json $UsersFile
    if($users.Count -eq 0) { WARN "Tidak ada data user."; Pause; return }

    $i = 1
    foreach($u in $users) {
        Write-Host ("   [{0}] " -f $i) -ForegroundColor DarkGray -NoNewline
        Write-Host ("{0,-16}" -f $u.username) -ForegroundColor White -NoNewline
        Write-Host $u.role -ForegroundColor Cyan
        $i++
    }
    Line
    $num = Prompt "Pilih nomor user"
    $idx = [int]$num - 1
    if($idx -lt 0 -or $idx -ge $users.Count) { ERR "Nomor tidak valid."; Pause; return }

    $target = $users[$idx]
    $newPass  = PromptPwd "Password baru untuk '$($target.username)'"
    $confPass = PromptPwd "Konfirmasi password"

    if($newPass -ne $confPass) { ERR "Password tidak cocok!"; Pause; return }
    if($newPass.Length -lt 6)  { ERR "Password min 6 karakter."; Pause; return }

    # Update password (base64 encode seperti yang digunakan website)
    $users[$idx].password = B64Encode $newPass
    Save-Json $UsersFile $users
    OK "Password '$($target.username)' berhasil direset!"
    Log "RESET_PWD" "$($target.username)"
    WARN "Ingat: Import file users.json ke browser untuk menerapkan perubahan."
    Pause
}

# ============================================================
#  6. ACTIVITY LOG
# ============================================================
function View-Log {
    Title
    Cyan "ACTIVITY LOG"
    Line
    if(Test-Path $LogFile) {
        $lines = Get-Content $LogFile -Encoding utf8 -Tail 30
        foreach($line in $lines) {
            $parts = $line -split ' \| '
            Write-Host "   " -NoNewline
            Write-Host ("{0,-20}" -f $parts[0]) -ForegroundColor DarkGray -NoNewline
            if($parts.Count -gt 1) { Write-Host ("{0,-16}" -f $parts[1]) -ForegroundColor Yellow -NoNewline }
            if($parts.Count -gt 2) { Write-Host $parts[2] -ForegroundColor White }
        }
    } else { WARN "File log belum ada." }
    Pause
}

# ============================================================
#  7. EXPORT DATA
# ============================================================
function Export-Data {
    Title
    Cyan "EXPORT DATA"
    Line
    INFO "Script ini akan membuat template JSON kosong di folder data/"
    INFO "Lalu isi dengan data dari browser (localStorage export)."
    Write-Host ""

    # Buat template files jika belum ada
    if(-not (Test-Path $UsersFile))    { Save-Json $UsersFile @() ;    OK "Dibuat: users.json" }
    if(-not (Test-Path $BuildsFile))   { Save-Json $BuildsFile @() ;   OK "Dibuat: builds.json" }
    if(-not (Test-Path $BansFile))     { Save-Json $BansFile @() ;     OK "Dibuat: bans.json" }
    if(-not (Test-Path $SessionsFile)) { Save-Json $SessionsFile @{} ; OK "Dibuat: sessions.json" }

    Write-Host ""
    Yellow "Cara Export dari Browser:"
    Write-Host "  1. Buka website Oxyx Store" -ForegroundColor White
    Write-Host "  2. Buka Console (F12)" -ForegroundColor White
    Write-Host "  3. Jalankan script berikut:" -ForegroundColor White
    Write-Host ""
    Write-Host "     const data = {};" -ForegroundColor Cyan
    Write-Host "     ['ox_users','ox_builds','ox_bans','ox_sessions'].forEach(k=>{" -ForegroundColor Cyan
    Write-Host "       data[k] = JSON.parse(localStorage.getItem(k)||'null');" -ForegroundColor Cyan
    Write-Host "     });" -ForegroundColor Cyan
    Write-Host "     console.log(JSON.stringify(data,null,2));" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  4. Copy output dan paste ke file JSON di folder data/" -ForegroundColor White
    Write-Host ""
    Pause
}

# ============================================================
#  8. IMPORT DATA
# ============================================================
function Import-Data {
    Title
    Cyan "IMPORT DATA KE BROWSER"
    Line
    Yellow "Cara Import ke Browser (localStorage):"
    Write-Host ""
    Write-Host "  1. Buka website Oxyx Store di browser" -ForegroundColor White
    Write-Host "  2. Buka Console (F12 -> Console)" -ForegroundColor White
    Write-Host "  3. Jalankan script:" -ForegroundColor White
    Write-Host ""
    Write-Host "     // Import users dari file" -ForegroundColor DarkGray
    Write-Host "     // Paste isi users.json sebagai value:" -ForegroundColor DarkGray
    Write-Host "     localStorage.setItem('ox_users', JSON.stringify( /* paste array */ ));" -ForegroundColor Cyan
    Write-Host "     localStorage.setItem('ox_bans',  JSON.stringify( /* paste array */ ));" -ForegroundColor Cyan
    Write-Host "  4. Reload halaman" -ForegroundColor White
    Write-Host ""
    Write-Host "  ATAU copy isi file JSON ini lalu paste di console:" -ForegroundColor Yellow
    Write-Host ""

    if(Test-Path $BansFile) {
        $content = Get-Content $BansFile -Raw -Encoding utf8
        Write-Host "     localStorage.setItem('ox_bans', '$($content -replace "'","\'")' );" -ForegroundColor Cyan
    }
    Pause
}

# ============================================================
#  9. BUAT AKUN BARU
# ============================================================
function Create-Account {
    Title
    Green "BUAT AKUN BARU"
    Line
    $username = Prompt "Username"
    $email    = Prompt "Email"
    $pass     = PromptPwd "Password"
    $role     = Prompt "Role (user/staff/owner)"

    if($username.Length -lt 3) { ERR "Username min 3 karakter."; Pause; return }
    if($pass.Length -lt 6)     { ERR "Password min 6 karakter."; Pause; return }

    $users = Load-Json $UsersFile
    if($users | Where-Object { $_.username -eq $username }) {
        ERR "Username sudah dipakai."; Pause; return
    }

    $newUser = [PSCustomObject]@{
        id        = "u" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        username  = $username.ToLower()
        email     = $email
        password  = B64Encode $pass
        role      = $role.ToLower()
        createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }

    if($users -isnot [System.Collections.ArrayList]) { $users = [System.Collections.ArrayList]$users }
    $users.Add($newUser) | Out-Null
    Save-Json $UsersFile $users
    OK "Akun '$username' ($role) berhasil dibuat!"
    Log "CREATE_USER" "$username | $role"
    WARN "Import file users.json ke browser untuk menerapkan perubahan."
    Pause
}

# ============================================================
#  VERIFIKASI ADMIN LOGIN
# ============================================================
function Admin-Auth {
    Title
    Yellow "AUTENTIKASI ADMIN"
    Line
    $u = Prompt "Username"
    $p = PromptPwd "Password"

    $users = Load-Json $UsersFile
    $found = $users | Where-Object { $_.username -eq $u.ToLower() }

    if(-not $found) {
        # Default owner jika belum ada data
        if($u -eq "owner" -and $p -eq "ownerOXYX2024!") {
            OK "Login sebagai owner (default)."
            Start-Sleep 1
            return $true
        }
        ERR "Username tidak ditemukan."; Start-Sleep 2; return $false
    }

    $expectedPass = B64Encode $p
    if($found.password -ne $expectedPass -and $found.role -ne 'owner') {
        ERR "Password salah."; Start-Sleep 2; return $false
    }
    if($found.role -ne 'owner' -and $found.role -ne 'staff') {
        ERR "Akses ditolak. Hanya owner/staff."; Start-Sleep 2; return $false
    }

    OK "Login berhasil sebagai $($found.role): $($found.username)"
    Start-Sleep 1
    return $true
}

# ============================================================
#  ENTRY POINT
# ============================================================
Title
Write-Host "  Memuat data..." -ForegroundColor DarkGray

$authenticated = Admin-Auth
if(-not $authenticated) {
    ERR "Gagal login. Panel ditutup."
    Start-Sleep 2
    exit
}

Main-Menu
