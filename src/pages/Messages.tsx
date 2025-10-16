import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { MessageCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';

interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: any;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  unreadCount: number;
}

interface UserCache {
  [key: string]: {
    username: string;
    avatarUrl: string;
  };
}

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCache, setUserCache] = useState<UserCache>({});

  useEffect(() => {
    if (!user) return;

    // Set a timeout to show loading for minimum time, then show cached data if available
    const minLoadingTime = setTimeout(() => {
      if (conversations.length > 0) {
        setLoading(false);
      }
    }, 300);

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(conversationsQuery, async (snapshot) => {
      console.log(`Loading ${snapshot.docs.length} conversations`);
      
      // Quick initial render with cached user data - sort on client side
      const quickConversations = snapshot.docs
        .map((conversationDoc) => {
        const data = conversationDoc.data();
        const otherUserId = data.participants.find((id: string) => id !== user.uid);
        
        if (!otherUserId) {
          console.warn('Conversation has no other user:', conversationDoc.id);
          return null;
        }
        
        // Use cached user data if available
        const cachedUser = userCache[otherUserId];
        
        return {
          id: conversationDoc.id,
          participants: data.participants,
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTime,
          otherUserId,
          otherUserName: cachedUser?.username || 'Loading...',
          otherUserAvatar: cachedUser?.avatarUrl || '',
          unreadCount: data.unreadCount?.[user.uid] || 0, // Use stored unread count
        };
      })
      .filter((conv): conv is Conversation => conv !== null)
      .sort((a, b) => {
        // Sort by lastMessageTime descending (most recent first)
        const aTime = a.lastMessageTime?.toMillis?.() || 0;
        const bTime = b.lastMessageTime?.toMillis?.() || 0;
        return bTime - aTime;
      });

      // Show quick results immediately
      setConversations(quickConversations);
      setLoading(false);

      // Fetch missing user data in the background
      const missingUserIds = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return data.participants.find((id: string) => id !== user.uid);
        })
        .filter(userId => userId && !userCache[userId]);

      if (missingUserIds.length > 0) {
        console.log(`Fetching ${missingUserIds.length} missing user profiles`);
        
        // Batch fetch user data
        const uniqueUserIds = [...new Set(missingUserIds)];
        const userPromises = uniqueUserIds.map(userId =>
          getDoc(doc(db, 'users', userId)).catch(err => {
            console.error(`Failed to fetch user ${userId}:`, err);
            return null;
          })
        );

        const userDocs = await Promise.all(userPromises);
        const newUserCache = { ...userCache };
        
        userDocs.forEach((userDoc, index) => {
          if (userDoc?.exists()) {
            const userData = userDoc.data();
            newUserCache[uniqueUserIds[index]] = {
              username: userData.username || 'Unknown',
              avatarUrl: userData.avatarUrl || '',
            };
          } else if (userDoc === null) {
            // User fetch failed, use placeholder
            newUserCache[uniqueUserIds[index]] = {
              username: 'Unknown User',
              avatarUrl: '',
            };
          }
        });

        setUserCache(newUserCache);

        // Update conversations with fetched user data
        const updatedConversations = snapshot.docs
          .map((conversationDoc) => {
            const data = conversationDoc.data();
            const otherUserId = data.participants.find((id: string) => id !== user.uid);
            
            if (!otherUserId) return null;
            
            const userData = newUserCache[otherUserId];

            return {
              id: conversationDoc.id,
              participants: data.participants,
              lastMessage: data.lastMessage || '',
              lastMessageTime: data.lastMessageTime,
              otherUserId,
              otherUserName: userData?.username || 'Unknown',
              otherUserAvatar: userData?.avatarUrl || '',
              unreadCount: data.unreadCount?.[user.uid] || 0,
            };
          })
          .filter((conv): conv is Conversation => conv !== null)
          .sort((a, b) => {
            // Sort by lastMessageTime descending
            const aTime = a.lastMessageTime?.toMillis?.() || 0;
            const bTime = b.lastMessageTime?.toMillis?.() || 0;
            return bTime - aTime;
          });

        setConversations(updatedConversations);
        console.log('✅ Conversations loaded successfully');
      }
    }, (error) => {
      console.error('❌ Error loading conversations:', error);
      setLoading(false);
    });

    return () => {
      clearTimeout(minLoadingTime);
      unsubscribe();
    };
  }, [user]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) =>
      conv.otherUserName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [conversations, searchTerm]);

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    
    const now = new Date();
    const messageDate = timestamp.toDate();
    const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  if (loading && conversations.length === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
          <p className="text-muted-foreground">Loading messages...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-20 pb-24">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-3xl font-bold gradient-text mb-6">Messages</h1>

            {/* Search */}
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Conversations List */}
            {filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-20 bg-card border border-border rounded-3xl shadow-lg"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="w-10 h-10 text-primary" />
                </div>
                <p className="text-2xl font-semibold mb-2 text-muted-foreground">
                  {searchTerm ? 'No conversations found' : 'No messages yet'}
                </p>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try a different search term' : 'Start chatting with people you follow'}
                </p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conversation, index) => (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
                  >
                    <Link to={`/chat/${conversation.id}`}>
                      <div className={`bg-card border border-border rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02] ${
                        conversation.unreadCount > 0 ? 'bg-primary/5 border-primary/20' : ''
                      }`}>
                        <div className="flex items-center space-x-4">
                          {/* Avatar */}
                          <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0">
                              {conversation.otherUserAvatar ? (
                                <img
                                  src={conversation.otherUserAvatar}
                                  alt={conversation.otherUserName}
                                  className="w-full h-full rounded-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="text-white font-bold text-xl">
                                  {conversation.otherUserName[0]?.toUpperCase()}
                                </span>
                              )}
                            </div>
                            {conversation.unreadCount > 0 && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-background"></div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className={`font-semibold truncate ${
                                conversation.unreadCount > 0 ? 'text-foreground' : ''
                              }`}>
                                {conversation.otherUserName}
                              </p>
                              <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                {getTimeAgo(conversation.lastMessageTime)}
                              </p>
                            </div>
                            <p className={`text-sm truncate ${
                              conversation.unreadCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                            }`}>
                              {conversation.lastMessage || 'Start chatting...'}
                            </p>
                          </div>

                          {/* Unread Badge */}
                          {conversation.unreadCount > 0 && (
                            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                              <span className="text-white text-xs font-bold">
                                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Messages;
