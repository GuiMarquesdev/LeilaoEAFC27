import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Lock, Sparkles, RefreshCw, Check, 
  Share2, ArrowRightLeft, DollarSign, Trophy, Info, Trash2,
  GripVertical, CheckCircle2, ArrowDownCircle, Target, Star,
  ListPlus, ExternalLink, Plus, UserPlus
} from 'lucide-react';
import { Player, UserProfile, UserSquad, FormationSlot, TacticalFormation, AuctionState } from '../types';
import { INITIAL_FORMATIONS } from '../data/initialPlayers';
import { formatCurrency, getPositionBadge, isCompatiblePosition } from '../utils/formatters';
import { playBidSound } from '../utils/sound';
import { getWatchlist, toggleWatchlistPlayer, setWatchlistFromConcept } from '../utils/watchlist';
import { PlayerPickerModal } from './PlayerPickerModal';
import { ConceptToTargetsModal } from './ConceptToTargetsModal';
import { BenchPlayerPickerModal } from './BenchPlayerPickerModal';

interface SquadPlannerSectionProps {
  currentUser: UserProfile | null;
  players: Player[];
  userSquad: UserSquad | null;
  auction?: AuctionState;
  onSaveSquad: (formationId: string, starterSlots: { [slotId: string]: string | null }, benchPlayerIds: string[]) => Promise<void>;
  onOpenAuth: () => void;
  watchedPlayerIds?: string[];
  onToggleWatch?: (playerId: string) => void;
  onOpenWatchlist?: () => void;
  onNavigateToAuction?: () => void;
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
  auction,
  onSaveSquad,
  onOpenAuth,
  watchedPlayerIds,
  onToggleWatch,
  onOpenWatchlist,
  onNavigateToAuction,
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

  // Watchlist synchronization
  const [localWatchedIds, setLocalWatchedIds] = useState<string[]>(() =>
    watchedPlayerIds && watchedPlayerIds.length > 0
      ? watchedPlayerIds
      : getWatchlist(currentUser?.id)
  );

  useEffect(() => {
    if (watchedPlayerIds) {
      setLocalWatchedIds(watchedPlayerIds);
    }
  }, [watchedPlayerIds]);

