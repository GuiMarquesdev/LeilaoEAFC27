import React, { useState, useEffect } from 'react';
import { 
  X, Shield, DollarSign, Plus, Pause, Play, 
  RotateCcw, Trash2, UserCog, AlertTriangle, Check, Gavel, Crown, Square,
  Calendar, Lock, Unlock, FileText, Wallet, CheckCircle2, RefreshCw,
  ListOrdered, ChevronRight, Clock, Timer, Sliders, Edit3
} from 'lucide-react';
import { Player, UserProfile, AuctionState, PlayerPosition, AuctionType, AuctionPhase } from '../types';
import { formatCurrency, getPositionBadge, getDayLabel, getUserRoleBadge, formatAuctionTimer, AUCTION_PHASES } from '../utils/formatters';
import { AdminSigningsReportSection } from './AdminSigningsReportSection';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  auction: AuctionState;
  players: Player[];
  users: UserProfile[];
  initialTab?: 'auction' | 'players' | 'users' | 'danger' | 'report';
  onAdminAuctionAction: (action: string, value?: unknown) => Promise<void>;
  onAdminCreatePlayer: (playerData: {
    name: string;
    position: PlayerPosition;
    club: string;
    nationality: string;
    initialPrice: number;
  }) => Promise<boolean>;
  onAdminUpdatePrice: (playerId: string, initialPrice: number) => Promise<boolean>;
  onAdminDeletePlayer: (playerId: string) => Promise<boolean>;
  onAdminReleasePlayer?: (playerId: string) => Promise<boolean>;
  onAdminUpdateUserRole: (targetUserId: string, role: 'ADMIN' | 'PARTICIPANT') => Promise<boolean>;
  onAdminUpdateUserBudget: (targetUserId: string, budget: number) => Promise<boolean>;
  onAdminResetUser: (targetUserId: string) => Promise<boolean>;
  onAdminResetLeague: () => Promise<boolean>;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  auction,
  players,
  users,
  onAdminAuctionAction,
  onAdminCreatePlayer,
  onAdminUpdatePrice,
  onAdminDeletePlayer,
  onAdminReleasePlayer,
  onAdminUpdateUserRole,
  onAdminUpdateUserBudget,
  onAdminResetUser,
  onAdminResetLeague,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<'auction' | 'players' | 'users' | 'danger' | 'report'>(initialTab || 'auction');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // New Player Form State
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState<PlayerPosition>('ATA');
  const [newClub, setNewClub] = useState('');
  const [newNationality, setNewNationality] = useState('Brasil');
  const [newPrice, setNewPrice] = useState('25000000');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // Price Edit State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [playerSearch, setPlayerSearch] = useState('');

  // User Budget Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<string>('');

  // Reset confirmation state
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  // Auction Timer Edit State
  const [customHours, setCustomHours] = useState('1');
  const [customMinutes, setCustomMinutes] = useState('30');
  const [customSeconds, setCustomSeconds] = useState('0');
  const [timerFeedback, setTimerFeedback] = useState<string | null>(null);
  const [isApplyingTimer, setIsApplyingTimer] = useState(false);
  const [isTimerEditorOpen, setIsTimerEditorOpen] = useState(true);

  // Sync inputs with current timer when available
  const handleCopyCurrentTimer = () => {
    const rem = auction.timerRemaining > 0 ? auction.timerRemaining : (auction.defaultDurationSeconds || 5400);
    const h = Math.floor(rem / 3600);
    const m = Math.floor((rem % 3600) / 60);
    const s = rem % 60;
    setCustomHours(String(h));
    setCustomMinutes(String(m));
    setCustomSeconds(String(s));
    setTimerFeedback('Tempo atual copiado para os campos de edição!');
    setTimeout(() => setTimerFeedback(null), 2500);
  };

  const handleApplyCustomTimer = async () => {
    const h = parseInt(customHours, 10) || 0;
    const m = parseInt(customMinutes, 10) || 0;
    const s = parseInt(customSeconds, 10) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;

    if (totalSeconds < 10) {
      setTimerFeedback('O tempo mínimo do cronômetro é de 10 segundos.');
      setTimeout(() => setTimerFeedback(null), 3000);
      return;
    }

    setIsApplyingTimer(true);
    try {
      await onAdminAuctionAction('SET_TIMER', totalSeconds);
      const formatted = h > 0 ? `${h}h ${m}m ${s > 0 ? `${s}s` : ''}` : `${m}m ${s > 0 ? `${s}s` : ''}`;
      setTimerFeedback(`Cronômetro da disputa atualizado para ${formatted.trim()} com sucesso!`);
      setTimeout(() => setTimerFeedback(null), 3500);
    } finally {
      setIsApplyingTimer(false);
    }
  };

  const handleSetAsDefaultDuration = async () => {
    const h = parseInt(customHours, 10) || 0;
    const m = parseInt(customMinutes, 10) || 0;
    const s = parseInt(customSeconds, 10) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;

    if (totalSeconds < 30) {
      setTimerFeedback('O tempo padrão mínimo da liga é de 30 segundos.');
      setTimeout(() => setTimerFeedback(null), 3000);
      return;
    }

    setIsApplyingTimer(true);
    try {
      await onAdminAuctionAction('SET_DEFAULT_DURATION', totalSeconds);
      const formatted = h > 0 ? `${h}h ${m}m` : `${m}m`;
      setTimerFeedback(`Tempo padrão de cada disputa da liga definido para ${formatted}!`);
      setTimeout(() => setTimerFeedback(null), 3500);
    } finally {
      setIsApplyingTimer(false);
    }
  };

  const handleQuickAdjustTimer = async (deltaSeconds: number) => {
    setIsApplyingTimer(true);
    try {
      await onAdminAuctionAction('ADJUST_TIMER', deltaSeconds);
      const deltaMins = Math.round(deltaSeconds / 60);
      setTimerFeedback(`Ajuste de ${deltaMins > 0 ? `+${deltaMins}` : deltaMins} min aplicado com sucesso!`);
      setTimeout(() => setTimerFeedback(null), 3000);
    } finally {
      setIsApplyingTimer(false);
    }
  };

  if (!isOpen || !currentUser || currentUser.role !== 'ADMIN') return null;

  const soldPlayers = players.filter((p) => p.status === 'SOLD');
  const totalMoneyInvested = users.reduce((acc, u) => acc + (u.spent || 0), 0);

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      const ok = await onAdminResetLeague();
      if (ok) {
        setResetFeedback('Reset concluído com sucesso: todos os atletas retornaram ao mercado e os orçamentos foram devolvidos!');
        setShowConfirmResetModal(false);
        setTimeout(() => setResetFeedback(null), 5000);
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPrice) return;

    const priceNum = Number(newPrice);
    if (isNaN(priceNum) || priceNum < 10000000) {
      setCreateMsg('Atenção: O Regulamento Oficial exige lance inicial mínimo de € 10.000.000 para atletas extras.');
      return;
    }

    const success = await onAdminCreatePlayer({
      name: newName.trim(),
      position: newPosition,
      club: (newClub || 'Mercado da Liga').trim(),
      nationality: (newNationality || 'Internacional').trim(),
      initialPrice: priceNum,
    });

    if (success) {
      setCreateMsg('Jogador extra cadastrado com sucesso respeitando a cota mínima de € 10M!');
      setNewName('');
      setNewClub('');
      setNewPrice('10000000');
      setTimeout(() => setCreateMsg(null), 4000);
    }
  };

  const handleSavePrice = async (playerId: string) => {
    const num = Number(editPriceValue);
    if (!isNaN(num) && num > 0) {
      await onAdminUpdatePrice(playerId, num);
      setEditingPlayerId(null);
    }
  };

  const handleSaveBudget = async (userId: string) => {
    const num = Number(editBudgetValue);
    if (!isNaN(num) && num >= 0) {
      await onAdminUpdateUserBudget(userId, num);
      setEditingUserId(null);
    }
  };

  const filteredPlayers = players
    .filter((p) => p.name.toLowerCase().includes(playerSearch.toLowerCase()) || p.club.toLowerCase().includes(playerSearch.toLowerCase()))
    .slice(0, 15);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Painel Administrativo da Khedira League
              </h2>
              <p className="text-xs text-slate-500">
                Gerenciamento de lances, tabela de preços, novos jogadores e funções
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-slate-50/80 text-xs font-bold gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('auction')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'auction'
                ? 'border-amber-600 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Controle de Lances & Leilão
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'players'
                ? 'border-amber-600 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Preços Iniciais & Adicionar Jogadores
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'border-amber-600 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Administrar Usuários & Funções
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'danger'
                ? 'border-rose-600 text-rose-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-rose-600'
            }`}
          >
            4. Reset de Mercado & Saldos
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`py-3 px-3 border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'report'
                ? 'border-amber-600 text-amber-900 font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900 font-bold'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>5. Contratações & Elencos Fechados (ADM)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: AUCTION CONTROLS */}
          {activeTab === 'auction' && (
            <div className="space-y-6">
              {/* PRIMARY LEAGUE AUCTION LIFECYCLE CARD */}
              <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                      Ciclo Geral da Sessão de Leilão (Khedira League)
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-white mt-0.5 flex items-center gap-2">
                      {auction.status === 'NOT_STARTED' && (
                        <span className="text-amber-300">⚪ Leilão Ainda Não Iniciado (Modo Espera)</span>
                      )}
                      {auction.status === 'ENDED' && (
                        <span className="text-slate-300">🏁 Sessão Oficial de Leilão Encerrada</span>
                      )}
                      {auction.status === 'ACTIVE' && (
                        <span className="text-emerald-400">🟢 Leilão Em Andamento (Lance Ativo)</span>
                      )}
                      {auction.status === 'PAUSED' && (
                        <span className="text-amber-400">⏸️ Leilão Pausado</span>
                      )}
                      {auction.status === 'IDLE' && (
                        <span className="text-emerald-300">🟡 Sessão Aberta (Aguardando Anúncio)</span>
                      )}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {auction.status === 'NOT_STARTED' || auction.status === 'ENDED' ? (
                      <button
                        onClick={() => onAdminAuctionAction('START_LEAGUE_AUCTION')}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{auction.status === 'ENDED' ? 'Reabrir Leilão' : '🚀 Iniciar Leilão Oficial'}</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            onAdminAuctionAction('END_LEAGUE_AUCTION');
                          }}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Encerrar Leilão</span>
                        </button>
                        <button
                          onClick={() => {
                            onAdminAuctionAction('RESET_TO_NOT_STARTED');
                          }}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Voltar p/ Não Iniciado</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setActiveTab('danger');
                        setShowConfirmResetModal(true);
                      }}
                      className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Resetar jogadores dos clubes, devolver ao mercado e reembolsar orçamentos"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Reset de Mercado & Saldos</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {auction.status === 'NOT_STARTED'
                    ? 'Mensagem visível para todos: "leilão ainda não iniciado, participantes se preparem para logo em breve darmos inicio ao leilão". Quando todos os participantes estiverem presentes, clique em "Iniciar Leilão Oficial".'
                    : auction.status === 'ENDED'
                      ? 'O leilão foi finalizado. Os participantes podem checar suas equipes formadas na prévia.'
                      : 'O leilão está aberto para anúncios e disputas de lances em tempo real.'}
                </p>
              </div>

              {/* Status do Jogador / Rodada Atual */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Status do Jogador / Rodada Atual
                </span>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      auction.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : auction.status === 'PAUSED'
                          ? 'bg-amber-100 text-amber-800'
                          : auction.status === 'NOT_STARTED'
                            ? 'bg-amber-100 text-amber-900'
                            : auction.status === 'ENDED'
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-slate-200 text-slate-700'
                    }`}>
                      {auction.status === 'ACTIVE'
                        ? '🟢 Disputa Ativa'
                        : auction.status === 'PAUSED'
                          ? '⏸️ Disputa Pausada'
                          : auction.status === 'NOT_STARTED'
                            ? '⚪ Aguardando Início Geral'
                            : auction.status === 'ENDED'
                              ? '🏁 Encerrado'
                              : '⚪ Aguardando Anúncio'}
                    </span>
                    {auction.currentPlayer && (
                      <span className="text-xs font-extrabold text-slate-800">
                        {auction.currentPlayer.name} (Lance Atual: {formatCurrency(auction.currentBid?.amount || auction.currentPlayer.initialPrice)})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      Cronômetro: <strong className="text-amber-800 font-mono">{formatAuctionTimer(auction.timerRemaining)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleCopyCurrentTimer();
                        const el = document.getElementById('admin-timer-editor');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="Editar tempo do leilão"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Editar Tempo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {auction.status === 'ACTIVE' ? (
                  <button
                    onClick={() => onAdminAuctionAction('PAUSE')}
                    className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pausar Leilão</span>
                  </button>
                ) : auction.status === 'PAUSED' ? (
                  <button
                    onClick={() => onAdminAuctionAction('RESUME')}
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Retomar Leilão</span>
                  </button>
                ) : null}

                <button
                  onClick={() => onAdminAuctionAction('FORCE_FINISH')}
                  disabled={auction.status === 'IDLE'}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <Gavel className="w-4 h-4" />
                  <span>Bater Martelo (Finalizar)</span>
                </button>

                <button
                  onClick={() => {
                    handleCopyCurrentTimer();
                    const el = document.getElementById('admin-timer-editor');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  title="Abrir editor de tempo do leilão para definir horas, minutos ou segundos"
                >
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>Editar Tempo do Leilão</span>
                </button>

                <button
                  onClick={() => onAdminAuctionAction('RESET_TIMER', 5400)}
                  disabled={auction.status === 'IDLE'}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                  title="Ajusta o cronômetro para 1 hora e 30 minutos (padrão oficial)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Resetar Timer (1h30m)</span>
                </button>

                <button
                  onClick={() => onAdminAuctionAction('CANCEL_AUCTION')}
                  disabled={auction.status === 'IDLE'}
                  className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Cancelar Leilão Atual</span>
                </button>

                <button
                  onClick={() => onAdminAuctionAction('TOGGLE_FREE_NOMINATION')}
                  className={`p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border cursor-pointer ${
                    auction.isFreeNominationMode
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <span>Modo Livre Anúncio: {auction.isFreeNominationMode ? 'ATIVO' : 'DESATIVADO'}</span>
                </button>

                <div
                  className="p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border bg-emerald-50 text-emerald-950 border-emerald-300"
                  title="O regulamento da Khedira League determina o sigilo permanente das propostas durante a disputa ao vivo"
                >
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Sigilo de Lances: OBRIGATÓRIO (Ativo)</span>
                </div>
              </div>

              {/* SEÇÃO DEDICADA: EDITAR TEMPO DO LEILÃO */}
              <div id="admin-timer-editor" className="p-5 bg-gradient-to-br from-amber-500/10 via-slate-50 to-slate-100/90 rounded-2xl border border-amber-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                        Controle Oficial de Cronômetro
                      </span>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span>Editar Tempo do Leilão</span>
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl shadow-xs text-xs font-bold text-slate-700 flex items-center gap-2">
                      <Timer className="w-3.5 h-3.5 text-amber-600" />
                      <span>Cronômetro Atual: <strong className="text-amber-800 font-mono text-sm">{formatAuctionTimer(auction.timerRemaining)}</strong></span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
                      Padrão da Liga: {Math.floor((auction.defaultDurationSeconds || 5400) / 60)} min
                    </span>
                  </div>
                </div>

                {/* Formulário de Tempo Personalizado */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-slate-600 font-medium">
                      Insira o tempo desejado para a disputa de lances (horas, minutos e segundos):
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyCurrentTimer}
                      className="text-[11px] text-amber-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      title="Preencher campos com o tempo que resta atualmente"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Copiar Tempo Restante Atual</span>
                    </button>
                  </div>

                  <div className="flex items-center flex-wrap gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Horas:</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        placeholder="0"
                        className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Minutos:</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        placeholder="30"
                        className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-700">Segundos:</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customSeconds}
                        onChange={(e) => setCustomSeconds(e.target.value)}
                        placeholder="0"
                        className="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <button
                        type="button"
                        onClick={handleApplyCustomTimer}
                        disabled={isApplyingTimer}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        title="Aplica o tempo configurado diretamente ao cronômetro da disputa ativa"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aplicar ao Leilão Agora</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSetAsDefaultDuration}
                        disabled={isApplyingTimer}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        title="Salva este tempo como padrão para todas as próximas disputas de jogadores"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-600" />
                        <span>Salvar como Padrão da Liga</span>
                      </button>
                    </div>
                  </div>

                  {/* Ajustes Rápidos (+ / -) */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 mr-1">Ajuste rápido:</span>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustTimer(900)}
                        disabled={isApplyingTimer}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        title="Adicionar 15 minutos ao cronômetro"
                      >
                        +15 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustTimer(300)}
                        disabled={isApplyingTimer}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        title="Adicionar 5 minutos ao cronômetro"
                      >
                        +5 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustTimer(60)}
                        disabled={isApplyingTimer}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        title="Adicionar 1 minuto ao cronômetro"
                      >
                        +1 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustTimer(-60)}
                        disabled={isApplyingTimer}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        title="Subtrair 1 minuto do cronômetro"
                      >
                        -1 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustTimer(-300)}
                        disabled={isApplyingTimer}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        title="Subtrair 5 minutos do cronômetro"
                      >
                        -5 min
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomHours('1');
                        setCustomMinutes('30');
                        setCustomSeconds('0');
                        onAdminAuctionAction('RESET_TIMER', 5400);
                        setTimerFeedback('Cronômetro redefinido para 1h 30m (padrão oficial da Khedira League)!');
                        setTimeout(() => setTimerFeedback(null), 3500);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                      title="Restaurar o tempo padrão de 1 hora e 30 minutos"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-600" />
                      <span>Resetar p/ Padrão Oficial (1h30m)</span>
                    </button>
                  </div>

                  {timerFeedback && (
                    <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{timerFeedback}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CONFIGURAÇÃO DO FORMATO E TIPO DE LEILÃO (LIVRE OU POR FASES) */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                      Regulamento de Disputa & Mercado
                    </span>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-amber-600" />
                      <span>Tipo de Leilão (Modalidade da Liga)</span>
                    </h3>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    auction.auctionType === 'PHASED'
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}>
                    {auction.auctionType === 'PHASED' ? '📋 Leilão por Fases Ativo' : '🌐 Leilão Livre Ativo'}
                  </span>
                </div>

                {/* Opções de Tipo de Leilão */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Opção 1: Leilão Livre */}
                  <button
                    type="button"
                    onClick={() => onAdminAuctionAction('SET_AUCTION_TYPE', 'FREE')}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer relative overflow-hidden group ${
                      auction.auctionType !== 'PHASED'
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          auction.auctionType !== 'PHASED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          🌐
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">Leilão Livre</h4>
                          <span className="text-[10px] text-slate-500 font-semibold block">Todas as Posições Abertas</span>
                        </div>
                      </div>
                      {auction.auctionType !== 'PHASED' && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-600 text-white">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                      Todos os participantes podem postar seu interesse por jogadores de <strong>todas as posições</strong> (Goleiros, Defensores, Meio-Campo e Atacantes) simultaneamente.
                    </p>
                  </button>

                  {/* Opção 2: Leilão por Fases */}
                  <button
                    type="button"
                    onClick={() => onAdminAuctionAction('SET_AUCTION_TYPE', 'PHASED')}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer relative overflow-hidden group ${
                      auction.auctionType === 'PHASED'
                        ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          auction.auctionType === 'PHASED' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          📋
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">Leilão por Fases</h4>
                          <span className="text-[10px] text-slate-500 font-semibold block">Goleiros, Defensores, Meio & Ataque</span>
                        </div>
                      </div>
                      {auction.auctionType === 'PHASED' && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-blue-600 text-white">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                      O leilão segue etapas sequenciais: <strong>Goleiros → Defensores → Meio-Campo → Atacantes</strong>. Apenas atletas da fase ativa podem ser postados pelos clubes.
                    </p>
                  </button>
                </div>

                {/* Sub-painel: Controle das 4 Fases quando Leilão por Fases estiver ativo */}
                {auction.auctionType === 'PHASED' && (
                  <div className="p-4 bg-white rounded-xl border border-blue-200 space-y-3 mt-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">
                          Etapas Setoriais do Leilão
                        </span>
                        <p className="text-xs text-slate-700 font-medium">
                          Fase atual do leilão: <strong className="text-blue-900 font-black">{AUCTION_PHASES.find(p => p.id === (auction.currentPhase || 'GOLEIROS'))?.label}</strong>
                        </p>
                      </div>

                      {/* Botão de Avançar para a Próxima Fase */}
                      <button
                        type="button"
                        onClick={() => {
                          const phases: AuctionPhase[] = ['GOLEIROS', 'DEFENSORES', 'MEIO_CAMPO', 'ATACANTES'];
                          const currentIdx = phases.indexOf(auction.currentPhase || 'GOLEIROS');
                          const nextPhase = phases[(currentIdx + 1) % phases.length];
                          onAdminAuctionAction('SET_AUCTION_PHASE', nextPhase);
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Avança automaticamente para o próximo setor da disputa"
                      >
                        <span>Avançar Fase</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Cards das 4 Fases */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {AUCTION_PHASES.map((phase, idx) => {
                        const isCurrent = (auction.currentPhase || 'GOLEIROS') === phase.id;
                        const phaseAvailableCount = players.filter(
                          p => p.status === 'AVAILABLE' && (phase.positions as string[]).includes(p.position)
                        ).length;

                        return (
                          <button
                            key={phase.id}
                            type="button"
                            onClick={() => onAdminAuctionAction('SET_AUCTION_PHASE', phase.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isCurrent
                                ? `${phase.activeClass} border-transparent shadow-xs scale-[1.02]`
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-base">{phase.icon}</span>
                                {isCurrent ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-white/25 rounded">
                                    Fase Ativa
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {idx + 1}ª Etapa
                                  </span>
                                )}
                              </div>
                              <h5 className={`text-xs font-black leading-tight ${isCurrent ? 'text-white' : 'text-slate-900'}`}>
                                {phase.shortLabel}
                              </h5>
                              <p className={`text-[10px] font-medium mt-0.5 line-clamp-1 ${isCurrent ? 'text-white/80' : 'text-slate-500'}`}>
                                {phase.positions.join(', ')}
                              </p>
                            </div>
                            <div className="mt-2 pt-1 border-t border-black/10 flex items-center justify-between text-[10px] font-bold">
                              <span className={isCurrent ? 'text-white/90' : 'text-slate-600'}>
                                {phaseAvailableCount} disp.
                              </span>
                              <span className={`text-[9px] font-black uppercase ${isCurrent ? 'underline' : 'opacity-60'}`}>
                                {isCurrent ? 'No Ar' : 'Ativar'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Set Nominator Turn */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Definir Vez de Anunciar (Turno):
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={auction.nominationTurnUserId || ''}
                    onChange={(e) => onAdminAuctionAction('SET_NOMINATOR', e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.teamName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INITIAL PRICES & ADD PLAYERS */}
          {activeTab === 'players' && (
            <div className="space-y-6">
              {/* Form: Add New Player */}
              <form onSubmit={handleCreatePlayer} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Cadastrar Atleta Extra no EAFC 27
                  </h4>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    Lance Mínimo Oficial: € 10M
                  </span>
                </div>

                <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-snug">
                  ⚖️ <strong>Regra Oficial (Seção 2 da Ata):</strong> A inclusão de jogadores extras sob demanda exige lance inicial mínimo obrigatório de <strong>€ 10.000.000</strong>.
                </div>

                {createMsg && (
                  <div className={`p-2.5 text-xs font-bold rounded-lg flex items-center gap-2 ${
                    createMsg.includes('Atenção')
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <Check className="w-4 h-4" />
                    <span>{createMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Nome do Jogador</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Vitor Roque"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Posição</label>
                    <select
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value as PlayerPosition)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="GOL">GOL (Goleiro)</option>
                      <option value="ZAG">ZAG (Zagueiro)</option>
                      <option value="LE">LE (Lateral Esquerdo)</option>
                      <option value="LD">LD (Lateral Direito)</option>
                      <option value="VOL">VOL (Volante)</option>
                      <option value="MC">MC (Meio-Campo)</option>
                      <option value="MEI">MEI (Meia Ofensivo)</option>
                      <option value="PD">PD (Ponta Direita)</option>
                      <option value="PE">PE (Ponta Esquerda)</option>
                      <option value="ATA">ATA (Atacante)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Preço Inicial de Abertura (€) — Mínimo € 10M</label>
                    <input
                      type="number"
                      step="1000000"
                      min="10000000"
                      required
                      placeholder="Ex: 10000000"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Jogador no Mercado (€ 10M+)</span>
                </button>
              </form>

              {/* Edit Base Prices Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Editar Preço Inicial de Jogadores
                  </h4>
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48"
                  />
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {filteredPlayers.map((player) => (
                    <div key={player.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{player.name}</span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-[10px] font-bold rounded">
                            {player.position}
                          </span>
                          {player.status === 'SOLD' && (
                            <span className="px-1.5 py-0.2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded">
                              Vendido ({player.soldTo?.userName || 'Time'})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {editingPlayerId === player.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="500000"
                              value={editPriceValue}
                              onChange={(e) => setEditPriceValue(e.target.value)}
                              className="w-28 px-2 py-1 text-xs border rounded-lg font-bold"
                            />
                            <button
                              onClick={() => handleSavePrice(player.id)}
                              className="px-2 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[10px]"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingPlayerId(null)}
                              className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px]"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-xs">
                              {formatCurrency(player.initialPrice)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingPlayerId(player.id);
                                setEditPriceValue(String(player.initialPrice));
                              }}
                              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                            >
                              Editar Preço
                            </button>
                            {player.status === 'SOLD' && onAdminReleasePlayer && (
                              <button
                                onClick={() => onAdminReleasePlayer(player.id)}
                                className="px-2.5 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded-lg cursor-pointer inline-flex items-center gap-1"
                                title="Liberar jogador e devolver ao mercado de transferências"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Liberar p/ Mercado</span>
                              </button>
                            )}
                            <button
                              onClick={() => onAdminDeletePlayer(player.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Remover Jogador"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USER ROLES & BUDGETS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-3 text-xs text-amber-950">
                <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">Liderança & Administração da Liga</div>
                  <p className="text-amber-800/90 mt-0.5 leading-relaxed">
                    A administração da Khedira League é composta por <strong>Guilherme Pereira (Diretor)</strong> e <strong>Guilherme Tourinho (Presidente)</strong>, ambos com os mesmos poderes e permissões administrativas completas sobre controle de lances, orçamentos, jogadores e regulamento.
                  </p>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Participantes & Orçamentos da Liga
              </h4>

              <div className="space-y-3">
                {users.map((u) => {
                  const roleBadge = getUserRoleBadge(u);
                  return (
                    <div key={u.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{u.name}</span>
                            {u.role === 'ADMIN' ? (
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full flex items-center gap-1 ${roleBadge.badgeClass}`}>
                                <Crown className="w-3 h-3 text-amber-600" />
                                {roleBadge.badgeLabel}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                                PARTICIPANTE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{u.email} • Time: <strong>{u.teamName}</strong></p>
                        </div>

                        {/* Role Badge / Status */}
                        <div>
                          {u.role === 'ADMIN' ? (
                            <span className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-amber-600" />
                              {roleBadge.title}
                            </span>
                          ) : (
                            <span className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                              Participante da Liga
                            </span>
                          )}
                        </div>
                      </div>

                    {/* Budget & Squad status */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Saldo:</span>
                          <span className="font-extrabold text-emerald-700">
                            {formatCurrency(u.budget)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            (Base: €400M fixo)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">Elenco:</span>
                          <span className={`font-black text-xs px-2 py-0.5 rounded ${
                            players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === u.id).length >= 23
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === u.id).length}/23 atletas
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (window.confirm(`Tem certeza que deseja resetar todas as compras e saldo de ${u.name}?`)) {
                            onAdminResetUser(u.id);
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Resetar Time / Saldo
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DANGER ZONE / RESET */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              {resetFeedback && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 font-semibold animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{resetFeedback}</span>
                </div>
              )}

              {/* CARD PRINCIPAL DE RESET */}
              <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md space-y-5 border border-slate-700">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Função Administrativa Oficial
                    </span>
                    <h3 className="text-lg font-black text-white">
                      Reset de Mercado, Elencos & Devolução de Saldo
                    </h3>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Reinicia a fase de negociações da liga retirando todos os atletas dos elencos dos clubes, recolocando-os no mercado como disponíveis e restituindo 100% do orçamento de cada clube cadastrado.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowConfirmResetModal(true)}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Executar Reset de Mercado</span>
                  </button>
                </div>

                {/* Métricas do Impacto */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Atletas Vendidos</span>
                    <div className="text-xl font-black text-rose-400 mt-0.5">
                      {soldPlayers.length} jogadores
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Retornarão ao mercado como disponíveis
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total a Reembolsar</span>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">
                      {formatCurrency(totalMoneyInvested)}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Devolução integral aos cofres dos clubes
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Clubes na Liga</span>
                    <div className="text-xl font-black text-amber-300 mt-0.5">
                      {users.length} participantes
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Saldo restaurado para € 400M cada
                    </span>
                  </div>
                </div>
              </div>

              {/* O QUE O RESET FAZ (CHECKLIST DETALHADA) */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Efeitos Executados pelo Reset
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      1. Retirada de Todos os Jogadores dos Clubes
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Remove os jogadores de todos os elencos e esvazia as pranchetas táticas (titulares e reservas) de todos os times.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      2. Retorno de Atletas ao Mercado
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Todos os atletas voltam a ter status <strong>"Disponível"</strong>, sem proprietário, com seus valores base restaurados para novos lances.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      3. Devolução de 100% do Saldo aos Usuários
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      O saldo de cada clube participante volta exatamente para <strong>€ 400.000.000 (€ 400M)</strong> e o valor total gasto é zerado.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      4. Zeramento do Histórico de Lances
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      O histórico de lances da rodada e todas as propostas ativas de atletas são 100% zerados e limpos.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      5. Preservação de Usuários e Clubes
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Nenhuma conta, login, clube ou permissão de administrador é deletada. O cadastro de participantes continua mantido.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowConfirmResetModal(true)}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Iniciar Reset de Mercado & Saldos</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RELATÓRIO DE CONTRATAÇÕES POR FASE DO LEILÃO (EXCLUSIVO ADM) */}
          {activeTab === 'report' && (
            <AdminSigningsReportSection
              currentUser={currentUser}
              players={players}
              users={users}
              auction={auction}
              onAdminReleasePlayer={onAdminReleasePlayer}
            />
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE RESET SEGURO */}
      {showConfirmResetModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Confirmar Reset da Liga & Mercado
                </h3>
                <p className="text-xs text-slate-500">
                  Ação exclusiva para a Diretoria da Khedira League
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="font-bold text-amber-950">
                Atenção aos efeitos desta operação:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-amber-900/90 text-[11px]">
                <li>Todos os <strong>{soldPlayers.length} jogadores</strong> atualmente em clubes voltarão a ficar disponíveis no mercado.</li>
                <li>O <strong>histórico de lances da rodada</strong> e todas as propostas ativas serão completamente zerados.</li>
                <li>As escalações e pranchetas táticas de todos os clubes serão esvaziadas.</li>
                <li>O saldo de todos os <strong>{users.length} participantes</strong> será restaurado para <strong>€ 400.000.000 (€ 400M)</strong>.</li>
                <li>Um anúncio oficial será transmitido em tempo real na tela de todos os participantes.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executando Reset...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Sim, Resetar Mercado e Saldos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
