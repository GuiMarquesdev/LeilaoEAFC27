import React from 'react';
import { Volume2, VolumeX, Shield, ShieldCheck, User, Users, Flame, LayoutGrid, FileText, UserPlus, LogOut, Star } from 'lucide-react';
import { UserProfile, AuctionState } from '../types';
import { getUserRoleBadge } from '../utils/formatters';

interface NavbarProps {
  activeTab: 'auction' | 'squad' | 'catalog';
  setActiveTab: (tab: 'auction' | 'squad' | 'catalog') => void;
  currentUser: UserProfile | null;
  auction: AuctionState;
  watchedCount?: number;
  onOpenWatchlist?: () => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
  onOpenAdmin: () => void;
  onOpenAdminReport?: () => void;
  soundActive: boolean;
  onToggleSound: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  auction,
  watchedCount = 0,
  onOpenWatchlist,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenAdminReport,
  soundActive,
  onToggleSound,
}) => {
  const isAuctionLive = auction.status === 'ACTIVE';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-['Outfit',sans-serif] font-extrabold text-lg tracking-tight text-slate-900">
                KHEDIRA LEAGUE
              </span>
            </div>
          </div>

          {/* Navigation Tabs (3 Sections) */}
          <nav className="hidden md:flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              id="tab-nav-auction"
              onClick={() => setActiveTab('auction')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'auction'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className={`w-4 h-4 ${isAuctionLive ? 'text-amber-500 animate-pulse' : ''}`} />
              <span>1. Leilão ao Vivo</span>
              {isAuctionLive && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </button>

            <button
              id="tab-nav-squad"
              onClick={() => setActiveTab('squad')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'squad'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-600" />
              <span>2. Prévia & Meu Time</span>
            </button>

            <button
              id="tab-nav-catalog"
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>3. Todos os Jogadores</span>
            </button>
          </nav>

          {/* Actions & User Profile */}
          <div className="flex items-center gap-2.5">
            {/* Sound Toggle */}
            <button
              id="btn-toggle-sound"
              onClick={onToggleSound}
              title={soundActive ? 'Desativar Sons' : 'Ativar Sons'}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Watchlist / Radar Button */}
            {onOpenWatchlist && (
              <button
                id="btn-navbar-watchlist"
                onClick={onOpenWatchlist}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Abrir Radar de Observação: Acompanhe seus atletas favoritos das 3 fases"
              >
                <Star className={`w-3.5 h-3.5 ${watchedCount > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Radar</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  watchedCount > 0 ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  {watchedCount}
                </span>
              </button>
            )}

            {/* Admin Report Button - Exclusivo ADMs */}
            {currentUser?.role === 'ADMIN' && onOpenAdminReport && (
              <button
                id="btn-open-admin-report"
                onClick={onOpenAdminReport}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                title="Relatório Oficial de Contratações por Fase do Leilão"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Relatório de Fases</span>
              </button>
            )}

            {/* Admin Panel Button */}
            {currentUser?.role === 'ADMIN' && (
              <button
                id="btn-open-admin-panel"
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">
                  Painel {getUserRoleBadge(currentUser).title}
                </span>
              </button>
            )}

            {/* User Profile Pill */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <button
                  id="btn-user-profile"
                  onClick={onOpenAuth}
                  className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg text-left transition-colors group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-700 font-bold flex items-center justify-center text-xs border border-emerald-200">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        {currentUser.name || currentUser.teamName}
                      </span>
                      {currentUser.role === 'ADMIN' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${getUserRoleBadge(currentUser).badgeClass}`}>
                          {getUserRoleBadge(currentUser).badgeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {onLogout && (
                  <button
                    id="btn-navbar-logout"
                    onClick={onLogout}
                    title="Sair da Conta (Ir para a Tela de Autenticação)"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-register-trigger"
                  onClick={onOpenAuth}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Criar Conta</span>
                </button>
                <button
                  id="btn-login-trigger"
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Entrar / Gmail</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('auction')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
              activeTab === 'auction' ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>1. Leilão</span>
          </button>
          <button
            onClick={() => setActiveTab('squad')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
              activeTab === 'squad' ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Time</span>
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
              activeTab === 'catalog' ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>3. Jogadores</span>
          </button>
        </div>
      </div>
    </header>
  );
};
