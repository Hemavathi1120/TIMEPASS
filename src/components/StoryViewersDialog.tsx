import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Heart } from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

interface Viewer {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  viewedAt: Date;
}

interface Liker {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  likedAt: Date;
}

interface StoryViewersDialogProps {
  storyId: string;
  onClose: () => void;
}

export const StoryViewersDialog = ({ storyId, onClose }: StoryViewersDialogProps) => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('views');
  const navigate = useNavigate();

  useEffect(() => {
    fetchViewersAndLikers();
  }, [storyId]);

  const fetchViewersAndLikers = async () => {
    setLoading(true);
    try {
      console.log('👀 Fetching viewers and likers for story:', storyId);
      
      // Fetch viewers
      const viewsSnapshot = await getDocs(collection(db, 'stories', storyId, 'views'));
      const viewersData: Viewer[] = [];
      
      for (const viewDoc of viewsSnapshot.docs) {
        const viewData = viewDoc.data();
        const userDoc = await getDoc(doc(db, 'users', viewData.userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          viewersData.push({
            id: viewDoc.id,
            userId: viewData.userId,
            username: userData.username || 'User',
            avatarUrl: userData.avatarUrl || '',
            viewedAt: viewData.createdAt?.toDate() || new Date()
          });
        }
      }
      
      // Sort by most recent first
      viewersData.sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime());
      
      console.log('✅ Fetched viewers:', viewersData.length);
      setViewers(viewersData);
      
      // Fetch likers
      const likesSnapshot = await getDocs(collection(db, 'stories', storyId, 'likes'));
      const likersData: Liker[] = [];
      
      for (const likeDoc of likesSnapshot.docs) {
        const likeData = likeDoc.data();
        const userDoc = await getDoc(doc(db, 'users', likeData.userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          likersData.push({
            id: likeDoc.id,
            userId: likeData.userId,
            username: userData.username || 'User',
            avatarUrl: userData.avatarUrl || '',
            likedAt: likeData.createdAt?.toDate() || new Date()
          });
        }
      }
      
      // Sort by most recent first
      likersData.sort((a, b) => b.likedAt.getTime() - a.likedAt.getTime());
      
      console.log('✅ Fetched likers:', likersData.length);
      setLikers(likersData);
      
    } catch (error) {
      console.error('❌ Error fetching viewers/likers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    onClose();
    navigate(`/profile/${userId}`);
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Dialog */}
        <motion.div
          className="relative bg-background rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md max-h-[80vh] md:max-h-[600px] overflow-hidden"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
              Story Activity
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="sticky top-[72px] z-10 bg-background/95 backdrop-blur-sm border-b border-border px-6">
              <TabsList className="w-full grid grid-cols-2 h-12">
                <TabsTrigger value="views" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Views</span>
                  <span className="ml-1 text-xs bg-primary/20 px-2 py-0.5 rounded-full">
                    {viewers.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="likes" className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <span>Likes</span>
                  <span className="ml-1 text-xs bg-red-500/20 px-2 py-0.5 rounded-full">
                    {likers.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-144px)] md:max-h-[452px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-primary animate-spin" />
                </div>
              ) : (
                <>
                  {/* Views Tab */}
                  <TabsContent value="views" className="mt-0 px-4 py-2">
                    {viewers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Eye className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">No views yet</p>
                        <p className="text-xs mt-1">Share your story to get views!</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {viewers.map((viewer) => (
                          <motion.div
                            key={viewer.id}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => handleUserClick(viewer.userId)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Avatar className="h-12 w-12 ring-2 ring-purple-500/30">
                              <AvatarImage src={viewer.avatarUrl} alt={viewer.username} />
                              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
                                {viewer.username[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{viewer.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(viewer.viewedAt)}
                              </p>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Likes Tab */}
                  <TabsContent value="likes" className="mt-0 px-4 py-2">
                    {likers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Heart className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">No likes yet</p>
                        <p className="text-xs mt-1">Be patient, likes will come!</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {likers.map((liker) => (
                          <motion.div
                            key={liker.id}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => handleUserClick(liker.userId)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Avatar className="h-12 w-12 ring-2 ring-red-500/30">
                              <AvatarImage src={liker.avatarUrl} alt={liker.username} />
                              <AvatarFallback className="bg-gradient-to-br from-red-500 to-pink-500 text-white font-semibold">
                                {liker.username[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{liker.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(liker.likedAt)}
                              </p>
                            </div>
                            <Heart className="h-4 w-4 text-red-500 fill-red-500 flex-shrink-0" />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
