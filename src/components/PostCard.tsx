import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Send, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { CommentSection } from '@/components/CommentSection';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Post {
  id: string;
  authorId: string;
  media: string[];
  caption: string;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
}

interface Author {
  username: string;
  avatarUrl: string;
}

export const PostCard = ({ post }: { post: Post }) => {
  const [author, setAuthor] = useState<Author | null>(null);
  const [liked, setLiked] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isAddingStory, setIsAddingStory] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchAuthor = async () => {
      const authorDoc = await getDoc(doc(db, 'users', post.authorId));
      if (authorDoc.exists()) {
        setAuthor(authorDoc.data() as Author);
      }
    };

    const checkLiked = async () => {
      if (!user) return;
      const likesQuery = query(
        collection(db, 'posts', post.id, 'likes'),
        where('userId', '==', user.uid)
      );
      const likesSnapshot = await getDocs(likesQuery);
      setLiked(!likesSnapshot.empty);
    };

    fetchAuthor();
    checkLiked();
  }, [post.id, post.authorId, user]);

  const handleLike = async () => {
    if (!user) return;

    try {
      const likesRef = collection(db, 'posts', post.id, 'likes');
      const likesQuery = query(likesRef, where('userId', '==', user.uid));
      const likesSnapshot = await getDocs(likesQuery);

      if (likesSnapshot.empty) {
        // Add like
        await addDoc(likesRef, { userId: user.uid, createdAt: new Date() });
        await updateDoc(doc(db, 'posts', post.id), {
          likesCount: increment(1),
        });
        setLiked(true);

        // Create notification if not liking own post
        if (post.authorId !== user.uid) {
          await addDoc(collection(db, 'notifications'), {
            type: 'like',
            toUserId: post.authorId,
            fromUserId: user.uid,
            postId: post.id,
            read: false,
            createdAt: new Date(),
          });
        }
      } else {
        // Remove like
        const likeDoc = likesSnapshot.docs[0];
        await deleteDoc(doc(db, 'posts', post.id, 'likes', likeDoc.id));
        await updateDoc(doc(db, 'posts', post.id), {
          likesCount: increment(-1),
        });
        setLiked(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDoubleClick = async () => {
    if (!user) return;

    // Show heart animation
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);

    // Add like if not already liked
    if (!liked) {
      await handleLike();
    }
  };
  
  const handleAddStory = async () => {
    if (!user) return;
    
    setIsAddingStory(true);
    try {
      // Add the post as a story to the user's profile
      const storyRef = await addDoc(collection(db, 'stories'), {
        userId: user.uid,
        mediaUrl: post.media[0],
        caption: post.caption || '',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
        originalPostId: post.id,
        authorId: post.authorId // Original post author ID
      });
      
      // If this isn't the user's own post, create a notification for the original post author
      if (post.authorId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'story_share',
          toUserId: post.authorId,
          fromUserId: user.uid,
          postId: post.id,
          storyId: storyRef.id,
          read: false,
          createdAt: new Date()
        });
      }
      
      toast({
        title: "Story added!",
        description: "This post has been added to your stories.",
      });
      
      setShowShareDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add story",
        variant: "destructive",
      });
    } finally {
      setIsAddingStory(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg hover:shadow-xl gpu-accelerated"
      style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)' }}
    >
      {/* Post Header */}
      <div className="flex items-center p-3 sm:p-4 space-x-3 no-tap-highlight">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-instagram flex items-center justify-center shadow-md flex-shrink-0">
          {author?.avatarUrl ? (
            <img 
              src={author.avatarUrl} 
              alt={author.username} 
              className="w-full h-full rounded-full object-cover" 
              loading="lazy"
            />
          ) : (
            <span className="text-white font-bold text-base sm:text-lg">{author?.username?.[0]?.toUpperCase()}</span>
          )}
        </div>
        <span className="font-semibold text-sm sm:text-base truncate">{author?.username || 'Loading...'}</span>
      </div>

      {/* Post Image */}
      <div 
        className="relative aspect-square bg-secondary cursor-pointer no-select touch-manipulate"
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={post.media[0]}
          alt="Post"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        
        {/* Double-click heart animation */}
        {showHeartAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Heart className="w-20 h-20 sm:w-24 sm:h-24 fill-white text-white drop-shadow-lg" />
          </motion.div>
        )}
      </div>

      {/* Post Actions */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            className="hover:bg-transparent hover:scale-110 transition-transform touch-target no-tap-highlight"
          >
            <Heart 
              className={`w-6 h-6 sm:w-7 sm:h-7 transition-all ${
                liked ? 'fill-red-500 text-red-500' : 'hover:text-muted-foreground'
              }`} 
            />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowComments(!showComments)}
            className="hover:bg-transparent hover:scale-110 transition-transform touch-target no-tap-highlight"
          >
            <MessageCircle className={`w-6 h-6 sm:w-7 sm:h-7 hover:text-muted-foreground ${showComments ? 'fill-primary text-primary' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowShareDialog(true)}
            className="hover:bg-transparent hover:scale-110 transition-transform touch-target no-tap-highlight"
          >
            <Share2 className="w-6 h-6 sm:w-7 sm:h-7 hover:text-muted-foreground" />
          </Button>
        </div>

        <div>
          <p className="font-semibold text-sm sm:text-base mb-1">{post.likesCount} likes</p>
          {post.caption && (
            <p className="text-sm sm:text-base leading-relaxed">
              <span className="font-semibold mr-2">{author?.username}</span>
              <span className="break-words">{post.caption}</span>
            </p>
          )}
          {post.commentsCount > 0 && !showComments && (
            <button
              onClick={() => setShowComments(true)}
              className="text-muted-foreground text-xs sm:text-sm mt-2 hover:text-foreground transition-colors no-tap-highlight touch-target"
            >
              View all {post.commentsCount} comments
            </button>
          )}
        </div>
      </div>

      {/* Comment Section */}
      <CommentSection postId={post.id} isOpen={showComments} />
      
      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Post</DialogTitle>
            <DialogDescription>
              Add this post to your stories for 24 hours
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <div className="w-40 h-40 overflow-hidden rounded-lg border">
              <img 
                src={post.media[0]} 
                alt="Post preview" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${author?.username}'s post on TIMEPASS`,
                    text: post.caption || 'Check out this post on TIMEPASS!',
                    url: window.location.origin + '/post/' + post.id
                  }).catch((error) => {
                    toast({
                      title: "Error",
                      description: "Failed to share post",
                      variant: "destructive",
                    });
                    console.error('Error sharing:', error);
                  });
                } else {
                  // Fallback for browsers that don't support Web Share API
                  navigator.clipboard.writeText(window.location.origin + '/post/' + post.id);
                  toast({
                    title: "Link copied!",
                    description: "Post link copied to clipboard",
                  });
                }
              }}
            >
              Share Link
            </Button>
            <Button 
              onClick={handleAddStory} 
              disabled={isAddingStory}
              className="bg-gradient-instagram hover:bg-gradient-instagram/90"
            >
              {isAddingStory ? "Adding..." : "Add to My Story"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
