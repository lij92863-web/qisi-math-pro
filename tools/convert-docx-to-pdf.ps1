param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [Parameter(Mandatory=$true)]
    [string]$OutputDir
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-JsonAndExit($obj, $code) {
    $json = $obj | ConvertTo-Json -Compress -Depth 10
    Write-Output $json
    exit $code
}

try {
    if (-not (Test-Path -LiteralPath $InputPath)) {
        throw "Input file does not exist: $InputPath"
    }

    if (-not (Test-Path -LiteralPath $OutputDir)) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    $resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
    $resolvedOutputDir = (Resolve-Path -LiteralPath $OutputDir).Path

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedInput)
    $safeBaseName = $baseName -replace '[\\/:*?"<>|]', '_'
    $pdfPath = Join-Path $resolvedOutputDir ($safeBaseName + ".pdf")

    $word = $null
    $doc = $null

    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0

        try {
            # 3 = msoAutomationSecurityForceDisable
            $word.AutomationSecurity = 3
        } catch {}

        try {
            $doc = $word.Documents.Open($resolvedInput, $false, $true, $false)
        } catch {
            $doc = $word.Documents.OpenNoRepairDialog($resolvedInput, $false, $true, $false)
        }

        if ($doc -eq $null) {
            throw "Word failed to open DOCX: document object is null"
        }

        try {
            $doc.ExportAsFixedFormat($pdfPath, 17)
        } catch {
            $format = 17
            $doc.SaveAs2([ref]$pdfPath, [ref]$format)
        }

        $doc.Close($false)
        $doc = $null

        $word.Quit()
        $word = $null

        if (-not (Test-Path -LiteralPath $pdfPath)) {
            throw "PDF was not created: $pdfPath"
        }

        $pdfInfo = Get-Item -LiteralPath $pdfPath

        if ($pdfInfo.Length -le 0) {
            throw "PDF file is empty: $pdfPath"
        }

        Write-JsonAndExit @{
            ok = $true
            inputPath = $resolvedInput
            pdfPath = $pdfPath
            pdfBytes = $pdfInfo.Length
        } 0
    }
    finally {
        if ($doc -ne $null) {
            try { $doc.Close($false) } catch {}
            try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) } catch {}
        }

        if ($word -ne $null) {
            try { $word.Quit() } catch {}
            try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
        }

        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}
catch {
    Write-JsonAndExit @{
        ok = $false
        error = $_.Exception.Message
        inputPath = $InputPath
        outputDir = $OutputDir
    } 2
}
