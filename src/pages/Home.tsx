import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';

interface Post {
  id: string;
  authorId: string;
  media: string[];
  caption: string;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
}

const Home = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((post: any) => {
          // Only show images and other media types in Home feed
          // Videos should appear in Reels section
          return post.mediaType !== 'video';
        }) as Post[];
      setPosts(postsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-muted-foreground">Loading feed...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16 pb-20 sm:pb-24 momentum-scroll">
      {/* Stories Bar - positioned at the top, directly under the navbar */}
      <div className="sticky top-[56px] sm:top-[64px] bg-background/95 backdrop-blur-md z-10 border-b border-border/50 shadow-sm">
        <StoriesBar />
      </div>
      <div className="max-w-2xl mx-auto px-3 sm:px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {posts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 sm:py-20 bg-card border border-border rounded-2xl sm:rounded-3xl shadow-lg mx-2 sm:mx-0 mt-4"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              </div>
              <p className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 px-4">No posts yet</p>
              <p className="text-muted-foreground text-base sm:text-lg px-4">Be the first to share a moment!</p>
            </motion.div>
          ) : (
            <div className="space-y-4 sm:space-y-6 pt-4">
              {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <PostCard post={post} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
