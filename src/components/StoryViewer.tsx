import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MessageCircle, Heart, Share2, Trash2 } from 'lucide-react';
import { collection, doc, getDoc, addDoc, updateDoc, increment, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { StoryViewersDialog } from '@/components/StoryViewersDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  caption: string;
  createdAt: any;
  expiresAt: any;
  originalPostId: string;
}

interface StoryViewerProps {
  stories: Story[];
  userId: string;
  onClose: () => void;
  onStoryDeleted?: () => void;
}

export const StoryViewer = ({ stories, userId, onClose, onStoryDeleted }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewersDialog, setShowViewersDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const progressInterval = useRef<number | null>(null);
  const uiTimeoutRef = useRef<number | null>(null);
  const storyDuration = 5000; // 5 seconds per story
  const mediaRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Fetch user data
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUser(userDoc.data());
      }
    };
    
    fetchUser();
    
    // Reset progress when story changes
    setProgress(0);
    
    // Start progress timer
    startProgressTimer();
    
    // Record view if it's not the current user's story
    if (currentUser && userId !== currentUser.uid) {
      recordStoryView();
    }
    
    // Add keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPreviousStory();
      } else if (e.key === 'ArrowRight') {
        goToNextStory();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Preload the next image for smoother transitions
    if (currentIndex < stories.length - 1) {
      const nextImage = new Image();
      nextImage.src = stories[currentIndex + 1].mediaUrl;
    }
    
    // Lock body scroll while story is open
    document.body.style.overflow = 'hidden';
    
    // Auto-hide UI after 3 seconds
    setShowUI(true);
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }
    uiTimeoutRef.current = window.setTimeout(() => {
      setShowUI(false);
    }, 3000);
    
    // Cleanup on unmount
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (uiTimeoutRef.current) {
        clearTimeout(uiTimeoutRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [userId, currentIndex, currentUser]);
  
  // Function to record story view
  const recordStoryView = async () => {
    if (!currentUser) return;
    
    const currentStory = stories[currentIndex];
    
    try {
      // Check if this user has already viewed this story
      const viewsQuery = query(
        collection(db, 'stories', currentStory.id, 'views'),
        where('userId', '==', currentUser.uid)
      );
      
      const viewsSnapshot = await getDocs(viewsQuery);
      
      if (viewsSnapshot.empty) {
        // Add view if user hasn't viewed before
        await addDoc(collection(db, 'stories', currentStory.id, 'views'), {
          userId: currentUser.uid,
          createdAt: new Date()
        });
        
        // Update view count in the story document
        await updateDoc(doc(db, 'stories', currentStory.id), {
          viewCount: increment(1)
        });
      }
      
      // Fetch the total views count
      const totalViewsQuery = query(
        collection(db, 'stories', currentStory.id, 'views')
      );
      const totalViewsSnapshot = await getDocs(totalViewsQuery);
      setViewCount(totalViewsSnapshot.size);
      
      // Fetch the total likes count
      const totalLikesQuery = query(
        collection(db, 'stories', currentStory.id, 'likes')
      );
      const totalLikesSnapshot = await getDocs(totalLikesQuery);
      setLikeCount(totalLikesSnapshot.size);
      
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };
  
  const startProgressTimer = () => {
    // Clear any existing interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    // Only start the timer if not paused
    if (!paused) {
      const startTime = Date.now();
      
      // @ts-ignore - window.setInterval returns number in the browser
      progressInterval.current = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const newProgress = Math.min(elapsedTime / storyDuration * 100, 100);
        setProgress(newProgress);
        
        if (newProgress >= 100) {
          goToNextStory();
        }
      }, 16); // Update roughly 60 times per second
    }
  };
  
  const pauseStory = () => {
    setPaused(true);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };
  
  const resumeStory = () => {
    setPaused(false);
    startProgressTimer();
  };
  
  const goToPreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      // If we're at the first story, close the viewer
      onClose();
    }
  };
  
  const goToNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // If we're at the last story, close the viewer
      onClose();
    }
  };
  
  const handleDeleteStory = async () => {
    if (!currentUser || userId !== currentUser.uid) {
      console.warn('⚠️ Delete prevented - not owner or no user');
      return;
    }
    
    const currentStory = stories[currentIndex];
    setDeleting(true);
    
    // Set a timeout to prevent infinite loading
    const deleteTimeout = setTimeout(() => {
      console.error('❌ Delete operation timed out');
      setDeleting(false);
      setShowDeleteDialog(false);
      toast({
        title: "Delete timeout",
        description: "The operation took too long. Please try again.",
        variant: "destructive",
      });
    }, 15000); // 15 second timeout
    
    try {
      console.log('🗑️ Starting deletion process for story:', currentStory.id);
      
      // Step 1: Delete all subcollections (views, likes, comments) with individual error handling
      try {
        console.log('🧹 Deleting subcollections...');
        
        // Delete views with timeout protection
        try {
          const viewsSnapshot = await Promise.race([
            getDocs(collection(db, 'stories', currentStory.id, 'views')),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Views fetch timeout')), 5000))
          ]) as any;
          
          if (viewsSnapshot.docs && viewsSnapshot.docs.length > 0) {
            const viewDeletePromises = viewsSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
            await Promise.all(viewDeletePromises);
            console.log(`✅ Deleted ${viewsSnapshot.size} views`);
          }
        } catch (viewError) {
          console.warn('⚠️ Error deleting views (continuing):', viewError);
        }
        
        // Delete likes with timeout protection
        try {
          const likesSnapshot = await Promise.race([
            getDocs(collection(db, 'stories', currentStory.id, 'likes')),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Likes fetch timeout')), 5000))
          ]) as any;
          
          if (likesSnapshot.docs && likesSnapshot.docs.length > 0) {
            const likeDeletePromises = likesSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
            await Promise.all(likeDeletePromises);
            console.log(`✅ Deleted ${likesSnapshot.size} likes`);
          }
        } catch (likeError) {
          console.warn('⚠️ Error deleting likes (continuing):', likeError);
        }
        
        // Delete comments with timeout protection
        try {
          const commentsSnapshot = await Promise.race([
            getDocs(collection(db, 'stories', currentStory.id, 'comments')),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Comments fetch timeout')), 5000))
          ]) as any;
          
          if (commentsSnapshot.docs && commentsSnapshot.docs.length > 0) {
            const commentDeletePromises = commentsSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
            await Promise.all(commentDeletePromises);
            console.log(`✅ Deleted ${commentsSnapshot.size} comments`);
          }
        } catch (commentError) {
          console.warn('⚠️ Error deleting comments (continuing):', commentError);
        }
        
      } catch (subError) {
        console.warn('⚠️ Error in subcollection deletion (continuing anyway):', subError);
      }
      
      // Step 2: Delete the story document from Firestore
      await deleteDoc(doc(db, 'stories', currentStory.id));
      console.log('✅ Story document deleted from Firestore');
      
      // Step 3: Try to delete the media from Storage (if Firebase Storage)
      try {
        // Check if it's a Firebase Storage URL or external (Cloudinary, etc.)
        if (currentStory.mediaUrl.includes('firebasestorage.googleapis.com')) {
          // Extract the path from Firebase Storage URL
          const mediaPath = currentStory.mediaUrl.split('/o/')[1]?.split('?')[0];
          if (mediaPath) {
            const decodedPath = decodeURIComponent(mediaPath);
            const storageRef = ref(storage, decodedPath);
            await deleteObject(storageRef);
            console.log('✅ Media deleted from Firebase Storage');
          } else {
            console.warn('⚠️ Could not extract media path from Firebase URL');
          }
        } else {
          // External storage (Cloudinary, etc.) - skip deletion
          console.log('ℹ️ External media URL (Cloudinary) - skipping storage deletion');
        }
      } catch (storageError) {
        console.warn('⚠️ Could not delete media from storage (continuing anyway):', storageError);
        // Continue even if storage deletion fails
      }
      
      // Step 4: Clean up related notifications
      try {
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('storyId', '==', currentStory.id)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notifDeletePromises = notificationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(notifDeletePromises);
        console.log(`✅ Deleted ${notificationsSnapshot.size} related notifications`);
      } catch (notifError) {
        console.warn('⚠️ Error deleting notifications (continuing anyway):', notifError);
      }
      
      // Clear timeout since we succeeded
      clearTimeout(deleteTimeout);
      
      toast({
        title: "Story deleted! 🗑️",
        description: "Your story has been permanently removed",
      });
      
      setShowDeleteDialog(false);
      setDeleting(false);
      
      // Close the viewer first to avoid stale data issues
      onClose();
      
      // Then notify parent component to refresh stories
      if (onStoryDeleted) {
        setTimeout(() => {
          onStoryDeleted();
        }, 100);
      }
      
      console.log('✅ Story deletion complete!');
      
    } catch (error) {
      // Clear timeout on error
      clearTimeout(deleteTimeout);
      
      console.error('❌ Error deleting story:', error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete story. Please try again.",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
      setDeleting(false);
    }
  };
  
  const handleLikeStory = async () => {
    if (!currentUser) return;
    
    const currentStory = stories[currentIndex];
    
    // Show like animation
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 1000);
    
    try {
      // Check if user already liked this story
      const likesQuery = query(
        collection(db, 'stories', currentStory.id, 'likes'),
        where('userId', '==', currentUser.uid)
      );
      const likesSnapshot = await getDocs(likesQuery);
      
      if (!likesSnapshot.empty) {
        toast({
          title: "Already liked",
          description: "You've already liked this story"
        });
        return;
      }
      
      // Add like to story
      await addDoc(collection(db, 'stories', currentStory.id, 'likes'), {
        userId: currentUser.uid,
        createdAt: new Date()
      });
      
      // Update like count
      setLikeCount(prev => prev + 1);
      
      // Create notification
      if (currentStory.userId !== currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'story_like',
          toUserId: currentStory.userId,
          fromUserId: currentUser.uid,
          storyId: currentStory.id,
          read: false,
          createdAt: new Date()
        });
      }
      
      toast({
        title: "Liked! ❤️",
        description: "You liked this story"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser || !comment.trim()) {
      console.warn('Cannot send comment - missing user or empty comment');
      return;
    }
    
    const currentStory = stories[currentIndex];
    const commentText = comment.trim();
    
    console.log('Sending comment:', { storyId: currentStory.id, commentLength: commentText.length });
    
    setSending(true);
    try {
      // Add comment to story subcollection
      const commentRef = await addDoc(collection(db, 'stories', currentStory.id, 'comments'), {
        userId: currentUser.uid,
        text: commentText,
        createdAt: new Date()
      });
      
      console.log('✅ Comment added:', commentRef.id);
      
      // Create notification if commenting on someone else's story
      if (currentStory.userId !== currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'story_comment',
          toUserId: currentStory.userId,
          fromUserId: currentUser.uid,
          storyId: currentStory.id,
          read: false,
          commentText: commentText,
          createdAt: new Date()
        });
        
        console.log('✅ Notification created for user:', currentStory.userId);
      }
      
      toast({
        title: "Comment sent! 💬",
        description: "Your message has been delivered"
      });
      
      setComment('');
      setIsCommentFocused(false); // Reset focus state
      resumeStory(); // Resume story after sending
    } catch (error: any) {
      console.error('❌ Error sending comment:', error);
      toast({
        title: "Failed to send comment",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };
  
  const toggleUI = () => {
    setShowUI(prev => {
      const newState = !prev;
      
      // If showing UI, auto-hide after 3 seconds (but only if not commenting)
      if (newState) {
        if (uiTimeoutRef.current) {
          clearTimeout(uiTimeoutRef.current);
        }
        uiTimeoutRef.current = window.setTimeout(() => {
          // Don't hide UI if user is actively commenting
          if (!isCommentFocused) {
            setShowUI(false);
          }
        }, 3000);
      } else {
        // Clear timeout if manually hiding
        if (uiTimeoutRef.current) {
          clearTimeout(uiTimeoutRef.current);
        }
      }
      
      return newState;
    });
  };
  
  if (!stories.length || !user) return null;
  
  const currentStory = stories[currentIndex];
  
  // Render StoryViewer in a portal to ensure it's on top of everything
  return createPortal(
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[9999] overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        ref={viewerRef}
      >
        {/* Enhanced animated background with multiple layers */}
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black via-50% to-pink-900/30 animate-gradient-shift" />
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-900/20 via-transparent to-blue-900/20 opacity-50" />
        
        {/* Ambient light effects with multiple sources */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-purple-500/20 via-transparent to-transparent blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-pink-500/15 via-transparent to-transparent blur-3xl animate-float" />
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-gradient-radial from-orange-500/10 via-transparent to-transparent blur-3xl" style={{ animation: 'float 8s ease-in-out infinite reverse' }} />
        
        {/* Story content with enhanced animations */}
        <motion.div 
          className="w-full h-full flex items-center justify-center relative px-4 md:px-0"
          key={currentStory.id}
          initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.9, rotateY: -90 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 30 }}
          onClick={toggleUI}
        >
          {/* Story media container with enhanced styling */}
          <div className="relative w-full h-full max-w-lg flex items-center justify-center">
            {/* Image shadow/glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 blur-3xl opacity-50" />
            
            {/* Floating heart animation on double-tap */}
            <AnimatePresence>
              {showLikeAnimation && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  <Heart className="w-32 h-32 text-white fill-white drop-shadow-2xl animate-heartbeat" />
                </motion.div>
              )}
            </AnimatePresence>
            
            <img 
              ref={mediaRef}
              src={currentStory.mediaUrl} 
              alt="Story" 
              className="relative w-full h-full object-contain rounded-2xl shadow-2xl"
              draggable={false}
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/600x800?text=Media+Not+Available';
              }}
              onDoubleClick={handleLikeStory}
              onMouseDown={(e) => {
                e.stopPropagation();
                pauseStory();
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                resumeStory();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                pauseStory();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                resumeStory();
              }}
            />
          </div>
          
          {/* Swipe navigation areas */}
          <button 
            className="absolute top-0 bottom-0 left-0 w-1/3 z-[5] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousStory();
            }}
            aria-label="Previous story"
          />
          <button 
            className="absolute top-0 bottom-0 right-0 w-1/3 z-[5] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              goToNextStory();
            }}
            aria-label="Next story"
          />
        </motion.div>
        
        {/* Delete button - Only visible for own stories - Always shown */}
        {userId === currentUser?.uid && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              pauseStory();
              setShowDeleteDialog(true);
            }}
            className="absolute top-6 right-20 z-[30] text-white p-3 rounded-full bg-gradient-to-br from-red-600/40 to-orange-600/40 backdrop-blur-xl hover:from-red-600/60 hover:to-orange-600/60 transition-colors duration-200 shadow-lg border border-white/20 cursor-pointer"
            aria-label="Delete story"
          >
            <Trash2 className="h-5 w-5 drop-shadow-lg" />
          </button>
        )}
        
        {/* Close button - Always shown */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-6 right-6 z-[30] text-white p-3 rounded-full bg-gradient-to-br from-red-500/40 to-pink-500/40 backdrop-blur-xl hover:from-red-500/60 hover:to-pink-500/60 transition-colors duration-200 shadow-lg border border-white/20 cursor-pointer"
          aria-label="Close story"
        >
          <X className="h-6 w-6 drop-shadow-lg" />
        </button>
        
        {/* UI Elements - conditionally shown */}
        <AnimatePresence>
          {showUI && (
            <>
              
              {/* Progress bars - Minimal & Clean */}
              <motion.div 
                className="absolute top-3 left-3 right-3 flex gap-1.5 z-[25] pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {stories.map((_, idx) => (
                  <div 
                    key={idx} 
                    className="h-[2px] bg-white/20 flex-1 rounded-full overflow-hidden"
                  >
                    <motion.div 
                      className="h-full bg-white"
                      initial={{ width: '0%' }}
                      animate={{ 
                        width: idx < currentIndex ? '100%' : 
                              idx === currentIndex ? `${progress}%` : '0%'
                      }}
                      transition={{ 
                        duration: idx === currentIndex ? 0.1 : 0.2,
                        ease: "linear"
                      }}
                    />
                  </div>
                ))}
              </motion.div>
              
              {/* User info - Minimal & Clean */}
              <motion.div 
                className="absolute top-8 left-4 flex items-center gap-2.5 z-[25] bg-black/30 backdrop-blur-md p-2 pr-3 rounded-full pointer-events-none"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 p-[2px]">
                  <div className="bg-black rounded-full w-full h-full flex items-center justify-center overflow-hidden">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.username} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {user.username?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <div className="text-white font-semibold text-sm drop-shadow-lg">{user.username}</div>
                  <div className="text-white/70 text-xs">
                    {new Date(currentStory.createdAt?.toDate()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                {/* View and Like count badges - Clickable for own stories */}
                {userId === currentUser?.uid && (viewCount > 0 || likeCount > 0) && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowViewersDialog(true);
                      pauseStory();
                    }}
                    className="ml-2 flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-black/50 transition-all cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {viewCount > 0 && (
                      <div className="flex items-center gap-1 text-white/90 text-xs">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        <span className="font-medium">{viewCount}</span>
                      </div>
                    )}
                    {likeCount > 0 && (
                      <div className="flex items-center gap-1 text-white/90 text-xs">
                        <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                        <span className="font-medium">{likeCount}</span>
                      </div>
                    )}
                  </motion.button>
                )}
              </motion.div>
              
              {/* Caption overlay - Minimal */}
              {currentStory.caption && (
                <motion.div 
                  className="absolute bottom-24 left-4 right-4 bg-black/40 backdrop-blur-md p-3 rounded-2xl z-[25] pointer-events-none"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-white text-sm leading-relaxed drop-shadow-lg">{currentStory.caption}</p>
                </motion.div>
              )}
              
              {/* Navigation arrows (visible on desktop) - Minimal */}
              {!isMobile && (
                <>
                  <motion.div 
                    className="absolute top-1/2 left-4 transform -translate-y-1/2 z-[25]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ opacity: 1, scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 rounded-full h-10 w-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPreviousStory();
                      }}
                      aria-label="Previous story"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                  </motion.div>
                  <motion.div 
                    className="absolute top-1/2 right-4 transform -translate-y-1/2 z-[25]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ opacity: 1, scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 rounded-full h-10 w-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextStory();
                      }}
                      aria-label="Next story"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </motion.div>
                </>
              )}
              
              {/* Interaction bar - Enhanced with better comment handling */}
              <motion.div 
                className="absolute bottom-4 left-4 right-4 flex items-center gap-2 bg-black/40 backdrop-blur-xl p-3 rounded-2xl z-[30] shadow-2xl border border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <form 
                  onSubmit={handleSendComment} 
                  className="flex-1 flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input 
                    placeholder="Send a message..." 
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60 rounded-xl h-11 px-4 text-sm focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:border-white/40 transition-all"
                    value={comment}
                    onChange={(e) => {
                      e.stopPropagation();
                      setComment(e.target.value);
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                      console.log('💬 Comment input focused - pausing story and keeping UI visible');
                      setIsCommentFocused(true);
                      setShowUI(true); // Force UI to show
                      pauseStory();
                      // Clear any auto-hide timeout
                      if (uiTimeoutRef.current) {
                        clearTimeout(uiTimeoutRef.current);
                      }
                    }}
                    onBlur={() => {
                      console.log('💬 Comment input blurred - will resume story');
                      setIsCommentFocused(false);
                      // Don't resume immediately, give a small delay in case user is clicking send button
                      setTimeout(() => {
                        resumeStory();
                      }, 100);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={sending}
                    autoComplete="off"
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    variant="ghost"
                    disabled={sending || !comment.trim()}
                    className="bg-gradient-to-br from-purple-500/30 to-pink-500/30 hover:from-purple-500/50 hover:to-pink-500/50 rounded-xl h-11 w-11 disabled:opacity-30 transition-all flex-shrink-0 border border-white/10"
                    aria-label="Send comment"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sending ? (
                      <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <MessageCircle className="h-5 w-5 text-white" />
                    )}
                  </Button>
                </form>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="bg-gradient-to-br from-red-500/30 to-pink-500/30 hover:from-red-500/50 hover:to-pink-500/50 text-white rounded-xl h-11 w-11 transition-all flex-shrink-0 border border-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLikeStory();
                  }}
                  aria-label="Like story"
                >
                  <Heart className="h-5 w-5" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="bg-white/20 hover:bg-white/30 text-white rounded-xl h-10 w-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (navigator.share) {
                      navigator.share({
                        title: `${user.username}'s story on TIMEPASS`,
                        url: window.location.origin + '/stories/' + currentStory.id
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.origin + '/stories/' + currentStory.id);
                      toast({
                        title: "Link copied!",
                        description: "Story link copied to clipboard",
                      });
                    }
                  }}
                  aria-label="Share story"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-border/50">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Story?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. Your story will be permanently deleted from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteStory}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Story Viewers & Likers Dialog */}
        {showViewersDialog && (
          <StoryViewersDialog
            storyId={currentStory.id}
            onClose={() => {
              setShowViewersDialog(false);
              resumeStory();
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};