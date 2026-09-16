import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { wsClient } from '../../services/websocket';
import { AppNotification } from '../../types';
import {
  Bell,
  X,
  Heart,
  MessageCircle,
  Gift,
  Coins,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onUnreadCountChange: (count: number) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications(30, 0);
      setNotifications(res.notifications);
      const unread = res.notifications.filter((n) => !n.is_read).length;
      onUnreadCountChange(unread);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = wsClient.on('NEW_NOTIFICATION', (newNotif: AppNotification) => {
      setNotifications((prev) => [newNotif, ...prev]);
      onUnreadCountChange(1);
    });

    return () => unsub();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onUnreadCountChange(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = (notif: AppNotification) => {
    if (!notif.is_read) {
      api.markNotificationRead(notif.id).catch(console.error);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }

    if (notif.type === 'MATCH' || notif.type === 'LIKE') {
      onNavigateTab('discover');
    } else if (notif.type === 'MESSAGE') {
      onNavigateTab('chat');
    } else if (notif.type === 'MAIL') {
      onNavigateTab('mail');
    } else if (notif.type === 'GIFT') {
      onNavigateTab('profile');
    } else if (notif.type === 'CREDIT_ADDED') {
      onNavigateTab('store');
    }
    onClose();
  };

  if (!isOpen) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'LIKE':
      case 'MATCH':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'MESSAGE':
        return <MessageCircle className="w-4 h-4 text-blue-400" />;
      case 'GIFT':
        return <Gift className="w-4 h-4 text-amber-400" />;
      case 'CREDIT_ADDED':
        return <Coins className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* HEADER */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-white">Notifications</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <Bell className="w-8 h-8 mx-auto text-slate-600" />
              <p>No notifications right now.</p>
              <p className="text-[11px] text-slate-600">You're all caught up!</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                  !n.is_read ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 border border-slate-700">
                  {renderIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className={`text-xs ${!n.is_read ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {new Date(n.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{n.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
