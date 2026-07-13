$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$runtime = [System.IO.Path]::GetFullPath((Join-Path $root 'runtime'))
$pidFile = Join-Path $runtime 'service.pid'
$stdoutFile = Join-Path $runtime 'service.stdout.log'
$stderrFile = Join-Path $runtime 'service.stderr.log'
$server = Join-Path $root 'server.js'

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

if (Test-Path -LiteralPath $pidFile) {
    $existingPid = 0
    if ([int]::TryParse((Get-Content -Raw -LiteralPath $pidFile).Trim(), [ref]$existingPid)) {
        if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
            [pscustomobject]@{ ok = $true; alreadyRunning = $true; pid = $existingPid } |
                ConvertTo-Json
            exit 0
        }
    }
    Remove-Item -LiteralPath $pidFile -Force
}

$process = Start-Process -FilePath 'node' `
    -ArgumentList @($server) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutFile `
    -RedirectStandardError $stderrFile `
    -PassThru

Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

[pscustomobject]@{
    ok = $true
    pid = $process.Id
    endpoint = 'http://127.0.0.1:8765'
    engine = 'unavailable'
    modelDownloadAttempted = $false
} | ConvertTo-Json
