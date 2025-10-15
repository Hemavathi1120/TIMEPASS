import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDF0Ps_QBUcHcs6ghEOd3H_3iEp6e3hLn4",
  authDomain: "timepass-df191.firebaseapp.com",
  projectId: "timepass-df191",
  storageBucket: "timepass-df191.appspot.com",
  messagingSenderId: "964801554979",
  appId: "1:964801554979:web:7a03f096f7801a7f9c5f96",
  measurementId: "G-H79JBSFC9X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Apply custom settings to storage for better CORS handling
if (typeof window !== 'undefined') {
  // Only add these settings in browser environment
  storage.maxUploadRetryTime = 10000; // 10 seconds retry time
  storage.maxOperationRetryTime = 10000; // 10 seconds retry time
}

// Utility for handling storage uploads with CORS and error handling
export const uploadFileToStorage = async (file: File, path: string, onProgress?: (progress: number) => void) => {
  try {
    const storageRef = ref(storage, path);
    
    // Set metadata to help with CORS
    const metadata = {
      contentType: file.type,
      customMetadata: {
        'origin': window.location.origin,
        'app': 'timepass'
      }
    };
    
    // Upload with metadata
    await uploadBytes(storageRef, file, metadata);
    
    // Get download URL with cache-busting
    const downloadURL = await getDownloadURL(storageRef);
    return `${downloadURL}?alt=media&timestamp=${Date.now()}`;
  } catch (error) {
    console.error('Firebase storage upload error:', error);
    throw error;
  }
}

// Initialize analytics only in browser environment
if (typeof window !== 'undefined') {
  getAnalytics(app);
}
