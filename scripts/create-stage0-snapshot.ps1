$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$projectParent = Split-Path -Parent $projectRoot
$projectName = Split-Path -Leaf $projectRoot

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

$stagingName = "${projectName}_stage0_backup_${timestamp}"
$stagingPath = Join-Path $projectParent $stagingName
$zipPath = "${stagingPath}.zip"
$hashPath = "${zipPath}.sha256.txt"

Write-Host "[QISI_SNAPSHOT] Project root: $projectRoot"
Write-Host "[QISI_SNAPSHOT] Staging path: $stagingPath"
Write-Host "[QISI_SNAPSHOT] Zip path: $zipPath"

if (Test-Path $stagingPath) {
    Remove-Item $stagingPath -Recurse -Force
}

New-Item `
    -ItemType Directory `
    -Path $stagingPath `
    -Force | Out-Null

$robocopyArgs = @(
    $projectRoot,
    $stagingPath,
    "/E",
    "/R:2",
    "/W:1",
    "/XD",
    "node_modules",
    "tmp",
    ".git",
    "backups",
    "/XF",
    "*.log",
    "*.zip",
    "*.sha256.txt"
)

& robocopy @robocopyArgs

$robocopyExitCode = $LASTEXITCODE

if ($robocopyExitCode -gt 7) {
    throw "Robocopy failed with exit code $robocopyExitCode"
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive `
    -Path (Join-Path $stagingPath "*") `
    -DestinationPath $zipPath `
    -CompressionLevel Optimal

if (!(Test-Path $zipPath)) {
    throw "Snapshot ZIP was not created."
}

$hash = Get-FileHash `
    -Path $zipPath `
    -Algorithm SHA256

@(
    "File: $([System.IO.Path]::GetFileName($zipPath))"
    "SHA256: $($hash.Hash)"
    "CreatedAt: $((Get-Date).ToString('o'))"
    "ProjectRoot: $projectRoot"
) | Set-Content `
    -Path $hashPath `
    -Encoding UTF8

Remove-Item `
    $stagingPath `
    -Recurse `
    -Force

Write-Host ""
Write-Host "[QISI_SNAPSHOT] Snapshot created successfully."
Write-Host "[QISI_SNAPSHOT] ZIP: $zipPath"
Write-Host "[QISI_SNAPSHOT] SHA256: $($hash.Hash)"
Write-Host "[QISI_SNAPSHOT] Hash file: $hashPath"
