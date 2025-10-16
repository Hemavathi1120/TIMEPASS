# Quick Cloudinary Setup Script
# Run this in PowerShell to create .env file template

Write-Host "🚀 Cloudinary Setup for TIMEPASS" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "❌ Setup cancelled" -ForegroundColor Red
        exit
    }
}

Write-Host ""
Write-Host "📝 Let's set up Cloudinary!" -ForegroundColor Green
Write-Host ""
Write-Host "First, sign up at: https://cloudinary.com/users/register/free" -ForegroundColor Cyan
Write-Host ""

# Prompt for cloud name
$cloudName = Read-Host "Enter your Cloudinary Cloud Name (from dashboard)"

if ([string]::IsNullOrWhiteSpace($cloudName)) {
    Write-Host "❌ Cloud name cannot be empty!" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Creating upload preset..." -ForegroundColor Yellow
Write-Host "1. Go to: https://console.cloudinary.com/settings/upload" -ForegroundColor Cyan
Write-Host "2. Click 'Add upload preset'" -ForegroundColor Cyan
Write-Host "3. Name it: timepass_unsigned" -ForegroundColor Cyan
Write-Host "4. Set Signing Mode: Unsigned" -ForegroundColor Cyan
Write-Host "5. Click Save" -ForegroundColor Cyan
Write-Host ""

$ready = Read-Host "Have you created the upload preset? (y/N)"
if ($ready -ne "y" -and $ready -ne "Y") {
    Write-Host "⚠️  Please create the upload preset first!" -ForegroundColor Yellow
    exit
}

# Create .env file
$envContent = @"
# Cloudinary Configuration
# Get these from: https://console.cloudinary.com/
VITE_CLOUDINARY_CLOUD_NAME=$cloudName
VITE_CLOUDINARY_UPLOAD_PRESET=timepass_unsigned
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host ""
Write-Host "✅ .env file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Location: $(Get-Location)\.env" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔄 Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your dev server (Ctrl+C then npm run dev)" -ForegroundColor White
Write-Host "2. Try uploading a video/image" -ForegroundColor White
Write-Host "3. No more CORS errors! 🎉" -ForegroundColor White
Write-Host ""
Write-Host "📖 For more help, see: QUICK_UPLOAD_FIX.md" -ForegroundColor Cyan
Write-Host ""

# Ask if user wants to open Cloudinary dashboard
$openBrowser = Read-Host "Open Cloudinary dashboard now? (y/N)"
if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
    Start-Process "https://console.cloudinary.com/"
}

Write-Host ""
Write-Host "✨ Setup complete! Happy uploading! ✨" -ForegroundColor Green
