@echo off
echo ========================================
echo Firebase Storage CORS Fix - Windows
echo ========================================
echo.
echo This script will help you fix CORS errors
echo.
echo Step 1: Installing Google Cloud SDK
echo ========================================
echo.
echo Opening Google Cloud SDK installer page...
start https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
echo.
echo Please:
echo 1. Download and install Google Cloud SDK
echo 2. Restart this terminal after installation
echo 3. Run this script again
echo.
pause
echo.
echo Step 2: Checking if gcloud is installed...
where gcloud >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Google Cloud SDK not found!
    echo Please install it first, then restart terminal
    pause
    exit /b 1
)
echo SUCCESS: Google Cloud SDK is installed!
echo.
echo Step 3: Login to Google Cloud
echo ========================================
gcloud auth login
echo.
echo Step 4: Set Firebase Project
echo ========================================
gcloud config set project timepass-df191
echo.
echo Step 5: Apply CORS Configuration
echo ========================================
gsutil cors set cors.json gs://timepass-df191.appspot.com
echo.
echo Step 6: Verify CORS Configuration
echo ========================================
gsutil cors get gs://timepass-df191.appspot.com
echo.
echo ========================================
echo DONE! CORS has been configured!
echo ========================================
echo.
echo Next steps:
echo 1. Restart your dev server (npm run dev)
echo 2. Clear browser cache (Ctrl+Shift+Delete)
echo 3. Hard refresh (Ctrl+Shift+R)
echo 4. Try uploading again
echo.
pause
