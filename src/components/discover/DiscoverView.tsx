import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, RelationshipIntention } from '../../types';
import {
  Heart,
  X,
  Gift,
  Mail,
  SlidersHorizontal,
  MapPin,
  Sparkles,
  ShieldAlert,
  Ban,
  Check,
  Search,
  Grid,
  CreditCard,
  MessageCircle,
} from 'lucide-react';

interface DiscoverViewProps {
  onStartChatWithUser: (user: User) => void;
  onSendMailToUser: (user: User) => void;
  onSendGiftToUser: (user: User) => void;
  onReportUser: (user: User) => void;
  onMatchCreated: (user: User) => void;
  onNeedCredits: () => void;
  onOpenAuth?: () => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  onStartChatWithUser,
  onSendMailToUser,
  onSendGiftToUser,
  onReportUser,
  onMatchCreated,
  onNeedCredits,
  onOpenAuth,
}) => {
  const { user: currentUser } = useAuth();

  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'stack' | 'grid'>('grid');

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [genderFilter, setGenderFilter] = useState('');
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(65);
  const [locationSearch, setLocationSearch] = useState('');
  const [intentionFilter, setIntentionFilter] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState('');

  // Selected profile detail modal
  const [selectedProfile, setSelectedProfile] = useState<User | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const res = await api.getPeople({
        gender: genderFilter || undefined,
        minAge: minAge !== 18 ? minAge : undefined,
        maxAge: maxAge !== 65 ? maxAge : undefined,
        location: locationSearch || undefined,
        intention: intentionFilter || undefined,
        onlineOnly: onlineOnly || undefined,
        search: keywordSearch || undefined,
        limit: 30,
      });
      setPeople(res.people);
    } catch (err: any) {
      console.error('Failed to fetch discovery people:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [genderFilter, minAge, maxAge, onlineOnly, intentionFilter]);

  const handleLike = async (targetUser: User) => {
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    try {
      const res = await api.likeUser(targetUser.id);
      if (res.isMatch) {
        onMatchCreated(targetUser);
      } else {
        setActionFeedback(`You liked ${targetUser.display_name}!`);
        setTimeout(() => setActionFeedback(null), 2500);
      }
      // Remove from stack if stack mode
      setPeople((prev) => prev.filter((p) => p.id !== targetUser.id));
    } catch (err: any) {
      alert(err.message || 'Failed to like user');
    }
  };

  const handlePass = (targetUser: User) => {
    setPeople((prev) => prev.filter((p) => p.id !== targetUser.id));
  };

  const handleBlock = async (targetUser: User) => {
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    if (confirm(`Block ${targetUser.display_name}? You will no longer see each other.`)) {
      try {
        await api.blockUser(targetUser.id, 'Blocked from discovery');
        setPeople((prev) => prev.filter((p) => p.id !== targetUser.id));
        if (selectedProfile?.id === targetUser.id) setSelectedProfile(null);
        setActionFeedback(`${targetUser.display_name} has been blocked.`);
        setTimeout(() => setActionFeedback(null), 2500);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const renderIntentionBadge = (intention?: RelationshipIntention) => {
    switch (intention) {
      case 'LONG_TERM':
        return <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">Long-term</span>;
      case 'CASUAL':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">Casual Dating</span>;
      case 'FRIENDS':
        return <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">New Friends</span>;
      case 'MARRIAGE':
        return <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-semibold">Marriage Minded</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 text-[10px] font-semibold">Exploring</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ACTION TOAST */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-rose-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in text-sm font-medium">
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* DISCOVERY HEADER & TOOLBAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Discover Connections</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Strictly 18+
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse verified members nearby. Like, chat, send gifts, or write letters.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search people..."
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPeople()}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* VIEW MODE TOGGLE */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('stack')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'stack' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Card Stack View"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          </div>

          {/* FILTER BUTTON */}
          <button
            id="btn-toggle-filters"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showFilters || genderFilter || onlineOnly || intentionFilter
                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs animate-in fade-in">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Gender</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none"
            >
              <option value="">All Genders</option>
              <option value="FEMALE">Women</option>
              <option value="MALE">Men</option>
              <option value="NON_BINARY">Non-Binary</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Age Range: {minAge} - {maxAge} yrs
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="range"
                min="18"
                max="65"
                value={minAge}
                onChange={(e) => setMinAge(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              <input
                type="range"
                min="18"
                max="65"
                value={maxAge}
                onChange={(e) => setMaxAge(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Looking For</label>
            <select
              value={intentionFilter}
              onChange={(e) => setIntentionFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none"
            >
              <option value="">Any Intention</option>
              <option value="LONG_TERM">Long-term Relationship</option>
              <option value="CASUAL">Casual Dating</option>
              <option value="FRIENDS">New Friends</option>
              <option value="MARRIAGE">Marriage Minded</option>
            </select>
          </div>

          <div className="flex items-end justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer pb-2 text-slate-300">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(e) => setOnlineOnly(e.target.checked)}
                className="rounded accent-rose-500 w-4 h-4"
              />
              <span>Online Now Only</span>
            </label>

            <button
              onClick={() => {
                setGenderFilter('');
                setMinAge(18);
                setMaxAge(65);
                setLocationSearch('');
                setIntentionFilter('');
                setOnlineOnly(false);
                setKeywordSearch('');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors text-[11px]"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* DISCOVERY CONTENT */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Finding members matching your preferences...</p>
        </div>
      ) : people.length === 0 ? (
        <div className="py-20 text-center bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
          <Sparkles className="w-10 h-10 text-rose-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-semibold text-white">No profiles found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or resetting filters to see more members nearby.
          </p>
          <button
            onClick={() => {
              setGenderFilter('');
              setMinAge(18);
              setMaxAge(65);
              setOnlineOnly(false);
              setIntentionFilter('');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'stack' ? (
        /* STACK VIEW (Tinder style card stack) */
        <div className="flex flex-col items-center justify-center py-6">
          {people[0] && (
            <div className="relative w-full max-w-sm bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden group">
              {/* PHOTO */}
              <div className="relative h-96 w-full">
                <img
                  src={people[0].avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                  alt={people[0].display_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                {/* ONLINE INDICATOR */}
                {people[0].is_online === 1 && (
                  <span className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online Now
                  </span>
                )}

                {/* BIO SUMMARY OVERLAY */}
                <div className="absolute bottom-4 left-4 right-4 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      {people[0].display_name}, {people[0].age}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>{people[0].location}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {renderIntentionBadge(people[0].relationship_intention)}
                  </div>

                  {people[0].bio && (
                    <p className="mt-2 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {people[0].bio}
                    </p>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS BAR */}
              <div className="p-4 bg-slate-900/90 flex items-center justify-around border-t border-slate-800">
                <button
                  id="btn-stack-pass"
                  onClick={() => handlePass(people[0])}
                  className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-transform hover:scale-110 shadow-lg"
                  title="Pass"
                >
                  <X className="w-6 h-6" />
                </button>

                <button
                  id="btn-stack-gift"
                  onClick={() => onSendGiftToUser(people[0])}
                  className="w-11 h-11 rounded-2xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 flex items-center justify-center transition-transform hover:scale-110"
                  title="Send Virtual Gift"
                >
                  <Gift className="w-5 h-5" />
                </button>

                <button
                  id="btn-stack-chat"
                  onClick={() => onStartChatWithUser(people[0])}
                  className="w-11 h-11 rounded-2xl bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-transform hover:scale-110"
                  title="Direct Message"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>

                <button
                  id="btn-stack-like"
                  onClick={() => handleLike(people[0])}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform hover:scale-110"
                  title="Like"
                >
                  <Heart className="w-7 h-7 fill-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {people.map((person) => (
            <div
              key={person.id}
              className="relative bg-slate-900 border border-slate-800/90 rounded-3xl overflow-hidden hover:border-slate-700 transition-all group shadow-lg flex flex-col justify-between"
            >
              {/* IMAGE HEADER */}
              <div
                className="relative h-64 w-full cursor-pointer overflow-hidden"
                onClick={() => setSelectedProfile(person)}
              >
                <img
                  src={person.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}
                  alt={person.display_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                {/* ONLINE BADGE */}
                {person.is_online === 1 && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-emerald-400 border border-emerald-500/40 text-[10px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                )}

                {/* BASIC INFO OVERLAY */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-bold text-white tracking-tight truncate">
                      {person.display_name}, {person.age}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-300 mt-0.5">
                    <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="truncate">{person.location}</span>
                  </div>
                </div>
              </div>

              {/* CARD DETAILS */}
              <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {renderIntentionBadge(person.relationship_intention)}
                  </div>

                  {person.bio && (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {person.bio}
                    </p>
                  )}
                </div>

                {/* ACTIONS BAR */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => handleLike(person)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 group-hover:scale-[1.02]"
                    title="Like Profile"
                  >
                    <Heart className="w-3.5 h-3.5 fill-rose-400" />
                    <span>Like</span>
                  </button>

                  <button
                    onClick={() => onStartChatWithUser(person)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    title="Start Chat (2 credits/min)"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSendMailToUser(person)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    title="Send Letter (10 credits 1st letter)"
                  >
                    <Mail className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSendGiftToUser(person)}
                    className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors"
                    title="Send Gift"
                  >
                    <Gift className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FULL PROFILE DETAIL MODAL */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedProfile(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/60 text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* COVER / AVATAR */}
              <div className="relative h-64 -mx-6 -mt-6">
                <img
                  src={selectedProfile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600'}
                  alt={selectedProfile.display_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/30" />
                <div className="absolute bottom-4 left-6">
                  <h2 className="text-2xl font-bold text-white">
                    {selectedProfile.display_name}, {selectedProfile.age}
                  </h2>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>{selectedProfile.location}</span>
                  </p>
                </div>
              </div>

              {/* INTENTION & SAFETY BADGES */}
              <div className="flex items-center gap-2 flex-wrap">
                {renderIntentionBadge(selectedProfile.relationship_intention)}
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                  18+ Age Verified
                </span>
                {selectedProfile.is_online === 1 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                    Online Now
                  </span>
                )}
              </div>

              {/* BIO */}
              {selectedProfile.bio && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">About Me</h4>
                  <p className="text-sm text-slate-200 leading-relaxed bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                    {selectedProfile.bio}
                  </p>
                </div>
              )}

              {/* EXTENDED ABOUT ME */}
              {selectedProfile.about_me && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Passions &amp; Lifestyle</h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                    {selectedProfile.about_me}
                  </p>
                </div>
              )}

              {/* ACTION BUTTONS IN MODAL */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    handleLike(selectedProfile);
                    setSelectedProfile(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Like Profile</span>
                </button>

                <button
                  onClick={() => {
                    onStartChatWithUser(selectedProfile);
                    setSelectedProfile(null);
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 text-rose-400" />
                  <span>Start Live Chat</span>
                </button>

                <button
                  onClick={() => {
                    onSendMailToUser(selectedProfile);
                    setSelectedProfile(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Send Mail</span>
                </button>

                <button
                  onClick={() => {
                    onSendGiftToUser(selectedProfile);
                    setSelectedProfile(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs border border-amber-500/40 flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Send Virtual Gift</span>
                </button>
              </div>

              {/* SAFETY / REPORT / BLOCK */}
              <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={() => {
                    onReportUser(selectedProfile);
                    setSelectedProfile(null);
                  }}
                  className="hover:text-rose-400 transition-colors flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Report User</span>
                </button>

                <button
                  onClick={() => handleBlock(selectedProfile)}
                  className="hover:text-rose-400 transition-colors flex items-center gap-1"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block User</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
