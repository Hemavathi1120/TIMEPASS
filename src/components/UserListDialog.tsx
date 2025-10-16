import { useEffect, useState } from 'react';
import { collection, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';

interface UserData {
  uid: string;
  username: string;
  avatarUrl?: string;
  followers: string[];
}

interface UserListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIds: string[];
  title: string;
  currentUserId?: string;
}

export default function UserListDialog({ 
  open, 
  onOpenChange, 
  userIds, 
  title,
  currentUserId 
}: UserListDialogProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (open && userIds.length > 0) {
      fetchUsers();
    } else if (open && userIds.length === 0) {
      setUsers([]);
      setLoading(false);
    }
  }, [open, userIds]);

  useEffect(() => {
    if (currentUser) {
      fetchFollowingStatus();
    }
  }, [currentUser]);

  const fetchFollowingStatus = async () => {
    if (!currentUser) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const following = userDoc.data().following || [];
        setFollowingUsers(new Set(following));
      }
    } catch (error) {
      console.error('Error fetching following status:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const userPromises = userIds.map(async (userId) => {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          return {
            uid: userId,
            username: userDoc.data().username,
            avatarUrl: userDoc.data().avatarUrl,
            followers: userDoc.data().followers || []
          } as UserData;
        }
        return null;
      });

      const fetchedUsers = await Promise.all(userPromises);
      setUsers(fetchedUsers.filter((user): user is UserData => user !== null));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUserId: string) => {
    if (!currentUser) return;

    try {
      const isFollowing = followingUsers.has(targetUserId);
      const currentUserRef = doc(db, 'users', currentUser.uid);
      const targetUserRef = doc(db, 'users', targetUserId);

      if (isFollowing) {
        // Unfollow
        await updateDoc(currentUserRef, {
          following: arrayRemove(targetUserId)
        });
        await updateDoc(targetUserRef, {
          followers: arrayRemove(currentUser.uid)
        });
        
        setFollowingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });

        // Update local user data
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.uid === targetUserId
              ? { ...user, followers: user.followers.filter(id => id !== currentUser.uid) }
              : user
          )
        );
      } else {
        // Follow
        await updateDoc(currentUserRef, {
          following: arrayUnion(targetUserId)
        });
        await updateDoc(targetUserRef, {
          followers: arrayUnion(currentUser.uid)
        });
        
        setFollowingUsers(prev => new Set(prev).add(targetUserId));

        // Update local user data
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.uid === targetUserId
              ? { ...user, followers: [...user.followers, currentUser.uid] }
              : user
          )
        );
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold gradient-text">{title}</DialogTitle>
          <DialogDescription>
            View and manage your connections
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No users to show
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.uid}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div 
                  className="flex items-center space-x-3 flex-1 cursor-pointer"
                  onClick={() => handleUserClick(user.uid)}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                          if (fallback) {
                            (fallback as HTMLElement).style.opacity = '1';
                          }
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div 
                      className="avatar-fallback text-lg font-bold"
                      style={{
                        opacity: user.avatarUrl ? 0 : 1
                      }}
                    >
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.followers.length} followers
                    </p>
                  </div>
                </div>
                
                {currentUser && user.uid !== currentUser.uid && user.uid !== currentUserId && (
                  <Button
                    variant={followingUsers.has(user.uid) ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleFollowToggle(user.uid)}
                    className="ml-2"
                  >
                    {followingUsers.has(user.uid) ? 'Unfollow' : 'Follow'}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
