# 🎬 REEL UPLOAD - Quick Reference

## ⚡ FASTEST FIX (5 Minutes)

```powershell
# 1. Run setup script
.\setup-cloudinary.ps1

# 2. Sign up: https://cloudinary.com/users/register/free

# 3. Enter your cloud name when prompted

# 4. Restart server
npm run dev

# ✅ DONE! Upload videos with no CORS errors!
```

---

## 📋 Quick Checklist

### Setup:
```
☐ Run .\setup-cloudinary.ps1
☐ Sign up for Cloudinary (free)
☐ Create upload preset (unsigned)
☐ Enter cloud name in script
☐ Restart dev server
```

### Test:
```
☐ Upload a video file
☐ See progress bar animate
☐ Check console (no CORS errors)
☐ Video appears in preview
☐ Post shows in Reels feed
```

---

## 🔧 What's Fixed

| Issue | Status |
|-------|--------|
| CORS errors | ✅ Fixed (Cloudinary) |
| Upload fails | ✅ Fixed (retry logic) |
| No progress | ✅ Fixed (animated bar) |
| Generic errors | ✅ Fixed (specific messages) |
| Large files | ✅ Fixed (size validation) |
| Wrong types | ✅ Fixed (type validation) |

---

## 🎯 File Limits

```
Images:  ≤ 10MB  ✅
Videos:  ≤ 100MB ✅
```

---

## 📁 Your .env File

Location: **Project root** (next to package.json)

```env
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=timepass_unsigned
```

---

## 🚨 Common Errors

### "CORS policy"
→ Run `.\setup-cloudinary.ps1`

### "File too large"
→ Max 10MB (images) / 100MB (videos)

### "Invalid file type"
→ Use images or videos only

### "Network error"
→ Check internet, auto-retries 3x

---

## 📖 Full Guides

- **UPLOAD_FIX_SUMMARY.md** - Overview
- **QUICK_UPLOAD_FIX.md** - Detailed setup
- **UPLOAD_VISUAL_GUIDE.md** - Visual diagrams
- **INSTANT_CORS_FIX.md** - All CORS solutions

---

## ✅ Success Check

Open console (F12) and look for:

```
✅ "📤 Uploading to Cloudinary..."
✅ Progress: 0% → 30% → 60% → 90% → 100%
✅ "Upload successful!"
✅ No red CORS errors
```

---

## 🎉 Result

**Smooth, reliable video uploads!** 🚀

Upload videos → See progress → No errors → Appears in Reels!

---

**Quick Help:** Press F12 to see console errors
