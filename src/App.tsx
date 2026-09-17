import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, Flame, LayoutGrid, Users, Shield, 
  RefreshCw, CheckCircle2, AlertCircle, Info, ExternalLink 
} from 'lucide-react';

import { LeagueState, UserProfile, WSMessage, Player, UserSquad } from './types';
import { INITIAL_FORMATIONS, INITIAL_PLAYERS } from './data/initialPlayers';
import { isCompatiblePosition, formatCurrency } from './utils/formatters';
import { apiUrl, getWebSocketUrl } from './utils/api';
import { Navbar } from './components/Navbar';
import { LiveAuctionSection } from './components/LiveAuctionSection';
import { SquadPlannerSection } from './components/SquadPlannerSection';
import { PlayerCatalogSection } from './components/PlayerCatalogSection';
import { AuthModal } from './components/AuthModal';
import { AuthScreen } from './components/AuthScreen';
import { AdminModal } from './components/AdminModal';
import { WatchlistModal } from './components/WatchlistModal';
import { NotificationFeed, LeagueNotification } from './components/NotificationFeed';
import { isSoundEnabled, toggleSound, playBidSound, playHammerSound } from './utils/sound';
import { getWatchlist, toggleWatchlistPlayer } from './utils/watchlist';

const AUTH_STORAGE_KEY = 'khedira_league_user_id';

