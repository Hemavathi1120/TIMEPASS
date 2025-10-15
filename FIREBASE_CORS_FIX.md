# Firebase Storage CORS Configuration Guide

## Problem
You're experiencing CORS (Cross-Origin Resource Sharing) errors when uploading files to Firebase Storage from localhost.

## Solution

### Step 1: Install Google Cloud SDK (if not already installed)

**Windows:**
1. Download the installer from: https://cloud.google.com/sdk/docs/install
2. Run the installer and follow the prompts
3. Restart your terminal after installation

### Step 2: Authenticate with Google Cloud

Open a new terminal and run:
```bash
gcloud auth login
```

This will open a browser window. Log in with the Google account that owns your Firebase project.

### Step 3: Set Your Firebase Project

```bash
gcloud config set project timepass-df191
```

### Step 4: Apply CORS Configuration

Navigate to your project directory and run:
```bash
gcloud storage buckets update gs://timepass-df191.appspot.com --cors-file=cors.json
```

### Step 5: Verify CORS Configuration

```bash
gcloud storage buckets describe gs://timepass-df191.appspot.com --format="default(cors_config)"
```

## Alternative Method (Using gsutil)

If you have gsutil installed instead:

```bash
gsutil cors set cors.json gs://timepass-df191.appspot.com
```

To verify:
```bash
gsutil cors get gs://timepass-df191.appspot.com
```

## Additional Fixes Applied

1. **Updated firebase.ts:**
   - Changed storage bucket URL to use `.firebaseapp.com` instead of `.appspot.com`
   - Implemented `uploadBytesResumable` for better progress tracking
   - Added comprehensive error handling with user-friendly messages
   - Improved retry logic

2. **Fixed Dialog Warnings:**
   - Added `aria-describedby` to CreateStoryDialog to fix accessibility warnings

## Testing

After applying the CORS configuration:

1. Restart your development server
2. Try uploading a story again
3. The upload should now work without CORS errors

## Troubleshooting

If you still see errors:

1. **Check Firebase Console:**
   - Go to https://console.firebase.google.com
   - Select your project (timepass-df191)
   - Navigate to Storage
   - Verify the bucket exists and has proper permissions

2. **Check Storage Rules:**
   Make sure your Firebase Storage rules allow authenticated uploads:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

3. **Clear Browser Cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear cache in browser settings

4. **Check Network:**
   - Ensure you have a stable internet connection
   - Try disabling VPN if you're using one

## Notes

- The CORS configuration allows all origins (`*`). In production, you should restrict this to your actual domain.
- The changes in `firebase.ts` provide better error messages and retry logic for uploads.
