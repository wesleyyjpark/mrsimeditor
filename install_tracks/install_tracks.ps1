# PowerShell script to copy track files to Documents/MRSIM/Tracks
# Run this script from the install_tracks folder

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceFolder = Join-Path $scriptDir "..\tracks"
$destFolder = Join-Path $env:USERPROFILE "Documents\MRSIM\Tracks"

# Check if source folder exists
if (-not (Test-Path $sourceFolder)) {
    Write-Host "Error: Source folder '$sourceFolder' not found!" -ForegroundColor Red
    exit 1
}

# Check if destination folder exists
if (-not (Test-Path $destFolder)) {
    Write-Host "Error: Destination folder '$destFolder' not found!" -ForegroundColor Red
    Write-Host "Please make sure MRSIM is installed and the Tracks folder exists."
    exit 1
}

# Get all XML files
$xmlFiles = Get-ChildItem -Path $sourceFolder -Filter "*.xml"

if ($xmlFiles.Count -eq 0) {
    Write-Host "No XML files found in '$sourceFolder'"
    exit 0
}

Write-Host "Destination: $destFolder"

# Copy files
$copiedCount = 0
$skippedCount = 0

foreach ($file in $xmlFiles) {
    $destFile = Join-Path $destFolder $file.Name
    
    if (Test-Path $destFile) {
        Write-Host "  Skipping $($file.Name) (already exists)" -ForegroundColor Yellow
        $skippedCount++
    } else {
        Copy-Item -Path $file.FullName -Destination $destFile
        Write-Host "  Copied $($file.Name)" -ForegroundColor Green
        $copiedCount++
    }
}

Write-Host ""
Write-Host "Done! Copied $copiedCount file(s), skipped $skippedCount file(s)" -ForegroundColor Cyan
Write-Host "Tracks are now available at: $destFolder"

