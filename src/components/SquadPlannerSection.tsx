import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Lock, Sparkles, RefreshCw, Check, 
  Share2, ArrowRightLeft, DollarSign, Trophy, Info, Trash2,
  GripVertical, CheckCircle2, ArrowDownCircle
} from 'lucide-react';
import { Player, UserProfile, UserSquad, FormationSlot, TacticalFormation } from '../types';
import { INITIAL_FORMATIONS } from '../data/initialPlayers';
import { formatCurrency, getPositionBadge, isCompatiblePosition } from '../utils/formatters';
import { playBidSound } from '../utils/sound';
import { PlayerPickerModal } from './PlayerPickerModal';

interface SquadPlannerSectionProps {
  currentUser: UserProfile | null;
  players: Player[];
  userSquad: UserSquad | null;
  onSaveSquad: (formationId: string, starterSlots: { [slotId: string]: string | null }, benchPlayerIds: string[]) => Promise<void>;
  onOpenAuth: () => void;
}

interface DragItemData {
  playerId: string;
  from: 'bench' | 'slot';
  sourceSlotId?: string;
}

export const SquadPlannerSection: React.FC<SquadPlannerSectionProps> = ({
  currentUser,
  players,
  userSquad,
  onSaveSquad,
  onOpenAuth,
}) => {
  // Current formation
  const [selectedFormationId, setSelectedFormationId] = useState<string>(
    userSquad?.formationId || '4-3-3'
  );

  // Starters mapping: slotId -> playerId
  const [starterSlots, setStarterSlots] = useState<{ [slotId: string]: string | null }>(
    userSquad?.starterSlots || {}
  );

  // Bench player IDs
  const [benchPlayerIds, setBenchPlayerIds] = useState<string[]>(
    userSquad?.benchPlayerIds || []
  );

  // Modal state
  const [activeSlot, setActiveSlot] = useState<FormationSlot | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Drag and drop states
  const [draggedItem, setDraggedItem] = useState<DragItemData | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [isBenchDragOver, setIsBenchDragOver] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'swap' | 'bench' } | null>(null);

  const showFeedback = useCallback((message: string, type: 'success' | 'swap' | 'bench' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => {
      setFeedbackToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  // Find all players permanently won in auction by this user
  const ownedPlayers = currentUser
    ? players.filter((p) => p.soldTo?.userId === currentUser.id)
    : [];
  const ownedPlayerIds = ownedPlayers.map((p) => p.id);

  // Sync state whenever userSquad changes
  useEffect(() => {
    if (userSquad) {
      setSelectedFormationId(userSquad.formationId || '4-3-3');
      setStarterSlots(userSquad.starterSlots || {});
      if (Array.isArray(userSquad.benchPlayerIds)) {
        setBenchPlayerIds(userSquad.benchPlayerIds);
      }
    }
  }, [userSquad]);

  // Regra central: Todos os jogadores comprados no leilão devem ir para os reservas comprados,
  // permitindo que o usuário os escale da forma que quiser.
  // Garante que nenhum jogador arrematado fique de fora do banco de reservas se não estiver escalado nos titulares.
  useEffect(() => {
    if (!currentUser) return;
    const currentStarterPlayerIds = Object.values(starterSlots).filter(Boolean) as string[];

    setBenchPlayerIds((prevBench) => {
      let changed = false;
      const newBench = [...prevBench];

      // 1. Todo jogador comprado pelo usuário que NÃO estiver nos titulares DEVE estar no banco de reservas
      ownedPlayerIds.forEach((pid) => {
        if (!currentStarterPlayerIds.includes(pid) && !newBench.includes(pid)) {
          newBench.push(pid);
          changed = true;
        }
      });

      // 2. Se um jogador que está no banco foi escalado como titular, remove do banco
      const filteredBench = newBench.filter((pid) => !currentStarterPlayerIds.includes(pid));
      if (filteredBench.length !== newBench.length) {
        changed = true;
      }

      if (changed) {
        // Salva atualização de elenco no servidor automaticamente
        onSaveSquad(selectedFormationId, starterSlots, filteredBench);
        return filteredBench;
      }
      return prevBench;
    });
  }, [ownedPlayerIds, starterSlots, currentUser, selectedFormationId]);

  const currentFormation: TacticalFormation =
    INITIAL_FORMATIONS.find((f) => f.id === selectedFormationId) || INITIAL_FORMATIONS[0];

  const handleOpenSlot = (slot: FormationSlot) => {
    setActiveSlot(slot);
    setIsPickerOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, data: DragItemData) => {
    setDraggedItem(data);
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverSlotId(null);
    setIsBenchDragOver(false);
  };

  const handleDragOverSlot = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlotId !== slotId) {
      setDragOverSlotId(slotId);
    }
  };

  const handleDragLeaveSlot = (slotId: string) => {
    if (dragOverSlotId === slotId) {
      setDragOverSlotId(null);
    }
  };

  const handleDropOnSlot = (e: React.DragEvent, targetSlotId: string) => {
    e.preventDefault();
    setDragOverSlotId(null);

    let data = draggedItem;
    if (!data) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) data = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    if (!data || !data.playerId) {
      setDraggedItem(null);
      return;
    }

    const { playerId, from, sourceSlotId } = data;
    const targetSlot = currentFormation.slots.find((s) => s.slotId === targetSlotId);
    const player = players.find((p) => p.id === playerId);
    const existingPlayerId = starterSlots[targetSlotId];
    const existingPlayer = existingPlayerId ? players.find((p) => p.id === existingPlayerId) : null;

    const newSlots = { ...starterSlots };
    let newBench = [...benchPlayerIds];

    if (from === 'bench') {
      // If target slot already had a player
      if (existingPlayerId) {
        // If that existing player is owned by user, return them to bench
        if (ownedPlayerIds.includes(existingPlayerId)) {
          if (!newBench.includes(existingPlayerId)) {
            newBench.push(existingPlayerId);
          }
        }
      }
      // Remove newly assigned player from bench
      newBench = newBench.filter((id) => id !== playerId);
      newSlots[targetSlotId] = playerId;

      if (player && targetSlot) {
        const msg = existingPlayer
          ? `🔄 ${player.name} substituiu ${existingPlayer.name} na vaga ${targetSlot.role}!`
          : `⚡ ${player.name} escalado como titular em ${targetSlot.role}!`;
        showFeedback(msg, existingPlayer ? 'swap' : 'success');
      }
    } else if (from === 'slot' && sourceSlotId) {
      if (sourceSlotId === targetSlotId) {
        setDraggedItem(null);
        return;
      }
      // Swap the two slots
      newSlots[sourceSlotId] = existingPlayerId || null;
      newSlots[targetSlotId] = playerId;

      if (player && targetSlot) {
        const msg = existingPlayer
          ? `🔄 Inversão tática: ${player.name} ⮂ ${existingPlayer.name}!`
          : `⚡ ${player.name} reposicionado para ${targetSlot.role}!`;
        showFeedback(msg, 'swap');
      }
    }

    setStarterSlots(newSlots);
    setBenchPlayerIds(newBench);
    setDraggedItem(null);
    playBidSound();

    if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, newBench);
    }
  };

  const handleDragOverBench = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isBenchDragOver) {
      setIsBenchDragOver(true);
    }
  };

  const handleDropOnBench = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBenchDragOver(false);

    let data = draggedItem;
    if (!data) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) data = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    if (!data || !data.playerId || data.from !== 'slot' || !data.sourceSlotId) {
      setDraggedItem(null);
      return;
    }

    const { playerId, sourceSlotId } = data;
    const player = players.find((p) => p.id === playerId);

    const newSlots = { ...starterSlots, [sourceSlotId]: null };
    let newBench = [...benchPlayerIds];

    if (ownedPlayerIds.includes(playerId) && !newBench.includes(playerId)) {
      newBench.push(playerId);
    }

    setStarterSlots(newSlots);
    setBenchPlayerIds(newBench);
    setDraggedItem(null);
    playBidSound();

    if (player) {
      showFeedback(`📋 ${player.name} movido para o Banco de Reservas.`, 'bench');
    }

    if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, newBench);
    }
  };

  // Quick 1-click assign from bench
  const handleQuickAssignFromBench = (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    // Try finding empty compatible slot first
    let targetSlot = currentFormation.slots.find(
      (s) => !starterSlots[s.slotId] && isCompatiblePosition(s.role, player.position)
    );

    // If none, find any empty slot
    if (!targetSlot) {
      targetSlot = currentFormation.slots.find((s) => !starterSlots[s.slotId]);
    }

    // If all are filled, find first compatible slot to replace
    if (!targetSlot) {
      targetSlot = currentFormation.slots.find((s) => isCompatiblePosition(s.role, player.position));
    }

    // Fallback to first slot
    if (!targetSlot) {
      targetSlot = currentFormation.slots[0];
    }

    if (!targetSlot) return;

    const targetSlotId = targetSlot.slotId;
    const existingPlayerId = starterSlots[targetSlotId];
    const existingPlayer = existingPlayerId ? players.find((p) => p.id === existingPlayerId) : null;

    const newSlots = { ...starterSlots };
    let newBench = benchPlayerIds.filter((id) => id !== playerId);

    if (existingPlayerId && ownedPlayerIds.includes(existingPlayerId)) {
      if (!newBench.includes(existingPlayerId)) {
        newBench.push(existingPlayerId);
      }
    }

    newSlots[targetSlotId] = playerId;

    setStarterSlots(newSlots);
    setBenchPlayerIds(newBench);
    playBidSound();

    const msg = existingPlayer
      ? `🔄 ${player.name} substituiu ${existingPlayer.name} na vaga ${targetSlot.role}!`
      : `⚡ ${player.name} escalado como titular em ${targetSlot.role}!`;
    showFeedback(msg, existingPlayer ? 'swap' : 'success');

    if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, newBench);
    }
  };

  const handleSelectPlayerForSlot = (playerId: string | null) => {
    if (!activeSlot) return;

    const previousPlayerInSlotId = starterSlots[activeSlot.slotId];
    const newSlots = { ...starterSlots };
    let newBench = [...benchPlayerIds];

    // If this player was already assigned in another slot, clear that previous slot
    if (playerId) {
      Object.keys(newSlots).forEach((sId) => {
        if (newSlots[sId] === playerId) {
          newSlots[sId] = null;
        }
      });
      // Remove newly assigned player from bench
      newBench = newBench.filter((id) => id !== playerId);
    }

    // If the slot had an existing player owned by the user, return them to the bench
    if (previousPlayerInSlotId && ownedPlayerIds.includes(previousPlayerInSlotId) && previousPlayerInSlotId !== playerId) {
      if (!newBench.includes(previousPlayerInSlotId)) {
        newBench.push(previousPlayerInSlotId);
      }
    }

    newSlots[activeSlot.slotId] = playerId;
    setStarterSlots(newSlots);
    setBenchPlayerIds(newBench);

    // Trigger auto-save
    if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, newBench);
    }

    if (playerId) {
      const selectedP = players.find((p) => p.id === playerId);
      if (selectedP) {
        showFeedback(`⚡ ${selectedP.name} escalado como titular em ${activeSlot.role}!`, 'success');
      }
    }
  };

  const handleFormationChange = (newFormationId: string) => {
    setSelectedFormationId(newFormationId);
    if (currentUser) {
      onSaveSquad(newFormationId, starterSlots, benchPlayerIds);
    }
  };

  const handleRemoveFromStarter = (slotId: string, playerId: string) => {
    const newSlots = { ...starterSlots, [slotId]: null };
    setStarterSlots(newSlots);

    // If it's an owned player, place back on the bench
    if (ownedPlayerIds.includes(playerId) && !benchPlayerIds.includes(playerId)) {
      const newBench = [...benchPlayerIds, playerId];
      setBenchPlayerIds(newBench);
      if (currentUser) onSaveSquad(selectedFormationId, newSlots, newBench);
    } else if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, benchPlayerIds);
    }
  };

  const handleClearPreviewOnly = () => {
    // Keeps only players owned permanently through auction
    const newSlots: { [slotId: string]: string | null } = {};
    Object.entries(starterSlots).forEach(([slotId, pId]) => {
      const playerId = pId as string | null;
      if (playerId && ownedPlayerIds.includes(playerId)) {
        newSlots[slotId] = playerId;
      } else {
        newSlots[slotId] = null;
      }
    });
    setStarterSlots(newSlots);
    if (currentUser) onSaveSquad(selectedFormationId, newSlots, benchPlayerIds);
  };

  const handleCopyTeamSheet = () => {
    let text = `📋 ESCALAÇÃO KHEDIRA LEAGUE - ${currentUser?.teamName || 'Meu Time'}\n`;
    text += `Formação: ${currentFormation.name}\n\nTITULARES:\n`;

    currentFormation.slots.forEach((slot) => {
      const pId = starterSlots[slot.slotId];
      const player = pId ? players.find((p) => p.id === pId) : null;
      const isOwned = pId ? ownedPlayerIds.includes(pId) : false;
      text += `${slot.role}: ${player ? `${player.name} (${player.club})${isOwned ? ' [Comprado]' : ' [Planejado]'}` : '(Vazio)'}\n`;
    });

    if (benchPlayerIds.length > 0) {
      text += `\nBANCO DE RESERVAS:\n`;
      benchPlayerIds.forEach((pId) => {
        const player = players.find((p) => p.id === pId);
        if (player) text += `- ${player.name} (${player.position} - ${player.club})\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Count filled starters
  const startersCount = currentFormation.slots.filter(
    (slot) => Boolean(starterSlots[slot.slotId])
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Formation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded">
                Seção 2
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Prancheta Tática & Prévia de Time
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monte sua prévia escolhendo qualquer craque do EAFC 27. Jogadores comprados no leilão ficam permanentemente no seu elenco.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            {/* Formation Selector Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                Esquema Tático:
              </label>
              <select
                value={selectedFormationId}
                onChange={(e) => handleFormationChange(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                {INITIAL_FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Preview Only */}
            <button
              onClick={handleClearPreviewOnly}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              title="Manter apenas jogadores comprados no leilão"
            >
              Limpar Prévia
            </button>

            {/* Copy Team Sheet */}
            <button
              onClick={handleCopyTeamSheet}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copiar Time</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Financial & Squad Stats Summary */}
        {currentUser ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Saldo Restante
              </span>
              <span className="text-base font-extrabold text-emerald-600 font-['Outfit',sans-serif]">
                {formatCurrency(currentUser.budget)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Gasto no Leilão
              </span>
              <span className="text-base font-extrabold text-slate-800 font-['Outfit',sans-serif]">
                {formatCurrency(currentUser.spent)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Comprados no Leilão
              </span>
              <span className="text-base font-extrabold text-slate-800 flex items-center gap-1 font-['Outfit',sans-serif]">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                {ownedPlayers.length} jogadores
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Titulares Definidos
              </span>
              <span className="text-base font-extrabold text-slate-800 font-['Outfit',sans-serif]">
                {startersCount} / 11
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
            <span className="text-amber-900 font-medium">
              Conecte seu Gmail para acompanhar seu orçamento de $150M e salvar seu time oficial da Khedira League.
            </span>
            <button
              onClick={onOpenAuth}
              className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 ml-3 shrink-0"
            >
              Entrar
            </button>
          </div>
        )}
      </div>

      {/* Main Field & Squad Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: The Interactive Football Pitch */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Campo de Jogo ({currentFormation.name})
                </span>
                <span className="text-[11px] text-slate-400">
                  Clique em qualquer vaga para escolher ou trocar jogador
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  Adquirido
                </span>
                <span className="flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  Em Prévia
                </span>
              </div>
            </div>

            {/* Visual Pitch Container */}
            <div 
              id="squad-pitch-container"
              className="relative w-full aspect-[4/5] sm:aspect-[4/3.8] rounded-2xl pitch-grass border-4 border-emerald-900/60 shadow-inner overflow-hidden select-none"
            >
              {/* Field Markings (SVG overlay) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-white/40 fill-none" strokeWidth="2">
                {/* Border line */}
                <rect x="4%" y="4%" width="92%" height="92%" rx="4" />
                {/* Halfway line */}
                <line x1="4%" y1="50%" x2="96%" y2="50%" />
                {/* Center Circle */}
                <circle cx="50%" cy="50%" r="14%" />
                <circle cx="50%" cy="50%" r="1%" fill="rgba(255,255,255,0.4)" />
                {/* Top Penalty Area (Goal top) */}
                <rect x="25%" y="4%" width="50%" height="16%" />
                <rect x="36%" y="4%" width="28%" height="6%" />
                <path d="M 40% 20% A 10% 10% 0 0 0 60% 20%" />
                {/* Bottom Penalty Area (GK bottom) */}
                <rect x="25%" y="80%" width="50%" height="16%" />
                <rect x="36%" y="90%" width="28%" height="6%" />
                <path d="M 40% 80% A 10% 10% 0 0 1 60% 80%" />
              </svg>

              {/* Active Dragging Banner Overlay */}
              {draggedItem && (
                <div className="absolute top-3 left-3 right-3 z-30 bg-slate-950/90 text-white backdrop-blur-md px-3.5 py-2 rounded-xl border border-amber-400/80 shadow-2xl flex items-center justify-between text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <span className="font-black text-amber-300 truncate">
                      Arraste e solte {players.find(p => p.id === draggedItem.playerId)?.name || 'atleta'} ({players.find(p => p.id === draggedItem.playerId)?.position})
                    </span>
                    <span className="text-slate-300 text-[11px] hidden sm:inline">
                      — Solte em qualquer posição destacada
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0">
                    Modo Arraste
                  </span>
                </div>
              )}

              {/* Tactical Slots on the Pitch */}
              {currentFormation.slots.map((slot) => {
                const assignedPlayerId = starterSlots[slot.slotId];
                const player = assignedPlayerId
                  ? players.find((p) => p.id === assignedPlayerId)
                  : null;
                const isOwnedByMe = assignedPlayerId
                  ? ownedPlayerIds.includes(assignedPlayerId)
                  : false;

                const isSlotHovered = dragOverSlotId === slot.slotId;
                const isDraggingAny = Boolean(draggedItem);
                const draggedPlayer = draggedItem ? players.find((p) => p.id === draggedItem.playerId) : null;
                const isCompatible = draggedPlayer ? isCompatiblePosition(slot.role, draggedPlayer.position) : false;

                return (
                  <div
                    key={slot.slotId}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onDragOver={(e) => handleDragOverSlot(e, slot.slotId)}
                    onDragLeave={() => handleDragLeaveSlot(slot.slotId)}
                    onDrop={(e) => handleDropOnSlot(e, slot.slotId)}
                    className={`absolute z-10 transition-all duration-200 ${
                      isSlotHovered ? 'z-30 scale-120' : isDraggingAny ? 'z-20' : ''
                    }`}
                  >
                    <div
                      draggable={Boolean(assignedPlayerId)}
                      onDragStart={(e) => {
                        if (assignedPlayerId) {
                          handleDragStart(e, {
                            playerId: assignedPlayerId,
                            from: 'slot',
                            sourceSlotId: slot.slotId,
                          });
                        }
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenSlot(slot)}
                      className={`group relative flex flex-col items-center justify-center transition-all ${
                        assignedPlayerId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                      title={
                        assignedPlayerId
                          ? `${player?.name} (${player?.position}) - Arraste para reposicionar ou trocar`
                          : `Vaga livre (${slot.role}) - Clique para escolher ou arraste um reserva aqui`
                      }
                    >
                      {/* Node Avatar / Circle */}
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg font-bold text-xs transition-all border-2 relative ${
                          isSlotHovered
                            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-300/80 shadow-2xl scale-110'
                            : player
                            ? isOwnedByMe
                              ? 'bg-emerald-950 text-emerald-200 border-emerald-400 ring-2 ring-emerald-500/40'
                              : 'bg-slate-900 text-blue-200 border-blue-400 ring-2 ring-blue-500/30'
                            : isDraggingAny && isCompatible
                            ? 'bg-emerald-900/80 text-emerald-100 border-emerald-400 ring-4 ring-emerald-400/50 animate-pulse'
                            : isDraggingAny
                            ? 'bg-white/30 text-white border-dashed border-amber-300/80 ring-2 ring-white/40'
                            : 'bg-white/20 hover:bg-white/30 text-white/90 border-dashed border-white/60 backdrop-blur-xs'
                        }`}
                      >
                        {isSlotHovered ? (
                          <span className="text-[10px] font-black tracking-tight uppercase">
                            {player ? 'Trocar' : 'Soltar'}
                          </span>
                        ) : player ? (
                          <div className="text-center">
                            <span className="text-[10px] sm:text-xs font-black block leading-none">
                              {player.position}
                            </span>
                            {isOwnedByMe ? (
                              <Lock className="w-2.5 h-2.5 mx-auto mt-0.5 text-emerald-300" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5 mx-auto mt-0.5 text-blue-300" />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-extrabold tracking-tight">
                            {slot.role}
                          </span>
                        )}

                        {/* Compatible badge tag while dragging */}
                        {isDraggingAny && isCompatible && !isSlotHovered && (
                          <span className="absolute -top-2.5 -right-2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-md animate-bounce border border-emerald-300">
                            Ideal
                          </span>
                        )}
                      </div>

                      {/* Name Tag beneath */}
                      <div
                        className={`mt-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold tracking-tight shadow-md max-w-[90px] sm:max-w-[110px] truncate text-center transition-all ${
                          isSlotHovered
                            ? 'bg-amber-400 text-slate-950 border border-amber-300 font-black'
                            : player
                            ? isOwnedByMe
                              ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-500/50'
                              : 'bg-slate-900/90 text-white border border-slate-700'
                            : isDraggingAny && isCompatible
                            ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-400'
                            : 'bg-black/40 text-white/80'
                        }`}
                      >
                        {isSlotHovered
                          ? player
                            ? `Substituir ${player.name.split(' ').slice(-1)[0]}`
                            : `Soltar em ${slot.role}`
                          : player
                          ? player.name.split(' ').slice(-1)[0]
                          : `+ ${slot.role}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Roster List & Bench */}
        <div className="space-y-6">
          {/* Titulares List Table */}
          <div 
            id="squad-starters-card"
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs"
          >
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Titulares ({currentFormation.name})</span>
              <span className="text-[11px] font-normal text-slate-400">
                {startersCount}/11 vagas
              </span>
            </h4>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {currentFormation.slots.map((slot) => {
                const assignedPlayerId = starterSlots[slot.slotId];
                const player = assignedPlayerId
                  ? players.find((p) => p.id === assignedPlayerId)
                  : null;
                const isOwned = assignedPlayerId
                  ? ownedPlayerIds.includes(assignedPlayerId)
                  : false;
                const isSlotHovered = dragOverSlotId === slot.slotId;

                return (
                  <div
                    key={slot.slotId}
                    onDragOver={(e) => handleDragOverSlot(e, slot.slotId)}
                    onDragLeave={() => handleDragLeaveSlot(slot.slotId)}
                    onDrop={(e) => handleDropOnSlot(e, slot.slotId)}
                    draggable={Boolean(assignedPlayerId)}
                    onDragStart={(e) => {
                      if (assignedPlayerId) {
                        handleDragStart(e, {
                          playerId: assignedPlayerId,
                          from: 'slot',
                          sourceSlotId: slot.slotId,
                        });
                      }
                    }}
                    onDragEnd={handleDragEnd}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                      isSlotHovered
                        ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/40 shadow-sm'
                        : player
                        ? isOwned
                          ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
                          : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                        : 'bg-white border-dashed border-slate-200 text-slate-400 hover:border-slate-300'
                    } ${assignedPlayerId ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {assignedPlayerId && (
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="w-8 text-[11px] font-bold text-slate-500 shrink-0">
                        {slot.role}
                      </span>
                      {player ? (
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 truncate">
                              {player.name}
                            </span>
                            {isOwned ? (
                              <Lock className="w-3 h-3 text-emerald-600 shrink-0" title="Comprado no leilão" />
                            ) : (
                              <span className="text-[9px] px-1 bg-slate-200 text-slate-600 rounded">
                                Prévia
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {player.club}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Vaga livre
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenSlot(slot)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                      >
                        {player ? 'Trocar' : '+ Escalar'}
                      </button>
                      {player && (
                        <button
                          onClick={() => handleRemoveFromStarter(slot.slotId, player.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Remover para o banco"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bench / Reservas Adquiridos */}
          <div 
            id="squad-bench-card"
            onDragOver={handleDragOverBench}
            onDragLeave={() => setIsBenchDragOver(false)}
            onDrop={handleDropOnBench}
            className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
              isBenchDragOver
                ? 'border-emerald-500 bg-emerald-50/70 ring-4 ring-emerald-500/20 shadow-lg'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reservas Comprados no Leilão ({benchPlayerIds.length})</span>
              </h4>
              {benchPlayerIds.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <GripVertical className="w-3 h-3" /> Arraste para o campo
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Clique e arraste qualquer reserva diretamente para as vagas do campinho tático.
            </p>

            {/* Drop helper highlight when dragging from pitch */}
            {isBenchDragOver && (
              <div className="mb-3 p-3 bg-emerald-100/90 border-2 border-dashed border-emerald-500 rounded-xl text-center text-xs font-black text-emerald-900 animate-pulse flex items-center justify-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-emerald-700" />
                <span>Solte aqui para mover para o Banco de Reservas</span>
              </div>
            )}

            {benchPlayerIds.length > 0 ? (
              <div className="space-y-2">
                {benchPlayerIds.map((pId) => {
                  const player = players.find((p) => p.id === pId);
                  if (!player) return null;
                  const badge = getPositionBadge(player.position);
                  const isBeingDragged = draggedItem?.playerId === pId;

                  return (
                    <div
                      key={pId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, { playerId: pId, from: 'bench' })}
                      onDragEnd={handleDragEnd}
                      className={`p-2.5 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:shadow-md rounded-xl flex items-center justify-between text-xs transition-all cursor-grab active:cursor-grabbing select-none group ${
                        isBeingDragged ? 'opacity-40 ring-2 ring-emerald-500 scale-98' : ''
                      }`}
                      title="Arraste para o campinho ou clique em Escalar"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-slate-400 group-hover:text-emerald-700 transition-colors shrink-0">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${badge.bgClass} ${badge.textClass} shrink-0`}>
                          {player.position}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate group-hover:text-emerald-950">
                            {player.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {player.club}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-extrabold text-emerald-700 hidden sm:inline">
                          {formatCurrency(player.soldTo?.amount || player.initialPrice, true)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAssignFromBench(pId);
                          }}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-2xs transition-all active:scale-95 cursor-pointer"
                          title="Escalar automaticamente no campo"
                        >
                          Escalar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-100">
                Você ainda não comprou jogadores no leilão. Participe dos lances na Seção 1 para arrematar craques!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Feedback Toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            feedbackToast.type === 'success' ? 'bg-emerald-500 text-slate-950' :
            feedbackToast.type === 'swap' ? 'bg-amber-500 text-slate-950' : 'bg-blue-500 text-white'
          }`}>
            {feedbackToast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
             feedbackToast.type === 'swap' ? <ArrowRightLeft className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <span className="text-xs font-bold">{feedbackToast.message}</span>
        </div>
      )}

      {/* Player Picker Modal */}
      <PlayerPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        slot={activeSlot}
        players={players}
        ownedPlayerIds={ownedPlayerIds}
        currentAssignedPlayerId={activeSlot ? starterSlots[activeSlot.slotId] || null : null}
        onSelectPlayer={handleSelectPlayerForSlot}
      />
    </div>
  );
};