export default function App() {
  const [leagueState, setLeagueState] = useState<LeagueState | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [guestMode, setGuestMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'auction' | 'squad' | 'catalog'>('auction');
  const [notifications, setNotifications] = useState<LeagueNotification[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'auction' | 'players' | 'users' | 'danger' | 'report'>('auction');
  const [soundActive, setSoundActive] = useState(isSoundEnabled());
  const [wsConnected, setWsConnected] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);

  // Watchlist state (persistent per user in localStorage)
  const [watchedPlayerIds, setWatchedPlayerIds] = useState<string[]>(() => {
    const savedUserId = typeof window !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
    return getWatchlist(savedUserId);
  });
  const watchedPlayerIdsRef = useRef<string[]>(watchedPlayerIds);
  watchedPlayerIdsRef.current = watchedPlayerIds;

  const currentUserRef = useRef<UserProfile | null>(currentUser);
  currentUserRef.current = currentUser;

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsFailuresRef = useRef<number>(0);

  const getFallbackInitialState = (): LeagueState => ({
    users: [
      {
        id: 'user-admin-default',
        email: 'guimarquesbrito@gmail.com',
        name: 'Guilherme Pereira',
        teamName: 'Pereira Galácticos FC',
        role: 'ADMIN',
        adminTitle: 'Diretor',
        budget: 300000000,
        spent: 0,
        createdAt: Date.now(),
      },
      {
        id: 'user-admin-tourinho',
        email: 'guilhermebtourinho@gmail.com',
        name: 'Guilherme Tourinho',
        teamName: 'Tourinho Galácticos FC',
        role: 'ADMIN',
        adminTitle: 'Presidente',
        budget: 300000000,
        spent: 0,
        createdAt: Date.now(),
      },
    ],
    players: INITIAL_PLAYERS.map((p) => ({ ...p, status: 'AVAILABLE' as const })),
    auction: {
      status: 'IDLE',
      currentPlayer: null,
      currentBid: null,
      bidHistory: [],
      timerRemaining: 86400,
      nominationTurnUserId: 'user-admin-default',
      nominationTimerRemaining: 30,
      isFreeNominationMode: false,
      minimumBidIncrement: 1000000,
      auctionDay: 'ALL',
      anonymousBidding: true,
      lastUpdated: Date.now(),
    },
    squads: {},
    defaultBudget: 300000000,
  });

  const handleOpenAdmin = (tab: 'auction' | 'players' | 'users' | 'danger' | 'report' = 'auction') => {
    setAdminInitialTab(tab);
    setIsAdminOpen(true);
  };

  const handleOpenAdminReport = () => {
    handleOpenAdmin('report');
  };

  // Push notification helper
  const addNotification = useCallback((message: string, type: 'info' | 'bid' | 'hammer' | 'alert' = 'info') => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNotif: LeagueNotification = { id, message, timestamp: Date.now(), type };
    setNotifications((prev) => [newNotif, ...prev]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  // Fetch full state from REST
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/state'));
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success && json.data) {
          setLeagueState(json.data);
          setBackendOffline(false);

          // Restore user from storage if needed
          const storedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
          if (storedUserId) {
            const matched = json.data.users.find((u: UserProfile) => u.id === storedUserId);
            if (matched) {
              setCurrentUser(matched);
            }
          }
          return;
        }
      }
      // If endpoint returned 404 (e.g. running statically on Vercel without backend server)
      setLeagueState((prev) => {
        if (!prev) {
          setBackendOffline(true);
          return getFallbackInitialState();
        }
        return prev;
      });
    } catch (err) {
      console.warn('Notice syncing league state:', err);
      setLeagueState((prev) => {
        if (!prev) {
          setBackendOffline(true);
          return getFallbackInitialState();
        }
        return prev;
      });
    }
  }, []);

  // Connect WebSocket for real-time synchronization
  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsUrl = getWebSocketUrl();

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setBackendOffline(false);
        wsFailuresRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'STATE_SYNC':
              setLeagueState(msg.data);
              // sync current user's budget & role if active
              setCurrentUser((prev) => {
                if (!prev) return null;
                const updated = msg.data.users.find((u) => u.id === prev.id);
                return updated || prev;
              });
              break;

            case 'NEW_BID':
              setLeagueState((prev) => (prev ? { ...prev, auction: msg.data.auction } : prev));
              playBidSound();
              if (msg.data.auction.currentPlayer && watchedPlayerIdsRef.current.includes(msg.data.auction.currentPlayer.id)) {
                const isMyBid = currentUserRef.current?.id === msg.data.auction.currentBid?.userId;
                if (!isMyBid && msg.data.auction.currentBid) {
                  addNotification(
                    `⭐ RADAR ALERTA: Novo lance de ${formatCurrency(msg.data.auction.currentBid.amount)} em ${msg.data.auction.currentPlayer.name}!`,
                    'urgent'
                  );
                }
              }
              break;

            case 'AUCTION_STARTED':
              setLeagueState((prev) => (prev ? { ...prev, auction: msg.data.auction } : prev));
              if (watchedPlayerIdsRef.current.includes(msg.data.player.id)) {
                addNotification(
                  `⭐ RADAR: ${msg.data.player.name} (${msg.data.player.position}) ENTROU EM LEILÃO AGORA!`,
                  'urgent'
                );
              } else {
                addNotification(
                  `📢 Leilão iniciado para ${msg.data.player.name} (${msg.data.player.position})!`,
                  'info'
                );
              }
              break;

            case 'AUCTION_HAMMER':
              playHammerSound();
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              });

              // Atualiza o jogador no catálogo local imediatamente
              setLeagueState((prev) => {
                if (!prev) return prev;
                const updatedPlayers = prev.players.map((p) =>
                  p.id === msg.data.player.id ? { ...p, status: 'SOLD' as const, soldTo: msg.data.player.soldTo } : p
                );
                // Adiciona aos reservas comprados do vencedor localmente
                const currentSquad = prev.squads[msg.data.winner.id] || {
                  userId: msg.data.winner.id,
                  formationId: '4-3-3',
                  starterSlots: {},
                  benchPlayerIds: []
                };
                const newBench = currentSquad.benchPlayerIds.includes(msg.data.player.id)
                  ? currentSquad.benchPlayerIds
                  : [...currentSquad.benchPlayerIds, msg.data.player.id];

                return {
                  ...prev,
                  players: updatedPlayers,
                  squads: {
                    ...prev.squads,
                    [msg.data.winner.id]: {
                      ...currentSquad,
                      benchPlayerIds: newBench
                    }
                  }
                };
              });

              setCurrentUser((prev) => {
                if (!prev) return null;
                if (prev.id === msg.data.winner.id) {
                  addNotification(
                    `🎉 PARABÉNS! Você arrematou ${msg.data.player.name}! Ele foi enviado diretamente para os seus Reservas Comprados no Campinho Tático.`,
                    'hammer'
                  );
                } else {
                  addNotification(
                    `🔨 VENDIDO! ${msg.data.player.name} arrematado por ${msg.data.winner.name} (${msg.data.winner.teamName})!`,
                    'hammer'
                  );
                }
                return prev;
              });
              break;

            case 'CHAT_NOTIFICATION':
              addNotification(msg.data.message, msg.data.type || 'info');
              break;
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsFailuresRef.current += 1;
        // Backoff if server unreachable to avoid flooding console on static hosts like Vercel
        const delay = wsFailuresRef.current > 3 ? 12000 : 3000;
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    }
  }, [addNotification]);

  // Initial mount
  useEffect(() => {
    fetchState();
    connectWebSocket();

    // Fallback polling every 4 seconds to guarantee sync
    const pollInterval = setInterval(fetchState, 4000);

    return () => {
      clearInterval(pollInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [fetchState, connectWebSocket]);

  // Keep watchedPlayerIds in sync when user logs in, out, or changes
  useEffect(() => {
    const currentList = getWatchlist(currentUser?.id);
    setWatchedPlayerIds(currentList);
  }, [currentUser?.id]);

  // Toggle watchlist player
  const handleToggleWatch = useCallback((playerId: string) => {
    const { isWatched, playerIds } = toggleWatchlistPlayer(currentUser?.id, playerId);
    setWatchedPlayerIds(playerIds);
    const player = leagueState?.players.find((p) => p.id === playerId);
    if (isWatched) {
      addNotification(
        `⭐ ${player ? player.name : 'Jogador'} adicionado ao seu Radar de Observação!`,
        'info'
      );
    } else {
      addNotification(
        `${player ? player.name : 'Jogador'} removido do Radar de Observação.`,
        'info'
      );
    }
  }, [currentUser?.id, leagueState?.players, addNotification]);

  // Toggle Sound
  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundActive(next);
  };

  // Auth: Login existing user
  const handleLogin = async (email: string, password?: string, authProvider?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, authProvider }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, data.user.id);
        addNotification(`Bem-vindo de volta à Khedira League, ${data.user.name}!`, 'info');
        await fetchState();
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao entrar na conta.' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Falha de conexão com o servidor.' };
    }
  };

  // Auth: Register brand new user account
  const handleRegister = async (
    email: string,
    name: string,
    teamName: string,
    password?: string,
    authProvider?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, teamName, password, authProvider }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, data.user.id);
        addNotification(`🎉 Bem-vindo à Khedira League, ${data.user.name}! Clube ${data.user.teamName} cadastrado com € 300M!`, 'success');
        await fetchState();
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao criar cadastro.' };
    } catch (err) {
      console.error('Register error:', err);
      return { success: false, error: 'Falha de conexão com o servidor.' };
    }
  };

  // Auth: Google / Gmail fast connect
  const handleGoogleAuth = async (
    email: string,
    name?: string,
    teamName?: string,
    avatarUrl?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(apiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, teamName, avatarUrl }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, data.user.id);
        addNotification(data.message || `Conectado com Gmail: ${data.user.name}!`, 'success');
        await fetchState();
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro na conexão com o Gmail.' };
    } catch (err) {
      console.error('Google auth error:', err);
      return { success: false, error: 'Falha de conexão com o servidor.' };
    }
  };

  // Auth: Password recovery / reset
  const handleResetPassword = async (
    email: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      const res = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification('Senha atualizada com sucesso! Você já pode entrar com sua nova senha.', 'success');
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Erro ao redefinir senha.' };
    } catch (err) {
      console.error('Reset password error:', err);
      return { success: false, error: 'Falha de conexão com o servidor.' };
    }
  };

  // Auth: Update profile info
  const handleUpdateProfile = async (
    name: string,
    teamName: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Usuário não autenticado.' };
    try {
      const res = await fetch(apiUrl('/api/auth/update-profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, name, teamName, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        addNotification('Perfil atualizado com sucesso!', 'success');
        await fetchState();
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao atualizar dados.' };
    } catch (err) {
      console.error('Update profile error:', err);
      return { success: false, error: 'Falha de conexão com o servidor.' };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    setGuestMode(false);
    setIsAuthOpen(false);
    addNotification('Você saiu da sua conta.', 'info');
  };

  // Auction: Place bid
  const handleBid = async (amount: number): Promise<boolean> => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return false;
    }

    try {
      const res = await fetch(apiUrl('/api/auction/bid'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, amount }),
      });
      const data = await res.json();
      if (data.success) {
        return true;
      } else {
        alert(data.error || 'Erro ao registrar lance');
        return false;
      }
    } catch (err) {
      console.error('Bid error:', err);
      return false;
    }
  };

  // Auction: Nominate player
  const handleNominate = async (playerId: string): Promise<boolean> => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return false;
    }

    try {
      const res = await fetch(apiUrl('/api/auction/nominate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, playerId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTab('auction'); // jump to live auction tab!
        if (data.queued) {
          addNotification(`📋 ${data.message || 'Jogador adicionado à fila de interesse!'}`, 'success');
        } else {
          addNotification('📢 Jogador postado no leilão! Propostas abertas por 24 horas.', 'success');
        }
        await fetchState();
        return true;
      } else {
        alert(data.error || 'Erro ao postar jogador');
        return false;
      }
    } catch (err) {
      console.error('Nominate error:', err);
      return false;
    }
  };

  // Auction: Remove from Queue
  const handleRemoveFromQueue = async (playerId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/auction/queue/remove'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, playerId }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification('Jogador removido da fila de interesse.', 'info');
        await fetchState();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Remove from queue error:', err);
      return false;
    }
  };

  // Auction: Start from Queue (Admin)
  const handleStartFromQueue = async (playerId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'ADMIN') return false;
    try {
      const res = await fetch(apiUrl('/api/auction/queue/start-now'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, playerId }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification('Jogador da fila iniciado imediatamente!', 'success');
        await fetchState();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Start from queue error:', err);
      return false;
    }
  };

  // Auction: Pass turn
  const handlePassTurn = async (): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/auction/pass-turn'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
        addNotification(data.message || 'Vez de anunciar passada com sucesso!', 'info');
        return true;
      } else {
        alert(data.error || 'Não foi possível passar a vez.');
        return false;
      }
    } catch (err) {
      console.error('Pass turn error:', err);
      return false;
    }
  };

  // Squad: Save Squad
  const handleSaveSquad = async (
    formationId: string,
    starterSlots: { [slotId: string]: string | null },
    benchPlayerIds: string[]
  ) => {
    if (!currentUser) return;
    try {
      await fetch(apiUrl('/api/squad/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          formationId,
          starterSlots,
          benchPlayerIds,
        }),
      });
    } catch (err) {
      console.error('Save squad error:', err);
    }
  };

  // Preview Squad: Add player to draft/preview squad and navigate to tactical planner
  const handleViewPreview = async (player: Player) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      addNotification('Faça login para salvar e montar seu elenco prévia!', 'info');
      return;
    }

    const currentSquad: UserSquad = leagueState?.squads?.[currentUser.id] || {
      userId: currentUser.id,
      formationId: '4-3-3',
      starterSlots: {},
      benchPlayerIds: [],
    };

    const formationId = currentSquad.formationId || '4-3-3';
    const formation = INITIAL_FORMATIONS.find((f) => f.id === formationId) || INITIAL_FORMATIONS[0];
    const newStarterSlots = { ...(currentSquad.starterSlots || {}) };
    const newBench = [...(currentSquad.benchPlayerIds || [])];

    const isStarter = Object.values(newStarterSlots).includes(player.id);
    const isBench = newBench.includes(player.id);

    if (isStarter || isBench) {
      addNotification(`👀 ${player.name} já está no seu elenco prévia!`, 'info');
      setActiveTab('squad');
      return;
    }

    // Try to find a vacant starter slot compatible with player's position
    let targetSlot = formation.slots.find(
      (slot) => slot.role === player.position && !newStarterSlots[slot.slotId]
    );

    if (!targetSlot) {
      targetSlot = formation.slots.find(
        (slot) => isCompatiblePosition(slot.role, player.position) && !newStarterSlots[slot.slotId]
      );
    }

    if (targetSlot) {
      newStarterSlots[targetSlot.slotId] = player.id;
      addNotification(`✨ ${player.name} escalado como ${targetSlot.role} no seu elenco prévia!`, 'info');
    } else {
      newBench.push(player.id);
      addNotification(`✨ ${player.name} adicionado ao banco do seu elenco prévia!`, 'info');
    }

    // Immediately update local state for snappy UI
    setLeagueState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        squads: {
          ...prev.squads,
          [currentUser.id]: {
            userId: currentUser.id,
            formationId,
            starterSlots: newStarterSlots,
            benchPlayerIds: newBench,
          },
        },
      };
    });

    // Save to server
    await handleSaveSquad(formationId, newStarterSlots, newBench);

    // Navigate to squad planner smoothly
    setActiveTab('squad');
  };

  // Admin Actions
  const handleAdminAuctionAction = async (action: string, value?: unknown) => {
    if (!currentUser) return;
    try {
      await fetch(apiUrl('/api/admin/auction/action'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ action, value }),
      });
    } catch (err) {
      console.error('Admin auction action error:', err);
    }
  };

  const handleAdminCreatePlayer = async (playerData: {
    name: string;
    position: string;
    club: string;
    nationality: string;
    initialPrice: number;
  }): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/player/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify(playerData),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin create player error:', err);
      return false;
    }
  };

  const handleAdminUpdatePrice = async (playerId: string, initialPrice: number): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/player/update-price'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ playerId, initialPrice }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin update price error:', err);
      return false;
    }
  };

  const handleAdminDeletePlayer = async (playerId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/player/delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin delete player error:', err);
      return false;
    }
  };

  const handleAdminReleasePlayer = async (playerId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/player/release-to-market'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification('Jogador liberado com sucesso e retornado ao mercado!', 'info');
        await fetchState();
      }
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin release player error:', err);
      return false;
    }
  };

  const handleAdminUpdateUserRole = async (targetUserId: string, role: 'ADMIN' | 'PARTICIPANT'): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/user/role'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ targetUserId, role }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin update role error:', err);
      return false;
    }
  };

  const handleAdminUpdateUserBudget = async (targetUserId: string, budget: number): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/user/budget'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ targetUserId, budget }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin update budget error:', err);
      return false;
    }
  };

  const handleAdminResetUser = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/user/reset'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error('Admin reset user error:', err);
      return false;
    }
  };

  const handleAdminResetLeague = async (): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const res = await fetch(apiUrl('/api/admin/reset-league'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
      });
      const data = await res.json();
      if (data.success) {
        addNotification(data.message || 'Reset de mercado executado! Todos os jogadores retornaram ao mercado e o saldo integral foi devolvido aos clubes.', 'alert');
        await fetchState();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Reset league error:', err);
      return false;
    }
  };

  if (!leagueState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg animate-pulse">
            <Trophy className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 font-['Outfit',sans-serif]">
            KHEDIRA LEAGUE EAFC 27
          </h2>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            Conectando ao sistema de leilão em tempo real...
          </p>
        </div>
      </div>
    );
  }

  // Tela de Autenticação de Usuário exibida antes das telas do site
  if (!currentUser && !guestMode) {
    return (
      <div className="min-h-screen bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
        {backendOffline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-30 shadow-sm border-b border-amber-600 text-center">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>
              <strong>Atenção:</strong> Servidor backend em tempo real não detectado nesta URL. Para leilão e login funcionarem em produção, hospede no <strong>Render</strong> ou <strong>Railway</strong> (Node.js completo) ou configure <code className="bg-amber-400 px-1 py-0.5 rounded font-mono">VITE_BACKEND_URL</code>.
            </span>
          </div>
        )}
        <AuthScreen
          auction={leagueState.auction}
          playersCount={leagueState.players?.length || 125}
          usersCount={leagueState.users?.length || 2}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onGoogleAuth={handleGoogleAuth}
          onResetPassword={handleResetPassword}
          onContinueAsGuest={() => setGuestMode(true)}
        />
        <NotificationFeed notifications={notifications} />
      </div>
    );
  }

  const userSquad = currentUser && leagueState.squads ? leagueState.squads[currentUser.id] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Backend Server Offline Notice Banner */}
      {backendOffline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between z-30 shadow-sm border-b border-amber-600">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>
              <strong>Atenção:</strong> Servidor backend em tempo real não detectado nesta URL. Para o leilão ao vivo funcionar, hospede a aplicação no <strong>Render</strong> ou <strong>Railway</strong> (Node.js completo), ou aponte a variável <code className="bg-amber-400 px-1 py-0.5 rounded font-mono">VITE_BACKEND_URL</code>.
            </span>
          </div>
        </div>
      )}

      {/* Guest Mode Indicator Banner */}
      {guestMode && !currentUser && (
        <div className="bg-slate-900 text-slate-200 border-b border-slate-800 px-4 py-2 text-xs flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Você está no <strong>Modo Visitante (Apenas Visualização)</strong>. Para disputar os lances ao vivo e gerenciar seu elenco, crie ou acesse sua conta.</span>
          </div>
          <button
            onClick={() => setGuestMode(false)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-[11px] shrink-0 ml-2"
          >
            Fazer Login / Cadastrar
          </button>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        auction={leagueState.auction}
        watchedCount={watchedPlayerIds.length}
        onOpenWatchlist={() => setIsWatchlistOpen(true)}
        onOpenAuth={() => {
          if (!currentUser) {
            setGuestMode(false);
          } else {
            setIsAuthOpen(true);
          }
        }}
        onLogout={handleLogout}
        onOpenAdmin={() => handleOpenAdmin('auction')}
        onOpenAdminReport={handleOpenAdminReport}
        soundActive={soundActive}
        onToggleSound={handleToggleSound}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'auction' && (
          <LiveAuctionSection
            auction={leagueState.auction}
            currentUser={currentUser}
            players={leagueState.players}
            users={leagueState.users}
            watchedPlayerIds={watchedPlayerIds}
            onToggleWatch={handleToggleWatch}
            onOpenWatchlist={() => setIsWatchlistOpen(true)}
            onBid={handleBid}
            onNominate={handleNominate}
            onRemoveFromQueue={handleRemoveFromQueue}
            onStartFromQueue={handleStartFromQueue}
            onPassTurn={handlePassTurn}
            onOpenAuth={() => {
              if (!currentUser) {
                setGuestMode(false);
              } else {
                setIsAuthOpen(true);
              }
            }}
            onOpenAdmin={() => handleOpenAdmin('auction')}
            onOpenAdminReport={handleOpenAdminReport}
            onAdminAuctionAction={handleAdminAuctionAction}
          />
        )}

        {activeTab === 'squad' && (
          <SquadPlannerSection
            currentUser={currentUser}
            players={leagueState.players}
            userSquad={userSquad}
            onSaveSquad={handleSaveSquad}
            onOpenAuth={() => {
              if (!currentUser) {
                setGuestMode(false);
              } else {
                setIsAuthOpen(true);
              }
            }}
          />
        )}

        {activeTab === 'catalog' && (
          <PlayerCatalogSection
            players={leagueState.players}
            currentUser={currentUser}
            userSquad={userSquad}
            auction={leagueState.auction}
            watchedPlayerIds={watchedPlayerIds}
            onToggleWatch={handleToggleWatch}
            onOpenWatchlist={() => setIsWatchlistOpen(true)}
            onNominate={handleNominate}
            onViewPreview={handleViewPreview}
            onOpenAuth={() => {
              if (!currentUser) {
                setGuestMode(false);
              } else {
                setIsAuthOpen(true);
              }
            }}
            onOpenAdmin={() => handleOpenAdmin('auction')}
            onNavigateToSquad={() => setActiveTab('squad')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800 font-['Outfit',sans-serif]">
              KHEDIRA LEAGUE
            </span>
          </div>
        </div>
      </footer>

      {/* Modals & Live Notification Feed */}
      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        watchedPlayerIds={watchedPlayerIds}
        players={leagueState.players}
        auction={leagueState.auction}
        currentUser={currentUser}
        onToggleWatch={handleToggleWatch}
        onNominate={handleNominate}
        onNavigateToAuction={() => {
          setIsWatchlistOpen(false);
          setActiveTab('auction');
        }}
        onNavigateToCatalog={() => {
          setIsWatchlistOpen(false);
          setActiveTab('catalog');
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onGoogleAuth={handleGoogleAuth}
        onResetPassword={handleResetPassword}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentUser={currentUser}
        auction={leagueState.auction}
        players={leagueState.players}
        users={leagueState.users}
        initialTab={adminInitialTab}
        onAdminAuctionAction={handleAdminAuctionAction}
        onAdminCreatePlayer={handleAdminCreatePlayer}
        onAdminUpdatePrice={handleAdminUpdatePrice}
        onAdminDeletePlayer={handleAdminDeletePlayer}
        onAdminReleasePlayer={handleAdminReleasePlayer}
        onAdminUpdateUserRole={handleAdminUpdateUserRole}
        onAdminUpdateUserBudget={handleAdminUpdateUserBudget}
        onAdminResetUser={handleAdminResetUser}
        onAdminResetLeague={handleAdminResetLeague}
      />

      <NotificationFeed
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
      />
    </div>
  );
}
