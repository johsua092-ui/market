# ╔══════════════════════════════════════════════════════════════════╗
# ║                                                                  ║
# ║        ██████╗ ██╗  ██╗██╗   ██╗██╗  ██╗                       ║
# ║       ██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝╚██╗██╔╝                       ║
# ║       ██║   ██║ ╚███╔╝  ╚████╔╝  ╚███╔╝                        ║
# ║       ██║   ██║ ██╔██╗   ╚██╔╝   ██╔██╗                        ║
# ║       ╚██████╔╝██╔╝ ██╗   ██║   ██╔╝ ██╗                       ║
# ║        ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝  STORE               ║
# ║                                                                  ║
# ║           POWERSHELL ADMIN PANEL — OWNER ONLY                   ║
# ║                                                                  ║
# ╠══════════════════════════════════════════════════════════════════╣
# ║  CARA JALANKAN:                                                  ║
# ║    • Klik kanan file ini -> "Run with PowerShell"                ║
# ║    • Atau: powershell -ExecutionPolicy Bypass -File .\...ps1    ║
# ║                                                                  ║
# ║  LOGIN DEFAULT:                                                  ║
# ║    Username : owner                                              ║
# ║    Password : 29u39ShSSSSUA                                      ║
# ║                                                                  ║
# ║  SYNC DENGAN WEBSITE:                                            ║
# ║    Panel baca/tulis file JSON di folder data\                    ║
# ║    Detail lengkap: login dulu, pilih menu [9]                   ║
# ╚══════════════════════════════════════════════════════════════════╝

#Requires -Version 5.1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try { $Host.UI.RawUI.WindowTitle = "OXYX STORE — Admin Panel" } catch {}
try {
    $sz = $Host.UI.RawUI.WindowSize
    if ($sz.Width -lt 100) {
        $Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(110,48)
        $Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(110,9999)
    }
} catch {}

# ── PATHS ──────────────────────────────────────────────
$Root    = $PSScriptRoot
$DataDir = Join-Path $Root "data"
$UFile   = Join-Path $DataDir "users.json"
$BFile   = Join-Path $DataDir "builds.json"
$BanFile = Join-Path $DataDir "bans.json"
$SFile   = Join-Path $DataDir "sessions.json"
$CFile   = Join-Path $DataDir "codes.json"
$AnnFile = Join-Path $DataDir "announcement.txt"
$LogFile = Join-Path $DataDir "activity.log"
$ExpFile = Join-Path $DataDir "EXPORT_snippet.js"

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }

# ── UI HELPERS ─────────────────────────────────────────
function W($t,$c='White'){Write-Host $t -ForegroundColor $c -NoNewline}
function WL($t='',$c='White'){Write-Host $t -ForegroundColor $c}
function BigLine{$w=[Math]::Min(($Host.UI.RawUI.WindowSize.Width-2),80);WL("  "+"═"*$w)'DarkCyan'}
function ThinLine{$w=[Math]::Min(($Host.UI.RawUI.WindowSize.Width-2),80);WL("  "+"─"*$w)'DarkGray'}
function OK($t){WL "  ✓  $t" 'Green'}
function ERR($t){WL "  ✕  $t" 'Red'}
function INFO($t){WL "  ℹ  $t" 'Cyan'}
function WARN($t){WL "  ⚠  $t" 'Yellow'}

function Header($title,$sub=''){
    Clear-Host
    WL ''
    BigLine
    W "  ║  " 'DarkCyan'; W "OX" 'White'; W "YX" 'Cyan'; W " STORE" 'White'
    W "  ·  " 'DarkGray'; W $title 'Yellow'; WL ''
    if($sub){W "  ║  " 'DarkCyan'; WL "  $sub" 'DarkGray'}
    BigLine; WL ''
}

function Ask($prompt,$c='Cyan'){W "  ► $prompt : " $c; return Read-Host}
function AskPwd($prompt){
    W "  ► $prompt : " 'Cyan'
    $s=Read-Host -AsSecureString
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}
function Confirm($msg){W "  ► $msg (y/n) : " 'Yellow'; return (Read-Host).ToLower()-eq'y'}
function AnyKey{WL ''; W "  ↵  Tekan ENTER untuk lanjut..." 'DarkGray'; Read-Host|Out-Null}

