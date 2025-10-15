import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Grid, Edit, Upload, UserPlus, UserMinus, Settings, LogOut, Moon, Sun, MessageCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PostManagement } from '@/components/PostManagement';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserProfile {
  username: string;
  bio: string;
  avatarUrl: string;
  followers: string[];
  following: string[];
}

interface Post {
  id: string;
  media: string[];
}

const Profile = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine which user's profile to show
  const profileUserId = userId || user?.uid;
  const isOwnProfile = !userId || userId === user?.uid;

  const fetchProfile = async () => {
    if (!profileUserId) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', profileUserId));
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        setProfile(profileData);
        
        // Check if current user is following this profile
        if (user && !isOwnProfile) {
          setIsFollowing(profileData.followers?.includes(user.uid) || false);
        }
      }

      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', profileUserId)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [profileUserId]);

  const handleEditClick = () => {
    if (profile) {
      setEditUsername(profile.username);
      setEditBio(profile.bio || '');
      setEditAvatarUrl(profile.avatarUrl || '');
      setPreviewUrl(profile.avatarUrl || null);
      setEditDialogOpen(true);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create a local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setPreviewUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    
    setUploading(true);
    try {
      // For development, use Base64 data URL directly to avoid CORS issues
      // In production, this would be replaced with actual Firebase Storage upload
      
      // Create a base64 data URL from the file
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      
      // Get the data URL
      const dataUrl = await dataUrlPromise;
      
      // For development purposes, store the base64 URL directly
      console.log("Using data URL for image instead of Firebase Storage");
      setEditAvatarUrl(dataUrl);
      
      // In a production environment with proper CORS settings, 
      // you would use the Firebase Storage upload code:
      /*
      // Compress the image before uploading
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true
      };
      
      console.log("Compressing image...");
      let fileToUpload = file;
      
      try {
        const compressedFile = await imageCompression(file, options);
        console.log("Original file size:", file.size / 1024 / 1024, "MB");
        console.log("Compressed file size:", compressedFile.size / 1024 / 1024, "MB");
        fileToUpload = compressedFile;
      } catch (compressError) {
        console.error("Image compression error:", compressError);
        // Continue with original file if compression fails
      }
      
      // Generate a unique filename
      const fileExtension = file.name.split('.').pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `avatars/${fileName}`);

      // Upload the file
      console.log("Uploading to Firebase Storage...");
      const uploadTask = await uploadBytes(storageRef, fileToUpload);
      console.log("Upload complete:", uploadTask);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log("Download URL received:", downloadURL);

      // Update state with the download URL
      setEditAvatarUrl(downloadURL);
      */

      toast({
        title: "Image uploaded!",
        description: "Your profile picture has been uploaded successfully.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your image. Please try again.",
        variant: "destructive",
      });
      // Reset preview if upload failed
      setPreviewUrl(profile?.avatarUrl || null);
    } finally {
      setUploading(false);
      
      // Reset the file input to allow selecting the same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    // Validate username
    const trimmedUsername = editUsername.trim();
    if (!trimmedUsername) {
      toast({
        title: "Invalid username",
        description: "Please enter a valid username",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Check if the avatar URL is a data URL (starts with "data:")
      let avatarUrl = editAvatarUrl;
      const isDataUrl = editAvatarUrl.startsWith('data:');
      
      // In a real production app, we would upload the data URL to Firebase Storage here
      // But for development with CORS issues, we'll use the data URL directly
      if (isDataUrl) {
        console.log("Using data URL for avatar");
        // For larger apps, storing data URLs in Firestore may exceed document size limits
        // Consider adding compression or alternative storage solutions for production
      }
      
      console.log("Updating profile with:", {
        username: trimmedUsername,
        bio: editBio.trim(),
        avatarUrl: isDataUrl ? "data:URL (truncated)" : avatarUrl
      });
      
      // Update the user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        username: trimmedUsername,
        bio: editBio.trim(),
        avatarUrl: avatarUrl,
        updatedAt: new Date()
      });
      
      // Refresh profile data from Firestore to ensure consistency
      const updatedDoc = await getDoc(userRef);
      if (updatedDoc.exists()) {
        const updatedProfile = updatedDoc.data() as UserProfile;
        setProfile(updatedProfile);
        
        toast({
          title: "Profile updated!",
          description: "Your profile has been updated successfully.",
        });
        
        setEditDialogOpen(false);
      } else {
        throw new Error("Failed to retrieve updated profile");
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "Update failed",
        description: error.message || "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!user || !profileUserId || isOwnProfile) return;

    setFollowLoading(true);
    try {
      const currentUserRef = doc(db, 'users', user.uid);
      const profileUserRef = doc(db, 'users', profileUserId);

      if (isFollowing) {
        // Unfollow
        await updateDoc(currentUserRef, {
          following: arrayRemove(profileUserId)
        });
        await updateDoc(profileUserRef, {
          followers: arrayRemove(user.uid)
        });

        setProfile(prev => prev ? {
          ...prev,
          followers: prev.followers?.filter(id => id !== user.uid) || []
        } : null);

        toast({
          title: "Unfollowed",
          description: `You unfollowed ${profile?.username}`,
        });
      } else {
        // Follow
        await updateDoc(currentUserRef, {
          following: arrayUnion(profileUserId)
        });
        await updateDoc(profileUserRef, {
          followers: arrayUnion(user.uid)
        });

        // Create follow notification
        await addDoc(collection(db, 'notifications'), {
          type: 'follow',
          fromUserId: user.uid,
          toUserId: profileUserId,
          read: false,
          createdAt: serverTimestamp()
        });

        setProfile(prev => prev ? {
          ...prev,
          followers: [...(prev.followers || []), user.uid]
        } : null);

        toast({
          title: "Following",
          description: `You are now following ${profile?.username}`,
        });
      }

      setIsFollowing(!isFollowing);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartConversation = async () => {
    if (!user || !profileUserId || isOwnProfile) return;

    try {
      // Check if conversation already exists
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      
      let conversationId = null;
      
      // Find existing conversation with this user
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.participants.includes(profileUserId)) {
          conversationId = doc.id;
          break;
        }
      }
      
      // Create new conversation if it doesn't exist
      if (!conversationId) {
        const newConversation = await addDoc(collection(db, 'conversations'), {
          participants: [user.uid, profileUserId],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        conversationId = newConversation.id;
      }
      
      // Navigate to chat
      navigate(`/chat/${conversationId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <Link to="/">
            <Button variant="ghost" className="hover:bg-secondary">
              <span className="sr-only">Back to Home</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back to Home
            </Button>
          </Link>
          
          {isOwnProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hover:bg-secondary">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4 mr-2" />
                      <span>Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 mr-2" />
                      <span>Dark Mode</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          {/* Profile Header */}
          <div className="flex items-start space-x-8 mb-8 bg-card border border-border rounded-3xl p-8 shadow-lg">
            <div className="w-32 h-32 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0 shadow-xl relative">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    console.log("Profile image failed to load:", profile.avatarUrl);
                    // Add error class to hide the image
                    e.currentTarget.classList.add('error');
                    // Show the fallback
                    const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                    if (fallback) {
                      (fallback as HTMLElement).style.opacity = '1';
                    }
                  }}
                />
              ) : null}
              <div 
                className="avatar-fallback text-5xl"
                style={{
                  opacity: profile?.avatarUrl ? 0 : 1
                }}
              >
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl font-bold gradient-text">{profile?.username}</h1>
                {isOwnProfile ? (
                  <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleEditClick}
                        className="hover:bg-secondary"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold gradient-text">Edit Profile</DialogTitle>
                      <DialogDescription id="dialog-description">
                        Update your profile information and upload a new profile picture
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Profile Picture Preview & Upload */}
                      <div className="space-y-2">
                        <Label>Profile Picture</Label>
                        <div className="flex items-center space-x-4">
                          <div className="w-20 h-20 rounded-full bg-gradient-instagram flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full rounded-full object-cover"
                                onError={(e) => {
                                  console.log("Image preview failed to load:", previewUrl);
                                  // Add error class to hide the image
                                  e.currentTarget.classList.add('error');
                                  // Show the fallback
                                  const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                                  if (fallback) {
                                    (fallback as HTMLElement).style.opacity = '1';
                                  }
                                }}
                              />
                            ) : null}
                            <div 
                              className="avatar-fallback text-2xl"
                              style={{
                                opacity: previewUrl ? 0 : 1
                              }}
                            >
                              {editUsername?.[0]?.toUpperCase() || '?'}
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="w-full"
                            >
                              {uploading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary mr-2"></div>
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Image
                                </>
                              )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Max 5MB • JPG, PNG, GIF
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          placeholder="Enter username"
                          className="bg-secondary border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Tell us about yourself"
                          className="bg-secondary border-border resize-none min-h-24"
                        />
                      </div>
                      <Button 
                        onClick={handleSaveProfile} 
                        disabled={saving || !editUsername.trim()}
                        className="w-full bg-gradient-instagram hover:opacity-90 text-white"
                      >
                        {saving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                ) : (
                  <div className="flex space-x-2">
                    <Button 
                      variant={isFollowing ? "outline" : "default"}
                      size="sm" 
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={isFollowing ? "hover:bg-secondary flex-1" : "bg-gradient-instagram hover:opacity-90 text-white flex-1"}
                    >
                      {followLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
                      ) : isFollowing ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-2" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Follow
                        </>
                      )}
                    </Button>
                    {isFollowing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartConversation}
                        className="hover:bg-secondary"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex space-x-12 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{posts.length}</p>
                  <p className="text-muted-foreground text-sm">posts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{profile?.followers?.length || 0}</p>
                  <p className="text-muted-foreground text-sm">followers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{profile?.following?.length || 0}</p>
                  <p className="text-muted-foreground text-sm">following</p>
                </div>
              </div>
              {profile?.bio && <p className="text-foreground/90 text-lg">{profile.bio}</p>}
            </div>
          </div>

          {/* Posts Grid */}
          <div className="pt-8">
            <div className="flex items-center justify-center mb-8 space-x-2">
              <Grid className="w-6 h-6 text-primary" />
              <span className="font-bold text-xl">POSTS</span>
            </div>

            {posts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 bg-card border border-border rounded-3xl shadow-lg"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-instagram/10 flex items-center justify-center mx-auto mb-6">
                  <Grid className="w-10 h-10 text-primary" />
                </div>
                <p className="text-2xl font-semibold mb-2 text-muted-foreground">No posts yet</p>
                <p className="text-muted-foreground">Share your first moment!</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {posts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                    className="aspect-square bg-secondary rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-shadow relative group"
                  >
                    <img
                      src={post.media[0]}
                      alt="Post"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <PostManagement
                      post={post}
                      onPostUpdated={fetchProfile}
                      onPostDeleted={fetchProfile}
                      isOwnPost={isOwnProfile}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
