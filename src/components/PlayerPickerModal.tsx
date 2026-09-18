import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Lock, Sparkles } from 'lucide-react';
import { Player, FormationSlot } from '../types';
import { formatCurrency, getPositionBadge, isCompatiblePosition, matchesPlayerSearch } from '../utils/formatters';

interface PlayerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: FormationSlot | null;
  players: Player[];
  ownedPlayerIds: string[];
  currentAssignedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
}

export const PlayerPickerModal: React.FC<PlayerPickerModalProps> = ({
  isOpen,
  onClose,
  slot,
  players,
  ownedPlayerIds,
  currentAssignedPlayerId,
  onSelectPlayer,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'POSITION' | 'EXACT' | 'OWNED' | 'ALL'>('POSITION');

  // Automatically reset filter to the slot's position whenever the modal opens or the slot changes
  useEffect(() => {
    if (isOpen && slot) {
      setFilterMode('POSITION');
      setSearch('');
    }
  }, [isOpen, slot?.slotId]);

  // Pre-calculate count for the position filter
  const positionMatchCount = useMemo(() => {
    if (!slot) return 0;
    return players.filter((p) => isCompatiblePosition(slot.role, p.position)).length;
  }, [players, slot]);

  const exactMatchCount = useMemo(() => {
    if (!slot) return 0;
    return players.filter((p) => p.position === slot.role).length;
  }, [players, slot]);

  const ownedCount = useMemo(() => {
    return players.filter((p) => ownedPlayerIds.includes(p.id)).length;
  }, [players, ownedPlayerIds]);

  if (!isOpen || !slot) return null;

  // Filter and sort players
  const filteredPlayers = players
    .filter((player) => {
      if (search.trim() && !matchesPlayerSearch(player, search)) return false;

      if (filterMode === 'EXACT') {
        return player.position === slot.role;
      }

      if (filterMode === 'POSITION') {
        return isCompatiblePosition(slot.role, player.position);
      }

      if (filterMode === 'OWNED') {
        return ownedPlayerIds.includes(player.id);
      }

      return true;
    })
    .sort((a, b) => {
      // 1. Exact role match prioritized
      const aExact = a.position === slot.role;
      const bExact = b.position === slot.role;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // 2. Owned players prioritized
      const aOwned = ownedPlayerIds.includes(a.id);
      const bOwned = ownedPlayerIds.includes(b.id);
      if (aOwned && !bOwned) return -1;
      if (!aOwned && bOwned) return 1;

      // 3. Higher price / rating first
      return b.initialPrice - a.initialPrice;
    });

  const displayedPlayers = filteredPlayers.slice(0, 100);

  const slotBadge = getPositionBadge(slot.role as any);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Selecionar Jogador para a Posição
              </h3>
              <span className={`px-2.5 py-0.5 text-xs font-black rounded-md border ${slotBadge.bgClass} ${slotBadge.textClass} ${slotBadge.borderClass} shadow-2xs`}>
                {slot.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtro ativo automaticamente para a posição <strong className="text-slate-800">{slot.role}</strong> ({slotBadge.label})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={`Buscar jogador para a vaga ${slot.role}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Filtro:</span>
            
            {/* Primary Position Filter - Enabled by default */}
            <button
              onClick={() => setFilterMode('POSITION')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'POSITION'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Posição {slot.role}</span>
              <span className={`px-1.5 py-0.2 text-[10px] rounded-md font-black ${
                filterMode === 'POSITION' ? 'bg-white/20 text-white' : 'bg-emerald-200/70 text-emerald-900'
              }`}>
                {positionMatchCount}
              </span>
            </button>

            {/* Exact Position only */}
            {exactMatchCount !== positionMatchCount && (
              <button
                onClick={() => setFilterMode('EXACT')}
                className={`px-2.5 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  filterMode === 'EXACT'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Apenas {slot.role}</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-md ${
                  filterMode === 'EXACT' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {exactMatchCount}
                </span>
              </button>
            )}

            {/* Owned by me */}
            <button
              onClick={() => setFilterMode('OWNED')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'OWNED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Comprados ({ownedCount})</span>
            </button>

            {/* All players */}
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({players.length})
            </button>
          </div>
        </div>

        {/* Clear slot option */}
        {currentAssignedPlayerId && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Vaga atualmente ocupada</span>
            <button
              onClick={() => {
                onSelectPlayer(null);
                onClose();
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
            >
              Remover Jogador da Vaga
            </button>
          </div>
        )}

        {/* Player List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100">
          {filteredPlayers.length > 100 && (
            <div className="pb-2 text-center text-[11px] text-slate-500 font-medium">
              Exibindo os primeiros 100 de <strong className="text-slate-700">{filteredPlayers.length}</strong> atletas. Digite o nome para refinar.
            </div>
          )}
          {displayedPlayers.length > 0 ? (
            displayedPlayers.map((player) => {
              const isOwnedByMe = ownedPlayerIds.includes(player.id);
              const isSelected = player.id === currentAssignedPlayerId;
              const badge = getPositionBadge(player.position);
              const isExact = player.position === slot.role;

              return (
                <button
                  key={player.id}
                  onClick={() => {
                    onSelectPlayer(player.id);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between gap-3 text-left transition-all pt-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/80 border border-emerald-300 ring-1 ring-emerald-400'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-1 text-xs font-black rounded-md border shrink-0 ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                      {player.position}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {player.name}
                        </span>
                        {isExact && (
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-blue-100 text-blue-800 rounded">
                            Posição Exata
                          </span>
                        )}
                        {isOwnedByMe ? (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            Comprado
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                            Prévia
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {player.club} • {player.nationality}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-slate-700 block">
                        {formatCurrency(player.initialPrice, true)}
                      </span>
                      <span className="text-[10px] text-slate-400">Preço Base</span>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <p>Nenhum jogador encontrado para a posição <strong className="text-slate-600">{slot.role}</strong>.</p>
              <button
                onClick={() => setFilterMode('ALL')}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
              >
                Ver todos os jogadores
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
