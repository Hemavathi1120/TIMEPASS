# 🎥 Video Upload - Quick Reference

## ✅ What Was Fixed
- ✅ Increased video size limit: 100MB → **200MB**
- ✅ Added Cloudinary support (CORS-free)
- ✅ Better error messages
- ✅ Improved progress tracking
- ✅ Video-specific optimizations

## 🚀 Quick Start

### 1. Configure Cloudinary (Recommended)
```bash
# Run the setup script
.\setup-video-upload.ps1
```

### 2. Get Cloudinary Credentials
1. Go to: https://cloudinary.com/console
2. Sign up/login
3. Copy your **Cloud Name**
4. Create unsigned preset: `timepass_unsigned`

### 3. Update .env.local
```env
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name-here
VITE_CLOUDINARY_UPLOAD_PRESET=timepass_unsigned
```

### 4. Restart Server
```bash
npm run dev
```

## 📹 Upload a Video

1. Go to **Create** page
2. Click "Upload photo or video"
3. Select video (MP4, MOV, etc.)
4. Wait for upload (progress bar shows status)
5. Add caption
6. Click "Share Post"
7. View in **Reels** section!

## 🎯 File Limits
- **Videos**: 200MB max
- **Images**: 10MB max

## 🔧 Troubleshooting

### Upload Not Working?
1. Check browser console (F12)
2. Verify `.env.local` has correct Cloudinary credentials
3. Try smaller video first (< 10MB)
4. Restart dev server

### Common Errors
- **CORS policy** → Set up Cloudinary
- **File too large** → Reduce video size
- **Network error** → Check internet

## 📁 Files Changed
- `src/components/CreatePostNew.tsx` - Enhanced upload logic
- `.env.local` - Cloudinary configuration
- `VIDEO_UPLOAD_FIXED.md` - Full documentation

## 💡 Pro Tips
- Use **Cloudinary** for best results (no CORS!)
- Keep videos **under 100MB** for faster uploads
- Use **MP4 format** for compatibility
- Wait for **upload to complete** before navigating

---

**Need help? Check `VIDEO_UPLOAD_FIXED.md` for full guide!**
