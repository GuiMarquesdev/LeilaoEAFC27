import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, ArrowUpDown, Flame, Gavel, 
  CheckCircle2, Lock, Sparkles, ExternalLink, X, ShieldAlert, ShieldCheck, Calendar, Star, Eye,
  Clock, TrendingUp, ArrowRight, Radio, Coins
} from 'lucide-react';
import { Player, UserProfile, AuctionState, UserSquad } from '../types';
import { 
  formatCurrency, formatAuctionTimer, getPositionBadge, getPositionCategory, 
  isPositionAllowedForDay, getDayLabel, getPlayerAuctionDay, matchesPlayerSearch 
} from '../utils/formatters';
import { QuickBidModal } from './QuickBidModal';

type StatusFilterType = 'ALL' | 'AVAILABLE' | 'SOLD' | 'IN_AUCTION' | 'WITH_PROPOSAL' | 'IN_QUEUE';

interface PlayerCatalogSectionProps {
  players: Player[];
  currentUser: UserProfile | null;
  userSquad?: UserSquad | null;
  auction: AuctionState;
  watchedPlayerIds?: string[];
  onToggleWatch?: (playerId: string) => void;
  onOpenWatchlist?: () => void;
  onNominate: (playerId: string, initialAmount?: number) => Promise<boolean>;
  onBid?: (amount: number, playerId?: string) => Promise<boolean>;
  onViewPreview: (player: Player) => Promise<void> | void;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onNavigateToSquad: () => void;
  onNavigateToAuction?: () => void;
}

