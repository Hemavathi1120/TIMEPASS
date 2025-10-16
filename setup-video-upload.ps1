# Quick Setup Script for Video Upload Fix
Write-Host "🎥 Setting up Video Upload for Reels..." -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ .env.local not found!" -ForegroundColor Red
    Write-Host "Creating .env.local..." -ForegroundColor Yellow
    
    $envContent = @"
# Cloudinary Configuration for CORS-free uploads
# Get your credentials from https://cloudinary.com/console

# Your Cloudinary cloud name (example: dobktsnix)
VITE_CLOUDINARY_CLOUD_NAME=dobktsnix

# Your unsigned upload preset (example: timepass_unsigned)
# Create this in Cloudinary Console > Settings > Upload > Upload Presets
VITE_CLOUDINARY_UPLOAD_PRESET=timepass_unsigned
"@
    
    $envContent | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host "✅ .env.local created!" -ForegroundColor Green
} else {
    Write-Host "✅ .env.local already exists!" -ForegroundColor Green
}

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Get your Cloudinary credentials:"
Write-Host "   - Go to https://cloudinary.com/console"
Write-Host "   - Sign up or log in"
Write-Host "   - Find your Cloud Name in the dashboard"
Write-Host ""
Write-Host "2. Create an unsigned upload preset:"
Write-Host "   - Go to Settings > Upload > Upload Presets"
Write-Host "   - Click 'Add upload preset'"
Write-Host "   - Set signing mode to 'Unsigned'"
Write-Host "   - Name it 'timepass_unsigned'"
Write-Host "   - Save"
Write-Host ""
Write-Host "3. Update .env.local with your credentials:"
Write-Host "   - Open .env.local"
Write-Host "   - Replace 'dobktsnix' with your cloud name"
Write-Host "   - Keep preset as 'timepass_unsigned'"
Write-Host ""
Write-Host "4. Restart the dev server:"
Write-Host "   npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Then you can upload videos in the Reels section!" -ForegroundColor Green
Write-Host ""

# Ask if user wants to open Cloudinary
$openCloudinary = Read-Host "Open Cloudinary console in browser? (y/n)"
if ($openCloudinary -eq 'y' -or $openCloudinary -eq 'Y') {
    Start-Process "https://cloudinary.com/console"
}
