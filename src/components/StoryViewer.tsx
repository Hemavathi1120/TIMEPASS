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
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
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
    
    // Show like animation
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 1000);
    
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
              {/* Close button - Ultra Enhanced */}
              <motion.button 
                onClick={onClose}
                className="absolute top-6 right-6 z-20 text-white p-3 rounded-full bg-gradient-to-br from-red-500/40 to-pink-500/40 backdrop-blur-xl hover:from-red-500/60 hover:to-pink-500/60 transition-all duration-300 shadow-2xl hover:shadow-red-500/50 border border-white/20 group"
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0, rotate: 180 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close story"
              >
                <X className="h-6 w-6 drop-shadow-lg" />
                <div className="absolute inset-0 rounded-full bg-red-500/30 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300" />
              </motion.button>
              
              {/* Progress bars - Premium Enhanced */}
              <motion.div 
                className="absolute top-5 left-5 right-5 flex gap-2 z-20"
                initial={{ opacity: 0, y: -30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.9 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 300 }}
              >
                {stories.map((_, idx) => (
                  <motion.div 
                    key={idx} 
                    className="h-[4px] bg-white/15 backdrop-blur-xl flex-1 rounded-full overflow-hidden shadow-xl border border-white/20 relative"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    {/* Background glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-orange-500/30 blur-sm" />
                    
                    <motion.div 
                      className="relative h-full bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 shadow-[0_0_25px_rgba(236,72,153,0.9),0_0_40px_rgba(168,85,247,0.5)]"
                      initial={{ width: '0%' }}
                      animate={{ 
                        width: idx < currentIndex ? '100%' : 
                              idx === currentIndex ? `${progress}%` : '0%'
                      }}
                      transition={{ 
                        duration: idx === currentIndex ? 0.1 : 0.3,
                        ease: "linear"
                      }}
                    >
                      {/* Inner shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
              
              {/* User info - Ultra Enhanced */}
              <motion.div 
                className="absolute top-12 left-4 right-4 flex items-center gap-4 z-20 bg-gradient-to-br from-black/40 via-black/30 to-transparent backdrop-blur-xl p-3 rounded-3xl shadow-2xl border border-white/10"
                initial={{ opacity: 0, y: -30, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.8 }}
                transition={{ duration: 0.4, delay: 0.1, type: "spring", stiffness: 200 }}
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 p-[3px] shadow-xl">
                    <div className="bg-black rounded-full w-full h-full flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img 
                          src={user.avatarUrl} 
                          alt={user.username} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-xl">
                          {user.username?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Live indicator pulse */}
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-base drop-shadow-2xl truncate">{user.username}</div>
                  <div className="text-white/90 text-xs flex items-center gap-2.5 mt-0.5">
                    <span className="font-medium">{new Date(currentStory.createdAt?.toDate()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                    <span className="font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {currentIndex + 1} of {stories.length}
                    </span>
                  </div>
                </div>
                
                {/* View count badge - Ultra Enhanced */}
                {viewCount > 0 && userId === currentUser?.uid && (
                  <motion.div 
                    className="bg-gradient-to-br from-purple-500/30 to-pink-500/30 backdrop-blur-xl text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-xl border border-white/20"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                  >
                    <div className="w-2 h-2 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                    <span className="font-bold">{viewCount}</span>
                    <span className="font-medium opacity-90">{viewCount === 1 ? 'view' : 'views'}</span>
                  </motion.div>
                )}
              </motion.div>
              
              {/* Caption overlay - Ultra Enhanced */}
              {currentStory.caption && (
                <motion.div 
                  className="absolute bottom-32 left-4 right-4 bg-gradient-to-br from-purple-900/40 via-black/60 to-pink-900/40 backdrop-blur-2xl p-5 rounded-3xl shadow-2xl border border-white/20"
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 30, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: 0.2, type: "spring" }}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-50" />
                  <p className="relative text-white font-semibold text-base leading-relaxed drop-shadow-2xl">{currentStory.caption}</p>
                </motion.div>
              )}
              
              {/* Navigation arrows (visible on desktop) - Ultra Enhanced */}
              {!isMobile && (
                <>
                  <motion.div 
                    className="absolute top-1/2 left-6 transform -translate-y-1/2 z-30"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, x: -5 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl text-white hover:from-purple-500/50 hover:to-pink-500/50 rounded-full h-14 w-14 shadow-2xl border border-white/20 hover:border-white/40 transition-all duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPreviousStory();
                      }}
                      aria-label="Previous story"
                    >
                      <ChevronLeft className="h-7 w-7 drop-shadow-lg" />
                    </Button>
                  </motion.div>
                  <motion.div 
                    className="absolute top-1/2 right-6 transform -translate-y-1/2 z-30"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.1, x: 5 }}
                  >
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl text-white hover:from-purple-500/50 hover:to-pink-500/50 rounded-full h-14 w-14 shadow-2xl border border-white/20 hover:border-white/40 transition-all duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextStory();
                      }}
                      aria-label="Next story"
                    >
                      <ChevronRight className="h-7 w-7 drop-shadow-lg" />
                    </Button>
                  </motion.div>
                </>
              )}
              
              {/* Interaction bar - Ultra Enhanced */}
              <motion.div 
                className="absolute bottom-6 left-4 right-4 flex items-center gap-3 bg-gradient-to-br from-black/40 via-black/30 to-transparent backdrop-blur-2xl p-3 rounded-3xl shadow-2xl border border-white/20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              >
                <form onSubmit={handleSendComment} className="flex-1 flex gap-2">
                  <Input 
                    placeholder="Send message..." 
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 text-white placeholder:text-white/50 rounded-2xl h-12 px-5 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 transition-all"
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
                    className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl h-12 w-12 shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send comment"
                  >
                    <MessageCircle className="h-5 w-5 text-white" />
                  </Button>
                </form>
                
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="bg-gradient-to-br from-red-500/30 to-pink-500/30 backdrop-blur-xl text-white hover:from-red-500/50 hover:to-pink-500/50 rounded-2xl h-12 w-12 border border-white/20 shadow-lg hover:shadow-red-500/50 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikeStory();
                    }}
                    aria-label="Like story"
                  >
                    <Heart className="h-5 w-5 fill-current" />
                  </Button>
                </motion.div>
                
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="bg-gradient-to-br from-blue-500/30 to-cyan-500/30 backdrop-blur-xl text-white hover:from-blue-500/50 hover:to-cyan-500/50 rounded-2xl h-12 w-12 border border-white/20 shadow-lg hover:shadow-blue-500/50 transition-all"
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
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};