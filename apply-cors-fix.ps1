# Firebase Storage CORS Configuration Script for Windows

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Firebase Storage CORS Configuration Helper" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Check if gcloud is installed
$gcloudInstalled = Get-Command gcloud -ErrorAction SilentlyContinue

if (-not $gcloudInstalled) {
    Write-Host "ERROR: Google Cloud SDK (gcloud) is not installed!" -ForegroundColor Red
    Write-Host "`nPlease install it from:" -ForegroundColor Yellow
    Write-Host "https://cloud.google.com/sdk/docs/install`n" -ForegroundColor Blue
    
    Write-Host "After installation, restart PowerShell and run this script again." -ForegroundColor Yellow
    
    Read-Host "`nPress Enter to exit"
    exit
}

Write-Host "✓ Google Cloud SDK is installed`n" -ForegroundColor Green

# Authenticate
Write-Host "Step 1: Authenticating with Google Cloud..." -ForegroundColor Yellow
Write-Host "A browser window will open. Please log in with your Firebase account.`n"
gcloud auth login

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Authentication failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "`n✓ Authentication successful`n" -ForegroundColor Green

# Set project
Write-Host "Step 2: Setting Firebase project..." -ForegroundColor Yellow
gcloud config set project timepass-df191

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Failed to set project!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "✓ Project set successfully`n" -ForegroundColor Green

# Apply CORS configuration
Write-Host "Step 3: Applying CORS configuration..." -ForegroundColor Yellow
gcloud storage buckets update gs://timepass-df191.appspot.com --cors-file=cors.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Failed to apply CORS configuration!" -ForegroundColor Red
    Write-Host "Trying alternative method with gsutil...`n" -ForegroundColor Yellow
    
    gsutil cors set cors.json gs://timepass-df191.appspot.com
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: Both methods failed!" -ForegroundColor Red
        Write-Host "Please check the FIREBASE_CORS_FIX.md file for manual instructions." -ForegroundColor Yellow
        Read-Host "`nPress Enter to exit"
        exit
    }
}

Write-Host "✓ CORS configuration applied successfully`n" -ForegroundColor Green

# Verify configuration
Write-Host "Step 4: Verifying CORS configuration..." -ForegroundColor Yellow
gcloud storage buckets describe gs://timepass-df191.appspot.com --format="default(cors_config)"

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "✓ CORS Configuration Complete!" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your development server (npm run dev)" -ForegroundColor White
Write-Host "2. Clear your browser cache (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "3. Try uploading a story again`n" -ForegroundColor White

Read-Host "Press Enter to exit"
