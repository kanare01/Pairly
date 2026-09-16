import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Post, PostComment } from '../../types';
import {
  Heart,
  MessageSquare,
  Lock,
  Unlock,
  Coins,
  Image as ImageIcon,
  Send,
  Trash2,
  Sparkles,
  Flame,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface FeedViewProps {
  onNeedCredits: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({ onNeedCredits }) => {
  const { user, wallet, refreshWallet } = useAuth();
  const [feed, setFeed] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // New post composer
  const [postContent, setPostContent] = useState('');
  const [isExclusive, setIsExclusive] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Active comments post id
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchFeed = async () => {
    try {
      const res = await api.getFeed(30, 0);
      const rawList = res.feed || [];
      const normalized: Post[] = rawList.map((item: any, idx: number) => {
        if (item && item.post) {
          return {
            ...item.post,
            id: item.post.id || `post-feed-${idx}-${Date.now()}`,
            user: item.author || item.post.user,
            user_liked: Boolean(item.userReaction ?? item.post.user_liked),
            is_unlocked: item.is_unlocked ?? item.post.is_unlocked ?? !item.post.is_exclusive,
          };
        }
        return {
          ...item,
          id: item.id || `post-feed-${idx}-${Date.now()}`,
        };
      });
      setFeed(normalized);
    } catch (err: any) {
      console.error('Failed to fetch feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && !mediaFile) return;

    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (mediaFile) {
        const uploadRes = await api.uploadMedia(mediaFile);
        mediaUrl = uploadRes.url;
        mediaType = mediaFile.type.startsWith('video') ? 'video' : 'photo';
      }

      const res = await api.createPost({
        content: postContent.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        is_exclusive: isExclusive,
        credit_price: isExclusive ? 50 : 0,
      });

      setFeed([res.post, ...feed]);
      setPostContent('');
      setIsExclusive(false);
      setMediaFile(null);
      setMediaPreview(null);
    } catch (err: any) {
      alert(err.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleToggleReaction = async (post: Post, reactionType = 'LIKE') => {
    try {
      const res = await api.togglePostReaction(post.id, reactionType);
      setFeed((prev) =>
        prev.map((p) => {
          if (p.id === post.id) {
            const wasLiked = p.user_liked;
            return {
              ...p,
              user_liked: res.action === 'ADDED',
              likes_count: res.action === 'ADDED' ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUnlockPost = async (post: Post) => {
    if (!wallet || wallet.balance < post.credit_price) {
      onNeedCredits();
      return;
    }

    if (confirm(`Unlock this exclusive post for ${post.credit_price} credits?`)) {
      try {
        await api.unlockPost(post.id);
        await refreshWallet();
        // Update post locally
        setFeed((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, is_unlocked: true } : p))
        );
      } catch (err: any) {
        alert(err.message || 'Failed to unlock post');
      }
    }
  };

  const openComments = async (postId: string) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);
    setLoadingComments(true);
    try {
      const res = await api.getPostComments(postId);
      const rawComments = res.comments || [];
      const normalizedComments: PostComment[] = rawComments.map((c: any, idx: number) => {
        if (c && c.comment) {
          return {
            ...c.comment,
            id: c.comment.id || `comment-${postId}-${idx}-${Date.now()}`,
            user: c.author || c.comment.user,
          };
        }
        return {
          ...c,
          id: c.id || `comment-${postId}-${idx}-${Date.now()}`,
        };
      });
      setComments(normalizedComments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newComment.trim()) return;
    try {
      const res = await api.addPostComment(postId, newComment.trim());
      const newC = res.comment;
      const normalized: PostComment = {
        ...newC,
        id: newC.id || `comment-${postId}-${Date.now()}`,
        user: newC.user || user,
      };
      setComments([...comments, normalized]);
      setNewComment('');
      setFeed((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (confirm('Delete this post?')) {
      try {
        await api.request(`/posts/${postId}`, { method: 'DELETE' });
        setFeed((prev) => prev.filter((p) => p.id !== postId));
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* FEED INTRO */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Community Feed</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              18+
            </span>
          </h1>
          <p className="text-xs text-slate-400">Share moments, stories, and exclusive creator content</p>
        </div>
      </div>

      {/* CREATE POST COMPOSER */}
      {user && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div className="flex items-start gap-3">
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={user.display_name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-800"
              />
              <textarea
                id="input-post-content"
                rows={3}
                placeholder="What's on your mind? Share an update or story..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors resize-none"
              />
            </div>

            {/* MEDIA PREVIEW */}
            {mediaPreview && (
              <div className="relative rounded-2xl overflow-hidden max-h-60 border border-slate-700">
                <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-3">
                {/* PHOTO UPLOAD */}
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors">
                  <ImageIcon className="w-4 h-4 text-rose-400" />
                  <span>Attach Media</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    className="hidden"
                  />
                </label>

                {/* EXCLUSIVE TOGGLE */}
                <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={isExclusive}
                    onChange={(e) => setIsExclusive(e.target.checked)}
                    className="rounded accent-amber-500 w-3.5 h-3.5"
                  />
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exclusive (50 Credits)</span>
                </label>
              </div>

              <button
                id="btn-submit-post"
                type="submit"
                disabled={posting || (!postContent.trim() && !mediaFile)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{posting ? 'Publishing...' : 'Post Update'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POSTS LIST */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading community updates...</p>
        </div>
      ) : feed.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <p className="text-sm font-semibold text-white">No posts in the feed yet</p>
          <p className="text-xs text-slate-400 mt-1">Be the first to share an update!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {feed.map((post, postIndex) => {
            const isAuthor = user?.id === post.user_id;
            const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR';
            const isLocked = Boolean(post.is_exclusive) && !post.is_unlocked && !isAuthor;
            const postKey = post.id || `post-item-${postIndex}`;

            return (
              <article
                key={postKey}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
              >
                {/* AUTHOR BAR */}
                <div className="p-4 flex items-center justify-between border-b border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <img
                      src={post.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={post.user?.display_name || 'Member'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-800"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">{post.user?.display_name}</span>
                        {post.user?.role === 'ADMIN' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">
                            ADMIN
                          </span>
                        )}
                        {post.is_exclusive === 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>Exclusive</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(post.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {(isAuthor || isStaff) && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete Post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* POST CONTENT */}
                <div className="p-4 space-y-3">
                  {post.content && (
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                  )}

                  {/* MEDIA SECTION */}
                  {post.media_url && (
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-[450px]">
                      {isLocked ? (
                        /* BLURRED / LOCKED PAYWALL */
                        <div className="relative h-80 w-full flex items-center justify-center">
                          <img
                            src={post.media_url}
                            alt="Exclusive preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover filter blur-2xl scale-110 opacity-40"
                          />
                          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl">
                              <Lock className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-white">Exclusive Content</h4>
                              <p className="text-xs text-slate-300 max-w-xs mt-1">
                                {post.user?.display_name} has locked this photo behind a paywall.
                              </p>
                            </div>
                            <button
                              id={`btn-unlock-post-${post.id}`}
                              onClick={() => handleUnlockPost(post)}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-bold text-xs shadow-xl shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105"
                            >
                              <Coins className="w-4 h-4" />
                              <span>Unlock for {post.credit_price} Credits</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* UNLOCKED MEDIA */
                        post.media_type === 'video' ? (
                          <video
                            src={post.media_url}
                            controls
                            className="w-full h-auto max-h-[450px] object-cover"
                          />
                        ) : (
                          <img
                            src={post.media_url}
                            alt="Post media"
                            referrerPolicy="no-referrer"
                            className="w-full h-auto max-h-[450px] object-cover"
                          />
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* REACTIONS BAR */}
                <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleReaction(post, 'LIKE')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        post.user_liked
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.user_liked ? 'fill-rose-400' : ''}`} />
                      <span>{post.likes_count}</span>
                    </button>

                    <button
                      onClick={() => openComments(post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.comments_count}</span>
                    </button>
                  </div>
                </div>

                {/* EXPANDABLE COMMENTS SECTION */}
                {activeCommentsPostId === post.id && (
                  <div className="p-4 bg-slate-950/70 border-t border-slate-800/90 space-y-3 animate-in fade-in">
                    {loadingComments ? (
                      <p className="text-xs text-slate-400 text-center py-2">Loading comments...</p>
                    ) : comments.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">No comments yet. Say something friendly!</p>
                    ) : (
                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {comments.map((comment, commentIdx) => (
                          <div
                            key={comment.id || `comment-${postKey}-${commentIdx}`}
                            className="flex items-start gap-2.5 text-xs"
                          >
                            <img
                              src={comment.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                              alt={comment.user?.display_name}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-800 mt-0.5"
                            />
                            <div className="flex-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-white">{comment.user?.display_name}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(comment.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-slate-300 leading-snug">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ADD COMMENT INPUT */}
                    {user && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!newComment.trim()}
                          className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
