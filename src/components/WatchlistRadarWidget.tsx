import React, { useState } from 'react';
import { 
  Star, Eye, Flame, Gavel, ChevronDown, ChevronUp, 
  CheckCircle2, ArrowUpRight, Sparkles, AlertCircle 
} from 'lucide-react';
import { Player, AuctionState, UserProfile } from '../types';
import { formatCurrency, getPositionBadge, getPlayerAuctionDay } from '../utils/formatters';

interface WatchlistRadarWidgetProps {
  watchedPlayerIds: string[];
  players: Player[];
  auction: AuctionState;
  currentUser: UserProfile | null;
  onToggleWatch: (playerId: string) => void;
  onOpenFullWatchlist: () => void;
  onNominate?: (playerId: string) => Promise<boolean>;
}

export const WatchlistRadarWidget: React.FC<WatchlistRadarWidgetProps> = ({
  watchedPlayerIds,
  players,
  auction,
  currentUser,
  onToggleWatch,
  onOpenFullWatchlist,
  onNominate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const watchedPlayers = players.filter((p) => watchedPlayerIds.includes(p.id));

  if (watchedPlayers.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Radar de Observação: Nenhum atleta selecionado
              </h4>
              <p className="text-[11px] text-slate-500">
                Favorite atletas das 3 fases no Mercado (Seção 3) para acompanhar lances e vendas aqui em tempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenFullWatchlist}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 self-end sm:self-center"
          >
            Abrir Radar
          </button>
        </div>
      </div>
    );
  }

  const currentAuctionDay = auction.auctionDay || 1;
  const isAuctionIdle = auction.status === 'IDLE';
  const canNominate = Boolean(
    currentUser &&
      isAuctionIdle &&
      (auction.nominationTurnUserId === currentUser.id || currentUser.role === 'ADMIN' || auction.isFreeNominationMode)
  );

  const activeInAuction = auction.status === 'ACTIVE' ? auction.currentPlayer : null;
  const isCurrentWatched = activeInAuction && watchedPlayerIds.includes(activeInAuction.id);

  return (
    <div className="bg-white border border-amber-200/80 rounded-2xl shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div 
        className="px-4 py-3 bg-gradient-to-r from-amber-50 via-amber-50/50 to-white flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Star className="w-4 h-4 fill-white text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 font-['Outfit',sans-serif]">
                Meu Radar de Observação
              </h4>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                {watchedPlayers.length} {watchedPlayers.length === 1 ? 'atleta' : 'atletas'}
              </span>
              {isCurrentWatched && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                  <Flame className="w-3 h-3 fill-white" />
                  EM LEILÃO AGORA
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Acompanhe lances e status dos seus jogadores monitorados em todas as 3 fases.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullWatchlist();
            }}
            className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            Ver Todos
          </button>
          <div className="text-slate-400 p-1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Body: Horizontal scrollable cards */}
      {isExpanded && (
        <div className="p-3 sm:p-4 border-t border-amber-100 bg-amber-50/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {watchedPlayers.slice(0, 6).map((player) => {
              const posBadge = getPositionBadge(player.position);
              const playerDay = getPlayerAuctionDay(player.position);
              const isCurrentlyActive = auction.status === 'ACTIVE' && auction.currentPlayer?.id === player.id;
              const isSold = player.status === 'SOLD';
              const isDayActive = playerDay === currentAuctionDay || currentAuctionDay === 'ALL';

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-xl border text-xs transition-all flex flex-col justify-between gap-2 ${
                    isCurrentlyActive
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/50 shadow-xs'
                      : isSold
                      ? 'bg-slate-50 border-slate-200 opacity-80'
                      : 'bg-white border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${posBadge.bgClass} ${posBadge.textClass} border ${posBadge.borderClass}`}>
                        {player.position}
                      </span>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs leading-tight">
                          {player.name}
                        </h5>
                        <span className="text-[10px] text-slate-500 block">
                          Fase {playerDay}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleWatch(player.id)}
                      className="text-amber-500 hover:text-amber-700 p-1 cursor-pointer"
                      title="Remover do Radar"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    </button>
                  </div>

                  {/* Status & Price */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                    <div>
                      {isCurrentlyActive ? (
                        <span className="font-black text-rose-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                          {formatCurrency(auction.currentBid ? auction.currentBid.amount : player.initialPrice)}
                        </span>
                      ) : isSold ? (
                        <span className="font-bold text-slate-500">
                          Vendido: {player.soldTo?.amount ? formatCurrency(player.soldTo.amount) : 'Sim'}
                        </span>
                      ) : (
                        <span className="font-bold text-slate-700">
                          Base: {formatCurrency(player.initialPrice)}
                        </span>
                      )}
                    </div>

                    <div>
                      {isCurrentlyActive ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white animate-pulse">
                          AO VIVO
                        </span>
                      ) : isSold ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                          Vendido
                        </span>
                      ) : isDayActive && canNominate && onNominate ? (
                        (() => {
                          const isAuctionInProgress = auction.status !== 'NOT_STARTED' && auction.status !== 'ENDED';
                          return (
                            <button
                              type="button"
                              disabled={!isAuctionInProgress}
                              onClick={() => {
                                if (!isAuctionInProgress) return;
                                onNominate(player.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                isAuctionInProgress
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer active:scale-95'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              }`}
                              title={!isAuctionInProgress ? 'Leilão não iniciado' : 'Fazer Proposta'}
                            >
                              Fazer Proposta
                            </button>
                          );
                        })()
                      ) : (
                        <span className="text-[9px] text-slate-400 font-medium">
                          {isDayActive ? 'Aguardando' : `Fase ${playerDay}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {watchedPlayers.length > 6 && (
            <div className="mt-2.5 text-center">
              <button
                type="button"
                onClick={onOpenFullWatchlist}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 underline cursor-pointer"
              >
                Ver todos os {watchedPlayers.length} atletas em observação no Radar Completo ➔
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
