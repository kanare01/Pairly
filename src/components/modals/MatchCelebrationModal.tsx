import React from 'react';
import { User } from '../../types';
import { Heart, MessageCircle, Gift, Sparkles, X } from 'lucide-react';

interface MatchCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  matchedUser: User | null;
  onStartChat: (user: User) => void;
  onSendGift: (user: User) => void;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  matchedUser,
  onStartChat,
  onSendGift,
}) => {
  if (!isOpen || !matchedUser || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-rose-500/40 rounded-3xl shadow-2xl p-8 text-center overflow-hidden">
        {/* CLOSE BUTTON */}
        <button
          id="btn-close-match-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* GLOW BACKGROUND */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* CELEBRATION BADGE */}
        <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Mutual Connection</span>
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">
          It's a Match!
        </h2>
        <p className="text-xs text-slate-300 mb-8">
          You and <span className="font-semibold text-rose-400">{matchedUser.display_name}</span> liked each other.
        </p>

        {/* CONNECTED AVATARS */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative">
            <img
              src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
              alt={currentUser.display_name}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-rose-500 shadow-xl shadow-rose-500/30"
            />
          </div>

          <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/50 z-10 animate-bounce">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>

          <div className="relative">
            <img
              src={matchedUser.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'}
              alt={matchedUser.display_name}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-rose-500 shadow-xl shadow-rose-500/30"
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="space-y-2.5">
          <button
            id="btn-match-chat-now"
            onClick={() => {
              onClose();
              onStartChat(matchedUser);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Say Hello (Live Chat)</span>
          </button>

          <button
            id="btn-match-send-gift"
            onClick={() => {
              onClose();
              onSendGift(matchedUser);
            }}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs border border-amber-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span>Send a Welcome Gift</span>
          </button>

          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors pt-1"
          >
            Keep Swiping
          </button>
        </div>
      </div>
    </div>
  );
};
