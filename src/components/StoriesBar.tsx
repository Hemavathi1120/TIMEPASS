import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { StoryViewer } from '@/components/StoryViewer';
import { CreateStoryDialog } from '@/components/CreateStoryDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface User {
  id: string;
  username: string;
  avatarUrl: string;
  hasUnseenStories: boolean;
}

interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  caption: string;
  createdAt: any;
  expiresAt: any;
  originalPostId: string;
}

export const StoriesBar = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const { user: currentUser } = useAuth();

  const fetchStoriesUsers = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // First, get the current user and users they follow who have active stories
      const now = new Date();
      
      // Get current user's following list
      const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : null;
      const followingIds = currentUserData?.following || [];
      
      // Add current user to the list to show their own stories too
      const userIds = [currentUser.uid, ...followingIds];
      
      console.log('Looking for stories from users:', userIds);
      
      // Create a placeholder for the current user regardless if they have stories
      const usersData: User[] = [{
        id: currentUser.uid,
        username: currentUserData?.username || 'You',
        avatarUrl: currentUserData?.avatarUrl || '',
        hasUnseenStories: false // Will be updated if they have stories
      }];
      
      // Process users in chunks to avoid "in" query limitations (max 10)
      const userIdChunks = [];
      for (let i = 0; i < userIds.length; i += 10) {
        userIdChunks.push(userIds.slice(i, i + 10));
      }
      
      // Get all stories from all user chunks
      let allStoryDocs = [];
      
      for (const chunk of userIdChunks) {
        // Process each chunk individually with simpler queries
        for (const userId of chunk) {
          const userStoriesQuery = query(
            collection(db, 'stories'),
            where('userId', '==', userId)
          );
          
          const userStoriesSnapshot = await getDocs(userStoriesQuery);
          
          // Filter out expired stories client-side
          const validDocs = userStoriesSnapshot.docs.filter(doc => {
            const expiresAt = doc.data().expiresAt?.toDate();
            return expiresAt && expiresAt > now;
          });
          
          allStoryDocs = [...allStoryDocs, ...validDocs];
        }
      }
      
      // Then sort the results in memory
      const sortedDocs = allStoryDocs.sort((a, b) => {
        // Sort by expiresAt in descending order (newest first)
        const aExpiresAt = a.data().expiresAt?.toMillis() || 0;
        const bExpiresAt = b.data().expiresAt?.toMillis() || 0;
        return bExpiresAt - aExpiresAt;
      });
      
      console.log('Found stories count:', sortedDocs.length);
      
      // Create a Set of unique user IDs who have stories
      const userIdsWithStories = new Set<string>();
      
      // Track which users have stories
      sortedDocs.forEach(doc => {
        const data = doc.data();
        userIdsWithStories.add(data.userId);
        
        // Update current user story flag if they have stories
        if (data.userId === currentUser.uid) {
          usersData[0].hasUnseenStories = true;
        }
      });
      
      // Remove current user from the set to avoid duplication
      userIdsWithStories.delete(currentUser.uid);
      
      // Fetch user data for those with stories (except current user who's already added)
      for (const userId of userIdsWithStories) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          usersData.push({
            id: userId,
            username: userData.username || 'User',
            avatarUrl: userData.avatarUrl || '',
            hasUnseenStories: true
          });
        }
      }
      
      // Sort to show current user first
      usersData.sort((a, b) => {
        if (a.id === currentUser.uid) return -1;
        if (b.id === currentUser.uid) return 1;
        return 0;
      });
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoriesUsers();
  }, [currentUser]);

  const handleUserStoryClick = async (userId: string) => {
    try {
      // Fetch all stories for this user without using complex queries that require indexes
      const now = new Date();
      
      // Simple query with just userId and filter for expired stories in memory
      const storiesQuery = query(
        collection(db, 'stories'),
        where('userId', '==', userId)
      );
      
      const storiesSnapshot = await getDocs(storiesQuery);
      
      // Filter and sort in memory
      const userStories = storiesSnapshot.docs
        .filter(doc => {
          // Filter out expired stories
          const data = doc.data();
          const expiresAt = data.expiresAt?.toDate();
          return expiresAt && expiresAt > now;
        })
        .sort((a, b) => {
          // Sort by createdAt in ascending order (oldest first)
          const aCreatedAt = a.data().createdAt?.toMillis() || 0;
          const bCreatedAt = b.data().createdAt?.toMillis() || 0;
          return aCreatedAt - bCreatedAt;
        })
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            mediaUrl: data.mediaUrl,
            caption: data.caption,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            originalPostId: data.originalPostId || ''
          } as Story;
        });
      
      if (userStories.length > 0) {
        console.log(`Found ${userStories.length} stories for user ${userId}`);
        setStories(userStories);
        setSelectedUserId(userId);
        setShowStoryViewer(true);
      } else {
        console.log(`No active stories found for user ${userId}`);
      }
    } catch (error) {
      console.error('Error fetching user stories:', error);
    }
  };

  const handleRefreshStories = () => {
    // Re-fetch stories when a new one is created
    if (currentUser) {
      fetchStoriesUsers();
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-primary animate-spin"></div>
      </div>
    );
  }
  
  // If no users with stories and not the current user, don't show anything
  if (users.length === 0 && !currentUser) {
    return null;
  }

  return (
    <>
      <motion.div 
        className="flex overflow-x-auto px-4 gap-3 hide-scrollbar max-w-xl mx-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Create Story Button */}
        {currentUser && (
          <div className="flex flex-col items-center cursor-pointer flex-shrink-0">
            <Button 
              onClick={() => setShowCreateStory(true)} 
              variant="outline"
              size="icon"
              className="w-[62px] h-[62px] rounded-full border-2 border-dashed hover:border-primary"
            >
              <Plus className="h-6 w-6" />
            </Button>
            <span className="text-xs mt-1 text-center text-foreground/80">
              Add Story
            </span>
          </div>
        )}
        
        {/* User Stories */}
        {users.map(user => (
          <motion.div 
            key={user.id} 
            className="flex flex-col items-center cursor-pointer flex-shrink-0"
            onClick={() => handleUserStoryClick(user.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`w-[62px] h-[62px] rounded-full p-[2px] ${user.hasUnseenStories ? 'bg-gradient-instagram' : 'bg-gray-300'} ${user.hasUnseenStories ? 'story-pulse' : ''}`}>
              <div className="bg-background w-full h-full rounded-full flex items-center justify-center overflow-hidden border-[2px] border-background">
                {user.avatarUrl ? (
                  <img 
                    src={user.avatarUrl} 
                    alt={user.username} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold">
                    {user.username[0]?.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs mt-1 truncate w-16 text-center text-foreground/80">
              {user.id === currentUser?.uid ? 'Your Story' : user.username}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Story Viewer Dialog */}
      {showStoryViewer && (
        <StoryViewer 
          stories={stories}
          userId={selectedUserId!}
          onClose={() => setShowStoryViewer(false)}
        />
      )}
      
      {/* Create Story Dialog */}
      <CreateStoryDialog 
        isOpen={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onStoryCreated={handleRefreshStories}
      />
    </>
  );
};
