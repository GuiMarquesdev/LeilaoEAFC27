import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Gavel, Clock, ArrowUpRight, DollarSign, UserCheck, 
  Flame, CheckCircle2, ChevronRight, Search, 
  AlertCircle, Shield, Plus, Crown, Volume2, SkipForward,
  Play, Square, Sparkles, Trophy, Users as UsersIcon, RotateCcw,
  Lock, Unlock, FileText, ShieldAlert, ShieldCheck, Calendar, Star,
  ListOrdered, Trash2, Loader2, Wallet, Coins, LayoutGrid, X, Filter
} from 'lucide-react';
import { AuctionState, Player, UserProfile, Bid } from '../types';
import { formatCurrency, getPositionBadge, getDayLabel, isPositionAllowedForDay, getUserRoleBadge, formatAuctionTimer, getPlayerActiveBid, getPlayerEffectivePrice } from '../utils/formatters';
import { playBidSound, playHammerSound, playTickSound } from '../utils/sound';
import { JudgeGavelIcon } from './JudgeGavelIcon';
import { WatchlistRadarWidget } from './WatchlistRadarWidget';
import { QuickBidModal } from './QuickBidModal';

interface LiveAuctionSectionProps {
  auction: AuctionState;
  currentUser: UserProfile | null;
  players: Player[];
  users: UserProfile[];
  watchedPlayerIds?: string[];
  onToggleWatch?: (playerId: string) => void;
  onOpenWatchlist?: () => void;
  onBid: (amount: number, playerId?: string) => Promise<boolean>;
  onNominate: (playerId: string, initialAmount?: number) => Promise<boolean>;
  onRemoveFromQueue?: (playerId: string) => Promise<boolean>;
  onStartFromQueue?: (playerId: string) => Promise<boolean>;
  onPassTurn: () => Promise<boolean>;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onOpenRules?: () => void;
  onOpenAdminReport?: () => void;
  onAdminAuctionAction?: (action: string, value?: unknown) => Promise<void>;
  onNavigateToSquad?: () => void;
}