# ── JSON & DATA ────────────────────────────────────────
function Load($p){
    if(Test-Path $p){try{return Get-Content $p -Raw -Encoding UTF8|ConvertFrom-Json}catch{WARN "Gagal baca: $p";return @()}}
    return @()
}
function Save($p,$d){$d|ConvertTo-Json -Depth 12|Set-Content $p -Encoding UTF8}
function ToList($d){
    $a=[System.Collections.ArrayList]@()
    foreach($i in @($d)){if($null-ne $i){[void]$a.Add($i)}}
    return $a
}
function NowMs{return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
function TimeAgo($ms){
    if(-not $ms -or $ms-eq 0){return "—"}
    $diff=(NowMs)-[long]$ms; $s=[int]($diff/1000)
    if($s-lt 60){return "$s""d lalu"}
    if($s-lt 3600){return "$([int]($s/60))""m lalu"}
    if($s-lt 86400){return "$([int]($s/3600))""j lalu"}
    return "$([int]($s/86400)) hari lalu"
}
function EnsureFiles{
    if(-not(Test-Path $UFile)){Save $UFile @()}
    if(-not(Test-Path $BFile)){Save $BFile @()}
    if(-not(Test-Path $BanFile)){Save $BanFile @()}
    if(-not(Test-Path $CFile)){Save $CFile @()}
    if(-not(Test-Path $SFile)){'{}' | Set-Content $SFile -Encoding UTF8}
}
function Log($action,$detail=''){
    "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))  |  $action  |  $detail"|Add-Content $LogFile -Encoding UTF8
}

# ── PASSWORD HASH ← sama persis dengan app.js ──────────
function HashPassword($pw){
    $salt="OXYX_STORE_SECURE_2024"
    $rev=-join $salt.ToCharArray()[($salt.Length-1)..0]
    $str=$salt+$pw+$rev
    $h=[uint32]5381
    foreach($ch in $str.ToCharArray()){$h=(($h -shl 5)+$h) -bxor [uint32][char]$ch}
    $h2=[uint32]0x811c9dc5
    foreach($ch in $str.ToCharArray()){$h2=$h2 -bxor [uint32][char]$ch;$h2=[uint32](([uint64]$h2*[uint64]0x01000193) -band 0xFFFFFFFF)}
    return $h.ToString("x")+$h2.ToString("x")
}

# ══════════════════════════════════════════════════════
#  AUTH
# ══════════════════════════════════════════════════════
function Auth{
    Header "AUTHENTICATION"
    WL "  Masukkan kredensial owner/staff untuk mengakses panel." 'DarkGray'
    WL "  Default: username=owner  password=29u39ShSSSSUA" 'DarkGray'
    WL ''; ThinLine; WL ''

    $u=Ask "Username"; $p=AskPwd "Password"; WL ''

    $users=Load $UFile
    $found=@($users)|Where-Object{$_.username -and $_.username.ToLower()-eq$u.ToLower()}

    if($found){
        if($found.pwHash -ne (HashPassword $p)){ERR "Password salah.";Start-Sleep 2;return $null}
        if($found.role -notin @('owner','staff')){ERR "Bukan akun admin.";Start-Sleep 2;return $null}
        OK "Login berhasil: $($found.role.ToUpper()) — $($found.username)"
        Log "LOGIN" "$($found.username)|$($found.role)"
        Start-Sleep 1
        return @{username=$found.username;role=$found.role}
    }

    if($u.ToLower()-eq'owner' -and $p-eq'29u39ShSSSSUA'){
        OK "Login berhasil: OWNER (default credentials)"
        WARN "Lakukan sync dari website untuk load data real. (Menu [9])"
        Start-Sleep 2
        return @{username='owner';role='owner'}
    }

    ERR "Username tidak ditemukan atau password salah."; Start-Sleep 2; return $null
}

# ══════════════════════════════════════════════════════
#  MAIN MENU
# ══════════════════════════════════════════════════════
function MainMenu($sess){
    while($true){
        $role=$sess.role; $username=$sess.username; $isOwner=$role-eq'owner'
        $builds=@(Load $BFile); $users=@(Load $UFile); $bans=@(Load $BanFile)
        $pending=@($builds)|Where-Object{$_.status-eq'pending'}
        $sessions=Load $SFile
        $onlineCnt=0
        if($sessions -and ($sessions.PSObject.Properties|Measure-Object).Count-gt 0){
            $onlineCnt=@($sessions.PSObject.Properties)|Where-Object{((NowMs)-[long]$_.Value.lastPing)-lt 90000}|Measure-Object|Select-Object -ExpandProperty Count
        }

        Header "MAIN MENU" "Login: $username  [$($role.ToUpper())]"

        # Stats bar
        W "  "; W "📦 $($builds.Count) builds" 'Cyan'
        W "   "; W "👥 $($users.Count) users" 'White'
        W "   "; W "🟢 $onlineCnt online" 'Green'
        if($bans.Count-gt 0){W "   "; W "🚫 $($bans.Count) banned" 'Red'}
        if($pending.Count-gt 0){W "   "; W "⏳ $($pending.Count) pending" 'Yellow'}
        WL ''; ThinLine; WL ''

        WL "  ┌──────────────────────────────────────────────────┐" 'DarkGray'
        WL "  │  BUILDS                                           │" 'DarkGray'
        W  "  │  "; W "[1]" 'Cyan'; WL "  Kelola Builds & Approval                  │" 'White'
        if($isOwner){
            WL "  │                                                   │" 'DarkGray'
            WL "  │  USERS & KEAMANAN                                 │" 'DarkGray'
            W  "  │  "; W "[2]" 'Cyan';    WL "  Kelola Users & Lihat Sessions             │" 'White'
            W  "  │  "; W "[3]" 'Green';   WL "  Live IP Monitor                           │" 'White'
            W  "  │  "; W "[4]" 'Red';     WL "  Ban / Unban IP Address                    │" 'White'
            WL "  │                                                   │" 'DarkGray'
            WL "  │  ADMIN                                            │" 'DarkGray'
            W  "  │  "; W "[5]" 'Yellow';  WL "  Reset Password User                       │" 'White'
            W  "  │  "; W "[6]" 'Green';   WL "  Generate / Revoke Staff Code              │" 'White'
            W  "  │  "; W "[7]" 'Green';   WL "  Buat Akun Baru                            │" 'White'
            W  "  │  "; W "[8]" 'Magenta'; WL "  Set Announcement Ticker                   │" 'White'
            WL "  │                                                   │" 'DarkGray'
            WL "  │  SYNC & LOG                                       │" 'DarkGray'
            W  "  │  "; W "[9]" 'DarkGray'; WL "  Panduan Sync Website ↔ Panel              │" 'White'
            W  "  │  "; W "[L]" 'DarkGray'; WL "  Lihat Activity Log                        │" 'White'
        } else {
            WL "  │                                                   │" 'DarkGray'
            WARN "  Staff hanya bisa kelola builds."
        }
        W  "  │  "; W "[0]" 'DarkRed'; WL "  Keluar                                    │" 'White'
        WL "  └──────────────────────────────────────────────────┘" 'DarkGray'
        WL ''

        $c=(Ask "Pilih menu" 'Cyan').ToUpper().Trim()
        switch($c){
            '1'{MenuBuilds $sess}
            '2'{if($isOwner){MenuUsers $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '3'{if($isOwner){MenuLiveIP $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '4'{if($isOwner){MenuBan $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '5'{if($isOwner){MenuResetPwd $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '6'{if($isOwner){MenuStaffCodes $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '7'{if($isOwner){MenuCreateAccount $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '8'{if($isOwner){MenuAnnouncement $sess}else{ERR "Hanya owner.";Start-Sleep 1}}
            '9'{if($isOwner){MenuSyncGuide}else{ERR "Hanya owner.";Start-Sleep 1}}
            'L'{if($isOwner){MenuViewLog}else{ERR "Hanya owner.";Start-Sleep 1}}
            '0'{Clear-Host;WL '';WL "  Sampai jumpa! 👋" 'Cyan';WL '';Start-Sleep 1;exit}
            default{WARN "Pilihan tidak valid.";Start-Sleep 1}
        }
    }
}

# ══════════════════════════════════════════════════════
#  [1] KELOLA BUILDS
# ══════════════════════════════════════════════════════
function MenuBuilds($sess){
    $isOwner=$sess.role-eq'owner'
    while($true){
        $builds=@(Load $BFile)
        $approved=@($builds)|Where-Object{$_.status-eq'approved'}
        $pending=@($builds)|Where-Object{$_.status-eq'pending'}

        Header "KELOLA BUILDS" "Total: $($builds.Count)  |  Approved: $($approved.Count)  |  Pending: $($pending.Count)"

        if($builds.Count-eq 0){
            WARN "Belum ada data build. Sync dulu dari website. (Menu [9])"; WL ''
        } else {
            W "   "; W ("{0,-4}"-f"#")'DarkGray'; W ("{0,-28}"-f"NAMA BUILD")'DarkGray'
            W ("{0,-10}"-f"TIPE")'DarkGray'; W ("{0,-12}"-f"STATUS")'DarkGray'; WL "OLEH" 'DarkGray'
            ThinLine
            for($i=0;$i-lt $builds.Count;$i++){
                $b=$builds[$i]
                $tc=if($b.type-eq'premium'){'Yellow'}else{'Green'}
                $sc=switch($b.status){'approved'{'DarkGray'}'pending'{'Magenta'}default{'Red'}}
                $nm=[string]$b.name; if($nm.Length-gt 27){$nm=$nm.Substring(0,27)+'…'}
                $ft=if($b.featured){'⭐'}else{'  '}
                W " $ft "; W ("{0,-4}"-f($i+1))'DarkGray'
                W ("{0,-28}"-f$nm)'White'; W ("{0,-10}"-f$b.type.ToUpper())$tc
                W ("{0,-12}"-f$b.status.ToUpper())$sc; WL $b.submitter 'DarkGray'
            }
            ThinLine
        }

        WL ''
        if($isOwner){WL "  [A] Tambah   [P] Approve Pending   [D] Hapus   [F] Toggle Featured   [B] Kembali" 'White'}
        else{WL "  [D] Hapus (build melanggar)   [B] Kembali" 'White'; WARN "Staff hanya bisa hapus build."}
        WL ''
        $c=(Ask "Pilih"'Cyan').ToUpper().Trim()

        switch($c){
            'B'{return}

            'A'{
                if(-not $isOwner){ERR "Hanya owner.";Start-Sleep 1;continue}
                Header "TAMBAH BUILD BARU"
                $n=Ask "Nama build"; $t=Ask "Tipe (premium/free)"
                $pr=if($t.ToLower()-eq'premium'){try{[int](Ask "Harga IDR")}catch{0}}else{0}
                $ca=Ask "Kategori"; $d=Ask "Deskripsi singkat"
                $l=Ask "Link demo"; $ko=Ask "Kontak seller (WA/Discord)"
                $list=ToList(Load $BFile)
                [void]$list.Add([PSCustomObject]@{
                    id="b"+(NowMs);name=$n;type=$t.ToLower();price=$pr;cat=$ca;desc=$d
                    link=$l;contact=$ko;photoData=$null;buildFileName=$null;buildFileData=$null
                    submitter="owner";featured=$false;status="approved";createdAt=(NowMs)
                })
                Save $BFile $list; WL ''; OK "Build '$n' berhasil ditambahkan!"
                Log "ADD_BUILD" "$n|$t|$pr"; AnyKey
            }

            'P'{
                if(-not $isOwner){ERR "Hanya owner.";Start-Sleep 1;continue}
                $pList=@(Load $BFile)|Where-Object{$_.status-eq'pending'}
                if($pList.Count-eq 0){INFO "Tidak ada yang pending.";AnyKey;continue}
                Header "APPROVE PENDING" "$($pList.Count) build menunggu"
                for($i=0;$i-lt $pList.Count;$i++){
                    $pb=$pList[$i]
                    W "  [$(($i+1))]  "'DarkGray'; W ("{0,-28}"-f$pb.name)'Yellow'
                    W ("{0,-10}"-f$pb.type.ToUpper())'Cyan'; WL "by $($pb.submitter)" 'DarkGray'
                }
                WL ''
                $num=Ask "Nomor yang di-approve (0=skip)"
                $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $pList.Count){
                    $tid=$pList[$idx].id; $all=ToList(Load $BFile)
                    for($k=0;$k-lt $all.Count;$k++){if($all[$k].id-eq$tid){$all[$k].status="approved";break}}
                    Save $BFile $all; OK "Build '$($pList[$idx].name)' di-approve!"
                    Log "APPROVE_BUILD" $pList[$idx].name; Start-Sleep 1
                }
            }

            'D'{
                if($builds.Count-eq 0){WARN "Tidak ada build.";Start-Sleep 1;continue}
                $num=Ask "Nomor build yang dihapus"; $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $builds.Count){
                    $target=$builds[$idx]
                    if(Confirm "Hapus '$($target.name)'?"){
                        Save $BFile (@(Load $BFile)|Where-Object{$_.id-ne$target.id})
                        OK "Build '$($target.name)' dihapus."; Log "DELETE_BUILD" "$($target.name)"; Start-Sleep 1
                    }
                } else {ERR "Nomor tidak valid.";Start-Sleep 1}
            }

            'F'{
                if(-not $isOwner){ERR "Hanya owner.";Start-Sleep 1;continue}
                if($builds.Count-eq 0){WARN "Tidak ada build.";Start-Sleep 1;continue}
                $num=Ask "Nomor build untuk toggle featured"; $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $builds.Count){
                    $all=ToList(Load $BFile); $cur=$all[$idx].featured
                    $all[$idx].featured=-not $cur; Save $BFile $all
                    OK "$(if(-not $cur){'⭐ FEATURED!'}else{'Dihapus dari featured.'})"; Start-Sleep 1
                } else {ERR "Nomor tidak valid.";Start-Sleep 1}
            }
        }
    }
}

# ══════════════════════════════════════════════════════
#  [2] KELOLA USERS
# ══════════════════════════════════════════════════════
function MenuUsers($sess){
    while($true){
        $users=@(Load $UFile); $sessions=Load $SFile; $nowMs=NowMs
        Header "KELOLA USERS" "Total: $($users.Count) akun"

        if($users.Count-eq 0){WARN "Belum ada data. Sync dari website. (Menu [9])"; WL ''}
        else{
            W "   "; W ("{0,-4}"-f"#")'DarkGray'; W ("{0,-20}"-f"USERNAME")'DarkGray'
            W ("{0,-8}"-f"ROLE")'DarkGray'; W ("{0,-28}"-f"EMAIL")'DarkGray'
            W ("{0,-10}"-f"STATUS")'DarkGray'; WL "IP" 'DarkGray'; ThinLine

            for($i=0;$i-lt $users.Count;$i++){
                $u=$users[$i]
                $rc=switch($u.role){'owner'{'Yellow'}'staff'{'Cyan'}default{'White'}}
                $sp=if($sessions -and $u.id -and $sessions.PSObject.Properties.Name-contains $u.id){$sessions.($u.id)}else{$null}
                $isOn=$sp -and(($nowMs-[long]$sp.lastPing)-lt 90000)
                $stc=if($isOn){'Green'}else{'DarkGray'}; $st=if($isOn){"● ONLINE"}else{"○ offline"}
                $ip=if($sp){$sp.ip}else{"—"}
                W "   "; W ("{0,-4}"-f($i+1))'DarkGray'; W ("{0,-20}"-f$u.username)$rc
                W ("{0,-8}"-f$u.role.ToUpper())$rc; W ("{0,-28}"-f$u.email)'DarkGray'
                W ("{0,-10}"-f$st)$stc; WL $ip 'DarkGray'
            }
            ThinLine
        }

        WL ''; WL "  [D] Hapus User   [V] Lihat Detail   [B] Kembali" 'White'; WL ''
        $c=(Ask "Pilih"'Cyan').ToUpper().Trim()
        switch($c){
            'B'{return}
            'V'{
                $num=Ask "Nomor user"; $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $users.Count){
                    $u=$users[$idx]
                    $sp=if($sessions -and $u.id -and $sessions.PSObject.Properties.Name-contains $u.id){$sessions.($u.id)}else{$null}
                    Header "DETAIL: $($u.username)"
                    WL "  Username  : $($u.username)"'White'; WL "  Role      : $($u.role.ToUpper())"'Yellow'
                    WL "  Email     : $($u.email)"'DarkGray'; WL "  Bergabung : $(TimeAgo $u.createdAt)"'DarkGray'
                    if($sp){
                        WL ''; WL "  IP        : $($sp.ip)"'Cyan'
                        WL "  Device    : $($sp.device)"'DarkGray'; WL "  Last seen : $(TimeAgo $sp.lastPing)"'DarkGray'
                    }
                    AnyKey
                } else {ERR "Nomor tidak valid.";Start-Sleep 1}
            }
            'D'{
                if($users.Count-eq 0){WARN "Tidak ada user.";Start-Sleep 1;continue}
                $num=Ask "Nomor user yang dihapus"; $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $users.Count){
                    $target=$users[$idx]
                    if($target.role-eq'owner'){ERR "Tidak bisa hapus akun owner.";Start-Sleep 1;continue}
                    if(Confirm "Hapus '$($target.username)'?"){
                        Save $UFile (@(Load $UFile)|Where-Object{$_.id-ne$target.id})
                        OK "User '$($target.username)' dihapus."; Log "DELETE_USER" "$($target.username)"; Start-Sleep 1
                    }
                } else {ERR "Nomor tidak valid.";Start-Sleep 1}
            }
        }
    }
}

# ══════════════════════════════════════════════════════
#  [3] LIVE IP MONITOR
# ══════════════════════════════════════════════════════
function MenuLiveIP($sess){
    while($true){
        $sessions=Load $SFile; $bans=@(@(Load $BanFile)|ForEach-Object{$_.ip}); $nowMs=NowMs
        Header "LIVE IP MONITOR" "Data dari sessions.json"

        if(-not $sessions -or ($sessions.PSObject.Properties|Measure-Object).Count-eq 0){
            WARN "Tidak ada data sesi. Export dari website dulu. (Menu [9])"; AnyKey; return
        }

        $rows=@($sessions.PSObject.Properties|ForEach-Object{$_.Value}); $online=0
        W "   "; W ("{0,-18}"-f"USERNAME")'DarkGray'; W ("{0,-8}"-f"ROLE")'DarkGray'
        W ("{0,-20}"-f"IP ADDRESS")'DarkGray'; W ("{0,-10}"-f"DEVICE")'DarkGray'
        W ("{0,-14}"-f"TERAKHIR")'DarkGray'; WL "STATUS" 'DarkGray'; ThinLine

        foreach($r in $rows){
            $isOn=($nowMs-[long]$r.lastPing)-lt 90000
            if($isOn){$online++}
            $sc=if($isOn){'Green'}else{'DarkGray'}; $st=if($isOn){"● ONLINE"}else{"○ offline"}
            $ban=if($bans-contains $r.ip){"  ⛔"}else{""}
            $rc=switch($r.role){'owner'{'Yellow'}'staff'{'Cyan'}default{'White'}}
            W "   "; W ("{0,-18}"-f$r.username)$rc; W ("{0,-8}"-f$r.role.ToUpper())$rc
            W ("{0,-20}"-f$r.ip)'Cyan'; W ("{0,-10}"-f$r.device)'DarkGray'
            W ("{0,-14}"-f(TimeAgo $r.lastPing))'DarkGray'; W ("{0,-12}"-f$st)$sc; WL $ban 'Red'
        }
        ThinLine; WL ''; OK "$online user online dari $($rows.Count) total sesi"; WL ''
        WL "  [R] Refresh   [B] Quick-Ban IP   [U] Quick-Unban   [X] Kembali" 'White'; WL ''

        $c=(Ask "Pilih"'Cyan').ToLower().Trim()
        switch($c){
            'x'{return}
            'r'{continue}
            'b'{
                $ip=Ask "IP yang di-ban"; $rsn=Ask "Alasan"
                $blist=ToList(Load $BanFile)
                if($blist|Where-Object{$_.ip-eq$ip}){WARN "$ip sudah di-ban.";Start-Sleep 1;continue}
                [void]$blist.Add([PSCustomObject]@{ip=$ip;reason=$rsn;bannedBy=$sess.username;bannedAt=(NowMs)})
                Save $BanFile $blist; OK "IP $ip di-ban!"; Log "QUICK_BAN" "$ip|$rsn"; Start-Sleep 1
            }
            'u'{
                $ip=Ask "IP yang di-unban"
                $blist=@(Load $BanFile); if($blist|Where-Object{$_.ip-eq$ip}){
                    Save $BanFile ($blist|Where-Object{$_.ip-ne$ip}); OK "IP $ip di-unban!"; Log "QUICK_UNBAN" $ip
                } else {WARN "IP $ip tidak ada di ban list."}
                Start-Sleep 1
            }
        }
    }
}

# ══════════════════════════════════════════════════════
#  [4] BAN / UNBAN
# ══════════════════════════════════════════════════════
function MenuBan($sess){
    while($true){
        $bans=@(Load $BanFile)
        Header "BAN / UNBAN IP" "$($bans.Count) IP diblokir"

        if($bans.Count-eq 0){WL "  (tidak ada IP yang diblokir)" 'DarkGray'}
        else{
            W "   "; W ("{0,-4}"-f"#")'DarkGray'; W ("{0,-22}"-f"IP ADDRESS")'DarkGray'
            W ("{0,-28}"-f"ALASAN")'DarkGray'; W ("{0,-14}"-f"OLEH")'DarkGray'; WL "KAPAN" 'DarkGray'; ThinLine
            for($i=0;$i-lt $bans.Count;$i++){
                $b=$bans[$i]; W "   "; W ("{0,-4}"-f($i+1))'DarkGray'
                W ("{0,-22}"-f$b.ip)'Red'; W ("{0,-28}"-f$b.reason)'DarkGray'
                W ("{0,-14}"-f$b.bannedBy)'DarkGray'; WL (TimeAgo $b.bannedAt) 'DarkGray'
            }
            ThinLine
        }

        WL ''; WL "  [A] Ban IP   [U] Unban   [B] Kembali" 'White'; WL ''
        $c=(Ask "Pilih"'Cyan').ToUpper().Trim()
        switch($c){
            'B'{return}
            'A'{
                $ip=Ask "IP Address yang di-ban"; $rsn=Ask "Alasan"
                if(@(Load $BanFile)|Where-Object{$_.ip-eq$ip}){WARN "IP $ip sudah ada.";Start-Sleep 1;continue}
                $list=ToList(Load $BanFile)
                [void]$list.Add([PSCustomObject]@{ip=$ip;reason=$rsn;bannedBy=$sess.username;bannedAt=(NowMs)})
                Save $BanFile $list; WL ''; OK "IP $ip berhasil di-ban!"
                WARN "Import bans.json ke browser agar langsung aktif. (Menu [9])"
                Log "BAN_IP" "$ip|$rsn|by $($sess.username)"; AnyKey
            }
            'U'{
                if($bans.Count-eq 0){WARN "Tidak ada IP.";Start-Sleep 1;continue}
                $num=Ask "Nomor IP yang di-unban"; $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $bans.Count){
                    $ip=$bans[$idx].ip
                    if(Confirm "Unban IP $ip?"){
                        Save $BanFile (@(Load $BanFile)|Where-Object{$_.ip-ne$ip})
                        OK "IP $ip di-unban!"; Log "UNBAN_IP" $ip; Start-Sleep 1
                    }
                } else {ERR "Nomor tidak valid.";Start-Sleep 1}
            }
        }
    }
}

# ══════════════════════════════════════════════════════
#  [5] RESET PASSWORD
# ══════════════════════════════════════════════════════
function MenuResetPwd($sess){
    $users=@(Load $UFile)
    Header "RESET PASSWORD USER"
    if($users.Count-eq 0){WARN "Tidak ada data user. Sync dulu. (Menu [9])";AnyKey;return}

    for($i=0;$i-lt $users.Count;$i++){
        $u=$users[$i]; $rc=switch($u.role){'owner'{'Yellow'}'staff'{'Cyan'}default{'White'}}
        W "  [$(($i+1))]  "'DarkGray'; W ("{0,-20}"-f$u.username)$rc; WL $u.role.ToUpper() $rc
    }
    ThinLine; WL ''

    $num=Ask "Nomor user"; $idx=try{[int]$num-1}catch{-1}
    if($idx-lt 0 -or $idx-ge $users.Count){ERR "Nomor tidak valid.";AnyKey;return}
    $target=$users[$idx]
    if($target.role-eq'owner' -and $target.id-ne'own001' -and $sess.username-ne$target.username){
        ERR "Tidak bisa reset password owner lain.";AnyKey;return
    }

    WL ''; $np=AskPwd "Password baru untuk '$($target.username)' (min 6 karakter)"
    $cp=AskPwd "Konfirmasi password baru"
    if($np-ne$cp){ERR "Password tidak cocok!";AnyKey;return}
    if($np.Length-lt 6){ERR "Password min 6 karakter.";AnyKey;return}

    $all=ToList(Load $UFile)
    for($k=0;$k-lt $all.Count;$k++){if($all[$k].id-eq$target.id){$all[$k].pwHash=HashPassword $np;break}}
    Save $UFile $all; WL ''
    OK "Password '$($target.username)' berhasil di-reset!"
    WARN "PENTING: Import users.json ke browser agar berlaku. (Menu [9])"
    Log "RESET_PWD" $target.username; AnyKey
}

# ══════════════════════════════════════════════════════
#  [6] STAFF CODES
# ══════════════════════════════════════════════════════
function MenuStaffCodes($sess){
    while($true){
        $codes=@(Load $CFile)
        Header "STAFF ACCESS CODES" "$($codes.Count) kode"

        if($codes.Count-eq 0){WL "  (belum ada kode)" 'DarkGray'}
        else{
            W "   "; W ("{0,-4}"-f"#")'DarkGray'; W ("{0,-24}"-f"KODE")'DarkGray'
            W ("{0,-10}"-f"STATUS")'DarkGray'; WL "DIPAKAI OLEH" 'DarkGray'; ThinLine
            for($i=0;$i-lt $codes.Count;$i++){
                $cd=$codes[$i]; $sc=if($cd.used){'DarkGray'}else{'Cyan'}; $st=if($cd.used){"USED"}else{"ACTIVE"}
                $by=if($cd.PSObject.Properties.Name-contains'usedBy'){$cd.usedBy}else{"—"}
                W "   "; W ("{0,-4}"-f($i+1))'DarkGray'; W ("{0,-24}"-f$cd.code)$sc; W ("{0,-10}"-f$st)$sc; WL $by 'DarkGray'
            }
            ThinLine
        }

        WL ''; WL "  [G] Generate Kode   [R] Revoke Kode   [B] Kembali" 'White'; WL ''
        $c=(Ask "Pilih"'Cyan').ToUpper().Trim()
        switch($c){
            'B'{return}
            'G'{
                $chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $code='STAFF-'
                1..4|ForEach-Object{$code+=$chars[(Get-Random -Maximum $chars.Length)]}
                $code+='-'
                1..4|ForEach-Object{$code+=$chars[(Get-Random -Maximum $chars.Length)]}
                $list=ToList(Load $CFile)
                [void]$list.Add([PSCustomObject]@{code=$code;used=$false;createdBy=$sess.username;createdAt=(NowMs)})
                Save $CFile $list; WL ''
                WL "  ╔══════════════════════════════════════╗" 'Cyan'
                W  "  ║   KODE BARU: "; W ("{0,-23}"-f$code)'White'; WL "  ║" 'Cyan'
                WL "  ╚══════════════════════════════════════╝" 'Cyan'
                WL ''; OK "Bagikan kode ini ke staff kamu!"; Log "GEN_CODE" $code; AnyKey
            }
            'R'{
                if($codes.Count-eq 0){WARN "Tidak ada kode.";Start-Sleep 1;continue}
                $num=Ask "Nomor kode"; $idx=try{[int]$num-1}catch{-1}
                if($idx-ge 0 -and $idx-lt $codes.Count){
                    $code=$codes[$idx].code
                    if(Confirm "Revoke $code?"){
                        Save $CFile (@(Load $CFile)|Where-Object{$_.code-ne$code})
                        OK "Kode $code di-revoke."; Log "REVOKE_CODE" $code; Start-Sleep 1
                    }
                } else {ERR "Nomor tidak valid.";Start-Sleep 1}
            }
        }
    }
}

# ══════════════════════════════════════════════════════
#  [7] BUAT AKUN BARU
# ══════════════════════════════════════════════════════
function MenuCreateAccount($sess){
    Header "BUAT AKUN BARU"
    $u=(Ask "Username (min 3 karakter)").ToLower().Trim()
    $e=Ask "Email"; $p=AskPwd "Password (min 6 karakter)"
    $r=(Ask "Role (user / staff / owner)").ToLower().Trim()

    if($u.Length-lt 3){ERR "Username min 3 karakter.";AnyKey;return}
    if($p.Length-lt 6){ERR "Password min 6 karakter.";AnyKey;return}
    if($r -notin @('user','staff','owner')){ERR "Role harus: user/staff/owner";AnyKey;return}
    if($e -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$'){ERR "Format email tidak valid.";AnyKey;return}

    $existing=@(Load $UFile)
    if(@($existing)|Where-Object{$_.username-eq$u}){ERR "Username '$u' sudah dipakai.";AnyKey;return}
    if(@($existing)|Where-Object{$_.email.ToLower()-eq$e.ToLower()}){ERR "Email '$e' sudah terdaftar.";AnyKey;return}

    $list=ToList(Load $UFile)
    [void]$list.Add([PSCustomObject]@{id="u"+(NowMs);username=$u;email=$e;pwHash=HashPassword $p;role=$r;createdAt=(NowMs)})
    Save $UFile $list; WL ''; OK "Akun '$u' ($r) berhasil dibuat!"
    WARN "Import users.json ke browser agar akun aktif. (Menu [9])"
    Log "CREATE_ACCOUNT" "$u|$r"; AnyKey
}

# ══════════════════════════════════════════════════════
#  [8] ANNOUNCEMENT
# ══════════════════════════════════════════════════════
function MenuAnnouncement($sess){
    while($true){
        $current=if(Test-Path $AnnFile){(Get-Content $AnnFile -Raw -Encoding UTF8).Trim()}else{""}
        Header "ANNOUNCEMENT TICKER" "Pesan scroll di bagian atas website"

        if($current){W "  Pesan aktif: ";WL $current 'Yellow'}
        else{WL "  (tidak ada announcement)" 'DarkGray'}
        WL ''; ThinLine; WL ''
        WL "  [S] Set Announcement   [C] Clear   [B] Kembali" 'White'; WL ''

        $c=(Ask "Pilih"'Cyan').ToUpper().Trim()
        switch($c){
            'B'{return}
            'S'{
                $msg=Ask "Teks announcement"
                if(-not $msg.Trim()){WARN "Pesan kosong.";Start-Sleep 1;continue}
                $msg|Set-Content $AnnFile -Encoding UTF8
                WL ''; OK "Tersimpan di data\announcement.txt"; WL ''
                WL "  ── PASTE DI BROWSER CONSOLE (F12) UNTUK PUBLISH ──" 'Yellow'; WL ''
                WL "  localStorage.setItem('_ox4_announcement'," 'Cyan'
                WL "    JSON.stringify('$($msg.Replace("'","\'"))'));" 'Cyan'
                WL "  location.reload();" 'Cyan'; WL ''
                Log "SET_ANNOUNCEMENT" $msg; AnyKey
            }
            'C'{
                if(Test-Path $AnnFile){Remove-Item $AnnFile}
                OK "Announcement dihapus."; WL ''
                WL "  localStorage.removeItem('_ox4_announcement'); location.reload();" 'Cyan'; WL ''
                Log "CLEAR_ANNOUNCEMENT" ""; AnyKey
            }
        }
    }
}

# ══════════════════════════════════════════════════════
#  [9] SYNC GUIDE
# ══════════════════════════════════════════════════════
function MenuSyncGuide{
    # Generate export snippet file
    @'
// ════════════════════════════════════════════════════════
// OXYX STORE — EXPORT KE POWERSHELL PANEL
// Jalankan di browser console (F12 → Console)
// ════════════════════════════════════════════════════════
(function(){
  const keys=['_ox4_users','_ox4_builds','_ox4_bans','_ox4_sessions','_ox4_staffCodes','_ox4_announcement'];
  const out={};
  keys.forEach(k=>{try{out[k]=JSON.parse(localStorage.getItem(k)||'null');}catch(e){out[k]=null;}});
  const json=JSON.stringify(out,null,2);
  console.log('%c✓ OXYX EXPORT','color:#00ffd5;font-size:16px;font-weight:bold');
  console.log('%c▼▼▼ COPY SEMUA TEKS DI BAWAH ▼▼▼','color:#ffc432;font-weight:bold');
  console.log(json);
  console.log('%c▲▲▲ SAMPAI BARIS INI ▲▲▲','color:#ffc432;font-weight:bold');
  console.log('Simpan ke: _ox4_users→users.json  _ox4_builds→builds.json  _ox4_bans→bans.json  _ox4_sessions→sessions.json  _ox4_staffCodes→codes.json');
})();
'@ | Set-Content $ExpFile -Encoding UTF8

    EnsureFiles

    Header "PANDUAN SYNC — WEBSITE ↔ PANEL"

    WL "  ╔════════════════════════════════════════════════════════╗" 'Cyan'
    WL "  ║  STEP 1 — AMBIL DATA DARI WEBSITE                     ║" 'Cyan'
    WL "  ╚════════════════════════════════════════════════════════╝" 'Cyan'; WL ''
    WL "  1. Buka website OXYX STORE di browser" 'White'
    WL "  2. Tekan F12 → tab Console" 'White'
    WL "  3. Buka file: data\EXPORT_snippet.js" 'White'
    WL "     Copy semua isinya → paste ke browser console → Enter" 'White'
    WL "  4. Copy output JSON yang muncul" 'White'
    WL "  5. Simpan ke folder data\ sesuai mapping:" 'White'; WL ''
    WL "     _ox4_users       →  data\users.json" 'DarkGray'
    WL "     _ox4_builds      →  data\builds.json" 'DarkGray'
    WL "     _ox4_bans        →  data\bans.json" 'DarkGray'
    WL "     _ox4_sessions    →  data\sessions.json" 'DarkGray'
    WL "     _ox4_staffCodes  →  data\codes.json" 'DarkGray'
    WL ''; ThinLine; WL ''

    WL "  ╔════════════════════════════════════════════════════════╗" 'Yellow'
    WL "  ║  STEP 2 — PUSH PERUBAHAN KE WEBSITE                   ║" 'Yellow'
    WL "  ╚════════════════════════════════════════════════════════╝" 'Yellow'; WL ''
    WL "  Setelah edit di panel, buka browser console (F12):" 'White'; WL ''
    WL "  localStorage.setItem('_ox4_bans'," 'Cyan'
    WL "    JSON.stringify( <isi data\bans.json> ));" 'Cyan'
    WL "  localStorage.setItem('_ox4_users'," 'Cyan'
    WL "    JSON.stringify( <isi data\users.json> ));" 'Cyan'
    WL "  location.reload();" 'Cyan'; WL ''; ThinLine; WL ''

    WL "  ╔════════════════════════════════════════════════════════╗" 'Green'
    WL "  ║  QUICK COMMANDS — langsung di browser, tanpa file      ║" 'Green'
    WL "  ╚════════════════════════════════════════════════════════╝" 'Green'; WL ''
    WL "  Ban IP seketika:" 'White'
    WL "  const b=JSON.parse(localStorage.getItem('_ox4_bans')||'[]');" 'Cyan'
    WL "  b.push({ip:'1.2.3.4',reason:'alasan',bannedBy:'owner',bannedAt:Date.now()});" 'Cyan'
    WL "  localStorage.setItem('_ox4_bans',JSON.stringify(b)); location.reload();" 'Cyan'; WL ''
    WL "  Set announcement seketika:" 'White'
    WL "  localStorage.setItem('_ox4_announcement',JSON.stringify('Pesanmu'));" 'Cyan'
    WL "  location.reload();" 'Cyan'; WL ''
    WL "  Hapus announcement:" 'White'
    WL "  localStorage.removeItem('_ox4_announcement'); location.reload();" 'Cyan'; WL ''; ThinLine; WL ''
    OK "File snippet export: data\EXPORT_snippet.js (sudah di-generate)"; AnyKey
}

# ══════════════════════════════════════════════════════
#  [L] ACTIVITY LOG
# ══════════════════════════════════════════════════════
function MenuViewLog{
    Header "ACTIVITY LOG" "50 entri terakhir"
    if(-not(Test-Path $LogFile)){WARN "Belum ada log.";AnyKey;return}
    $lines=Get-Content $LogFile -Encoding UTF8 -Tail 50
    foreach($line in $lines){
        $parts=$line -split '  \|  '
        W "  "; W ("{0,-22}"-f$parts[0])'DarkGray'
        if($parts.Count-gt 1){W ("{0,-24}"-f$parts[1])'Yellow'}
        if($parts.Count-gt 2){WL $parts[2] 'White'}else{WL ''}
    }
    ThinLine; AnyKey
}

# ══════════════════════════════════════════════════════
#  SPLASH SCREEN
# ══════════════════════════════════════════════════════
function Splash{
    Clear-Host; WL ''
    WL '        ██████╗ ██╗  ██╗██╗   ██╗██╗  ██╗' 'Cyan'
    WL '       ██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝╚██╗██╔╝' 'Cyan'
    WL '       ██║   ██║ ╚███╔╝  ╚████╔╝  ╚███╔╝ ' 'DarkCyan'
    WL '       ██║   ██║ ██╔██╗   ╚██╔╝   ██╔██╗ ' 'DarkCyan'
    WL '       ╚██████╔╝██╔╝ ██╗   ██║   ██╔╝ ██╗' 'White'
    WL '        ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝' 'White'
    WL ''; WL '                 S T O R E' 'DarkGray'
    WL ''; WL '         P O W E R S H E L L   P A N E L' 'Yellow'
    WL ''; ThinLine; WL ''
    WL '  Owner-only admin panel · Kelola builds, users, bans, sync website.' 'DarkGray'
    WL ''; Start-Sleep 1
}

# ══════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════
EnsureFiles
Splash

$session = Auth
if(-not $session){
    WL ''; ERR "Login gagal. Panel ditutup."; WL ''; Start-Sleep 2; exit
}

MainMenu $session
