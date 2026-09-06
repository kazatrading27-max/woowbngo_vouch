$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:3001/api'
$RUN = [guid]::NewGuid().ToString().ToUpper()

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
    return @{ ok = $false; error = $_.ErrorDetails.Message }
  }
}

$fail = 0
function Check($name, $cond) {
  if ($cond) { Write-Host "PASS $name" } else { Write-Host "FAIL $name"; $script:fail++ }
}

$login = Invoke-Json 'POST' '/auth/login' @{ email='admin@wowbingo.local'; password='ChangeMe!2026' } $null
$admin = $login.data.accessToken

# create station + vouchers
$st = Invoke-Json 'POST' '/stations' @{ uuid=$RUN; label="Hist Test $([guid]::NewGuid().ToString().Substring(0,6))"; ownerName='History Tester'; phone='+251912345678'; address='Test address'; notes='' } $admin
$stationId = $st.data.id
$gen = Invoke-Json 'POST' '/vouchers' @{ stationId=$stationId; amount=500; daysValid=30; share=10; count=3 } $admin
Check 'generate 3' ($gen.ok -and $gen.data.Count -eq 3)
$v1 = $gen.data[0]; $v2 = $gen.data[1]; $v3 = $gen.data[2]

# redeem one
$mr = Invoke-Json 'POST' "/vouchers/$($v1.id)/redeem" $null $admin
Check 'redeem sets status' ($mr.ok -and $mr.data.status -eq 'REDEEMED')
Check 'redeem sets redeemedAt' ($mr.data.redeemedAt -ne $null)

# per-station history: stats scoped
$stats = Invoke-Json 'GET' "/vouchers/stats?stationId=$stationId" $null $admin
Check 'scoped stats total=3' ($stats.ok -and $stats.data.vouchersTotal -eq 3)
Check 'scoped stats redeemed=1' ($stats.data.vouchersRedeemed -eq 1)
Check 'scoped stats credits=1500' ($stats.data.creditsIssued -eq 1500)

# per-station history: list scoped + newest first
$list = Invoke-Json 'GET' "/vouchers?stationId=$stationId&pageSize=20" $null $admin
Check 'scoped list returns 3' ($list.ok -and $list.data.total -eq 3)
Check 'list contains redeemedAt field' ($null -ne $list.data.items[0].PSObject.Properties['redeemedAt'])
Check 'redeemed voucher carries date' ($list.data.items | Where-Object { $_.id -eq $v1.id } | ForEach-Object { $_.redeemedAt -ne $null })

# global stats unchanged behavior (no stationId)
$gstats = Invoke-Json 'GET' '/vouchers/stats' $null $admin
Check 'global stats still works' ($gstats.ok -and $gstats.data.vouchersTotal -ge 3)

# history page renders (dynamic route)
$page = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000/stations/$stationId"
Check 'history page HTTP 200' ($page.StatusCode -eq 200)

# station page shows owner + labels in HTML
Check 'history page contains owner name' ($page.Content -match 'History Tester')

Write-Host ""
if ($fail -gt 0) { Write-Host "HISTORY TEST FAILED: $fail failure(s)"; exit 1 } else { Write-Host 'HISTORY TEST PASSED' }
