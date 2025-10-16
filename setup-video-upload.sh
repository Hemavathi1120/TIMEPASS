#!/bin/bash

# Quick Setup Script for Video Upload Fix
echo "🎥 Setting up Video Upload for Reels..."
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo "Creating .env.local..."
    cat > .env.local << EOF
# Cloudinary Configuration for CORS-free uploads
# Get your credentials from https://cloudinary.com/console

# Your Cloudinary cloud name (example: dobktsnix)
VITE_CLOUDINARY_CLOUD_NAME=dobktsnix

# Your unsigned upload preset (example: timepass_unsigned)
# Create this in Cloudinary Console > Settings > Upload > Upload Presets
VITE_CLOUDINARY_UPLOAD_PRESET=timepass_unsigned
EOF
    echo "✅ .env.local created!"
else
    echo "✅ .env.local already exists!"
fi

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Get your Cloudinary credentials:"
echo "   - Go to https://cloudinary.com/console"
echo "   - Sign up or log in"
echo "   - Find your Cloud Name in the dashboard"
echo ""
echo "2. Create an unsigned upload preset:"
echo "   - Go to Settings > Upload > Upload Presets"
echo "   - Click 'Add upload preset'"
echo "   - Set signing mode to 'Unsigned'"
echo "   - Name it 'timepass_unsigned'"
echo "   - Save"
echo ""
echo "3. Update .env.local with your credentials:"
echo "   - Open .env.local"
echo "   - Replace 'dobktsnix' with your cloud name"
echo "   - Keep preset as 'timepass_unsigned'"
echo ""
echo "4. Restart the dev server:"
echo "   npm run dev"
echo ""
echo "🎉 Then you can upload videos in the Reels section!"
echo ""
