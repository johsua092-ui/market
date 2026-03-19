# ╔══════════════════════════════════════════════════════╗
# ║        OXYX STORE — PowerShell Admin Panel           ║
# ║              No Node.js required                     ║
# ╠══════════════════════════════════════════════════════╣
# ║  HOW TO RUN:                                         ║
# ║  1. Right-click this file → "Run with PowerShell"   ║
# ║  OR                                                  ║
# ║  2. Open PowerShell, then:                           ║
# ║     Set-ExecutionPolicy -Scope Process Bypass        ║
# ║     .\OxyxPanel.ps1                                  ║
# ║  OR                                                  ║
# ║  3. If blocked: Right-click → Properties →           ║
# ║     check "Unblock" → OK → then run                  ║
# ╚══════════════════════════════════════════════════════╝

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = "OXYX STORE — Admin Panel" } catch {}
try { if($Host.UI.RawUI.WindowSize.Width -lt 90){ $Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(100,42) } } catch {}

$DataDir  = "$PSScriptRoot\data"
$UFile    = "$DataDir\users.json"
$BFile    = "$DataDir\builds.json"
$BanFile  = "$DataDir\bans.json"
$SFile    = "$DataDir\sessions.json"
$CFile    = "$DataDir\staffcodes.json"
$LogFile  = "$DataDir\activity.log"

if(-not (Test-Path $DataDir)){ New-Item -ItemType Directory -Path $DataDir | Out-Null }

