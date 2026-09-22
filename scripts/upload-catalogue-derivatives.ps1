$ErrorActionPreference = "Continue"

$Root = (Get-Location).Path
$Bucket = "sparelink-india-assets"

$MaxRetries = 4
$RetryDelaySeconds = 3

$Limit = $null
foreach ($arg in $args) {
    if ($arg -like "--limit=*") {
        $Limit = [int]($arg -split "=", 2)[1]
    }
}

$Sources = @(
    @{
        Dir = Join-Path $Root "data/source-catalogue/images/thumbs"
        Prefix = "thumbs"
    },
    @{
        Dir = Join-Path $Root "data/source-catalogue/images/medium"
        Prefix = "medium"
    }
)

$Files = @()

foreach ($Source in $Sources) {
    if (Test-Path $Source.Dir) {
        Get-ChildItem -Path $Source.Dir -Filter "*.webp" -File -Recurse | ForEach-Object {

            $relative = $_.FullName.Substring($Source.Dir.Length).TrimStart("\")
            $relative = $relative -replace "\\", "/"

            $Files += [PSCustomObject]@{
                File = $_.FullName
                Key = "catalogue-images/$($Source.Prefix)/$relative"
            }
        }
    }
}

if ($Limit -and $Limit -gt 0) {
    $Files = @($Files | Select-Object -First $Limit)
}

Write-Host ""
Write-Host "========================================"
Write-Host "SPARELINK R2 RESUME UPLOADER"
Write-Host "========================================"
Write-Host "Total files: $($Files.Count)"
Write-Host "Max retries: $MaxRetries"
Write-Host ""

$Uploaded = 0
$Failed = 0
$Retried = 0
$FailedFiles = @()

foreach ($Item in $Files) {

    $Destination = "$Bucket/$($Item.Key)"
    $Success = $false

    for ($Attempt = 1; $Attempt -le $MaxRetries; $Attempt++) {

        Write-Host "Uploading: $($Item.Key) [Attempt $Attempt/$MaxRetries]"

        $Output = & cmd.exe /d /s /c "npx wrangler r2 object put `"$Destination`" --file `"$($Item.File)`" --remote --content-type `"image/webp`"" 2>&1

        $ExitCode = $LASTEXITCODE

        if ($ExitCode -eq 0) {
            $Success = $true
            $Uploaded++

            if ($Attempt -gt 1) {
                $Retried++
                Write-Host "  OK after retry"
            }
            else {
                Write-Host "  OK"
            }

            break
        }

        Write-Host "  Attempt $Attempt failed"

        if ($Attempt -lt $MaxRetries) {
            Write-Host "  Waiting $RetryDelaySeconds seconds before retry..."
            Start-Sleep -Seconds $RetryDelaySeconds
        }
        else {
            Write-Host "  FAILED after $MaxRetries attempts"
        }
    }

    if (-not $Success) {
        $Failed++

        $FailedFiles += $Item

        Add-Content -Path (Join-Path $Root "r2-upload-failures.txt") `
            -Value $Item.Key
    }

    $Processed = $Uploaded + $Failed

    Write-Host "Progress: $Processed/$($Files.Count) | Uploaded: $Uploaded | Failed: $Failed | Retried: $Retried"
    Write-Host ""
}

Write-Host ""
Write-Host "========================================"
Write-Host "UPLOAD COMPLETE"
Write-Host "========================================"
Write-Host "Total:       $($Files.Count)"
Write-Host "Uploaded:    $Uploaded"
Write-Host "Failed:      $Failed"
Write-Host "Retried:     $Retried"
Write-Host "========================================"

if ($FailedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "FAILED FILES SAVED TO:"
    Write-Host (Join-Path $Root "r2-upload-failures.txt")
}
