import React, { useState, useMemo } from 'react';
import { 
  X, Star, Eye, Flame, Gavel, CheckCircle2, 
  Search, ArrowUpRight, User 
} from 'lucide-react';
import { Player, UserProfile, AuctionState } from '../types';
import { formatCurrency, getPositionBadge, matchesPlayerSearch, getPlayerActiveBid, getPlayerEffectivePrice, getPlayerSectorName } from '../utils/formatters';

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchedPlayerIds: string[];
  players: Player[];
  auction: AuctionState;
  currentUser: UserProfile | null;
  onToggleWatch: (playerId: string) => void;
  onNominate?: (playerId: string) => Promise<boolean>;
  onNavigateToAuction?: (playerId?: string) => void;
  onNavigateToCatalog?: () => void;
}

export const WatchlistModal: React.FC<WatchlistModalProps> = ({
  isOpen,
  onClose,
  watchedPlayerIds,
  players,
  auction,
  currentUser,
  onToggleWatch,
  onNominate,
  onNavigateToAuction,
  onNavigateToCatalog,
}) => {
  const [filterSector, setFilterSector] = useState<'ALL' | 'DEF' | 'MEI' | 'ATA'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_AUCTION' | 'AVAILABLE' | 'SOLD'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const userWonPlayersCount = currentUser
    ? players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === currentUser.id).length
    : 0;
  const isUserSquadFull = userWonPlayersCount >= 23;

  const watchedPlayers = useMemo(() => {
    return players.filter((p) => watchedPlayerIds.includes(p.id));
  }, [players, watchedPlayerIds]);

  const filteredList = useMemo(() => {
    return watchedPlayers.filter((player) => {
      if (filterSector === 'DEF' && !['GOL', 'ZAG', 'LE', 'LD'].includes(player.position)) return false;
      if (filterSector === 'MEI' && !['VOL', 'MC', 'MEI'].includes(player.position)) return false;
      if (filterSector === 'ATA' && !['ATA', 'PE', 'PD', 'ME', 'MD', 'SA'].includes(player.position)) return false;

      // Status check
      const isCurrentlyInAuction = auction.status === 'ACTIVE' && auction.currentPlayer?.id === player.id;
      if (filterStatus === 'IN_AUCTION' && !isCurrentlyInAuction) return false;
      if (filterStatus === 'SOLD' && player.status !== 'SOLD') return false;
      if (filterStatus === 'AVAILABLE' && (player.status !== 'AVAILABLE' || isCurrentlyInAuction)) return false;

      if (searchTerm.trim() && !matchesPlayerSearch(player, searchTerm)) {
        return false;
      }

      return true;
    });
  }, [watchedPlayers, filterSector, filterStatus, searchTerm, auction.status, auction.currentPlayer]);

  if (!isOpen) return null;

  const activePlayerInAuction = auction.status === 'ACTIVE' ? auction.currentPlayer : null;
  const isWatchedPlayerActiveNow = activePlayerInAuction && watchedPlayerIds.includes(activePlayerInAuction.id);

  const canNominateNow = Boolean(
    currentUser &&
    (auction.status === 'IDLE' || auction.status === 'ACTIVE')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl lg:max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between relative overflow-hidden">
          <div className="z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-['Outfit',sans-serif] tracking-tight">
                Radar de Observação de Jogadores
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/20 text-white">
                {watchedPlayerIds.length} Atletas
              </span>
            </div>
            <p className="text-xs text-amber-100 font-medium">
              Monitore em tempo real se seus craques favoritos estão recebendo propostas ou foram leiloados.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Banner Alert if an observed player is currently under bidding */}
        {isWatchedPlayerActiveNow && activePlayerInAuction && (
          <div className="bg-rose-50 border-b border-rose-200 p-4 flex items-center justify-between gap-3 text-rose-900 animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 fill-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                  Atenção: Atleta do seu Radar em Leilão!
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                  {activePlayerInAuction.name} ({activePlayerInAuction.position}) — Disputa Aberta
                </span>
              </div>
            </div>

            {onNavigateToAuction && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToAuction();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span>Ir para o Leilão</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sector Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200 text-xs overflow-x-auto">
            <button
              onClick={() => setFilterSector('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                filterSector === 'ALL' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({watchedPlayers.length})
            </button>
            <button
              onClick={() => setFilterSector('DEF')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                filterSector === 'DEF' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Defesa & GOL ({watchedPlayers.filter((p) => ['GOL', 'ZAG', 'LE', 'LD'].includes(p.position)).length})
            </button>
            <button
              onClick={() => setFilterSector('MEI')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                filterSector === 'MEI' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Meio-Campo ({watchedPlayers.filter((p) => ['VOL', 'MC', 'MEI'].includes(p.position)).length})
            </button>
            <button
              onClick={() => setFilterSector('ATA')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                filterSector === 'ATA' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ataque ({watchedPlayers.filter((p) => ['ATA', 'PE', 'PD', 'ME', 'MD', 'SA'].includes(p.position)).length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar nos observados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
            />
          </div>
        </div>

        {/* Players List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 px-4">
              <h3 className="text-base font-bold text-slate-800">
                {watchedPlayerIds.length === 0 ? 'Nenhum jogador em observação ainda' : 'Nenhum jogador encontrado com os filtros selecionados'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
                {watchedPlayerIds.length === 0 ? (
                  <>
                    Você pode marcar qualquer atleta no Mercado de Craques para acompanhar em tempo real quando receberem propostas!
                  </>
                ) : (
                  'Tente alterar os filtros de setor ou limpar o campo de busca.'
                )}
              </p>

              {onNavigateToCatalog && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToCatalog();
                  }}
                  className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Explorar Mercado de Craques</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr items-stretch">
              {filteredList.map((player) => {
                const posBadge = getPositionBadge(player.position);
                const sectorName = getPlayerSectorName(player.position);
                const isCurrentlyActive = (auction.status === 'ACTIVE' && auction.currentPlayer?.id === player.id) || player.status === 'IN_AUCTION';
                const isSold = player.status === 'SOLD';
                const isAvailable = player.status === 'AVAILABLE';
                const playerActiveBid = isCurrentlyActive ? getPlayerActiveBid(player, auction) : null;
                const playerEffectivePrice = getPlayerEffectivePrice(player, auction);

                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      onClose();
                      onNavigateToAuction?.(player.id);
                    }}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 relative cursor-pointer select-none group active:scale-[0.99] h-full ${
                      isCurrentlyActive
                        ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/50 shadow-md hover:border-rose-500 hover:shadow-lg hover:bg-rose-100/50'
                        : isSold
                        ? 'bg-slate-50 border-slate-200 opacity-90 hover:border-slate-400 hover:shadow-sm'
                        : 'bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 hover:shadow-md'
                    }`}
                    title={`Clique para ir direto ao card de lances de ${player.name} no leilão`}
                  >
                    {/* Top Row: Name, Position & Sector Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                            <User className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                          </div>
                          <span className={`absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${posBadge.bgClass} ${posBadge.textClass} border ${posBadge.borderClass}`}>
                            {player.position}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors leading-tight truncate max-w-[200px]">
                              {player.name}
                            </h4>
                            {player.isManualExtra && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-800 rounded font-bold shrink-0">
                                Extra
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 truncate">
                            <span className="truncate">{player.club}</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-semibold text-slate-700 shrink-0">{sectorName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Remove from observation button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatch(player.id);
                        }}
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-100/80 transition-colors cursor-pointer shrink-0"
                        title="Remover do Radar de Observação"
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                      </button>
                    </div>

                    {/* Mid: Status Indicator & Navigation Hint */}
                    <div className="flex items-center justify-between text-xs py-1 border-t border-b border-slate-100 my-0.5 min-h-[32px]">
                      {isCurrentlyActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white flex items-center gap-1 animate-pulse shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                          EM LEILÃO AGORA
                        </span>
                      ) : isSold ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          VENDIDO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                          🟢 Disponível no Leilão
                        </span>
                      )}

                      <span className="text-[10px] font-bold text-amber-600 group-hover:text-amber-800 flex items-center gap-1 transition-colors shrink-0">
                        <span>Ir direto ao card</span>
                        <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </span>
                    </div>

                    {/* Bottom: Pricing & Action */}
                    <div className="bg-slate-50/90 p-3 rounded-xl flex items-center justify-between gap-3 border border-slate-100 mt-auto min-h-[62px]">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-slate-500 font-medium block leading-none mb-1">
                          {isCurrentlyActive ? 'Lance no momento:' : isSold ? 'Arrematado por:' : 'Preço Base:'}
                        </span>
                        <div className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                          {isCurrentlyActive
                            ? formatCurrency(playerEffectivePrice)
                            : isSold && player.soldTo
                            ? formatCurrency(player.soldTo.amount)
                            : formatCurrency(player.initialPrice)}
                        </div>
                        {isSold && player.soldTo && (
                          <span className="text-[10px] text-emerald-700 font-bold block truncate max-w-[150px] mt-0.5">
                            Comprador: {player.soldTo.teamName}
                          </span>
                        )}
                        {isCurrentlyActive && playerActiveBid && (
                          <span className="text-[10px] text-rose-700 font-bold block truncate max-w-[150px] mt-0.5">
                            Maior lance: {auction.anonymousBidding !== false
                              ? (playerActiveBid.userId === currentUser?.id ? '***** (Você)' : '*****')
                              : (playerActiveBid.teamName || 'Clube')}
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      {isCurrentlyActive ? (
                        isUserSquadFull ? (
                          <span className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200 text-slate-500 shrink-0" title="Limite de 23 jogadores no elenco atingido">
                            Elenco 23/23
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onNavigateToAuction?.(player.id);
                            }}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                            title="Ir diretamente para a disputa e dar lance"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            <span>Dar Lance</span>
                          </button>
                        )
                      ) : isAvailable && canNominateNow && onNominate ? (
                        (() => {
                          const isQueued = auction.nominationQueue?.some((q) => q.player.id === player.id);
                          if (isQueued) {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose();
                                  onNavigateToAuction?.(player.id);
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                title="Ver card na fila de leilão"
                              >
                                <span>📋 Na Fila</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            );
                          }
                          if (isUserSquadFull) {
                            return (
                              <span className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200 text-slate-500 shrink-0" title="Limite de 23 jogadores no elenco atingido">
                                Elenco 23/23
                              </span>
                            );
                          }
                          const isAuctionInProgress = auction.status !== 'NOT_STARTED' && auction.status !== 'ENDED';
                          return (
                            <button
                              type="button"
                              disabled={!isAuctionInProgress}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuctionInProgress) {
                                  onClose();
                                  onNavigateToAuction?.(player.id);
                                  return;
                                }
                                onNominate(player.id);
                                onClose();
                                onNavigateToAuction?.(player.id);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                                isAuctionInProgress
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer'
                              }`}
                              title={
                                !isAuctionInProgress
                                  ? "Ver card de lances deste atleta no leilão"
                                  : "Fazer Proposta para este jogador e ir ao card"
                              }
                            >
                              <Gavel className="w-3 h-3" />
                              <span>{isAuctionInProgress ? 'Fazer Proposta' : 'Ver Card'}</span>
                            </button>
                          );
                        })()
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onNavigateToAuction?.(player.id);
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                          title="Abrir card deste atleta no leilão"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver Card</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {watchedPlayers.length} atletas sob monitoramento
          </div>
          <button
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
