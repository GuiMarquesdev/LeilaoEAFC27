import React from 'react';
import { X, Shield, FileText } from 'lucide-react';
import { Player, UserProfile } from '../types';
import { AdminSigningsReportSection } from './AdminSigningsReportSection';

interface AdminSigningsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  players: Player[];
  users: UserProfile[];
  onAdminReleasePlayer?: (playerId: string) => Promise<boolean>;
}

export const AdminSigningsReportModal: React.FC<AdminSigningsReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  players,
  users,
  onAdminReleasePlayer,
}) => {
  if (!isOpen) return null;

  // Strict check: Only ADM can view
  if (currentUser?.role !== 'ADMIN') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  Relatório Oficial de Contratações por Fase
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Exclusivo ADM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoria de atletas arrematados, valores por fase e balanço financeiro dos clubes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar Relatório"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          <AdminSigningsReportSection
            currentUser={currentUser}
            players={players}
            users={users}
            onAdminReleasePlayer={onAdminReleasePlayer}
          />
        </div>
      </div>
    </div>
  );
};
