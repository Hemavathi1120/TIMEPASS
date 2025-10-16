import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Camera, Home, PlusSquare, User, Bell, Search, MessageCircle, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SearchDialog } from '@/components/SearchDialog';

export const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  
  const showBackButton = location.pathname !== '/' && user;

  useEffect(() => {
    if (!user) return;

    // Listen to unread notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('toUserId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      setUnreadNotifications(snapshot.size);
    });

    // Listen to unread messages
    const messagesQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setUnreadMessages(snapshot.size);
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeMessages();
    };
  }, [user]);

  return (
    <>
      {/* Top header with logo and back button */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 glass-effect border-b border-border shadow-sm pt-safe"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              {showBackButton && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(-1)}
                  className="hover:bg-secondary touch-target no-tap-highlight"
                >
                  <span className="sr-only">Go back</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                </Button>
              )}
              <Link to="/" className="flex items-center space-x-2 no-tap-highlight">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-instagram flex items-center justify-center shadow-md">
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <span className="text-lg sm:text-xl font-bold gradient-text hidden sm:inline">TIMEPASS</span>
              </Link>
            </div>
            {user && (
              <Link to="/messages" className="no-tap-highlight">
                <Button variant="ghost" size="icon" className="hover:bg-secondary relative touch-target no-tap-highlight">
                  <MessageCircle className="w-5 h-5 sm:w-5 sm:h-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-primary text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.header>

      {/* Bottom navigation */}
      {user && (
        <motion.nav
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-border shadow-lg pb-safe no-overscroll"
        >
          <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-2">
            <div className="flex items-center justify-around gap-1">
              <Link to="/" className="no-tap-highlight">
                <Button variant="ghost" size="icon" className="hover:bg-secondary touch-target no-tap-highlight w-12 h-12 sm:w-10 sm:h-10">
                  <Home className="w-6 h-6 sm:w-6 sm:h-6" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className="hover:bg-secondary touch-target no-tap-highlight w-12 h-12 sm:w-10 sm:h-10"
              >
                <Search className="w-6 h-6 sm:w-6 sm:h-6" />
              </Button>
              <Link to="/reels" className="no-tap-highlight">
                <Button variant="ghost" size="icon" className="hover:bg-secondary touch-target no-tap-highlight w-12 h-12 sm:w-10 sm:h-10">
                  <Film className="w-6 h-6 sm:w-6 sm:h-6" />
                </Button>
              </Link>
              <Link to="/notifications" className="no-tap-highlight">
                <Button variant="ghost" size="icon" className="hover:bg-secondary relative touch-target no-tap-highlight w-12 h-12 sm:w-10 sm:h-10">
                  <Bell className="w-6 h-6 sm:w-6 sm:h-6" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/profile" className="no-tap-highlight">
                <Button variant="ghost" size="icon" className="hover:bg-secondary touch-target no-tap-highlight w-12 h-12 sm:w-10 sm:h-10">
                  <User className="w-6 h-6 sm:w-6 sm:h-6" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.nav>
      )}
      
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};
