import React, { useEffect, useState } from 'react';
import { 
  X, Gavel, Clock, Flame, Star, DollarSign, Crown, Lock, 
  CheckCircle2, AlertTriangle, ArrowUpRight, Zap, Eye, Shield, Users
} from 'lucide-react';
import { Player, UserProfile, AuctionState, Bid } from '../types';
import { 
  formatCurrency, getPositionBadge, formatAuctionTimer, 
  getPlayerActiveBid, getPlayerEffectivePrice, isPositionAllowedForDay, getDayLabel
} from '../utils/formatters';
import { JudgeGavelIcon } from './JudgeGavelIcon';

interface PlayerDetailsModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  auction: AuctionState;
  users: UserProfile[];
  isWatched?: boolean;
  onToggleWatch?: (playerId: string) => void;
  onNominate?: (playerId: string, initialAmount?: number) => Promise<boolean>;
  onBid?: (amount: number, playerId?: string) => Promise<boolean>;
  onOpenAuth: () => void;
  isUserSquadFull?: boolean;
  onFocusInAuction?: (playerId: string) => void;
}

export const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({
  player,
  isOpen,
  onClose,
  currentUser,
  auction,
  users,
  isWatched = false,
  onToggleWatch,
  onNominate,
  onBid,
  onOpenAuth,
  isUserSquadFull = false,
  onFocusInAuction
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [bidError, setBidError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !player) return null;

  const badge = getPositionBadge(player.position);
  const activeBid = getPlayerActiveBid(player, auction);
  const effectivePrice = getPlayerEffectivePrice(player, auction);
  const isInAuction = player.status === 'IN_AUCTION' || auction.currentPlayer?.id === player.id;
  const isSold = player.status === 'SOLD';
  const isQueued = auction.nominationQueue?.some((q) => q.player.id === player.id);
  const timer = player.timerRemaining ?? (auction.currentPlayer?.id === player.id ? auction.timerRemaining : 5400);

  // Collect and sort all bids for this specific player
  const allPlayerBids: Bid[] = (() => {
    const map = new Map<string, Bid>();
    (player.bidHistory || []).forEach((b) => {
      if (b && b.id) map.set(b.id, b);
    });
    (auction.bidHistory || []).forEach((b) => {
      if (b && b.playerId === player.id && b.id) {
        map.set(b.id, b);
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  })();

  const isUserLeading = activeBid?.userId === currentUser?.id;
  const hasUserBid = allPlayerBids.some((b) => b.userId === currentUser?.id);
  const isUserOutbid = hasUserBid && !isUserLeading && isInAuction;

  const minNextBid = activeBid ? activeBid.amount + 1000000 : player.initialPrice;

  const handleQuickBid = async (increment: number) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const targetAmount = (activeBid ? activeBid.amount : effectivePrice) + increment;
    setIsSubmitting(true);
    setBidError(null);
    try {
      if (onBid) {
        const ok = await onBid(targetAmount, player.id);
        if (ok) {
          onClose();
        }
      }
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : 'Falha ao enviar lance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNominateClick = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (isUserSquadFull) return;
    setIsSubmitting(true);
    try {
      if (onNominate) {
        const ok = await onNominate(player.id);
        if (ok) {
          onClose();
        }
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex items-start justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center font-black shadow-md shrink-0">
              <span className="text-[10px] text-amber-400 font-extrabold uppercase">EAFC 27</span>
              <span className="text-base tracking-wider text-white font-mono">{player.position}</span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-0.5 text-xs font-black rounded-md ${badge.bgClass} ${badge.textClass}`}>
                  {player.position}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {player.club || 'Clube Oficial'}
                </span>
                {isInAuction && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                    <Flame className="w-3 h-3 text-rose-400" />
                    <span>AO VIVO NO LEILÃO</span>
                  </span>
                )}
                {isSold && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    CONTRATADO
                  </span>
                )}
                {isQueued && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    NA FILA DE ESPERA
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {player.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleWatch && (
              <button
                type="button"
                onClick={() => onToggleWatch(player.id)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isWatched
                    ? 'bg-amber-500/20 text-amber-400 border-amber-400/40 hover:bg-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title={isWatched ? 'Remover dos favoritos' : 'Favoritar no Radar de Observação'}
              >
                <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Outbid Alert if applicable */}
          {isUserOutbid && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-950 font-semibold shadow-xs animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Seu lance foi superado!</strong> Outro clube ofereceu mais por este jogador.
                </span>
              </div>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => handleQuickBid(1000000)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Cobrir (+1M)</span>
                </button>
              )}
            </div>
          )}

          {/* Leading Alert if user is currently highest bidder */}
          {isUserLeading && isInAuction && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-2 text-xs text-emerald-950 font-semibold shadow-2xs">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Você está vencendo!</strong> Sua proposta de {formatCurrency(effectivePrice)} é a mais alta.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900 shrink-0">
                Liderando
              </span>
            </div>
          )}

          {/* Pricing & Auction Status Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Preço Base / Inicial
              </span>
              <span className="text-base sm:text-lg font-black text-slate-800">
                {formatCurrency(player.initialPrice, true)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                {isInAuction ? 'Maior Proposta Atual' : isSold ? 'Valor Final' : 'Cotação de Mercado'}
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-700">
                {formatCurrency(effectivePrice)}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                {isInAuction ? 'Tempo de Disputa' : 'Situação do Atleta'}
              </span>
              {isInAuction ? (
                <div className="flex items-center gap-1.5 font-bold text-amber-700 mt-0.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="font-mono text-base font-black">{formatAuctionTimer(timer)}</span>
                </div>
              ) : isSold ? (
                <span className="font-bold text-emerald-700 block mt-0.5">
                  Vendido ({player.soldTo?.teamName || player.soldTo?.userName})
                </span>
              ) : isQueued ? (
                <span className="font-bold text-amber-700 block mt-0.5">
                  Fila de Espera (1h30m)
                </span>
              ) : (
                <span className="font-bold text-slate-700 block mt-0.5">
                  Disponível para Postar
                </span>
              )}
            </div>
          </div>

          {/* Action Center: Bid, Nominate or Focus */}
          {isInAuction ? (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  <span>Dar Lance Imediato</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-700">
                  Mínimo: {formatCurrency(minNextBid, true)}
                </span>
              </div>

              {currentUser ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickBid(1000000)}
                    disabled={isSubmitting}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>+€ 1.0M</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickBid(2000000)}
                    disabled={isSubmitting}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>+€ 2.0M</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickBid(5000000)}
                    disabled={isSubmitting}
                    className="flex-1 min-w-[100px] py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>+€ 5.0M</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Entrar com Gmail para dar lance
                </button>
              )}

              {onFocusInAuction && (
                <button
                  type="button"
                  onClick={() => onFocusInAuction(player.id)}
                  className="w-full py-2 bg-white hover:bg-emerald-100/70 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Focar este Jogador no Painel do Leilão</span>
                </button>
              )}
            </div>
          ) : !isSold ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <JudgeGavelIcon className="w-4 h-4 text-emerald-600" />
                  <span>Iniciar Disputa deste Atleta</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Abre uma janela de leilão de 1 hora e 30 minutos aberta para todos os clubes da liga.
                </p>
              </div>

              {currentUser ? (
                isUserSquadFull ? (
                  <span className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-xl shrink-0 cursor-not-allowed">
                    Elenco Cheio (23/23)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleNominateClick}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    Postar Jogador no Leilão
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Entrar p/ Postar
                </button>
              )}
            </div>
          ) : null}

          {/* HISTÓRICO COMPLETO DE LANCES DESTE JOGADOR */}
          <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Histórico de Lances ({allPlayerBids.length})</span>
              </h4>
              {auction.anonymousBidding !== false && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Sigilo Ativo
                </span>
              )}
            </div>

            {allPlayerBids.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {allPlayerBids.map((bid, index) => {
                  const isMyBid = bid.userId === currentUser?.id;
                  const bidderUser = users.find((u) => u.id === bid.userId);
                  const isFirst = index === 0;

                  return (
                    <div
                      key={bid.id || index}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                        isFirst
                          ? 'bg-emerald-50/80 border-emerald-200 font-semibold'
                          : 'bg-slate-50 border-slate-150 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isFirst ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          #{allPlayerBids.length - index}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {auction.anonymousBidding !== false && !isMyBid && currentUser?.role !== 'ADMIN' ? (
                              <span className="font-mono text-slate-600 font-bold flex items-center gap-1 text-[11px]">
                                <Lock className="w-3 h-3 text-emerald-600" />
                                <span>*****</span>
                                <span className="text-[10px] text-slate-400 font-normal">(Sigilo)</span>
                              </span>
                            ) : (
                              <span className="font-bold text-slate-900 truncate">
                                {isMyBid ? 'Você' : (bid.userName || bidderUser?.name || 'Clube')}
                                {bid.teamName && !isMyBid && (
                                  <span className="text-slate-400 font-normal ml-1">({bid.teamName})</span>
                                )}
                              </span>
                            )}

                            {isMyBid && (
                              <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-emerald-100 text-emerald-800">
                                Seu Lance
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {bid.timestamp ? new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Hora registrada'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-emerald-700 text-xs sm:text-sm block">
                          {formatCurrency(bid.amount)}
                        </span>
                        {isFirst && (
                          <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wide">
                            Maior Proposta
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <JudgeGavelIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  Nenhum lance registrado para este atleta ainda.
                </p>
                <p className="text-[11px] text-slate-500">
                  Seja o primeiro a postar e disputar este craque para reforçar o seu elenco!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
