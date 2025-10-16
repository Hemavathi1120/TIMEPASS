# 🎥 Video Upload & Display - Troubleshooting Guide

## ✅ What Was Fixed

### Issue: Videos uploaded but not showing in Reels

**Root Causes:**
1. Videos were showing in Home feed instead of Reels
2. No navigation to Reels after video upload
3. Missing video loading error handling
4. No debug logging to track issues

**Solutions Applied:**

### 1. Updated CreatePostNew.tsx
- ✅ Added automatic navigation to Reels after video upload
- ✅ Enhanced success message to indicate video type
- ✅ Added console logging for debugging
- ✅ Better post data tracking

### 2. Updated Home.tsx
- ✅ Filtered out videos from Home feed
- ✅ Videos now only appear in Reels section
- ✅ Images and photos stay in Home feed

### 3. Updated Reels.tsx
- ✅ Added debug logging for video loading
- ✅ Added error handling for video player
- ✅ Added `crossOrigin="anonymous"` for CORS
- ✅ Track video load success/failure

---

## 🎬 How It Works Now

### Upload Flow:
```
1. User uploads video
   ↓
2. Video uploads to Cloudinary
   ↓
3. Post saved to Firestore with mediaType: 'video'
   ↓
4. User automatically navigated to /reels
   ↓
5. Reels page queries posts with mediaType === 'video'
   ↓
6. Videos appear in Reels feed!
```

### Feed Separation:
```
📱 HOME FEED:
- Photos (mediaType: 'image')
- Other media types
- NO videos

🎬 REELS:
- Videos ONLY (mediaType: 'video')
- Vertical scroll format
- Auto-play functionality
```

---

## 🔍 Debug & Verify

### Check Console Logs:

**When uploading a video:**
```
📤 Uploading video to Cloudinary...
✅ video upload successful!
📝 Creating post with data: { mediaType: 'video', ... }
✅ Post created successfully with ID: xyz123
🎬 Media type: video
```

**When viewing Reels:**
```
🔍 Fetching video reels from Firestore...
📊 Found 3 video posts
🎬 Video post xyz123: { mediaType: 'video', ... }
✅ Loaded 3 reels
✅ Video loaded successfully: xyz123
```

### Check Firestore Database:

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Open `posts` collection
4. Find your video post
5. Verify fields:
   ```json
   {
     "authorId": "user123",
     "media": ["https://res.cloudinary.com/..."],
     "mediaType": "video",  ← Should be "video" not "image"
     "caption": "Check this out!",
     "createdAt": { ... },
     "likesCount": 0,
     "commentsCount": 0,
     "visibility": "public"
   }
   ```

### Check Video URL:

1. Copy the video URL from Firestore
2. Open in new browser tab
3. Should play directly
4. URL format should be:
   ```
   https://res.cloudinary.com/dobktsnix/video/upload/...
   ```

---

## 🐛 Common Issues & Fixes

### Issue 1: Video uploaded but not in Reels

**Symptoms:**
- Upload successful
- No video in Reels section
- May or may not appear in Home

**Check:**
```javascript
// Open browser console (F12)
// Check if mediaType is set correctly
// Look for this log:
🎬 Media type: video  ← Should say "video"
```

**Fix:**
1. Check Firestore - verify `mediaType: "video"`
2. If it says `mediaType: "image"`, delete the post
3. Re-upload the video
4. Should now work correctly

### Issue 2: Video shows in Home feed

**This is now fixed!** Home feed filters out videos.

**To verify:**
1. Upload a video
2. Go to Home feed
3. Video should NOT appear
4. Go to Reels
5. Video SHOULD appear

### Issue 3: Video won't play in Reels

**Symptoms:**
- Video appears in Reels
- Black screen or error icon
- Won't play when clicked

**Check Console for:**
```
❌ Video load error for reel: xyz123
```

**Possible causes:**
1. **Invalid video URL** - Check Firestore URL
2. **CORS issue** - Video needs proper headers
3. **Video format** - Try MP4 format
4. **File corrupted** - Re-upload video

**Fix:**
1. Check browser console for error details
2. Verify video URL loads in new tab
3. Check Cloudinary dashboard for video
4. Try re-uploading with MP4 format

### Issue 4: Reels page shows "No Reels Yet"

**Symptoms:**
- Videos uploaded successfully
- Reels page empty
- Console shows no errors

**Check:**
```javascript
// Browser console should show:
🔍 Fetching video reels from Firestore...
📊 Found X video posts  ← Should be > 0
```

**If Found 0 posts:**
1. Videos might have wrong mediaType
2. Check Firestore manually
3. Look for posts with `mediaType: "video"`

