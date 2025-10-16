import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, increment, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Send, MoreVertical, Play, Pause, Volume2, VolumeX, Film, Share2, Copy, Link2, Check, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { CommentSection } from '@/components/CommentSection';
import { CreateStoryDialog } from '@/components/CreateStoryDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Reel {
  id: string;
  authorId: string;
  media: string[];
  caption: string;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
  mediaType: string;
}

interface Author {
  username: string;
  avatarUrl: string;
}

const Reels = () => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [authors, setAuthors] = useState<{ [key: string]: Author }>({});
  const [liked, setLiked] = useState<{ [key: string]: boolean }>({});
  const [playing, setPlaying] = useState<{ [key: string]: boolean }>({});
  const [muted, setMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareReelId, setShareReelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showStoryDialog, setShowStoryDialog] = useState(false);
  const [storyShareContent, setStoryShareContent] = useState<{ mediaUrl: string; caption: string; mediaType?: 'image' | 'video' } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReels();
  }, []);

  useEffect(() => {
    // Auto-play current video
    if (reels.length > 0) {
      const currentReel = reels[currentIndex];
      if (currentReel && videoRefs.current[currentReel.id]) {
        videoRefs.current[currentReel.id]?.play();
        setPlaying({ ...playing, [currentReel.id]: true });
      }
    }
  }, [currentIndex, reels]);

  useEffect(() => {
    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        handlePrevious();
      } else if (e.key === 'ArrowDown' && currentIndex < reels.length - 1) {
        handleNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause(reels[currentIndex]?.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, reels]);

  const fetchReels = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching video reels from Firestore...');
      
      // Query all video posts (without orderBy to avoid composite index requirement)
      const reelsQuery = query(
        collection(db, 'posts'),
        where('mediaType', '==', 'video')
      );

      const reelsSnapshot = await getDocs(reelsQuery);
      
      console.log(`📊 Found ${reelsSnapshot.docs.length} video posts`);
      
      // Sort in memory by createdAt (newest first)
      const reelsData = reelsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log(`🎬 Video post ${doc.id}:`, data);
          return {
            id: doc.id,
            ...data,
          };
        })
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime; // Descending order (newest first)
        }) as Reel[];

      console.log(`✅ Loaded ${reelsData.length} reels`);
      setReels(reelsData);

      // Fetch authors for all reels
      const authorIds = [...new Set(reelsData.map(reel => reel.authorId))];
      const authorsData: { [key: string]: Author } = {};

      await Promise.all(
        authorIds.map(async (authorId) => {
          const authorDoc = await getDoc(doc(db, 'users', authorId));
          if (authorDoc.exists()) {
            authorsData[authorId] = authorDoc.data() as Author;
          }
        })
      );

      setAuthors(authorsData);

      // Check liked status for all reels
      if (user) {
        const likedStatus: { [key: string]: boolean } = {};
        await Promise.all(
          reelsData.map(async (reel) => {
            const likesQuery = query(
              collection(db, 'posts', reel.id, 'likes'),
              where('userId', '==', user.uid)
            );
            const likesSnapshot = await getDocs(likesQuery);
            likedStatus[reel.id] = !likesSnapshot.empty;
          })
        );
        setLiked(likedStatus);
      }

    } catch (error) {
      console.error('Error fetching reels:', error);
      toast({
        title: "Error loading reels",
        description: "Failed to load video content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (reelId: string, authorId: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to like this reel.",
        variant: "destructive",
      });
      return;
    }

    try {
      const likesRef = collection(db, 'posts', reelId, 'likes');
      const likesQuery = query(likesRef, where('userId', '==', user.uid));
      const likesSnapshot = await getDocs(likesQuery);

      if (likesSnapshot.empty) {
        // Add like
        console.log('❤️ Adding like to reel:', reelId);
        await addDoc(likesRef, { userId: user.uid, createdAt: new Date() });
        await updateDoc(doc(db, 'posts', reelId), {
          likesCount: increment(1),
        });
        setLiked({ ...liked, [reelId]: true });

        // Update reels state
        setReels(reels.map(reel =>
          reel.id === reelId ? { ...reel, likesCount: reel.likesCount + 1 } : reel
        ));

        // Show toast feedback
        toast({
          title: "Liked!",
          description: "❤️",
        });

        // Create notification if not own reel
        if (authorId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            type: 'like',
            toUserId: authorId,
            fromUserId: user.uid,
            postId: reelId,
            read: false,
            createdAt: new Date(),
          });
          console.log('🔔 Notification sent to:', authorId);
        }
      } else {
        // Remove like
        console.log('💔 Removing like from reel:', reelId);
        const likeDoc = likesSnapshot.docs[0];
        await deleteDoc(doc(db, 'posts', reelId, 'likes', likeDoc.id));
        await updateDoc(doc(db, 'posts', reelId), {
          likesCount: increment(-1),
        });
        setLiked({ ...liked, [reelId]: false });

        // Update reels state
        setReels(reels.map(reel =>
          reel.id === reelId ? { ...reel, likesCount: Math.max(0, reel.likesCount - 1) } : reel
        ));
      }
    } catch (error) {
      console.error('❌ Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const togglePlayPause = (reelId: string) => {
    const video = videoRefs.current[reelId];
    if (video) {
      if (video.paused) {
        video.play();
        setPlaying({ ...playing, [reelId]: true });
      } else {
        video.pause();
        setPlaying({ ...playing, [reelId]: false });
      }
    }
  };

  const toggleMute = () => {
    setMuted(!muted);
    Object.values(videoRefs.current).forEach(video => {
      if (video) video.muted = !muted;
    });
  };

  const handleNext = () => {
    if (currentIndex < reels.length - 1) {
      // Pause current video
      const currentReel = reels[currentIndex];
      if (videoRefs.current[currentReel.id]) {
        videoRefs.current[currentReel.id]?.pause();
        setPlaying({ ...playing, [currentReel.id]: false });
      }
      
      setCurrentIndex(currentIndex + 1);
      
      // Scroll to next video
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: (currentIndex + 1) * window.innerHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      // Pause current video
      const currentReel = reels[currentIndex];
      if (videoRefs.current[currentReel.id]) {
        videoRefs.current[currentReel.id]?.pause();
        setPlaying({ ...playing, [currentReel.id]: false });
      }
      
      setCurrentIndex(currentIndex - 1);
      
      // Scroll to previous video
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: (currentIndex - 1) * window.innerHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  const openComments = (reelId: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to comment on this reel.",
        variant: "destructive",
      });
      return;
    }
    console.log('💬 Opening comments for reel:', reelId);
    setActiveReelId(reelId);
    setShowComments(true);
  };

  const openShareDialog = (reelId: string) => {
    setShareReelId(reelId);
    setShowShareDialog(true);
    setCopied(false);
  };

  const handleShare = async (method: 'copy' | 'native') => {
    if (!shareReelId) return;

    const shareUrl = `${window.location.origin}/reels?id=${shareReelId}`;
    
    if (method === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "Reel link copied to clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
        toast({
          title: "Failed to copy",
          description: "Could not copy link to clipboard.",
          variant: "destructive",
        });
      }
    } else if (method === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this Reel!',
          text: 'Watch this amazing video',
          url: shareUrl,
        });
        toast({
          title: "Shared successfully!",
          description: "Reel shared.",
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Share failed:', error);
          toast({
            title: "Share failed",
            description: "Could not share reel.",
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleShareToStory = (reelId: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to share to your story.",
        variant: "destructive",
      });
      return;
    }

    const reel = reels.find(r => r.id === reelId);
    if (!reel) return;

    console.log('📖 Sharing reel to story:', reelId);
    
    // Set the content to share
    setStoryShareContent({
      mediaUrl: reel.media[0],
      caption: reel.caption || '',
      mediaType: (reel.mediaType === 'image' || reel.mediaType === 'video') ? reel.mediaType : 'video'
    });
    
    // Close share dialog and open story dialog
    setShowShareDialog(false);
    setShowStoryDialog(true);
    
    toast({
      title: "Share to Story",
      description: "Add this reel to your story!",
    });
  };

  const handleStoryCreated = () => {
    console.log('✅ Story created successfully');
    setStoryShareContent(null);
    toast({
      title: "Success!",
      description: "Reel shared to your story!",
    });
  };

  const handleDeleteReel = async (reelId: string, authorId: string) => {
    if (!user || user.uid !== authorId) {
      toast({
        title: "Permission denied",
        description: "You can only delete your own reels.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this reel? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🗑️ Deleting reel:', reelId);
      
      // Delete the post document
      await deleteDoc(doc(db, 'posts', reelId));
      
      // Update local state
      setReels(reels.filter(reel => reel.id !== reelId));
      
      toast({
        title: "Reel deleted",
        description: "Your reel has been removed.",
      });
      
      console.log('✅ Reel deleted successfully');
    } catch (error: any) {
      console.error('❌ Error deleting reel:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete reel. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-white mt-4">Loading reels...</p>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mx-auto mb-6">
            <Film className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">No Reels Yet</h2>
          <p className="text-gray-400 text-lg mb-6">
            Be the first to create a video reel!
          </p>
          <Button
            onClick={() => navigate('/create')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Create First Reel
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden pt-16 pb-20">
      {/* Reels Container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <AnimatePresence mode="wait">
          {reels.map((reel, index) => {
            const author = authors[reel.authorId];
            const isLiked = liked[reel.id] || false;
            const isPlaying = playing[reel.id] || false;

            return (
              <motion.div
                key={reel.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full h-screen snap-start snap-always flex items-center justify-center"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* Video Player */}
                <video
                  ref={(el) => (videoRefs.current[reel.id] = el)}
                  src={reel.media[0]}
                  loop
                  muted={muted}
                  playsInline
                  className="w-full h-full object-contain bg-black"
                  onClick={() => togglePlayPause(reel.id)}
                  onEnded={() => {
                    if (index < reels.length - 1) {
                      handleNext();
                    }
                  }}
                  onError={(e) => {
                    console.error('❌ Video load error for reel:', reel.id, reel.media[0]);
                    console.error('Error details:', e);
                  }}
                  onLoadedData={() => {
                    console.log('✅ Video loaded successfully:', reel.id);
                  }}
                  crossOrigin="anonymous"
                />

                {/* Play/Pause Overlay */}
                <AnimatePresence>
                  {!isPlaying && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-10 h-10 text-white ml-1" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom Gradient Overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

                {/* User Info & Caption */}
                <div className="absolute bottom-20 left-0 right-20 px-4 text-white">
                  <div
                    className="flex items-center space-x-3 mb-3 cursor-pointer"
                    onClick={() => navigate(`/profile/${reel.authorId}`)}
                  >
                    {author?.avatarUrl ? (
                      <img
                        src={author.avatarUrl}
                        alt={author.username}
                        className="w-10 h-10 rounded-full border-2 border-white object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center border-2 border-white">
                        <span className="text-lg font-bold">
                          {author?.username?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <span className="font-semibold text-lg">{author?.username || 'Unknown'}</span>
                  </div>
                  {reel.caption && (
                    <p className="text-sm line-clamp-3 mb-2">{reel.caption}</p>
                  )}
                </div>

                {/* Action Buttons (Right Side) */}
                <div className="absolute bottom-24 right-4 flex flex-col items-center space-y-6">
                  {/* Like Button */}
                  <motion.div
                    className="flex flex-col items-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-14 h-14 rounded-full ${
                        isLiked
                          ? 'bg-red-500/20 hover:bg-red-500/30'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                      onClick={() => handleLike(reel.id, reel.authorId)}
                    >
                      <Heart
                        className={`w-7 h-7 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
                      />
                    </Button>
                    <span className="text-white text-sm mt-1 font-semibold">
                      {reel.likesCount}
                    </span>
                  </motion.div>

                  {/* Comment Button */}
                  <motion.div
                    className="flex flex-col items-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20"
                      onClick={() => openComments(reel.id)}
                    >
                      <MessageCircle className="w-7 h-7 text-white" />
                    </Button>
                    <span className="text-white text-sm mt-1 font-semibold">
                      {reel.commentsCount}
                    </span>
                  </motion.div>

                  {/* Share Button */}
                  <motion.div
                    className="flex flex-col items-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20"
                      onClick={() => openShareDialog(reel.id)}
                    >
                      <Send className="w-7 h-7 text-white" />
                    </Button>
                  </motion.div>

                  {/* More Options */}
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20"
                        >
                          <MoreVertical className="w-7 h-7 text-white" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openShareDialog(reel.id)}>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/profile/${reel.authorId}`)}>
                          <span className="w-4 h-4 mr-2">👤</span>
                          View Profile
                        </DropdownMenuItem>
                        {user?.uid === reel.authorId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteReel(reel.id, reel.authorId)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Reel
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                </div>

                {/* Mute/Unmute Button (Top Right) */}
                <motion.div
                  className="absolute top-4 right-4"
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-12 h-12 rounded-full bg-black/50 hover:bg-black/70"
                    onClick={toggleMute}
                  >
                    {muted ? (
                      <VolumeX className="w-6 h-6 text-white" />
                    ) : (
                      <Volume2 className="w-6 h-6 text-white" />
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Comments Dialog */}
      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          {activeReelId && (
            <div className="overflow-y-auto max-h-[60vh]">
              <CommentSection postId={activeReelId} isOpen={showComments} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Reel</DialogTitle>
            <DialogDescription>
              Share this amazing video with others
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            {/* Share to Story Button */}
            <Button
              onClick={() => shareReelId && handleShareToStory(shareReelId)}
              className="w-full justify-start h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="w-5 h-5 mr-3" />
              <span>Share to Your Story</span>
            </Button>

            {/* Copy Link Button */}
            <Button
              onClick={() => handleShare('copy')}
              className="w-full justify-start h-14"
              variant="outline"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 mr-3 text-green-500" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-3" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>

            {/* Native Share Button (if supported) */}
            {navigator.share && (
              <Button
                onClick={() => handleShare('native')}
                className="w-full justify-start h-14 bg-gradient-instagram hover:opacity-90"
              >
                <Share2 className="w-5 h-5 mr-3" />
                <span>Share via...</span>
              </Button>
            )}

            {/* Share URL Display */}
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Link:</p>
              <p className="text-sm break-all font-mono">
                {shareReelId ? `${window.location.origin}/reels?id=${shareReelId}` : ''}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Dialog for Sharing */}
      <CreateStoryDialog
        isOpen={showStoryDialog}
        onClose={() => {
          setShowStoryDialog(false);
          setStoryShareContent(null);
        }}
        onStoryCreated={handleStoryCreated}
        sharedMediaUrl={storyShareContent?.mediaUrl}
        sharedCaption={storyShareContent?.caption}
        sharedMediaType={storyShareContent?.mediaType}
      />
    </div>
  );
};

export default Reels;
