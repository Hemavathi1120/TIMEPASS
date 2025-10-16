import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
  read: boolean;
}

interface OtherUser {
  id: string;
  username: string;
  avatarUrl: string;
}

const Chat = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualConversationId, setActualConversationId] = useState<string | null>(conversationId || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const loadConversation = async () => {
      try {
        let convId = conversationId;
        let otherUserId: string | null = null;

        console.log('Loading conversation:', { conversationId, hasUserId: !!location.state?.userId });

        // Check if starting a new conversation from location state
        const stateUserId = location.state?.userId;
        
        if (!convId && stateUserId) {
          console.log('Creating or finding conversation for user:', stateUserId);
          // Try to find existing conversation
          const existingConvQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', user.uid)
          );
          
          const existingConvSnapshot = await getDocs(existingConvQuery);
          const existing = existingConvSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.participants.includes(stateUserId);
          });

          if (existing) {
            // Use existing conversation
            convId = existing.id;
            setActualConversationId(convId);
            navigate(`/chat/${convId}`, { replace: true });
          } else {
            // Create new conversation
            const newConvRef = await addDoc(collection(db, 'conversations'), {
              participants: [user.uid, stateUserId],
              lastMessage: '',
              lastMessageTime: serverTimestamp(),
              unreadCount: {
                [user.uid]: 0,
                [stateUserId]: 0,
              },
              createdAt: serverTimestamp(),
            });
            
            convId = newConvRef.id;
            setActualConversationId(convId);
            navigate(`/chat/${convId}`, { replace: true });
          }
          
          otherUserId = stateUserId;
        } else if (convId) {
          // Load existing conversation with retry logic for newly created conversations
          console.log('Loading conversation:', convId);
          let conversationDoc = await getDoc(doc(db, 'conversations', convId));
          
          // Retry if conversation not found (might be newly created and not yet synced)
          if (!conversationDoc.exists()) {
            console.log('⚠️ Conversation not found, retrying in 1s...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            conversationDoc = await getDoc(doc(db, 'conversations', convId));
          }
          
          if (!conversationDoc.exists()) {
            console.error('❌ Conversation not found after retry:', convId);
            setError('Conversation not found');
            setLoading(false);
            toast({
              title: "Error",
              description: "This conversation doesn't exist or has been deleted.",
              variant: "destructive",
            });
            return;
          }

          console.log('✅ Conversation loaded successfully');
          const conversationData = conversationDoc.data();
          
          // Verify user is part of this conversation
          if (!conversationData.participants.includes(user.uid)) {
            setError('You are not part of this conversation');
            setLoading(false);
            toast({
              title: "Access Denied",
              description: "You don't have permission to view this conversation.",
              variant: "destructive",
            });
            return;
          }
          
          otherUserId = conversationData.participants.find((id: string) => id !== user.uid);
          setActualConversationId(convId);
        } else {
          setError('No conversation specified');
          setLoading(false);
          return;
        }

        // Get other user's info
        if (otherUserId) {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setOtherUser({
              id: otherUserId,
              username: userData.username || 'Unknown',
              avatarUrl: userData.avatarUrl || '',
            });
          } else {
            console.warn('Other user not found:', otherUserId);
            setOtherUser({
              id: otherUserId,
              username: 'Unknown User',
              avatarUrl: '',
            });
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading conversation:', error);
        setError('Failed to load conversation');
        setLoading(false);
        toast({
          title: "Error",
          description: "Failed to load conversation. Please try again.",
          variant: "destructive",
        });
      }
    };

    loadConversation();

    return () => {};
  }, [conversationId, user, navigate, location, toast]);

  // Separate effect for listening to messages
  useEffect(() => {
    if (!user || !actualConversationId) {
      console.log('Skipping message listener - missing user or conversationId');
      return;
    }

    console.log('Setting up message listener for conversation:', actualConversationId);

    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', actualConversationId)
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      console.log(`Received ${snapshot.docs.length} messages from Firestore`);
      
      const messagesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      // Sort messages by createdAt on client side to avoid composite index
      const sortedMessages = messagesData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return aTime - bTime;
      });

      setMessages(sortedMessages);

      // Mark messages as read and reset unread count
      const unreadMessages = messagesData.filter(
        (msg) => msg.receiverId === user.uid && !msg.read
      );

      if (unreadMessages.length > 0) {
        console.log(`Marking ${unreadMessages.length} messages as read`);
        try {
          // Mark individual messages as read
          for (const msg of unreadMessages) {
            await updateDoc(doc(db, 'messages', msg.id), {
              read: true,
            });
          }

          // Reset unread count in conversation document
          const conversationRef = doc(db, 'conversations', actualConversationId);
          const conversationSnap = await getDoc(conversationRef);
          
          if (conversationSnap.exists()) {
            await updateDoc(conversationRef, {
              [`unreadCount.${user.uid}`]: 0,
            });
            console.log('✅ Messages marked as read and unread count reset');
          } else {
            console.warn('⚠️ Conversation document not found when trying to reset unread count');
          }
        } catch (error) {
          console.error('❌ Error marking messages as read:', error);
        }
      }
    }, (error) => {
      console.error('❌ Error listening to messages:', error);
      setError('Failed to load messages');
      toast({
        title: "Connection Error",
        description: "Failed to sync messages. Please refresh the page.",
        variant: "destructive",
      });
    });

    return () => {
      console.log('Cleaning up message listener');
      unsubscribe();
    };
  }, [actualConversationId, user, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !otherUser || !actualConversationId) {
      console.warn('Cannot send message - missing required data:', {
        hasMessage: !!newMessage.trim(),
        hasUser: !!user,
        hasOtherUser: !!otherUser,
        hasConversationId: !!actualConversationId
      });
      return;
    }

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      console.log('Sending message:', {
        conversationId: actualConversationId,
        from: user.uid,
        to: otherUser.id,
        textLength: messageText.length
      });

      // Add message
      await addDoc(collection(db, 'messages'), {
        conversationId: actualConversationId,
        senderId: user.uid,
        receiverId: otherUser.id,
        text: messageText,
        read: false,
        createdAt: serverTimestamp(),
      });

      console.log('✅ Message added to Firestore');

      // Update conversation with last message and increment receiver's unread count
      const conversationRef = doc(db, 'conversations', actualConversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const currentUnreadCount = conversationSnap.data()?.unreadCount?.[otherUser.id] || 0;

        await updateDoc(conversationRef, {
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          [`unreadCount.${otherUser.id}`]: currentUnreadCount + 1,
        });
        
        console.log('✅ Conversation updated');
      } else {
        // Create conversation if it doesn't exist (failsafe)
        console.log('Creating missing conversation document');
        await setDoc(conversationRef, {
          participants: [user.uid, otherUser.id],
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          unreadCount: {
            [user.uid]: 0,
            [otherUser.id]: 1,
          },
          createdAt: serverTimestamp(),
        });
        
        console.log('✅ Conversation created');
      }
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      setNewMessage(messageText); // Restore message on error
      toast({
        title: "Failed to send message",
        description: error.message || "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin"></div>
        <p className="text-muted-foreground">Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={() => navigate('/messages')}
          className="mt-4"
        >
          Go Back to Messages
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 glass-effect border-b border-border shadow-sm"
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/messages')}
              className="hover:bg-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {otherUser && (
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-instagram flex items-center justify-center">
                  {otherUser.avatarUrl ? (
                    <img
                      src={otherUser.avatarUrl}
                      alt={otherUser.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold">
                      {otherUser.username[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="font-semibold">{otherUser.username}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message, index) => {
            const isOwnMessage = message.senderId === user?.uid;
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-gradient-instagram text-white'
                      : 'bg-card border border-border'
                  }`}
                >
                  <p className="text-sm break-words">{message.text}</p>
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-border pb-safe">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim()}
              className="bg-gradient-instagram hover:opacity-90 text-white"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