**Fix:**
1. Delete wrong posts from Firestore
2. Re-upload videos
3. Verify mediaType in console logs

### Issue 5: Video upload fails

**See `CLOUDINARY_READY.md` for upload troubleshooting**

---

## ✅ Verification Checklist

After uploading a video, verify:

- [ ] Console shows: `📤 Uploading video to Cloudinary...`
- [ ] Console shows: `✅ video upload successful!`
- [ ] Console shows: `🎬 Media type: video`
- [ ] Console shows: `✅ Post created successfully`
- [ ] Automatically navigated to `/reels`
- [ ] Video appears in Reels section
- [ ] Video does NOT appear in Home feed
- [ ] Video plays when clicked
- [ ] Can pause/resume video
- [ ] Can scroll to next/previous videos
- [ ] Like/comment buttons work

---

## 🔧 Manual Database Checks

### Check if video exists in Firestore:

1. **Firebase Console**: https://console.firebase.google.com
2. Select your project: `timepass-df191`
3. Go to **Firestore Database**
4. Collection: `posts`
5. Look for documents with `mediaType: "video"`

### Check video in Cloudinary:

1. **Cloudinary Console**: https://cloudinary.com/console
2. Go to **Media Library**
3. Navigate to `timepass/videos/`
4. Your videos should be there
5. Click to preview - should play

### Verify video URL format:

**Correct format:**
```
https://res.cloudinary.com/dobktsnix/video/upload/v1234567890/timepass/videos/user123_1234567890.mp4
```

**Wrong format (won't work):**
```
blob:http://localhost:8081/...  ← Preview URL, not permanent!
```

---

## 🎯 Testing Steps

### Test 1: Upload & Display
1. Go to Create page
2. Upload a small video (< 10MB)
3. Add caption: "Test video"
4. Click "Share Post"
5. Should navigate to Reels
6. Video should appear and auto-play

### Test 2: Feed Separation
1. Upload a video
2. Upload an image
3. Go to Home - only image appears
4. Go to Reels - only video appears

### Test 3: Video Playback
1. Go to Reels
2. Video should auto-play
3. Click to pause
4. Click again to resume
5. Scroll down for next video
6. Previous video should stop

### Test 4: Interactions
1. Click like button - count increases
2. Click comment - opens dialog
3. Add comment - appears in list
4. Click profile - navigates to user profile

---

## 📊 Console Commands for Debugging

Open browser console (F12) and run:

### Check environment variables:
```javascript
console.log('Cloud Name:', import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);
console.log('Preset:', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
// Should show: dobktsnix and Timepass
```

### Check current user:
```javascript
// In any authenticated page
console.log('Current user:', firebase.auth().currentUser);
```

### Force reload Reels:
```javascript
// On Reels page
location.reload();
```

---

## 🆘 Still Having Issues?

### Step 1: Check Console Logs
- Press F12
- Go to Console tab
- Look for errors (red text)
- Look for our emoji logs (🎬, ✅, ❌)

### Step 2: Check Network Tab
- Press F12
- Go to Network tab
- Upload a video
- Look for Cloudinary upload request
- Should return 200 status code

### Step 3: Check Firestore
- Firebase Console
- Firestore Database
- Posts collection
- Verify video post exists
- Check mediaType field

### Step 4: Check Video URL
- Copy URL from Firestore
- Paste in new browser tab
- Should play the video
- If doesn't play → URL is wrong

### Step 5: Clear & Retry
```bash
# Clear browser cache
Ctrl + Shift + Delete

# Hard refresh
Ctrl + Shift + R

# Restart dev server
npm run dev
```

---

## 📝 Key Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| `CreatePostNew.tsx` | Auto-navigate to `/reels` | Direct users to see their video |
| `CreatePostNew.tsx` | Enhanced logging | Debug upload issues |
| `Home.tsx` | Filter out videos | Only show images/photos |
| `Reels.tsx` | Add error handling | Track video load issues |
| `Reels.tsx` | Add debug logging | Monitor video queries |

---

## ✨ Expected Behavior

### When uploading VIDEO:
1. Upload completes
2. Toast: "Your video has been shared successfully. Check it out in Reels!"
3. Navigate to `/reels`
4. Video appears and auto-plays

### When uploading IMAGE:
1. Upload completes
2. Toast: "Your photo has been shared successfully."
3. Navigate to `/` (home)
4. Image appears in home feed

### Home Feed:
- Shows images/photos only
- Videos filtered out
- Regular grid layout

### Reels Section:
- Shows videos only
- Images filtered out
- Vertical TikTok-style layout
- Auto-play current video
- Scroll to navigate

---

**Videos should now upload and display correctly!** 🎉

**If issues persist, check console logs and Firestore database.** 🔍
