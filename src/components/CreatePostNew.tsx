import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, uploadFileToStorage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image, Film, Loader2, Share2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export const CreatePostComponent = () => {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showShareToStory, setShowShareToStory] = useState(false);
  const [uploadedReelData, setUploadedReelData] = useState<{ id: string; mediaUrl: string; caption: string } | null>(null);
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

    // Check file size (200MB max for videos, 10MB for images)
    const maxSize = fileType === 'video' ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `${fileType === 'video' ? 'Videos' : 'Images'} must be less than ${fileType === 'video' ? '200MB' : '10MB'}.`,
        variant: "destructive",
      });
      return;
    }

    setMediaType(fileType as 'image' | 'video');
    setMediaFile(file);
    
    // Create a preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    
    // Show info toast for large files
    if (fileType === 'video') {
      toast({
        title: "Uploading video",
        description: "Video uploads may take a few moments. Please wait...",
      });
    } else if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Uploading large file",
        description: "This may take a few moments...",
      });
    }
    
    // Start upload process
    handleUploadMedia(file);
  };

  const handleUploadMedia = async (file: File) => {
    if (!user || !file) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      let downloadURL: string;
      
      // Check if Cloudinary is configured
      const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      
      const fileType = file.type.split('/')[0];
      
      if (cloudinaryCloudName && cloudinaryUploadPreset) {
        // Use Cloudinary (RECOMMENDED - no CORS issues!)
        console.log(`📤 Uploading ${fileType} to Cloudinary...`);
        downloadURL = await uploadToCloudinary(file);
      } else {
        // Use Firebase Storage (with retry logic)
        console.log(`📤 Uploading ${fileType} to Firebase Storage...`);
        console.warn('⚠️ Cloudinary not configured. Using Firebase which may have CORS issues.');
        console.log('💡 Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local');
        downloadURL = await uploadToFirebase(file);
      }
      
      setUploadProgress(100);
      setMediaUrl(downloadURL);
      
      toast({
        title: "Upload successful!",
        description: `Your ${fileType} has been uploaded successfully.`,
      });
    } catch (error: any) {
      console.error("❌ Upload error:", error);
      
      let errorMessage = "There was a problem uploading your file.";
      let errorDetails = "";
      
      // Provide specific error messages
      if (error.message?.includes('CORS')) {
        errorMessage = "Upload blocked by CORS policy.";
        errorDetails = "Please configure Cloudinary in .env.local for CORS-free uploads.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Network error occurred.";
        errorDetails = "Please check your internet connection and try again.";
      } else if (error.message?.includes('storage/unauthorized')) {
        errorMessage = "Upload permission denied.";
        errorDetails = "Please check Firebase Storage rules or use Cloudinary.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload failed",
        description: errorDetails || errorMessage,
        variant: "destructive",
      });
      
      // Clear the preview and file selection
      setPreviewUrl('');
      setMediaFile(null);
      setMediaType(null);
      setMediaUrl('');
    } finally {
      setUploading(false);
    }
  };

  // Upload to Cloudinary (CORS-free!)
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryUploadPreset);
    
    // Determine if it's a video or image
    const fileType = file.type.split('/')[0];
    
    // Add folder for organization
    formData.append('folder', fileType === 'video' ? 'timepass/videos' : 'timepass/images');
    
    // For videos, add resource type
    const resourceType = fileType === 'video' ? 'video' : 'auto';
    
    // Progress simulation (Cloudinary doesn't support progress directly)
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        // Slower progress for videos
        const increment = fileType === 'video' ? 5 : 10;
        return Math.min(prev + increment, 90);
      });
    }, fileType === 'video' ? 500 : 300);
    
    try {
      console.log(`📤 Uploading ${fileType} to Cloudinary (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Cloudinary error:', errorData);
        throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ ${fileType} uploaded successfully to Cloudinary!`);
      return data.secure_url;
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload ${fileType}: ${error.message}`);
    }
  };

  // Upload to Firebase with compression and retry
  const uploadToFirebase = async (file: File): Promise<string> => {
    let fileToUpload = file;
    const fileType = file.type.split('/')[0];
    
    // Only compress images (NOT videos)
    if (fileType === 'image') {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        onProgress: (progress: number) => {
          setUploadProgress(Math.round(progress * 30));
        }
      };
      
      try {
        console.log("🗜️ Compressing image...");
        const compressedFile = await imageCompression(file, options);
        console.log(`📊 Original: ${(file.size / 1024 / 1024).toFixed(2)}MB → Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        fileToUpload = compressedFile;
      } catch (err) {
        console.warn("⚠️ Compression failed, using original", err);
      }
    } else {
      console.log(`📹 Uploading video without compression (${(file.size / 1024 / 1024).toFixed(2)}MB)...`);
    }
    
    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${fileType}s/${user!.uid}_${Date.now()}.${fileExtension}`;
    
    // Use the utility function from firebase.ts with better error handling
    try {
      console.log(`🔄 Uploading ${fileType} to Firebase Storage...`);
      const downloadURL = await uploadFileToStorage(
        fileToUpload,
        fileName,
        (progress) => {
          // Progress callback
          const adjustedProgress = 30 + (progress * 0.7); // Map 0-100 to 30-100
          setUploadProgress(Math.round(adjustedProgress));
        }
      );
      
      console.log(`✅ ${fileType} upload successful!`);
      return downloadURL;
    } catch (error: any) {
      console.error(`❌ Firebase ${fileType} upload failed:`, error);
      throw error;
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
      const postData = {
        authorId: user.uid,
        media: [mediaUrl],
        mediaType: mediaType || 'image',
        caption: caption.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        visibility: 'public',
      };

      console.log('📝 Creating post with data:', postData);
      
      const docRef = await addDoc(collection(db, 'posts'), postData);
      
      console.log('✅ Post created successfully with ID:', docRef.id);
      console.log('🎬 Media type:', mediaType);

      toast({
        title: "Post created!",
        description: `Your ${mediaType === 'video' ? 'reel' : 'photo'} has been shared successfully.`,
      });
      
      // If it's a video, show share to story dialog
      if (mediaType === 'video') {
        setUploadedReelData({
          id: docRef.id,
          mediaUrl: mediaUrl,
          caption: caption.trim()
        });
        setShowShareToStory(true);
      } else {
        navigate('/');
      }
    } catch (error: any) {
      console.error('❌ Error creating post:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShareToStory = async () => {
    if (!user || !uploadedReelData) {
      toast({
        title: "Error",
        description: "Missing user or reel data",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Create story directly without any additional dialog
      const storyData = {
        authorId: user.uid,
        mediaUrl: uploadedReelData.mediaUrl,
        mediaType: 'video',
        caption: uploadedReelData.caption || '',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        views: [],
        isShared: true, // Mark as shared from reel
        sharedReelId: uploadedReelData.id, // Reference to original reel
      };
      
      // Add the story to Firestore
      await addDoc(collection(db, 'stories'), storyData);
      
      // Close dialog
      setShowShareToStory(false);
      setUploadedReelData(null);
      
      // Show success message
      toast({
        title: "✨ Shared to story!",
        description: "Your reel has been added to your story. It will be visible for 24 hours.",
      });
      
      // Navigate to reels page
      navigate('/reels');
    } catch (error: any) {
      console.error('Error creating story:', error);
      toast({
        title: "Error sharing to story",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipShareToStory = () => {
    setShowShareToStory(false);
    setUploadedReelData(null);
    navigate('/reels');
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
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-white/10 rounded-full p-4 mb-4"
                  >
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                  </motion.div>
                  
                  <div className="w-3/4 bg-white/20 rounded-full h-3 overflow-hidden mb-3">
                    <motion.div 
                      className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  
                  <motion.p 
                    className="text-white font-semibold text-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {uploadProgress < 30 && 'Preparing...'}
                    {uploadProgress >= 30 && uploadProgress < 80 && 'Uploading...'}
                    {uploadProgress >= 80 && uploadProgress < 100 && 'Almost done...'}
                    {uploadProgress === 100 && 'Complete!'}
                  </motion.p>
                  <p className="text-white/80 text-sm mt-1">{uploadProgress}%</p>
                  
                  {mediaType === 'video' && (
                    <p className="text-white/60 text-xs mt-4 max-w-xs text-center">
                      Large videos may take a moment to upload
                    </p>
                  )}
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

      {/* Share to Story Dialog - Shows after reel upload */}
      <Dialog open={showShareToStory} onOpenChange={setShowShareToStory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-instagram/10 rounded-full p-4">
                <CheckCircle className="w-12 h-12 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold gradient-text text-center">
              🎉 Reel Posted!
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Want to share your reel to your story? It will be visible for 24 hours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview of the reel */}
            {uploadedReelData && (
              <div className="relative aspect-video bg-secondary rounded-xl overflow-hidden border-2 border-primary/20">
                <video
                  src={uploadedReelData.mediaUrl}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <p className="text-white text-sm font-medium line-clamp-2">
                    {uploadedReelData.caption || 'Your reel'}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleShareToStory}
                disabled={loading}
                className="w-full bg-gradient-instagram hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Adding to Story...
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5 mr-2" />
                    Add to Story (24h)
                  </>
                )}
              </Button>

              <Button
                onClick={handleSkipShareToStory}
                disabled={loading}
                variant="outline"
                className="w-full h-11"
              >
                Skip for Now
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center bg-secondary/50 p-3 rounded-lg">
              💡 Your reel is already posted! This will add it to your story for 24 hours.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};