export const PlayerCatalogSection: React.FC<PlayerCatalogSectionProps> = ({
  players,
  currentUser,
  userSquad,
  auction,
  watchedPlayerIds = [],
  onToggleWatch,
  onOpenWatchlist,
  onNominate,
  onBid,
  onViewPreview,
  onOpenAuth,
  onOpenAdmin,
  onNavigateToSquad,
  onNavigateToAuction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewScope, setViewScope] = useState<'DAY_ONLY' | 'WATCHED_ONLY' | 'ALL_PHASES'>('DAY_ONLY');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'GOL' | 'DEF' | 'MEI' | 'ATA'>('ALL');
  const [exactPositionFilter, setExactPositionFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [sortField, setSortField] = useState<'name' | 'initialPrice' | 'currentValue' | 'position' | 'status'>('currentValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayerForBid, setSelectedPlayerForBid] = useState<Player | null>(null);
  const itemsPerPage = 20;

  const currentAuctionDay = auction.auctionDay || 1;
  const currentDayInfo = getDayLabel(currentAuctionDay);

  const userWonPlayersCount = currentUser
    ? players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === currentUser.id).length
    : 0;
  const isUserSquadFull = userWonPlayersCount >= 23;

  // Total players allowed for the active day
  const dayPlayers = useMemo(() => {
    return players.filter((p) => isPositionAllowedForDay(p.position, currentAuctionDay));
  }, [players, currentAuctionDay]);

  // Scoped players based on view mode (Day Only vs Watched Only vs All Phases)
  const scopedPlayers = useMemo(() => {
    if (viewScope === 'WATCHED_ONLY') {
      return players.filter((p) => watchedPlayerIds.includes(p.id));
    }
    // If user is actively searching, search across all phases so they can find any player
    if (viewScope === 'ALL_PHASES' || searchTerm.trim().length > 0) {
      return players;
    }
    return dayPlayers;
  }, [players, viewScope, watchedPlayerIds, dayPlayers, searchTerm]);

  const handleFilterByPosition = (pos: string) => {
    if (exactPositionFilter === pos) {
      setExactPositionFilter(null);
    } else {
      setExactPositionFilter(pos);
      setCategoryFilter('ALL');
      setCurrentPage(1);
    }
  };

  const getPlayerCurrentValue = (p: Player): number => {
    if ((p.status === 'IN_AUCTION' || auction.currentPlayer?.id === p.id) && auction.currentBid) {
      return auction.currentBid.amount;
    }
    if (p.status === 'SOLD' && p.soldTo) {
      return p.soldTo.amount;
    }
    return p.initialPrice;
  };

  // Filter & sort logic
  const filteredPlayers = useMemo(() => {
    return scopedPlayers
      .filter((player) => {
        // Exact position filter if clicked directly
        if (exactPositionFilter && player.position !== exactPositionFilter) {
          return false;
        }

        // Search using intelligent matcher (supports abbreviations like "T. Courtois", accents, etc.)
        if (searchTerm.trim() && !matchesPlayerSearch(player, searchTerm)) {
          return false;
        }

        // Position category
        if (categoryFilter !== 'ALL') {
          if (getPositionCategory(player.position) !== categoryFilter) {
            return false;
          }
        }

        // Status & Proposal filter
        if (statusFilter === 'AVAILABLE') {
          if (player.status !== 'AVAILABLE') return false;
        } else if (statusFilter === 'SOLD') {
          if (player.status !== 'SOLD') return false;
        } else if (statusFilter === 'IN_AUCTION') {
          if (player.status !== 'IN_AUCTION' && auction.currentPlayer?.id !== player.id) return false;
        } else if (statusFilter === 'WITH_PROPOSAL') {
          const hasActiveBid = (player.status === 'IN_AUCTION' || auction.currentPlayer?.id === player.id) && !!auction.currentBid;
          const isSoldWithBid = player.status === 'SOLD' && !!player.soldTo;
          if (!hasActiveBid && !isSoldWithBid) return false;
        } else if (statusFilter === 'IN_QUEUE') {
          const isQueued = auction.nominationQueue?.some((q) => q.player.id === player.id);
          if (!isQueued) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === 'name') {
          comp = a.name.localeCompare(b.name);
        } else if (sortField === 'initialPrice') {
          comp = a.initialPrice - b.initialPrice;
        } else if (sortField === 'currentValue') {
          comp = getPlayerCurrentValue(a) - getPlayerCurrentValue(b);
        } else if (sortField === 'position') {
          comp = a.position.localeCompare(b.position);
        } else if (sortField === 'status') {
          comp = a.status.localeCompare(b.status);
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [scopedPlayers, searchTerm, categoryFilter, exactPositionFilter, statusFilter, sortField, sortOrder, auction]);

  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage) || 1;
  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (field: 'name' | 'initialPrice' | 'currentValue' | 'position' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const isAuctionIdle = auction.status === 'IDLE';
  const isAuctionActive = auction.status === 'ACTIVE';

  const isPlayerInSquad = (playerId: string): boolean => {
    if (!userSquad) return false;
    const isStarter = Object.values(userSquad.starterSlots || {}).includes(playerId);
    const isBench = (userSquad.benchPlayerIds || []).includes(playerId);
    return isStarter || isBench;
  };

  return (
    <div className="space-y-6">
      {/* Active Phase & Strict Anti-Cheat Rule Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Regulamento em Vigor • Anti-Burla
              </span>
              <span className="text-xs font-bold text-emerald-300">
                {currentDayInfo.title}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Mercado Restrito à Posição do Dia ({dayPlayers.length} Atletas Liberados)
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Para impedir que participantes burlem as regras ou deem lances fora do setor estabelecido, o mercado oficial só exibe e disponibiliza para negociação os jogadores da fase ativa: <strong className="text-emerald-300 font-bold">{currentDayInfo.positions.join(', ')}</strong>. Atletas de outras posições permanecem ocultos até o seu respectivo dia de leilão.
            </p>
          </div>
        </div>
      </div>

      {/* Live Auction Movement Alert Banner */}
      {auction.currentPlayer && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 rounded-2xl p-0.5 shadow-md animate-in fade-in">
          <div className="bg-slate-950/95 rounded-[14px] p-3.5 sm:p-4 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-ping" />
                    Leilão Ao Vivo
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    {auction.currentPlayer.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                    {auction.currentPlayer.position}
                  </span>
                  <span className="text-xs text-slate-400">
                    Preço Base: {formatCurrency(auction.currentPlayer.initialPrice)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                  {auction.currentBid ? (
                    <>
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Tem Proposta Ativa: {formatCurrency(auction.currentBid.amount)}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-300/90 font-semibold">
                        Ágio: +{formatCurrency(auction.currentBid.amount - auction.currentPlayer.initialPrice, true)}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300 font-medium">
                        {auction.currentBid.userId === currentUser?.id ? (
                          <strong className="text-emerald-400 font-black">Você está liderando a disputa!</strong>
                        ) : auction.anonymousBidding ? (
                          <span className="text-slate-400 italic">Proposta Sigilosa (Ata Oficial)</span>
                        ) : (
                          <span>Liderado por <strong className="text-white">{auction.currentBid.teamName}</strong></span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Sem propostas ainda — Aguardando primeiro lance de {formatCurrency(auction.currentPlayer.initialPrice)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 self-stretch md:self-auto justify-between md:justify-end border-t border-slate-800 md:border-t-0 pt-2.5 md:pt-0">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tempo Restante</span>
                <span className="text-sm font-black text-amber-400 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {formatAuctionTimer(auction.timerRemaining)}
                </span>
              </div>
              {onNavigateToAuction && (
                <button
                  type="button"
                  onClick={onNavigateToAuction}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>Dar Lance / Acompanhar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Scope Tabs: Fase Atual vs Meu Radar vs Todas as 3 Fases */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-100 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setViewScope('DAY_ONLY');
              setCategoryFilter('ALL');
              setExactPositionFilter(null);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              viewScope === 'DAY_ONLY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Fase Ativa: {currentDayInfo.title}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              viewScope === 'DAY_ONLY' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {dayPlayers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewScope('WATCHED_ONLY');
              setCategoryFilter('ALL');
              setExactPositionFilter(null);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              viewScope === 'WATCHED_ONLY'
                ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-300'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Star className={`w-4 h-4 ${watchedPlayerIds.length > 0 ? 'fill-amber-400 text-amber-950' : 'text-slate-500'}`} />
            <span>Meu Radar de Observação</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              viewScope === 'WATCHED_ONLY' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {watchedPlayerIds.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewScope('ALL_PHASES');
              setCategoryFilter('ALL');
              setExactPositionFilter(null);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              viewScope === 'ALL_PHASES'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Todas as 3 Fases (Explorar & Monitorar)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              viewScope === 'ALL_PHASES' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {players.length}
            </span>
          </button>
        </div>

        {onOpenWatchlist && (
          <button
            type="button"
            onClick={onOpenWatchlist}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Abrir Central do Radar com filtros por fase"
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>Abrir Painel do Radar</span>
          </button>
        )}
      </div>

      {/* Header & Stats Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 rounded">
                Seção 3
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {viewScope === 'WATCHED_ONLY'
                  ? 'Meu Radar de Observação — Jogadores Selecionados'
                  : viewScope === 'ALL_PHASES'
                  ? 'Catálogo Geral — Todas as 3 Fases (125+ Jogadores)'
                  : `Mercado de Craques (EAFC 27) — ${currentDayInfo.title}`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {viewScope === 'WATCHED_ONLY'
                ? 'Monitore os atletas que você marcou como favoritos. Fique de olho nos lances e nas fases de cada um.'
                : viewScope === 'ALL_PHASES'
                ? 'Explore e marque atletas das 3 fases para colocar em observação com antecedência.'
                : 'Consulte os craques da posição do dia, preços de abertura para lance inicial e situação no leilão.'}
            </p>
          </div>
        </div>

        {/* Controls, Filters & Search */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={`Buscar em ${scopedPlayers.length} atletas...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
            />
          </div>

          {/* Position Group Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-medium">
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setExactPositionFilter(null);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === 'ALL' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos da Fase ({dayPlayers.length})
            </button>

            {currentAuctionDay === 1 && (
              <>
                <button
                  onClick={() => {
                    setCategoryFilter('GOL');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'GOL' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Goleiros (GOL)
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('DEF');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'DEF' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Zagueiros & Laterais
                </button>
              </>
            )}

            {currentAuctionDay === 2 && (
              <>
                <button
                  onClick={() => handleFilterByPosition('VOL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    exactPositionFilter === 'VOL' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Volantes (VOL)
                </button>
                <button
                  onClick={() => handleFilterByPosition('MC')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    exactPositionFilter === 'MC' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Meias Centrais (MC)
                </button>
                <button
                  onClick={() => handleFilterByPosition('MEI')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    exactPositionFilter === 'MEI' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Armadores (MEI)
                </button>
              </>
            )}

            {currentAuctionDay === 3 && (
              <>
                <button
                  onClick={() => handleFilterByPosition('ATA')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    exactPositionFilter === 'ATA' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Centroavantes (ATA)
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('ATA');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'ATA' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pontas & Ofensivos
                </button>
              </>
            )}

            {currentAuctionDay === 'ALL' && (
              <>
                <button
                  onClick={() => {
                    setCategoryFilter('GOL');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'GOL' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Goleiros
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('DEF');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'DEF' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Defesa
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('MEI');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'MEI' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Meio
                </button>
                <button
                  onClick={() => {
                    setCategoryFilter('ATA');
                    setExactPositionFilter(null);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    categoryFilter === 'ATA' && !exactPositionFilter ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ataque
                </button>
              </>
            )}

            {exactPositionFilter && (
              <button
                onClick={() => setExactPositionFilter(null)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer animate-in fade-in"
                title="Clique para remover filtro de posição"
              >
                <span>Filtro: {exactPositionFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilterType);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="ALL">Status: Todos ({scopedPlayers.length})</option>
              <option value="WITH_PROPOSAL">🔥 Com Proposta / Lances</option>
              <option value="IN_AUCTION">🟡 Em Leilão Agora</option>
              <option value="IN_QUEUE">📋 Na Fila de Espera</option>
              <option value="AVAILABLE">🟢 Apenas Disponíveis</option>
              <option value="SOLD">🔒 Vendidos / Arrematados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 select-none">
                <th className="py-3.5 px-3 w-10 text-center">
                  <span title="Radar de Observação">⭐</span>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Jogador</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('position')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Posição</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3">
                  <span>Fase</span>
                </th>
                <th
                  onClick={() => toggleSort('initialPrice')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Preço Base</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('currentValue')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors min-w-[220px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Proposta & Último Lance</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Situação</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPlayers.length > 0 ? (
                paginatedPlayers.map((player) => {
                  const badge = getPositionBadge(player.position);
                  const isAvailable = player.status === 'AVAILABLE';
                  const isInAuction = player.status === 'IN_AUCTION' || auction.currentPlayer?.id === player.id;
                  const isSold = player.status === 'SOLD';
                  const isWatched = watchedPlayerIds.includes(player.id);
                  const playerDay = getPlayerAuctionDay(player.position);
                  const isAllowedToday = isPositionAllowedForDay(player.position, currentAuctionDay);

                  const activeBid = isInAuction 
                    ? (player.currentBid || (auction.currentPlayer?.id === player.id ? auction.currentBid : null)) 
                    : null;
                  const playerTimerRemaining = player.timerRemaining ?? (auction.currentPlayer?.id === player.id ? auction.timerRemaining : 86400);
                  const queueIndex = auction.nominationQueue?.findIndex((q) => q.player.id === player.id) ?? -1;
                  const isQueued = queueIndex !== -1;
                  const queueItem = isQueued && auction.nominationQueue ? auction.nominationQueue[queueIndex] : null;

                  return (
                    <tr
                      key={player.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isInAuction 
                          ? 'bg-rose-50/30 font-medium' 
                          : isWatched 
                          ? 'bg-amber-50/20' 
                          : ''
                      }`}
                    >
                      {/* Watchlist Star Toggle */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleWatch && onToggleWatch(player.id)}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isWatched
                              ? 'text-amber-500 hover:bg-amber-100'
                              : 'text-slate-300 hover:text-amber-400 hover:bg-slate-100'
                          }`}
                          title={isWatched ? 'Remover do Radar de Observação' : 'Adicionar ao Radar de Observação (Todas as 3 fases)'}
                        >
                          <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{player.name}</span>
                          {isWatched && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300/80">
                              Radar
                            </span>
                          )}
                          {isInAuction && (
                            <span className="flex h-2.5 w-2.5 relative" title="Atleta em disputa ao vivo no leilão simultâneo">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Position Badge */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleFilterByPosition(player.position)}
                          title={`Clique para filtrar apenas por ${player.position}`}
                          className={`px-2 py-0.5 text-xs font-black rounded-md border transition-all cursor-pointer hover:scale-110 active:scale-95 ${badge.bgClass} ${badge.textClass} ${badge.borderClass} ${
                            exactPositionFilter === player.position
                              ? 'ring-2 ring-emerald-500 shadow-xs'
                              : 'hover:shadow-2xs'
                          }`}
                        >
                          {player.position}
                        </button>
                      </td>

                      {/* Phase Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          playerDay === currentAuctionDay
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          Fase {playerDay}
                        </span>
                      </td>

                      {/* Initial Price (Base) */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-extrabold text-slate-800 block">
                          {formatCurrency(player.initialPrice)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          Valor Mínimo
                        </span>
                      </td>

                      {/* Auction Movements & Last Bid */}
                      <td className="py-3.5 px-4">
                        {isInAuction ? (
                          activeBid ? (
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-black text-xs">
                                <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                <span>Último Lance: {formatCurrency(activeBid.amount)}</span>
                              </div>
                              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-emerald-600">
                                  +{formatCurrency(activeBid.amount - player.initialPrice, true)} ágio
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="font-medium text-slate-600">
                                  {activeBid.userId === currentUser?.id ? (
                                    <strong className="text-emerald-700 font-extrabold">Você está liderando</strong>
                                  ) : auction.anonymousBidding ? (
                                    <span className="text-slate-500 italic">Proposta Sigilosa</span>
                                  ) : (
                                    <span>Por: <strong>{activeBid.teamName}</strong></span>
                                  )}
                                </span>
                              </div>
                              <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Restam {formatAuctionTimer(playerTimerRemaining)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Disputa aberta</span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Base: <strong className="text-slate-700">{formatCurrency(player.initialPrice)}</strong>
                              </p>
                              <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Restam {formatAuctionTimer(playerTimerRemaining)}</span>
                              </div>
                            </div>
                          )
                        ) : isSold && player.soldTo ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 text-xs font-black text-slate-900">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Arrematado: {formatCurrency(player.soldTo.amount)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              Para: <strong className="text-slate-800">{player.soldTo.teamName}</strong> ({player.soldTo.userName})
                            </div>
                            {player.soldTo.amount > player.initialPrice && (
                              <span className="text-[10px] text-emerald-700 font-bold block">
                                Ágio final: +{formatCurrency(player.soldTo.amount - player.initialPrice, true)}
                              </span>
                            )}
                          </div>
                        ) : isQueued && queueItem ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                              <span>Na Fila de Espera #{queueIndex + 1}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              Postado por: <strong className="text-slate-700">{queueItem.nominatedByTeamName}</strong>
                            </div>
                            <span className="text-[10px] text-slate-400 italic block">
                              Sem propostas ainda (Base: {formatCurrency(player.initialPrice)})
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-400 font-medium block">
                              — Sem propostas
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Disponível para indicação
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isInAuction && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-black rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <Flame className="w-3.5 h-3.5 text-rose-600" />
                            Em Leilão Agora
                          </span>
                        )}

                        {isSold && player.soldTo && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            <Lock className="w-3 h-3 text-slate-500" />
                            Vendido
                          </span>
                        )}

                        {!isInAuction && !isSold && isQueued && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            Na Fila #{queueIndex + 1}
                          </span>
                        )}

                        {!isInAuction && !isSold && !isQueued && isAvailable && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Disponível
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isInAuction && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentUser) {
                                  onOpenAuth();
                                  return;
                                }
                                setSelectedPlayerForBid(player);
                              }}
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer ${
                                activeBid?.userId === currentUser?.id
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white animate-pulse'
                              }`}
                              title={
                                activeBid?.userId === currentUser?.id
                                  ? 'Sua equipe lidera o leilão deste atleta! Clique para cobrir ou aumentar sua proposta.'
                                  : 'Cobrir proposta por este atleta no leilão simultâneo'
                              }
                            >
                              <Flame className="w-3.5 h-3.5" />
                              <span>{activeBid?.userId === currentUser?.id ? 'Liderando' : 'Cobrir Proposta'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => onViewPreview(player)}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
                              isPlayerInSquad(player.id)
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-sm'
                            }`}
                            title={
                              isPlayerInSquad(player.id)
                                ? 'Jogador já está no seu elenco prévia - Clique para visualizar na prancheta'
                                : 'Enviar este jogador para o elenco prévia e visualizar na prancheta'
                            }
                          >
                            {isPlayerInSquad(player.id) ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                            )}
                            <span>Ver Prévia</span>
                          </button>

                          {isAvailable && !isInAuction && (
                            (() => {
                              if (isQueued && queueItem) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 text-amber-700 border border-amber-200"
                                    title={`Postado por ${queueItem.nominatedByUserName} (${queueItem.nominatedByTeamName})`}
                                  >
                                    <span>Fila #{queueIndex + 1}</span>
                                  </span>
                                );
                              }

                              if (isUserSquadFull) {
                                return (
                                  <span
                                    className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed"
                                    title="Seu clube já atingiu o limite de 23 jogadores no elenco"
                                  >
                                    Elenco 23/23
                                  </span>
                                );
                              }

                              if (!isAllowedToday) {
                                return (
                                  <span
                                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                    title={`Indicações bloqueadas: Jogador pertence à Fase ${playerDay}`}
                                  >
                                    🔒 Fase {playerDay}
                                  </span>
                                );
                              }

                              const isAuctionInProgress = auction.status !== 'NOT_STARTED' && auction.status !== 'ENDED';

                              return (
                                <button
                                  type="button"
                                  disabled={!isAuctionInProgress}
                                  onClick={() => {
                                    if (!isAuctionInProgress) return;
                                    if (!currentUser) {
                                      onOpenAuth();
                                      return;
                                    }
                                    setSelectedPlayerForBid(player);
                                  }}
                                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all ${
                                    isAuctionInProgress
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-xs'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                  }`}
                                  title={
                                    auction.status === 'NOT_STARTED'
                                      ? "Propostas bloqueadas: O leilão oficial ainda não foi iniciado pela Diretoria. Aguarde a abertura oficial para evitar inicializações precoces."
                                      : auction.status === 'ENDED'
                                      ? "Propostas encerradas: O leilão oficial da Khedira League foi encerrado."
                                      : "Fazer proposta oficial de 24 horas para este atleta"
                                  }
                                >
                                  Fazer Proposta
                                </button>
                              );
                            })()
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    {viewScope === 'WATCHED_ONLY'
                      ? 'Nenhum jogador em observação no momento. Clique na estrela ⭐ ao lado de qualquer atleta para monitorar.'
                      : 'Nenhum jogador encontrado com os filtros atuais.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Mostrando <strong>{paginatedPlayers.length}</strong> de <strong>{filteredPlayers.length}</strong> jogadores
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 font-semibold"
            >
              Anterior
            </button>
            <span className="px-2 font-bold text-slate-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 font-semibold"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Quick Bid / Propose Modal for Concurrent Auctions */}
      {selectedPlayerForBid && (
        <QuickBidModal
          player={selectedPlayerForBid}
          isOpen={Boolean(selectedPlayerForBid)}
          onClose={() => setSelectedPlayerForBid(null)}
          currentUser={currentUser}
          auction={auction}
          onConfirmBid={async (amount, playerId) => {
            const isAlreadyInAuction = selectedPlayerForBid.status === 'IN_AUCTION';
            if (isAlreadyInAuction && onBid) {
              return await onBid(amount, playerId);
            } else {
              return await onNominate(playerId, amount);
            }
          }}
          onOpenAuth={onOpenAuth}
        />
      )}
    </div>
  );
};
