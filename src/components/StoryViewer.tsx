import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MessageCircle, Heart, Share2 } from 'lucide-react';
import { collection, doc, getDoc, addDoc, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

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
}

export const StoryViewer = ({ stories, userId, onClose }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [viewCount, setViewCount] = useState(0);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const progressInterval = useRef<number | null>(null);
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
    
    // Cleanup on unmount
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
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
  
  const handleLikeStory = async () => {
    if (!currentUser) return;
    
    const currentStory = stories[currentIndex];
    
    try {
      // Add like to story
      await addDoc(collection(db, 'stories', currentStory.id, 'likes'), {
        userId: currentUser.uid,
        createdAt: new Date()
      });
      
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
        title: "Liked!",
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
    
    if (!currentUser || !comment.trim()) return;
    
    const currentStory = stories[currentIndex];
    
    setSending(true);
    try {
      // Add comment
      await addDoc(collection(db, 'stories', currentStory.id, 'comments'), {
        userId: currentUser.uid,
        text: comment.trim(),
        createdAt: new Date()
      });
      
      // Create notification if commenting on someone else's story
      if (currentStory.userId !== currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'story_comment',
          toUserId: currentStory.userId,
          fromUserId: currentUser.uid,
          storyId: currentStory.id,
          read: false,
          commentText: comment.trim(),
          createdAt: new Date()
        });
      }
      
      toast({
        title: "Comment sent!",
        description: "Your comment has been sent"
      });
      
      setComment('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };
  
  const toggleUI = () => {
    setShowUI(prev => !prev);
  };
  
  if (!stories.length || !user) return null;
  
  const currentStory = stories[currentIndex];
  
  // Render StoryViewer in a portal to ensure it's on top of everything
  return createPortal(
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[9999] bg-black overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        ref={viewerRef}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20 animate-gradient-shift" />
        
        {/* Story content with enhanced animations */}
        <motion.div 
          className="w-full h-full flex items-center justify-center relative"
          key={currentStory.id}
          initial={{ opacity: 0, scale: 0.85, rotateY: 90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.85, rotateY: -90 }}
          transition={{ duration: 0.3 }}
          onClick={toggleUI}
        >
          {/* Story media */}
          <div className="w-full h-full flex items-center justify-center">
            <img 
              ref={mediaRef}
              src={currentStory.mediaUrl} 
              alt="Story" 
              className="w-full h-full object-contain"
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
            className="absolute top-0 bottom-0 left-0 w-1/3 z-5"
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousStory();
            }}
            aria-label="Previous story"
          />
          <button 
            className="absolute top-0 bottom-0 right-0 w-1/3 z-5"
            onClick={(e) => {
              e.stopPropagation();
              goToNextStory();
            }}
            aria-label="Next story"
          />
        </motion.div>
        
        {/* UI Elements - conditionally shown */}
        <AnimatePresence>
          {showUI && (
            <>
              {/* Close button - Enhanced */}
              <motion.button 
                onClick={onClose}
                className="absolute top-5 right-5 z-20 text-white p-2.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-all duration-300 shadow-lg hover:shadow-xl group"
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0, rotate: 180 }}
                transition={{ duration: 0.3, type: "spring" }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close story"
              >
                <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
              </motion.button>
              
              {/* Progress bars - Enhanced */}
              <motion.div 
                className="absolute top-3 left-3 right-3 flex gap-1.5 z-20"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {stories.map((_, idx) => (
                  <div key={idx} className="h-[3px] bg-white/20 backdrop-blur-sm flex-1 rounded-full overflow-hidden shadow-sm">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-white via-white/90 to-white shadow-glow"
                      initial={{ width: '0%' }}
                      animate={{ 
                        width: idx < currentIndex ? '100%' : 
                              idx === currentIndex ? `${progress}%` : '0%'
                      }}
                      transition={{ 
                        duration: idx === currentIndex ? 0.1 : 0.3,
                        ease: "linear"
                      }}
                    />
                  </div>
                ))}
              </motion.div>
              
              {/* User info - Enhanced */}
              <motion.div 
                className="absolute top-10 left-4 right-4 flex items-center gap-3 z-20 bg-black/30 backdrop-blur-md p-2 rounded-2xl shadow-lg"
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-instagram p-[2.5px] shadow-lg">
                  <div className="bg-black rounded-full w-full h-full flex items-center justify-center overflow-hidden">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.username} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {user.username?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold text-sm drop-shadow-lg">{user.username}</div>
                  <div className="text-white/80 text-xs flex items-center gap-2">
                    <span>{new Date(currentStory.createdAt?.toDate()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    <span>{currentIndex + 1} of {stories.length}</span>
                  </div>
                </div>
                
                {/* View count badge - Enhanced */}
                {viewCount > 0 && userId === currentUser?.uid && (
                  <motion.div 
                    className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="font-medium">{viewCount} {viewCount === 1 ? 'view' : 'views'}</span>
                  </motion.div>
                )}
              </motion.div>
              
              {/* Caption overlay - Enhanced */}
              {currentStory.caption && (
                <motion.div 
                  className="absolute bottom-28 left-4 right-4 bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/10"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <p className="text-white font-medium leading-relaxed drop-shadow-lg">{currentStory.caption}</p>
                </motion.div>
              )}
              
              {/* Navigation arrows (visible on desktop) */}
              {!isMobile && (
                <>
                  <motion.div 
                    className="absolute top-1/2 left-4 transform -translate-y-1/2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full h-10 w-10"
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
                    className="absolute top-1/2 right-4 transform -translate-y-1/2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full h-10 w-10"
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
              
              {/* Interaction bar */}
              <motion.div 
                className="absolute bottom-4 left-4 right-4 flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <form onSubmit={handleSendComment} className="flex-1 flex gap-2">
                  <Input 
                    placeholder="Send message..." 
                    className="bg-black/50 backdrop-blur-sm border-gray-600 text-white placeholder:text-gray-300"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onClick={(e) => {
                      e.stopPropagation();
                      pauseStory();
                    }}
                    onBlur={() => resumeStory()}
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    variant="ghost"
                    disabled={sending || !comment.trim()}
                    className="bg-primary hover:bg-primary/90 rounded-full"
                    aria-label="Send comment"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </form>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full"
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
                  className="bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full"
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
                  <Share2 className="h-5 w-5" />
                </Button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};