import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Heart,
  MessageCircle,
  Mail,
  Coins,
  ShieldAlert,
  Bell,
  User as UserIcon,
  LogOut,
  Sparkles,
  ChevronDown,
  Layers,
  Flame,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { isUserAdmin } from '../utils/adminAuth';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenNotifications: () => void;
  onOpenCreditStore: () => void;
  unreadNotifications: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAuth,
  onOpenNotifications,
  onOpenCreditStore,
  unreadNotifications,
}) => {
  const { user, wallet, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWalletTooltip, setShowWalletTooltip] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadMail, setUnreadMail] = useState(0);

  // Fetch unread counters on mount & socket updates
  const fetchCounters = async () => {
    if (!user) return;
    try {
      const convs = await api.getConversations();
      const totalMsgUnread = convs.conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      setUnreadMessages(totalMsgUnread);

      const mail = await api.getMailThreads('INBOX');
      const totalMailUnread = mail.threads.reduce((acc, t) => acc + (t.unread_count || 0), 0);
      setUnreadMail(totalMailUnread);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCounters();
    const unsubMsg = wsClient.on('NEW_MESSAGE', () => fetchCounters());
    const interval = setInterval(fetchCounters, 15000);
    return () => {
      unsubMsg();
      clearInterval(interval);
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* BRAND LOGO */}
        <div
          id="navbar-brand"
          onClick={() => setCurrentTab('discover')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-rose-100 to-rose-400 bg-clip-text text-transparent">
                Pairly
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                18+
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Connect &amp; Interact</p>
          </div>
        </div>

        {/* PRIMARY NAVIGATION TABS */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
            <button
              id="nav-tab-discover"
              onClick={() => setCurrentTab('discover')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'discover'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Discover</span>
            </button>

            <button
              id="nav-tab-feed"
              onClick={() => setCurrentTab('feed')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'feed'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Feed</span>
            </button>

            <button
              id="nav-tab-chat"
              onClick={() => setCurrentTab('chat')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'chat'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat</span>
              {unreadMessages > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

            <button
              id="nav-tab-mail"
              onClick={() => setCurrentTab('mail')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'mail'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Mail</span>
              {unreadMail > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center">
                  {unreadMail > 9 ? '9+' : unreadMail}
                </span>
              )}
            </button>

            <button
              id="nav-tab-store"
              onClick={() => setCurrentTab('store')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'store'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-600/20'
                  : 'text-amber-400/90 hover:text-amber-300 hover:bg-slate-700/50'
              }`}
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Credits</span>
            </button>

            {isUserAdmin(user) && (
              <button
                id="nav-tab-admin"
                onClick={() => setCurrentTab('admin')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentTab === 'admin'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-purple-400 hover:text-purple-300 hover:bg-slate-700/50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
          </nav>
        )}

        {/* RIGHT CONTROLS */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* LIVE WALLET BADGE WITH COMPLIMENTARY & PURCHASED BREAKDOWN */}
              <div className="relative">
                <button
                  id="btn-wallet-badge"
                  onClick={onOpenCreditStore}
                  onMouseEnter={() => setShowWalletTooltip(true)}
                  onMouseLeave={() => setShowWalletTooltip(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all text-amber-300 group"
                >
                  <Coins className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span className="text-sm font-bold tracking-tight">
                    {wallet ? wallet.balance : 0}
                  </span>
                  <span className="text-xs text-amber-400/80 font-normal hidden sm:inline">credits</span>
                  <PlusCircle className="w-3.5 h-3.5 text-amber-400/70 hover:text-amber-300 ml-0.5" />
                </button>

                {/* Popover Breakdown */}
                {showWalletTooltip && wallet && (
                  <div className="absolute right-0 top-12 w-64 p-3.5 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-50 text-xs text-slate-300 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700 font-semibold text-white">
                      <span>Credit Wallet</span>
                      <span className="text-amber-400 font-bold">{wallet.balance} Total</span>
                    </div>
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Complimentary (Bonus):</span>
                        <span className="text-emerald-400 font-medium">{wallet.complimentary_balance}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Purchased:</span>
                        <span className="text-amber-400 font-medium">{wallet.purchased_balance}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400 pt-2 border-t border-slate-700/60 leading-tight">
                      Complimentary credits are consumed first. Never expire.
                    </p>
                  </div>
                )}
              </div>

              {/* NOTIFICATIONS BELL */}
              <button
                id="btn-notifications"
                onClick={onOpenNotifications}
                className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* USER PROFILE & AVATAR MENU */}
              <div className="relative">
                <button
                  id="btn-user-avatar-menu"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all"
                >
                  <div className="relative">
                    <img
                      src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={user.display_name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                  </div>
                  <span className="text-sm font-medium text-slate-200 hidden md:block max-w-[100px] truncate">
                    {user.display_name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-12 w-56 p-1.5 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl z-50 text-sm">
                    <div className="p-2.5 border-b border-slate-700/70 mb-1">
                      <p className="font-semibold text-white truncate">{user.display_name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {user.role}
                      </span>
                    </div>

                    <button
                      id="menu-item-profile"
                      onClick={() => {
                        setCurrentTab('profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </button>

                    <button
                      id="menu-item-store"
                      onClick={() => {
                        setCurrentTab('store');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-slate-700/60 transition-colors"
                    >
                      <Coins className="w-4 h-4" />
                      <span>Credit Store</span>
                    </button>

                    {isUserAdmin(user) && (
                      <button
                        id="menu-item-admin"
                        onClick={() => {
                          setCurrentTab('admin');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-slate-700/60 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Admin Portal</span>
                      </button>
                    )}

                    <div className="pt-1 mt-1 border-t border-slate-700/60">
                      <button
                        id="menu-item-logout"
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-nav-login"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors border border-slate-700"
              >
                Log In
              </button>
              <button
                id="btn-nav-signup"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-sm font-semibold text-white shadow-md shadow-rose-600/20 transition-all"
              >
                Join (18+)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      {user && (
        <div className="md:hidden flex items-center justify-around bg-slate-900 border-t border-slate-800 py-2 px-1">
          <button
            onClick={() => setCurrentTab('discover')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] ${
              currentTab === 'discover' ? 'text-rose-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Flame className="w-5 h-5" />
            <span>Discover</span>
          </button>
          <button
            onClick={() => setCurrentTab('feed')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] ${
              currentTab === 'feed' ? 'text-rose-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span>Feed</span>
          </button>
          <button
            onClick={() => setCurrentTab('chat')}
            className={`relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] ${
              currentTab === 'chat' ? 'text-rose-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chat</span>
            {unreadMessages > 0 && (
              <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadMessages}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentTab('mail')}
            className={`relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] ${
              currentTab === 'mail' ? 'text-rose-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Mail className="w-5 h-5" />
            <span>Mail</span>
            {unreadMail > 0 && (
              <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold flex items-center justify-center">
                {unreadMail}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentTab('store')}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] ${
              currentTab === 'store' ? 'text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span>Credits</span>
          </button>
        </div>
      )}
    </header>
  );
};