# ── HELPERS ──
function Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ┌──────────────────────────────────────────────────┐" -ForegroundColor DarkCyan
    Write-Host "  │  " -NoNewline -ForegroundColor DarkCyan
    Write-Host "OX" -NoNewline -ForegroundColor White
    Write-Host "YX" -NoNewline -ForegroundColor Cyan
    Write-Host " STORE  " -NoNewline -ForegroundColor White
    Write-Host "ADMIN PANEL" -NoNewline -ForegroundColor Yellow
    Write-Host "                    │" -ForegroundColor DarkCyan
    Write-Host "  │  No Node.js required — Pure PowerShell           │" -ForegroundColor DarkGray
    Write-Host "  └──────────────────────────────────────────────────┘" -ForegroundColor DarkCyan
    Write-Host ""
}
function Ln  { Write-Host "  ──────────────────────────────────────────" -ForegroundColor DarkGray }
function OK($t)   { Write-Host "  [✓] $t" -ForegroundColor Green }
function ERR($t)  { Write-Host "  [✕] $t" -ForegroundColor Red }
function INF($t)  { Write-Host "  [i] $t" -ForegroundColor Cyan }
function WRN($t)  { Write-Host "  [!] $t" -ForegroundColor Yellow }
function Ask($m)  { Write-Host "  ▶ $m" -ForegroundColor Cyan -NoNewline; return (Read-Host " ") }
function AskPwd($m){ Write-Host "  ▶ $m" -ForegroundColor Cyan -NoNewline; $s=Read-Host " " -AsSecureString; return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
function Pause { Write-Host ""; Write-Host "  ↵ Press ENTER to continue..." -ForegroundColor DarkGray -NoNewline; Read-Host | Out-Null }
function WriteLog($a,$d){ "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')) | $a | $d" | Out-File -Append -FilePath $LogFile -Encoding utf8 }

# ── JSON (Pure PowerShell) ──
function Load($p){ if(Test-Path $p){ try{ return Get-Content $p -Raw -Encoding utf8 | ConvertFrom-Json }catch{ WRN "Failed to read: $p"; return @() } }; return @() }
function Save($p,$d){ $d | ConvertTo-Json -Depth 10 | Set-Content -Path $p -Encoding utf8 }
function ToArr($d){ if($d -is [System.Collections.ArrayList]){ return $d }; $a=[System.Collections.ArrayList]@(); foreach($i in @($d)){[void]$a.Add($i)}; return $a }

# ── HASH (matches app.js hashPw) ──
function HashPw($pw){
    $salt = "OXYX_STORE_SECURE_2024"
    $str  = $salt + $pw + (-join $salt.ToCharArray()[($salt.Length-1)..0])
    $h    = [uint32]5381
    foreach($c in $str.ToCharArray()){ $h = (($h -shl 5) + $h) -bxor [uint32][char]$c }
    $h2   = [uint32]0x811c9dc5
    foreach($c in $str.ToCharArray()){ $h2 = $h2 -bxor [uint32][char]$c; $h2 = [uint32]($h2 * [uint64]0x01000193) }
    return $h.ToString("x") + $h2.ToString("x")
}

# ═══════════════════════════════
#   AUTH
# ═══════════════════════════════
function AuthPanel {
    Banner
    Write-Host "  ADMIN AUTHENTICATION" -ForegroundColor Yellow
    Ln
    Write-Host ""
    Write-Host "  Default owner: username=owner  password=29u39ShSSSSUA" -ForegroundColor DarkGray
    Write-Host ""
    $u = Ask "Username"
    $p = AskPwd "Password"

    $users = Load $UFile
    $found = @($users) | Where-Object { $_.username -eq $u.ToLower() }

    if(-not $found){
        # Fallback for fresh install before export
        if($u -eq "owner" -and (HashPw $p) -eq (HashPw "29u39ShSSSSUA")){
            OK "Logged in as owner (default)."; Start-Sleep 1; return "owner"
        }
        ERR "Username not found."; Start-Sleep 2; return $null
    }
    $expected = HashPw $p
    if($found.pwHash -ne $expected){ ERR "Incorrect password."; Start-Sleep 2; return $null }
    if($found.role -ne 'owner' -and $found.role -ne 'staff'){ ERR "Access denied. Owner or staff only."; Start-Sleep 2; return $null }
    OK "Logged in as $($found.role): $($found.username)"
    WriteLog "PANEL_LOGIN" "$($found.username) | $($found.role)"
    Start-Sleep 1
    return $found.role
}

# ═══════════════════════════════
#   MAIN MENU
# ═══════════════════════════════
function MainMenu($role) {
    while($true) {
        Banner
        Write-Host "  MAIN MENU  " -NoNewline -ForegroundColor White
        Write-Host "[$($role.ToUpper())]" -ForegroundColor $(if($role -eq 'owner'){'Yellow'}else{'Cyan'})
        Write-Host ""
        Write-Host "   [1]  Manage Builds" -ForegroundColor White
        if($role -eq 'owner'){
            Write-Host "   [2]  Manage Users" -ForegroundColor White
            Write-Host "   [3]  Live IP Monitor" -ForegroundColor Cyan
            Write-Host "   [4]  Ban / Unban IP" -ForegroundColor Red
            Write-Host "   [5]  Reset Password" -ForegroundColor Yellow
            Write-Host "   [6]  Staff Codes" -ForegroundColor Green
            Write-Host "   [7]  Create Account" -ForegroundColor Green
            Write-Host "   [8]  Activity Log" -ForegroundColor DarkGray
            Write-Host "   [9]  Export/Import Guide" -ForegroundColor DarkGray
        } else {
            Write-Host ""
            WRN "Staff can only manage builds (delete violating builds)."
        }
        Write-Host "   [0]  Exit" -ForegroundColor DarkRed
        Write-Host ""
        $c = Ask "Choose"
        switch($c){
            '1'{ MenuBuilds $role }
            '2'{ if($role -eq 'owner'){MenuUsers}   else{WRN "Access denied.";Start-Sleep 1} }
            '3'{ if($role -eq 'owner'){MenuLiveIP}  else{WRN "Access denied.";Start-Sleep 1} }
            '4'{ if($role -eq 'owner'){MenuBan}     else{WRN "Access denied.";Start-Sleep 1} }
            '5'{ if($role -eq 'owner'){MenuResetPwd}else{WRN "Access denied.";Start-Sleep 1} }
            '6'{ if($role -eq 'owner'){MenuCodes}   else{WRN "Access denied.";Start-Sleep 1} }
            '7'{ if($role -eq 'owner'){MenuCreateAcc}else{WRN "Access denied.";Start-Sleep 1} }
            '8'{ if($role -eq 'owner'){ViewLog}     else{WRN "Access denied.";Start-Sleep 1} }
            '9'{ if($role -eq 'owner'){MenuExport}  else{WRN "Access denied.";Start-Sleep 1} }
            '0'{ Clear-Host; Write-Host "  Goodbye!" -ForegroundColor Cyan; Start-Sleep 1; exit }
            default{ WRN "Invalid choice."; Start-Sleep 1 }
        }
    }
}

# ── 1. BUILDS ──
function MenuBuilds($role) {
    while($true) {
        Banner; Write-Host "  MANAGE BUILDS" -ForegroundColor Cyan; Ln
        $b = Load $BFile
        if(-not $b -or @($b).Count -eq 0){ WRN "No builds found. Export from browser first." }
        else {
            $i=1; foreach($x in @($b)){
                $tc = if($x.type -eq 'premium'){'Yellow'}else{'Green'}
                $sc = if($x.status -eq 'approved'){'DarkGray'}else{'Magenta'}
                Write-Host ("   [{0,2}] " -f $i) -ForegroundColor DarkGray -NoNewline
                Write-Host ("{0,-28}" -f $x.name) -ForegroundColor White -NoNewline
                Write-Host ("{0,-10}" -f $x.type.ToUpper()) -ForegroundColor $tc -NoNewline
                Write-Host ("{0,-12}" -f $x.status.ToUpper()) -ForegroundColor $sc -NoNewline
                Write-Host "by $($x.submitter)" -ForegroundColor DarkGray
                $i++
            }
        }
        Ln
        if($role -eq 'owner'){ Write-Host "   [A] Add build   [P] Approve pending   [D] Delete   [B] Back" }
        else { Write-Host "   [D] Delete (violating builds only)   [B] Back"; WRN "Staff can only delete builds that violate rules." }
        Write-Host ""
        $c = (Ask "Choose").ToUpper()
        switch($c){
            'B'{ return }
            'A'{ if($role -eq 'owner'){AdminAddBuild}else{WRN "Access denied.";Start-Sleep 1} }
            'D'{
                $num=Ask "Build number to delete"; $idx=[int]$num-1; $b=Load $BFile
                if($idx -ge 0 -and $idx -lt @($b).Count){
                    $t=@($b)[$idx]; $cf=Ask "Delete '$($t.name)'? (y/n)"
                    if($cf -eq 'y'){ Save $BFile (@($b)|Where-Object{$_.id -ne $t.id}); OK "Build deleted."; WriteLog "DELETE_BUILD" "$($t.name)"; Start-Sleep 1 }
                } else { ERR "Invalid number."; Start-Sleep 1 }
            }
            'P'{
                if($role -ne 'owner'){ WRN "Access denied."; Start-Sleep 1; break }
                $b=Load $BFile; $pending=@($b)|Where-Object{$_.status -eq 'pending'}
                if($pending.Count -eq 0){ INF "No pending builds."; Pause; break }
                $j=1; foreach($pb in $pending){ Write-Host ("   [{0}] {1} by {2}" -f $j,$pb.name,$pb.submitter) -ForegroundColor Yellow; $j++ }
                $num=Ask "Number to approve (0=skip)"
                if([int]$num -gt 0){
                    $pidx=[int]$num-1
                    if($pidx -lt $pending.Count){
                        $tid=$pending[$pidx].id; $all=ToArr(Load $BFile)
                        for($k=0;$k -lt $all.Count;$k++){ if($all[$k].id -eq $tid){ $all[$k].status='approved'; break } }
                        Save $BFile $all; OK "Build approved!"; WriteLog "APPROVE_BUILD" $pending[$pidx].name; Start-Sleep 1
                    }
                }
            }
        }
    }
}
function AdminAddBuild {
    Banner; Write-Host "  ADD NEW BUILD" -ForegroundColor Green; Ln
    $n=Ask "Build name"; $t=Ask "Type (premium/free)"; $p=if($t -eq 'premium'){Ask "Price (IDR)"}else{"0"}
    $c=Ask "Category"; $d=Ask "Description"; $l=Ask "Link"
    $b=ToArr(Load $BFile)
    [void]$b.Add([PSCustomObject]@{id="b"+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();name=$n;type=$t.ToLower();price=[int]$p;cat=$c;desc=$d;link=$l;contact='';photoData=$null;buildFileName=$null;buildFileData=$null;submitter='owner';featured=$false;status='approved';createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()})
    Save $BFile $b; OK "Build '$n' added!"; WriteLog "ADD_BUILD" "$n | $t"; Pause
}

# ── 2. USERS (owner only) ──
function MenuUsers {
    while($true){
        Banner; Write-Host "  MANAGE USERS" -ForegroundColor Yellow; Ln
        $u=Load $UFile
        if(-not $u -or @($u).Count -eq 0){ WRN "No user data. Export from browser first." }
        else {
            $i=1; foreach($x in @($u)){
                $rc=switch($x.role){'owner'{'Yellow'}'staff'{'Cyan'}default{'White'}}
                Write-Host ("   [{0}] " -f $i) -NoNewline -ForegroundColor DarkGray
                Write-Host ("{0,-18}" -f $x.username) -NoNewline -ForegroundColor White
                Write-Host ("{0,-8}" -f $x.role.ToUpper()) -NoNewline -ForegroundColor $rc
                Write-Host $x.email -ForegroundColor DarkGray; $i++
            }
        }
        Ln; Write-Host "   [D] Delete user   [B] Back"; Write-Host ""
        $c=(Ask "Choose").ToUpper()
        switch($c){
            'B'{ return }
            'D'{
                $num=Ask "User number"; $idx=[int]$num-1; $u=Load $UFile
                if($idx -ge 0 -and $idx -lt @($u).Count){
                    $t=@($u)[$idx]
                    if($t.role -eq 'owner'){ ERR "Cannot delete owner account."; Start-Sleep 1; continue }
                    $cf=Ask "Delete '$($t.username)'? (y/n)"
                    if($cf -eq 'y'){ Save $UFile (@($u)|Where-Object{$_.id -ne $t.id}); OK "User deleted."; WriteLog "DELETE_USER" $t.username; Start-Sleep 1 }
                } else { ERR "Invalid number."; Start-Sleep 1 }
            }
        }
    }
}

# ── 3. LIVE IP (owner only) ──
function MenuLiveIP {
    Banner; Write-Host "  LIVE IP MONITOR" -ForegroundColor Cyan
    WRN "(Data from sessions.json — export from browser to update)"
    Ln
    $s=Load $SFile; $bans=@(Load $BanFile)|ForEach-Object{$_.ip}
    $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $online=0
    if(-not $s -or ($s.PSObject.Properties|Measure-Object).Count -eq 0){ WRN "No sessions. Export from browser first."; Pause; return }
    Write-Host ""
    Write-Host ("   {0,-16} {1,-8} {2,-18} {3,-14} {4}" -f "USERNAME","ROLE","IP ADDRESS","LAST SEEN","STATUS") -ForegroundColor DarkGray
    Ln
    foreach($p in $s.PSObject.Properties){
        $d=$p.Value; $age=$now-[long]$d.lastPing; $io=$age -lt 90000; if($io){$online++}
        $sc=if($io){'Green'}else{'DarkGray'}; $st=if($io){'● ONLINE'}else{'○ offline'}
        $ib=if($bans -contains $d.ip){'[BANNED]'}else{''}
        Write-Host ("   {0,-16}" -f $d.username) -NoNewline -ForegroundColor White
        Write-Host ("{0,-8}" -f $d.role.ToUpper()) -NoNewline -ForegroundColor Cyan
        Write-Host ("{0,-18}" -f $d.ip) -NoNewline -ForegroundColor Yellow
        Write-Host ("{0,-14}" -f (AgoStr $d.lastPing)) -NoNewline -ForegroundColor DarkGray
        Write-Host ("{0,-12}" -f $st) -NoNewline -ForegroundColor $sc
        Write-Host $ib -ForegroundColor Red
    }
    Ln; OK "Online now: $online"
    Write-Host ""; INF "R = Refresh   B = Back"
    $c=(Ask "").ToUpper(); if($c -eq 'R'){MenuLiveIP}
}
function AgoStr($ts){ if(-not $ts -or $ts -eq 0){return "—"};$diff=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-[long]$ts;$s=[int]($diff/1000);if($s -lt 60){return "$s""s ago"};if($s -lt 3600){return "$([int]($s/60))""m ago"};if($s -lt 86400){return "$([int]($s/3600))""h ago"};return "$([int]($s/86400))""d ago" }

# ── 4. BAN/UNBAN (owner only) ──
function MenuBan {
    while($true){
        Banner; Write-Host "  BAN / UNBAN IP" -ForegroundColor Red; Ln
        $b=Load $BanFile
        if(-not $b -or @($b).Count -eq 0){ Write-Host "   (no banned IPs)" -ForegroundColor DarkGray }
        else { $i=1; foreach($x in @($b)){ Write-Host ("   [{0,2}] " -f $i) -NoNewline -ForegroundColor DarkGray; Write-Host ("{0,-18}" -f $x.ip) -NoNewline -ForegroundColor Red; Write-Host ("{0,-22}" -f $x.reason) -NoNewline -ForegroundColor DarkGray; Write-Host "by $($x.bannedBy)" -ForegroundColor DarkGray; $i++ } }
        Ln; Write-Host "   [A] Ban IP   [U] Unban IP   [B] Back"; Write-Host ""
        $c=(Ask "Choose").ToUpper()
        switch($c){
            'B'{ return }
            'A'{ $ip=Ask "IP Address"; $rsn=Ask "Reason"; $by=Ask "Your username"
                $bans=ToArr(Load $BanFile); if($bans|Where-Object{$_.ip -eq $ip}){WRN "Already banned.";Start-Sleep 1;continue}
                [void]$bans.Add([PSCustomObject]@{ip=$ip;reason=$rsn;bannedBy=$by;bannedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()})
                Save $BanFile $bans; OK "IP $ip banned!"; WriteLog "BAN_IP" "$ip | $rsn"; Start-Sleep 1 }
            'U'{ $num=Ask "Number to unban"; $idx=[int]$num-1; $b=Load $BanFile
                if($idx -ge 0 -and $idx -lt @($b).Count){ $ip=@($b)[$idx].ip; Save $BanFile (@($b)|Where-Object{$_.ip -ne $ip}); OK "IP $ip unbanned!"; WriteLog "UNBAN_IP" $ip; Start-Sleep 1 }
                else{ ERR "Invalid number."; Start-Sleep 1 } }
        }
    }
}

# ── 5. RESET PASSWORD (owner only) ──
function MenuResetPwd {
    Banner; Write-Host "  RESET PASSWORD" -ForegroundColor Yellow; Ln
    $u=Load $UFile; if(-not $u -or @($u).Count -eq 0){ WRN "No user data."; Pause; return }
    $i=1; foreach($x in @($u)){ Write-Host ("   [{0}] " -f $i) -NoNewline -ForegroundColor DarkGray; Write-Host ("{0,-18}" -f $x.username) -NoNewline -ForegroundColor White; Write-Host $x.role -ForegroundColor Cyan; $i++ }
    Ln; $num=Ask "Select user number"; $idx=[int]$num-1
    if($idx -lt 0 -or $idx -ge @($u).Count){ ERR "Invalid number."; Pause; return }
    $t=@($u)[$idx]; $np=AskPwd "New password for '$($t.username)'"; $cp=AskPwd "Confirm password"
    if($np -ne $cp){ ERR "Passwords do not match!"; Pause; return }
    if($np.Length -lt 6){ ERR "Password must be at least 6 characters."; Pause; return }
    $all=ToArr(Load $UFile)
    for($k=0;$k -lt $all.Count;$k++){ if($all[$k].id -eq $t.id){ $all[$k].pwHash=HashPw $np; break } }
    Save $UFile $all; OK "Password for '$($t.username)' reset!"; WriteLog "RESET_PWD" $t.username
    WRN "Import users.json to browser for changes to take effect."; Pause
}

# ── 6. STAFF CODES (owner only) ──
function MenuCodes {
    while($true){
        Banner; Write-Host "  STAFF ACCESS CODES" -ForegroundColor Green; Ln
        $c=Load $CFile
        if(-not $c -or @($c).Count -eq 0){ Write-Host "   (no codes generated)" -ForegroundColor DarkGray }
        else {
            $i=1; foreach($x in @($c)){
                $sc=if($x.used){'DarkRed'}else{'Green'}; $st=if($x.used){"USED by $($x.usedBy)"}else{'ACTIVE'}
                Write-Host ("   [{0,2}] " -f $i) -NoNewline -ForegroundColor DarkGray
                Write-Host ("{0,-22}" -f $x.code) -NoNewline -ForegroundColor Cyan
                Write-Host $st -ForegroundColor $sc; $i++
            }
        }
        Ln; Write-Host "   [G] Generate new code   [R] Revoke code   [B] Back"; Write-Host ""
        $ch=(Ask "Choose").ToUpper()
        switch($ch){
            'B'{ return }
            'G'{
                $chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $code='STAFF-'
                for($j=0;$j -lt 4;$j++){ $code+=$chars[(Get-Random -Maximum $chars.Length)] }; $code+='-'
                for($j=0;$j -lt 4;$j++){ $code+=$chars[(Get-Random -Maximum $chars.Length)] }
                $codes=ToArr(Load $CFile)
                [void]$codes.Add([PSCustomObject]@{code=$code;used=$false;createdBy='owner';createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()})
                Save $CFile $codes; OK "Generated: $code"; WriteLog "GEN_CODE" $code; Pause
            }
            'R'{
                $num=Ask "Code number to revoke"; $idx=[int]$num-1; $codes=Load $CFile
                if($idx -ge 0 -and $idx -lt @($codes).Count){ $code=@($codes)[$idx].code; Save $CFile (@($codes)|Where-Object{$_.code -ne $code}); OK "Code $code revoked."; Start-Sleep 1 }
                else{ ERR "Invalid number."; Start-Sleep 1 }
            }
        }
    }
}

# ── 7. CREATE ACCOUNT (owner only) ──
function MenuCreateAcc {
    Banner; Write-Host "  CREATE NEW ACCOUNT" -ForegroundColor Green; Ln
    $u=Ask "Username"; $e=Ask "Email"; $p=AskPwd "Password"; $r=Ask "Role (user/staff/owner)"
    if($u.Length -lt 3){ ERR "Username must be at least 3 characters."; Pause; return }
    if($p.Length -lt 6){ ERR "Password must be at least 6 characters."; Pause; return }
    $users=Load $UFile; if(@($users)|Where-Object{$_.username -eq $u.ToLower()}){ ERR "Username already taken."; Pause; return }
    $users=ToArr(Load $UFile)
    [void]$users.Add([PSCustomObject]@{id="u"+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();username=$u.ToLower();email=$e;pwHash=HashPw $p;role=$r.ToLower();createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()})
    Save $UFile $users; OK "Account '$u' ($r) created!"; WriteLog "CREATE_USER" "$u | $r"
    WRN "Import users.json to browser for changes to take effect."; Pause
}

# ── 8. LOG ──
function ViewLog {
    Banner; Write-Host "  ACTIVITY LOG (last 30)" -ForegroundColor DarkGray; Ln
    if(Test-Path $LogFile){ $lines=Get-Content $LogFile -Encoding utf8 -Tail 30; foreach($l in $lines){ $p=$l -split ' \| '; Write-Host "   " -NoNewline; Write-Host ("{0,-22}" -f $p[0]) -NoNewline -ForegroundColor DarkGray; if($p.Count -gt 1){ Write-Host ("{0,-18}" -f $p[1]) -NoNewline -ForegroundColor Yellow }; if($p.Count -gt 2){ Write-Host $p[2] -ForegroundColor White } } }
    else{ WRN "No log file yet." }
    Pause
}

# ── 9. EXPORT/IMPORT GUIDE ──
function MenuExport {
    Banner; Write-Host "  EXPORT / IMPORT DATA GUIDE" -ForegroundColor DarkGray; Ln
    Write-Host ""
    Write-Host "  EXPORT FROM BROWSER TO JSON FILES:" -ForegroundColor Yellow
    Write-Host "  1. Open website in browser" -ForegroundColor White
    Write-Host "  2. Press F12 → Console tab" -ForegroundColor White
    Write-Host "  3. Run this script:" -ForegroundColor White
    Write-Host ""
    Write-Host "     const d={};" -ForegroundColor Cyan
    Write-Host "     ['_ox4_users','_ox4_builds','_ox4_bans','_ox4_sessions','_ox4_staffCodes'].forEach(k=>{" -ForegroundColor Cyan
    Write-Host "       d[k]=JSON.parse(localStorage.getItem(k)||'null');" -ForegroundColor Cyan
    Write-Host "     });" -ForegroundColor Cyan
    Write-Host "     console.log(JSON.stringify(d,null,2));" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  4. Copy output → paste into JSON files in /data/ folder" -ForegroundColor White
    Write-Host ""
    Write-Host "  IMPORT FROM JSON FILES TO BROWSER:" -ForegroundColor Yellow
    Write-Host "  1. Open browser Console (F12)" -ForegroundColor White
    Write-Host "  2. Copy file contents and run:" -ForegroundColor White
    Write-Host "     localStorage.setItem('_ox4_bans', JSON.stringify([...]));" -ForegroundColor Cyan
    Write-Host "     localStorage.setItem('_ox4_users', JSON.stringify([...]));" -ForegroundColor Cyan
    Write-Host "  3. Reload page" -ForegroundColor White
    Write-Host ""
    # Create template files
    if(-not(Test-Path $UFile))   { Save $UFile @();   OK "Created: users.json" }
    if(-not(Test-Path $BFile))   { Save $BFile @();   OK "Created: builds.json" }
    if(-not(Test-Path $BanFile)) { Save $BanFile @(); OK "Created: bans.json" }
    if(-not(Test-Path $CFile))   { Save $CFile @();   OK "Created: staffcodes.json" }
    if(-not(Test-Path $SFile))   { '{}' | Set-Content $SFile -Encoding utf8; OK "Created: sessions.json" }
    Pause
}

# ── ENTRY POINT ──
$role = AuthPanel
if(-not $role){ ERR "Login failed. Panel closing."; Start-Sleep 2; exit }
MainMenu $role
