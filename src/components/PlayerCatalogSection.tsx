import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, ArrowUpDown, Flame, Gavel, 
  CheckCircle2, Lock, Sparkles, ExternalLink, Plus, X, ShieldAlert, ShieldCheck, Calendar
} from 'lucide-react';
import { Player, UserProfile, AuctionState, UserSquad } from '../types';
import { formatCurrency, getPositionBadge, getPositionCategory, isPositionAllowedForDay, getDayLabel } from '../utils/formatters';

interface PlayerCatalogSectionProps {
  players: Player[];
  currentUser: UserProfile | null;
  userSquad?: UserSquad | null;
  auction: AuctionState;
  onNominate: (playerId: string) => Promise<boolean>;
  onViewPreview: (player: Player) => Promise<void> | void;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onNavigateToSquad: () => void;
}

export const PlayerCatalogSection: React.FC<PlayerCatalogSectionProps> = ({
  players,
  currentUser,
  userSquad,
  auction,
  onNominate,
  onViewPreview,
  onOpenAuth,
  onOpenAdmin,
  onNavigateToSquad,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'GOL' | 'DEF' | 'MEI' | 'ATA'>('ALL');
  const [exactPositionFilter, setExactPositionFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'SOLD' | 'IN_AUCTION'>('ALL');
  const [sortField, setSortField] = useState<'name' | 'initialPrice' | 'position' | 'status'>('initialPrice');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const currentAuctionDay = auction.auctionDay || 1;
  const currentDayInfo = getDayLabel(currentAuctionDay);

  // Total players allowed for the active day
  const dayPlayers = useMemo(() => {
    return players.filter((p) => isPositionAllowedForDay(p.position, currentAuctionDay));
  }, [players, currentAuctionDay]);

  const handleFilterByPosition = (pos: string) => {
    if (exactPositionFilter === pos) {
      setExactPositionFilter(null);
    } else {
      setExactPositionFilter(pos);
      setCategoryFilter('ALL');
      setCurrentPage(1);
    }
  };

  // Filter & sort logic - O MERCADO SÓ DISPONIBILIZA OS JOGADORES DA POSIÇÃO DO DIA
  const filteredPlayers = useMemo(() => {
    return dayPlayers
      .filter((player) => {
        // Exact position filter if clicked directly
        if (exactPositionFilter && player.position !== exactPositionFilter) {
          return false;
        }

        // Search
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          player.name.toLowerCase().includes(term) ||
          player.club.toLowerCase().includes(term) ||
          player.nationality.toLowerCase().includes(term) ||
          player.position.toLowerCase().includes(term);
        if (!matchesSearch) return false;

        // Position category
        if (categoryFilter !== 'ALL') {
          if (getPositionCategory(player.position) !== categoryFilter) {
            return false;
          }
        }

        // Status
        if (statusFilter !== 'ALL') {
          if (player.status !== statusFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === 'name') {
          comp = a.name.localeCompare(b.name);
        } else if (sortField === 'initialPrice') {
          comp = a.initialPrice - b.initialPrice;
        } else if (sortField === 'position') {
          comp = a.position.localeCompare(b.position);
        } else if (sortField === 'status') {
          comp = a.status.localeCompare(b.status);
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [dayPlayers, searchTerm, categoryFilter, exactPositionFilter, statusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage) || 1;
  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (field: 'name' | 'initialPrice' | 'position' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const isAuctionIdle = auction.status === 'IDLE';
  const canNominate = Boolean(
    currentUser &&
      isAuctionIdle &&
      (auction.nominationTurnUserId === currentUser.id ||
        currentUser.role === 'ADMIN' ||
        auction.isFreeNominationMode)
  );

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

          <div className="flex items-center gap-1.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700 shrink-0 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Posições Ativas:</span>
            {currentDayInfo.positions.map((pos) => {
              const badge = getPositionBadge(pos as any);
              const countInDay = dayPlayers.filter((p) => p.position === pos).length;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handleFilterByPosition(pos)}
                  className={`px-2 py-0.5 rounded text-xs font-black transition-all cursor-pointer ${
                    exactPositionFilter === pos
                      ? 'bg-emerald-500 text-slate-950 ring-2 ring-white scale-105'
                      : `${badge.bgClass} ${badge.textClass} hover:opacity-90`
                  }`}
                  title={`Filtrar apenas por ${pos} (${countInDay} atletas)`}
                >
                  {pos} ({countInDay})
                </button>
              );
            })}
          </div>
        </div>
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
                Mercado de Craques (EAFC 27) — {currentDayInfo.title}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulte os craques da posição do dia, preços de abertura para lance inicial e situação no leilão.
            </p>
          </div>

          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={onOpenAdmin}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-end sm:self-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gerenciar Preços / Jogadores</span>
            </button>
          )}
        </div>

        {/* Controls, Filters & Search */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={`Buscar em ${dayPlayers.length} atletas da fase...`}
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
                setStatusFilter(e.target.value as 'ALL' | 'AVAILABLE' | 'SOLD' | 'IN_AUCTION');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="ALL">Status: Todos</option>
              <option value="AVAILABLE">🟢 Apenas Disponíveis</option>
              <option value="IN_AUCTION">🟡 Em Leilão Agora</option>
              <option value="SOLD">🔒 Vendidos</option>
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
                <th
                  onClick={() => toggleSort('initialPrice')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Lance Inicial (Base)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Situação / Status</span>
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
                  const isInAuction = player.status === 'IN_AUCTION';
                  const isSold = player.status === 'SOLD';

                  return (
                    <tr
                      key={player.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isInAuction ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{player.name}</span>
                          {isInAuction && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
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

                      {/* Initial Price */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-extrabold text-slate-800 block">
                          {formatCurrency(player.initialPrice)}
                        </span>
                        {isSold && player.soldTo && (
                          <span className="text-[11px] font-bold text-emerald-600 block">
                            Final: {formatCurrency(player.soldTo.amount)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isAvailable && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Disponível
                          </span>
                        )}

                        {isInAuction && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Flame className="w-3 h-3 text-amber-600" />
                            Em Leilão Agora
                          </span>
                        )}

                        {isSold && player.soldTo && (
                          <div className="text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              <Lock className="w-3 h-3 text-slate-500" />
                              Vendido
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                              Para: <strong>{player.soldTo.userName}</strong> ({player.soldTo.teamName})
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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

                          {isAvailable && canNominate && (
                            <button
                              onClick={() => {
                                if (!currentUser) {
                                  onOpenAuth();
                                  return;
                                }
                                onNominate(player.id);
                              }}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                              title="Anunciar jogador no leilão ao vivo"
                            >
                              Anunciar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum jogador encontrado com os filtros atuais.
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
    </div>
  );
};
