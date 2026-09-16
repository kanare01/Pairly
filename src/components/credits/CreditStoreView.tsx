import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CreditPackage, CreditTransaction } from '../../types';
import {
  Coins,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Gift,
  History,
  Lock,
} from 'lucide-react';

export const CreditStoreView: React.FC = () => {
  const { user, wallet, refreshWallet } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  const fetchData = async () => {
    try {
      const [pkgsRes, txRes] = await Promise.all([api.getPackages(), api.getTransactions(25, 0)]);
      setPackages(pkgsRes.packages);
      setTransactions(txRes.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePurchase = async (pkg: CreditPackage) => {
    setPurchasingId(pkg.id);
    setPurchaseSuccess(null);
    try {
      // 1. Create order
      const orderRes = await api.createOrder(pkg.id);
      // 2. Simulate payment gateway completion
      await api.simulatePaymentSuccess(orderRes.order.id);
      await refreshWallet();
      await fetchData();
      setPurchaseSuccess(`Successfully purchased ${pkg.credits} Credits!`);
      setTimeout(() => setPurchaseSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Purchase failed');
    } finally {
      setPurchasingId(null);
    }
  };

  const handleClaimDailyBonus = async () => {
    setClaimingDaily(true);
    try {
      const res = await api.claimDailyBonus();
      await refreshWallet();
      await fetchData();
      setDailyClaimed(true);
      setPurchaseSuccess(`Claimed +${res.bonusCredits} Complimentary Credits for logging in today!`);
      setTimeout(() => setPurchaseSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Daily bonus already claimed or unavailable');
    } finally {
      setClaimingDaily(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* WALLET OVERVIEW HERO CARD */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Pairly Credit Wallet</span>
              </span>
              <span className="text-xs text-slate-400">Strictly 18+ Verified Platform</span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                {wallet?.balance || 0}
              </h1>
              <span className="text-lg text-amber-400 font-semibold">Total Credits</span>
            </div>

            {/* BUCKETS BREAKDOWN */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <span className="text-slate-400">Complimentary (Bonus): </span>
                <strong className="text-emerald-400 font-bold ml-1">
                  {wallet?.complimentary_balance || 0} Credits
                </strong>
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <span className="text-slate-400">Purchased Balance: </span>
                <strong className="text-amber-400 font-bold ml-1">
                  {wallet?.purchased_balance || 0} Credits
                </strong>
              </div>
            </div>
          </div>

          {/* DAILY BONUS REWARD BUTTON */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <button
              id="btn-claim-daily-bonus"
              onClick={handleClaimDailyBonus}
              disabled={claimingDaily || dailyClaimed}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-emerald-200" />
              <span>{dailyClaimed ? 'Daily Bonus Claimed (+10 cr)' : 'Claim Daily Bonus (+10 cr)'}</span>
            </button>
            <p className="text-[11px] text-slate-400">Claim once every 24 hours to keep chatting</p>
          </div>
        </div>

        {/* GLOW ACCENT */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
      </div>

      {/* TOAST SUCCESS BANNER */}
      {purchaseSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{purchaseSuccess}</span>
        </div>
      )}

      {/* PACKAGES GRID */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Credit Packages</h2>
          <p className="text-xs text-slate-400">
            Complimentary credits are consumed first. Credits never expire. Safe 256-bit SSL billing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {packages.map((pkg) => {
            const isPopular = pkg.is_popular;
            const isPurchasing = purchasingId === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative bg-slate-900 rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                  isPopular
                    ? 'border-amber-500/60 shadow-xl shadow-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-base font-bold text-white mb-1">{pkg.name}</h3>

                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-3xl font-extrabold text-white">
                      ${(pkg.price_cents / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400">USD</span>
                  </div>

                  <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Standard Credits:</span>
                      <span className="font-bold text-white">{pkg.credits}</span>
                    </div>

                    {pkg.bonus_credits > 0 && (
                      <div className="flex items-center justify-between text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Free Bonus:</span>
                        </span>
                        <span>+{pkg.bonus_credits}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 font-bold text-amber-400">
                      <span>Total Received:</span>
                      <span>{pkg.credits + (pkg.bonus_credits || 0)} Credits</span>
                    </div>
                  </div>
                </div>

                <div className="pt-5">
                  <button
                    id={`btn-purchase-package-${pkg.id}`}
                    onClick={() => handlePurchase(pkg)}
                    disabled={isPurchasing}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isPopular
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    <span>{isPurchasing ? 'Processing...' : 'Get Credits'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* IMMUTABLE TRANSACTION AUDIT LOG */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Wallet Activity &amp; Audit Log</h3>
          </div>
          <span className="text-xs text-slate-400">Latest 25 transactions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isPositive = tx.amount > 0;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-white max-w-xs truncate">
                        {tx.description || 'System operation'}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-400">
                        {tx.balance_after}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
