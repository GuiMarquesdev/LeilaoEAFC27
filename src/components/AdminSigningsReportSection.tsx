import React, { useState, useMemo } from 'react';
import { 
  FileText, TrendingUp, Trophy, Users, DollarSign, 
  Search, Copy, Check, Printer, ArrowUpDown, Filter, 
  ShieldAlert, ShieldCheck, Calendar, Flame, Sparkles, 
  RotateCcw, ChevronRight, Download, BarChart3
} from 'lucide-react';
import { Player, UserProfile } from '../types';
import { formatCurrency, getPositionBadge, getPlayerAuctionPhase, getDayLabel, getUserRoleBadge } from '../utils/formatters';

interface AdminSigningsReportSectionProps {
  currentUser: UserProfile | null;
  players: Player[];
  users: UserProfile[];
  onAdminReleasePlayer?: (playerId: string) => Promise<boolean>;
}

export const AdminSigningsReportSection: React.FC<AdminSigningsReportSectionProps> = ({
  currentUser,
  players,
  users,
  onAdminReleasePlayer,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<'ALL' | 1 | 2 | 3>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'amount' | 'name' | 'agio' | 'club'>('amount');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [releasingPlayerId, setReleasingPlayerId] = useState<string | null>(null);

  // Security Verification: Only ADMs can view this report
  const isAdmin = currentUser?.role === 'ADMIN';

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

  // Filter & sort
  const filteredAndSortedList = useMemo(() => {
    return currentPhaseSold
      .filter((player) => {
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
        } else if (sortField === 'club') {
          comp = a.club.localeCompare(b.club);
        } else if (sortField === 'agio') {
          const agioA = (a.soldTo?.amount || 0) - a.initialPrice;
          const agioB = (b.soldTo?.amount || 0) - b.initialPrice;
          comp = agioA - agioB;
        }
        return sortOrder === 'desc' ? -comp : comp;
      });
  }, [currentPhaseSold, searchQuery, sortField, sortOrder]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const count = currentPhaseSold.length;
    const totalSpent = currentPhaseSold.reduce((sum, p) => sum + (p.soldTo?.amount || 0), 0);
    const totalInitial = currentPhaseSold.reduce((sum, p) => sum + p.initialPrice, 0);
    const avgPrice = count > 0 ? totalSpent / count : 0;
    const totalAgio = totalSpent - totalInitial;
    const agioPercent = totalInitial > 0 ? (totalAgio / totalInitial) * 100 : 0;

    // Highest signing
    let topSigning: Player | null = null;
    let maxAmount = -1;
    for (const p of currentPhaseSold) {
      if (p.soldTo && p.soldTo.amount > maxAmount) {
        maxAmount = p.soldTo.amount;
        topSigning = p;
      }
    }

    return {
      count,
      totalSpent,
      avgPrice,
      totalAgio,
      agioPercent,
      topSigning,
    };
  }, [currentPhaseSold]);

  // Spending by Team in the selected phase
  const teamRankings = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      userName: string;
      teamName: string;
      count: number;
      totalSpent: number;
      players: Player[];
    }>();

    // Initialize with all users so even those with 0 show up or only active buyers
    users.forEach((u) => {
      map.set(u.id, {
        userId: u.id,
        userName: u.name,
        teamName: u.teamName,
        count: 0,
        totalSpent: 0,
        players: []
      });
    });

    currentPhaseSold.forEach((p) => {
      if (!p.soldTo) return;
      const entry = map.get(p.soldTo.userId);
      if (entry) {
        entry.count += 1;
        entry.totalSpent += p.soldTo.amount;
        entry.players.push(p);
      } else {
        map.set(p.soldTo.userId, {
          userId: p.soldTo.userId,
          userName: p.soldTo.userName,
          teamName: p.soldTo.teamName,
          count: 1,
          totalSpent: p.soldTo.amount,
          players: [p]
        });
      }
    });

    return Array.from(map.values())
      .filter((t) => t.count > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [currentPhaseSold, users]);

  // Copy full structured WhatsApp/Clipboard Report
  const handleCopyReport = () => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const adminLabel = currentUser 
      ? `${currentUser.name} (${getUserRoleBadge(currentUser).title})`
      : 'Diretoria Oficial';

    let text = `📋 *KHEDIRA LEAGUE 2026/27 — RELATÓRIO OFICIAL DE CONTRATAÇÕES*\n`;
    text += `👑 *Emitido por:* ${adminLabel}\n`;
    text += `📅 *Gerado em:* ${timestamp}\n`;
    text += `🔒 *Acesso Exclusivo à Diretoria e Administração*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📊 *RESUMO GERAL CONSOLIDADO*\n`;
    text += `• Total de Contratações: *${allSoldPlayers.length} atletas*\n`;
    const grandTotal = allSoldPlayers.reduce((acc, p) => acc + (p.soldTo?.amount || 0), 0);
    text += `• Montante Total Movimentado: *${formatCurrency(grandTotal)}*\n`;
    text += `• Média por Jogador: *${formatCurrency(allSoldPlayers.length ? grandTotal / allSoldPlayers.length : 0)}*\n\n`;

    // Phase 1 Breakdown
    const p1Total = phase1Sold.reduce((acc, p) => acc + (p.soldTo?.amount || 0), 0);
    text += `🛡️ *FASE 1: SISTEMA DEFENSIVO (GOL, ZAG, LE, LD)*\n`;
    text += `• Atletas arrematados: *${phase1Sold.length}* | Total: *${formatCurrency(p1Total)}*\n`;
    if (phase1Sold.length === 0) {
      text += `  _Nenhum atleta arrematado nesta fase ainda._\n`;
    } else {
      phase1Sold.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.name}* (${p.position} - ${p.club}) ➔ *${p.soldTo?.teamName}* por *${formatCurrency(p.soldTo?.amount || 0)}*\n`;
      });
    }
    text += `\n`;

    // Phase 2 Breakdown
    const p2Total = phase2Sold.reduce((acc, p) => acc + (p.soldTo?.amount || 0), 0);
    text += `🎯 *FASE 2: MEIO-CAMPO (VOL, MC, MEI)*\n`;
    text += `• Atletas arrematados: *${phase2Sold.length}* | Total: *${formatCurrency(p2Total)}*\n`;
    if (phase2Sold.length === 0) {
      text += `  _Nenhum atleta arrematado nesta fase ainda._\n`;
    } else {
      phase2Sold.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.name}* (${p.position} - ${p.club}) ➔ *${p.soldTo?.teamName}* por *${formatCurrency(p.soldTo?.amount || 0)}*\n`;
      });
    }
    text += `\n`;

    // Phase 3 Breakdown
    const p3Total = phase3Sold.reduce((acc, p) => acc + (p.soldTo?.amount || 0), 0);
    text += `⚡ *FASE 3: SETOR OFENSIVO (ATA, PD, PE, MD, ME, SA)*\n`;
    text += `• Atletas arrematados: *${phase3Sold.length}* | Total: *${formatCurrency(p3Total)}*\n`;
    if (phase3Sold.length === 0) {
      text += `  _Nenhum atleta arrematado nesta fase ainda._\n`;
    } else {
      phase3Sold.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.name}* (${p.position} - ${p.club}) ➔ *${p.soldTo?.teamName}* por *${formatCurrency(p.soldTo?.amount || 0)}*\n`;
      });
    }
    text += `\n`;

    // Ranking de Gastos
    text += `🏆 *INVESTIMENTO TOTAL POR CLUBE*\n`;
    const sortedUsers = [...users].sort((a, b) => (b.spent || 0) - (a.spent || 0));
    sortedUsers.forEach((u, i) => {
      const userPurchases = allSoldPlayers.filter((p) => p.soldTo?.userId === u.id).length;
      text += `  ${i + 1}. *${u.teamName}* (${u.name}): ${formatCurrency(u.spent || 0)} (${userPurchases} contratações)\n`;
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
            Este relatório com o balanço de contratações por fase é de visualização exclusiva dos Diretores e Administradores da Khedira League.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-5 rounded-2xl text-white shadow-md border border-slate-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3 h-3" />
                Exclusivo para Administradores
              </span>
              <span className="text-xs text-amber-300 font-bold">
                {currentUser?.adminTitle ? `👑 ${currentUser.adminTitle}` : '👑 Painel da Diretoria'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Relatório de Contratações por Fase do Leilão
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Consulte todas as contratações consolidadas e segregadas rigorosamente pelas 3 fases oficiais do regulamento (Defesa, Meio-campo e Ataque), incluindo valores arrematados, ágios e rankings de clubes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Copiar relatório formatado para WhatsApp ou Bloco de Notas"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-4 h-4 text-emerald-950" />
                  <span>Relatório Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Relatório Formatado</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Phase Selector Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* ALL */}
        <button
          type="button"
          onClick={() => setSelectedPhase('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedPhase === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500/50'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
              selectedPhase === 'ALL' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-600'
            }`}>
              GERAL
            </span>
            <span className="text-xs font-bold">{allSoldPlayers.length} atletas</span>
          </div>
          <h4 className="text-xs sm:text-sm font-extrabold">Todas as Fases</h4>
          <span className={`text-[11px] block mt-0.5 ${selectedPhase === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
            Balanço consolidado da liga
          </span>
        </button>

        {/* FASE 1: DEFESA */}
        <button
          type="button"
          onClick={() => setSelectedPhase(1)}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedPhase === 1
              ? 'bg-blue-900 text-white border-blue-900 shadow-md ring-2 ring-blue-400/50'
              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
              selectedPhase === 1 ? 'bg-blue-300 text-blue-950' : 'bg-blue-50 text-blue-700'
            }`}>
              FASE 1 • DEFESA
            </span>
            <span className="text-xs font-bold">{phase1Sold.length} atletas</span>
          </div>
          <h4 className="text-xs sm:text-sm font-extrabold">Sistema Defensivo</h4>
          <span className={`text-[11px] block mt-0.5 ${selectedPhase === 1 ? 'text-blue-200' : 'text-slate-500'}`}>
            GOL, ZAG, LE, LD
          </span>
        </button>

        {/* FASE 2: MEIO-CAMPO */}
        <button
          type="button"
          onClick={() => setSelectedPhase(2)}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedPhase === 2
              ? 'bg-amber-900 text-white border-amber-900 shadow-md ring-2 ring-amber-400/50'
              : 'bg-white text-slate-800 border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
              selectedPhase === 2 ? 'bg-amber-300 text-amber-950' : 'bg-amber-50 text-amber-700'
            }`}>
              FASE 2 • MEIO
            </span>
            <span className="text-xs font-bold">{phase2Sold.length} atletas</span>
          </div>
          <h4 className="text-xs sm:text-sm font-extrabold">Meio-Campo & Criação</h4>
          <span className={`text-[11px] block mt-0.5 ${selectedPhase === 2 ? 'text-amber-200' : 'text-slate-500'}`}>
            VOL, MC, MEI
          </span>
        </button>

        {/* FASE 3: SETOR OFENSIVO */}
        <button
          type="button"
          onClick={() => setSelectedPhase(3)}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedPhase === 3
              ? 'bg-rose-900 text-white border-rose-900 shadow-md ring-2 ring-rose-400/50'
              : 'bg-white text-slate-800 border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
              selectedPhase === 3 ? 'bg-rose-300 text-rose-950' : 'bg-rose-50 text-rose-700'
            }`}>
              FASE 3 • ATAQUE
            </span>
            <span className="text-xs font-bold">{phase3Sold.length} atletas</span>
          </div>
          <h4 className="text-xs sm:text-sm font-extrabold">Setor Ofensivo</h4>
          <span className={`text-[11px] block mt-0.5 ${selectedPhase === 3 ? 'text-rose-200' : 'text-slate-500'}`}>
            ATA, PE, PD, ME, MD, SA
          </span>
        </button>
      </div>

      {/* 3. Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Total Arrematado</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {metrics.count} <span className="text-xs font-semibold text-slate-500">jogadores</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            {selectedPhase === 'ALL' ? 'Em todas as fases somadas' : `Exclusivo de ${getDayLabel(selectedPhase).title}`}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Investimento Total</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600">
            {formatCurrency(metrics.totalSpent, true)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            {formatCurrency(metrics.totalSpent)}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Média por Contratação</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-700">
            {formatCurrency(metrics.avgPrice, true)}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Ágio total: +{formatCurrency(metrics.totalAgio, true)} ({metrics.agioPercent.toFixed(1)}%)
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1 text-slate-500">
            <span className="text-xs font-bold">Maior Negociação</span>
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
              Nenhuma negociação concluída
            </div>
          )}
        </div>
      </div>

      {/* 4. Club Investment Rankings in This Phase */}
      {teamRankings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Distribuição de Gastos por Clube {selectedPhase !== 'ALL' && `— ${getDayLabel(selectedPhase).title}`}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {teamRankings.length} clubes ativos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {teamRankings.map((team, idx) => {
              const maxTeamSpent = teamRankings[0]?.totalSpent || 1;
              const percentOfTop = Math.min(100, Math.round((team.totalSpent / maxTeamSpent) * 100));

              return (
                <div key={team.userId} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate block">
                          {team.teamName}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {team.userName}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 block">
                        {formatCurrency(team.totalSpent, true)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {team.count} {team.count === 1 ? 'reforço' : 'reforços'}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${idx === 0 ? 'bg-amber-500' : 'bg-emerald-600'}`} 
                      style={{ width: `${percentOfTop}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Detailed Signings List with Search & Sort */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Lista Detalhada de Contratações ({filteredAndSortedList.length})
            </h3>
            <p className="text-xs text-slate-500">
              Todos os jogadores arrematados, comprador, lance inicial e valor final do martelo
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar jogador, time, clube..."
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
              <option value="club">Clube Real</option>
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

        {filteredAndSortedList.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-600">Nenhuma contratação encontrada</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              {currentPhaseSold.length === 0 
                ? 'Nenhum jogador foi arrematado nesta fase até o momento. As contratações aparecerão automaticamente assim que o martelo for batido no leilão ao vivo.'
                : 'Nenhum resultado corresponde à busca digitada.'}
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
                  <th className="py-2.5 px-3">Comprador na Liga</th>
                  <th className="py-2.5 px-3 text-right">Lance Inicial</th>
                  <th className="py-2.5 px-3 text-right">Preço Final</th>
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
                        <div className="font-bold text-slate-900 text-xs">
                          {player.soldTo?.teamName}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span>{player.soldTo?.userName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right text-slate-500 font-semibold">
                        {formatCurrency(player.initialPrice, true)}
                      </td>

                      <td className="py-3 px-3 text-right font-black text-slate-900 text-xs sm:text-sm">
                        {formatCurrency(finalAmount)}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {diff > 0 ? (
                          <span className="font-extrabold text-emerald-600 text-xs">
                            +{formatCurrency(diff, true)} <span className="text-[10px] font-bold text-emerald-500">(+{diffPercent.toFixed(0)}%)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Sem disputa (Preço Base)
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
    </div>
  );
};
