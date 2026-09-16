import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { wsClient } from '../../services/websocket';
import { Conversation, Message, User } from '../../types';
import {
  MessageCircle,
  Send,
  Image as ImageIcon,
  Smile,
  Gift,
  Coins,
  ShieldAlert,
  Ban,
  MoreVertical,
  Clock,
  CheckCheck,
  Sparkles,
  Phone,
  Video,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react';

interface ChatViewProps {
  initialPartner?: User | null;
  onSendGiftToUser: (user: User) => void;
  onReportUser: (user: User) => void;
  onNeedCredits: () => void;
}

const STICKERS = [
  { id: 'kiss', icon: '💋', label: 'Passionate Kiss', cost: 5 },
  { id: 'fire', icon: '🔥', label: 'You Are Hot', cost: 5 },
  { id: 'love_eyes', icon: '😍', label: 'Heart Eyes', cost: 5 },
  { id: 'champagne', icon: '🍾', label: 'Cheers to Us', cost: 5 },
  { id: 'rose', icon: '🌹', label: 'Fresh Rose', cost: 5 },
  { id: 'crown', icon: '👑', label: 'Queen / King', cost: 5 },
];

export const ChatView: React.FC<ChatViewProps> = ({
  initialPartner,
  onSendGiftToUser,
  onReportUser,
  onNeedCredits,
}) => {
  const { user, wallet, refreshWallet } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [inputMessage, setInputMessage] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showPartnerMenu, setShowPartnerMenu] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Live Chat Billing Session (Section 24: 2 credits / minute)
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);

      // If initialPartner was passed, select or create conversation with them
      if (initialPartner) {
        const existing = res.conversations.find((c) => c.partner?.id === initialPartner.id);
        if (existing) {
          selectConversation(existing);
        } else {
          const newConvRes = await api.getOrCreateConversation(initialPartner.id);
          setConversations([newConvRes.conversation, ...res.conversations]);
          selectConversation(newConvRes.conversation);
        }
      } else if (res.conversations.length > 0 && !activeConversation) {
        selectConversation(res.conversations[0]);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [initialPartner]);

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    try {
      const res = await api.getMessages(conv.id);
      setMessages(res.messages);
      setTimeout(scrollToBottom, 100);

      // Check for existing active billing session
      const sessRes = await api.heartbeatChatSession(conv.id);
      if (sessRes.active && sessRes.session) {
        setActiveSession(sessRes.session);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Socket listener for real-time incoming messages
  useEffect(() => {
    const unsub = wsClient.on('NEW_MESSAGE', (newMsg: Message) => {
      if (activeConversation && newMsg.conversation_id === activeConversation.id) {
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(scrollToBottom, 50);
      }
      // Update snippet in conversation list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === newMsg.conversation_id) {
            return {
              ...c,
              last_message: {
                content: newMsg.content,
                sender_id: newMsg.sender_id,
                created_at: newMsg.created_at,
              },
            };
          }
          return c;
        })
      );
    });

    return () => unsub();
  }, [activeConversation]);

  // Chat Billing Timer & Heartbeat Interval
  useEffect(() => {
    let timerInterval: any = null;
    let heartbeatInterval: any = null;

    if (activeSession && activeSession.is_active) {
      timerInterval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);

      heartbeatInterval = setInterval(async () => {
        if (activeConversation) {
          try {
            const hb = await api.heartbeatChatSession(activeConversation.id);
            if (hb.active) {
              setActiveSession(hb.session);
              await refreshWallet();
            } else {
              setActiveSession(null);
            }
          } catch {
            // ignore
          }
        }
      }, 20000);
    } else {
      setSessionSeconds(0);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [activeSession, activeConversation]);

  const handleStartSession = async () => {
    if (!activeConversation) return;
    if (!wallet || wallet.balance < 2) {
      onNeedCredits();
      return;
    }

    try {
      const res = await api.startChatSession(activeConversation.id, activeConversation.partner.id);
      setActiveSession(res.session);
      setSessionSeconds(0);
      await refreshWallet();
    } catch (err: any) {
      alert(err.message || 'Failed to start billing session');
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await api.endChatSession(activeSession.id);
      setActiveSession(null);
      await refreshWallet();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConversation) return;

    const content = inputMessage.trim();
    setInputMessage('');

    try {
      const res = await api.sendMessage(activeConversation.id, { content });
      setMessages((prev) => [...prev, res.message]);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendSticker = async (sticker: typeof STICKERS[0]) => {
    if (!activeConversation) return;
    if (!wallet || wallet.balance < sticker.cost) {
      onNeedCredits();
      return;
    }

    try {
      const res = await api.sendMessage(activeConversation.id, {
        content: `[STICKER: ${sticker.icon} ${sticker.label}]`,
      });
      setMessages((prev) => [...prev, res.message]);
      setShowStickers(false);
      await refreshWallet();
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      alert(err.message || 'Failed to send sticker');
    }
  };

  const handleAttachMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !activeConversation) return;

    const file = e.target.files[0];
    setUploadingMedia(true);
    try {
      const uploadRes = await api.uploadMedia(file);
      const res = await api.sendMessage(activeConversation.id, {
        media_url: uploadRes.url,
        media_type: file.type.startsWith('video') ? 'video' : 'photo',
      });
      setMessages((prev) => [...prev, res.message]);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      alert(err.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleBlockPartner = async () => {
    if (!activeConversation) return;
    if (confirm(`Block ${activeConversation.partner.display_name}? Conversation will be closed.`)) {
      try {
        await api.blockUser(activeConversation.partner.id, 'Blocked via chat');
        setConversations((prev) => prev.filter((c) => c.id !== activeConversation.id));
        setActiveConversation(null);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-5rem)] flex gap-4">
      {/* LEFT: CONVERSATIONS LIST */}
      <div className="w-full md:w-80 lg:w-96 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold text-white">Live Messages</h2>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold">
            {conversations.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <p>No conversations yet.</p>
              <p className="text-[11px] text-slate-500">Go to Discover to find matches and start talking!</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              const isOnline = conv.partner?.is_online === 1;

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-rose-500/10 border-l-4 border-rose-500' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={conv.partner?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={conv.partner?.display_name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover ring-1 ring-slate-800"
                    />
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900 animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate">
                        {conv.partner?.display_name || 'Member'}
                      </h4>
                      {conv.last_message && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(conv.last_message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {conv.last_message ? conv.last_message.content : 'Started a new conversation'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: CHAT PANEL */}
      <div className="hidden md:flex flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex-col shadow-xl">
        {activeConversation ? (
          <>
            {/* CHAT HEADER */}
            <div className="p-3.5 px-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={activeConversation.partner?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={activeConversation.partner?.display_name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700"
                  />
                  {activeConversation.partner?.is_online === 1 && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{activeConversation.partner?.display_name}</span>
                    <span className="text-xs text-slate-400 font-normal">
                      ({activeConversation.partner?.age} yrs, {activeConversation.partner?.location})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className={activeConversation.partner?.is_online === 1 ? 'text-emerald-400' : 'text-slate-500'}>
                      {activeConversation.partner?.is_online === 1 ? 'Online' : 'Offline'}
                    </span>
                    <span>•</span>
                    <span className="text-amber-400 font-medium">Rate: 2 credits / min</span>
                  </div>
                </div>
              </div>

              {/* LIVE BILLING SESSION CONTROLS (Section 24) */}
              <div className="flex items-center gap-2">
                {activeSession && activeSession.is_active ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
                    <Clock className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-mono font-bold">{formatTimer(sessionSeconds)}</span>
                    <button
                      onClick={handleEndSession}
                      className="ml-1 p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
                      title="End Live Session"
                    >
                      <Square className="w-3 h-3 fill-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20"
                    title="Start Live Chat session at 2 credits per minute"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Live Chat (2 cr/min)</span>
                  </button>
                )}

                {/* SEND GIFT */}
                <button
                  onClick={() => onSendGiftToUser(activeConversation.partner)}
                  className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors"
                  title="Send Gift"
                >
                  <Gift className="w-4 h-4" />
                </button>

                {/* MORE OPTIONS */}
                <div className="relative">
                  <button
                    onClick={() => setShowPartnerMenu(!showPartnerMenu)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showPartnerMenu && (
                    <div className="absolute right-0 top-11 w-44 p-1.5 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 text-xs">
                      <button
                        onClick={() => {
                          setShowPartnerMenu(false);
                          onReportUser(activeConversation.partner);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-slate-700/60 transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Report User</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowPartnerMenu(false);
                          handleBlockPartner();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-slate-700/60 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block User</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* MESSAGES STREAM */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-white">Start your conversation</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Send a friendly message, sticker, or surprise {activeConversation.partner.display_name} with a virtual gift!
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-2xl text-xs leading-relaxed ${
                          isMine
                            ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-tr-none shadow-md shadow-rose-600/20'
                            : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/80'
                        }`}
                      >
                        {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}

                        {msg.media_url && (
                          <div className="mt-2 rounded-xl overflow-hidden max-h-60">
                            {msg.media_type === 'video' ? (
                              <video src={msg.media_url} controls className="w-full h-auto" />
                            ) : (
                              <img
                                src={msg.media_url}
                                alt="Media"
                                referrerPolicy="no-referrer"
                                className="w-full h-auto object-cover"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 px-1">
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine && <CheckCheck className="w-3 h-3 text-rose-400" />}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* STICKERS DRAWER (5 Credits each) */}
            {showStickers && (
              <div className="p-3 bg-slate-900 border-t border-slate-800 animate-in fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Send Sticker <span className="text-amber-400 font-bold">(5 credits each)</span>
                  </span>
                  <button
                    onClick={() => setShowStickers(false)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {STICKERS.map((stk) => (
                    <button
                      key={stk.id}
                      onClick={() => handleSendSticker(stk)}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 flex flex-col items-center gap-1 transition-transform hover:scale-105"
                      title={`${stk.label} (5 credits)`}
                    >
                      <span className="text-2xl">{stk.icon}</span>
                      <span className="text-[10px] text-slate-300 line-clamp-1">{stk.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CHAT INPUT BAR */}
            <form onSubmit={handleSendMessage} className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
              <label className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer">
                <ImageIcon className="w-4 h-4 text-rose-400" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleAttachMedia}
                  disabled={uploadingMedia}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowStickers(!showStickers)}
                className={`p-2 rounded-xl border transition-colors ${
                  showStickers
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Stickers (5 credits)"
              >
                <Smile className="w-4 h-4" />
              </button>

              <input
                id="input-chat-message"
                type="text"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
              />

              <button
                id="btn-send-chat-message"
                type="submit"
                disabled={!inputMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Select a Conversation</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Choose someone from the left panel or discover new people to start messaging.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