  // Concept to Targets modal state
  const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);
  const [isBenchPickerOpen, setIsBenchPickerOpen] = useState(false);

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

  // Estados Oficiais do Leilão
  const isAuctionActive = auction?.status === 'ACTIVE';
  const isAuctionEnded = auction?.status === 'ENDED';
  const isAuctionNotActive = !isAuctionActive && !isAuctionEnded;

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

  // REGRA 1 & 2: Quando o leilão NÃO ESTIVER ATIVO ou ESTIVER ATIVO (lances rolando),
  // o elenco montado como conceito pelos usuários é mantido e salvo conforme o planejamento.
  // Novos atletas comprados no leilão entram no banco de reservas sem apagar os alvos planejados.
  useEffect(() => {
    if (!currentUser || isAuctionEnded) return;
    const currentStarterPlayerIds = Object.values(starterSlots).filter(Boolean) as string[];

    setBenchPlayerIds((prevBench) => {
      let changed = false;
      const newBench = [...prevBench];

      // 1. Todo jogador comprado pelo usuário que NÃO estiver nos titulares entra no banco de reservas
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
        onSaveSquad(selectedFormationId, starterSlots, filteredBench);
        return filteredBench;
      }
      return prevBench;
    });
  }, [ownedPlayerIds.length, starterSlots, currentUser, selectedFormationId, isAuctionEnded]);

  // REGRA 3: Quando o leilão for FINALIZADO (ENDED):
  // O elenco de conceito montado pelos usuários é resetado e os jogadores que ele obteve
  // no leilão substituem oficialmente o elenco conceito anterior nos titulares e no banco!
  useEffect(() => {
    if (!currentUser || !isAuctionEnded) return;

    const currentStarterIds = Object.values(starterSlots).filter(Boolean) as string[];
    const hasUnownedStarters = currentStarterIds.some((id) => !ownedPlayerIds.includes(id));
    const hasUnownedBench = benchPlayerIds.some((id) => !ownedPlayerIds.includes(id));
    const unplacedWon = ownedPlayerIds.filter(
      (id) => !currentStarterIds.includes(id) && !benchPlayerIds.includes(id)
    );

    // Se houver atletas de conceito não comprados ou atletas comprados ainda fora da prancheta
    if (hasUnownedStarters || hasUnownedBench || unplacedWon.length > 0) {
      const formation =
        INITIAL_FORMATIONS.find((f) => f.id === selectedFormationId) || INITIAL_FORMATIONS[0];

      const newSlots: { [slotId: string]: string | null } = {};
      formation.slots.forEach((s) => (newSlots[s.slotId] = null));

      const unassignedWon = [...ownedPlayers];

      // Pass 0: Manter titulares conquistados que já estavam em slots compatíveis
      formation.slots.forEach((slot) => {
        const currentPid = starterSlots[slot.slotId];
        if (currentPid && ownedPlayerIds.includes(currentPid)) {
          const pObj = ownedPlayers.find((p) => p.id === currentPid);
          if (pObj && isCompatiblePosition(slot.role, pObj.position)) {
            newSlots[slot.slotId] = currentPid;
            const idx = unassignedWon.findIndex((p) => p.id === currentPid);
            if (idx !== -1) unassignedWon.splice(idx, 1);
          }
        }
      });

      // Pass 1: Preencher slots com atletas de função exata conquistados no leilão
      formation.slots.forEach((slot) => {
        if (newSlots[slot.slotId]) return;
        const matchIdx = unassignedWon.findIndex((p) => p.position === slot.role);
        if (matchIdx !== -1) {
          newSlots[slot.slotId] = unassignedWon[matchIdx].id;
          unassignedWon.splice(matchIdx, 1);
        }
      });

      // Pass 2: Preencher com atletas de posição tática compatível
      formation.slots.forEach((slot) => {
        if (newSlots[slot.slotId]) return;
        const matchIdx = unassignedWon.findIndex((p) => isCompatiblePosition(slot.role, p.position));
        if (matchIdx !== -1) {
          newSlots[slot.slotId] = unassignedWon[matchIdx].id;
          unassignedWon.splice(matchIdx, 1);
        }
      });

      // Pass 3: Preencher vagas de linha restantes
      formation.slots.forEach((slot) => {
        if (newSlots[slot.slotId]) return;
        const matchIdx = unassignedWon.findIndex((p) => {
          if (slot.role === 'GOL') return p.position === 'GOL';
          return p.position !== 'GOL';
        });
        if (matchIdx !== -1) {
          newSlots[slot.slotId] = unassignedWon[matchIdx].id;
          unassignedWon.splice(matchIdx, 1);
        }
      });

      // Atletas excedentes conquistados vão para o banco de reservas oficial
      const newBench = unassignedWon.map((p) => p.id);

      setStarterSlots(newSlots);
      setBenchPlayerIds(newBench);
      onSaveSquad(selectedFormationId, newSlots, newBench);
      showFeedback('Leilão Finalizado: Elenco conceito resetado e substituído pelo seu time oficial!', 'success');
    }
  }, [isAuctionEnded, currentUser, ownedPlayerIds.length, selectedFormationId]);

  const currentFormation: TacticalFormation =
    INITIAL_FORMATIONS.find((f) => f.id === selectedFormationId) || INITIAL_FORMATIONS[0];

  // Cálculos do Elenco de Conceito e Alvos do Leilão (Titulares + Banco de Reservas)
  const assignedStarterIds = Object.values(starterSlots).filter(Boolean) as string[];
  const conceptPlayerIds = Array.from(new Set([...assignedStarterIds, ...benchPlayerIds]));
  // Atletas que ainda não foram comprados e são os alvos planejados pelo usuário para o leilão (tanto titulares quanto reservas)
  const conceptTargetPlayerIds = conceptPlayerIds.filter((id) => !ownedPlayerIds.includes(id));
  const conceptTargetPlayers = conceptTargetPlayerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));

  const totalConceptTargetsCost = conceptTargetPlayers.reduce((sum, p) => sum + p.initialPrice, 0);
  const alreadyTargetedCount = conceptTargetPlayerIds.filter((id) =>
    localWatchedIds.includes(id)
  ).length;
  const allTargeted =
    conceptTargetPlayerIds.length > 0 && alreadyTargetedCount === conceptTargetPlayerIds.length;

  const conceptStartersTargetCount = conceptTargetPlayerIds.filter((id) =>
    assignedStarterIds.includes(id)
  ).length;
  const conceptBenchTargetCount = conceptTargetPlayerIds.filter((id) =>
    benchPlayerIds.includes(id)
  ).length;

  const conceptBreakdownText =
    conceptBenchTargetCount > 0
      ? `${conceptStartersTargetCount} titular${conceptStartersTargetCount !== 1 ? 'es' : ''} e ${conceptBenchTargetCount} reserva${conceptBenchTargetCount !== 1 ? 's' : ''}`
      : `${conceptStartersTargetCount} titular${conceptStartersTargetCount !== 1 ? 'es' : ''}`;

  const handleOpenTransferModal = () => {
    if (conceptTargetPlayerIds.length === 0) {
      showFeedback('Adicione pelo menos um jogador no campinho ou no banco para transferir para seus alvos.', 'swap');
      return;
    }
    setIsConceptModalOpen(true);
  };

  const handleConfirmTransferToTargets = (mode: 'merge' | 'replace') => {
    const res = setWatchlistFromConcept(currentUser?.id, conceptTargetPlayerIds, mode);
    setLocalWatchedIds(res.playerIds);
    playBidSound();
    showFeedback(
      `🎯 ${conceptTargetPlayerIds.length} jogadores do elenco de conceito foram definidos como seus ALVOS no leilão!`,
      'success'
    );
  };

  const handleToggleSingleWatch = (playerId: string) => {
    if (onToggleWatch) {
      onToggleWatch(playerId);
    } else {
      const res = toggleWatchlistPlayer(currentUser?.id, playerId);
      setLocalWatchedIds(res.playerIds);
    }
  };

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

  const handleAddPlayerToBench = (playerId: string) => {
    if (benchPlayerIds.includes(playerId)) return;
    const newBench = [...benchPlayerIds, playerId];
    setBenchPlayerIds(newBench);
    if (currentUser) {
      onSaveSquad(selectedFormationId, starterSlots, newBench);
    }
    const addedPlayer = players.find((p) => p.id === playerId);
    if (addedPlayer) {
      showFeedback(`📋 ${addedPlayer.name} adicionado ao Banco de Reservas!`, 'bench');
    }
  };

  const handleRemoveFromBench = (playerId: string) => {
    // Apenas jogadores NÃO comprados podem ser removidos do banco (jogadores comprados permanecem obrigatoriamente no elenco)
    if (ownedPlayerIds.includes(playerId)) {
      showFeedback('Jogadores arrematados no leilão pertencem ao seu elenco e não podem ser excluídos.', 'bench');
      return;
    }
    const newBench = benchPlayerIds.filter((id) => id !== playerId);
    setBenchPlayerIds(newBench);
    if (currentUser) {
      onSaveSquad(selectedFormationId, starterSlots, newBench);
    }
    const removedPlayer = players.find((p) => p.id === playerId);
    if (removedPlayer) {
      showFeedback(`🗑️ ${removedPlayer.name} removido do banco de conceito.`, 'swap');
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
    const newBench = benchPlayerIds.filter((pId) => ownedPlayerIds.includes(pId));
    setStarterSlots(newSlots);
    setBenchPlayerIds(newBench);
    if (currentUser) onSaveSquad(selectedFormationId, newSlots, newBench);
    showFeedback('Prévia limpa: mantidos apenas os jogadores contratados pelo seu clube.', 'swap');
  };

  const handleCopyTeamSheet = () => {
    let text = `📋 ESCALAÇÃO KHEDIRA LEAGUE - ${currentUser?.teamName || 'Meu Time'}\n`;
    text += `Formação: ${currentFormation.name}\n\nTITULARES:\n`;

    currentFormation.slots.forEach((slot) => {
      const pId = starterSlots[slot.slotId];
      const player = pId ? players.find((p) => p.id === pId) : null;
      const isOwned = pId ? ownedPlayerIds.includes(pId) : false;
      text += `${slot.role}: ${player ? `${player.name}${isOwned ? ' [Comprado]' : ' [Planejado]'}` : '(Vazio)'}\n`;
    });

    if (benchPlayerIds.length > 0) {
      text += `\nBANCO DE RESERVAS:\n`;
      benchPlayerIds.forEach((pId) => {
        const player = players.find((p) => p.id === pId);
        if (player) text += `- ${player.name} (${player.position})\n`;
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
              title={isAuctionEnded ? "Manter apenas jogadores oficiais do clube" : "Manter apenas jogadores comprados no leilão"}
            >
              {isAuctionEnded ? 'Limpar Reservas Não Oficiais' : 'Limpar Prévia'}
            </button>

            {/* Pass Concept Squad to Auction Targets (desativado quando o leilão já finalizou) */}
            <button
              onClick={handleOpenTransferModal}
              disabled={isAuctionEnded || conceptTargetPlayerIds.length === 0}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                isAuctionEnded || conceptTargetPlayerIds.length === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : allTargeted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 font-extrabold shadow-2xs active:scale-95'
              }`}
              title={
                isAuctionEnded
                  ? 'O leilão já foi finalizado. O elenco oficial do clube está definido.'
                  : 'Passar todos os jogadores do elenco de conceito para os seus Alvos no Leilão'
              }
            >
              <Target className="w-3.5 h-3.5" />
              <span>
                {isAuctionEnded
                  ? 'Leilão Finalizado'
                  : allTargeted
                  ? 'Alvos Sincronizados ✓'
                  : `Passar para Alvos (${conceptTargetPlayerIds.length})`}
              </span>
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
          <>
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Elenco do Clube
                  </span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                    ownedPlayers.length >= 23 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {ownedPlayers.length >= 23 ? '23/23 Cheio' : `${23 - ownedPlayers.length} vagas`}
                  </span>
                </div>
                <span className="text-base font-extrabold text-slate-800 flex items-center gap-1 font-['Outfit',sans-serif]">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  {ownedPlayers.length} / 23 jogadores
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

            {ownedPlayers.length >= 23 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-950 font-medium">
                <Users className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Limite de 23 jogadores atingido:</strong> Seu elenco atingiu a cota máxima permitida pela Khedira League (11 titulares + 12 reservas). Novos lances de compra estão bloqueados.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
            <span className="text-amber-900 font-medium">
              Conecte seu Gmail para acompanhar seu orçamento de € 400M e salvar seu time oficial da Khedira League.
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

      {/* Dynamic Auction State & Squad Mode Banner (Checagem dos 3 Estados do Leilão) */}
      {isAuctionEnded ? (
        <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-teal-500/15 border border-amber-300/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300 rounded-md">
                  Leilão Finalizado
                </span>
                <span className="text-sm font-extrabold text-slate-900">
                  Elenco Oficial de Temporada Definido
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                O leilão foi encerrado! O elenco de conceito anterior foi resetado e substituído oficialmente pelos <strong>{ownedPlayers.length} atletas</strong> conquistados pelo seu clube no leilão da Khedira League.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="px-3.5 py-1.5 text-xs font-black bg-white text-emerald-800 border border-emerald-200 rounded-xl shadow-2xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{ownedPlayers.length} / 23 Jogadores Oficiais</span>
            </span>
          </div>
        </div>
      ) : isAuctionActive ? (
        <div className="bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-blue-500/15 border border-emerald-300/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0 relative mt-0.5 sm:mt-0">
              <Sparkles className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-md flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  Leilão Ativo — Lances Rolando
                </span>
                <span className="text-sm font-extrabold text-slate-900">
                  Elenco Conceito Mantido no Leilão
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                O leilão está ao vivo! Seu elenco de conceito está sendo mantido para você monitorar e disputar seus {conceptTargetPlayerIds.length} alvos planejados em tempo real na prancheta.
              </p>
            </div>
          </div>
          {onNavigateToAuction && (
            <button
              type="button"
              onClick={onNavigateToAuction}
              className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 self-end sm:self-center active:scale-95"
            >
              <span>Ir para Lances ao Vivo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-300 rounded-md">
                  {auction?.status === 'PAUSED' ? 'Leilão Pausado' : 'Leilão Não Ativo (Pré-Temporada)'}
                </span>
                <span className="text-sm font-extrabold text-slate-900">
                  Elenco Conceito Mantido para Planejamento
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                O leilão não está ativo no momento. Seu elenco montado como conceito é mantido para você planejar a equipe, salvar a formação e definir seus alvos antes da abertura dos lances.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="px-3.5 py-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-xl shadow-2xs">
              {conceptPlayerIds.length} Planejados ({ownedPlayers.length} Comprados)
            </span>
          </div>
        </div>
      )}

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
                <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  {isAuctionEnded ? 'Titular Oficial' : 'Adquirido'}
                </span>
                {!isAuctionEnded && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                    Em Prévia
                  </span>
                )}
              </div>
            </div>

            {/* Concept Squad to Auction Targets Strategy Banner (Apenas enquanto o leilão não foi finalizado) */}
            {!isAuctionEnded && (
              <div className="mb-4 p-3 sm:p-4 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-emerald-500/10 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-black">
                    <Target className="w-5 h-5 text-slate-950" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        Estratégia: Passar Elenco de Conceito para Alvos do Leilão
                      </h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        allTargeted
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        {alreadyTargetedCount} de {conceptTargetPlayerIds.length} no Radar
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {conceptTargetPlayerIds.length === 0
                        ? 'Escale atletas titulares no campinho ou adicione reservas no banco para transferir seu planejamento para a lista de alvos do leilão.'
                        : allTargeted
                        ? `Todos os ${conceptTargetPlayerIds.length} jogadores do seu elenco de conceito (${conceptBreakdownText}) já estão sincronizados como Alvos no Radar do Leilão!`
                        : `Transfira seu elenco de conceito (${conceptTargetPlayerIds.length} atletas: ${conceptBreakdownText}) para o Radar de Alvos do Leilão e monitore os lances em tempo real.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  {onOpenWatchlist && (
                    <button
                      onClick={onOpenWatchlist}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-white/80 rounded-xl border border-slate-200/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                      title="Abrir Radar de Alvos completo"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>Ver Alvos</span>
                    </button>
                  )}

                  <button
                    onClick={handleOpenTransferModal}
                    disabled={conceptTargetPlayerIds.length === 0}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto ${
                      conceptTargetPlayerIds.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : allTargeted
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>{allTargeted ? 'Alvos Sincronizados ✓' : 'Passar para Alvos'}</span>
                  </button>
                </div>
              </div>
            )}

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
                const isTargeted = Boolean(player && !isOwnedByMe && localWatchedIds.includes(player.id));

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
                            ) : isTargeted ? (
                              <Target className="w-2.5 h-2.5 mx-auto mt-0.5 text-amber-300" />
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

                        {/* Target badge on node */}
                        {isTargeted && !isSlotHovered && (
                          <span 
                            className="absolute -top-1.5 -left-1.5 bg-amber-400 text-slate-950 p-0.5 rounded-full shadow-md border border-amber-300 ring-2 ring-amber-400/40 z-20"
                            title="Atleta Definido como Alvo do Leilão"
                          >
                            <Target className="w-2.5 h-2.5" />
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
                              : isTargeted
                              ? 'bg-amber-950/90 text-amber-100 border border-amber-400/80 shadow-amber-500/20'
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
                          ? `${player.name.split(' ').slice(-1)[0]}${isTargeted ? ' 🎯' : ''}`
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span>Titulares ({currentFormation.name})</span>
                <span className="text-[11px] font-normal text-slate-400">
                  {startersCount}/11 vagas
                </span>
              </h4>
              {conceptTargetPlayerIds.length > 0 && (
                <button
                  onClick={handleOpenTransferModal}
                  className="text-[10px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  title="Passar jogadores do elenco de conceito para os alvos do leilão"
                >
                  <Target className="w-3 h-3 text-amber-700" />
                  <span>Alvos ({alreadyTargetedCount}/{conceptTargetPlayerIds.length})</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {currentFormation.slots.map((slot) => {
                const assignedPlayerId = starterSlots[slot.slotId];
                const player = assignedPlayerId
                  ? players.find((p) => p.id === assignedPlayerId)
                  : null;
                const isOwned = assignedPlayerId
                  ? ownedPlayerIds.includes(assignedPlayerId)
                  : false;
                const isTargeted = Boolean(player && !isOwned && localWatchedIds.includes(player.id));
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
                          : isTargeted
                          ? 'bg-amber-50/80 border-amber-200/90 hover:border-amber-300'
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
                            ) : isTargeted ? (
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded flex items-center gap-0.5" title="Definido como Alvo do Leilão">
                                <Target className="w-2.5 h-2.5 text-amber-700" /> Alvo
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 bg-slate-200 text-slate-600 rounded">
                                Prévia
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Vaga livre
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {player && !isOwned && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSingleWatch(player.id);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isTargeted
                              ? 'text-amber-500 hover:text-amber-600 bg-amber-100/60'
                              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                          }`}
                          title={isTargeted ? 'Remover dos Alvos' : 'Definir como Alvo do Leilão'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isTargeted ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      )}
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

          {/* Bench / Banco de Reservas (Comprados no Leilão + Planejados no Conceito) */}
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
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Banco de Reservas ({benchPlayerIds.length})</span>
                </h4>
                {benchPlayerIds.some((pId) => !ownedPlayerIds.includes(pId)) && (
                  <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-md flex items-center gap-1" title="Jogadores adicionados como alvos de conceito para o leilão">
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                    {benchPlayerIds.filter((pId) => !ownedPlayerIds.includes(pId)).length} Planejados
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBenchPickerOpen(true)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                  title="Adicionar jogador reserva ao seu elenco de conceito"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Reserva</span>
                </button>
                {benchPlayerIds.length > 0 && (
                  <span className="hidden sm:flex text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full items-center gap-1">
                    <GripVertical className="w-3 h-3" /> Arraste para o campo
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Arraste reservas para as vagas do campo ou clique em <strong className="text-slate-600">Adicionar Reserva</strong> para planejar seu banco de conceito.
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
                  const isOwned = ownedPlayerIds.includes(pId);
                  const badge = getPositionBadge(player.position);
                  const isBeingDragged = draggedItem?.playerId === pId;

                  return (
                    <div
                      key={pId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, { playerId: pId, from: 'bench' })}
                      onDragEnd={handleDragEnd}
                      className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition-all cursor-grab active:cursor-grabbing select-none group border ${
                        isOwned
                          ? 'bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:shadow-md'
                          : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md'
                      } ${isBeingDragged ? 'opacity-40 ring-2 ring-emerald-500 scale-98' : ''}`}
                      title={isOwned ? "Jogador comprado — Arraste para o campinho ou clique em Escalar" : "Jogador de conceito — Arraste para o campinho, escale ou transfira para os alvos"}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-slate-400 group-hover:text-emerald-700 transition-colors shrink-0">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${badge.bgClass} ${badge.textClass} shrink-0`}>
                          {player.position}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 block truncate group-hover:text-emerald-950">
                              {player.name}
                            </span>
                            {isOwned ? (
                              <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded">
                                Comprado
                              </span>
                            ) : (
                              <span className="px-1 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-extrabold rounded flex items-center gap-0.5">
                                <Sparkles className="w-2 h-2 text-amber-600" />
                                Alvo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-extrabold hidden sm:inline ${
                          isOwned ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
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

                        {!isOwned && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromBench(pId);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover do banco planejado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-2">
                <span>Nenhum jogador no banco de reservas.</span>
                <button
                  type="button"
                  onClick={() => setIsBenchPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Reserva ao Conceito
                </button>
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
        isAuctionEnded={isAuctionEnded}
      />

      {/* Concept Squad to Auction Targets Modal */}
      <ConceptToTargetsModal
        isOpen={isConceptModalOpen}
        onClose={() => setIsConceptModalOpen(false)}
        conceptPlayers={conceptTargetPlayers}
        alreadyTargetedIds={localWatchedIds}
        userBudget={currentUser?.budget || 400000000}
        starterPlayerIds={assignedStarterIds}
        benchPlayerIds={benchPlayerIds}
        onConfirmTransfer={handleConfirmTransferToTargets}
        onNavigateToAuction={onNavigateToAuction}
      />

      {/* Bench Player Picker Modal */}
      <BenchPlayerPickerModal
        isOpen={isBenchPickerOpen}
        onClose={() => setIsBenchPickerOpen(false)}
        players={players}
        benchPlayerIds={benchPlayerIds}
        starterPlayerIds={assignedStarterIds}
        ownedPlayerIds={ownedPlayerIds}
        targetedPlayerIds={localWatchedIds}
        onAddPlayerToBench={handleAddPlayerToBench}
        isAuctionEnded={isAuctionEnded}
      />
    </div>
  );
};
