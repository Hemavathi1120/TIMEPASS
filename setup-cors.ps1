# Firebase Storage CORS Setup Script

# This script helps you configure CORS for Firebase Storage
# Run this in PowerShell (Windows) or Terminal (Mac/Linux)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Firebase Storage CORS Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
Write-Host "Checking for Google Cloud SDK..." -ForegroundColor Yellow
try {
    $gcloudVersion = gcloud version 2>&1
    Write-Host "✓ Google Cloud SDK is installed" -ForegroundColor Green
} catch {
    Write-Host "✗ Google Cloud SDK not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Google Cloud SDK:" -ForegroundColor Yellow
    Write-Host "https://cloud.google.com/sdk/docs/install" -ForegroundColor Blue
    Write-Host ""
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Step 1: Login to Google Cloud" -ForegroundColor Yellow
Write-Host "A browser window will open. Please login with your Google account." -ForegroundColor Gray
gcloud auth login

Write-Host ""
Write-Host "Step 2: Set Firebase Project" -ForegroundColor Yellow
gcloud config set project timepass-df191

Write-Host ""
Write-Host "Step 3: Apply CORS Configuration" -ForegroundColor Yellow
Write-Host "Using cors.json file..." -ForegroundColor Gray
gsutil cors set cors.json gs://timepass-df191.appspot.com

Write-Host ""
Write-Host "Step 4: Verify CORS Configuration" -ForegroundColor Yellow
gsutil cors get gs://timepass-df191.appspot.com

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✓ CORS Setup Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your development server" -ForegroundColor White
Write-Host "2. Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "3. Hard refresh your app (Ctrl+Shift+R)" -ForegroundColor White
Write-Host ""
Write-Host "If you still see CORS errors, wait a few minutes for changes to propagate." -ForegroundColor Gray
