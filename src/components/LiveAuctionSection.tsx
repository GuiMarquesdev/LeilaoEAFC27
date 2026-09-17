import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Gavel, Clock, ArrowUpRight, DollarSign, UserCheck, 
  Flame, CheckCircle2, ChevronRight, Search, 
  AlertCircle, Shield, Plus, Crown, Volume2, SkipForward,
  Play, Square, Sparkles, Trophy, Users as UsersIcon, RotateCcw,
  Lock, Unlock, FileText, ShieldAlert, ShieldCheck, Calendar, Star,
  ListOrdered, Trash2
} from 'lucide-react';
import { AuctionState, Player, UserProfile, Bid } from '../types';
import { formatCurrency, getPositionBadge, getDayLabel, isPositionAllowedForDay, getUserRoleBadge, formatAuctionTimer } from '../utils/formatters';
import { playBidSound, playHammerSound, playTickSound } from '../utils/sound';
import { JudgeGavelIcon } from './JudgeGavelIcon';
import { WatchlistRadarWidget } from './WatchlistRadarWidget';

interface LiveAuctionSectionProps {
  auction: AuctionState;
  currentUser: UserProfile | null;
  players: Player[];
  users: UserProfile[];
  watchedPlayerIds?: string[];
  onToggleWatch?: (playerId: string) => void;
  onOpenWatchlist?: () => void;
  onBid: (amount: number) => Promise<boolean>;
  onNominate: (playerId: string) => Promise<boolean>;
  onRemoveFromQueue?: (playerId: string) => Promise<boolean>;
  onStartFromQueue?: (playerId: string) => Promise<boolean>;
  onPassTurn: () => Promise<boolean>;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onOpenRules?: () => void;
  onOpenAdminReport?: () => void;
  onAdminAuctionAction?: (action: string, value?: unknown) => Promise<void>;
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
}) => {
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [searchNominate, setSearchNominate] = useState<string>('');
  const [submittingBid, setSubmittingBid] = useState<boolean>(false);
  const [nominateLoading, setNominateLoading] = useState<boolean>(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [isPassingTurn, setIsPassingTurn] = useState<boolean>(false);
  const [isStartingAuction, setIsStartingAuction] = useState<boolean>(false);
  const [isEndingAuction, setIsEndingAuction] = useState<boolean>(false);
  const [isQuickPostOpen, setIsQuickPostOpen] = useState<boolean>(false);

  const isAuctionActive = auction.status === 'ACTIVE';
  const isAuctionNotStarted = auction.status === 'NOT_STARTED';
  const isAuctionEnded = auction.status === 'ENDED';
  const currentPlayer = auction.currentPlayer;
  const currentBid = auction.currentBid;
  const isAdmin = currentUser?.role === 'ADMIN';

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

  // Available players for nomination - APENAS JOGADORES DA POSIÇÃO DO DIA
  const availablePlayers = players.filter(
    (p) => p.status === 'AVAILABLE' && isPositionAllowedForDay(p.position, currentAuctionDay)
  );
  const filteredAvailablePlayers = availablePlayers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchNominate.toLowerCase()) ||
      p.club.toLowerCase().includes(searchNominate.toLowerCase()) ||
      p.position.toLowerCase().includes(searchNominate.toLowerCase())
  ).slice(0, 8); // Top 8 suggestions

  const isCurrentPlayerAllowedToday = currentPlayer
    ? isPositionAllowedForDay(currentPlayer.position, currentAuctionDay)
    : true;

  // Calculate minimum bid required
  const currentHighest = currentBid ? currentBid.amount : 0;
  const minRequiredBid = currentPlayer
    ? currentHighest > 0
      ? currentHighest + auction.minimumBidIncrement
      : currentPlayer.initialPrice
    : 0;

  // Handle quick bid
  const handleQuickBid = async (increment: number) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const targetAmount = Math.max(minRequiredBid, currentHighest + increment);
    await executeBid(targetAmount);
  };

  const handleCustomBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const amount = Number(customBidAmount.replace(/\D/g, ''));
    if (!amount || amount < minRequiredBid) {
      setBidError(`O lance mínimo deve ser de ${formatCurrency(minRequiredBid)}`);
      return;
    }
    await executeBid(amount);
  };

  const executeBid = async (amount: number) => {
    if (!currentUser) return;
    
    // Strict Anti-Burla Validation
    if (currentPlayer && !isPositionAllowedForDay(currentPlayer.position, currentAuctionDay)) {
      setBidError(`Lances Bloqueados: O leilão de hoje é exclusivo para ${getDayLabel(currentAuctionDay).title}. Este atleta (${currentPlayer.position}) não pertence à fase ativa e não pode receber lances!`);
      return;
    }

    if (amount > currentUser.budget) {
      setBidError(`Saldo insuficiente! Seu saldo é ${formatCurrency(currentUser.budget)}`);
      return;
    }

    setSubmittingBid(true);
    setBidError(null);
    try {
      const success = await onBid(amount);
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
    if (!window.confirm('Tem certeza que deseja encerrar o leilão da Khedira League?')) return;
    setIsEndingAuction(true);
    try {
      await onAdminAuctionAction('END_LEAGUE_AUCTION');
    } finally {
      setIsEndingAuction(false);
    }
  };

  const handleResetToNotStarted = async () => {
    if (!onAdminAuctionAction) return;
    if (!window.confirm('Deseja retornar o leilão para o estado "Não Iniciado"?')) return;
    try {
      await onAdminAuctionAction('RESET_TO_NOT_STARTED');
    } catch (e) {
      console.error(e);
    }
  };

  // Timer color and percentage (24 hours = 86,400s per auction round)
  const timerMax = 86400;
  const timerPercent = Math.min(100, Math.max(0, (auction.timerRemaining / timerMax) * 100));
  const isUrgentTimer = auction.timerRemaining <= 600; // Last 10 minutes
  const isWarningTimer = auction.timerRemaining <= 3600; // Last 1 hour

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
                  <>Disputa ao vivo por <span className="text-emerald-600">{currentPlayer?.name}</span> • Propostas por 24 horas</>
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
                  id="btn-admin-end-auction-banner"
                  onClick={handleEndLeagueAuction}
                  disabled={isEndingAuction}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  title="Encerrar a sessão de leilão"
                >
                  <Square className="w-3 h-3 fill-current" />
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

      {/* 1.1 Barra de Alinhamento Oficial (Ata & Cronograma dos 3 Dias & Sigilo de Lances) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                Ata Oficial • Khedira League
              </span>
              <span className="text-xs font-bold text-amber-300">
                Orçamento: € 300.0M por Clube
              </span>
              {auction.anonymousBidding !== false ? (
                <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Sigilo de Lances Ativo
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Unlock className="w-3 h-3 text-slate-400" />
                  Lances com Identificação
                </span>
              )}
            </div>

            <div className="mt-1">
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>Fase Atual: {getDayLabel(auction.auctionDay || 'ALL').title}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                {getDayLabel(auction.auctionDay || 'ALL').subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {isAdmin && onAdminAuctionAction && (
            <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
              <span className="text-[10px] font-bold text-slate-400 pl-1.5">Dia:</span>
              <button
                onClick={() => onAdminAuctionAction('SET_AUCTION_DAY', 1)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  auction.auctionDay === 1 ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
                title="Dia 1: Sistema Defensivo (GOL, ZAG, LD/LE)"
              >
                1 (Defesa)
              </button>
              <button
                onClick={() => onAdminAuctionAction('SET_AUCTION_DAY', 2)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  auction.auctionDay === 2 ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
                title="Dia 2: Meio-Campo (VOL, MC, MEI)"
              >
                2 (Meio)
              </button>
              <button
                onClick={() => onAdminAuctionAction('SET_AUCTION_DAY', 3)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  auction.auctionDay === 3 ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
                title="Dia 3: Setor Ofensivo (ATA, PE, PD, ME, MD, SA)"
              >
                3 (Ataque)
              </button>
              <button
                onClick={() => onAdminAuctionAction('SET_AUCTION_DAY', 'ALL')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  auction.auctionDay === 'ALL' || !auction.auctionDay ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
                title="Fase Livre: Todas as posições"
              >
                Livre
              </button>
            </div>
          )}

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
              Tipos Oficiais de Leilão & Cronograma (Seguido à Risca)
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
            Regra Anti-Burla Ativa • Apenas lances e indicações na posição do dia
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* DIA 1: DEFESA */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            auction.auctionDay === 1
              ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500'
              : 'bg-slate-800/60 border-slate-700/80 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                auction.auctionDay === 1 ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-300'
              }`}>
                DIA 1 • DEFESA
              </span>
              {auction.auctionDay === 1 ? (
                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  FASE ATIVA HOJE
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloqueado
                </span>
              )}
            </div>
            <h5 className="text-xs font-black text-white">Sistema Defensivo & Goleiros</h5>
            <p className="text-[11px] text-slate-300 mt-1">
              Exclusivo para: <strong className="text-white">GOL, ZAG, LD, LE</strong>.
            </p>
            <span className="text-[10px] text-slate-400 block mt-1.5 font-medium">
              {auction.auctionDay === 1 
                ? '🟢 Lances e indicações liberados para defensores.' 
                : '🔒 Lances bloqueados até esta fase.'}
            </span>
          </div>

          {/* DIA 2: MEIO-CAMPO */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            auction.auctionDay === 2
              ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500'
              : 'bg-slate-800/60 border-slate-700/80 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                auction.auctionDay === 2 ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-300'
              }`}>
                DIA 2 • MEIO
              </span>
              {auction.auctionDay === 2 ? (
                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  FASE ATIVA HOJE
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloqueado
                </span>
              )}
            </div>
            <h5 className="text-xs font-black text-white">Meio-Campo & Criação</h5>
            <p className="text-[11px] text-slate-300 mt-1">
              Exclusivo para: <strong className="text-white">VOL, MC, MEI</strong>.
            </p>
            <span className="text-[10px] text-slate-400 block mt-1.5 font-medium">
              {auction.auctionDay === 2 
                ? '🟢 Lances e indicações liberados para meio-campistas.' 
                : '🔒 Lances bloqueados até esta fase.'}
            </span>
          </div>

          {/* DIA 3: SETOR OFENSIVO */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            auction.auctionDay === 3
              ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500'
              : 'bg-slate-800/60 border-slate-700/80 opacity-75'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                auction.auctionDay === 3 ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-300'
              }`}>
                DIA 3 • ATAQUE
              </span>
              {auction.auctionDay === 3 ? (
                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  FASE ATIVA HOJE
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloqueado
                </span>
              )}
            </div>
            <h5 className="text-xs font-black text-white">Setor Ofensivo & Goleadores</h5>
            <p className="text-[11px] text-slate-300 mt-1">
              Exclusivo para: <strong className="text-white">ATA, PE, PD, ME, MD, SA</strong>.
            </p>
            <span className="text-[10px] text-slate-400 block mt-1.5 font-medium">
              {auction.auctionDay === 3 
                ? '🟢 Lances e indicações liberados para atacantes.' 
                : '🔒 Lances bloqueados até esta fase.'}
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
                        <li>Seu orçamento inicial fixo e recorde está garantido em <strong className="text-emerald-800">€ 300.0M</strong>.</li>
                        <li>O leilão seguirá a divisão em 3 dias por posições (Dia 1 Defesa, Dia 2 Meio, Dia 3 Ataque).</li>
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
            /* STATE B: LEILÃO ENCERRADO */
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Sessão Oficial de Leilão Encerrada
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                O comissário Guilherme Brito encerrou a sessão de leilões da Khedira League EAFC 27. Confira seu elenco completo na aba <strong>Prévia & Meu Time</strong>!
              </p>

              {isAdmin && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleStartLeagueAuction}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Reabrir / Iniciar Nova Disputa</span>
                  </button>
                  <button
                    onClick={handleResetToNotStarted}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Voltar para Modo Não Iniciado</span>
                  </button>
                </div>
              )}
            </div>
          ) : isAuctionActive && currentPlayer ? (
            /* STATE C: ACTIVE AUCTION CARD */
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
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-extrabold ${
                  isUrgentTimer
                    ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                    : isWarningTimer
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <Clock className="w-4 h-4" />
                  <span>{formatAuctionTimer(auction.timerRemaining)}</span>
                  <span className="text-xs font-medium opacity-80">restantes (Janela de 24h)</span>
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
              {watchedPlayerIds.includes(currentPlayer.id) && (
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
                    <span className="text-lg tracking-wider">{currentPlayer.position}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-extrabold rounded-md ${getPositionBadge(currentPlayer.position).bgClass} ${getPositionBadge(currentPlayer.position).textClass}`}>
                        {currentPlayer.position}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {currentPlayer.nationality}
                      </span>
                      {onToggleWatch && (
                        <button
                          type="button"
                          onClick={() => onToggleWatch(currentPlayer.id)}
                          className={`ml-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            watchedPlayerIds.includes(currentPlayer.id)
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                          }`}
                          title={
                            watchedPlayerIds.includes(currentPlayer.id)
                              ? 'Remover este jogador do Radar de Observação'
                              : 'Adicionar este jogador ao Radar de Observação'
                          }
                        >
                          <Star className={`w-3 h-3 ${watchedPlayerIds.includes(currentPlayer.id) ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                          <span>{watchedPlayerIds.includes(currentPlayer.id) ? 'Em Observação' : 'Observar'}</span>
                        </button>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {currentPlayer.name}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {currentPlayer.club} • Preço Base: <strong className="text-slate-700">{formatCurrency(currentPlayer.initialPrice, true)}</strong>
                    </p>
                  </div>
                </div>

                {/* Current Price / Highest Bid Box */}
                <div className="bg-slate-50 rounded-xl p-3 sm:text-right border border-slate-200/80 w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {currentBid ? 'Maior Lance Atual' : 'Lance Inicial'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 block tracking-tight">
                    {formatCurrency(currentBid ? currentBid.amount : currentPlayer.initialPrice)}
                  </span>
                  {currentBid ? (
                    <div className="flex items-center gap-1.5 sm:justify-end text-xs font-semibold text-slate-700 mt-0.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      {auction.anonymousBidding !== false ? (
                        currentBid.userId === currentUser?.id ? (
                          <span className="text-emerald-700 font-extrabold">Você (Seu Lance na Frente)</span>
                        ) : isAdmin ? (
                          <span>
                            <span className="text-slate-800">{currentBid.userName}</span>
                            <span className="text-slate-400 font-normal ml-1">({currentBid.teamName})</span>
                            <span className="ml-1 text-[10px] text-amber-700 font-bold bg-amber-100 px-1 py-0.2 rounded">Sigilo Ativo (Visão Admin)</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold italic flex items-center gap-1">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            Clube Concorrente (Sigilo de Lances)
                          </span>
                        )
                      ) : (
                        <>
                          <span>{currentBid.userName}</span>
                          <span className="text-slate-400 font-normal">({currentBid.teamName})</span>
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
                            O leilão de hoje é exclusivo para o setor <strong>{currentDayInfo.title}</strong> ({currentDayInfo.positions.join(', ')}). Este atleta ({currentPlayer.position}) não pertence à fase ativa e o sistema não autoriza lances fora do dia regulamentar.
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
                          onClick={() => handleQuickBid(1000000)}
                          disabled={submittingBid || (currentBid?.userId === currentUser.id) || !isCurrentPlayerAllowedToday || isUserSquadFull}
                          className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+€ 1.0M</span>
                        </button>
                        <button
                          onClick={() => handleQuickBid(2000000)}
                          disabled={submittingBid || (currentBid?.userId === currentUser.id) || !isCurrentPlayerAllowedToday || isUserSquadFull}
                          className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+€ 2.0M</span>
                        </button>
                        <button
                          onClick={() => handleQuickBid(5000000)}
                          disabled={submittingBid || (currentBid?.userId === currentUser.id) || !isCurrentPlayerAllowedToday || isUserSquadFull}
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

                    {currentBid?.userId === currentUser.id && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Você está vencendo o leilão com o maior lance!</span>
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
          ) : (
            /* STATE D: IDLE / NOMINATION STAGE */
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="text-center py-6 border-b border-slate-100">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-3 p-1.5 shadow-xs">
                  <JudgeGavelIcon className="w-full h-full drop-shadow-xs" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 font-['Outfit',sans-serif]">
                  Poste um Jogador de Interesse
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto mt-1 leading-relaxed">
                  São os próprios participantes que postam os jogadores de interesse! Todos os membros podem postar atletas a partir da lista oficial de jogadores registrados. O jogador postado terá propostas abertas por <strong>24 horas</strong>.
                </p>
              </div>

              {/* Quick Nomination Box */}
              <div className="pt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Jogadores Registrados Disponíveis para Iniciar Disputa (24h):
                  </span>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, clube ou posição..."
                      value={searchNominate}
                      onChange={(e) => setSearchNominate(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredAvailablePlayers.map((player) => {
                    const badge = getPositionBadge(player.position);
                    const isAllowedToday = isPositionAllowedForDay(player.position, auction.auctionDay || 'ALL');
                    const isQueued = auction.nominationQueue?.some((q) => q.player.id === player.id);

                    return (
                      <div
                        key={player.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          isAllowedToday
                            ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                            : 'bg-slate-100/60 border-slate-200 opacity-60'
                        }`}
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
                            {player.club} • Início: <strong className="text-slate-700">{formatCurrency(player.initialPrice, true)}</strong>
                          </p>
                          {!isAllowedToday && (
                            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              Restrito ao dia da sua posição
                            </span>
                          )}
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
                            disabled={nominateLoading || !isAllowedToday}
                            title={!isAllowedToday ? `Posição ${player.position} não liberada na fase de hoje` : 'Postar jogador no leilão (24h de propostas)'}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-colors shadow-2xs ${
                              isAllowedToday
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            } disabled:opacity-50`}
                          >
                            Postar (24h)
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

                {!currentUser && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-900">
                    Faça login com seu time para postar qualquer jogador de interesse da lista oficial!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Post Drawer when Auction is ACTIVE */}
          {isAuctionActive && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                    <Plus className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      Tem interesse em outro jogador registrado?
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Poste na fila para abrir disputa de 24 horas assim que a rodada atual terminar!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuickPostOpen(!isQuickPostOpen)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-0"
                >
                  {isQuickPostOpen ? 'Fechar Busca' : 'Postar na Fila'}
                </button>
              </div>

              {isQuickPostOpen && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou clube para postar na fila..."
                      value={searchNominate}
                      onChange={(e) => setSearchNominate(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredAvailablePlayers.slice(0, 10).map((player) => {
                      const badge = getPositionBadge(player.position);
                      const isAllowedToday = isPositionAllowedForDay(player.position, auction.auctionDay || 'ALL');
                      const isQueued = auction.nominationQueue?.some((q) => q.player.id === player.id);

                      return (
                        <div
                          key={player.id}
                          className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className={`px-1 py-0.2 text-[9px] font-bold rounded ${badge.bgClass} ${badge.textClass}`}>
                                {player.position}
                              </span>
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {player.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 truncate block">
                              {player.club} • {formatCurrency(player.initialPrice, true)}
                            </span>
                          </div>

                          {isQueued ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                              Na Fila
                            </span>
                          ) : isUserSquadFull ? (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded shrink-0">
                              Elenco 23/23
                            </span>
                          ) : currentUser ? (
                            <button
                              onClick={() => handleSelectNominate(player.id)}
                              disabled={nominateLoading || !isAllowedToday}
                              className={`px-2.5 py-1.5 sm:px-2 sm:py-1 text-xs sm:text-[11px] font-bold rounded-lg shrink-0 transition-colors ${
                                isAllowedToday
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              Postar
                            </button>
                          ) : (
                            <button
                              onClick={onOpenAuth}
                              className="px-2.5 py-1.5 sm:px-2 sm:py-1 text-xs sm:text-[11px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 shrink-0 cursor-pointer"
                            >
                              Entrar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fila de Jogadores de Interesse (Próximas Disputas de 24 Horas) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <ListOrdered className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span>Fila de Jogadores de Interesse</span>
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                      Próximas Disputas de 24h
                    </span>
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                    Jogadores postados pelos próprios participantes. Entram em leilão de 24h automaticamente em ordem de postagem.
                  </p>
                </div>
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
                        <p className="text-xs text-slate-500">{item.player.club}</p>
                        <div className="mt-2 text-xs">
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
                  Nenhum jogador na fila de espera no momento. Navegue na lista ou use o campo de postagem para adicionar craques de seu interesse para as próximas rodadas de 24 horas!
                </p>
              </div>
            )}
          </div>

          {/* Bid History of Current Auction */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
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

            {auction.bidHistory && auction.bidHistory.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {auction.bidHistory.map((bid, index) => {
                  const isMyBid = bid.userId === currentUser?.id;
                  const bidderUser = users.find(u => u.id === bid.userId);
                  const bidderTitle = bidderUser?.role === 'ADMIN' ? ` [${getUserRoleBadge(bidderUser).title}]` : '';
                  const displayName = auction.anonymousBidding !== false
                    ? isMyBid
                      ? 'Você (Seu Lance)'
                      : isAdmin
                        ? `${bid.userName} (${bid.teamName})${bidderTitle}`
                        : 'Clube Concorrente (Sigilo)'
                    : `${bid.userName} (${bid.teamName})${bidderTitle}`;

                  return (
                    <div
                      key={bid.id || index}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                        index === 0
                          ? 'bg-emerald-50/70 border-emerald-200 font-bold text-slate-900'
                          : 'bg-slate-50 border-slate-200/60 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          index === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <span className={`font-bold ${isMyBid ? 'text-emerald-800' : 'text-slate-800'}`}>
                            {displayName}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {formatCurrency(bid.amount)}
                        </span>
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
            )}
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
              <li>Orçamento fixo e inegociável de <strong className="text-emerald-800 font-bold">€ 300 Milhões</strong> por clube.</li>
              <li>Cronograma de 3 dias por posições: <strong>Dia 1 Defesa</strong>, <strong>Dia 2 Meio</strong>, <strong>Dia 3 Ataque</strong>.</li>
              <li>Sigilo de Lances obrigatório para estratégia das propostas.</li>
              <li>Inclusão de jogadores extras sob demanda com lance mínimo obrigatório de <strong className="text-amber-800 font-bold">€ 10M</strong>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
