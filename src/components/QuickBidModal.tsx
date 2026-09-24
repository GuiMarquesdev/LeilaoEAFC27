import React, { useState, useEffect } from 'react';
import { 
  X, Gavel, ShieldCheck, Flame, AlertCircle, 
  Coins, Clock, Loader2, Sparkles 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Player, UserProfile, AuctionState } from '../types';
import { formatCurrency, getPositionBadge, formatAuctionTimer, getPlayerActiveBid, getPlayerEffectivePrice } from '../utils/formatters';

interface QuickBidModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  auction: AuctionState;
  availableBudget?: number;
  heldBudget?: number;
  onConfirmBid: (amount: number, playerId: string) => Promise<boolean>;
  onOpenAuth: () => void;
}

export const QuickBidModal: React.FC<QuickBidModalProps> = ({
  player,
  isOpen,
  onClose,
  currentUser,
  auction,
  availableBudget,
  heldBudget = 0,
  onConfirmBid,
  onOpenAuth,
}) => {
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [customInput, setCustomInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !player) return null;

  const badge = getPositionBadge(player.position);
  const activeBid = getPlayerActiveBid(player, auction);
  const effectivePrice = getPlayerEffectivePrice(player, auction);
  const currentHighest = activeBid ? activeBid.amount : (player.currentPrice && player.currentPrice > player.initialPrice ? player.currentPrice : 0);
  const minRequired = currentHighest > 0
    ? currentHighest + (auction.minimumBidIncrement || 1000000)
    : player.initialPrice;

  const isUserLeading = Boolean(currentUser && activeBid && activeBid.userId === currentUser.id);

  // Initialize with minRequired
  useEffect(() => {
    setBidAmount(minRequired);
    setCustomInput((minRequired / 1000000).toString());
    setErrorMessage(null);
  }, [player.id, minRequired]);

  // Handle ESC key to easily dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleQuickAdd = (incrementMillions: number) => {
    const newAmount = Math.max(minRequired, bidAmount + incrementMillions * 1000000);
    setBidAmount(newAmount);
    setCustomInput((newAmount / 1000000).toString());
    setErrorMessage(null);
  };

  const handleCustomChange = (val: string) => {
    setCustomInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setBidAmount(Math.round(num * 1000000));
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    // Note: If isUserLeading, the manager is raising their own bid (lance de proteção)
    if (bidAmount < minRequired) {
      setErrorMessage(`O valor mínimo exigido é de € ${(minRequired / 1000000).toFixed(1)}M.`);
      return;
    }

    // Se o usuário já está liderando este atleta, o valor do lance atual dele já está computado
    const alreadyCommittedOnThisPlayer = isUserLeading ? (activeBid?.amount || 0) : 0;
    const effectiveAvailableBudget = currentUser
      ? (availableBudget !== undefined ? availableBudget + alreadyCommittedOnThisPlayer : currentUser.budget)
      : 0;

    if (bidAmount > effectiveAvailableBudget) {
      if (heldBudget > 0 && availableBudget !== undefined) {
        setErrorMessage(`Saldo disponível insuficiente! Você tem € ${(currentUser.budget / 1000000).toFixed(1)}M no total, mas € ${(heldBudget / 1000000).toFixed(1)}M está retido em outros atletas. Saldo livre: € ${(effectiveAvailableBudget / 1000000).toFixed(1)}M.`);
      } else {
        setErrorMessage(`Saldo insuficiente! Seu saldo atual é de € ${(currentUser.budget / 1000000).toFixed(1)}M.`);
      }
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const ok = await onConfirmBid(bidAmount, player.id);
      if (ok) {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch {
          // ignore
        }
        onClose();
      } else {
        setErrorMessage('Não foi possível registrar a proposta. Tente novamente.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao enviar proposta');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyCommittedOnThisPlayer = isUserLeading ? (activeBid?.amount || 0) : 0;
  const effectiveAvailableBudget = currentUser
    ? (availableBudget !== undefined ? availableBudget + alreadyCommittedOnThisPlayer : currentUser.budget)
    : 0;

  const isInsufficientBudget = currentUser ? bidAmount > effectiveAvailableBudget : false;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>{activeBid ? 'Cobrir Proposta' : 'Fazer Proposta Oficial'}</span>
              </h3>
              <p className="text-[11px] text-slate-300 font-medium">
                Leilão Simultâneo • Khedira League
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player Snapshot Banner */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
            <span className={`px-2.5 py-1 rounded-xl text-xs font-black shadow-xs ${badge.bgClass} ${badge.textClass}`}>
              {player.position}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-base font-black text-slate-900 truncate">
              {player.name}
            </h4>
            <p className="text-xs text-slate-500 truncate">
              {player.nationality}
            </p>

            <div className="flex items-center gap-3 mt-1 text-[11px]">
              <span className="text-slate-500">
                Abertura: <strong className="text-slate-800 font-bold">{formatCurrency(player.initialPrice, true)}</strong>
              </span>
              {activeBid ? (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  Último: {formatCurrency(effectivePrice, true)}
                </span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  Sem propostas ainda
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body & Bidding Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Active dispute status pill */}
          {activeBid && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
              isUserLeading 
                ? 'bg-amber-50 border-amber-300 text-amber-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-rose-500 animate-pulse" />
                <div>
                  <span className="font-bold block">
                    {isUserLeading ? '👑 Você está liderando esta disputa (Pode aumentar o lance)' : 'Disputa ativa por este atleta'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    Restam: {player.timerRemaining ? formatAuctionTimer(player.timerRemaining) : '1h 30m'}
                  </span>
                </div>
              </div>
              <span className="font-black text-sm">
                {formatCurrency(effectivePrice, true)}
              </span>
            </div>
          )}

          {/* Quick Increment Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Ajuste Rápido da Proposta:
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setBidAmount(minRequired);
                  setCustomInput((minRequired / 1000000).toString());
                  setErrorMessage(null);
                }}
                className={`py-2 px-1 text-xs font-black rounded-xl border transition-all cursor-pointer text-center ${
                  bidAmount === minRequired
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Mínimo
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(1)}
                className="py-2 px-1 text-xs font-black rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer text-center"
              >
                +€ 1.0M
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(2)}
                className="py-2 px-1 text-xs font-black rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer text-center"
              >
                +€ 2.0M
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(5)}
                className="py-2 px-1 text-xs font-black rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer text-center"
              >
                +€ 5.0M
              </button>
            </div>
          </div>

          {/* Value Input Display */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Valor da sua Proposta (€ em Milhões):
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                €
              </div>
              <input
                type="number"
                step="0.5"
                min={minRequired / 1000000}
                value={customInput}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="w-full pl-8 pr-12 py-3 bg-white border-2 border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-xl font-black text-slate-900 transition-all text-center"
                placeholder="Ex: 35.0"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 font-black text-sm">
                M
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-1">
              <span>Lance mínimo: <strong className="text-slate-800">{formatCurrency(minRequired, true)}</strong></span>
              <span className="text-emerald-700 font-bold">Valor exato: {formatCurrency(bidAmount, false)}</span>
            </div>
          </div>

          {/* User Balance Check */}
          {currentUser && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  Saldo Total em Conta:
                </span>
                <span className="font-black text-slate-900">
                  {formatCurrency(currentUser.budget, true)}
                </span>
              </div>
              {heldBudget > 0 && availableBudget !== undefined && (
                <div className="flex items-center justify-between text-[11px] text-amber-800 pt-1 border-t border-slate-200/60">
                  <span>Retido em outros atletas:</span>
                  <span className="font-bold">-{formatCurrency(heldBudget, true)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                <span className="text-emerald-700 font-bold">Disponível p/ este atleta:</span>
                <span className={`font-black ${isInsufficientBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatCurrency(effectiveAvailableBudget, true)}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Anonymous bidding badge according to Ata */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Proposta sob o Regulamento Oficial da Khedira League</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || isInsufficientBudget}
              className={`flex-2 py-3 font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                isInsufficientBudget
                  ? 'bg-rose-100 text-rose-700 border border-rose-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white active:scale-98'
              } disabled:opacity-50`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : isInsufficientBudget ? (
                <span>Saldo Insuficiente</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isUserLeading
                      ? `Aumentar Proposta (${formatCurrency(bidAmount, true)})`
                      : `Confirmar Proposta (${formatCurrency(bidAmount, true)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
