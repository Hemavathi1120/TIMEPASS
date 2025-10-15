import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query as firestoreQuery, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, User as UserIcon, Video, Play, X, Clock, TrendingUp, Hash, Grid3x3, Heart, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Skeleton } from '@/components/ui/skeleton';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  followersCount?: number;
  verified?: boolean;
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

interface Post {
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
  hashtags?: string[];
}

interface RecentSearch {
  id: string;
  username: string;
  avatarUrl?: string;
  type: 'user' | 'tag';
  timestamp: number;
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

const RECENT_SEARCHES_KEY = 'timepass_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [reelsResults, setReelsResults] = useState<Reel[]>([]);
  const [postsResults, setPostsResults] = useState<Post[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'reels' | 'posts'>('users');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load initial data when dialog opens
  useEffect(() => {
    if (open) {
      loadRecentSearches();
      if (suggestedUsers.length === 0) {
        fetchSuggestedUsers();
      }
      if (trendingHashtags.length === 0) {
        fetchTrendingHashtags();
      }
    }
  }, [open]);

  // Fetch content when tab changes
  useEffect(() => {
    if (open && !searchQuery) {
      if (activeTab === 'reels' && reelsResults.length === 0) {
        fetchReels();
      } else if (activeTab === 'posts' && postsResults.length === 0) {
        fetchPosts();
      }
    }
  }, [open, activeTab]);

  // Load recent searches from localStorage
  const loadRecentSearches = () => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  // Save search to recent searches
  const saveRecentSearch = useCallback((user: User) => {
    try {
      const newSearch: RecentSearch = {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        type: 'user',
        timestamp: Date.now(),
      };

      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      let searches: RecentSearch[] = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists
      searches = searches.filter(s => s.id !== user.id);
      
      // Add to beginning
      searches.unshift(newSearch);
      
      // Keep only last MAX_RECENT_SEARCHES
      searches = searches.slice(0, MAX_RECENT_SEARCHES);
      
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }, []);

  // Clear single recent search
  const clearRecentSearch = (id: string) => {
    try {
      const filtered = recentSearches.filter(s => s.id !== id);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
      setRecentSearches(filtered);
    } catch (error) {
      console.error('Error clearing recent search:', error);
    }
  };

  // Clear all recent searches
  const clearAllRecentSearches = () => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing all recent searches:', error);
    }
  };

