import React, { useState, useMemo } from 'react';
import { 
  FileText, TrendingUp, Trophy, Users, DollarSign, 
  Search, Copy, Check, Printer, ArrowUpDown, Filter, 
  ShieldAlert, ShieldCheck, Calendar, Flame, Sparkles, 
  RotateCcw, ChevronRight, Download, BarChart3,
  Building2, ChevronDown, ChevronUp, Layers, Table,
  CheckCircle2, Wallet, ExternalLink
} from 'lucide-react';
import { Player, UserProfile, AuctionState } from '../types';
import { formatCurrency, getPositionBadge, getPlayerAuctionPhase, getDayLabel, getUserRoleBadge } from '../utils/formatters';

export interface AdminSigningsReportSectionProps {
  currentUser: UserProfile | null;
  players: Player[];
  users: UserProfile[];
  auction?: AuctionState;
  onAdminReleasePlayer?: (playerId: string) => Promise<boolean>;
}

export const AdminSigningsReportSection: React.FC<AdminSigningsReportSectionProps> = ({
  currentUser,
  players,
  users,
  auction,
  onAdminReleasePlayer,
}) => {
  // Mode: 'clubs' (Visão por Clubes & Elencos Fechados) or 'table' (Histórico Geral de Contratações)
  const [reportViewMode, setReportViewMode] = useState<'clubs' | 'table'>('clubs');
  const [selectedPhase, setSelectedPhase] = useState<'ALL' | 1 | 2 | 3>('ALL');
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('ALL');
  const [selectedPositionFilter, setSelectedPositionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'amount' | 'name' | 'agio' | 'teamName'>('amount');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [copiedClubId, setCopiedClubId] = useState<string | null>(null);
  const [expandedClubIds, setExpandedClubIds] = useState<{ [clubId: string]: boolean }>({});
  const [releasingPlayerId, setReleasingPlayerId] = useState<string | null>(null);

  // Security Verification: Only ADMs can view this report
  const isAdmin = currentUser?.role === 'ADMIN';
  const isAuctionEnded = auction?.status === 'ENDED';

  // All sold players
  const allSoldPlayers = useMemo(() => {
    return players.filter((p) => p.status === 'SOLD' && p.soldTo);
  }, [players]);

  // Split by phase
  const phase1Sold = useMemo(() => {
    return allSoldPlayers.filter((p) => getPlayerAuctionPhase(p) === 1);
  }, [allSoldPlayers]);

  const phase2Sold = useMemo(() => {
    return allSoldPlayers.filter((p) => getPlayerAuctionPhase(p) === 2);
  }, [allSoldPlayers]);

  const phase3Sold = useMemo(() => {
    return allSoldPlayers.filter((p) => getPlayerAuctionPhase(p) === 3);
  }, [allSoldPlayers]);

  // Current active list depending on phase filter
  const currentPhaseSold = useMemo(() => {
    if (selectedPhase === 1) return phase1Sold;
    if (selectedPhase === 2) return phase2Sold;
    if (selectedPhase === 3) return phase3Sold;
    return allSoldPlayers;
  }, [selectedPhase, phase1Sold, phase2Sold, phase3Sold, allSoldPlayers]);

  // Spending and squad list mapped by Club (User)
  const clubDossiers = useMemo(() => {
    return users.map((u) => {
      const clubSoldPlayers = allSoldPlayers.filter((p) => p.soldTo?.userId === u.id);
      const totalSpent = clubSoldPlayers.reduce((sum, p) => sum + (p.soldTo?.amount || 0), 0);
      const initialBudget = u.budget || 400000000;
      const remainingCash = Math.max(0, initialBudget - totalSpent);
      const percentSpent = initialBudget > 0 ? Math.min(100, Math.round((totalSpent / initialBudget) * 100)) : 0;

      // Group by positions
      const countGk = clubSoldPlayers.filter((p) => p.position === 'GOL').length;
      const countDef = clubSoldPlayers.filter((p) => ['ZAG', 'LE', 'LD'].includes(p.position)).length;
      const countMid = clubSoldPlayers.filter((p) => ['VOL', 'MC', 'MEI', 'MD', 'ME'].includes(p.position)).length;
      const countAtk = clubSoldPlayers.filter((p) => ['ATA', 'PD', 'PE', 'SA'].includes(p.position)).length;

      return {
        user: u,
        clubName: u.teamName || 'Clube Sem Nome',
        managerName: u.name,
        players: clubSoldPlayers,
        count: clubSoldPlayers.length,
        totalSpent,
        initialBudget,
        remainingCash,
        percentSpent,
        breakdown: { countGk, countDef, countMid, countAtk }
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [users, allSoldPlayers]);

  // Filter & sort for table view
  const filteredAndSortedList = useMemo(() => {
    return currentPhaseSold
      .filter((player) => {
        // Club Filter
        if (selectedClubFilter !== 'ALL' && player.soldTo?.userId !== selectedClubFilter) {
          return false;
        }

        // Position Filter
        if (selectedPositionFilter !== 'ALL') {
          if (selectedPositionFilter === 'GOL' && player.position !== 'GOL') return false;
          if (selectedPositionFilter === 'DEF' && !['ZAG', 'LE', 'LD'].includes(player.position)) return false;
          if (selectedPositionFilter === 'MID' && !['VOL', 'MC', 'MEI', 'MD', 'ME'].includes(player.position)) return false;
          if (selectedPositionFilter === 'ATK' && !['ATA', 'PD', 'PE', 'SA'].includes(player.position)) return false;
        }

        // Search Query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesPlayer = player.name.toLowerCase().includes(q);
        const matchesClub = player.club.toLowerCase().includes(q);
        const matchesTeam = player.soldTo?.teamName?.toLowerCase().includes(q) || false;
        const matchesBuyer = player.soldTo?.userName?.toLowerCase().includes(q) || false;
        const matchesPos = player.position.toLowerCase().includes(q);
        return matchesPlayer || matchesClub || matchesTeam || matchesBuyer || matchesPos;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === 'amount') {
          comp = (a.soldTo?.amount || 0) - (b.soldTo?.amount || 0);
        } else if (sortField === 'name') {
          comp = a.name.localeCompare(b.name);
        } else if (sortField === 'teamName') {
          comp = (a.soldTo?.teamName || '').localeCompare(b.soldTo?.teamName || '');
        } else if (sortField === 'agio') {
          const agioA = (a.soldTo?.amount || 0) - a.initialPrice;
          const agioB = (b.soldTo?.amount || 0) - b.initialPrice;
          comp = agioA - agioB;
        }
        return sortOrder === 'desc' ? -comp : comp;
      });
  }, [currentPhaseSold, selectedClubFilter, selectedPositionFilter, searchQuery, sortField, sortOrder]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const count = allSoldPlayers.length;
    const totalSpent = allSoldPlayers.reduce((sum, p) => sum + (p.soldTo?.amount || 0), 0);
    const totalInitial = allSoldPlayers.reduce((sum, p) => sum + p.initialPrice, 0);
    const avgPrice = count > 0 ? totalSpent / count : 0;
    const totalAgio = totalSpent - totalInitial;
    const agioPercent = totalInitial > 0 ? (totalAgio / totalInitial) * 100 : 0;

    // Highest signing
    let topSigning: Player | null = null;
    let maxAmount = -1;
    for (const p of allSoldPlayers) {
      if (p.soldTo && p.soldTo.amount > maxAmount) {
        maxAmount = p.soldTo.amount;
        topSigning = p;
      }
    }

    // Top spender club
    const topClub = clubDossiers.length > 0 && clubDossiers[0].count > 0 ? clubDossiers[0] : null;

    return {
      count,
      totalSpent,
      avgPrice,
      totalAgio,
      agioPercent,
      topSigning,
      topClub,
    };
  }, [allSoldPlayers, clubDossiers]);

  // Toggle club card expansion
  const toggleClubExpanded = (clubId: string) => {
    setExpandedClubIds((prev) => ({
      ...prev,
      [clubId]: !prev[clubId],
    }));
  };

  const handleExpandAllClubs = () => {
    const next: { [id: string]: boolean } = {};
    clubDossiers.forEach((c) => (next[c.user.id] = true));
    setExpandedClubIds(next);
  };

  const handleCollapseAllClubs = () => {
    setExpandedClubIds({});
  };

  // Download complete CSV file
  const handleDownloadCSV = () => {
    const headers = [
      'ID',
      'Atleta',
      'Posição',
      'Fase',
      'Clube de Origem',
      'Nacionalidade',
      'Clube de Destino (Khedira League)',
      'Presidente / Técnico',
      'Valor Base Inicial (€)',
      'Valor Final Arrematado (€)',
      'Disputa / Ágio (€)',
      'Ágio (%)',
      'Status da Contratação'
    ];

    const rows = allSoldPlayers.map((p) => {
      const finalAmount = p.soldTo?.amount || 0;
      const agio = finalAmount - p.initialPrice;
      const agioPct = p.initialPrice > 0 ? ((agio / p.initialPrice) * 100).toFixed(1) : '0';
      return [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.position,
        getPlayerAuctionPhase(p),
        `"${p.club.replace(/"/g, '""')}"`,
        `"${p.nationality.replace(/"/g, '""')}"`,
        `"${(p.soldTo?.teamName || '').replace(/"/g, '""')}"`,
        `"${(p.soldTo?.userName || '').replace(/"/g, '""')}"`,
        p.initialPrice,
        finalAmount,
        agio,
        `${agioPct}%`,
        'Contratado Oficial'
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `khedira-league-contratacoes-finais-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy individual club squad to clipboard
  const handleCopySingleClub = (club: typeof clubDossiers[0]) => {
    let text = `📋 *KHEDIRA LEAGUE — ELENCO FECHADO: ${club.clubName.toUpperCase()}*\n`;
    text += `👤 *Presidente/Gestor:* ${club.managerName}\n`;
    text += `💰 *Total Investido:* ${formatCurrency(club.totalSpent)}\n`;
    text += `💵 *Saldo em Caixa:* ${formatCurrency(club.remainingCash)}\n`;
    text += `👥 *Total de Atletas:* ${club.count} jogadores\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (club.players.length === 0) {
      text += `_Nenhum jogador contratado no leilão._\n`;
    } else {
      club.players.forEach((p, idx) => {
        text += `${idx + 1}. *${p.name}* (${p.position}) — ${p.club} ➔ *${formatCurrency(p.soldTo?.amount || 0)}*\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedClubId(club.user.id);
    setTimeout(() => setCopiedClubId(null), 3000);
  };

  // Copy full structured WhatsApp/Clipboard Report with Club Breakdown
  const handleCopyReport = () => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const adminLabel = currentUser 
      ? `${currentUser.name} (${getUserRoleBadge(currentUser).title})`
      : 'Diretoria Oficial';

    let text = `📋 *KHEDIRA LEAGUE 2026/27 — DOSSIÊ COMPLETO DE CONTRATAÇÕES & ELENCOS FECHADOS*\n`;
    text += `👑 *Emitido por:* ${adminLabel}\n`;
    text += `📅 *Gerado em:* ${timestamp}\n`;
    text += `🏁 *Status do Leilão:* ${isAuctionEnded ? 'FINALIZADO (Elencos Fechados)' : 'EM ANDAMENTO'}\n`;
    text += `🔒 *Auditoria Oficial da Diretoria da Liga*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📊 *BALANÇO GERAL CONSOLIDADO DA LIGA*\n`;
    text += `• Total de Contratações Realizadas: *${allSoldPlayers.length} atletas*\n`;
    text += `• Montante Total Movimentado: *${formatCurrency(metrics.totalSpent)}*\n`;
    text += `• Média por Jogador: *${formatCurrency(metrics.avgPrice)}*\n`;
    text += `• Total de Ágio / Disputa: *${formatCurrency(metrics.totalAgio)}* (+${metrics.agioPercent.toFixed(1)}%)\n`;
    if (metrics.topSigning) {
      text += `• Maior Contratação: *${metrics.topSigning.name}* ➔ *${metrics.topSigning.soldTo?.teamName}* (${formatCurrency(metrics.topSigning.soldTo?.amount || 0)})\n`;
    }
    text += `\n`;

    // Breakdown Club by Club
    text += `🏛️ *ELENCOS FECHADOS E CONTRATAÇÕES CLUBE A CLUBE*\n\n`;
    clubDossiers.forEach((club, cIdx) => {
      text += `📌 *${cIdx + 1}. ${club.clubName.toUpperCase()}* (${club.managerName})\n`;
      text += `   • Reforços Contratados: *${club.count} atletas*\n`;
      text += `   • Total Gasto: *${formatCurrency(club.totalSpent)}* | Caixa Restante: *${formatCurrency(club.remainingCash)}*\n`;

      if (club.players.length === 0) {
        text += `   _Nenhum reforço arrematado._\n\n`;
      } else {
        club.players.forEach((p, pIdx) => {
          text += `   ${pIdx + 1}) *${p.name}* [${p.position}] (${p.club}) — *${formatCurrency(p.soldTo?.amount || 0)}*\n`;
        });
        text += `\n`;
      }
    });

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleRelease = async (playerId: string) => {
    if (!onAdminReleasePlayer) return;
    if (!window.confirm('Tem certeza que deseja cancelar esta contratação e devolver o atleta ao mercado de disponíveis? O valor será estornado ao clube.')) {
      return;
    }
    setReleasingPlayerId(playerId);
    try {
      await onAdminReleasePlayer(playerId);
    } finally {
      setReleasingPlayerId(null);
    }
  };

  // If not admin, block rendering completely
  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-4 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Acesso Restrito aos Administradores</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Este relatório com o histórico completo de contratações e destino de atletas é de visualização exclusiva dos Diretores e Administradores da Khedira League.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 p-5 sm:p-6 rounded-2xl text-white shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3 h-3" />
                Dossiê Oficial dos Administradores
              </span>
              {isAuctionEnded ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Leilão Finalizado & Elencos Fechados
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-blue-400" />
                  Leilão em Andamento
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-amber-400 shrink-0" />
              <span>Histórico Completo de Contratações & Destino dos Atletas</span>
            </h2>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Consulte em mãos o histórico integral de todos os atletas contratados no leilão, os valores finais arrematados, o ágio de disputa e o clube de destino de cada jogador na Khedira League 2026/27.
            </p>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Baixar planilha completa em formato CSV para Excel/Google Sheets"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Planilha (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Copiar relatório formatado para WhatsApp, Discord ou Ata Oficial"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-4 h-4 text-emerald-950" />
                  <span>Dossiê Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Dossiê Completo</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Total de Contratações</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {metrics.count} <span className="text-xs font-semibold text-slate-500">atletas</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Distribuídos entre os {clubDossiers.filter((c) => c.count > 0).length} clubes ativos
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Volume Total Movimentado</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {formatCurrency(metrics.totalSpent, true)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Ágio de Disputa: +{formatCurrency(metrics.totalAgio, true)} ({metrics.agioPercent.toFixed(1)}%)
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Média por Contratação</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">
            {formatCurrency(metrics.avgPrice, true)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Preço médio pago por atleta
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Maior Contratação</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          {metrics.topSigning ? (
            <div>
              <div className="text-sm font-black text-slate-900 truncate" title={metrics.topSigning.name}>
                {metrics.topSigning.name}
              </div>
              <span className="text-xs font-black text-amber-600">
                {formatCurrency(metrics.topSigning.soldTo?.amount || 0)}
              </span>
              <span className="text-[10px] text-slate-500 block truncate" title={metrics.topSigning.soldTo?.teamName}>
                ➔ {metrics.topSigning.soldTo?.teamName}
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-medium mt-1">
              Nenhuma negociação realizada
            </div>
          )}
        </div>
      </div>

      {/* 3. Primary Mode Navigation Tabs: Visão por Clubes vs Histórico Geral */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setReportViewMode('clubs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportViewMode === 'clubs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Visão por Clubes & Elencos Fechados ({clubDossiers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportViewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-emerald-600" />
            <span>Histórico Geral & Tabela de Destinos ({allSoldPlayers.length})</span>
          </button>
        </div>

        {reportViewMode === 'clubs' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAllClubs}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Expandir Todos
            </button>
            <button
              type="button"
              onClick={handleCollapseAllClubs}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Recolher Todos
            </button>
          </div>
        )}
      </div>

      {/* 4. VIEW MODE 1: VISÃO POR CLUBES & ELENCOS FECHADOS */}
      {reportViewMode === 'clubs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                <span>Balanço e Elencos Fechados por Clube</span>
              </h3>
              <p className="text-xs text-slate-500">
                Lista detalhada de todos os jogadores contratados por cada clube, valores pagos, montante investido e saldo restante.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {clubDossiers.map((club, idx) => {
              const isExpanded = expandedClubIds[club.user.id] ?? (idx === 0);
              const isCopied = copiedClubId === club.user.id;

              return (
                <div
                  key={club.user.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
                >
                  {/* Club Header Bar */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 border-b border-slate-100">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                        idx === 0 
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300' 
                          : idx === 1 
                          ? 'bg-slate-300 text-slate-900' 
                          : idx === 2 
                          ? 'bg-amber-700 text-white' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-slate-900 truncate">
                            {club.clubName}
                          </h4>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            club.count >= 11
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : club.count > 0
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {club.count} {club.count === 1 ? 'contratação' : 'contratações'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>Presidente: <strong className="text-slate-700">{club.managerName}</strong></span>
                          <span>•</span>
                          <span>GOL: <strong className="text-slate-800">{club.breakdown.countGk}</strong></span>
                          <span>DEF: <strong className="text-slate-800">{club.breakdown.countDef}</strong></span>
                          <span>MEI: <strong className="text-slate-800">{club.breakdown.countMid}</strong></span>
                          <span>ATA: <strong className="text-slate-800">{club.breakdown.countAtk}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex items-center gap-4 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
                      <div className="text-right">
                        <div className="text-xs text-slate-500 font-semibold">Total Investido</div>
                        <div className="text-sm sm:text-base font-black text-emerald-700">
                          {formatCurrency(club.totalSpent)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Caixa Restante: {formatCurrency(club.remainingCash, true)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopySingleClub(club)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Copiar lista de contratações deste clube"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copiar Clube</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleClubExpanded(club.user.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title={isExpanded ? 'Recolher atletas' : 'Expandir atletas'}
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Visual Budget Bar */}
                  <div className="px-5 py-2 bg-slate-50/50 flex items-center gap-3 text-xs border-b border-slate-100">
                    <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                      Consumo do Orçamento (€ 400.0M):
                    </span>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-amber-500 h-full"
                        style={{ width: `${club.percentSpent}%` }}
                        title={`Gasto: ${formatCurrency(club.totalSpent)} (${club.percentSpent}%)`}
                      />
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${100 - club.percentSpent}%` }}
                        title={`Disponível: ${formatCurrency(club.remainingCash)}`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 shrink-0">
                      {club.percentSpent}% gasto
                    </span>
                  </div>

                  {/* Expanded Players List */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5">
                      {club.players.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <p className="text-xs font-bold text-slate-600">Nenhum jogador contratado no leilão</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            O clube não arrematou atletas nesta edição e preservou 100% de seu orçamento em caixa.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
                                <th className="py-2 px-3">Atleta</th>
                                <th className="py-2 px-3">Posição</th>
                                <th className="py-2 px-3">Fase</th>
                                <th className="py-2 px-3">Clube de Origem</th>
                                <th className="py-2 px-3 text-right">Preço Base</th>
                                <th className="py-2 px-3 text-right">Valor Arrematado</th>
                                <th className="py-2 px-3 text-right">Disputa / Ágio</th>
                                {onAdminReleasePlayer && <th className="py-2 px-3 text-center">Ações</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {club.players.map((player) => {
                                const posBadge = getPositionBadge(player.position);
                                const phase = getPlayerAuctionPhase(player);
                                const finalAmount = player.soldTo?.amount || 0;
                                const diff = finalAmount - player.initialPrice;
                                const diffPercent = player.initialPrice > 0 ? (diff / player.initialPrice) * 100 : 0;

                                return (
                                  <tr key={player.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-3">
                                      <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                        {player.name}
                                      </div>
                                      <span className="text-[10px] text-slate-400">{player.nationality}</span>
                                    </td>

                                    <td className="py-2.5 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-black ${posBadge.bgClass} ${posBadge.textClass}`}>
                                        {player.position}
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-3">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        phase === 1 ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                        phase === 2 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                        'bg-rose-50 text-rose-800 border border-rose-200'
                                      }`}>
                                        Fase {phase}
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                                      {player.club}
                                    </td>

                                    <td className="py-2.5 px-3 text-right text-slate-500 font-semibold">
                                      {formatCurrency(player.initialPrice, true)}
                                    </td>

                                    <td className="py-2.5 px-3 text-right font-black text-slate-900 text-xs sm:text-sm">
                                      {formatCurrency(finalAmount)}
                                    </td>

                                    <td className="py-2.5 px-3 text-right">
                                      {diff > 0 ? (
                                        <span className="font-extrabold text-emerald-600 text-xs">
                                          +{formatCurrency(diff, true)} <span className="text-[10px] font-bold text-emerald-500">(+{diffPercent.toFixed(0)}%)</span>
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-slate-400 font-medium">
                                          Preço Base
                                        </span>
                                      )}
                                    </td>

                                    {onAdminReleasePlayer && (
                                      <td className="py-2.5 px-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handleRelease(player.id)}
                                          disabled={releasingPlayerId === player.id}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                          title="Anular contratação e devolver atleta ao mercado"
                                        >
                                          <RotateCcw className={`w-3.5 h-3.5 ${releasingPlayerId === player.id ? 'animate-spin text-rose-600' : ''}`} />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. VIEW MODE 2: TABELA GERAL & HISTÓRICO DE DESTINOS */}
      {reportViewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600" />
                  <span>Histórico Geral de Contratações ({filteredAndSortedList.length})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Visão cronológica e detalhada com filtros de busca, clube comprador e setor tático
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar jogador, time ou comprador..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  aria-label="Ordenar contratações por"
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="amount">Valor Arrematado</option>
                  <option value="agio">Maior Ágio / Disputa</option>
                  <option value="name">Nome do Jogador</option>
                  <option value="teamName">Clube Comprador</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
                  title={sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Filters Row */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Filtros:
              </span>

              {/* Filter by Destination Club */}
              <select
                value={selectedClubFilter}
                onChange={(e) => setSelectedClubFilter(e.target.value)}
                aria-label="Filtrar por Clube Comprador"
                className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">🏛️ Todos os Clubes Compradores</option>
                {users.map((u) => {
                  const userCount = allSoldPlayers.filter((p) => p.soldTo?.userId === u.id).length;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.teamName || u.name} ({userCount} {userCount === 1 ? 'jogador' : 'jogadores'})
                    </option>
                  );
                })}
              </select>

              {/* Filter by Position */}
              <select
                value={selectedPositionFilter}
                onChange={(e) => setSelectedPositionFilter(e.target.value)}
                aria-label="Filtrar por Posição"
                className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">⚽ Todas as Posições</option>
                <option value="GOL">Goleiros (GOL)</option>
                <option value="DEF">Defensores (ZAG, LE, LD)</option>
                <option value="MID">Meio-Campistas (VOL, MC, MEI)</option>
                <option value="ATK">Atacantes (ATA, PE, PD, SA)</option>
              </select>

              {/* Filter by Phase */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPhase('ALL')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedPhase === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas Fases
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPhase(1)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedPhase === 1
                      ? 'bg-blue-800 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Fase 1 (Defesa)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPhase(2)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedPhase === 2
                      ? 'bg-amber-800 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Fase 2 (Meio)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPhase(3)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedPhase === 3
                      ? 'bg-rose-800 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Fase 3 (Ataque)
                </button>
              </div>
            </div>
          </div>

          {filteredAndSortedList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-600">Nenhuma contratação encontrada</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {allSoldPlayers.length === 0 
                  ? 'Nenhum jogador foi arrematado no leilão até o momento. As contratações aparecerão automaticamente assim que o martelo for batido.'
                  : 'Nenhum resultado corresponde aos filtros selecionados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="py-2.5 px-3">Atleta</th>
                    <th className="py-2.5 px-3">Posição & Fase</th>
                    <th className="py-2.5 px-3">Clube de Origem</th>
                    <th className="py-2.5 px-3">Clube de Destino (Khedira League)</th>
                    <th className="py-2.5 px-3 text-right">Lance Inicial</th>
                    <th className="py-2.5 px-3 text-right">Valor Final Pago</th>
                    <th className="py-2.5 px-3 text-right">Disputa / Ágio</th>
                    {onAdminReleasePlayer && <th className="py-2.5 px-3 text-center">Ações ADM</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedList.map((player) => {
                    const posBadge = getPositionBadge(player.position);
                    const phase = getPlayerAuctionPhase(player);
                    const finalAmount = player.soldTo?.amount || 0;
                    const diff = finalAmount - player.initialPrice;
                    const diffPercent = player.initialPrice > 0 ? (diff / player.initialPrice) * 100 : 0;

                    return (
                      <tr key={player.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                            <span>{player.name}</span>
                            {player.isManualExtra && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                Extra
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">{player.nationality}</span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${posBadge.bgClass} ${posBadge.textClass}`}>
                              {player.position}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              phase === 1 ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                              phase === 2 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                              Fase {phase}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {player.club}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{player.soldTo?.teamName}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 pl-5">
                            <span>Presidente: {player.soldTo?.userName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-500 font-semibold">
                          {formatCurrency(player.initialPrice, true)}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-emerald-700 text-xs sm:text-sm">
                          {formatCurrency(finalAmount)}
                        </td>

                        <td className="py-3 px-3 text-right">
                          {diff > 0 ? (
                            <span className="font-extrabold text-emerald-600 text-xs">
                              +{formatCurrency(diff, true)} <span className="text-[10px] font-bold text-emerald-500">(+{diffPercent.toFixed(0)}%)</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Preço Base
                            </span>
                          )}
                        </td>

                        {onAdminReleasePlayer && (
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRelease(player.id)}
                              disabled={releasingPlayerId === player.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Anular contratação e devolver atleta ao mercado"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${releasingPlayerId === player.id ? 'animate-spin text-rose-600' : ''}`} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
