import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { MailThread, MailMessage, User } from '../../types';
import {
  Mail,
  Send,
  Inbox,
  Archive,
  Trash2,
  Paperclip,
  Coins,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  PlusCircle,
  X,
} from 'lucide-react';

interface MailViewProps {
  initialRecipient?: User | null;
  onNeedCredits: () => void;
}

export const MailView: React.FC<MailViewProps> = ({ initialRecipient, onNeedCredits }) => {
  const { user, wallet, refreshWallet } = useAuth();

  const [folder, setFolder] = useState<'INBOX' | 'SENT' | 'TRASH'>('INBOX');
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [activeThread, setActiveThread] = useState<MailThread | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose Modal State
  const [isComposing, setIsComposing] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(initialRecipient?.email || '');
  const [recipientUser, setRecipientUser] = useState<User | null>(initialRecipient || null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [sendingMail, setSendingMail] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  // Search recipient user helper
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const fetchThreads = async () => {
    if (!user) {
      setThreads([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMailThreads(folder);
      setThreads(res.threads);
      if (res.threads.length > 0 && !activeThread) {
        selectThread(res.threads[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch mail threads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [folder]);

  useEffect(() => {
    if (initialRecipient) {
      setRecipientUser(initialRecipient);
      setIsComposing(true);
    }
  }, [initialRecipient]);

  const selectThread = async (thread: MailThread) => {
    setActiveThread(thread);
    try {
      const res = await api.getMailMessages(thread.id);
      setMessages(res.messages);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchRecipient = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      try {
        const res = await api.getPeople({ search: query.trim(), limit: 5 });
        setSearchResults(res.people);
      } catch {
        // ignore
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachmentFile(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  // Section 24 Pricing Rules:
  // First letter between users: 10 credits
  // Subsequent reply: 30 credits
  // Attachment: +10 credits each
  const estimatedCredits = (isReply = false) => {
    const base = isReply ? 30 : 10;
    const attachmentCost = attachmentFile ? 10 : 0;
    return base + attachmentCost;
  };

  const handleSendNewMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientUser || !subject.trim() || !body.trim()) return;

    const requiredCredits = estimatedCredits(false);
    if (!wallet || wallet.balance < requiredCredits) {
      onNeedCredits();
      return;
    }

    setSendingMail(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;

      if (attachmentFile) {
        const uploadRes = await api.uploadMedia(attachmentFile);
        attachmentUrl = uploadRes.url;
        attachmentType = attachmentFile.type.startsWith('video') ? 'video' : 'photo';
      }

      await api.sendMail({
        recipient_id: recipientUser.id,
        subject: subject.trim(),
        body: body.trim(),
        attachments: attachmentUrl ? [{ url: attachmentUrl, media_type: attachmentType || 'photo' }] : undefined,
      });

      await refreshWallet();
      setIsComposing(false);
      setSubject('');
      setBody('');
      setAttachmentFile(null);
      setAttachmentPreview(null);
      fetchThreads();
    } catch (err: any) {
      alert(err.message || 'Failed to send mail');
    } finally {
      setSendingMail(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyBody.trim()) return;

    const partnerId = activeThread.user_id_1 === user?.id ? activeThread.user_id_2 : activeThread.user_id_1;
    const requiredCredits = estimatedCredits(true);

    if (!wallet || wallet.balance < requiredCredits) {
      onNeedCredits();
      return;
    }

    try {
      await api.sendMail({
        recipient_id: partnerId,
        thread_id: activeThread.id,
        subject: `Re: ${activeThread.subject}`,
        body: replyBody.trim(),
      });

      setReplyBody('');
      await refreshWallet();
      selectThread(activeThread);
    } catch (err: any) {
      alert(err.message || 'Failed to reply');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-5rem)] flex gap-4">
      {/* SIDEBAR NAVIGATION & FOLDERS */}
      <div className="w-full md:w-80 lg:w-96 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-xl">
        {/* HEADER & COMPOSE CTA */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-white">Mailbox</h2>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Letters
            </span>
          </div>

          <button
            id="btn-compose-mail"
            onClick={() => setIsComposing(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Compose Letter</span>
          </button>

          {/* FOLDER TABS */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700/60 text-xs">
            <button
              onClick={() => setFolder('INBOX')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                folder === 'INBOX' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Inbox
            </button>
            <button
              onClick={() => setFolder('SENT')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                folder === 'SENT' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sent
            </button>
            <button
              onClick={() => setFolder('TRASH')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                folder === 'TRASH' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Trash
            </button>
          </div>
        </div>

        {/* THREADS LIST */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading correspondence...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <p>No letters in {folder.toLowerCase()}.</p>
              <p className="text-[11px] text-slate-500">
                Compose your first romantic or introductory letter!
              </p>
            </div>
          ) : (
            threads.map((t) => {
              const isSelected = activeThread?.id === t.id;
              const hasUnread = t.unread_count > 0;

              return (
                <div
                  key={t.id}
                  onClick={() => selectThread(t)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-500/10 border-l-4 border-amber-500' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`text-xs truncate ${hasUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                      {t.subject || 'Personal Letter'}
                    </h4>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(t.last_message_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate">
                    {t.partner ? `With ${t.partner.display_name}` : 'Conversation'}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: THREAD READER & REPLY */}
      <div className="hidden md:flex flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex-col shadow-xl">
        {activeThread ? (
          <>
            {/* THREAD HEADER */}
            <div className="p-4 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{activeThread.subject}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  With <span className="font-semibold text-rose-400">{activeThread.partner?.display_name}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reply bonus: +5 complimentary credits if within 24h</span>
                </div>
              </div>
            </div>

            {/* MESSAGES IN THREAD */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/30">
              {messages.map((m) => {
                const isAuthor = m.sender_id === user?.id;

                return (
                  <div
                    key={m.id}
                    className={`p-5 rounded-2xl border ${
                      isAuthor
                        ? 'bg-slate-900/90 border-slate-700/80 ml-8'
                        : 'bg-slate-900 border-amber-500/30 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={m.sender?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                          alt={m.sender?.display_name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-700"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{m.sender?.display_name}</p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(m.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {m.credit_cost > 0 && (
                        <span className="text-[11px] text-amber-400 font-medium">
                          {m.credit_cost} credits billed
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-serif">
                      {m.body}
                    </p>

                    {/* ATTACHMENTS */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-3">
                        {m.attachments.map((att) => (
                          <div key={att.id} className="rounded-xl overflow-hidden border border-slate-700">
                            <img
                              src={att.url}
                              alt="Attachment"
                              referrerPolicy="no-referrer"
                              className="w-full h-44 object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* REPLY BOX */}
            <form onSubmit={handleSendReply} className="p-4 bg-slate-900/90 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Reply to letter</span>
                <span className="text-amber-400 font-semibold">Reply fee: 30 Credits</span>
              </div>
              <textarea
                rows={3}
                placeholder="Write your thoughtful reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={!replyBody.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Reply (30 credits)</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Select a Letter</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Read letters from other members or click "Compose Letter" to write a romantic introduction.
            </p>
          </div>
        )}
      </div>

      {/* COMPOSE NEW LETTER MODAL */}
      {isComposing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsComposing(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Compose Romantic Letter</h3>
              <p className="text-xs text-slate-400 mt-0.5">Send a personalized, thoughtful message</p>
            </div>

            {/* BILLING FEE BREAKDOWN BANNER (Section 24) */}
            <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
              <Coins className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  Fee Calculation: {estimatedCredits(false)} Credits
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  10 credits for initial letter + 10 credits per media attachment. Fast reply earns +5 bonus
                  complimentary credits!
                </p>
              </div>
            </div>

            <form onSubmit={handleSendNewMail} className="space-y-4">
              {/* RECIPIENT SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">To Member</label>
                {recipientUser ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={recipientUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                        alt={recipientUser.display_name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover"
                      />
                      <span className="text-xs font-bold text-white">{recipientUser.display_name}</span>
                      <span className="text-xs text-slate-400">({recipientUser.location})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecipientUser(null)}
                      className="text-xs text-slate-400 hover:text-rose-400"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type name to search members..."
                      value={searchQuery}
                      onChange={(e) => handleSearchRecipient(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                    />

                    {searchResults.length > 0 && (
                      <div className="absolute top-11 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden divide-y divide-slate-700">
                        {searchResults.map((person) => (
                          <div
                            key={person.id}
                            onClick={() => {
                              setRecipientUser(person);
                              setSearchResults([]);
                              setSearchQuery('');
                            }}
                            className="p-2.5 flex items-center gap-2.5 hover:bg-slate-700 cursor-pointer"
                          >
                            <img
                              src={person.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                              alt={person.display_name}
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-lg object-cover"
                            />
                            <span className="text-xs font-bold text-white">{person.display_name}</span>
                            <span className="text-[11px] text-slate-400">({person.age} yrs, {person.location})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SUBJECT */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Loved your travel stories / Hello from New York"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* BODY */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Letter Content</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Express your thoughts, share your passions, or ask questions about their lifestyle..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500 font-serif leading-relaxed resize-none"
                />
              </div>

              {/* ATTACHMENT UPLOAD */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Attach Photo / Video <span className="text-amber-400">(+10 credits)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-amber-400" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>

                  {attachmentFile && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <span>{attachmentFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentFile(null);
                          setAttachmentPreview(null);
                        }}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-slate-400">Wallet: </span>
                  <span className="font-bold text-amber-400">{wallet?.balance || 0} Credits</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsComposing(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-send-letter"
                    type="submit"
                    disabled={sendingMail || !recipientUser || !subject.trim() || !body.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingMail ? 'Sending...' : `Send Letter (${estimatedCredits(false)} Credits)`}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
