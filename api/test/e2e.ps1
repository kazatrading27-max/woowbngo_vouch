$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:3001/api'
$RUN_UUID = [guid]::NewGuid().ToString().ToUpper()

function Invoke-Json($method, $path, $body, $token) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  try {
    if ($body) {
      $res = Invoke-RestMethod -Method $method -Uri "$BASE$path" -Headers $headers -Body ($body | ConvertTo-Json -Depth 5)
    } else {
      $res = Invoke-RestMethod -Method $method -Uri "$BASE$path" -Headers $headers
    }
    return @{ ok = $true; data = $res }
  } catch {
    $msg = $_.ErrorDetails.Message
    return @{ ok = $false; error = $msg }
  }
}

$fail = 0
function Check($name, $cond) {
  if ($cond) { Write-Host "PASS $name" } else { Write-Host "FAIL $name"; $script:fail++ }
}

# 1. health
$h = Invoke-Json 'GET' '/health' $null $null
Check 'health' ($h.ok -and $h.data.status -eq 'ok')

# 2. has-users => true (seeded)
$hu = Invoke-Json 'GET' '/auth/has-users' $null $null
Check 'has-users true' ($hu.ok -and $hu.data -eq $true)

# 3. bootstrap must conflict now
$bs = Invoke-Json 'POST' '/auth/bootstrap' @{ email='x@x.com'; password='Password1'; name='X' } $null
Check 'bootstrap conflict' (-not $bs.ok)

# 4. unauthenticated request rejected
$na = Invoke-Json 'GET' '/stations' $null $null
Check 'auth guard rejects anonymous' (-not $na.ok)

# 5. login admin
$login = Invoke-Json 'POST' '/auth/login' @{ email='admin@wowbingo.local'; password='ChangeMe!2026' } $null
Check 'admin login' ($login.ok -and $login.data.accessToken)
$admin = $login.data.accessToken

# 6. bad login rejected
$bad = Invoke-Json 'POST' '/auth/login' @{ email='admin@wowbingo.local'; password='wrong' } $null
Check 'bad login rejected' (-not $bad.ok)

# 7. create agent (unique email per run)
$agentEmail = "agent-$($RUN_UUID.Substring(0,8).ToLower())@wowbingo.local"
$agent = Invoke-Json 'POST' '/users' @{ email=$agentEmail; password='Agent!2026pass'; name='Test Agent'; role='AGENT' } $admin
Check 'create agent' ($agent.ok -and $agent.data.id)
$agentId = $agent.data.id

# 8. agent login
$alogin = Invoke-Json 'POST' '/auth/login' @{ email=$agentEmail; password='Agent!2026pass' } $null
Check 'agent login' ($alogin.ok -and $alogin.data.accessToken)
$atok = $alogin.data.accessToken

# 9. agent forbidden on users list
$au = Invoke-Json 'GET' '/users' $null $atok
Check 'agent forbidden on /users' (-not $au.ok)

# 10. register station as agent (unique uuid per run)
$st = Invoke-Json 'POST' '/stations' @{ uuid=$RUN_UUID; label="E2E Cafe PC1 ($($RUN_UUID.Substring(0,8)))"; ownerName='Abebe Kebede'; phone='+251911000000'; address='Bole, Addis Ababa'; notes='e2e station' } $atok
Check 'register station' ($st.ok -and $st.data.id)
$stationId = $st.data.id

# 11. duplicate uuid rejected
$dup = Invoke-Json 'POST' '/stations' @{ uuid=$RUN_UUID; label='Dup'; ownerName='Dup Owner' } $atok
Check 'duplicate station uuid rejected' (-not $dup.ok)

# 12. generate 3 vouchers as agent
$gen = Invoke-Json 'POST' '/vouchers' @{ stationId=$stationId; amount=9750; daysValid=30; share=15; count=3; note='e2e batch' } $atok
Check 'generate 3 vouchers' ($gen.ok -and $gen.data.Count -eq 3)
$vouchers = $gen.data
$codes = @($vouchers | ForEach-Object { $_.formattedCode })
Write-Host "Codes: $($codes -join ' | ')"

# 13. validation error on bad amount
$badAmt = Invoke-Json 'POST' '/vouchers' @{ stationId=$stationId; amount=99999999; count=1 } $atok
Check 'amount > 16777215 rejected' (-not $badAmt.ok)

# 14. list vouchers
$list = Invoke-Json 'GET' '/vouchers?pageSize=10' $null $admin
Check 'list vouchers' ($list.ok -and $list.data.total -ge 3)

# 15. stats
$stats = Invoke-Json 'GET' '/vouchers/stats' $null $admin
Check 'stats' ($stats.ok -and $stats.data.vouchersTotal -ge 3 -and $stats.data.creditsIssued -ge 29250)

# 16. validate tool: valid code + uuid
$vd = Invoke-Json 'POST' '/vouchers/validate' @{ code=$codes[0]; uuid=$RUN_UUID } $admin
Check 'validate tool valid' ($vd.ok -and $vd.data.valid -and $vd.data.amount -eq 9750)

# 17. validate tool: wrong uuid
$vdBad = Invoke-Json 'POST' '/vouchers/validate' @{ code=$codes[0]; uuid='AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE' } $admin
Check 'validate tool wrong uuid' ($vdBad.ok -and -not $vdBad.data.valid)

# 18. mark redeemed as agent
$mr = Invoke-Json 'POST' "/vouchers/$($vouchers[0].id)/redeem" $null $atok
Check 'mark redeemed (agent)' ($mr.ok -and $mr.data.status -eq 'REDEEMED')

# 19. double redeem rejected
$mr2 = Invoke-Json 'POST' "/vouchers/$($vouchers[0].id)/redeem" $null $atok
Check 'double redeem rejected' (-not $mr2.ok)

# 20. agent revoke forbidden
$rvA = Invoke-Json 'POST' "/vouchers/$($vouchers[1].id)/revoke" $null $atok
Check 'agent revoke forbidden' (-not $rvA.ok)

# 21. admin revoke
$rv = Invoke-Json 'POST' "/vouchers/$($vouchers[1].id)/revoke" $null $admin
Check 'admin revoke' ($rv.ok -and $rv.data.status -eq 'REVOKED')

# 22. agent update station forbidden
$su = Invoke-Json 'PATCH' "/stations/$stationId" @{ label='Hacked' } $atok
Check 'agent station update forbidden' (-not $su.ok)

# 23. admin updates station
$su2 = Invoke-Json 'PATCH' "/stations/$stationId" @{ label='E2E Cafe PC1-renamed' } $admin
Check 'admin station update' ($su2.ok -and $su2.data.label -eq 'E2E Cafe PC1-renamed')

# 24. python cross-validation of a web-generated code (through the DB flow)
$bridge = Join-Path (Get-Location) 'test\py_bridge.py'
$pyCheck = & python $bridge 'validate' ($codes[2] -replace '-','') $RUN_UUID 2>$null
Write-Host "Python validate of generated code: $pyCheck"

# 25. deactivate agent, agent login blocked
$deact = Invoke-Json 'PATCH' "/users/$agentId" @{ isActive=$false } $admin
Check 'deactivate agent' ($deact.ok)
$alogin2 = Invoke-Json 'POST' '/auth/login' @{ email=$agentEmail; password='Agent!2026pass' } $null
Check 'deactivated agent login blocked' (-not $alogin2.ok)

Write-Host ""
if ($fail -gt 0) { Write-Host "E2E FAILED: $fail failure(s)"; exit 1 } else { Write-Host 'E2E PASSED: all checks green' }
