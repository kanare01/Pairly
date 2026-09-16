import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Gift, User } from '../../types';
import { X, Gift as GiftIcon, Coins, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface SendGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiver: User | null;
  onSuccess?: () => void;
  onNeedCredits?: () => void;
}

export const SendGiftModal: React.FC<SendGiftModalProps> = ({
  isOpen,
  onClose,
  receiver,
  onSuccess,
  onNeedCredits,
}) => {
  const { wallet, refreshWallet } = useAuth();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSentSuccess(false);
      api.getGifts().then((res) => {
        setGifts(res.gifts);
        if (res.gifts.length > 0) {
          setSelectedGiftId(res.gifts[0].id);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen || !receiver) return null;

  const selectedGift = gifts.find((g) => g.id === selectedGiftId);
  const canAfford = wallet && selectedGift ? wallet.balance >= selectedGift.credit_price : false;

  const handleSend = async () => {
    if (!selectedGift) return;
    if (!canAfford) {
      if (onNeedCredits) {
        onClose();
        onNeedCredits();
      } else {
        setError('Insufficient credits. Please add credits to your wallet.');
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.sendGift(receiver.id, selectedGift.id, message.trim() || undefined);
      await refreshWallet();
      setSentSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send gift.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6">
        <button
          id="btn-close-gift-modal"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 items-center justify-center mb-2">
            <GiftIcon className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Send Virtual Gift</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            to <span className="font-semibold text-rose-400">{receiver.display_name}</span>
          </p>
        </div>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <p className="text-base font-semibold text-white">Gift Delivered!</p>
            <p className="text-xs text-slate-400">
              {receiver.display_name} received your {selectedGift?.name}!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* GIFTS GRID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Choose a Gift</label>
              <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {gifts.map((g) => {
                  const isSelected = selectedGiftId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGiftId(g.id)}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between ${
                        isSelected
                          ? 'bg-rose-500/15 border-rose-500 shadow-md shadow-rose-500/20'
                          : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl mb-1">
                        {g.icon_name === 'rose'
                          ? '🌹'
                          : g.icon_name === 'chocolate'
                          ? '🍫'
                          : g.icon_name === 'champagne'
                          ? '🍾'
                          : g.icon_name === 'diamond'
                          ? '💎'
                          : g.icon_name === 'teddy_bear'
                          ? '🧸'
                          : '🎁'}
                      </span>
                      <span className="text-xs font-semibold text-white line-clamp-1">{g.name}</span>
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Coins className="w-3 h-3" />
                        <span>{g.credit_price}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DEDICATION NOTE */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Personal Note <span className="text-slate-500">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="A little something to make you smile..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            {/* FOOTER ACTION */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-slate-400">Wallet balance: </span>
                <span className="font-bold text-amber-400">{wallet?.balance || 0} credits</span>
              </div>

              {canAfford ? (
                <button
                  id="btn-confirm-send-gift"
                  type="button"
                  disabled={loading}
                  onClick={handleSend}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send Gift ({selectedGift?.credit_price} credits)</span>
                </button>
              ) : (
                <button
                  id="btn-get-credits-gift"
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNeedCredits) onNeedCredits();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-lg transition-all"
                >
                  Add Credits to Send
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
