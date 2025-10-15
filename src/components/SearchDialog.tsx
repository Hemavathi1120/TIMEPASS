import { useState, useEffect } from 'react';
import { collection, query as firestoreQuery, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, User as UserIcon, Video, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { z } from 'zod';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
}

interface Reel {
  id: string;
  userId: string;
  username: string;
  userAvatar?: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  createdAt: any;
  likesCount?: number;
  commentsCount?: number;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Input validation schema
const searchSchema = z.string()
  .trim()
  .max(50, 'Search query too long')
  .regex(/^[a-zA-Z0-9_\s]*$/, 'Only letters, numbers, underscores, and spaces allowed');

export const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [reelsResults, setReelsResults] = useState<Reel[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'reels'>('users');

  // Fetch all reels when the dialog opens and tab switches to reels
  useEffect(() => {
    if (open && activeTab === 'reels' && reelsResults.length === 0) {
      fetchReels();
    }
  }, [open, activeTab]);

  const fetchReels = async (searchTerm?: string) => {
    setSearching(true);
    try {
      let reelsQuery;
      
      if (searchTerm && searchTerm.trim()) {
        // Search reels by caption or username
        const sanitizedQuery = searchTerm.toLowerCase();
        reelsQuery = firestoreQuery(
          collection(db, 'posts'),
          where('mediaType', '==', 'video'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        // Fetch all reels
        reelsQuery = firestoreQuery(
          collection(db, 'posts'),
          where('mediaType', '==', 'video'),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
      }
      
      const reelsSnapshot = await getDocs(reelsQuery);
      
      // Fetch user data for each reel
      const reelsWithUserData = await Promise.all(
        reelsSnapshot.docs.map(async (doc) => {
          const reelData = doc.data() as {
            userId: string;
            mediaUrl: string;
            mediaType: string;
            caption?: string;
            createdAt: any;
            likesCount?: number;
            commentsCount?: number;
          };
          
          // Fetch user info
          const userDoc = await getDocs(
            firestoreQuery(collection(db, 'users'), where('__name__', '==', reelData.userId), limit(1))
          );
          
          const userData = userDoc.docs[0]?.data() as { username?: string; avatarUrl?: string } | undefined;
          
          return {
            id: doc.id,
            userId: reelData.userId,
            username: userData?.username || 'Unknown',
            userAvatar: userData?.avatarUrl,
            mediaUrl: reelData.mediaUrl,
            mediaType: reelData.mediaType,
            caption: reelData.caption || '',
            createdAt: reelData.createdAt,
            likesCount: reelData.likesCount || 0,
            commentsCount: reelData.commentsCount || 0,
          };
        })
      );
      
      // Filter by search term if provided
      if (searchTerm && searchTerm.trim()) {
        const filtered = reelsWithUserData.filter(reel => 
          reel.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reel.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setReelsResults(filtered);
      } else {
        setReelsResults(reelsWithUserData);
      }
    } catch (error) {
      console.error('Error fetching reels:', error);
      setReelsResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      if (activeTab === 'reels') {
        fetchReels(); // Reset to all reels
      }
      return;
    }

    // Validate input
    const validation = searchSchema.safeParse(query);
    if (!validation.success) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    
    try {
      if (activeTab === 'users') {
        const sanitizedQuery = validation.data.toLowerCase();
        
        // Search for usernames that start with the query
        const usersQuery = firestoreQuery(
          collection(db, 'users'),
          where('username', '>=', sanitizedQuery),
          where('username', '<=', sanitizedQuery + '\uf8ff'),
          orderBy('username'),
          limit(10)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => {
          const data = doc.data() as { username: string; avatarUrl?: string; bio?: string };
          return {
            id: doc.id,
            username: data.username,
            avatarUrl: data.avatarUrl,
            bio: data.bio,
          };
        });
        
        setSearchResults(users);
      } else {
        // Search reels
        await fetchReels(query);
      }
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'users' | 'reels');
    setSearchQuery('');
    setSearchResults([]);
    
    // Load reels when switching to reels tab
    if (value === 'reels' && reelsResults.length === 0) {
      fetchReels();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setReelsResults([]);
    setActiveTab('users');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl gradient-text">Search</DialogTitle>
          <DialogDescription id="search-dialog-description">
            Discover users and explore reels on TIMEPASS
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="reels" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Reels
            </TabsTrigger>
          </TabsList>
          
          <div className="space-y-4 mt-4 flex-1 flex flex-col overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={activeTab === 'users' ? 'Search by username...' : 'Search reels by caption or user...'}
                className="pl-10"
                autoFocus
              />
            </div>

            <TabsContent value="users" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {searching && (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 rounded-full border-4 border-border border-t-primary animate-spin"></div>
                  </div>
                )}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No users found</p>
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          to={`/profile/${user.id}`}
                          onClick={handleClose}
                          className="flex items-center space-x-3 p-3 rounded-xl hover:bg-accent transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.username}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold text-lg">
                                {user.username[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{user.username}</p>
                            {user.bio && (
                              <p className="text-sm text-muted-foreground truncate">
                                {user.bio}
                              </p>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}

                {!searching && !searchQuery && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Search for users by username</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reels" className="mt-0 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {searching && (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 rounded-full border-4 border-border border-t-primary animate-spin"></div>
                  </div>
                )}

                {!searching && reelsResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{searchQuery ? 'No reels found' : 'No reels available yet'}</p>
                  </div>
                )}

                {!searching && reelsResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <AnimatePresence>
                      {reelsResults.map((reel, index) => (
                        <motion.div
                          key={reel.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Link
                            to={`/profile/${reel.userId}`}
                            onClick={handleClose}
                            className="group relative block aspect-[9/16] rounded-lg overflow-hidden bg-black"
                          >
                            {/* Video thumbnail */}
                            <video
                              src={reel.mediaUrl}
                              className="w-full h-full object-cover"
                              preload="metadata"
                            />
                            
                            {/* Play icon overlay */}
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <Play className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" fill="white" />
                            </div>
                            
                            {/* User info overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                                  {reel.userAvatar ? (
                                    <img
                                      src={reel.userAvatar}
                                      alt={reel.username}
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-white text-xs font-bold">
                                      {reel.username[0]?.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <span className="text-white text-sm font-semibold truncate">
                                  {reel.username}
                                </span>
                              </div>
                              
                              {reel.caption && (
                                <p className="text-white text-xs line-clamp-2">
                                  {reel.caption}
                                </p>
                              )}
                              
                              {/* Stats */}
                              <div className="flex items-center gap-3 mt-2 text-white text-xs">
                                <span>❤️ {reel.likesCount || 0}</span>
                                <span>💬 {reel.commentsCount || 0}</span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
