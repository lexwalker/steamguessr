# Waits for scripts/build-dataset.mjs to grow public/data/games.json and pushes it to GitHub
# (which redeploys the site): every time the game count grows by 1000, and once more when the
# build log reports "done.". Run detached:
#   Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File scripts\watch-and-push.ps1' -WindowStyle Hidden
param([int]$Step = 1000, [int]$IntervalSeconds = 600)

$dir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$log = Join-Path $dir 'scripts\cache\watcher.log'
$buildLog = Join-Path $dir 'scripts\cache\build.log'
$dataFile = Join-Path $dir 'public\data\games.json'
$env:GCM_INTERACTIVE = 'never'

function Log($m) { Add-Content -Path $log -Value ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

Set-Location $dir
$committed = 0
try {
  $head = git show HEAD:public/data/games.json 2>$null | Out-String
  if ($head -match '"count":(\d+)') { $committed = [int]$matches[1] }
} catch { }
Log "watcher started, committed dataset has $committed games"

while ($true) {
  Start-Sleep -Seconds $IntervalSeconds
  $done = $false
  if (Test-Path $buildLog) { $done = ((Get-Content $buildLog -Tail 3) -join "`n") -match 'done\.' }
  if (-not (Test-Path $dataFile)) { continue }
  $raw = Get-Content $dataFile -Raw
  if ($raw -notmatch '"count":(\d+)') { continue }
  $n = [int]$matches[1]
  try { $null = $raw | ConvertFrom-Json } catch { Log "games.json not parseable yet, skipping"; continue }

  if (($n - $committed -ge $Step) -or ($done -and $n -ne $committed)) {
    git add public/data/games.json | Out-Null
    git -c core.safecrlf=false commit -q -m "Dataset: $n games`n`nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" 2>&1 | Out-Null
    $out = git push 2>&1 | Out-String
    Log ("pushed {0} games (done={1}) {2}" -f $n, $done, $out.Trim().Split("`n")[-1])
    $committed = $n
  }
  if ($done) { Log 'build finished, watcher exiting'; break }
}
