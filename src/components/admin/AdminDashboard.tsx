import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, ModerationReport } from '../../types';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  Coins,
  Search,
  Ban,
  CheckCircle,
  XCircle,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('reports');

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Reports
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Credit grant modal
  const [grantUser, setGrantUser] = useState<User | null>(null);
  const [grantAmount, setGrantAmount] = useState(50);
  const [grantBucket, setGrantBucket] = useState<'complimentary' | 'purchased'>('complimentary');

  const fetchStatsAndData = async () => {
    setLoading(true);
    try {
      const [statsRes, reportsRes, usersRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminReports('PENDING'),
        api.getAdminUsers(searchQuery),
      ]);
      setStats(statsRes.stats);
      setReports(reportsRes.reports);
      setUsers(usersRes.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndData();
  }, []);

  const handleResolveReport = async (reportId: string, action: string, banUser = false) => {
    try {
      await api.resolveAdminReport(reportId, action, banUser);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      fetchStatsAndData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleBanUser = async (user: User) => {
    const willBan = !user.is_banned;
    if (confirm(`${willBan ? 'Ban' : 'Unban'} user ${user.display_name}?`)) {
      try {
        await api.updateAdminUserStatus(user.id, { is_banned: willBan });
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_banned: willBan ? 1 : 0 } : u))
        );
        fetchStatsAndData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleGrantCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUser) return;

    try {
      await api.grantAdminCredits(grantUser.id, grantAmount, grantBucket, 'Admin staff adjustment');
      alert(`Granted ${grantAmount} ${grantBucket} credits to ${grantUser.display_name}`);
      setGrantUser(null);
      fetchStatsAndData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ADMIN HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">Staff &amp; Moderation Center</h1>
                {user?.email && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Authorized Admin: {user.email}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Platform safety, compliance, and user management</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchStatsAndData}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* METRIC OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Verified Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{stats?.totalUsers || 0}</p>
          <span className="text-[11px] text-slate-500">18+ age verified members</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Pending Reports</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-extrabold text-rose-400">{stats?.pendingReports || 0}</p>
          <span className="text-[11px] text-slate-500">Needs moderation action</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Banned Users</span>
            <Ban className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{stats?.bannedUsers || 0}</p>
          <span className="text-[11px] text-slate-500">Account suspensions</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Active Chats Today</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400">{stats?.activeChatSessions || 0}</p>
          <span className="text-[11px] text-slate-500">Live billed interactions</span>
        </div>
      </div>

      {/* SECTION TABS */}
      <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700 w-fit text-xs">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'reports'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Reports Queue ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          User Management ({users.length})
        </button>
      </div>

      {/* TAB 1: REPORTS QUEUE */}
      {activeTab === 'reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Pending Moderation Reports</h3>
            <span className="text-xs text-slate-400">Review suspicious accounts or violations</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                All clear! No pending reports in the moderation queue.
              </div>
            ) : (
              reports.map((rep) => (
                <div key={rep.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                        {rep.reason}
                      </span>
                      <span className="text-xs text-slate-400">
                        Reported User: <strong className="text-white">{rep.target_user?.display_name || rep.target_user_id}</strong>
                      </span>
                    </div>

                    {rep.details && (
                      <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                        "{rep.details}"
                      </p>
                    )}

                    <span className="text-[10px] text-slate-500">
                      Filed on {new Date(rep.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolveReport(rep.id, 'DISMISSED', false)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleResolveReport(rep.id, 'RESOLVED_WARNING', false)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition-colors"
                    >
                      Warn User
                    </button>
                    <button
                      onClick={() => handleResolveReport(rep.id, 'RESOLVED_BANNED', true)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all"
                    >
                      Ban User
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl space-y-4">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-white">Registered Members</h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchStatsAndData()}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Location &amp; Age</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      <img
                        src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                        alt={u.display_name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-bold text-white">{u.display_name}</p>
                        <p className="text-[10px] text-slate-400">{u.email}</p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
                        {u.role}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {u.location} • {u.age} yrs
                    </td>

                    <td className="px-5 py-3.5">
                      {u.is_banned ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                          BANNED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          ACTIVE
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => setGrantUser(u)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-semibold border border-amber-500/30"
                      >
                        Grant Credits
                      </button>

                      <button
                        onClick={() => handleToggleBanUser(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          u.is_banned
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-600/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRANT CREDITS MODAL */}
      {grantUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              Grant Credits to {grantUser.display_name}
            </h3>

            <form onSubmit={handleGrantCredits} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Credits Amount</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Credit Bucket</label>
                <select
                  value={grantBucket}
                  onChange={(e) => setGrantBucket(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none"
                >
                  <option value="complimentary">Complimentary (Bonus)</option>
                  <option value="purchased">Purchased</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGrantUser(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Confirm Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
