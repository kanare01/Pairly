import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, GiftReceived, BlockRecord } from '../../types';
import {
  User as UserIcon,
  Camera,
  MapPin,
  Heart,
  Gift,
  ShieldCheck,
  Ban,
  Save,
  Sparkles,
  CheckCircle2,
  Trash2,
  Lock,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [aboutMe, setAboutMe] = useState(user?.about_me || '');
  const [location, setLocation] = useState(user?.location || '');
  const [intention, setIntention] = useState(user?.relationship_intention || 'CASUAL');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  const [receivedGifts, setReceivedGifts] = useState<GiftReceived[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setBio(user.bio || '');
      setAboutMe(user.about_me || '');
      setLocation(user.location);
      setIntention(user.relationship_intention || 'CASUAL');
      setAvatarUrl(user.avatar_url || '');

      // Fetch received gifts
      api.getReceivedGifts().then((res) => setReceivedGifts(res.receivedGifts)).catch(console.error);
      // Fetch blocked users
      api.getBlockedUsers().then((res) => setBlockedUsers(res.blockedUsers)).catch(console.error);
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingAvatar(true);
      try {
        const uploadRes = await api.uploadMedia(file);
        setAvatarUrl(uploadRes.url);
        await api.updateProfile({ avatar_url: uploadRes.url });
        await refreshUser();
      } catch (err: any) {
        alert(err.message || 'Failed to upload avatar');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        display_name: displayName,
        bio,
        about_me: aboutMe,
        location,
        relationship_intention: intention as any,
        avatar_url: avatarUrl,
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    try {
      await api.unblockUser(targetUserId);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_user_id !== targetUserId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER CARD */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* AVATAR WITH UPLOAD OVERLAY */}
          <div className="relative group">
            <img
              src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
              alt={user.display_name}
              referrerPolicy="no-referrer"
              className="w-28 h-28 rounded-3xl object-cover ring-4 ring-rose-500/30 shadow-2xl"
            />
            <label className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="w-6 h-6 text-rose-400 mb-1" />
              <span className="text-[10px] font-semibold">Change Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {user.display_name}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                18+ Verified
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                {user.role}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>{user.location}</span>
              <span className="mx-1">•</span>
              <span>{user.age} years old</span>
            </p>

            <p className="text-xs text-slate-300 mt-3 max-w-xl line-clamp-2">
              {user.bio || 'No bio provided yet. Update your profile below!'}
            </p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Profile changes saved successfully!</span>
        </div>
      )}

      {/* EDIT PROFILE DETAILS */}
      <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <h2 className="text-lg font-bold text-white tracking-tight border-b border-slate-800 pb-3">
          Profile Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Location</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Relationship Intention</label>
          <select
            value={intention}
            onChange={(e) => setIntention(e.target.value as any)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
          >
            <option value="LONG_TERM">Long-term Relationship</option>
            <option value="CASUAL">Casual Dating &amp; Fun</option>
            <option value="FRIENDS">New Friends &amp; Connections</option>
            <option value="MARRIAGE">Marriage Minded</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Short Bio</label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={180}
            placeholder="A short punchy introduction about yourself..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Passions &amp; Lifestyle</label>
          <textarea
            rows={4}
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            placeholder="Share your favorite music, favorite travel destinations, weekend passions, or dream dates..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 resize-none"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>

      {/* RECEIVED VIRTUAL GIFTS TROPHY SHOWCASE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Gift Showcase</h2>
          </div>
          <span className="text-xs text-amber-400 font-semibold">
            {receivedGifts.length} Gifts Received
          </span>
        </div>

        {receivedGifts.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No gifts received yet. Connect with other members to receive roses and surprises!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {receivedGifts.map((rg) => (
              <div
                key={rg.id}
                className="p-3 rounded-2xl bg-slate-800/80 border border-amber-500/30 text-center flex flex-col items-center justify-between"
              >
                <span className="text-3xl my-1">
                  {rg.gift?.icon_name === 'rose'
                    ? '🌹'
                    : rg.gift?.icon_name === 'chocolate'
                    ? '🍫'
                    : rg.gift?.icon_name === 'champagne'
                    ? '🍾'
                    : rg.gift?.icon_name === 'diamond'
                    ? '💎'
                    : '🧸'}
                </span>
                <p className="text-xs font-bold text-white">{rg.gift?.name}</p>
                <p className="text-[10px] text-slate-400">from {rg.sender?.display_name}</p>
                {rg.message && (
                  <p className="text-[10px] text-amber-300/90 italic mt-1 bg-slate-900/60 p-1.5 rounded-lg w-full">
                    "{rg.message}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRIVACY & BLOCKED USERS MANAGEMENT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Blocked Users</h2>
          </div>
          <span className="text-xs text-slate-400">{blockedUsers.length} Blocked</span>
        </div>

        {blockedUsers.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">You have not blocked any members.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {blockedUsers.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">
                    {b.blocked_user?.display_name || 'Member'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Reason: {b.reason || 'User block'} • {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleUnblock(b.blocked_user_id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
