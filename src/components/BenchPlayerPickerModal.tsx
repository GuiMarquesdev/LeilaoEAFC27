import React, { useState } from 'react';
import { X, Search, Plus, Star, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { Player } from '../types';
import { formatCurrency, getPositionBadge, getPlayerAuctionDay, getDayLabel, matchesPlayerSearch } from '../utils/formatters';

interface BenchPlayerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  benchPlayerIds: string[];
  starterPlayerIds: string[];
  ownedPlayerIds: string[];
  targetedPlayerIds: string[];
  onAddPlayerToBench: (playerId: string) => void;
  isAuctionEnded?: boolean;
}

export const BenchPlayerPickerModal: React.FC<BenchPlayerPickerModalProps> = ({
  isOpen,
  onClose,
  players,
  benchPlayerIds,
  starterPlayerIds,
  ownedPlayerIds,
  targetedPlayerIds,
  onAddPlayerToBench,
  isAuctionEnded = false,
}) => {
  const [search, setSearch] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');

  if (!isOpen) return null;

  // Filtrar jogadores que já estão nos titulares ou no banco
  const assignedIds = new Set([...starterPlayerIds, ...benchPlayerIds]);

  const filteredPlayers = players
    .filter((player) => {
      // Se o leilão acabou, apenas jogadores arrematados pelo clube podem ir para o banco
      if (isAuctionEnded && !ownedPlayerIds.includes(player.id)) return false;

      // Não listar jogadores já escalados ou já no banco
      if (assignedIds.has(player.id)) return false;

      if (search.trim() && !matchesPlayerSearch(player, search)) return false;

      if (selectedPosition === 'ALL') return true;
      if (selectedPosition === 'DEF') {
        return ['GOL', 'ZAG', 'LE', 'LD', 'CB', 'LB', 'RB', 'GK'].includes(player.position);
      }
      if (selectedPosition === 'MID') {
        return ['VOL', 'MC', 'MEI', 'CDM', 'CM', 'CAM'].includes(player.position);
      }
      if (selectedPosition === 'ATT') {
        return ['ATA', 'ME', 'MD', 'PE', 'PD', 'SA', 'ST', 'CF', 'LW', 'RW', 'LM', 'RM'].includes(player.position);
      }

      return player.position === selectedPosition;
    })
    .sort((a, b) => {
      // 1. Alvos priorizados
      const aTarget = targetedPlayerIds.includes(a.id);
      const bTarget = targetedPlayerIds.includes(b.id);
      if (aTarget && !bTarget) return -1;
      if (!aTarget && bTarget) return 1;

      // 2. Maior preço / relevância primeiro
      return b.initialPrice - a.initialPrice;
    });

  const displayedPlayers = filteredPlayers.slice(0, 100);

  return (
    <div 
      id="bench-player-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Adicionar Reserva ao Elenco de Conceito
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-black rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                Banco
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha reservas para planejar seu elenco completo e transferir para os alvos do leilão.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Position Filter Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nome ou posição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              onClick={() => setSelectedPosition('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPosition === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedPosition('DEF')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPosition === 'DEF'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Defesa
            </button>
            <button
              onClick={() => setSelectedPosition('MID')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPosition === 'MID'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Meio-campo
            </button>
            <button
              onClick={() => setSelectedPosition('ATT')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPosition === 'ATT'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Ataque
            </button>
          </div>
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 divide-y divide-slate-100">
          {filteredPlayers.length > 100 && (
            <div className="pb-2 text-center text-[11px] text-slate-500 font-medium">
              Exibindo os primeiros 100 de <strong className="text-slate-700">{filteredPlayers.length}</strong> atletas. Digite o nome para refinar.
            </div>
          )}
          {displayedPlayers.length > 0 ? (
            displayedPlayers.map((player) => {
              const badge = getPositionBadge(player.position);
              const isTargeted = targetedPlayerIds.includes(player.id);
              const day = getPlayerAuctionDay(player.position);

              return (
                <div
                  key={player.id}
                  className="pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
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
                        {isTargeted && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Alvo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{player.club}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">{getDayLabel(day).title}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs font-black text-slate-900 font-['Outfit',sans-serif]">
                      {formatCurrency(player.initialPrice, true)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onAddPlayerToBench(player.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar ao Banco</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum jogador disponível encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
