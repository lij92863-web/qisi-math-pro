param(
    [switch]$RemoveModels
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)

& (Join-Path $root 'stop.ps1') | Out-Null

$targets = @('runtime', 'tmp')
if ($RemoveModels) { $targets += 'models' }

foreach ($name in $targets) {
    $target = [System.IO.Path]::GetFullPath((Join-Path $root $name))
    if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove unmanaged path: $name"
    }
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}

[pscustomobject]@{
    ok = $true
    runtimeRemoved = $true
    modelsRemoved = [bool]$RemoveModels
    sourceCodeRemoved = $false
} | ConvertTo-Json
