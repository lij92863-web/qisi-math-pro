param(
    [string]$InputDocx = ".\1.docx",
    [string]$OutRoot = ".\tmp\docx-pages",
    [int]$Dpi = 220
)

$ErrorActionPreference = "Stop"

function Get-SafeBaseName([string]$PathValue) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($PathValue)
    $invalid = [System.IO.Path]::GetInvalidFileNameChars()
    foreach ($ch in $invalid) {
        $base = $base.Replace([string]$ch, "_")
    }
    if ([string]::IsNullOrWhiteSpace($base)) { return "docx" }
    return $base
}

$docxPath = (Resolve-Path -LiteralPath $InputDocx).Path
$baseName = Get-SafeBaseName $docxPath
$outRootPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutRoot)
$outDir = Join-Path $outRootPath $baseName

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$pdfPath = Join-Path $outDir "$baseName.pdf"

$word = $null
$doc = $null
try {
    Write-Host "Starting Word COM..."
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    try { $word.AutomationSecurity = 3 } catch {}
    Write-Host "Opening DOCX: $docxPath"
    $doc = $word.Documents.Open($docxPath, $false, $true, $false)
    Write-Host "Exporting PDF: $pdfPath"
    $wdExportFormatPDF = 17
    $wdExportOptimizeForPrint = 0
    $wdExportAllDocument = 0
    $doc.ExportAsFixedFormat(
        $pdfPath,
        $wdExportFormatPDF,
        $false,
        $wdExportOptimizeForPrint,
        $wdExportAllDocument
    )
    Write-Host "PDF export complete."
}
finally {
    if ($doc) { $doc.Close([ref]$false) | Out-Null }
    if ($word) { $word.Quit() | Out-Null }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

$pdftoppm = (Get-Command pdftoppm -ErrorAction SilentlyContinue).Source
if (-not $pdftoppm) {
    throw "pdftoppm was not found. Install Poppler or ensure pdftoppm is on PATH."
}

$pagePrefix = Join-Path $outDir "page"
Get-ChildItem -LiteralPath $outDir -Filter "page-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force
& $pdftoppm -png -r $Dpi $pdfPath $pagePrefix
if ($LASTEXITCODE -ne 0) {
    throw "pdftoppm failed with exit code $LASTEXITCODE."
}

$pageFiles = Get-ChildItem -LiteralPath $outDir -Filter "page-*.png" |
    Sort-Object {
        $m = [regex]::Match($_.BaseName, "page-(\d+)$")
        if ($m.Success) { [int]$m.Groups[1].Value } else { 0 }
    }

if (-not $pageFiles.Count) {
    throw "No PNG pages were generated."
}

$manifest = [ordered]@{
    source = [System.IO.Path]::GetFileName($docxPath)
    generatedAt = (Get-Date).ToString("o")
    pdf = [System.IO.Path]::GetFileName($pdfPath)
    pages = @()
}

$idx = 0
foreach ($pageFile in $pageFiles) {
    $idx += 1
    $manifest.pages += [ordered]@{
        pageNo = $idx
        filename = $pageFile.Name
        url = $pageFile.Name
    }
}

$manifestPath = Join-Path $outDir "manifest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "Generated DOCX page images:"
Write-Host "  DOCX: $docxPath"
Write-Host "  PDF:  $pdfPath"
Write-Host "  Manifest: $manifestPath"
Write-Host "  Pages: $($pageFiles.Count)"
