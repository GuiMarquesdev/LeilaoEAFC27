import React from 'react';
import { Flame, Gavel, Bell, AlertTriangle } from 'lucide-react';

export interface LeagueNotification {
  id: string;
  message: string;
  timestamp: number;
  type: 'info' | 'bid' | 'hammer' | 'alert';
}

interface NotificationFeedProps {
  notifications: LeagueNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationFeed: React.FC<NotificationFeedProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.slice(0, 3).map((n) => {
        return (
          <div
            key={n.id}
            onClick={() => onDismiss(n.id)}
            className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border flex items-start gap-3 text-xs transition-all animate-in slide-in-from-bottom-3 duration-200 cursor-pointer ${
              n.type === 'hammer'
                ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
                : n.type === 'bid'
                  ? 'bg-slate-900 text-white border-slate-800'
                  : n.type === 'alert'
                    ? 'bg-rose-500 text-white border-rose-600'
                    : 'bg-white text-slate-900 border-slate-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {n.type === 'hammer' && <Gavel className="w-4 h-4 text-white" />}
              {n.type === 'bid' && <Flame className="w-4 h-4 text-amber-400" />}
              {n.type === 'alert' && <AlertTriangle className="w-4 h-4 text-white" />}
              {n.type === 'info' && <Bell className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className="flex-1 font-medium leading-snug">
              {n.message}
            </div>
          </div>
        );
      })}
    </div>
  );
};
