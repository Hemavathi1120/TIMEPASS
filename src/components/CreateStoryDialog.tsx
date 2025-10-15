import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, uploadFileToStorage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import imageCompression from 'browser-image-compression';

export const CreateStoryDialog = ({ 
  isOpen, 
  onClose,
  onStoryCreated 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onStoryCreated?: () => void;
}) => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Only images are supported for stories.",
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleCreateStory = async () => {
    if (!user || !mediaFile) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Compress the image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        onProgress: (progress: number) => {
          setUploadProgress(Math.round(progress * 30));
        }
      };
      
      let fileToUpload = mediaFile;
      try {
        const compressedFile = await imageCompression(mediaFile, options);
        fileToUpload = compressedFile;
      } catch (err) {
        console.warn("Image compression failed, using original file", err);
      }
      
      // Generate a unique filename
      const fileExtension = mediaFile.name.split('.').pop() || '';
      const fileName = `stories/${user.uid}_${Date.now()}.${fileExtension}`;
      
      // Use our utility function for uploading
      setUploadProgress(60);
      const mediaUrl = await uploadFileToStorage(fileToUpload, fileName, (progress) => {
        // Map the progress from 60% to 90%
        const mappedProgress = 60 + (progress * 0.3);
        setUploadProgress(Math.round(mappedProgress));
      });
      
      setUploadProgress(100);
      
      // Add story to Firestore
      await addDoc(collection(db, 'stories'), {
        userId: user.uid,
        mediaUrl,
        caption: caption.trim(),
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      });
      
      toast({
        title: "Story created!",
        description: "Your story has been published successfully.",
      });
      
      // Reset form
      setMediaFile(null);
      setPreviewUrl('');
      setCaption('');
      
      // Close dialog
      onClose();
      
      // Notify parent component
      if (onStoryCreated) {
        onStoryCreated();
      }
    } catch (error: any) {
      console.error("Error creating story:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create story. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setMediaFile(null);
      setPreviewUrl('');
      setCaption('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="story-description">
        <DialogHeader>
          <DialogTitle>Create new story</DialogTitle>
          <p id="story-description" className="sr-only">Upload an image to share as your story</p>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!previewUrl ? (
            <div 
              onClick={triggerFileInput}
              className="w-full h-80 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Click to upload an image</p>
            </div>
          ) : (
            <div className="relative w-full h-80">
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 rounded-xl">
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
              
              <img 
                src={previewUrl} 
                alt="Story preview" 
                className="w-full h-full object-cover rounded-xl"
              />
              
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl('');
                    setMediaFile(null);
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          
          {previewUrl && (
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploading}
              className="w-full px-3 py-2 border border-input bg-transparent rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateStory}
            disabled={!previewUrl || uploading}
            className={uploading ? "cursor-not-allowed" : ""}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Share Story'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};