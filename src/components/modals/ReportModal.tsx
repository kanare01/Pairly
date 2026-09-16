import React, { useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { X, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  targetType?: string;
  targetId?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  targetType = 'PROFILE',
  targetId,
}) => {
  const [reason, setReason] = useState('HARASSMENT');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.submitReport({
        target_user_id: targetUser.id,
        target_type: targetType,
        target_id: targetId || targetUser.id,
        reason,
        details: details.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6">
        <button
          id="btn-close-report-modal"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 items-center justify-center mb-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Report User</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Reporting <span className="font-semibold text-rose-400">{targetUser.display_name}</span>
          </p>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-base font-semibold text-white">Report Submitted</p>
            <p className="text-xs text-slate-400">
              Our safety and moderation team reviews reports 24/7. Thank you for keeping Pairly safe.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Report</label>
              <select
                id="select-report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
              >
                <option value="HARASSMENT">Harassment or abusive behavior</option>
                <option value="UNDERAGE_SUSPECT">Suspected underage user (Strictly 18+)</option>
                <option value="INAPPROPRIATE_MEDIA">Non-consensual or illegal media</option>
                <option value="SCAM_FINANCIAL">Financial scam or fraud</option>
                <option value="IMPERSONATION">Impersonation or fake profile</option>
                <option value="SPAM">Spam or unwanted advertising</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Additional Details <span className="text-slate-500">(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Provide context or specific messages that violate our safety policies..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition-colors resize-none"
              />
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-submit-report"
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
