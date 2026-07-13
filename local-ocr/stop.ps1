$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$runtime = [System.IO.Path]::GetFullPath((Join-Path $root 'runtime'))
$pidFile = [System.IO.Path]::GetFullPath((Join-Path $runtime 'service.pid'))

if (-not $pidFile.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to use an unmanaged PID file.'
}

if (-not (Test-Path -LiteralPath $pidFile)) {
    [pscustomobject]@{ ok = $true; alreadyStopped = $true } | ConvertTo-Json
    exit 0
}

$servicePid = 0
if (-not [int]::TryParse((Get-Content -Raw -LiteralPath $pidFile).Trim(), [ref]$servicePid)) {
    throw 'Local OCR PID file is invalid.'
}

$process = Get-Process -Id $servicePid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $servicePid -ErrorAction Stop
    $process.WaitForExit(5000) | Out-Null
}
Remove-Item -LiteralPath $pidFile -Force

[pscustomobject]@{ ok = $true; stopped = $true; pid = $servicePid } | ConvertTo-Json
