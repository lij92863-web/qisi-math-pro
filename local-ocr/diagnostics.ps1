$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$pidFile = Join-Path $root 'runtime\service.pid'
$servicePid = $null
$running = $false

if (Test-Path -LiteralPath $pidFile) {
    $candidate = 0
    if ([int]::TryParse((Get-Content -Raw -LiteralPath $pidFile).Trim(), [ref]$candidate)) {
        $servicePid = $candidate
        $running = [bool](Get-Process -Id $candidate -ErrorAction SilentlyContinue)
    }
}

& node --check (Join-Path $root 'server.js') | Out-Null
$serverSyntax = $LASTEXITCODE -eq 0

[pscustomobject]@{
    ok = $true
    nodeVersion = (& node --version)
    serverSyntax = $serverSyntax
    pid = $servicePid
    processRunning = $running
    modelsDirectoryPresent = Test-Path -LiteralPath (Join-Path $root 'models')
    configuredPort = if ($env:QISI_LOCAL_OCR_PORT) { $env:QISI_LOCAL_OCR_PORT } else { '8765' }
    modelDownloadAttempted = $false
    note = 'Diagnostics never enumerate model files, source files, keys, or OCR content.'
} | ConvertTo-Json -Depth 4
