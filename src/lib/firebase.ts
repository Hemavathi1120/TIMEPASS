import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDF0Ps_QBUcHcs6ghEOd3H_3iEp6e3hLn4",
  authDomain: "timepass-df191.firebaseapp.com",
  projectId: "timepass-df191",
  storageBucket: "timepass-df191.firebaseapp.com",
  messagingSenderId: "964801554979",
  appId: "1:964801554979:web:7a03f096f7801a7f9c5f96",
  measurementId: "G-H79JBSFC9X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Utility for handling storage uploads with better error handling
export const uploadFileToStorage = async (
  file: File, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, path);
      
      // Set metadata with proper content type
      const metadata = {
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000',
      };
      
      // Use uploadBytesResumable for progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(progress);
          }
          console.log(`Upload is ${progress.toFixed(2)}% done`);
        },
        (error) => {
          // Handle upload errors
          console.error('Upload error:', error);
          
          // Provide user-friendly error messages
          let errorMessage = 'Failed to upload file.';
          
          switch (error.code) {
            case 'storage/unauthorized':
              errorMessage = 'You do not have permission to upload files.';
              break;
            case 'storage/canceled':
              errorMessage = 'Upload was cancelled.';
              break;
            case 'storage/unknown':
              errorMessage = 'An unknown error occurred. Please check your internet connection.';
              break;
            case 'storage/retry-limit-exceeded':
              errorMessage = 'Upload failed. Please check your internet connection and try again.';
              break;
            default:
              errorMessage = error.message || 'Failed to upload file.';
          }
          
          reject(new Error(errorMessage));
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('File uploaded successfully:', downloadURL);
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error('Upload completed but failed to get file URL.'));
          }
        }
      );
    } catch (error) {
      console.error('Firebase storage upload error:', error);
      reject(error);
    }
  });
}

// Initialize analytics only in browser environment
if (typeof window !== 'undefined') {
  getAnalytics(app);
}
