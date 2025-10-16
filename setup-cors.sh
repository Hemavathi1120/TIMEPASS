#!/bin/bash
# Firebase Storage CORS Setup Script (Mac/Linux)
# Run this script with: bash setup-cors.sh

echo "=================================="
echo "Firebase Storage CORS Setup"
echo "=================================="
echo ""

# Check if gcloud is installed
echo "Checking for Google Cloud SDK..."
if command -v gcloud &> /dev/null
then
    echo "✓ Google Cloud SDK is installed"
else
    echo "✗ Google Cloud SDK not found"
    echo ""
    echo "Please install Google Cloud SDK:"
    echo "https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "For Mac with Homebrew:"
    echo "brew install --cask google-cloud-sdk"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

echo ""
echo "Step 1: Login to Google Cloud"
echo "A browser window will open. Please login with your Google account."
gcloud auth login

echo ""
echo "Step 2: Set Firebase Project"
gcloud config set project timepass-df191

echo ""
echo "Step 3: Apply CORS Configuration"
echo "Using cors.json file..."
gsutil cors set cors.json gs://timepass-df191.appspot.com

echo ""
echo "Step 4: Verify CORS Configuration"
gsutil cors get gs://timepass-df191.appspot.com

echo ""
echo "=================================="
echo "✓ CORS Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Restart your development server"
echo "2. Clear browser cache (Cmd+Shift+Delete)"
echo "3. Hard refresh your app (Cmd+Shift+R)"
echo ""
echo "If you still see CORS errors, wait a few minutes for changes to propagate."
