import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Lock, Sparkles, RefreshCw, Check, 
  Share2, ArrowRightLeft, DollarSign, Trophy, Info, Trash2,
  GripVertical, CheckCircle2, ArrowDownCircle, Target, Star,
  ListPlus, ExternalLink, Plus, UserPlus, X, Search, ChevronRight
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

  // Drag and drop & Tap-to-Swap substitution states (Mobile & Desktop Friendly)
  const [draggedItem, setDraggedItem] = useState<DragItemData | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<DragItemData | null>(null);
  const [slotActionMenu, setSlotActionMenu] = useState<{
    slot: FormationSlot;
    player: Player;
    isOwned: boolean;
  } | null>(null);
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

  // Core substitution function supporting both Touch Tap-to-Swap and Desktop Drag-and-Drop
  const executeSubstitution = (data: DragItemData, targetSlotId: string) => {
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
        if (!newBench.includes(existingPlayerId)) {
          newBench.push(existingPlayerId);
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
        setSelectedForSwap(null);
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
    setSelectedForSwap(null);
    playBidSound();

    if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, newBench);
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

    executeSubstitution(data, targetSlotId);
  };

  const handleDragOverBench = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isBenchDragOver) {
      setIsBenchDragOver(true);
    }
  };

  const handleMoveStarterToBench = (sourceSlotId: string, playerId: string) => {
    const newSlots = { ...starterSlots, [sourceSlotId]: null };
    let newBench = [...benchPlayerIds];

    if (!newBench.includes(playerId)) {
      newBench.push(playerId);
    }

    setStarterSlots(newSlots);
    setBenchPlayerIds(newBench);
    setDraggedItem(null);
    setSelectedForSwap(null);
    playBidSound();

    const player = players.find((p) => p.id === playerId);
    if (player) {
      showFeedback(`📋 ${player.name} movido para o Banco de Reservas.`, 'bench');
    }

    if (currentUser) {
      onSaveSquad(selectedFormationId, newSlots, newBench);
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

    handleMoveStarterToBench(data.sourceSlotId, data.playerId);
  };

  // Direct Click/Tap on Tactical Slot (Mobile & Desktop Friendly)
  const handleSlotClick = (slot: FormationSlot) => {
    const assignedPlayerId = starterSlots[slot.slotId];

    // If already in Tap-to-Swap mode:
    if (selectedForSwap) {
      // If user taps the exact same slot that was already selected, cancel swap mode
      if (selectedForSwap.from === 'slot' && selectedForSwap.sourceSlotId === slot.slotId) {
        setSelectedForSwap(null);
        return;
      }
      // Execute substitution!
      executeSubstitution(selectedForSwap, slot.slotId);
      return;
    }

    // Not in swap mode:
    if (assignedPlayerId) {
      const player = players.find((p) => p.id === assignedPlayerId);
      if (player) {
        const isOwned = ownedPlayerIds.includes(assignedPlayerId);
        setSlotActionMenu({ slot, player, isOwned });
      }
    } else {
      // Empty slot -> open picker
      handleOpenSlot(slot);
    }
  };

  // Direct Click/Tap on Bench Player
  const handleBenchPlayerClick = (benchPlayerId: string) => {
    if (selectedForSwap) {
      if (selectedForSwap.from === 'slot' && selectedForSwap.sourceSlotId) {
        // User had a pitch starter selected, now clicked a bench player -> swap them!
        const targetSlotId = selectedForSwap.sourceSlotId;
        const starterPlayerId = selectedForSwap.playerId;
        const benchPlayer = players.find((p) => p.id === benchPlayerId);
        const starterPlayer = players.find((p) => p.id === starterPlayerId);
        const targetSlot = currentFormation.slots.find((s) => s.slotId === targetSlotId);

        const newSlots = { ...starterSlots, [targetSlotId]: benchPlayerId };
        let newBench = benchPlayerIds.filter((id) => id !== benchPlayerId);
        if (!newBench.includes(starterPlayerId)) {
          newBench.push(starterPlayerId);
        }

        setStarterSlots(newSlots);
        setBenchPlayerIds(newBench);
        setSelectedForSwap(null);
        playBidSound();
        showFeedback(
          `🔄 ${benchPlayer?.name} entrou como titular em ${targetSlot?.role || ''} no lugar de ${starterPlayer?.name}!`,
          'swap'
        );

        if (currentUser) {
          onSaveSquad(selectedFormationId, newSlots, newBench);
        }
        return;
      } else if (selectedForSwap.from === 'bench') {
        if (selectedForSwap.playerId === benchPlayerId) {
          setSelectedForSwap(null);
        } else {
          setSelectedForSwap({ playerId: benchPlayerId, from: 'bench' });
        }
        return;
      }
    }

    // Not in swap mode -> activate swap mode for this bench player!
    setSelectedForSwap({ playerId: benchPlayerId, from: 'bench' });
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

            {/* Helper bar for mobile and desktop substitution */}
            <div className="flex items-center justify-between gap-2 px-1 mb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" /> Substituição por Toque:
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-500">
                  Toque em qualquer titular ou reserva para trocar de posição diretamente no campo.
                </span>
                <span className="sm:hidden text-[11px] text-slate-500">
                  Toque no atleta para trocar no campo.
                </span>
              </div>
              {selectedForSwap && (
                <button
                  type="button"
                  onClick={() => setSelectedForSwap(null)}
                  className="text-[11px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" /> Cancelar Troca
                </button>
              )}
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

              {/* Active Dragging or Tap-to-Swap Banner Overlay */}
              {(draggedItem || selectedForSwap) && (
                <div className="absolute top-3 left-3 right-3 z-30 bg-slate-950/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl border-2 border-amber-400 shadow-2xl flex items-center justify-between text-xs animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <span className="font-black text-amber-300 truncate">
                      {(selectedForSwap || draggedItem)?.from === 'bench' ? '⚡ Escalando reserva:' : '🔄 Substituindo:'}{' '}
                      {players.find(p => p.id === (selectedForSwap || draggedItem)?.playerId)?.name} ({players.find(p => p.id === (selectedForSwap || draggedItem)?.playerId)?.position})
                    </span>
                    <span className="text-slate-300 text-[11px] hidden sm:inline">
                      — Toque na posição desejada para confirmar
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedForSwap(null);
                      setDraggedItem(null);
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg shadow-sm transition-all active:scale-95 shrink-0 ml-2 cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
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

                const activeSwapOrDrag = selectedForSwap || draggedItem;
                const isThisSelected = activeSwapOrDrag?.playerId === assignedPlayerId;
                const swappingPlayer = activeSwapOrDrag ? players.find((p) => p.id === activeSwapOrDrag.playerId) : null;
                const isCompatible = swappingPlayer ? isCompatiblePosition(slot.role, swappingPlayer.position) : false;
                const isSlotHovered = dragOverSlotId === slot.slotId;
                const isDraggingAny = Boolean(activeSwapOrDrag);

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
                      isSlotHovered || isThisSelected ? 'z-30 scale-110' : isDraggingAny ? 'z-20' : ''
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
                      onClick={() => handleSlotClick(slot)}
                      className={`group relative flex flex-col items-center justify-center transition-all touch-manipulation cursor-pointer ${
                        assignedPlayerId ? 'active:scale-95' : ''
                      }`}
                      title={
                        assignedPlayerId
                          ? `${player?.name} (${player?.position}) - Toque para opções ou arraste para trocar`
                          : `Vaga livre (${slot.role}) - Toque para escalar ou escolher reserva`
                      }
                    >
                      {/* Node Avatar / Circle */}
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg font-bold text-xs transition-all border-2 relative ${
                          isThisSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-400/80 shadow-2xl scale-115 animate-bounce'
                            : isSlotHovered
                            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-300/80 shadow-2xl scale-110'
                            : isDraggingAny && isCompatible
                            ? 'bg-emerald-900/90 text-emerald-100 border-emerald-400 ring-4 ring-emerald-400/70 animate-pulse shadow-emerald-500/50'
                            : isDraggingAny
                            ? 'bg-slate-900/80 text-white border-dashed border-amber-300/80 ring-2 ring-white/40'
                            : player
                            ? isOwnedByMe
                              ? 'bg-emerald-950 text-emerald-200 border-emerald-400 ring-2 ring-emerald-500/40'
                              : 'bg-slate-900 text-blue-200 border-blue-400 ring-2 ring-blue-500/30'
                            : 'bg-white/20 hover:bg-white/30 text-white/90 border-dashed border-white/60 backdrop-blur-xs'
                        }`}
                      >
                        {isThisSelected ? (
                          <span className="text-[9px] font-black tracking-tight uppercase text-center leading-none">
                            Trocando
                          </span>
                        ) : isSlotHovered ? (
                          <span className="text-[10px] font-black tracking-tight uppercase">
                            {player ? 'Trocar' : 'Soltar'}
                          </span>
                        ) : isDraggingAny ? (
                          <span className="text-[9px] font-black tracking-tight uppercase text-center leading-none">
                            {player ? 'Trocar' : 'Escalar'}
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

                        {/* Compatible badge tag while dragging or in tap-to-swap */}
                        {isDraggingAny && isCompatible && !isSlotHovered && !isThisSelected && (
                          <span className="absolute -top-2.5 -right-2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-md animate-bounce border border-emerald-300 z-20">
                            Ideal
                          </span>
                        )}

                        {/* Target badge on node */}
                        {isTargeted && !isSlotHovered && !isThisSelected && (
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
                          isThisSelected
                            ? 'bg-amber-400 text-slate-950 border border-amber-300 font-black ring-2 ring-amber-300/60'
                            : isSlotHovered
                            ? 'bg-amber-400 text-slate-950 border border-amber-300 font-black'
                            : isDraggingAny && isCompatible
                            ? 'bg-emerald-950 text-emerald-200 border border-emerald-400 font-extrabold'
                            : isDraggingAny
                            ? 'bg-slate-900 text-amber-200 border border-amber-400/60'
                            : player
                            ? isOwnedByMe
                              ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-500/50'
                              : isTargeted
                              ? 'bg-amber-950/90 text-amber-100 border border-amber-400/80 shadow-amber-500/20'
                              : 'bg-slate-900/90 text-white border border-slate-700'
                            : 'bg-black/40 text-white/80'
                        }`}
                      >
                        {isThisSelected
                          ? 'Selecionado'
                          : isSlotHovered
                          ? player
                            ? `Substituir ${player.name.split(' ').slice(-1)[0]}`
                            : `Soltar em ${slot.role}`
                          : isDraggingAny
                          ? player
                            ? `Trocar c/ ${player.name.split(' ').slice(-1)[0]}`
                            : `Colocar em ${slot.role}`
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

                      {/* Swap button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedForSwap) {
                            if (selectedForSwap.from === 'slot' && selectedForSwap.sourceSlotId === slot.slotId) {
                              setSelectedForSwap(null);
                            } else {
                              executeSubstitution(selectedForSwap, slot.slotId);
                            }
                          } else if (player) {
                            setSelectedForSwap({
                              playerId: player.id,
                              from: 'slot',
                              sourceSlotId: slot.slotId,
                            });
                          } else {
                            handleOpenSlot(slot);
                          }
                        }}
                        className={`px-2 py-1 font-bold rounded-lg text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                          selectedForSwap?.playerId === player?.id
                            ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300'
                            : selectedForSwap
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold animate-pulse'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={player ? "Trocar posição ou substituir no campo" : "Escalar jogador"}
                      >
                        <RefreshCw className={`w-3 h-3 ${selectedForSwap?.playerId === player?.id ? 'animate-spin' : ''}`} />
                        <span>
                          {selectedForSwap?.playerId === player?.id
                            ? 'Trocando...'
                            : selectedForSwap
                            ? 'Trocar Aqui'
                            : player
                            ? 'Trocar'
                            : '+ Escalar'}
                        </span>
                      </button>

                      {/* Direct Search / Pick button */}
                      <button
                        type="button"
                        onClick={() => handleOpenSlot(slot)}
                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors cursor-pointer"
                        title="Buscar atleta no catálogo"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>

                      {player && (
                        <button
                          type="button"
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
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Toque em <strong className="text-slate-600">Trocar / Escalar</strong> para escolher a vaga no campinho, ou arraste com o mouse.
            </p>

            {/* Helper banner when a starter is selected for swap */}
            {selectedForSwap && selectedForSwap.from === 'slot' && (
              <div className="mb-3 p-3 bg-amber-50 border-2 border-dashed border-amber-400 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                  <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                  <span>
                    Substituindo <strong>{players.find(p => p.id === selectedForSwap.playerId)?.name}</strong>: Toque em um reserva abaixo para colocá-lo no lugar, ou:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleMoveStarterToBench(selectedForSwap.sourceSlotId!, selectedForSwap.playerId);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs shrink-0 shadow-xs transition-all cursor-pointer text-center"
                >
                  Mover para o Banco
                </button>
              </div>
            )}

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
                  const isSelected = selectedForSwap?.playerId === pId;

                  return (
                    <div
                      key={pId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, { playerId: pId, from: 'bench' })}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleBenchPlayerClick(pId)}
                      className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer select-none group border touch-manipulation ${
                        isSelected
                          ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/60 shadow-md'
                          : isOwned
                          ? 'bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:shadow-md'
                          : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md'
                      } ${isBeingDragged ? 'opacity-40 ring-2 ring-emerald-500 scale-98' : ''}`}
                      title={
                        selectedForSwap?.from === 'slot'
                          ? `Toque para colocar ${player.name} no lugar do titular selecionado`
                          : "Toque para selecionar ou arraste para o campinho"
                      }
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
                            handleBenchPlayerClick(pId);
                          }}
                          className={`px-2.5 py-1 font-bold rounded-lg text-[10px] shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300'
                              : selectedForSwap && selectedForSwap.from === 'slot'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-black animate-pulse'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                          title="Substituir titular ou escolher vaga no campo"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSelected ? 'animate-spin' : ''}`} />
                          <span>
                            {isSelected
                              ? 'Toque no Campo'
                              : selectedForSwap && selectedForSwap.from === 'slot'
                              ? 'Entrar no Lugar'
                              : 'Trocar / Escalar'}
                          </span>
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

      {/* Quick Action Modal for Pitch Slot (Mobile Friendly) */}
      {slotActionMenu && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSlotActionMenu(null)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-xs font-black text-emerald-300">
                  {slotActionMenu.slot.role}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white leading-tight">
                    {slotActionMenu.player.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${getPositionBadge(slotActionMenu.player.position).bgClass} ${getPositionBadge(slotActionMenu.player.position).textClass}`}>
                      {slotActionMenu.player.position}
                    </span>
                    <span className="text-[11px] text-slate-300 font-semibold">
                      {formatCurrency(slotActionMenu.player.soldTo?.amount || slotActionMenu.player.initialPrice, true)}
                    </span>
                    {slotActionMenu.isOwned ? (
                      <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Comprado
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3" /> Planejado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSlotActionMenu(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Action 1: Touch-to-swap on field */}
              <button
                type="button"
                onClick={() => {
                  setSelectedForSwap({
                    playerId: slotActionMenu.player.id,
                    from: 'slot',
                    sourceSlotId: slotActionMenu.slot.slotId,
                  });
                  setSlotActionMenu(null);
                }}
                className="w-full p-3.5 bg-amber-50 hover:bg-amber-100 border-2 border-amber-300/80 rounded-2xl flex items-center justify-between text-left transition-all group cursor-pointer shadow-xs active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 block">
                      Trocar no Campo (Modo Toque)
                    </span>
                    <span className="text-xs text-slate-600 block mt-0.5">
                      Toque em outro titular para inverter ou em um reserva para substituir
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-700 shrink-0" />
              </button>

              {/* Direct replacement from Bench (if bench has players) */}
              {benchPlayerIds.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      Substituir por um Reserva do Banco:
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {benchPlayerIds.length} disponível{benchPlayerIds.length !== 1 ? 'is' : ''}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {benchPlayerIds.map((bId) => {
                      const benchP = players.find((p) => p.id === bId);
                      if (!benchP) return null;
                      const isComp = isCompatiblePosition(slotActionMenu.slot.role, benchP.position);
                      const badge = getPositionBadge(benchP.position);

                      return (
                        <button
                          key={bId}
                          type="button"
                          onClick={() => {
                            executeSubstitution(
                              { playerId: bId, from: 'bench' },
                              slotActionMenu.slot.slotId
                            );
                            setSlotActionMenu(null);
                          }}
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all hover:shadow-xs cursor-pointer active:scale-98 ${
                            isComp
                              ? 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-300'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${badge.bgClass} ${badge.textClass} shrink-0`}>
                              {benchP.position}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {benchP.name}
                            </span>
                            {isComp && (
                              <span className="text-[9px] font-extrabold bg-emerald-200 text-emerald-900 px-1 py-0.2 rounded shrink-0">
                                Posição Ideal
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-black text-emerald-800 bg-white border border-emerald-300 px-2 py-0.5 rounded-lg shrink-0 shadow-2xs">
                            Entrar no lugar
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Secondary Actions */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const s = slotActionMenu.slot;
                    setSlotActionMenu(null);
                    handleOpenSlot(s);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4 text-slate-600" />
                  <span>Buscar no Catálogo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRemoveFromStarter(slotActionMenu.slot.slotId, slotActionMenu.player.id);
                    setSlotActionMenu(null);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowDownCircle className="w-4 h-4 text-amber-700" />
                  <span>Mover para o Banco</span>
                </button>
              </div>
            </div>
          </div>
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
