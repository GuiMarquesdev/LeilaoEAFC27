import React, { useState } from 'react';
import { 
  X, Target, Star, CheckCircle2, AlertCircle, 
  ArrowRight, ShieldCheck, Sparkles, Layers, DollarSign
} from 'lucide-react';
import { Player } from '../types';
import { formatCurrency, getPositionBadge, getPlayerSectorName } from '../utils/formatters';

interface ConceptToTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conceptPlayers: Player[];
  alreadyTargetedIds: string[];
  userBudget: number;
  starterPlayerIds?: string[];
  benchPlayerIds?: string[];
  onConfirmTransfer: (mode: 'merge' | 'replace') => void;
  onNavigateToAuction?: () => void;
}

export const ConceptToTargetsModal: React.FC<ConceptToTargetsModalProps> = ({
  isOpen,
  onClose,
  conceptPlayers,
  alreadyTargetedIds,
  userBudget,
  starterPlayerIds = [],
  benchPlayerIds = [],
  onConfirmTransfer,
  onNavigateToAuction,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [filterSector, setFilterSector] = useState<'ALL' | 'DEF' | 'MEI' | 'ATA'>('ALL');

  if (!isOpen) return null;

  const totalCost = conceptPlayers.reduce((sum, p) => sum + p.initialPrice, 0);
  const alreadyInTargetCount = conceptPlayers.filter((p) => alreadyTargetedIds.includes(p.id)).length;
  const newTargetsCount = conceptPlayers.length - alreadyInTargetCount;

  // Group by sector
  const defCount = conceptPlayers.filter((p) => ['GOL', 'ZAG', 'LE', 'LD'].includes(p.position)).length;
  const meiCount = conceptPlayers.filter((p) => ['VOL', 'MC', 'MEI'].includes(p.position)).length;
  const ataCount = conceptPlayers.filter((p) => ['ATA', 'PE', 'PD', 'ME', 'MD', 'SA'].includes(p.position)).length;

  const starterCount = conceptPlayers.filter((p) => starterPlayerIds.includes(p.id)).length;
  const benchCount = conceptPlayers.filter((p) => benchPlayerIds.includes(p.id)).length;

  const filteredPlayers = conceptPlayers.filter((p) => {
    if (filterSector === 'DEF') return ['GOL', 'ZAG', 'LE', 'LD'].includes(p.position);
    if (filterSector === 'MEI') return ['VOL', 'MC', 'MEI'].includes(p.position);
    if (filterSector === 'ATA') return ['ATA', 'PE', 'PD', 'ME', 'MD', 'SA'].includes(p.position);
    return true;
  });

  const handleConfirm = () => {
    onConfirmTransfer(importMode);
    onClose();
  };

  return (
    <div 
      id="concept-to-targets-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md font-black shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300/60">
                  Planejamento de Leilão
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  EAFC 27
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Passar Elenco de Conceito para Alvos do Leilão
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Defina os craques escalados na sua prancheta tática como seus alvos prioritários de compra.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Total Atletas
              </span>
              <span className="text-base font-black text-slate-900 font-['Outfit',sans-serif] mt-0.5 block">
                {conceptPlayers.length}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({starterCount}T / {benchCount}B)
                </span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Custo Base Total
              </span>
              <span className="text-sm font-black text-emerald-700 font-['Outfit',sans-serif] mt-0.5 block">
                {formatCurrency(totalCost, true)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Impacto no Orçamento
              </span>
              <span className="text-xs font-bold text-slate-700 mt-1 block">
                {userBudget > 0 ? `${Math.round((totalCost / userBudget) * 100)}% do saldo` : '—'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Status no Radar
              </span>
              <span className="text-sm font-black text-slate-800 flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span>{alreadyInTargetCount} já salvos</span>
              </span>
            </div>
          </div>

          {/* Strategic Tip */}
          <div className="p-3 sm:p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">
                Como funciona a integração com o leilão:
              </p>
              <p className="text-amber-800 mt-0.5">
                Ao transferir, estes {conceptPlayers.length} atletas aparecem instantaneamente no seu <strong>Radar de Alvos do Leilão</strong>. Você receberá alertas visuais sempre que qualquer um deles for a leilão, facilitando disputas rápidas.
              </p>
            </div>
          </div>

          {/* Sector Filter Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Atletas a Sincronizar ({conceptPlayers.length})
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterSector('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterSector === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({conceptPlayers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterSector('DEF')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterSector === 'DEF'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Defesa ({defCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSector('MEI')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterSector === 'MEI'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Meio ({meiCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSector('ATA')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterSector === 'ATA'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ataque ({ataCount})
              </button>
            </div>
          </div>

          {/* Player Cards Scrollable List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {filteredPlayers.map((player) => {
              const badge = getPositionBadge(player.position);
              const sectorName = getPlayerSectorName(player.position);
              const isAlreadyTargeted = alreadyTargetedIds.includes(player.id);
              const isBench = benchPlayerIds.includes(player.id);
              const isStarter = starterPlayerIds.includes(player.id);

              return (
                <div
                  key={player.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded ${badge.bgClass} ${badge.textClass} shrink-0`}>
                      {player.position}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 truncate">
                          {player.name}
                        </span>
                        {isBench ? (
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 font-black rounded border border-amber-300 shrink-0">
                            Banco
                          </span>
                        ) : isStarter ? (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-900 font-black rounded border border-emerald-300 shrink-0">
                            Titular
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-bold hidden sm:inline">
                      {sectorName}
                    </span>
                    <span className="text-xs font-black text-slate-900 font-['Outfit',sans-serif]">
                      {formatCurrency(player.initialPrice, true)}
                    </span>
                    {isAlreadyTargeted ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>Já no Radar</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Novo Alvo</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Import Mode Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Modo de Importação para os Alvos
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label 
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  importMode === 'merge' 
                    ? 'border-amber-500 bg-amber-50/50 shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="importMode" 
                  checked={importMode === 'merge'} 
                  onChange={() => setImportMode('merge')} 
                  className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Mesclar com Alvos Existentes
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                    Adiciona os {newTargetsCount} novos atletas e mantém os que você já favoritou antes.
                  </span>
                </div>
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  importMode === 'replace' 
                    ? 'border-rose-500 bg-rose-50/50 shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="importMode" 
                  checked={importMode === 'replace'} 
                  onChange={() => setImportMode('replace')} 
                  className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Substituir Todos os Alvos
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                    Limpa os alvos anteriores e define estritamente estes {conceptPlayers.length} atletas.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer transform active:scale-95"
          >
            <span>Confirmar e Salvar no Radar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
