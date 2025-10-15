import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image, Film, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import imageCompression from 'browser-image-compression';

export const CreatePostComponent = () => {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine if it's an image or video
    const fileType = file.type.split('/')[0];
    if (fileType !== 'image' && fileType !== 'video') {
      toast({
        title: "Invalid file type",
        description: "Please upload an image or video file.",
        variant: "destructive",
      });
      return;
    }

    setMediaType(fileType as 'image' | 'video');
    setMediaFile(file);
    
    // Create a preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    
    // Start upload process
    handleUploadMedia(file);
  };

  const handleUploadMedia = async (file: File) => {
    if (!user || !file) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Compress image if it's an image file
      let fileToUpload = file;
      
      if (file.type.startsWith('image/')) {
        // Compression options
        const options = {
          maxSizeMB: 1, // Max file size in MB
          maxWidthOrHeight: 1920, // Max width/height
          useWebWorker: true,
          onProgress: (progress: number) => {
            setUploadProgress(Math.round(progress * 30)); // First 30% is compression
          }
        };
        
        try {
          console.log("Compressing image...");
          const compressedFile = await imageCompression(file, options);
          console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
          console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
          fileToUpload = compressedFile;
        } catch (err) {
          console.warn("Image compression failed, using original file", err);
        }
      }
    
      // Generate a unique filename
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `posts/${user.uid}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      // Upload to Firebase Storage
      await uploadBytes(storageRef, fileToUpload);
      setUploadProgress(80); // 80% after upload completes
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      setUploadProgress(100); // 100% when URL is retrieved
      setMediaUrl(downloadURL);
      
      toast({
        title: "Upload successful!",
        description: "Your media has been uploaded.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "There was a problem uploading your file.",
        variant: "destructive",
      });
      
      // Clear the preview and file selection
      setPreviewUrl('');
      setMediaFile(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mediaUrl) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        media: [mediaUrl],
        mediaType: mediaType || 'image',
        caption: caption.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        visibility: 'public',
      });

      toast({
        title: "Post created!",
        description: "Your post has been shared successfully.",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8 gradient-text">Create New Post</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!previewUrl ? (
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={triggerFileInput}
              className="border-2 border-dashed border-border rounded-3xl p-16 text-center cursor-pointer hover:border-primary transition-all bg-card shadow-lg hover:shadow-xl"
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />
              <div className="w-20 h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <p className="text-xl font-semibold mb-3">Upload photo or video</p>
              <div className="flex justify-center gap-4 mb-4">
                <span className="flex items-center text-muted-foreground">
                  <Image className="w-4 h-4 mr-1" /> Images
                </span>
                <span className="flex items-center text-muted-foreground">
                  <Film className="w-4 h-4 mr-1" /> Videos
                </span>
              </div>
              <p className="text-muted-foreground">Click to browse files</p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden bg-card shadow-xl"
            >
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                  <div className="w-3/4 bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-white h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-white mt-2">
                    {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                  </p>
                </div>
              )}
              
              {mediaType === 'video' ? (
                <video
                  src={previewUrl}
                  controls
                  className="w-full h-auto max-h-96 object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="w-full h-auto max-h-96 object-contain"
                />
              )}
              
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl('');
                    setMediaUrl('');
                    setMediaFile(null);
                    setMediaType(null);
                  }}
                  className="absolute top-4 right-4 glass-effect hover:bg-opacity-80 rounded-full p-3 transition-all shadow-lg"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              )}
            </motion.div>
          )}

          <Textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={uploading}
            className="min-h-32 bg-card border-border resize-none text-base rounded-2xl shadow-md focus:shadow-lg transition-shadow"
          />

          <Button
            type="submit"
            disabled={!mediaUrl || loading || uploading}
            className="w-full bg-gradient-instagram hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <div className="flex items-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Creating Post...
              </div>
            ) : (
              'Share Post'
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};