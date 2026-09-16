import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/auth/AuthModal';
import { DiscoverView } from './components/discover/DiscoverView';
import { FeedView } from './components/feed/FeedView';
import { ChatView } from './components/chat/ChatView';
import { MailView } from './components/mail/MailView';
import { CreditStoreView } from './components/credits/CreditStoreView';
import { ProfileView } from './components/profile/ProfileView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer';
import { SendGiftModal } from './components/modals/SendGiftModal';
import { ReportModal } from './components/modals/ReportModal';
import { MatchCelebrationModal } from './components/modals/MatchCelebrationModal';
import { wsClient } from './services/websocket';
import { User } from './types';
import { ShieldCheck, Heart, Lock, AlertCircle, Sparkles } from 'lucide-react';
import { isUserAdmin, getAuthorizedAdminEmail } from './utils/adminAuth';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('discover');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  // Modals
  const [giftTargetUser, setGiftTargetUser] = useState<User | null>(null);
  const [reportTargetUser, setReportTargetUser] = useState<User | null>(null);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);

  // Contextual initial targets for Chat & Mail
  const [chatInitialPartner, setChatInitialPartner] = useState<User | null>(null);
  const [mailInitialRecipient, setMailInitialRecipient] = useState<User | null>(null);

  // Listen for WebSocket Match notifications
  useEffect(() => {
    const unsubMatch = wsClient.on('MATCH_CREATED', (data: any) => {
      if (data.matchedUser) {
        setMatchedUser(data.matchedUser);
      }
    });

    return () => unsubMatch();
  }, []);

  const handleStartChatWithUser = (targetUser: User) => {
    setChatInitialPartner(targetUser);
    setCurrentTab('chat');
  };

  const handleSendMailToUser = (targetUser: User) => {
    setMailInitialRecipient(targetUser);
    setCurrentTab('mail');
  };

  const handleSendGiftToUser = (targetUser: User) => {
    setGiftTargetUser(targetUser);
  };

  const handleReportUser = (targetUser: User) => {
    setReportTargetUser(targetUser);
  };

  const handleMatchCreated = (targetUser: User) => {
    setMatchedUser(targetUser);
  };

  const handleNeedCredits = () => {
    setCurrentTab('store');
  };

  // Restrict Admin Portal to designated email only
  useEffect(() => {
    if (currentTab === 'admin' && !isUserAdmin(user)) {
      setCurrentTab('discover');
    }
  }, [user, currentTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse mb-4">
          <Heart className="w-6 h-6 text-white fill-white" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-300">Loading Pairly 18+ Platform...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* TOP NAVIGATION BAR */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenNotifications={() => setShowNotificationsDrawer(true)}
        onOpenCreditStore={() => setCurrentTab('store')}
        unreadNotifications={unreadNotifications}
      />

      {/* GUEST BANNER (If not logged in) */}
      {!user && (
        <div className="bg-gradient-to-r from-rose-900/60 via-purple-900/60 to-amber-900/60 border-b border-rose-500/20 py-3 px-4 text-center">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Welcome to Pairly:</strong> Verified 18+ adult social dating &amp; live connection platform.
                Join now for 20 free complimentary credits!
              </span>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md transition-all shrink-0"
            >
              Sign Up (18+)
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEW CONTENT CONTAINER */}
      <main className="flex-1 pb-16 md:pb-8">
        {currentTab === 'discover' && (
          <DiscoverView
            onStartChatWithUser={handleStartChatWithUser}
            onSendMailToUser={handleSendMailToUser}
            onSendGiftToUser={handleSendGiftToUser}
            onReportUser={handleReportUser}
            onMatchCreated={handleMatchCreated}
            onNeedCredits={handleNeedCredits}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {currentTab === 'feed' && <FeedView onNeedCredits={handleNeedCredits} />}

        {currentTab === 'chat' && (
          <ChatView
            initialPartner={chatInitialPartner}
            onSendGiftToUser={handleSendGiftToUser}
            onReportUser={handleReportUser}
            onNeedCredits={handleNeedCredits}
          />
        )}

        {currentTab === 'mail' && (
          <MailView
            initialRecipient={mailInitialRecipient}
            onNeedCredits={handleNeedCredits}
          />
        )}

        {currentTab === 'store' && <CreditStoreView />}

        {currentTab === 'profile' && <ProfileView />}

        {currentTab === 'admin' && (
          isUserAdmin(user) ? (
            <AdminDashboard />
          ) : (
            <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Admin Access Restricted</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                The Admin Portal is strictly restricted to the authorized administrator account ({getAuthorizedAdminEmail()}).
              </p>
              <button
                onClick={() => setCurrentTab('discover')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all"
              >
                Return to Discover
              </button>
            </div>
          )
        )}
      </main>

      {/* PLATFORM COMPLIANCE & SAFETY FOOTER */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-6 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Pairly</span>
            <span>•</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
              Strictly 18+ Adult Connections
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              24/7 Safety Moderation
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Transparent Credit Ledger
            </span>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <SendGiftModal
        isOpen={!!giftTargetUser}
        onClose={() => setGiftTargetUser(null)}
        receiver={giftTargetUser}
        onNeedCredits={handleNeedCredits}
      />

      <ReportModal
        isOpen={!!reportTargetUser}
        onClose={() => setReportTargetUser(null)}
        targetUser={reportTargetUser}
      />

      <MatchCelebrationModal
        isOpen={!!matchedUser}
        onClose={() => setMatchedUser(null)}
        currentUser={user}
        matchedUser={matchedUser}
        onStartChat={handleStartChatWithUser}
        onSendGift={handleSendGiftToUser}
      />

      <NotificationsDrawer
        isOpen={showNotificationsDrawer}
        onClose={() => setShowNotificationsDrawer(false)}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onUnreadCountChange={(count) => setUnreadNotifications(count)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
