# Story Functionality Diagnostic Guide

## Common Issues and Solutions

### 1. CORS Errors (Firebase Storage)
**Symptom**: Stories fail to upload, console shows CORS errors
**Solution**: Run the CORS fix script
```powershell
.\apply-cors-fix.ps1
```
Or manually configure using instructions in `FIREBASE_CORS_FIX.md`

### 2. Stories Not Appearing
**Possible Causes**:
- Stories expired (24-hour limit)
- User not following story creators
- Firestore query issues

**Debugging**:
1. Open browser console (F12)
2. Look for messages:
   - "Looking for stories from users: [...]"
   - "Found stories count: X"
   - "Found X stories for user Y"

### 3. Delete Not Working
**Check**:
- Only story owner can delete
- Delete button visible only for own stories
- Console should show: "Deleting story: [id]"

### 4. Buttons Not Clickable
**Fixed** in latest commit:
- All buttons now have proper z-index
- Delete/Close buttons always visible
- Navigation areas properly layered

### 5. Story Upload Fails
**Check**:
- Image file size (should compress to <1MB)
- Internet connection
- Firebase Storage permissions

## Testing Checklist

### Story Creation
- [ ] Click "Create" button opens dialog
- [ ] Can select image file
- [ ] Shows preview
- [ ] Can add caption
- [ ] Upload shows progress bar
- [ ] Success toast appears
- [ ] Story appears in stories bar

### Story Viewing
- [ ] Click story circle opens viewer
- [ ] Progress bars show at top
- [ ] Auto-advances after 5 seconds
- [ ] Can tap left/right to navigate
- [ ] Close button works
- [ ] ESC key closes viewer

### Story Deletion
- [ ] Delete button visible only for own stories
- [ ] Confirmation dialog appears
- [ ] Story removed from Firestore
- [ ] Media removed from Storage
- [ ] Stories list refreshes

### Story Interactions
- [ ] Like button works
- [ ] Share button works
- [ ] Comment input works
- [ ] Send button works

## Browser Console Commands

Test if stories are fetching:
```javascript
// Check Firestore connection
firebase.firestore().collection('stories').get()
  .then(snap => console.log('Stories:', snap.size))
  .catch(err => console.error('Error:', err));
```

## Firebase Console Checks

1. **Firestore Database** > stories collection
   - Should have documents with: userId, mediaUrl, caption, createdAt, expiresAt

2. **Storage** > stories folder
   - Should have uploaded images

3. **Authentication** > Users
   - Verify user is logged in

## Network Tab (DevTools)

Check for failed requests:
1. Open DevTools > Network tab
2. Filter by: XHR, Fetch
3. Look for red (failed) requests
4. Check status codes:
   - 403: Permission denied
   - 404: Not found
   - 500: Server error
   - CORS: Cross-origin blocked

## Common Fixes

### Clear Cache
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

### Restart Dev Server
```powershell
# Stop current server (Ctrl+C)
npm run dev
```

### Reinstall Dependencies
```powershell
rm -rf node_modules
rm package-lock.json
npm install
```

### Check Firebase Configuration
File: `src/lib/firebase.ts`
- storageBucket should be: "timepass-df191.firebaseapp.com"
- All API keys should be present