  // Fetch suggested/trending users
  const fetchSuggestedUsers = async () => {
    try {
      const usersQuery = firestoreQuery(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data() as { username: string; avatarUrl?: string; bio?: string; followersCount?: number; verified?: boolean };
        return {
          id: doc.id,
          username: data.username,
          avatarUrl: data.avatarUrl,
          bio: data.bio,
          followersCount: data.followersCount || 0,
          verified: data.verified || false,
        };
      });
      
      setSuggestedUsers(users);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    }
  };

  // Fetch trending hashtags
  const fetchTrendingHashtags = async () => {
    try {
      const postsQuery = firestoreQuery(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      const hashtagMap = new Map<string, number>();
      
      postsSnapshot.docs.forEach(doc => {
        const caption = doc.data().caption || '';
        const hashtags = caption.match(/#\w+/g) || [];
        hashtags.forEach(tag => {
          const count = hashtagMap.get(tag) || 0;
          hashtagMap.set(tag, count + 1);
        });
      });
      
      // Sort by frequency and get top 10
      const sorted = Array.from(hashtagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
      
      setTrendingHashtags(sorted);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    }
  };

  // Fetch posts
  const fetchPosts = async (searchTerm?: string) => {
    setSearching(true);
    try {
      const postsQuery = firestoreQuery(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      
      // Fetch user data for each post
      const postsWithUserData = await Promise.all(
        postsSnapshot.docs.map(async (doc) => {
          const postData = doc.data() as {
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
            firestoreQuery(collection(db, 'users'), where('__name__', '==', postData.userId), limit(1))
          );
          
          const userData = userDoc.docs[0]?.data() as { username?: string; avatarUrl?: string } | undefined;
          
          // Extract hashtags
          const caption = postData.caption || '';
          const hashtags = caption.match(/#\w+/g) || [];
          
          return {
            id: doc.id,
            userId: postData.userId,
            username: userData?.username || 'Unknown',
            userAvatar: userData?.avatarUrl,
            mediaUrl: postData.mediaUrl,
            mediaType: postData.mediaType,
            caption: caption,
            createdAt: postData.createdAt,
            likesCount: postData.likesCount || 0,
            commentsCount: postData.commentsCount || 0,
            hashtags: hashtags,
          };
        })
      );
      
      // Filter by search term if provided
      if (searchTerm && searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const filtered = postsWithUserData.filter(post => 
          post.caption.toLowerCase().includes(searchLower) ||
          post.username.toLowerCase().includes(searchLower) ||
          post.hashtags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
        setPostsResults(filtered);
      } else {
        setPostsResults(postsWithUserData);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setPostsResults([]);
    } finally {
      setSearching(false);
    }
  };

  const fetchReels = async (searchTerm?: string) => {
    setSearching(true);
    try {
      let reelsQuery;
      
      // Fetch reels without orderBy to avoid composite index requirement
      reelsQuery = firestoreQuery(
        collection(db, 'posts'),
        where('mediaType', '==', 'video'),
        limit(searchTerm && searchTerm.trim() ? 50 : 30)
      );
      
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
      
      // Sort by createdAt descending (client-side to avoid composite index)
      const sortedReels = reelsWithUserData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      // Filter by search term if provided
      if (searchTerm && searchTerm.trim()) {
        const filtered = sortedReels.filter(reel => 
          reel.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reel.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setReelsResults(filtered);
      } else {
        setReelsResults(sortedReels);
      }
    } catch (error) {
      console.error('Error fetching reels:', error);
      setReelsResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!query.trim()) {
      setSearchResults([]);
      if (activeTab === 'reels' && reelsResults.length === 0) {
        fetchReels();
      } else if (activeTab === 'posts' && postsResults.length === 0) {
        fetchPosts();
      }
      return;
    }

    // Validate input
    const validation = searchSchema.safeParse(query);
    if (!validation.success) {
      setSearchResults([]);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
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
            limit(20)
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          const users = usersSnapshot.docs.map(doc => {
            const data = doc.data() as { username: string; avatarUrl?: string; bio?: string; followersCount?: number; verified?: boolean };
            return {
              id: doc.id,
              username: data.username,
              avatarUrl: data.avatarUrl,
              bio: data.bio,
              followersCount: data.followersCount || 0,
              verified: data.verified || false,
            };
          });
          
          setSearchResults(users);
        } else if (activeTab === 'reels') {
          await fetchReels(query);
        } else {
          await fetchPosts(query);
        }
      } catch (error) {
        console.error('Error searching:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce
  }, [activeTab, reelsResults.length, postsResults.length]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'users' | 'reels' | 'posts');
    setSearchQuery('');
    setSearchResults([]);
    
    // Load content when switching tabs
    if (value === 'reels' && reelsResults.length === 0) {
      fetchReels();
    } else if (value === 'posts' && postsResults.length === 0) {
      fetchPosts();
    }
  };

  const handleUserClick = (user: User) => {
    saveRecentSearch(user);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('users');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl gradient-text">Search</DialogTitle>
          <DialogDescription id="search-dialog-description">
            Discover people, videos, and posts on TIMEPASS
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="reels" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Reels</span>
              </TabsTrigger>
              <TabsTrigger value="posts" className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
            </TabsList>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={
                  activeTab === 'users' 
                    ? 'Search people...' 
                    : activeTab === 'reels'
                    ? 'Search videos...'
                    : 'Search posts & tags...'
                }
                className="pl-10"
                autoFocus
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <TabsContent value="users" className="mt-0 flex-1 overflow-y-auto">
              {/* Recent Searches */}
              {!searchQuery && recentSearches.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Recent
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllRecentSearches}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search) => (
                      <div
                        key={search.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent transition-colors group"
                      >
                        <Link
                          to={`/profile/${search.id}`}
                          onClick={handleClose}
                          className="flex items-center space-x-3 flex-1"
                        >
                          <div className="w-11 h-11 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                            {search.avatarUrl ? (
                              <img
                                src={search.avatarUrl}
                                alt={search.username}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold">
                                {search.username[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{search.username}</p>
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearRecentSearch(search.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Users */}
              {!searchQuery && suggestedUsers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Suggested
                  </h3>
                  <div className="space-y-1">
                    {suggestedUsers.slice(0, 6).map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          to={`/profile/${user.id}`}
                          onClick={() => {
                            saveRecentSearch(user);
                            handleClose();
                          }}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="w-11 h-11 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.username}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold">
                                {user.username[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-medium truncate">{user.username}</p>
                              {user.verified && (
                                <span className="text-blue-500 text-xs">✓</span>
                              )}
                            </div>
                            {user.bio && (
                              <p className="text-xs text-muted-foreground truncate">
                                {user.bio}
                              </p>
                            )}
                            {user.followersCount && user.followersCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {user.followersCount} {user.followersCount === 1 ? 'follower' : 'followers'}
                              </p>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Hashtags */}
              {!searchQuery && trendingHashtags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Trending
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {trendingHashtags.map((tag, index) => (
                      <motion.button
                        key={tag}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          setActiveTab('posts');
                          handleSearch(tag);
                        }}
                        className="px-3 py-1.5 rounded-full bg-accent hover:bg-accent/80 text-sm font-medium transition-colors"
                      >
                        {tag}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Loading */}
              {searching && (
                <div className="flex justify-center py-12">
                  <div className="space-y-3 text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-border border-t-primary animate-spin mx-auto"></div>
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {!searching && searchQuery && searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Link
                        to={`/profile/${user.id}`}
                        onClick={() => handleUserClick(user)}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent transition-colors"
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
                          <div className="flex items-center gap-1">
                            <p className="font-semibold truncate">{user.username}</p>
                            {user.verified && (
                              <span className="text-blue-500">✓</span>
                            )}
                          </div>
                          {user.bio && (
                            <p className="text-sm text-muted-foreground truncate">
                              {user.bio}
                            </p>
                          )}
                          {user.followersCount && user.followersCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {user.followersCount} {user.followersCount === 1 ? 'follower' : 'followers'}
                            </p>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <UserIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-medium mb-1">No results found</p>
                  <p className="text-sm">Try searching for something else</p>
                </div>
              )}
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

            <TabsContent value="posts" className="mt-0 flex-1 overflow-y-auto">
              {/* Search Loading */}
              {searching && (
                <div className="flex justify-center py-12">
                  <div className="space-y-3 text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-border border-t-primary animate-spin mx-auto"></div>
                    <p className="text-sm text-muted-foreground">Searching posts...</p>
                  </div>
                </div>
              )}

              {/* No Results */}
              {!searching && postsResults.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Grid3x3 className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-medium mb-1">
                    {searchQuery ? 'No posts found' : 'No posts available'}
                  </p>
                  <p className="text-sm">
                    {searchQuery ? 'Try a different search term' : 'Posts will appear here'}
                  </p>
                </div>
              )}

              {/* Posts Grid */}
              {!searching && postsResults.length > 0 && (
                <div className="grid grid-cols-3 gap-1">
                  <AnimatePresence>
                    {postsResults.map((post, index) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Link
                          to={`/profile/${post.userId}`}
                          onClick={handleClose}
                          className="group relative block aspect-square rounded-sm overflow-hidden bg-black"
                        >
                          {/* Post Media */}
                          {post.mediaType === 'video' ? (
                            <>
                              <video
                                src={post.mediaUrl}
                                className="w-full h-full object-cover"
                                preload="metadata"
                              />
                              <div className="absolute top-2 right-2">
                                <Video className="w-5 h-5 text-white drop-shadow-lg" />
                              </div>
                            </>
                          ) : (
                            <img
                              src={post.mediaUrl}
                              alt={post.caption}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                          
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex items-center gap-4 text-white">
                              <div className="flex items-center gap-1">
                                <Heart className="w-5 h-5" fill="white" />
                                <span className="font-semibold text-sm">
                                  {post.likesCount || 0}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-5 h-5" fill="white" />
                                <span className="font-semibold text-sm">
                                  {post.commentsCount || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Hashtag indicator */}
                          {post.hashtags && post.hashtags.length > 0 && (
                            <div className="absolute bottom-2 left-2">
                              <div className="bg-black/70 rounded-full px-2 py-0.5 text-xs text-white">
                                {post.hashtags[0]}
                              </div>
                            </div>
                          )}
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