export const LiveAuctionSection: React.FC<LiveAuctionSectionProps> = ({
  auction,
  currentUser,
  players,
  users,
  watchedPlayerIds = [],
  onToggleWatch,
  onOpenWatchlist,
  onBid,
  onNominate,
  onRemoveFromQueue,
  onStartFromQueue,
  onPassTurn,
  onOpenAuth,
  onOpenAdmin,
  onOpenRules,
  onOpenAdminReport,
  onAdminAuctionAction,
  onNavigateToSquad,
}) => {
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [searchNominate, setSearchNominate] = useState<string>('');
  const [positionFilterNominate, setPositionFilterNominate] = useState<string>('ALL');
  const [submittingBid, setSubmittingBid] = useState<boolean>(false);
  const [nominateLoading, setNominateLoading] = useState<boolean>(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [isPassingTurn, setIsPassingTurn] = useState<boolean>(false);
  const [isStartingAuction, setIsStartingAuction] = useState<boolean>(false);
  const [isEndingAuction, setIsEndingAuction] = useState<boolean>(false);
  const [isQuickPostOpen, setIsQuickPostOpen] = useState<boolean>(false);
  const [selectedPlayerForBid, setSelectedPlayerForBid] = useState<Player | null>(null);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);

  const isAuctionActive = auction.status === 'ACTIVE';
  const isAuctionNotStarted = auction.status === 'NOT_STARTED';
  const isAuctionEnded = auction.status === 'ENDED';
  const currentPlayer = auction.currentPlayer;
  const currentBid = auction.currentBid;
  const isAdmin = currentUser?.role === 'ADMIN';

  // Relógio em tempo real com atualização segundo a segundo para contagem regressiva
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cálculo da contagem regressiva para abertura do leilão
  const scheduledStartTime = auction.scheduledStartTime || (auction.lastUpdated ? auction.lastUpdated + 5400 * 1000 : nowTimestamp + 5400 * 1000);
  const preAuctionDiffMs = Math.max(0, scheduledStartTime - nowTimestamp);
  const preAuctionSecondsRemaining = Math.floor(preAuctionDiffMs / 1000);

  const countdownDays = Math.floor(preAuctionSecondsRemaining / 86400);
  const countdownHours = Math.floor((preAuctionSecondsRemaining % 86400) / 3600);
  const countdownMinutes = Math.floor((preAuctionSecondsRemaining % 3600) / 60);
  const countdownSeconds = preAuctionSecondsRemaining % 60;

  const handleAdjustCountdown = async (secondsFromNow: number) => {
    if (!isAdmin || !onAdminAuctionAction) return;
    const newTarget = Date.now() + secondsFromNow * 1000;
    await onAdminAuctionAction('SET_SCHEDULED_START', newTarget);
  };

  // Active concurrent auction players with guaranteed fresh bid and price resolution
  const activeAuctionPlayers = React.useMemo(() => {
    const inAuctionList = players.filter((p) => p.status === 'IN_AUCTION');
    const map = new Map<string, Player>();
    inAuctionList.forEach((p) => {
      const activeBid = getPlayerActiveBid(p, auction);
      const effectivePrice = getPlayerEffectivePrice(p, auction);
      map.set(p.id, {
        ...p,
        currentBid: activeBid || p.currentBid,
        currentPrice: Math.max(effectivePrice, activeBid?.amount || 0, p.currentPrice || 0)
      });
    });
    if (auction.currentPlayer) {
      const existing = map.get(auction.currentPlayer.id);
      const combinedPlayer = {
        ...(existing || {}),
        ...auction.currentPlayer,
      };
      const activeBid = getPlayerActiveBid(combinedPlayer, auction);
      const effectivePrice = Math.max(
        getPlayerEffectivePrice(combinedPlayer, auction),
        activeBid?.amount || 0
      );
      map.set(auction.currentPlayer.id, {
        ...combinedPlayer,
        currentBid: activeBid || combinedPlayer.currentBid,
        currentPrice: effectivePrice
      });
    }
    return Array.from(map.values());
  }, [players, auction]);

  const focusedPlayer = (focusedPlayerId ? activeAuctionPlayers.find((p) => p.id === focusedPlayerId) : null)
    || activeAuctionPlayers[0]
    || currentPlayer
    || null;

  const focusedBid = getPlayerActiveBid(focusedPlayer, auction);
  const focusedEffectivePrice = getPlayerEffectivePrice(focusedPlayer, auction);
  const focusedTimerRemaining = focusedPlayer?.timerRemaining ?? (auction.currentPlayer?.id === focusedPlayer?.id ? auction.timerRemaining : 5400);

  const userWonPlayersCount = currentUser
    ? players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === currentUser.id).length
    : 0;
  const isUserSquadFull = userWonPlayersCount >= 23;

  // Sound triggers on state changes
  useEffect(() => {
    if (auction.status === 'ACTIVE' && auction.timerRemaining <= 5 && auction.timerRemaining > 0) {
      playTickSound(true);
    }
  }, [auction.timerRemaining, auction.status]);

  // Check turn to nominate
  const isMyTurnToNominate = Boolean(
    currentUser && (auction.nominationTurnUserId === currentUser.id || isAdmin || auction.isFreeNominationMode)
  );

  const nominatorUser = users.find((u) => u.id === auction.nominationTurnUserId);

  const currentAuctionDay = auction.auctionDay || 1;
  const currentDayInfo = getDayLabel(currentAuctionDay);

  // Available players for nomination - TODOS OS ATLETAS REGISTRADOS SEM RESTRIÇÃO DE FASES E SEM LIMITAÇÃO DE SLICE
  const availablePlayers = React.useMemo(() => {
    return players.filter((p) => p.status === 'AVAILABLE');
  }, [players]);

  const nominationCounts = React.useMemo(() => {
    return {
      ALL: availablePlayers.length,
      GOL: availablePlayers.filter((p) => p.position === 'GOL').length,
      ZAG: availablePlayers.filter((p) => p.position === 'ZAG').length,
      LAT: availablePlayers.filter((p) => ['LE', 'LD'].includes(p.position)).length,
      MEI: availablePlayers.filter((p) => ['VOL', 'MC', 'MEI', 'MD', 'ME'].includes(p.position)).length,
      ATA: availablePlayers.filter((p) => ['ATA', 'PE', 'PD', 'SA'].includes(p.position)).length,
    };
  }, [availablePlayers]);

  const filteredAvailablePlayers = React.useMemo(() => {
    const q = searchNominate.toLowerCase().trim();
    return availablePlayers.filter((p) => {
      // Position filter
      if (positionFilterNominate === 'GOL' && p.position !== 'GOL') return false;
      if (positionFilterNominate === 'ZAG' && p.position !== 'ZAG') return false;
      if (positionFilterNominate === 'LAT' && !['LE', 'LD'].includes(p.position)) return false;
      if (positionFilterNominate === 'MEI' && !['VOL', 'MC', 'MEI', 'MD', 'ME'].includes(p.position)) return false;
      if (positionFilterNominate === 'ATA' && !['ATA', 'PE', 'PD', 'SA'].includes(p.position)) return false;

      // Text search
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.club.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q) ||
        (p.nationality && p.nationality.toLowerCase().includes(q))
      );
    });
  }, [availablePlayers, searchNominate, positionFilterNominate]);

  const isCurrentPlayerAllowedToday = true;

  // Calculate minimum bid required for focused player
  const focusedHighest = focusedBid?.amount || (focusedEffectivePrice > (focusedPlayer?.initialPrice || 0) ? focusedEffectivePrice : 0);
  const minRequiredBid = focusedPlayer
    ? focusedHighest > 0
      ? focusedHighest + auction.minimumBidIncrement
      : focusedPlayer.initialPrice
    : 0;

  // Handle quick bid
  const handleQuickBid = async (increment: number, targetPlayerId?: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const targetPlayer = (targetPlayerId ? players.find((p) => p.id === targetPlayerId) : null) || focusedPlayer || currentPlayer;
    const targetBid = getPlayerActiveBid(targetPlayer, auction);
    const targetPrice = getPlayerEffectivePrice(targetPlayer, auction);
    const playerCurrentHighest = targetBid?.amount || (targetPrice > (targetPlayer?.initialPrice || 0) ? targetPrice : 0);
    const minReq = targetPlayer
      ? playerCurrentHighest > 0
        ? playerCurrentHighest + auction.minimumBidIncrement
        : targetPlayer.initialPrice
      : 0;
    const targetAmount = Math.max(minReq, playerCurrentHighest + increment);
    await executeBid(targetAmount, targetPlayer?.id);
  };

  const handleCustomBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const targetPlayer = focusedPlayer || currentPlayer;
    const targetBid = getPlayerActiveBid(targetPlayer, auction);
    const targetPrice = getPlayerEffectivePrice(targetPlayer, auction);
    const playerCurrentHighest = targetBid?.amount || (targetPrice > (targetPlayer?.initialPrice || 0) ? targetPrice : 0);
    const minReq = targetPlayer
      ? playerCurrentHighest > 0
        ? playerCurrentHighest + auction.minimumBidIncrement
        : targetPlayer.initialPrice
      : 0;

    const amount = Number(customBidAmount.replace(/\D/g, ''));
    if (!amount || amount < minReq) {
      setBidError(`O lance mínimo deve ser de ${formatCurrency(minReq)}`);
      return;
    }
    await executeBid(amount, targetPlayer?.id);
  };

  const executeBid = async (amount: number, targetPlayerId?: string) => {
    if (!currentUser) return;
    
    const targetPlayer = (targetPlayerId ? players.find((p) => p.id === targetPlayerId) : null) || focusedPlayer || currentPlayer;

    if (amount > currentUser.budget) {
      setBidError(`Saldo insuficiente! Seu saldo é ${formatCurrency(currentUser.budget)}`);
      return;
    }

    setSubmittingBid(true);
    setBidError(null);
    try {
      const success = await onBid(amount, targetPlayer?.id);
      if (success) {
        setCustomBidAmount('');
        playBidSound();
      }
    } catch {
      setBidError('Não foi possível registrar o lance. Verifique o valor atual.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSelectNominate = async (playerId: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setNominateLoading(true);
    await onNominate(playerId);
    setNominateLoading(false);
  };

  const handleStartLeagueAuction = async () => {
    if (!onAdminAuctionAction) return;
    setIsStartingAuction(true);
    try {
      await onAdminAuctionAction('START_LEAGUE_AUCTION');
    } finally {
      setIsStartingAuction(false);
    }
  };

  const handleEndLeagueAuction = async () => {
    if (!onAdminAuctionAction) return;
    setIsEndingAuction(true);
    try {
      await onAdminAuctionAction('END_LEAGUE_AUCTION');
    } catch (err) {
      console.error('Falha ao encerrar o leilão:', err);
    } finally {
      setIsEndingAuction(false);
    }
  };

  const handleResetToNotStarted = async () => {
    if (!onAdminAuctionAction) return;
    try {
      await onAdminAuctionAction('RESET_TO_NOT_STARTED');
    } catch (e) {
      console.error('Falha ao reiniciar o leilão:', e);
    }
  };

  // =========================================================================
  // DADOS FINANCEIROS EM TEMPO REAL DO PARTICIPANTE (SALDO, DÉBITO E ESTORNO)
  // =========================================================================
  // 1. Propostas ativas onde o usuário logado está liderando a disputa
  const userWinningBids = React.useMemo(() => {
    if (!currentUser) return [];
    const winningMap = new Map<string, { player: Player; bid: Bid }>();

    players.forEach((p) => {
      if (p.status === 'IN_AUCTION') {
        const activeBid = getPlayerActiveBid(p, auction);
        if (activeBid && activeBid.userId === currentUser.id) {
          winningMap.set(p.id, { player: p, bid: activeBid });
        }
      }
    });

    if (auction.status === 'ACTIVE' && auction.currentPlayer) {
      const activeBid = getPlayerActiveBid(auction.currentPlayer, auction);
      if (activeBid && activeBid.userId === currentUser.id) {
        if (!winningMap.has(auction.currentPlayer.id)) {
          winningMap.set(auction.currentPlayer.id, { player: auction.currentPlayer, bid: activeBid });
        }
      }
    }

    return Array.from(winningMap.values());
  }, [players, auction, currentUser]);

  // 2. Montante total retido / debitado em lances líderes ativos
  const totalHeldInBids = React.useMemo(() => {
    return userWinningBids.reduce((sum, item) => sum + item.bid.amount, 0);
  }, [userWinningBids]);

  // 3. Saldo Total em Conta e Saldo Disponível para Novos Lances
  const userTotalBudget = currentUser?.budget || 0;
  const userAvailableBudget = Math.max(0, userTotalBudget - totalHeldInBids);

  // 4. Jogadores onde o usuário deu lance anteriormente, mas sua proposta foi COBERTA por outro clube
  const outbidPlayers = React.useMemo(() => {
    if (!currentUser) return [];
    return players.filter((p) => {
      if (p.status !== 'IN_AUCTION') return false;
      const userHadBid = (p.bidHistory || []).some((b) => b.userId === currentUser.id);
      if (!userHadBid) return false;
      const activeBid = getPlayerActiveBid(p, auction);
      return activeBid && activeBid.userId !== currentUser.id;
    });
  }, [players, auction, currentUser]);

  // 5. Atletas contratados/arrematados pelo participante logado
  const userContractedPlayers = React.useMemo(() => {
    if (!currentUser) return [];
    return players.filter(
      (p) => p.status === 'SOLD' && p.soldTo?.userId === currentUser.id
    );
  }, [players, currentUser]);

  // 6. Total financeiro gasto em contratações
  const userSpentAmount = React.useMemo(() => {
    if (!currentUser) return 0;
    const computedSum = userContractedPlayers.reduce(
      (sum, p) => sum + (p.soldTo?.amount || p.currentPrice || p.initialPrice || 0),
      0
    );
    return Math.max(currentUser.spent || 0, computedSum);
  }, [currentUser, userContractedPlayers]);

  // 7. Orçamento total inicial que o clube possuía (Patrimônio oficial da Liga: € 400.0M)
  const userInitialBudget = React.useMemo(() => {
    if (!currentUser) return 400000000;
    return (currentUser.budget + userSpentAmount) || 400000000;
  }, [currentUser, userSpentAmount]);

  const userRemainingBudget = currentUser ? currentUser.budget : 400000000;
  const percentBudgetSpent = userInitialBudget > 0 ? Math.min(100, Math.round((userSpentAmount / userInitialBudget) * 100)) : 0;
  const percentBudgetRemaining = Math.max(0, 100 - percentBudgetSpent);

  // Renderizador do Card de Representação de Saldo do Usuário
  const renderUserAccountBalanceRepresentation = () => {
    const budgetPercentUsed = userTotalBudget > 0 ? Math.min(100, Math.round((totalHeldInBids / userTotalBudget) * 100)) : 0;
    const budgetPercentAvailable = 100 - budgetPercentUsed;

    return (
      <div 
        id="user-account-balance-card" 
        className="w-full text-left mt-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-slate-700/80 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-500/10 blur-2xl pointer-events-none rounded-full" />

        {/* Header da Conta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 mb-3.5 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Conta do Participante
                </span>
                {currentUser && (
                  <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Ao Vivo
                  </span>
                )}
              </div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5 leading-tight">
                {currentUser ? (
                  <>
                    <span>{currentUser.teamName || currentUser.name}</span>
                    <span className="text-slate-400 font-medium text-xs">({currentUser.name})</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-medium">Modo Visitante (Não Autenticado)</span>
                )}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {totalHeldInBids > 0 ? (
              <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800/80 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>{formatCurrency(totalHeldInBids, true)} retido em {userWinningBids.length} lance(s)</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saldo 100% livre</span>
              </span>
            )}
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
          {/* Card 1: Saldo Total em Conta */}
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Saldo Total em Conta
            </span>
            <div className="text-lg sm:text-xl font-black text-white tracking-tight">
              {currentUser ? formatCurrency(userTotalBudget, true) : '€ 400.0M'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Patrimônio oficial da liga
            </span>
          </div>

          {/* Card 2: Retido em Lances Ativos (Debitado com o decorrer dos lances) */}
          <div className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
            totalHeldInBids > 0
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
          }`}>
            <div className="mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Retido em Lances
              </span>
            </div>
            <div className={`text-lg sm:text-xl font-black tracking-tight ${
              totalHeldInBids > 0 ? 'text-amber-300' : 'text-slate-400'
            }`}>
              {currentUser ? formatCurrency(totalHeldInBids, true) : '€ 0.0M'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {totalHeldInBids > 0
                ? `Debitado de ${userWinningBids.length} ${userWinningBids.length === 1 ? 'proposta líder' : 'propostas líderes'}`
                : 'Nenhum valor bloqueado'}
            </span>
          </div>

          {/* Card 3: Saldo Disponível para Novos Lances */}
          <div className="p-3.5 bg-emerald-950/40 border-2 border-emerald-500/50 rounded-xl flex flex-col justify-between">
            <div className="mb-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Saldo Disponível
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-300 tracking-tight">
              {currentUser ? formatCurrency(userAvailableBudget, true) : '€ 400.0M'}
            </div>
            <span className="text-[10px] text-emerald-400/80 mt-1 block font-medium">
              Livre para cobrir ou abrir lances
            </span>
          </div>
        </div>

        {/* Liquidity Progress Bar */}
        {currentUser && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/90 relative z-10">
            <div className="flex items-center justify-between text-[11px] mb-1.5 font-semibold">
              <span className="text-slate-400">Distribuição do Orçamento:</span>
              <span className="text-slate-300">
                <span className="text-emerald-400 font-bold">{budgetPercentAvailable}% Disponível</span>
                {budgetPercentUsed > 0 && (
                  <span className="text-amber-400 font-bold"> • {budgetPercentUsed}% Retido</span>
                )}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300" 
                style={{ width: `${budgetPercentAvailable}%` }}
                title={`Disponível: ${formatCurrency(userAvailableBudget, true)}`}
              />
              {budgetPercentUsed > 0 && (
                <div 
                  className="bg-amber-400 h-full transition-all duration-300 animate-pulse" 
                  style={{ width: `${budgetPercentUsed}%` }}
                  title={`Retido em lances: ${formatCurrency(totalHeldInBids, true)}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Dynamic Context Feedback (Held bids breakdown & Outbid refund banner) */}
        <div className="mt-3 text-[11px] leading-relaxed relative z-10">
          {userWinningBids.length > 0 ? (
            <div className="p-3 bg-amber-950/60 rounded-xl border border-amber-500/40 text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Propostas Ativas Onde Seu Clube Lidera:</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {userWinningBids.map(({ player: p, bid: b }) => (
                  <span 
                    key={p.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/60 border border-amber-600/60 rounded-lg text-xs font-semibold text-white"
                  >
                    <span className="font-bold text-amber-300">{p.name}</span>
                    <span className="text-[10px] text-amber-200">({formatCurrency(b.amount, true)})</span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-300 pt-0.5">
                🔒 <strong>Regra de Estorno Automático:</strong> Caso qualquer outro clube cubra sua oferta por esses jogadores, o valor antes posto em lance volta imediatamente para o seu <strong>Saldo Disponível</strong> acima!
              </p>
            </div>
          ) : outbidPlayers.length > 0 ? (
            <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-500/40 text-emerald-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Oferta Coberta — Valor Devolvido à Conta!</span>
              </div>
              <p className="text-[11px] text-emerald-100">
                Sua proposta anterior por{' '}
                {outbidPlayers.map((op, idx) => (
                  <span key={op.id}>
                    {idx > 0 && ', '}
                    <strong className="text-white underline">{op.name}</strong>
                  </span>
                ))}{' '}
                foi coberta por outro clube. O valor posto em lance <strong>voltou integralmente para esta representação</strong> e já está 100% disponível para novos lances!
              </p>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-slate-300 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Como funciona o saldo:</strong> Ao enviar lances, o montante é debitado do seu Saldo Disponível. Se a proposta for coberta por outro participante, o valor volta imediatamente para sua conta.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Timer color and percentage (1 hora e 30 minutos = 5.400s por rodada de leilão)
  const timerMax = 5400;
  const timerPercent = Math.min(100, Math.max(0, (focusedTimerRemaining / timerMax) * 100));
  const isUrgentTimer = focusedTimerRemaining <= 600; // Last 10 minutes
  const isWarningTimer = focusedTimerRemaining <= 1800; // Last 30 minutes

  return (
    <div className="space-y-6">
      {/* 1. Status Banner */}
      <div className={`border rounded-2xl p-4 shadow-xs transition-all ${
        isAuctionNotStarted
          ? 'bg-amber-50/80 border-amber-300'
          : isAuctionEnded
            ? 'bg-slate-100 border-slate-300'
            : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isAuctionNotStarted
                    ? 'text-amber-800'
                    : isAuctionEnded
                      ? 'text-slate-600'
                      : isAuctionActive
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                }`}>
                  {isAuctionNotStarted ? (
                    '⏳ Status: Preparação & Espera'
                  ) : isAuctionEnded ? (
                    '🏁 Status: Leilão Encerrado'
                  ) : isAuctionActive ? (
                    '🟢 Leilão em Andamento'
                  ) : (
                    '🔄 Rodada de Anúncio de Jogador'
                  )}
                </span>
                {auction.isFreeNominationMode && !isAuctionNotStarted && !isAuctionEnded && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded-full">
                    Modo Livre (Qualquer um anuncia)
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                {isAuctionNotStarted ? (
                  <span className="text-amber-950 font-bold">
                    Leilão ainda não iniciado, participantes se preparem para logo em breve darmos início ao leilão
                  </span>
                ) : isAuctionEnded ? (
                  <span className="text-slate-800 font-bold">
                    O leilão oficial da Khedira League foi encerrado pelo administrador.
                  </span>
                ) : isAuctionActive ? (
                  <>Disputa ao vivo por <span className="text-emerald-600">{currentPlayer?.name}</span> • Propostas por 1 hora e 30 minutos</>
                ) : (
                  <span className="text-emerald-700 font-extrabold">
                    ⚽ Leilão Aberto: Qualquer participante pode postar jogadores de interesse!
                  </span>
                )}
              </h3>
            </div>
          </div>

          {/* Right Action / Controls on Banner */}
          {isAuctionNotStarted ? (
            <div className="flex items-center gap-2 self-end sm:self-center">
              {isAdmin ? (
                <button
                  id="btn-admin-start-auction-banner"
                  onClick={handleStartLeagueAuction}
                  disabled={isStartingAuction}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isStartingAuction ? 'Iniciando...' : 'Iniciar Leilão Oficial'}</span>
                </button>
              ) : (
                <span className="text-xs font-semibold text-amber-800 bg-amber-100/90 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                  <span>Aguardando o comissário iniciar</span>
                </span>
              )}
            </div>
          ) : isAuctionEnded ? (
            <div className="flex items-center gap-2 self-end sm:self-center">
              {isAdmin && (
                <>
                  <button
                    id="btn-admin-reopen-auction-banner"
                    onClick={handleStartLeagueAuction}
                    disabled={isStartingAuction}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Reabrir Leilão</span>
                  </button>
                  <button
                    id="btn-admin-reset-notstarted-banner"
                    onClick={handleResetToNotStarted}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Voltar para Não Iniciado</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 self-end sm:self-center">
              {isAdmin && (
                <button
                  type="button"
                  id="btn-admin-end-auction-banner"
                  onClick={handleEndLeagueAuction}
                  disabled={isEndingAuction}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-800 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Encerrar a sessão de leilão da Khedira League"
                >
                  {isEndingAuction ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-700" />
                  ) : (
                    <Square className="w-3.5 h-3.5 fill-current text-rose-700" />
                  )}
                  <span>{isEndingAuction ? 'Encerrando...' : 'Encerrar Leilão'}</span>
                </button>
              )}

              {auction.nominationQueue && auction.nominationQueue.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
                  <ListOrdered className="w-3.5 h-3.5 text-amber-600" />
                  <span>Fila: {auction.nominationQueue.length} {auction.nominationQueue.length === 1 ? 'craque' : 'craques'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 1.1 Barra de Alinhamento Oficial (Mercado Aberto Unificado & Sigilo de Lances) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Mercado Aberto Unificado • Sem Divisão de Fases</span>
              </h4>
              <p className="text-[11px] text-slate-300">
                Ataque, Meio-Campo, Defesa e Goleiros todos liberados simultaneamente para disputa.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold">
            <span>🟢 Todos os Setores Ativos</span>
          </div>

          {isAdmin && onOpenAdminReport && (
            <button
              id="btn-admin-view-report"
              onClick={onOpenAdminReport}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Acessar Relatório Oficial de Contratações por Fase (Exclusivo ADM)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Relatório por Fases (ADM)</span>
            </button>
          )}

          {onOpenRules && (
            <button
              id="btn-view-official-rules"
              onClick={onOpenRules}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Ata Oficial</span>
            </button>
          )}
        </div>
      </div>

      {/* 1.5. Visual Phase Cards - Tipos de Leilão (Anti-Burla) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Setores em Disputa • Mercado Simultâneo Aberto
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
            Regra Oficial: Sem fases • ATAQUE, MEIO CAMPO e DEFESA disponíveis simultaneamente
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* SETOR OFENSIVO: ATAQUE */}
          <div className="p-3.5 rounded-xl border bg-emerald-950/30 border-emerald-500/60 shadow-xs transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-500 text-white">
                SETOR OFENSIVO
              </span>
              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                DISPONÍVEL
              </span>
            </div>
            <h5 className="text-xs font-black text-white">Ataque & Goleadores</h5>
            <p className="text-[11px] text-slate-300 mt-1">
              Atletas: <strong className="text-white">ATA, PE, PD, ME, MD, SA</strong>
            </p>
            <span className="text-[10px] text-emerald-300 block mt-1.5 font-medium">
              🟢 Lances e indicações liberados (1h30m de disputa).
            </span>
          </div>

          {/* MEIO-CAMPO */}
          <div className="p-3.5 rounded-xl border bg-emerald-950/30 border-emerald-500/60 shadow-xs transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500 text-slate-950">
                MEIO-CAMPO
              </span>
              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                DISPONÍVEL
              </span>
            </div>
            <h5 className="text-xs font-black text-white">Armação & Controle</h5>
            <p className="text-[11px] text-slate-300 mt-1">
              Atletas: <strong className="text-white">VOL, MC, MEI</strong>
            </p>
            <span className="text-[10px] text-emerald-300 block mt-1.5 font-medium">
              🟢 Lances e indicações liberados (1h30m de disputa).
            </span>
          </div>

          {/* DEFESA & GOLEIROS */}
          <div className="p-3.5 rounded-xl border bg-emerald-950/30 border-emerald-500/60 shadow-xs transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-600 text-white">
                SISTEMA DEFENSIVO
              </span>
              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                DISPONÍVEL
              </span>
            </div>
            <h5 className="text-xs font-black text-white">Defesa & Goleiros</h5>
            <p className="text-[11px] text-slate-300 mt-1">
              Atletas: <strong className="text-white">GOL, ZAG, LD, LE</strong>
            </p>
            <span className="text-[10px] text-emerald-300 block mt-1.5 font-medium">
              🟢 Lances e indicações liberados (1h30m de disputa).
            </span>
          </div>
        </div>
      </div>

      {/* 1.6. Radar de Observação de Jogadores (Todas as 3 Fases) */}
      <WatchlistRadarWidget
        watchedPlayerIds={watchedPlayerIds}
        players={players}
        auction={auction}
        currentUser={currentUser}
        onToggleWatch={onToggleWatch || (() => {})}
        onOpenFullWatchlist={onOpenWatchlist || (() => {})}
        onNominate={onNominate}
      />

      {/* 2. Main Auction Stage & Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: The Live Auction Arena or Not Started Lobby or Nomination Box */}
        <div className="lg:col-span-2 space-y-6">
          {/* STATE A: LEILÃO AINDA NÃO INICIADO */}
          {isAuctionNotStarted ? (
            <div className="bg-white border-2 border-amber-300/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="text-center max-w-xl mx-auto py-3">
                <div 
                  onClick={() => playHammerSound()}
                  className="w-20 h-20 mx-auto rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 flex items-center justify-center mb-4 shadow-sm p-2.5 select-none transition-all hover:scale-105 active:scale-95 cursor-pointer group"
                  title="Clique para bater o martelo com som!"
                >
                  <span role="img" aria-label="Martelo de juiz" className="w-full h-full flex items-center justify-center">
                    <JudgeGavelIcon className="w-full h-full drop-shadow-xs" />
                  </span>
                </div>
                
                <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold uppercase tracking-wider inline-block mb-3">
                  Aguardando Comissário
                </span>

                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  Leilão ainda não iniciado, participantes se preparem para logo em breve darmos início ao leilão
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  A liderança da liga (<strong className="text-slate-900 font-bold">Guilherme Pereira - Diretor</strong> & <strong className="text-slate-900 font-bold">Guilherme Tourinho - Presidente</strong>) dará a largada oficial assim que os clubes confirmarem presença conforme a Ata Oficial.
                </p>

                {/* Representação em Tempo Real do Saldo em Conta, Débito e Estorno */}
                {renderUserAccountBalanceRepresentation()}

                {/* ⏱️ CRONÔMETRO COM CONTAGEM REGRESSIVA PARA TODOS VEREM BEM */}
                <div className="my-6 p-5 sm:p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl border-2 border-emerald-500/50 shadow-xl text-white relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Header badge */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        Cronômetro Oficial de Contagem Regressiva
                      </span>
                    </div>
                    
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Janela de 1h30m por Disputa
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 text-center mb-5 font-medium">
                    {preAuctionSecondsRemaining > 0 
                      ? '⏱️ Tempo restante para o início oficial do leilão e liberação das propostas:' 
                      : '🔥 Horário atingido! A diretoria pode iniciar o leilão a qualquer momento!'}
                  </p>

                  {/* Digits Display */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3.5 max-w-md mx-auto">
                    {countdownDays > 0 && (
                      <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/90 border border-slate-700 rounded-2xl shadow-inner">
                        <span className="text-3xl sm:text-5xl font-mono font-black text-amber-400 tracking-tight">
                          {String(countdownDays).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mt-1">
                          Dias
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/90 border border-emerald-500/50 rounded-2xl shadow-inner">
                      <span className="text-3xl sm:text-5xl font-mono font-black text-white tracking-tight">
                        {String(countdownHours).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-400 mt-1">
                        Horas
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/90 border border-emerald-500/50 rounded-2xl shadow-inner">
                      <span className="text-3xl sm:text-5xl font-mono font-black text-white tracking-tight">
                        {String(countdownMinutes).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-400 mt-1">
                        Minutos
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900/90 border border-amber-500/70 rounded-2xl shadow-inner">
                      <span className="text-3xl sm:text-5xl font-mono font-black text-amber-300 tracking-tight animate-pulse">
                        {String(countdownSeconds).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 mt-1">
                        Segundos
                      </span>
                    </div>
                  </div>

                  {/* Admin adjustment quick toolbar */}
                  {isAdmin && onAdminAuctionAction && (
                    <div className="mt-5 pt-3.5 border-t border-slate-800 flex flex-wrap items-center justify-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        Definir Tempo (ADM):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustCountdown(15 * 60)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Definir contagem para 15 minutos"
                      >
                        15 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustCountdown(30 * 60)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Definir contagem para 30 minutos"
                      >
                        30 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustCountdown(60 * 60)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Definir contagem para 1 hora"
                      >
                        1 hora
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustCountdown(90 * 60)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/60 rounded-lg transition-colors cursor-pointer"
                        title="Definir contagem padrão oficial da liga: 1 hora e 30 minutos"
                      >
                        1h 30m (Oficial)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Box based on Role */}
              {isAdmin ? (
                <div className="p-5 bg-gradient-to-br from-amber-50 to-emerald-50/40 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <Crown className="w-4 h-4 text-amber-600" />
                    <span>Controle da Diretoria & Presidência</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Você está autenticado como <strong>{currentUser?.name} ({getUserRoleBadge(currentUser).title})</strong> com plenos poderes administrativos. Quando os participantes confirmarem presença, clique abaixo para abrir oficialmente a rodada de anúncios e iniciar os lances.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      id="btn-admin-kickoff-auction"
                      onClick={handleStartLeagueAuction}
                      disabled={isStartingAuction}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isStartingAuction ? 'Iniciando Leilão...' : '🚀 Iniciar Leilão da Khedira League'}</span>
                    </button>
                    <button
                      id="btn-admin-open-panel-lobby"
                      onClick={onOpenAdmin}
                      className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-amber-600" />
                      <span>Abrir Painel Admin</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Checklist do Participante para o Início:
                      </h4>
                      <ul className="text-[11px] text-slate-600 mt-1 space-y-1 list-disc list-inside">
                        <li>Seu orçamento inicial fixo e recorde está garantido em <strong className="text-emerald-800">€ 400.0M</strong>.</li>
                        <li>Mercado Aberto Unificado: Ataque, Meio-Campo e Defesa liberados juntos simultaneamente.</li>
                        <li>Os lances contarão com sigilo (lances anônimos) para máxima estratégia.</li>
                        <li>Explore os craques disponíveis na aba <strong>3. Todos os Jogadores</strong> e adicione extras se desejar (mín. € 10M).</li>
                        <li>Fique com o áudio ligado para ouvir os avisos de lances e martelo batido!</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Connected Participants Lobby Preview */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <UsersIcon className="w-4 h-4 text-emerald-600" />
                    <span>Lobby de Participantes Conectados ({users.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Prontos para o leilão
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        user.role === 'ADMIN'
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {user.name}
                          </span>
                          <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                            user.role === 'ADMIN' ? `${getUserRoleBadge(user).badgeClass} border border-amber-300` : 'bg-slate-200 text-slate-700'
                          }`}>
                            {user.role === 'ADMIN' ? getUserRoleBadge(user).badgeLabel : 'Participante'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{user.teamName}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-emerald-700 block">
                          {formatCurrency(user.budget, true)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Orçamento</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : isAuctionEnded ? (
            /* STATE B: LEILÃO ENCERRADO - RESUMO COMPLETO DE CONTRATAÇÕES E BALANÇO FINANCEIRO */
            <div id="auction-ended-summary-card" className="bg-white border-2 border-slate-300 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
              {/* Header do Encerramento */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-400 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-slate-900 text-amber-300 rounded-md">
                        Leilão Oficial Encerrado
                      </span>
                      {currentUser && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                          {currentUser.teamName || currentUser.name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Resumo Final de Contratações
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 max-w-lg">
                      {currentUser ? (
                        <>Balanço definitivo das negociações do clube <strong className="text-slate-900 font-bold">{currentUser.teamName}</strong> ({currentUser.name}) na Khedira League EAFC 27.</>
                      ) : (
                        <>A sessão de leilões da Khedira League EAFC 27 foi encerrada pelo comissário. Conecte-se para conferir o resumo do seu clube.</>
                      )}
                    </p>
                  </div>
                </div>

                {onNavigateToSquad && currentUser && (
                  <button
                    onClick={onNavigateToSquad}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>Ver no Planejador de Time</span>
                  </button>
                )}
              </div>

              {/* 4 Métricas Principais Solicitadas pelo Usuário */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Quantos jogadores contratou */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Jogadores Contratados
                    </span>
                    <UsersIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900">
                      {currentUser ? userContractedPlayers.length : 0}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {currentUser ? `${userContractedPlayers.length} de 23 vagas preenchidas` : 'Faça login para ver'}
                    </span>
                  </div>
                </div>

                {/* 2. Quanto dinheiro tinha (Orçamento Inicial) */}
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Orçamento Inicial
                    </span>
                    <Wallet className="w-4 h-4 text-blue-600 shrink-0" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-blue-900">
                      {formatCurrency(userInitialBudget, true)}
                    </div>
                    <span className="text-[10px] text-blue-700/80 font-medium">
                      Patrimônio oficial da Liga
                    </span>
                  </div>
                </div>

                {/* 3. Quanto dinheiro foi gasto */}
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Dinheiro Gasto
                    </span>
                    <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-amber-900">
                      {currentUser ? formatCurrency(userSpentAmount, true) : '€ 0.0M'}
                    </div>
                    <span className="text-[10px] text-amber-800/80 font-medium">
                      {percentBudgetSpent}% do orçamento utilizado
                    </span>
                  </div>
                </div>

                {/* 4. Saldo Restante em Conta */}
                <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Saldo Restante
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-emerald-800">
                      {currentUser ? formatCurrency(userRemainingBudget, true) : '€ 400.0M'}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      Preservado em caixa ({percentBudgetRemaining}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra Visual de Distribuição Financeira */}
              {currentUser && (
                <div className="p-3.5 bg-slate-100/80 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600">Balanço do Orçamento (€ 400.0M):</span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-800 font-bold">
                        Gasto: {formatCurrency(userSpentAmount, true)} ({percentBudgetSpent}%)
                      </span>
                      <span className="text-emerald-700 font-bold">
                        Em Caixa: {formatCurrency(userRemainingBudget, true)} ({percentBudgetRemaining}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className="bg-amber-500 h-full transition-all duration-500"
                      style={{ width: `${percentBudgetSpent}%` }}
                      title={`Gasto em contratações: ${formatCurrency(userSpentAmount, true)}`}
                    />
                    <div
                      className="bg-emerald-600 h-full transition-all duration-500"
                      style={{ width: `${percentBudgetRemaining}%` }}
                      title={`Saldo restante em caixa: ${formatCurrency(userRemainingBudget, true)}`}
                    />
                  </div>
                </div>
              )}

              {/* Seção "Quais foram esses jogadores": Lista de Atletas Contratados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Jogadores Arrematados ({userContractedPlayers.length})</span>
                  </h3>
                  {userContractedPlayers.length > 0 && (
                    <span className="text-xs font-bold text-slate-500">
                      Média: {formatCurrency(userSpentAmount / userContractedPlayers.length, true)} por atleta
                    </span>
                  )}
                </div>

                {userContractedPlayers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {userContractedPlayers.map((player) => {
                      const posBadge = getPositionBadge(player.position);
                      const finalAmount = player.soldTo?.amount || player.currentPrice;
                      return (
                        <div
                          key={player.id}
                          className="p-3.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-xl shadow-2xs transition-all flex flex-col justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-extrabold text-slate-900 truncate">
                                {player.name}
                              </h4>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${posBadge.bgClass} ${posBadge.textClass} ${posBadge.borderClass}`}>
                                {player.position}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {player.club} • {player.nationality}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              Valor Final
                            </span>
                            <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                              {formatCurrency(finalAmount, true)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !currentUser ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-3">
                    <p className="text-xs text-slate-600">
                      Você está visualizando a plataforma no modo visitante. Conecte sua conta para acessar o relatório de contratações do seu time.
                    </p>
                    <button
                      onClick={onOpenAuth}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Entrar / Cadastrar Clube</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                    <p className="text-xs font-bold text-slate-700">
                      Nenhum jogador arrematado pelo seu clube nesta edição.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Seu orçamento inicial de <strong className="text-slate-800 font-bold">€ 400.0M</strong> permaneceu 100% intacto em caixa sem qualquer desconto.
                    </p>
                  </div>
                )}
              </div>

              {/* Botões Administrativos (se for Admin) */}
              {isAdmin && (
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleStartLeagueAuction}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Reabrir / Iniciar Nova Disputa</span>
                  </button>
                  <button
                    onClick={handleResetToNotStarted}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Voltar para Modo Não Iniciado</span>
                  </button>
                  {onOpenAdminReport && (
                    <button
                      onClick={onOpenAdminReport}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Relatório por Fases (ADM)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {isAuctionActive && (focusedPlayer || currentPlayer) ? (
                /* STATE C: ACTIVE AUCTION CARD & SIMULTANEOUS DISPUTES */
                <div className="space-y-4">
              {/* Representação em Tempo Real do Saldo em Conta, Débito e Estorno */}
              {renderUserAccountBalanceRepresentation()}

              {/* Simultaneous Auctions Selector if more than 1 player in dispute */}
              {activeAuctionPlayers.length > 1 && (
                <div className="bg-white border-2 border-emerald-500/20 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Disputas Simultâneas Ao Vivo ({activeAuctionPlayers.length} atletas)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Clique em um card para focar ou cobrir lances
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {activeAuctionPlayers.map((p) => {
                      const pBid = getPlayerActiveBid(p, auction);
                      const pPrice = getPlayerEffectivePrice(p, auction);
                      const pTimer = p.timerRemaining ?? (auction.currentPlayer?.id === p.id ? auction.timerRemaining : 5400);
                      const isSelected = ((focusedPlayer || currentPlayer)?.id === p.id);
                      const isUserLeading = pBid?.userId === currentUser?.id;
                      const pBadge = getPositionBadge(p.position);

                      return (
                        <div
                          key={p.id}
                          onClick={() => setFocusedPlayerId(p.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/30 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.2 text-[10px] font-black rounded ${pBadge.bgClass} ${pBadge.textClass}`}>
                                  {p.position}
                                </span>
                                <span className="text-xs font-black text-slate-900 line-clamp-1">{p.name}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-emerald-700 block">
                                {formatCurrency(pPrice)}
                              </span>
                              <span className="text-[10px] text-amber-700 font-semibold flex items-center justify-end gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatAuctionTimer(pTimer)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[11px]">
                            {isUserLeading ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Sua equipe lidera
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">
                                {pBid ? 'Em disputa' : 'Sem propostas'}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              {isAdmin && onAdminAuctionAction && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAdminAuctionAction('FORCE_FINISH', p.id);
                                  }}
                                  className="p-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors cursor-pointer"
                                  title={`Bater martelo e finalizar disputa de ${p.name}`}
                                >
                                  <JudgeGavelIcon className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPlayerForBid(p);
                                }}
                                className="px-2.5 py-1 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs cursor-pointer"
                              >
                                Dar Lance
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Focused Player Card */}
              {(() => {
                const activePlayer = focusedPlayer || currentPlayer!;
                const activeBid = getPlayerActiveBid(activePlayer, auction);
                const activeEffectivePrice = getPlayerEffectivePrice(activePlayer, auction);
                const activeTimer = activePlayer.timerRemaining ?? focusedTimerRemaining;

                return (
                  <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-6 shadow-md relative overflow-hidden">
                    {/* Top status bar with countdown timer */}
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                        <span className="text-xs font-bold text-rose-600 tracking-wider uppercase">
                          AO VIVO AGORA
                        </span>
                      </div>

                      {/* Big Visual Countdown Timer */}
                      <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border-2 shadow-xs transition-all ${
                        isUrgentTimer
                          ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse'
                          : isWarningTimer
                            ? 'bg-amber-950 text-amber-300 border-amber-500'
                            : 'bg-slate-950 text-emerald-400 border-emerald-500/60'
                      }`}>
                        <Clock className={`w-4 h-4 ${isUrgentTimer ? 'text-rose-400 animate-spin' : 'text-emerald-400'}`} />
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-base sm:text-lg tracking-tight">
                            {formatAuctionTimer(activeTimer)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-300 hidden sm:inline">
                            (Janela de 1h30m)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar of timer */}
                    <div className="w-full h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                          isUrgentTimer
                            ? 'bg-rose-500'
                            : isWarningTimer
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${timerPercent}%` }}
                      />
                    </div>

                    {/* Watched Player Notification Banner */}
                    {watchedPlayerIds.includes(activePlayer.id) && (
                      <div className="mb-4 p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-950 font-semibold shadow-2xs animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                          <span>
                            <strong>Radar de Observação Ativo:</strong> Você marcou este jogador para acompanhar os lances!
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 shrink-0">
                          Na Sua Lista
                        </span>
                      </div>
                    )}

                    {/* Player Presentation */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center font-black shadow-md border border-slate-700 shrink-0">
                          <span className="text-xs text-amber-400 font-extrabold uppercase">EAFC 27</span>
                          <span className="text-lg tracking-wider">{activePlayer.position}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-extrabold rounded-md ${getPositionBadge(activePlayer.position).bgClass} ${getPositionBadge(activePlayer.position).textClass}`}>
                              {activePlayer.position}
                            </span>
                            {onToggleWatch && (
                              <button
                                type="button"
                                onClick={() => onToggleWatch(activePlayer.id)}
                                className={`ml-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                                  watchedPlayerIds.includes(activePlayer.id)
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                                }`}
                                title={
                                  watchedPlayerIds.includes(activePlayer.id)
                                    ? 'Remover este jogador do Radar de Observação'
                                    : 'Adicionar este jogador ao Radar de Observação'
                                }
                              >
                                <Star className={`w-3 h-3 ${watchedPlayerIds.includes(activePlayer.id) ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                                <span>{watchedPlayerIds.includes(activePlayer.id) ? 'Em Observação' : 'Observar'}</span>
                              </button>
                            )}
                          </div>
                          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            {activePlayer.name}
                          </h2>
                          <p className="text-xs text-slate-500 font-medium">
                            Preço Base: <strong className="text-slate-700">{formatCurrency(activePlayer.initialPrice, true)}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Current Price / Highest Bid Box */}
                      <div className="bg-slate-50 rounded-xl p-3 sm:text-right border border-slate-200/80 w-full sm:w-auto">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          {activeBid ? 'Maior Lance Atual' : 'Lance Inicial'}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-emerald-700 block tracking-tight">
                          {formatCurrency(activeEffectivePrice)}
                        </span>
                        {activeBid ? (
                          <div className="flex items-center gap-1.5 sm:justify-end text-xs font-semibold text-slate-700 mt-0.5">
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            {auction.anonymousBidding !== false ? (
                              activeBid.userId === currentUser?.id ? (
                                <span className="text-emerald-700 font-extrabold flex items-center gap-1.5">
                                  <span className="font-mono font-black text-slate-800 tracking-wider">*****</span>
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                    Seu Lance na Frente
                                  </span>
                                </span>
                              ) : isAdmin ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-slate-800 tracking-wider">*****</span>
                                  <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                                    Sigilo Ativo (Admin: {activeBid.userName})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-600 font-bold flex items-center gap-1.5">
                                  <Lock className="w-3 h-3 text-emerald-600" />
                                  <span className="font-mono font-black text-slate-800 tracking-wider">*****</span>
                                  <span className="text-[10px] text-slate-500 font-normal">(Sigilo Ativo)</span>
                                </span>
                              )
                            ) : (
                              <>
                                <span>{activeBid.userName}</span>
                                <span className="text-slate-400 font-normal">({activeBid.teamName})</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Aguardando primeiro lance...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bidding Controls */}
                    <div className="pt-6 space-y-4">
                      {currentUser ? (
                        <>
                          {!isCurrentPlayerAllowedToday && (
                            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-3 text-xs text-rose-900 font-medium animate-in fade-in">
                              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <strong className="block font-black text-rose-950 uppercase tracking-wide">
                                  🚫 Lances Bloqueados pelo Sistema Anti-Burla
                                </strong>
                                <p className="leading-relaxed">
                                  O leilão de hoje é exclusivo para o setor <strong>{currentDayInfo.title}</strong> ({currentDayInfo.positions.join(', ')}). Este atleta ({activePlayer.position}) não pertence à fase ativa e o sistema não autoriza lances fora do dia regulamentar.
                                </p>
                              </div>
                            </div>
                          )}

                          {isUserSquadFull && (
                            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900 font-medium animate-in fade-in">
                              <UsersIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <strong className="block font-black text-amber-950 uppercase tracking-wide">
                                  ⚠️ Limite de Elenco Atingido (23/23 Atletas)
                                </strong>
                                <p className="leading-relaxed">
                                  Seu clube já atingiu o teto máximo de <strong>23 jogadores</strong> permitido pelo regulamento oficial. Novos lances e compras estão desabilitados para a sua equipe.
                                </p>
                              </div>
                            </div>
                          )}

                          {bidError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-medium text-rose-700 animate-shake">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{bidError}</span>
                            </div>
                          )}

                          {/* Quick increment buttons */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-600 block">
                                Lances Rápidos:
                              </span>
                              {currentUser && (
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isUserSquadFull ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  Elenco: {userWonPlayersCount} / 23 jogadores
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2.5">
                              <button
                                onClick={() => handleQuickBid(1000000, activePlayer.id)}
                                disabled={submittingBid || !isCurrentPlayerAllowedToday || isUserSquadFull}
                                title={activeBid?.userId === currentUser?.id ? 'Aumentar sua proposta por este atleta em +€ 1.0M' : 'Cobrir proposta em +€ 1.0M'}
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+€ 1.0M</span>
                              </button>
                              <button
                                onClick={() => handleQuickBid(2000000, activePlayer.id)}
                                disabled={submittingBid || !isCurrentPlayerAllowedToday || isUserSquadFull}
                                title={activeBid?.userId === currentUser?.id ? 'Aumentar sua proposta por este atleta em +€ 2.0M' : 'Cobrir proposta em +€ 2.0M'}
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+€ 2.0M</span>
                              </button>
                              <button
                                onClick={() => handleQuickBid(5000000, activePlayer.id)}
                                disabled={submittingBid || !isCurrentPlayerAllowedToday || isUserSquadFull}
                                title={activeBid?.userId === currentUser?.id ? 'Aumentar sua proposta por este atleta em +€ 5.0M' : 'Cobrir proposta em +€ 5.0M'}
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+€ 5.0M</span>
                              </button>
                            </div>
                          </div>

                          {/* Custom Bid Input */}
                          <form onSubmit={handleCustomBid} className="flex gap-2">
                            <div className="relative flex-1">
                              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="text"
                                disabled={!isCurrentPlayerAllowedToday || isUserSquadFull}
                                placeholder={
                                  isUserSquadFull 
                                    ? 'Limite de 23 jogadores atingido (elenco completo)' 
                                    : !isCurrentPlayerAllowedToday 
                                    ? 'Lances bloqueados para esta posição' 
                                    : `Mínimo: ${formatCurrency(minRequiredBid)}`
                                }
                                value={customBidAmount}
                                onChange={(e) => setCustomBidAmount(e.target.value)}
                                className="w-full pl-8 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold disabled:opacity-50 disabled:bg-slate-100"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={submittingBid || !customBidAmount || !isCurrentPlayerAllowedToday || isUserSquadFull}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                              Enviar Lance
                            </button>
                          </form>

                          {activeBid?.userId === currentUser.id && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Você está vencendo o leilão deste atleta com o maior lance!</span>
                            </div>
                          )}

                          {isAdmin && onAdminAuctionAction && (
                            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                              <div className="text-xs text-amber-950 font-bold flex items-center gap-1.5">
                                <JudgeGavelIcon className="w-3.5 h-3.5 text-amber-700" />
                                <span>Decisão do Administrador:</span>
                              </div>
                              <button
                                type="button"
                                id="btn-admin-hammer-active-player"
                                onClick={() => onAdminAuctionAction('FORCE_FINISH', activePlayer.id)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                title="Bater o martelo imediatamente para quem fez a última proposta mais alta"
                              >
                                <JudgeGavelIcon className="w-3.5 h-3.5 text-slate-950" />
                                <span>Bater Martelo (Finalizar Disputa)</span>
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <p className="text-xs font-semibold text-slate-700 mb-2">
                            Cadastre seu clube ou faça login com Gmail para dar lances ao vivo!
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={onOpenAuth}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              Criar Conta / Login Gmail
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* IDLE BANNER WHEN NO PLAYER IS CURRENTLY IN DISPUTE */
            <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mb-2.5 p-1 shadow-xs">
                <JudgeGavelIcon className="w-full h-full drop-shadow-xs" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Outfit',sans-serif]">
                Aguardando Nova Disputa de Atletas
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto mt-1 leading-relaxed">
                Nenhum atleta em leilão no momento. Escolha qualquer jogador na lista de registrados abaixo e clique em <strong>Postar</strong> para abrir a disputa de <strong>1 hora e 30 minutos</strong>!
              </p>
              <div className="mt-3">
                {renderUserAccountBalanceRepresentation()}
              </div>
            </div>
          )}

          {/* PERSISTENT NOMINATION STAGE: ALL REGISTERED PLAYERS LIST (ALWAYS VISIBLE!) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Outfit',sans-serif] flex items-center gap-2">
                  <JudgeGavelIcon className="w-5 h-5 text-amber-600 inline" />
                  <span>Postar Jogador de Interesse</span>
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Disputas Simultâneas Permitidas
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pesquise, filtre e poste qualquer atleta da lista registrada para abrir disputa de 1h30m, mesmo enquanto outros atletas estiverem em leilão!
                </p>
              </div>
            </div>

            {/* Quick Nomination Box */}
            <div className="pt-4 space-y-4">
                {/* Search and Counts Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Jogadores Registrados Disponíveis para Iniciar Disputa</span>
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Mostrando <strong className="text-emerald-700 font-bold">{filteredAvailablePlayers.length}</strong> de <strong className="text-slate-800 font-bold">{availablePlayers.length}</strong> atletas no sistema
                    </span>
                  </div>

                  {/* Search Input with Clear Button */}
                  <div className="relative w-full md:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou posição..."
                      value={searchNominate}
                      onChange={(e) => setSearchNominate(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all shadow-2xs"
                    />
                    {searchNominate && (
                      <button
                        type="button"
                        onClick={() => setSearchNominate('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        title="Limpar busca"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Fast Position / Sector Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'ALL', label: 'Todos', count: nominationCounts.ALL },
                    { id: 'GOL', label: 'Goleiros', count: nominationCounts.GOL },
                    { id: 'ZAG', label: 'Zagueiros', count: nominationCounts.ZAG },
                    { id: 'LAT', label: 'Laterais', count: nominationCounts.LAT },
                    { id: 'MEI', label: 'Meio-Campo', count: nominationCounts.MEI },
                    { id: 'ATA', label: 'Ataque', count: nominationCounts.ATA },
                  ].map((filter) => {
                    const isSelected = positionFilterNominate === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setPositionFilterNominate(filter.id)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{filter.label}</span>
                        <span className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                          isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Complete Available Players List */}
                {filteredAvailablePlayers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {filteredAvailablePlayers.map((player) => {
                      const badge = getPositionBadge(player.position);
                      const isQueued = auction.nominationQueue?.some((q) => q.player.id === player.id);

                      return (
                        <div
                          key={player.id}
                          className="p-3 rounded-xl border flex items-center justify-between gap-2 transition-all bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 hover:border-emerald-300"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${badge.bgClass} ${badge.textClass}`}>
                                {player.position}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {player.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              Início: <strong className="text-emerald-700">{formatCurrency(player.initialPrice, true)}</strong>
                            </p>
                          </div>

                          {isQueued ? (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              📋 Na Fila
                            </span>
                          ) : isUserSquadFull ? (
                            <span
                              title="Seu clube já atingiu o limite máximo de 23 jogadores no elenco"
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 text-slate-500 shrink-0 cursor-not-allowed"
                            >
                              Elenco 23/23
                            </span>
                          ) : currentUser ? (
                            <button
                              onClick={() => handleSelectNominate(player.id)}
                              disabled={nominateLoading}
                              title="Postar jogador no leilão"
                              className="px-3.5 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-colors shadow-2xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                            >
                              Postar
                            </button>
                          ) : (
                            <button
                              onClick={onOpenAuth}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
                            >
                              Entrar p/ Postar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                    <p className="text-xs font-bold text-slate-700">
                      Nenhum jogador encontrado com os filtros atuais.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tente alterar a posição selecionada ou limpar a busca por texto.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchNominate('');
                        setPositionFilterNominate('ALL');
                      }}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 mt-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Limpar Filtros</span>
                    </button>
                  </div>
                )}

                {!currentUser && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-900">
                    Faça login com seu time para postar qualquer jogador de interesse da lista oficial!
                  </div>
                )}
              </div>
            </div>
          </>
        )}

          {/* Fila de Jogadores de Interesse (Próximas Disputas de 1h30m) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span>Fila de Jogadores de Interesse</span>
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                    Próximas Disputas de 1h30m
                  </span>
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                  Jogadores postados pelos próprios participantes. Entram em leilão de 1h30m automaticamente em ordem de postagem.
                </p>
              </div>
              <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs font-bold rounded-xl sm:rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 border border-slate-200/90 transition-all duration-150 shrink-0 self-start sm:self-center select-none shadow-2xs whitespace-nowrap cursor-default">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                <span>{auction.nominationQueue?.length || 0} na fila</span>
              </span>
            </div>

            {auction.nominationQueue && auction.nominationQueue.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {auction.nominationQueue.map((item, index) => {
                  const badge = getPositionBadge(item.player.position);
                  const canRemove = currentUser && (currentUser.id === item.nominatedByUserId || isAdmin);

                  return (
                    <div
                      key={`${item.player.id}-${index}`}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            #{index + 1} na fila
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${badge.bgClass} ${badge.textClass}`}>
                            {item.player.position}
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-sm">{item.player.name}</h5>
                        <div className="mt-1 text-xs">
                          <span className="text-slate-400">Lance Inicial: </span>
                          <strong className="text-slate-800 font-bold">{formatCurrency(item.player.initialPrice, true)}</strong>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-slate-500 truncate" title={`Postado por ${item.nominatedByUserName} (${item.nominatedByTeamName})`}>
                          Por: <strong className="text-slate-700">{item.nominatedByUserName}</strong>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAdmin && (
                            <button
                              onClick={() => onStartFromQueue?.(item.player.id)}
                              className="px-2.5 py-1.5 sm:px-2 sm:py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-[11px] font-bold rounded-lg cursor-pointer transition-colors min-h-[32px] sm:min-h-0 flex items-center justify-center"
                              title="Iniciar este leilão imediatamente"
                            >
                              Iniciar
                            </button>
                          )}
                          {canRemove && (
                            <button
                              onClick={() => onRemoveFromQueue?.(item.player.id)}
                              className="p-2 sm:p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer min-h-[32px] sm:min-h-0 flex items-center justify-center"
                              title="Remover jogador da fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500">
                  Nenhum jogador na fila de espera no momento. Navegue na lista ou use o campo de postagem para adicionar craques de seu interesse para as próximas rodadas de 1 hora e 30 minutos!
                </p>
              </div>
            )}
          </div>

          {/* Bid History of Current Auction */}
          <div id="round-bid-history-card" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Histórico de Lances desta Rodada</span>
              </h4>
              {auction.anonymousBidding !== false && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Sigilo de Lances
                </span>
              )}
            </div>

            {(() => {
              // Combine round bids and ensure all bids from auction.bidHistory and players' bidHistory are merged and deduplicated
              const allBidsMap = new Map<string, Bid>();
              (auction.bidHistory || []).forEach((b) => {
                if (b && b.id) {
                  allBidsMap.set(b.id, b);
                }
              });
              players.forEach((p) => {
                (p.bidHistory || []).forEach((b) => {
                  if (b && b.id) {
                    const existing = allBidsMap.get(b.id);
                    allBidsMap.set(b.id, {
                      ...b,
                      playerName: b.playerName || existing?.playerName || p.name,
                      playerId: b.playerId || existing?.playerId || p.id,
                      amount: Math.max(b.amount || 0, existing?.amount || 0)
                    });
                  }
                });
              });
              const roundBids = Array.from(allBidsMap.values()).sort(
                (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
              );

              return roundBids && roundBids.length > 0 ? (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {roundBids.map((bid, index) => {
                    const isMyBid = bid.userId === currentUser?.id;
                    const bidderUser = users.find(u => u.id === bid.userId);
                    const bidderTitle = bidderUser?.role === 'ADMIN' ? ` [${getUserRoleBadge(bidderUser).title}]` : '';
                    const targetPlayer = players.find(p => p.id === bid.playerId) || (auction.currentPlayer?.id === bid.playerId ? auction.currentPlayer : null);
                    const resolvedPlayerName = bid.playerName || targetPlayer?.name || 'Jogador';
                    const resolvedPosition = targetPlayer?.position;
                    const posBadge = resolvedPosition ? getPositionBadge(resolvedPosition) : null;
                    const userName = bid.userName || bidderUser?.name || 'Usuário';
                    const teamName = bid.teamName || bidderUser?.teamName || '';

                    return (
                      <div
                        key={bid.id || index}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-xs transition-colors gap-2.5 ${
                          index === 0
                            ? 'bg-emerald-50/75 border-emerald-200 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                            index === 0 ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {index + 1}
                          </span>
                          <div className="space-y-1">
                            {/* Nome do Jogador Envolvido */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {posBadge && (
                                <span className={`px-1.5 py-0.2 text-[9px] font-black rounded ${posBadge.bgClass} ${posBadge.textClass}`}>
                                  {resolvedPosition}
                                </span>
                              )}
                              <span className="font-black text-slate-900 text-xs tracking-tight">
                                {resolvedPlayerName}
                              </span>
                            </div>

                            {/* Nome do Usuário que fez o lance */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 flex-wrap">
                              <span className="text-slate-400 font-medium">Lance por:</span>
                              {auction.anonymousBidding !== false ? (
                                isMyBid ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-slate-800 tracking-wider">*****</span>
                                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                                      Seu Lance
                                    </span>
                                  </div>
                                ) : isAdmin ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-slate-800 tracking-wider">*****</span>
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                                      Admin: {userName} {teamName ? `(${teamName})` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-slate-800 tracking-wider">*****</span>
                                    <Lock className="w-3 h-3 text-emerald-600" />
                                  </div>
                                )
                              ) : (
                                <>
                                  <span className={`font-bold ${isMyBid ? 'text-emerald-700' : 'text-slate-800'}`}>
                                    {userName}
                                  </span>
                                  {teamName && (
                                    <span className="text-slate-500 font-medium">({teamName})</span>
                                  )}
                                  {bidderTitle && (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                                      {bidderTitle.replace('[', '').replace(']', '').trim()}
                                    </span>
                                  )}
                                  {isMyBid && (
                                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                                      Seu Lance
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Valor e Horário do Lance */}
                        <div className="text-right shrink-0 flex items-center sm:flex-col justify-between sm:justify-center border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200/60">
                          <span className="font-black text-emerald-700 text-sm tracking-tight">
                            {formatCurrency(bid.amount)}
                          </span>
                          {bid.timestamp && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(bid.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  {isAuctionNotStarted 
                    ? 'Aguardando o início oficial do leilão pelo administrador.'
                    : 'Nenhum lance efetuado nesta rodada até o momento.'}
                </p>
              );
            })()}
          </div>
        </div>

        {/* Right Col: League Members & Room Leaderboard */}
        <div className="space-y-6">
          {/* Members in the League */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Participantes da Liga ({users.length})</span>
              </h4>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {users.map((user) => {
                const isCurrentBidder = currentBid?.userId === user.id;
                const isTurn = auction.nominationTurnUserId === user.id;
                const wonCount = players.filter((p) => p.soldTo?.userId === user.id).length;
                // Conceal competitor crown if anonymous bidding is active
                const showCrown = isCurrentBidder && (
                  auction.anonymousBidding === false ||
                  user.id === currentUser?.id ||
                  isAdmin
                );

                return (
                  <div
                    key={user.id}
                    className={`p-3 rounded-xl border transition-all ${
                      showCrown
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/30'
                        : isTurn && !isAuctionNotStarted && !isAuctionEnded
                          ? 'bg-amber-50/60 border-amber-300'
                          : 'bg-slate-50/80 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">
                            {user.name}
                          </span>
                          {user.role === 'ADMIN' && (
                            <span className={`px-1 py-0.2 text-[9px] font-bold rounded ${getUserRoleBadge(user).badgeClass}`}>
                              {getUserRoleBadge(user).badgeLabel}
                            </span>
                          )}
                          {showCrown && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {user.teamName}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-extrabold text-emerald-700 block">
                          {formatCurrency(user.budget, true)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {wonCount} {wonCount === 1 ? 'craque' : 'craques'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick League Rules Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Regulamento Oficial (Ata Khedira League)
              </span>
              {onOpenRules && (
                <button
                  onClick={onOpenRules}
                  className="text-[10px] text-emerald-700 font-bold underline hover:text-emerald-800 cursor-pointer"
                >
                  Ler Completo
                </button>
              )}
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-600 leading-relaxed">
              <li>Diretoria & Presidência: <strong>Guilherme Pereira</strong> (Diretor) e <strong>Guilherme Tourinho</strong> (Presidente).</li>
              <li>Orçamento fixo e inegociável de <strong className="text-emerald-800 font-bold">€ 400 Milhões</strong> por clube.</li>
              <li>Cronograma de 3 dias por posições: <strong>Dia 1 Defesa</strong>, <strong>Dia 2 Meio</strong>, <strong>Dia 3 Ataque</strong>.</li>
              <li>Sigilo de Lances obrigatório para estratégia das propostas.</li>
              <li>Inclusão de jogadores extras sob demanda com lance mínimo obrigatório de <strong className="text-amber-800 font-bold">€ 10M</strong>.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Bid Modal for simultaneous player disputes */}
      {selectedPlayerForBid && (
        <QuickBidModal
          player={selectedPlayerForBid}
          isOpen={Boolean(selectedPlayerForBid)}
          onClose={() => setSelectedPlayerForBid(null)}
          currentUser={currentUser}
          auction={auction}
          availableBudget={userAvailableBudget}
          heldBudget={totalHeldInBids}
          onConfirmBid={async (amount, playerId) => {
            const isAlreadyInAuction = selectedPlayerForBid.status === 'IN_AUCTION';
            if (isAlreadyInAuction) {
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
