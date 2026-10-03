import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { INITIAL_PLAYERS, INITIAL_FORMATIONS } from '../data/initialPlayers';
import { LeagueState, Player, PlayerPosition, UserProfile, Bid, UserSquad, WSMessage, AuctionType, AuctionPhase } from '../types';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  sanitizeUser,
  sanitizeLeagueState,
  sanitizeBid,
  validateEmail,
  validatePassword,
  validateString,
  validatePositiveInteger,
  validatePosition,
  checkRLSOwnership,
  validateUploadBuffer,
  SessionPayload
} from './security';
import {
  isFirebaseReady,
  loadStateFromFirestore,
  syncUserToFirestore,
  syncSquadToFirestore,
  syncWatchlistToFirestore,
  loadWatchlistFromFirestore,
  syncLeagueMasterToFirestore,
  syncAllStateToFirestore
} from './firebaseService';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'league_db.json');
const DEFAULT_BUDGET = 400000000; // €400.000.000 (400 Milhões de Euros fixos e inegociáveis conforme Ata Oficial)
// Administradores Oficiais da Khedira League:
// - Guilherme Pereira Marques Brito (guimarquesbrito@gmail.com) -> Diretor
// - Guilherme Tourinho (Guilhermebtourinho@gmail.com) -> Presidente
const PEREIRA_EMAIL = 'guimarquesbrito@gmail.com';
const TOURINHO_EMAIL = 'guilhermebtourinho@gmail.com';
const TOURINHO_PASSWORD = process.env.TOURINHO_ADMIN_PASSWORD || 'fifakhedira2015';
const PEREIRA_PASSWORD = process.env.PEREIRA_ADMIN_PASSWORD || 'fifakhedira2015';

const MAX_SQUAD_PLAYERS = 23;
const AUCTION_DURATION_SECONDS = 5400; // 1 hora e 30 minutos (90 minutos = 5400 segundos)

function isPositionAllowedForDay(_position: string, _day?: 1 | 2 | 3 | 'ALL'): boolean {
  // Regulamento Oficial Atualizado: Sem divisão de fases!
  // ATAQUE, MEIO CAMPO, DEFESA e GOLEIROS todos liberados simultaneamente para disputa.
  return true;
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial state builder with bcrypt password hashes
function getInitialState(): LeagueState {
  const players: Player[] = INITIAL_PLAYERS.map((p) => ({
    ...p,
    status: 'AVAILABLE'
  }));

  const defaultPereiraHash = bcrypt.hashSync(PEREIRA_PASSWORD, 10);
  const defaultTourinhoHash = bcrypt.hashSync(TOURINHO_PASSWORD, 10);

  return {
    users: [
      {
        id: 'user-admin-default',
        email: PEREIRA_EMAIL,
        name: 'Guilherme Pereira',
        teamName: 'Pereira Galácticos FC',
        role: 'ADMIN',
        adminTitle: 'Diretor',
        budget: DEFAULT_BUDGET,
        spent: 0,
        passwordHash: defaultPereiraHash,
        createdAt: Date.now()
      },
      {
        id: 'user-admin-tourinho',
        email: TOURINHO_EMAIL,
        name: 'Guilherme Tourinho',
        teamName: 'Tourinho Galácticos FC',
        role: 'ADMIN',
        adminTitle: 'Presidente',
        budget: DEFAULT_BUDGET,
        spent: 0,
        passwordHash: defaultTourinhoHash,
        createdAt: Date.now()
      }
    ],
    players,
    auction: {
      status: 'NOT_STARTED',
      currentPlayer: null,
      currentBid: null,
      bidHistory: [],
      timerRemaining: 0,
      nominationTurnUserId: null,
      nominationTimerRemaining: 0,
      isFreeNominationMode: true,
      nominationQueue: [],
      minimumBidIncrement: 1000000,
      auctionDay: 'ALL', // Compatibilidade
      auctionType: 'FREE', // 'FREE' (Leilão Livre - Todas as Posições) | 'PHASED' (Leilão por Fases)
      currentPhase: 'GOLEIROS', // 'GOLEIROS' | 'DEFENSORES' | 'MEIO_CAMPO' | 'ATACANTES'
      anonymousBidding: true, // Sigilo de Lances obrigatório conforme Ata Oficial
      scheduledStartTime: Date.now() + 5400 * 1000, // Contagem regressiva padrão oficial de 1h30m
      lastUpdated: Date.now()
    },
    squads: {
      'user-admin-default': {
        userId: 'user-admin-default',
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      },
      'user-admin-tourinho': {
        userId: 'user-admin-tourinho',
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      }
    },
    watchlists: {},
    defaultBudget: DEFAULT_BUDGET
  };
}

// Load or initialize DB
let leagueState: LeagueState;
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    leagueState = JSON.parse(raw);
    leagueState.defaultBudget = DEFAULT_BUDGET;
    if (!leagueState.watchlists) {
      leagueState.watchlists = {};
    }
    if (!leagueState.auction.auctionType) {
      leagueState.auction.auctionType = 'FREE';
    }
    if (!leagueState.auction.currentPhase) {
      leagueState.auction.currentPhase = 'GOLEIROS';
    }

    // Ensure official administrators and clubs exist
    const defaultParticipants: UserProfile[] = [
      {
        id: 'user-admin-default',
        email: PEREIRA_EMAIL,
        name: 'Guilherme Pereira',
        teamName: 'Pereira Galácticos FC',
        role: 'ADMIN',
        adminTitle: 'Diretor',
        budget: DEFAULT_BUDGET,
        spent: 0,
        password: PEREIRA_PASSWORD,
        createdAt: Date.now()
      },
      {
        id: 'user-admin-tourinho',
        email: TOURINHO_EMAIL,
        name: 'Guilherme Tourinho',
        teamName: 'Tourinho Galácticos FC',
        role: 'ADMIN',
        adminTitle: 'Presidente',
        budget: DEFAULT_BUDGET,
        spent: 0,
        password: TOURINHO_PASSWORD,
        createdAt: Date.now()
      }
    ];

    defaultParticipants.forEach((dp) => {
      const existing = leagueState.users.find((u) => u.email.toLowerCase() === dp.email.toLowerCase() || u.id === dp.id);
      if (!existing) {
        leagueState.users.push(dp);
      }
    });

    // Remove any legacy fictitious test participants (Rodrigo Silva, Matheus Souza, Lucas Santos)
    const fictitiousEmails = [
      'rodrigo.khedira@gmail.com',
      'matheus.futebol@gmail.com',
      'lucas.khedira@gmail.com'
    ];
    const fictitiousIds = ['user-friend-1', 'user-friend-2', 'user-friend-3'];

    leagueState.users = leagueState.users.filter(
      (u) => !fictitiousIds.includes(u.id) && !fictitiousEmails.includes(u.email.toLowerCase())
    );

    fictitiousIds.forEach((id) => {
      if (leagueState.squads[id]) {
        delete leagueState.squads[id];
      }
    });

    if (fictitiousIds.includes(leagueState.auction.nominationTurnUserId)) {
      leagueState.auction.nominationTurnUserId = 'user-admin-default';
    }

    // Migrate any plaintext passwords to bcrypt hash and ensure admin password hashes
    const defaultPereiraHash = bcrypt.hashSync(PEREIRA_PASSWORD, 10);
    const defaultTourinhoHash = bcrypt.hashSync(TOURINHO_PASSWORD, 10);

    // Atualiza o orçamento de todos os participantes para € 400M (recalculando saldo restante: 400M - spent)
    leagueState.users.forEach((u) => {
      u.budget = DEFAULT_BUDGET - (u.spent || 0);
      const emailLower = u.email.trim().toLowerCase();
      // Guarantee Guilherme Pereira as Diretor and ADMIN
      if (emailLower === PEREIRA_EMAIL.toLowerCase()) {
        u.role = 'ADMIN';
        u.name = 'Guilherme Pereira';
        u.adminTitle = 'Diretor';
        if (u.teamName === 'Tourinho Galácticos FC') {
          u.teamName = 'Pereira Galácticos FC';
        }
        if (!u.passwordHash || !u.passwordHash.startsWith('$2')) {
          u.passwordHash = defaultPereiraHash;
        }
        delete u.password;
      } else if (
        emailLower === TOURINHO_EMAIL.toLowerCase() ||
        emailLower === 'guilherme.tourinho@gmail.com' ||
        u.id === 'user-admin-tourinho' ||
        u.name.toLowerCase().includes('tourinho')
      ) {
        // Guarantee Guilherme Tourinho as Presidente and ADMIN with registered email and password
        u.email = TOURINHO_EMAIL;
        u.role = 'ADMIN';
        u.name = 'Guilherme Tourinho';
        u.adminTitle = 'Presidente';
        if (!u.passwordHash || !u.passwordHash.startsWith('$2')) {
          u.passwordHash = defaultTourinhoHash;
        }
        delete u.password;
      } else if (u.password && (!u.passwordHash || !u.passwordHash.startsWith('$2'))) {
        u.passwordHash = bcrypt.hashSync(u.password, 10);
        delete u.password;
      }
    });

    // Ensure auction starts in NOT_STARTED if idle or unconfigured
    if (!leagueState.auction) {
      leagueState.auction = getInitialState().auction;
    } else {
      if (leagueState.auction.status === 'IDLE' && !leagueState.auction.currentPlayer) {
        leagueState.auction.status = 'NOT_STARTED';
      }
      // Mercado Unificado: Todas as posições liberadas simultaneamente
      leagueState.auction.auctionDay = 'ALL';
      if (leagueState.auction.anonymousBidding === undefined) {
        leagueState.auction.anonymousBidding = true;
      }
      if (!leagueState.auction.nominationQueue) {
        leagueState.auction.nominationQueue = [];
      }
      leagueState.auction.isFreeNominationMode = true;
    }

    // Ensure positions MD and ME become PD and PE across all players
    (leagueState.players || []).forEach((p) => {
      if ((p.position as string) === 'MD') p.position = 'PD';
      if ((p.position as string) === 'ME') p.position = 'PE';
    });
    if (leagueState.auction?.currentPlayer) {
      if ((leagueState.auction.currentPlayer.position as string) === 'MD') leagueState.auction.currentPlayer.position = 'PD';
      if ((leagueState.auction.currentPlayer.position as string) === 'ME') leagueState.auction.currentPlayer.position = 'PE';
    }
    if (leagueState.auction?.nominationQueue) {
      leagueState.auction.nominationQueue.forEach((item) => {
        if (item.player) {
          if ((item.player.position as string) === 'MD') item.player.position = 'PD';
          if ((item.player.position as string) === 'ME') item.player.position = 'PE';
        }
      });
    }

    // Synchronize players with official INITIAL_PLAYERS and update initialPrices
    const existingPlayersMap = new Map<string, Player>();
    (leagueState.players || []).forEach((p) => {
      existingPlayersMap.set(p.id, p);
      existingPlayersMap.set(p.name.toLowerCase().trim(), p);
    });

    const updatedPlayers: Player[] = INITIAL_PLAYERS.map((initP) => {
      const existing = existingPlayersMap.get(initP.id) || existingPlayersMap.get(initP.name.toLowerCase().trim());
      if (existing) {
        const effectivePrice = existing.status === 'AVAILABLE'
          ? (existing.currentBid ? existing.currentBid.amount : initP.initialPrice)
          : (existing.currentBid ? existing.currentBid.amount : (existing.currentPrice || initP.initialPrice));
        return {
          ...initP,
          id: initP.id,
          name: initP.name,
          position: initP.position,
          club: initP.club,
          nationality: initP.nationality,
          initialPrice: initP.initialPrice,
          currentPrice: effectivePrice,
          status: existing.status || 'AVAILABLE',
          currentBid: existing.currentBid || null,
          bidHistory: existing.bidHistory || (existing.currentBid ? [existing.currentBid] : []),
          timerRemaining: existing.timerRemaining,
          auctionExpiresAt: existing.auctionExpiresAt,
          soldTo: existing.soldTo,
          nominatedBy: existing.nominatedBy,
          isManualExtra: existing.isManualExtra
        };
      }
      return {
        ...initP,
        status: 'AVAILABLE'
      };
    });

    // Retain any manual extra players or sold players not in INITIAL_PLAYERS
    (leagueState.players || []).forEach((p) => {
      if ((p.isManualExtra || p.soldTo) && !updatedPlayers.some((up) => up.id === p.id || up.name.toLowerCase().trim() === p.name.toLowerCase().trim())) {
        updatedPlayers.push(p);
      }
    });

    leagueState.players = updatedPlayers;

    // Ensure leagueState.auction.currentPlayer references the matching player in updatedPlayers with active bid
    if (leagueState.auction?.currentPlayer) {
      const match = updatedPlayers.find((p) => p.id === leagueState.auction.currentPlayer?.id);
      if (match) {
        if (!match.currentBid && leagueState.auction.currentBid && leagueState.auction.currentBid.playerId === match.id) {
          match.currentBid = leagueState.auction.currentBid;
          match.currentPrice = leagueState.auction.currentBid.amount;
        } else if (match.currentBid && !leagueState.auction.currentBid) {
          leagueState.auction.currentBid = match.currentBid;
        }
        leagueState.auction.currentPlayer = match;
      }
    }

    // Se o timer estiver acima de 1h 30m (5400s), ajustar apenas se não houver duração customizada configurada
    if (!leagueState.auction.defaultDurationSeconds && leagueState.auction && leagueState.auction.timerRemaining > AUCTION_DURATION_SECONDS) {
      leagueState.auction.timerRemaining = AUCTION_DURATION_SECONDS;
    }
    (leagueState.players || []).forEach((p) => {
      if (!leagueState.auction.defaultDurationSeconds && p.status === 'IN_AUCTION' && typeof p.timerRemaining === 'number' && p.timerRemaining > AUCTION_DURATION_SECONDS) {
        p.timerRemaining = AUCTION_DURATION_SECONDS;
        p.auctionExpiresAt = Date.now() + AUCTION_DURATION_SECONDS * 1000;
      }
    });

    fs.writeFileSync(DB_FILE, JSON.stringify(leagueState, null, 2));
  } else {
    leagueState = getInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(leagueState, null, 2));
  }
} catch (e) {
  console.error('Error loading DB, resetting to initial state:', e);
  leagueState = getInitialState();
}

function applyDisputeResolutionsAndResumeAuction() {
  const resolvedDisputes = [
    { id: 'p-270', name: 'Y. Sommer', uid: 'user-1790259670059-zxvzd', uname: 'Lucas campos', tname: 'Pau de oculos', email: 'lamaralcampos@gmail.com', amount: 10000000, slot: 'gol' },
    { id: 'p-265', name: 'W. Falcone', uid: 'user-admin-tourinho', uname: 'Guilherme Tourinho', tname: 'CLARICE DO BAR', email: 'guilhermebtourinho@gmail.com', amount: 10000000, slot: 'bench' },
    { id: 'p-235', name: 'M. ter Stegen', uid: 'user-1790261315866-noq3i', uname: 'Dudu', tname: 'DONA NORMA NETOS FUTEBOL CLUBE', email: 'lued07.sampaioguimaraes@gmail.com', amount: 10000000, slot: 'gol' },
    { id: 'p-234', name: 'M. Svilar', uid: 'user-1790724401870-rxt7p', uname: 'Lucas Freitas', tname: 'Vitória', email: 'lucasfreitasgeo@hotmail.com', amount: 10000000, slot: 'bench' },
    { id: 'p-574', name: 'O. Aina', uid: 'user-1790724401870-rxt7p', uname: 'Lucas Freitas', tname: 'Vitória', email: 'lucasfreitasgeo@hotmail.com', amount: 10000000, slot: 'ld' },
    { id: 'p-33', name: 'Eric García', uid: 'user-1790724401870-rxt7p', uname: 'Lucas Freitas', tname: 'Vitória', email: 'lucasfreitasgeo@hotmail.com', amount: 25000000, slot: 'bench' }
  ];

  const disputedPids = resolvedDisputes.map(d => d.id);

  resolvedDisputes.forEach(rd => {
    const pl = leagueState.players.find(p => p.id === rd.id);
    if (pl) {
      pl.status = 'SOLD';
      pl.currentPrice = rd.amount;
      pl.timerRemaining = 0;
      pl.auctionExpiresAt = undefined;
      pl.soldTo = {
        userId: rd.uid,
        userName: rd.uname,
        teamName: rd.tname,
        amount: rd.amount,
        auctionDay: 'ALL',
        soldAt: 1790992241855
      };
      const validBid: Bid = {
        id: `bid-${rd.id}-resolved`,
        playerId: rd.id,
        playerName: rd.name,
        userId: rd.uid,
        userName: rd.uname,
        teamName: rd.tname,
        userEmail: rd.email,
        amount: rd.amount,
        timestamp: 1790992241855,
        isAnonymous: true
      };
      pl.currentBid = validBid;
      pl.bidHistory = [validBid];
    }

    if (!leagueState.squads[rd.uid]) {
      leagueState.squads[rd.uid] = {
        userId: rd.uid,
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      };
    }
    const winSquad = leagueState.squads[rd.uid];
    if (rd.slot !== 'bench' && !winSquad.starterSlots[rd.slot]) {
      winSquad.starterSlots[rd.slot] = rd.id;
    } else {
      const isStarter = Object.values(winSquad.starterSlots || {}).includes(rd.id);
      if (!isStarter && !winSquad.benchPlayerIds.includes(rd.id)) {
        winSquad.benchPlayerIds.push(rd.id);
      }
    }
  });

  // Remove disputed players and M. Palestra from PAULO BOMBA squad
  const pbSquad = leagueState.squads['user-admin-default'];
  if (pbSquad) {
    for (const [slot, pid] of Object.entries(pbSquad.starterSlots || {})) {
      if (disputedPids.includes(pid as string) || pid === 'p-561') {
        pbSquad.starterSlots[slot] = null;
      }
    }
    pbSquad.benchPlayerIds = (pbSquad.benchPlayerIds || []).filter(
      pid => !disputedPids.includes(pid) && pid !== 'p-561'
    );
    if (!pbSquad.starterSlots['ld'] && pbSquad.benchPlayerIds.includes('p-598')) {
      pbSquad.starterSlots['ld'] = 'p-598';
      pbSquad.benchPlayerIds = pbSquad.benchPlayerIds.filter(id => id !== 'p-598');
    }
  }

  // Devolve o valor de €75M a PAULO BOMBA (user-admin-default)
  const pbUser = leagueState.users.find(u => u.id === 'user-admin-default');
  if (pbUser) {
    pbUser.budget = 277000000;
    pbUser.spent = 123000000;
  }

  // Dispute resolutions applied to master DB
}

// applyDisputeResolutionsAndResumeAuction();

let cloudSyncTimer: NodeJS.Timeout | null = null;
function debouncedCloudSync() {
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    syncLeagueMasterToFirestore(leagueState).catch((err) => {
      console.warn('[Firebase] Master state sync error:', err);
    });
  }, 1200);
}

let saveStateTimer: NodeJS.Timeout | null = null;
let isWritingState = false;
let pendingStateWrite = false;

async function executeStatePersistence() {
  if (isWritingState) {
    pendingStateWrite = true;
    return;
  }
  isWritingState = true;
  try {
    const tmp = `${DB_FILE}.tmp.${Date.now()}`;
    const data = JSON.stringify(leagueState);
    await fs.promises.writeFile(tmp, data, 'utf-8');
    await fs.promises.rename(tmp, DB_FILE);
  } catch (err) {
    console.error('Failed to persist database:', err);
  } finally {
    isWritingState = false;
    if (pendingStateWrite) {
      pendingStateWrite = false;
      executeStatePersistence();
    }
  }
  debouncedCloudSync();
}

function saveState(immediate = false) {
  if (immediate) {
    if (saveStateTimer) {
      clearTimeout(saveStateTimer);
      saveStateTimer = null;
    }
    executeStatePersistence();
    return;
  }
  if (saveStateTimer) clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(() => {
    saveStateTimer = null;
    executeStatePersistence();
  }, 80);
}

function getAuctionDuration(): number {
  return leagueState?.auction?.defaultDurationSeconds || AUCTION_DURATION_SECONDS;
}

// WebSocket broadcast
const clients = new Set<WebSocket>();

function broadcast(message: WSMessage) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('WebSocket send error:', err);
      }
    }
  }
}

let broadcastStateTimer: NodeJS.Timeout | null = null;

function broadcastState(immediate = false) {
  if (immediate) {
    if (broadcastStateTimer) {
      clearTimeout(broadcastStateTimer);
      broadcastStateTimer = null;
    }
    broadcast({ type: 'STATE_SYNC', data: sanitizeLeagueState(leagueState) });
    return;
  }
  // Coalesce rapid bursts into a single broadcast after 60ms
  if (broadcastStateTimer) return;
  broadcastStateTimer = setTimeout(() => {
    broadcastStateTimer = null;
    broadcast({ type: 'STATE_SYNC', data: sanitizeLeagueState(leagueState) });
  }, 60);
}

// ==========================================
// SINCRONIZAÇÃO COM PRODUÇÃO (RENDER)
// ==========================================
const PRODUCTION_ORIGIN = (process.env.PRODUCTION_SYNC_URL || 'https://leilaoeafc27.onrender.com').replace(/\/$/, '');
let lastProductionSyncTime = Date.now();
let isProductionWsConnected = false;
let prodWsClient: WebSocket | null = null;
let prodWsReconnectTimeout: NodeJS.Timeout | null = null;

// Sincroniza o estado completo com o site de produção (Render)
async function syncFromProductionState(forceBroadcast = true): Promise<{ success: boolean; message: string; timestamp: number }> {
  try {
    const res = await fetch(`${PRODUCTION_ORIGIN}/api/state`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error('Resposta de produção em formato inválido');
    }
    const prodData: LeagueState = json.data;

    // Preserva senhas e hashes locais dos usuários existentes
    const mergedUsers = (prodData.users || []).map((pu) => {
      const existing = leagueState.users.find(
        (lu) => lu.id === pu.id || lu.email.toLowerCase() === pu.email.toLowerCase()
      );
      return {
        ...pu,
        passwordHash: existing?.passwordHash || (existing?.password ? bcrypt.hashSync(existing.password, 10) : '')
      };
    });

    if (mergedUsers.length > 0) leagueState.users = mergedUsers;
    if (prodData.players && prodData.players.length > 0) leagueState.players = prodData.players;
    if (prodData.auction) leagueState.auction = prodData.auction;
    if (prodData.squads) leagueState.squads = prodData.squads;
    if (prodData.watchlists && typeof prodData.watchlists === 'object') {
      leagueState.watchlists = leagueState.watchlists || {};
      for (const [uid, pIds] of Object.entries(prodData.watchlists)) {
        if (Array.isArray(pIds) && pIds.length > 0) {
          leagueState.watchlists[uid] = Array.from(new Set([...(leagueState.watchlists[uid] || []), ...pIds]));
        }
      }
    }
    if (prodData.defaultBudget) leagueState.defaultBudget = prodData.defaultBudget;

    lastProductionSyncTime = Date.now();
    saveState();

    if (forceBroadcast) {
      broadcastState();
    }

    console.log(`[Production Sync] ✅ Sincronizado com ${PRODUCTION_ORIGIN} com sucesso (${leagueState.users.length} participantes, ${leagueState.players.length} jogadores).`);
    return {
      success: true,
      message: `Sincronizado com ${PRODUCTION_ORIGIN} com sucesso (${leagueState.users.length} participantes, ${leagueState.players.length} jogadores)!`,
      timestamp: lastProductionSyncTime,
    };
  } catch (err: any) {
    console.warn(`[Production Sync] ⚠️ Aviso ao sincronizar com ${PRODUCTION_ORIGIN}:`, err?.message || err);
    return {
      success: false,
      message: `Falha ao sincronizar com ${PRODUCTION_ORIGIN}: ${err?.message || 'Servidor offline ou inacessível'}`,
      timestamp: lastProductionSyncTime,
    };
  }
}

// Ponte WebSocket contínua com a instância de produção
function startProductionWebSocketBridge() {
  if (prodWsReconnectTimeout) {
    clearTimeout(prodWsReconnectTimeout);
    prodWsReconnectTimeout = null;
  }

  const wsProto = PRODUCTION_ORIGIN.startsWith('https') ? 'wss:' : 'ws:';
  const wsHost = PRODUCTION_ORIGIN.replace(/^https?:\/\//, '');
  const wsUrl = `${wsProto}//${wsHost}`;

  try {
    const ws = new WebSocket(wsUrl);
    prodWsClient = ws;

    ws.on('open', () => {
      isProductionWsConnected = true;
      console.log(`[Production Sync] 🟢 Ponte WebSocket conectada em tempo real com ${wsUrl}`);
    });

    ws.on('message', (data: any) => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());
        switch (msg.type) {
          case 'STATE_SYNC':
            if (msg.data) {
              const prodData: LeagueState = msg.data;
              const mergedUsers = (prodData.users || []).map((pu) => {
                const existing = leagueState.users.find(
                  (lu) => lu.id === pu.id || lu.email.toLowerCase() === pu.email.toLowerCase()
                );
                return {
                  ...pu,
                  passwordHash: existing?.passwordHash || ''
                };
              });
              if (mergedUsers.length > 0) leagueState.users = mergedUsers;
              if (prodData.players) leagueState.players = prodData.players;
              if (prodData.auction) leagueState.auction = prodData.auction;
              if (prodData.squads) leagueState.squads = prodData.squads;
              if (prodData.watchlists && typeof prodData.watchlists === 'object') {
                leagueState.watchlists = leagueState.watchlists || {};
                for (const [uid, pIds] of Object.entries(prodData.watchlists)) {
                  if (Array.isArray(pIds) && pIds.length > 0) {
                    leagueState.watchlists[uid] = Array.from(new Set([...(leagueState.watchlists[uid] || []), ...pIds]));
                  }
                }
              }
              lastProductionSyncTime = Date.now();
              saveState();
              broadcastState();
            }
            break;

          case 'NEW_BID':
            if (msg.data) {
              const incomingPlayer = msg.data.player;
              const incomingBid = msg.data.bid;
              const incomingAuction = msg.data.auction;

              if (incomingAuction) {
                const isBidForCurrentAuctionPlayer = Boolean(
                  incomingBid &&
                  incomingAuction.currentPlayer &&
                  incomingBid.playerId === incomingAuction.currentPlayer.id
                );
                leagueState.auction = {
                  ...leagueState.auction,
                  ...incomingAuction,
                  currentBid: isBidForCurrentAuctionPlayer ? incomingBid : leagueState.auction.currentBid,
                  lastUpdated: Date.now()
                };
              }
              if (incomingPlayer) {
                const pIdx = leagueState.players.findIndex((p) => p.id === incomingPlayer.id);
                if (pIdx >= 0) {
                  const isBidForThisPlayer = Boolean(incomingBid && incomingBid.playerId === incomingPlayer.id);
                  const validCurrentBid = isBidForThisPlayer
                    ? incomingBid
                    : (incomingPlayer.currentBid && incomingPlayer.currentBid.playerId === incomingPlayer.id
                      ? incomingPlayer.currentBid
                      : (leagueState.players[pIdx].currentBid && leagueState.players[pIdx].currentBid?.playerId === incomingPlayer.id
                        ? leagueState.players[pIdx].currentBid
                        : null));

                  leagueState.players[pIdx] = {
                    ...leagueState.players[pIdx],
                    ...incomingPlayer,
                    status: 'IN_AUCTION',
                    currentPrice: isBidForThisPlayer ? incomingBid.amount : (validCurrentBid?.amount || incomingPlayer.currentPrice),
                    currentBid: validCurrentBid
                  };
                }
              }
              lastProductionSyncTime = Date.now();
              saveState();
              broadcast(msg);
            }
            break;

          case 'AUCTION_STARTED':
          case 'AUCTION_HAMMER':
          case 'NOMINATION_TURN_CHANGE':
          case 'CHAT_NOTIFICATION':
            broadcast(msg as WSMessage);
            break;
        }
      } catch {
        // ignore parse error
      }
    });

    ws.on('close', () => {
      isProductionWsConnected = false;
      prodWsClient = null;
      prodWsReconnectTimeout = setTimeout(startProductionWebSocketBridge, 15000);
    });

    ws.on('error', () => {
      isProductionWsConnected = false;
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
  } catch (err: any) {
    prodWsReconnectTimeout = setTimeout(startProductionWebSocketBridge, 15000);
  }
}

// Advance nomination turn to next active participant
function advanceNominationTurn() {
  if (leagueState.users.length === 0) return;
  const currentIndex = leagueState.users.findIndex(
    (u) => u.id === leagueState.auction.nominationTurnUserId
  );
  const nextIndex = (currentIndex + 1) % leagueState.users.length;
  const nextUser = leagueState.users[nextIndex];

  leagueState.auction.nominationTurnUserId = nextUser ? nextUser.id : null;
  leagueState.auction.nominationTimerRemaining = 45;
  leagueState.auction.lastUpdated = Date.now();

  saveState();

  broadcast({
    type: 'NOMINATION_TURN_CHANGE',
    data: {
      userId: nextUser ? nextUser.id : null,
      userName: nextUser ? nextUser.name : 'Ninguém'
    }
  });

  if (nextUser) {
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `🔄 Vez de anunciar passada para ${nextUser.name} (${nextUser.teamName})!`,
        timestamp: Date.now(),
        type: 'info'
      }
    });
  }

  broadcastState();
}

// Obter a proposta mais alta (a última válida) registrada exclusivamente para este atleta
function getHighestBidForPlayer(player: Player): Bid | null {
  if (!player) return null;

  const validBids: Bid[] = [];

  // 1. Direct currentBid on player (must strictly belong to this player)
  if (player.currentBid && (player.currentBid.playerId === player.id || (!player.currentBid.playerId && player.currentBid.playerName === player.name))) {
    if (typeof player.currentBid.amount === 'number' && player.currentBid.amount > 0 && player.currentBid.userId) {
      validBids.push(player.currentBid);
    }
  }

  // 2. Player's own bidHistory (must strictly belong to this player)
  if (Array.isArray(player.bidHistory) && player.bidHistory.length > 0) {
    for (const b of player.bidHistory) {
      if (b && (b.playerId === player.id || (!b.playerId && b.playerName === player.name)) && typeof b.amount === 'number' && b.amount > 0 && b.userId) {
        validBids.push(b);
      }
    }
  }

  // 3. Global auction currentBid ONLY if it strictly belongs to this player
  if (leagueState.auction.currentBid && (leagueState.auction.currentBid.playerId === player.id || (!leagueState.auction.currentBid.playerId && leagueState.auction.currentBid.playerName === player.name))) {
    if (typeof leagueState.auction.currentBid.amount === 'number' && leagueState.auction.currentBid.amount > 0 && leagueState.auction.currentBid.userId) {
      validBids.push(leagueState.auction.currentBid);
    }
  }

  // 4. Global auction bidHistory for this specific player
  if (Array.isArray(leagueState.auction.bidHistory) && leagueState.auction.bidHistory.length > 0) {
    for (const b of leagueState.auction.bidHistory) {
      if (b && (b.playerId === player.id || (!b.playerId && b.playerName === player.name)) && typeof b.amount === 'number' && b.amount > 0 && b.userId) {
        validBids.push(b);
      }
    }
  }

  if (validBids.length === 0) return null;

  // Deduplicate bids by key
  const uniqueBids = new Map<string, Bid>();
  for (const b of validBids) {
    const key = b.id || `${b.userId}-${b.amount}-${b.timestamp}`;
    if (!uniqueBids.has(key)) {
      uniqueBids.set(key, b);
    }
  }

  // Sort: highest amount first; if equal amount, newest timestamp wins (latest bid)
  const sorted = Array.from(uniqueBids.values()).sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return sorted[0] || null;
}

// Bater o martelo oficialmente: o usuário com o maior lance contrata o jogador, vai para seu clube e elenco
function sellPlayerToHighestBidder(player: Player, auctionDay?: string | number): { sold: boolean; winner?: UserProfile; amount?: number } {
  const winningBid = getHighestBidForPlayer(player);

  if (winningBid && winningBid.userId) {
    const winner = leagueState.users.find((u) => u.id === winningBid.userId);
    if (winner) {
      // 1. Debitar valor do orçamento e somar aos gastos do clube vencedor
      winner.budget = Math.max(0, winner.budget - winningBid.amount);
      winner.spent = (winner.spent || 0) + winningBid.amount;

      // 2. Definir status oficial de VENDIDO no catálogo da liga
      player.status = 'SOLD';
      player.currentPrice = winningBid.amount;
      player.currentBid = winningBid;
      player.timerRemaining = 0;
      player.auctionExpiresAt = undefined;
      player.soldTo = {
        userId: winner.id,
        userName: winner.name,
        teamName: winner.teamName,
        amount: winningBid.amount,
        auctionDay: (auctionDay as 1 | 2 | 3 | 'ALL') || leagueState.auction.auctionDay || 'ALL',
        soldAt: Date.now()
      };

      // 3. Integrar oficialmente o jogador ao clube (Squad/Elenco do usuário vencedor)
      if (!leagueState.squads[winner.id]) {
        leagueState.squads[winner.id] = {
          userId: winner.id,
          formationId: '4-3-3',
          starterSlots: {},
          benchPlayerIds: []
        };
      }
      const userSquad = leagueState.squads[winner.id];
      const isAlreadyStarter = Object.values(userSquad.starterSlots || {}).includes(player.id);
      if (!isAlreadyStarter && !userSquad.benchPlayerIds.includes(player.id)) {
        userSquad.benchPlayerIds.push(player.id);
      }

      // 4. Disparar evento oficial de martelo (AUCTION_HAMMER) para acionar sons, confetes e atualização de tela
      broadcast({
        type: 'AUCTION_HAMMER',
        data: {
          winner: sanitizeUser(winner),
          player,
          finalPrice: winningBid.amount
        }
      });

      // 5. Notificação de celebração no feed da liga
      broadcast({
        type: 'CHAT_NOTIFICATION',
        data: {
          message: `🔨 MARTELO BATIDO! ${player.name} foi arrematado oficialmente por ${winner.name} (${winner.teamName}) pelo valor de € ${(winningBid.amount / 1000000).toFixed(1)}M e já foi integrado ao clube!`,
          timestamp: Date.now(),
          type: 'hammer'
        }
      });

      return { sold: true, winner, amount: winningBid.amount };
    }
  }

  // Sem lances registrados: atleta retorna ao mercado como DISPONÍVEL
  player.status = 'AVAILABLE';
  player.timerRemaining = 0;
  player.auctionExpiresAt = undefined;
  player.currentBid = null;

  broadcast({
    type: 'CHAT_NOTIFICATION',
    data: {
      message: `⏳ Tempo esgotado para ${player.name} sem nenhuma proposta registrada. Jogador segue disponível no mercado.`,
      timestamp: Date.now(),
      type: 'info'
    }
  });

  return { sold: false };
}

function isPositionCompatibleWithSlot(slotRole: string, playerPos: string): boolean {
  if (slotRole === playerPos) return true;
  if (slotRole === 'GOL') return playerPos === 'GOL';
  if (slotRole === 'ZAG') return ['ZAG'].includes(playerPos);
  if (slotRole === 'LE') return ['LE', 'LD', 'ZAG'].includes(playerPos);
  if (slotRole === 'LD') return ['LD', 'LE', 'ZAG'].includes(playerPos);
  if (slotRole === 'VOL') return ['VOL', 'MC'].includes(playerPos);
  if (slotRole === 'MC') return ['MC', 'VOL', 'MEI'].includes(playerPos);
  if (slotRole === 'MEI') return ['MEI', 'MC', 'PE', 'PD'].includes(playerPos);
  if (slotRole === 'PE') return ['PE', 'ATA'].includes(playerPos);
  if (slotRole === 'PD') return ['PD', 'ATA'].includes(playerPos);
  if (slotRole === 'ATA') return ['ATA', 'SA', 'PE', 'PD'].includes(playerPos);
  return false;
}

// Ao finalizar o leilão: reseta o elenco conceito e substitui oficialmente pelos jogadores obtidos no leilão
function resetConceptAndApplyWonPlayersToAllUsers() {
  leagueState.users.forEach((user) => {
    const wonPlayers = leagueState.players.filter(
      (p) => p.status === 'SOLD' && p.soldTo?.userId === user.id
    );
    const currentSquad = leagueState.squads[user.id];
    const formationId = currentSquad?.formationId || '4-3-3';
    const formation =
      INITIAL_FORMATIONS.find((f) => f.id === formationId) || INITIAL_FORMATIONS[0];

    const newStarterSlots: { [slotId: string]: string | null } = {};
    formation.slots.forEach((s) => {
      newStarterSlots[s.slotId] = null;
    });

    const unassigned = [...wonPlayers];

    // Pass 0: Se o usuário já havia escalado um atleta conquistado em slot compatível, mantém
    if (currentSquad?.starterSlots) {
      formation.slots.forEach((slot) => {
        const currentPid = currentSquad.starterSlots[slot.slotId];
        if (currentPid && wonPlayers.some((p) => p.id === currentPid)) {
          const pObj = wonPlayers.find((p) => p.id === currentPid);
          if (pObj && isPositionCompatibleWithSlot(slot.role, pObj.position)) {
            newStarterSlots[slot.slotId] = currentPid;
            const idx = unassigned.findIndex((p) => p.id === currentPid);
            if (idx !== -1) unassigned.splice(idx, 1);
          }
        }
      });
    }

    // Pass 1: Correspondência exata de função (ex: GOL -> GOL, ZAG -> ZAG, ATA -> ATA)
    formation.slots.forEach((slot) => {
      if (newStarterSlots[slot.slotId]) return;
      const matchIdx = unassigned.findIndex((p) => p.position === slot.role);
      if (matchIdx !== -1) {
        newStarterSlots[slot.slotId] = unassigned[matchIdx].id;
        unassigned.splice(matchIdx, 1);
      }
    });

    // Pass 2: Correspondência tática compatível
    formation.slots.forEach((slot) => {
      if (newStarterSlots[slot.slotId]) return;
      const matchIdx = unassigned.findIndex((p) => isPositionCompatibleWithSlot(slot.role, p.position));
      if (matchIdx !== -1) {
        newStarterSlots[slot.slotId] = unassigned[matchIdx].id;
        unassigned.splice(matchIdx, 1);
      }
    });

    // Pass 3: Preenchimento de vagas restantes com atletas de linha (ou GOL para slot GOL)
    formation.slots.forEach((slot) => {
      if (newStarterSlots[slot.slotId]) return;
      const matchIdx = unassigned.findIndex((p) => {
        if (slot.role === 'GOL') return p.position === 'GOL';
        return p.position !== 'GOL';
      });
      if (matchIdx !== -1) {
        newStarterSlots[slot.slotId] = unassigned[matchIdx].id;
        unassigned.splice(matchIdx, 1);
      }
    });

    // Atletas restantes conquistados vão para o banco de reservas oficial
    const newBench = unassigned.map((p) => p.id);

    leagueState.squads[user.id] = {
      userId: user.id,
      formationId,
      starterSlots: newStarterSlots,
      benchPlayerIds: newBench
    };
  });
}

// Complete specific player auction: hammer drops!
function finalizeSpecificPlayerAuction(player: Player) {
  sellPlayerToHighestBidder(player);

  if (leagueState.auction.currentPlayer?.id === player.id) {
    const nextInAuction = leagueState.players.find((p) => p.id !== player.id && p.status === 'IN_AUCTION');
    if (nextInAuction) {
      leagueState.auction.currentPlayer = nextInAuction;
      leagueState.auction.currentBid = getHighestBidForPlayer(nextInAuction);
      if (!leagueState.auction.timerRemaining || leagueState.auction.timerRemaining <= 0) {
        leagueState.auction.timerRemaining = nextInAuction.timerRemaining || 0;
      }
    } else {
      leagueState.auction.currentPlayer = null;
      leagueState.auction.currentBid = null;
    }
  }

  // Se não houver mais nenhum jogador em disputa, atualizar status geral
  const remainingInAuction = leagueState.players.filter((p) => p.status === 'IN_AUCTION');
  if (remainingInAuction.length === 0 && leagueState.auction.status !== 'ENDED' && leagueState.auction.status !== 'NOT_STARTED') {
    leagueState.auction.status = 'IDLE';
    leagueState.auction.currentPlayer = null;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    leagueState.auction.timerRemaining = 0;

    // Se houver jogadores postados na fila de interesse, inicia automaticamente o próximo para a duração do leilão
    if (leagueState.auction.nominationQueue && leagueState.auction.nominationQueue.length > 0) {
      const nextItem = leagueState.auction.nominationQueue.shift()!;
      const nextPlayer = leagueState.players.find((p) => p.id === nextItem.player.id);
      if (nextPlayer && nextPlayer.status === 'AVAILABLE') {
        const nextDuration = getAuctionDuration();
        nextPlayer.status = 'IN_AUCTION';
        nextPlayer.nominatedBy = nextItem.nominatedByUserId;
        nextPlayer.timerRemaining = nextDuration;
        nextPlayer.auctionExpiresAt = Date.now() + nextDuration * 1000;

        leagueState.auction.status = 'ACTIVE';
        leagueState.auction.currentPlayer = nextPlayer;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = nextDuration;
        leagueState.auction.lastUpdated = Date.now();

        broadcast({
          type: 'AUCTION_STARTED',
          data: {
            player: nextPlayer,
            auction: leagueState.auction
          }
        });

        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `📢 Próximo jogador da fila de interesse: ${nextPlayer.name} (${nextPlayer.position} - ${nextPlayer.club}), postado por ${nextItem.nominatedByUserName} (${nextItem.nominatedByTeamName})! Propostas abertas por 1 hora e 30 minutos.`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
      }
    }
  }

  saveState();
  broadcastState();
}

// Complete current auction: hammer drops!
function finalizeAuction() {
  if (leagueState.auction.currentPlayer) {
    const playerInCatalog = leagueState.players.find((p) => p.id === leagueState.auction.currentPlayer?.id);
    if (playerInCatalog) {
      finalizeSpecificPlayerAuction(playerInCatalog);
      return;
    }
  }

  const inAuctionPlayers = leagueState.players.filter((p) => p.status === 'IN_AUCTION');
  if (inAuctionPlayers.length > 0) {
    inAuctionPlayers.forEach((p) => finalizeSpecificPlayerAuction(p));
  } else {
    leagueState.auction.status = 'IDLE';
    leagueState.auction.currentPlayer = null;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    leagueState.auction.timerRemaining = 0;
    saveState();
    broadcastState();
  }
}

// Server ticker for live countdowns (supports simultaneous concurrent auctions)
setInterval(() => {
  let stateChanged = false;

  // Active auction countdown
  if (leagueState.auction.status === 'ACTIVE') {
    // Tick down all players currently in dispute
    for (const p of leagueState.players) {
      if (p.status === 'IN_AUCTION') {
        const now = Date.now();
        const isExpiredByTimestamp = Boolean(p.auctionExpiresAt && now >= p.auctionExpiresAt);
        const isExpiredByTimer = typeof p.timerRemaining === 'number' && p.timerRemaining <= 0;

        if (isExpiredByTimestamp || isExpiredByTimer) {
          finalizeSpecificPlayerAuction(p);
          saveState();
          stateChanged = true;
          continue;
        }

        if (typeof p.timerRemaining === 'number' && p.timerRemaining > 0) {
          p.timerRemaining -= 1;
          stateChanged = true;

          if (p.timerRemaining === 3600) {
            broadcast({
              type: 'CHAT_NOTIFICATION',
              data: {
                message: `⏳ Resta 1 hora para o encerramento das propostas por ${p.name}!`,
                timestamp: Date.now(),
                type: 'alert'
              }
            });
          } else if (p.timerRemaining === 1800) {
            broadcast({
              type: 'CHAT_NOTIFICATION',
              data: {
                message: `⏳ Restam 30 minutos para o encerramento das propostas por ${p.name}!`,
                timestamp: Date.now(),
                type: 'alert'
              }
            });
          } else if (p.timerRemaining === 600) {
            broadcast({
              type: 'CHAT_NOTIFICATION',
              data: {
                message: `⚠️ Atenção! Restam 10 minutos para as propostas finais de ${p.name}!`,
                timestamp: Date.now(),
                type: 'alert'
              }
            });
          } else if (p.timerRemaining === 60) {
            broadcast({
              type: 'CHAT_NOTIFICATION',
              data: {
                message: `🚨 Último minuto! Restam 60 segundos para definir o vencedor de ${p.name}!`,
                timestamp: Date.now(),
                type: 'alert'
              }
            });
          } else if (p.timerRemaining === 0) {
            finalizeSpecificPlayerAuction(p);
            saveState();
          }
        }
      }
    }

    // Keep global timer synced with the lowest remaining player timer or legacy
    if (leagueState.auction.timerRemaining > 0) {
      leagueState.auction.timerRemaining -= 1;
      leagueState.auction.lastUpdated = Date.now();
      stateChanged = true;
      if (leagueState.auction.timerRemaining === 0) {
        // Se o cronômetro oficial zerou, atletas com acréscimo continuam até seu timer individual zerar
        if (leagueState.auction.currentPlayer) {
          const cp = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
          if (cp && cp.status === 'IN_AUCTION' && (typeof cp.timerRemaining !== 'number' || cp.timerRemaining <= 0)) {
            finalizeSpecificPlayerAuction(cp);
            saveState();
          }
        }
      }
    }
  } else if (leagueState.auction.status === 'IDLE') {
    // Se estiver IDLE e houver jogadores na fila de interesse, inicia automaticamente a rodada de 1h30m
    if (leagueState.auction.nominationQueue && leagueState.auction.nominationQueue.length > 0) {
      const nextItem = leagueState.auction.nominationQueue.shift()!;
      const nextPlayer = leagueState.players.find((p) => p.id === nextItem.player.id);
      if (nextPlayer && nextPlayer.status === 'AVAILABLE') {
        nextPlayer.status = 'IN_AUCTION';
        nextPlayer.nominatedBy = nextItem.nominatedByUserId;

        leagueState.auction.status = 'ACTIVE';
        leagueState.auction.currentPlayer = nextPlayer;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = AUCTION_DURATION_SECONDS;
        leagueState.auction.lastUpdated = Date.now();

        broadcast({
          type: 'AUCTION_STARTED',
          data: {
            player: nextPlayer,
            auction: leagueState.auction
          }
        });

        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `📢 Próximo jogador da fila: ${nextPlayer.name} (${nextPlayer.position} - ${nextPlayer.club}), postado por ${nextItem.nominatedByUserName}! Propostas abertas por 1 hora e 30 minutos.`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        stateChanged = true;
      }
    }
  }

  if (stateChanged) {
    broadcastState();
  }
}, 1000);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Trust Cloud Run / Reverse Proxy (nginx) for accurate client IP identification and rate-limiting
  app.set('trust proxy', 1);

  // 1. HTTP Security Headers with Helmet
  // Configured to allow iframe embedding in Google AI Studio while setting security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false // Permite iframe no preview container do AI Studio
    })
  );

  // 2. CORS Restriction with Credentials support
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : null;

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.run.app') ||
          origin.includes('onrender.com') ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }
        return callback(new Error('Origem não permitida pela política restrita de CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
    })
  );

  // 3. Cookie parser for HttpOnly session cookies
  app.use(cookieParser());

  // 4. Body parser with strict payload size limit (mitigate DoS)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 5. Rate Limiters with proxy header validation configured
  const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 min window
    max: 3000, // generous allowance for high-frequency multiplayer events
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    skip: (req) => {
      // Do not rate-limit read-only sync, heartbeats or static uploads
      return req.path === '/state' || req.path === '/auth/me' || req.path.startsWith('/uploads/');
    },
    message: { success: false, error: 'Muitas requisições. Por favor aguarde alguns instantes.' }
  });

  const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 100, // 100 login attempts per 5 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    message: { success: false, error: 'Muitas tentativas de login. Por segurança, aguarde alguns minutos.' }
  });

  const bidLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    message: { success: false, error: 'Limite de lances atingido. Aguarde alguns segundos antes de nova oferta.' }
  });

  app.use('/api/', apiLimiter);
  app.post('/api/auth/login', authLimiter);
  app.post('/api/auth/register', authLimiter);

  // 6. Authentication Middlewares & Helpers
  interface AuthenticatedRequest extends Request {
    user?: UserProfile;
    session?: SessionPayload;
  }

  function extractToken(req: Request): string | null {
    if (req.cookies && req.cookies.khedira_session) {
      return req.cookies.khedira_session;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return null;
  }

  function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    const token = extractToken(req);
    if (token) {
      const session = verifySessionToken(token);
      if (session) {
        const user = leagueState.users.find((u) => u.id === session.userId);
        if (user) {
          req.user = user;
          req.session = session;
          return next();
        }
      }
    }

    // Fallback: If running inside sandboxed iframe without 3rd-party cookie support, check x-user-id header
    const headerUserId = (req.headers['x-user-id'] || req.body?.userId) as string;
    if (headerUserId && typeof headerUserId === 'string') {
      const user = leagueState.users.find((u) => u.id === headerUserId);
      if (user) {
        req.user = user;
        req.session = {
          userId: user.id,
          email: user.email.toLowerCase(),
          role: user.role === 'ADMIN' ? 'ADMIN' : 'PARTICIPANT',
          iat: Date.now(),
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        };
        return next();
      }
    }

    next();
  }

  function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Autenticação necessária. Faça login para continuar.' });
      return;
    }
    next();
  }

  function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Acesso restrito exclusivamente à Diretoria e Presidência da Khedira League (Guilherme Pereira & Guilherme Tourinho)'
      });
      return;
    }
    next();
  }

  function checkAdmin(req: Request, res: Response): boolean {
    const token = extractToken(req);
    let user: UserProfile | undefined;
    if (token) {
      const session = verifySessionToken(token);
      if (session) {
        user = leagueState.users.find((u) => u.id === session.userId);
      }
    }
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Acesso restrito exclusivamente à Diretoria e Presidência da Khedira League (Guilherme Pereira & Guilherme Tourinho)'
      });
      return false;
    }
    return true;
  }

  function setSessionCookie(res: Response, token: string) {
    res.cookie('khedira_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
  }

  // 7. Safe File Upload Infrastructure
  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // WebSocket Server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send full current state sanitized on connect (never leak passwords)
    ws.send(JSON.stringify({ type: 'STATE_SYNC', data: sanitizeLeagueState(leagueState) }));

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // REST API Endpoints

  // 1. Get full sanitized state
  app.get('/api/state', (_req: Request, res: Response) => {
    res.json({ success: true, data: sanitizeLeagueState(leagueState) });
  });

  // 2. Auth: Register new account (Bcrypt Hashing + HttpOnly Cookie + Session Token)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const emailVal = validateEmail(req.body.email);
    if (!emailVal.valid) {
      res.status(400).json({ success: false, error: emailVal.error });
      return;
    }
    const cleanEmail = emailVal.email!;

    const nameVal = validateString(req.body.name, 'Nome do treinador', 2, 50);
    if (!nameVal.valid) {
      res.status(400).json({ success: false, error: nameVal.error });
      return;
    }

    const teamVal = validateString(req.body.teamName, 'Nome do clube', 2, 50);
    if (!teamVal.valid) {
      res.status(400).json({ success: false, error: teamVal.error });
      return;
    }

    // Check if email already registered
    const existing = leagueState.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      res.status(400).json({
        success: false,
        error: 'Este email já está cadastrado na Khedira League. Acesse a aba "Entrar" para fazer login com suas credenciais.'
      });
      return;
    }

    const isGmailAuth = req.body.authProvider === 'gmail' || req.body.authProvider === 'google';
    let passwordHash = '';
    if (!isGmailAuth) {
      const passVal = validatePassword(req.body.password);
      if (!passVal.valid) {
        res.status(400).json({ success: false, error: passVal.error });
        return;
      }
      passwordHash = await hashPassword(passVal.password!);
    } else {
      passwordHash = await hashPassword(Date.now().toString(36) + Math.random().toString(36));
    }

    const isPereira = cleanEmail === PEREIRA_EMAIL.toLowerCase() || cleanEmail.includes('marquesbrito');
    const isTourinho = cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === 'guilherme.tourinho@gmail.com' || cleanEmail.includes('tourinho');
    const isAdmin = isPereira || isTourinho;

    const user: UserProfile = {
      id: isTourinho ? 'user-admin-tourinho' : isPereira ? 'user-admin-default' : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: isTourinho ? TOURINHO_EMAIL : cleanEmail,
      name: isPereira ? 'Guilherme Pereira' : isTourinho ? 'Guilherme Tourinho' : nameVal.value!,
      teamName: isPereira ? 'Pereira Galácticos FC' : isTourinho ? 'Tourinho Galácticos FC' : teamVal.value!,
      role: isAdmin ? 'ADMIN' : 'PARTICIPANT',
      adminTitle: isPereira ? 'Diretor' : isTourinho ? 'Presidente' : undefined,
      budget: leagueState.defaultBudget || DEFAULT_BUDGET,
      spent: 0,
      passwordHash,
      authProvider: req.body.authProvider || (cleanEmail.includes('gmail') ? 'gmail' : 'password'),
      createdAt: Date.now()
    };

    leagueState.users.push(user);

    // Initialize blank tactical squad
    leagueState.squads[user.id] = {
      userId: user.id,
      formationId: '4-3-3',
      starterSlots: {},
      benchPlayerIds: []
    };

    saveState();
    broadcastState();
    syncUserToFirestore(user);
    syncSquadToFirestore(leagueState.squads[user.id]);

    const token = createSessionToken(user);
    setSessionCookie(res, token);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: 'Conta criada com sucesso!'
    });
  });

  // 2b. Auth: Login existing user (Bcrypt verification + Session Cookie + Token)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const emailVal = validateEmail(req.body.email);
    if (!emailVal.valid) {
      res.status(400).json({ success: false, error: emailVal.error });
      return;
    }
    const passVal = validatePassword(req.body.password);
    if (!passVal.valid) {
      res.status(400).json({ success: false, error: passVal.error });
      return;
    }

    const cleanEmail = emailVal.email!;
    const inputPassword = passVal.password!;

    const isPereira = cleanEmail === PEREIRA_EMAIL.toLowerCase() || cleanEmail.includes('marquesbrito');
    const isTourinho = cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === 'guilherme.tourinho@gmail.com' || cleanEmail.includes('tourinho');

    const user = leagueState.users.find((u) =>
      u.email.toLowerCase() === cleanEmail ||
      (isTourinho && (u.id === 'user-admin-tourinho' || u.email.toLowerCase() === TOURINHO_EMAIL.toLowerCase() || u.email.toLowerCase() === 'guilherme.tourinho@gmail.com')) ||
      (isPereira && (u.id === 'user-admin-default' || u.email.toLowerCase() === PEREIRA_EMAIL.toLowerCase()))
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Nenhuma conta cadastrada com este email. Clique na aba "Criar Nova Conta" para se registrar.'
      });
      return;
    }

    let isMatch = false;
    if (isTourinho) {
      isMatch = await verifyPassword(inputPassword, user.passwordHash || user.password || TOURINHO_PASSWORD);
      if (!isMatch && inputPassword === TOURINHO_PASSWORD) {
        isMatch = true;
      }
    } else if (isPereira) {
      isMatch = await verifyPassword(inputPassword, user.passwordHash || user.password || PEREIRA_PASSWORD);
      if (!isMatch && inputPassword === PEREIRA_PASSWORD) {
        isMatch = true;
      }
    } else {
      isMatch = await verifyPassword(inputPassword, user.passwordHash || user.password);
      if (!isMatch && !user.passwordHash && !user.password) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Senha incorreta para esta conta.' });
      return;
    }

    // Ensure password is migrated to bcrypt hash and removed from plaintext
    user.passwordHash = await hashPassword(inputPassword);
    delete user.password;

    if (isPereira) {
      user.role = 'ADMIN';
      user.name = 'Guilherme Pereira';
      user.adminTitle = 'Diretor';
    } else if (isTourinho) {
      user.email = TOURINHO_EMAIL;
      user.role = 'ADMIN';
      user.name = 'Guilherme Tourinho';
      user.adminTitle = 'Presidente';
    }

    saveState();
    broadcastState();
    syncUserToFirestore(user);

    const token = createSessionToken(user);
    setSessionCookie(res, token);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  });

  // 2c. Auth: Direct Gmail / Google Connect
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const emailVal = validateEmail(req.body.email);
    if (!emailVal.valid) {
      res.status(400).json({ success: false, error: emailVal.error });
      return;
    }
    const cleanEmail = emailVal.email!;
    const existing = leagueState.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (existing) {
      res.status(403).json({
        success: false,
        error: 'Esta conta já está cadastrada com senha de proteção. Por favor, acesse a aba "Já Tenho Conta" e digite sua senha cadastrada para entrar.'
      });
      return;
    }

    const isPereira = cleanEmail === PEREIRA_EMAIL.toLowerCase() || cleanEmail.includes('marquesbrito');
    const isTourinho = cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === 'guilherme.tourinho@gmail.com' || cleanEmail.includes('tourinho');
    const isAdmin = isPereira || isTourinho;

    const trainerName = isPereira ? 'Guilherme Pereira' : isTourinho ? 'Guilherme Tourinho' : (String(req.body.name || '').trim() || cleanEmail.split('@')[0]);
    const clubName = isPereira ? 'Pereira Galácticos FC' : isTourinho ? 'Tourinho Galácticos FC' : (String(req.body.teamName || '').trim() || `${trainerName} FC`);
    const initialPassword = isTourinho ? TOURINHO_PASSWORD : isPereira ? PEREIRA_PASSWORD : (req.body.password ? String(req.body.password).trim() : 'khedira2027');

    const user: UserProfile = {
      id: isTourinho ? 'user-admin-tourinho' : isPereira ? 'user-admin-default' : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: trainerName,
      teamName: clubName,
      role: isAdmin ? 'ADMIN' : 'PARTICIPANT',
      adminTitle: isPereira ? 'Diretor' : isTourinho ? 'Presidente' : undefined,
      budget: leagueState.defaultBudget || DEFAULT_BUDGET,
      spent: 0,
      avatarUrl: req.body.avatarUrl ? String(req.body.avatarUrl).trim() : undefined,
      authProvider: 'gmail',
      passwordHash: await hashPassword(initialPassword),
      createdAt: Date.now()
    };
    leagueState.users.push(user);

    leagueState.squads[user.id] = {
      userId: user.id,
      formationId: '4-3-3',
      starterSlots: {},
      benchPlayerIds: []
    };

    saveState();
    broadcastState();
    syncUserToFirestore(user);
    syncSquadToFirestore(leagueState.squads[user.id]);

    const token = createSessionToken(user);
    setSessionCookie(res, token);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
      isNew: true,
      message: 'Conta criada e conectada com sucesso!'
    });
  });

  // 2d. Auth: Current User Session Check (/api/auth/me)
  app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
      return;
    }
    res.json({ success: true, user: sanitizeUser(req.user) });
  });

  // 2e. Auth: Logout
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('khedira_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  });

  // 2f. Auth: Reset / Recover password
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const emailVal = validateEmail(req.body.email);
    if (!emailVal.valid) {
      res.status(400).json({ success: false, error: emailVal.error });
      return;
    }
    const cleanEmail = emailVal.email!;

    if (cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === PEREIRA_EMAIL.toLowerCase()) {
      res.status(403).json({ success: false, error: 'Contas da Presidência e Diretoria possuem segurança administrativa restrita.' });
      return;
    }

    const passVal = validatePassword(req.body.newPassword);
    if (!passVal.valid) {
      res.status(400).json({ success: false, error: passVal.error });
      return;
    }

    const user = leagueState.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      res.status(404).json({ success: false, error: 'Nenhuma conta cadastrada com este email.' });
      return;
    }

    user.passwordHash = await hashPassword(passVal.password!);
    delete user.password;

    saveState();
    broadcastState();
    syncUserToFirestore(user);

    res.json({ success: true, message: 'Senha atualizada com sucesso! Você já pode entrar com a nova senha.' });
  });

  // 2g. Auth: Update profile info (RLS Enforcement: User can only update own profile unless ADMIN)
  app.post('/api/auth/update-profile', authenticate, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { userId, name, teamName, password } = req.body;
    const targetUserId = userId || req.user!.id;

    // RLS check
    if (!checkRLSOwnership(req.user!.id, targetUserId, req.user!.role)) {
      res.status(403).json({ success: false, error: 'Violação de RLS: você só pode alterar o perfil da sua própria conta.' });
      return;
    }

    const user = leagueState.users.find((u) => u.id === targetUserId);
    if (!user) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    if (name && typeof name === 'string' && name.trim()) {
      const nameVal = validateString(name, 'Nome do treinador', 2, 50);
      if (nameVal.valid) {
        user.name = nameVal.value!;
      } else {
        res.status(400).json({ success: false, error: nameVal.error });
        return;
      }
    }
    if (teamName && typeof teamName === 'string' && teamName.trim()) {
      const teamVal = validateString(teamName, 'Nome do clube', 2, 50);
      if (teamVal.valid) {
        user.teamName = teamVal.value!;

        // Propaga o novo nome do clube nos atletas comprados por ele
        leagueState.players.forEach((p) => {
          if (p.soldTo && p.soldTo.userId === user.id) {
            p.soldTo.teamName = user.teamName;
          }
          if (p.bidHistory) {
            p.bidHistory.forEach((b) => {
              if (b.userId === user.id) {
                b.teamName = user.teamName;
              }
            });
          }
        });

        // Propaga na disputa ativa de leilão
        if (leagueState.auction.currentBid && leagueState.auction.currentBid.userId === user.id) {
          leagueState.auction.currentBid.teamName = user.teamName;
        }
        if (leagueState.auction.bidHistory) {
          leagueState.auction.bidHistory.forEach((b) => {
            if (b.userId === user.id) {
              b.teamName = user.teamName;
            }
          });
        }
      } else {
        res.status(400).json({ success: false, error: teamVal.error });
        return;
      }
    }
    if (password && typeof password === 'string' && password.trim()) {
      const passVal = validatePassword(password);
      if (!passVal.valid) {
        res.status(400).json({ success: false, error: passVal.error });
        return;
      }
      user.passwordHash = await hashPassword(passVal.password!);
      delete user.password;
    }

    saveState();
    broadcastState();
    syncUserToFirestore(user);

    res.json({ success: true, user: sanitizeUser(user), message: 'Perfil e nome do clube atualizados com sucesso!' });
  });

  // 2h. Safe File Upload Endpoint (MIME validation, magic numbers check, size limit)
  app.post('/api/upload', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { dataBase64, mimeType } = req.body;
    if (!dataBase64 || !mimeType) {
      res.status(400).json({ success: false, error: 'Dados da imagem ausentes.' });
      return;
    }

    const cleanBase64 = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const validation = validateUploadBuffer(buffer, String(mimeType));
    if (!validation.valid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    const fileName = `upload-${req.user!.id}-${Date.now()}.${validation.ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    res.json({ success: true, url: `/api/uploads/${fileName}` });
  });

  // Safe static file serving for uploads (Prevents directory traversal)
  app.get('/api/uploads/:filename', (req: Request, res: Response) => {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeFilename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Arquivo não encontrado.' });
      return;
    }
    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  });

  // 3. Nominate / Post player for auction (Todos os usuários podem postar jogadores de interesse)
  app.post('/api/auction/nominate', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { playerId } = req.body;

    // Check if the overall auction is started by the admin
    if (leagueState.auction.status === 'NOT_STARTED') {
      res.status(400).json({ 
        success: false, 
        error: 'O leilão oficial ainda não foi aberto pela Diretoria. Aguarde a abertura oficial para fazer propostas!' 
      });
      return;
    }

    if (leagueState.auction.status === 'ENDED') {
      res.status(400).json({ 
        success: false, 
        error: 'O leilão da liga foi encerrado pelo administrador.' 
      });
      return;
    }

    const player = leagueState.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado na lista oficial de jogadores registrados da Khedira League.' });
      return;
    }

    const userPlayersCount = leagueState.players.filter(
      (p) => p.status === 'SOLD' && p.soldTo?.userId === user.id
    ).length;
    if (userPlayersCount >= MAX_SQUAD_PLAYERS) {
      res.status(400).json({
        success: false,
        error: `Seu clube já atingiu o limite regulamentar de ${MAX_SQUAD_PLAYERS} jogadores no elenco! Não é permitido postar novos jogadores para compra.`
      });
      return;
    }

    if (player.status === 'SOLD') {
      res.status(400).json({ success: false, error: 'Este jogador já foi arrematado por um clube da liga!' });
      return;
    }

    if (player.status === 'IN_AUCTION' || leagueState.auction.currentPlayer?.id === player.id) {
      res.status(400).json({ success: false, error: 'Este jogador já está no leilão ao vivo com propostas abertas de 1 hora e 30 minutos!' });
      return;
    }

    // Validação de Modalidade: Se estiver no Leilão por Fases, confere se o jogador pertence à fase ativa
    if (leagueState.auction.auctionType === 'PHASED') {
      const currentPhase = (leagueState.auction.currentPhase || 'GOLEIROS') as AuctionPhase;
      const phasePositions: Record<AuctionPhase, string[]> = {
        GOLEIROS: ['GOL'],
        DEFENSORES: ['ZAG', 'LE', 'LD'],
        MEIO_CAMPO: ['VOL', 'MC', 'MEI'],
        ATACANTES: ['ATA', 'PE', 'PD', 'SA']
      };
      const allowedPositions = phasePositions[currentPhase] || [];
      if (!allowedPositions.includes(player.position)) {
        const phaseLabels: Record<AuctionPhase, string> = {
          GOLEIROS: '1ª Fase: GOLEIROS (GOL)',
          DEFENSORES: '2ª Fase: DEFENSORES (Zagueiros e Laterais)',
          MEIO_CAMPO: '3ª Fase: MEIO-CAMPO (Volantes e Meias)',
          ATACANTES: '4ª Fase: ATACANTES (Centroavantes e Pontas)'
        };
        res.status(400).json({ 
          success: false, 
          error: `O leilão está na ${phaseLabels[currentPhase]}. O jogador ${player.name} (${player.position}) só poderá ser postado quando a fase correspondente for aberta pela Diretoria.` 
        });
        return;
      }
    }

    // Se leilão está em andamento (ACTIVE ou IDLE), abre imediatamente a rodada simultânea de 1h30m para o atleta
    const openingAmount = req.body.amount ? Number(req.body.amount) : player.initialPrice;
    if (user.budget < openingAmount) {
      res.status(400).json({ 
        success: false, 
        error: `Saldo insuficiente para abrir proposta inicial de € ${(openingAmount / 1000000).toFixed(1)}M!` 
      });
      return;
    }

    let currentlyCommitted = 0;
    leagueState.players.forEach((pl) => {
      if (pl.status === 'IN_AUCTION') {
        const topBid = pl.currentBid;
        if (topBid && topBid.userId === user.id) {
          currentlyCommitted += topBid.amount;
        }
      }
    });

    const availableBudget = user.budget - currentlyCommitted;
    if (openingAmount > availableBudget) {
      res.status(400).json({ 
        success: false, 
        error: `Saldo disponível insuficiente! Você possui € ${(user.budget / 1000000).toFixed(1)}M em conta, porém € ${(currentlyCommitted / 1000000).toFixed(1)}M já está retido em outras propostas ativas. Seu saldo disponível é de € ${(availableBudget / 1000000).toFixed(1)}M.` 
      });
      return;
    }

    const isAnonymous = leagueState.auction.anonymousBidding !== false;
    const newBid: Bid = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      userId: user.id,
      userName: user.name,
      teamName: user.teamName,
      userEmail: user.email,
      amount: openingAmount,
      timestamp: Date.now(),
      isAnonymous
    };

    const isAuctionAlreadyActive = leagueState.auction.status === 'ACTIVE' && leagueState.auction.timerRemaining > 0;
    const officialTimer = isAuctionAlreadyActive
      ? leagueState.auction.timerRemaining
      : getAuctionDuration();

    player.status = 'IN_AUCTION';
    player.nominatedBy = user.id;
    player.currentBid = newBid;
    if (!player.bidHistory) player.bidHistory = [];
    player.bidHistory.unshift(newBid);
    player.currentPrice = openingAmount;

    // Regra 1: O tempo de leilão do jogador DEVE ACOMPANHAR O CRONÔMETRO OFICIAL DO LEILÃO DEFINIDO PELO ADMINISTRADOR
    player.timerRemaining = officialTimer;

    // Regra 2: Caso o leilão esteja nos últimos segundos (<= 60s), dá-se acréscimo de 60 segundos somente para este jogador
    let receivedOvertime = false;
    if (player.timerRemaining <= 60) {
      player.timerRemaining += 60;
      receivedOvertime = true;
    }
    player.auctionExpiresAt = Date.now() + player.timerRemaining * 1000;

    leagueState.auction.status = 'ACTIVE';
    leagueState.auction.currentPlayer = player;
    leagueState.auction.currentBid = newBid;
    if (!leagueState.auction.bidHistory) leagueState.auction.bidHistory = [];
    leagueState.auction.bidHistory.unshift(newBid);
    if (!isAuctionAlreadyActive) {
      leagueState.auction.timerRemaining = officialTimer;
    }
    leagueState.auction.lastUpdated = Date.now();

    saveState();

    broadcast({
      type: 'AUCTION_STARTED',
      data: {
        player: {
          ...player,
          currentBid: sanitizeBid(player.currentBid, isAnonymous),
          bidHistory: (player.bidHistory || []).map((b) => sanitizeBid(b, isAnonymous))
        },
        bid: sanitizeBid(newBid, isAnonymous),
        auction: {
          ...leagueState.auction,
          currentBid: sanitizeBid(leagueState.auction.currentBid, isAnonymous),
          bidHistory: (leagueState.auction.bidHistory || []).map((b) => sanitizeBid(b, isAnonymous))
        }
      }
    });

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📢 Proposta aberta por ${player.name} (${player.position}) no valor de € ${(openingAmount / 1000000).toFixed(1)}M (${isAnonymous ? '*****' : user.teamName})! Disputa ativa por 1 hora e 30 minutos.`,
        timestamp: Date.now(),
        type: 'info'
      }
    });

    broadcastState();
    res.json({ success: true, queued: false, player, bid: newBid, auction: leagueState.auction });
  });

  // Remover jogador da fila de interesse
  app.post('/api/auction/queue/remove', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { playerId } = req.body;

    if (!leagueState.auction.nominationQueue) {
      leagueState.auction.nominationQueue = [];
    }

    const itemIndex = leagueState.auction.nominationQueue.findIndex((q) => q.player.id === playerId);
    if (itemIndex === -1) {
      res.status(404).json({ success: false, error: 'Jogador não está na fila' });
      return;
    }

    const item = leagueState.auction.nominationQueue[itemIndex];
    if (!checkRLSOwnership(user.id, item.nominatedByUserId, user.role)) {
      res.status(403).json({ success: false, error: 'Violação de RLS: apenas quem postou ou o administrador pode remover da fila.' });
      return;
    }

    leagueState.auction.nominationQueue.splice(itemIndex, 1);
    saveState();
    broadcastState();
    res.json({ success: true, auction: leagueState.auction });
  });

  // Forçar início de jogador da fila (Admin ou quando IDLE)
  app.post('/api/auction/queue/start-now', authenticate, requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const { playerId } = _req.body;

    if (!leagueState.auction.nominationQueue) {
      leagueState.auction.nominationQueue = [];
    }

    const itemIndex = leagueState.auction.nominationQueue.findIndex((q) => q.player.id === playerId);
    if (itemIndex === -1) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado na fila' });
      return;
    }

    const [item] = leagueState.auction.nominationQueue.splice(itemIndex, 1);
    const targetPlayer = leagueState.players.find((p) => p.id === item.player.id);
    if (!targetPlayer || targetPlayer.status !== 'AVAILABLE') {
      res.status(400).json({ success: false, error: 'Jogador indisponível' });
      return;
    }

    // Se já houver alguém ativo, finaliza sem vencedor ou substitui
    if (leagueState.auction.currentPlayer) {
      const prev = leagueState.players.find((p) => p.id === leagueState.auction.currentPlayer?.id);
      if (prev && prev.status === 'IN_AUCTION') {
        prev.status = 'AVAILABLE';
      }
    }

    const isAuctionAlreadyActive = leagueState.auction.status === 'ACTIVE' && leagueState.auction.timerRemaining > 0;
    const officialTimer = isAuctionAlreadyActive
      ? leagueState.auction.timerRemaining
      : getAuctionDuration();

    targetPlayer.status = 'IN_AUCTION';
    targetPlayer.nominatedBy = item.nominatedByUserId;
    targetPlayer.timerRemaining = officialTimer;
    if (targetPlayer.timerRemaining <= 60) {
      targetPlayer.timerRemaining += 60;
    }
    targetPlayer.auctionExpiresAt = Date.now() + targetPlayer.timerRemaining * 1000;

    leagueState.auction.status = 'ACTIVE';
    leagueState.auction.currentPlayer = targetPlayer;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    if (!isAuctionAlreadyActive) {
      leagueState.auction.timerRemaining = officialTimer;
    }
    leagueState.auction.lastUpdated = Date.now();

    saveState();
    broadcastState();
    broadcast({
      type: 'AUCTION_STARTED',
      data: {
        player: targetPlayer,
        auction: leagueState.auction
      }
    });

    res.json({ success: true, auction: leagueState.auction });
  });

  // 4. Place a bid (supports simultaneous players)
  app.post('/api/auction/bid', bidLimiter, authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { amount, playerId } = req.body;

    if (leagueState.auction.status === 'NOT_STARTED') {
      res.status(400).json({ 
        success: false, 
        error: 'Leilão ainda não iniciado, participantes se preparem para logo em breve darmos início ao leilão' 
      });
      return;
    }

    if (leagueState.auction.status === 'ENDED') {
      res.status(400).json({ success: false, error: 'O leilão da liga foi encerrado.' });
      return;
    }

    // Identify target player: either specified playerId or fallback to currentPlayer
    const targetPlayerId = playerId || leagueState.auction.currentPlayer?.id;
    if (!targetPlayerId) {
      res.status(400).json({ success: false, error: 'Nenhum atleta selecionado para proposta.' });
      return;
    }

    const player = leagueState.players.find((p) => p.id === targetPlayerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado no catálogo oficial.' });
      return;
    }

    if (player.status === 'SOLD') {
      res.status(400).json({ success: false, error: 'Este jogador já foi arrematado.' });
      return;
    }

    // Regulamento Oficial: Sem divisão de fases (ATAQUE, MEIO e DEFESA juntos)
    leagueState.auction.auctionDay = 'ALL';

    // Calculate true current highest bid strictly for this player
    const existingTopBid = getHighestBidForPlayer(player);
    let currentHighest = existingTopBid?.amount || 0;
    if (player.currentPrice && player.currentPrice > currentHighest) {
      currentHighest = player.currentPrice;
    }

    const minRequired = currentHighest > 0
      ? currentHighest + (leagueState.auction.minimumBidIncrement || 1000000)
      : player.initialPrice;

    const bidAmount = Number(amount);
    if (isNaN(bidAmount) || bidAmount < minRequired) {
      res.status(400).json({
        success: false,
        error: `O lance mínimo para ${player.name} deve ser de € ${(minRequired / 1000000).toFixed(1)}M`
      });
      return;
    }

    if (user.budget < bidAmount) {
      res.status(400).json({
        success: false,
        error: `Saldo insuficiente! Seu saldo total em conta é de € ${(user.budget / 1000000).toFixed(1)}M`
      });
      return;
    }

    // Calcular montante atualmente retido em lances ativos do usuário em outros jogadores
    let currentlyCommittedOtherPlayers = 0;
    leagueState.players.forEach((pl) => {
      if (pl.status === 'IN_AUCTION' && pl.id !== player.id) {
        const topBid = pl.currentBid;
        if (topBid && topBid.userId === user.id) {
          currentlyCommittedOtherPlayers += topBid.amount;
        }
      }
    });

    const availableBudget = user.budget - currentlyCommittedOtherPlayers;
    if (bidAmount > availableBudget) {
      res.status(400).json({
        success: false,
        error: `Saldo disponível insuficiente! Você possui € ${(user.budget / 1000000).toFixed(1)}M em conta, porém € ${(currentlyCommittedOtherPlayers / 1000000).toFixed(1)}M está retido em outras propostas ativas. Seu saldo disponível para este lance é de € ${(availableBudget / 1000000).toFixed(1)}M. Caso sua oferta em outro atleta seja coberta, o valor volta imediatamente para sua conta.`
      });
      return;
    }

    // Validar limite de elenco: máximo de 23 jogadores por clube
    const userPlayersCount = leagueState.players.filter(
      (p) => p.status === 'SOLD' && p.soldTo?.userId === user.id
    ).length;
    if (userPlayersCount >= MAX_SQUAD_PLAYERS) {
      res.status(400).json({
        success: false,
        error: `Limite de elenco atingido! Seu clube já possui o teto máximo de ${MAX_SQUAD_PLAYERS} jogadores permitidos pelo regulamento.`
      });
      return;
    }

    const isRaisingOwnBid = Boolean(player.currentBid && player.currentBid.userId === user.id);
    const isAnonymous = leagueState.auction.anonymousBidding !== false;

    const newBid: Bid = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      userId: user.id,
      userName: user.name,
      teamName: user.teamName,
      userEmail: user.email,
      amount: bidAmount,
      timestamp: Date.now(),
      isAnonymous
    };

    // Update player's own independent auction state
    player.status = 'IN_AUCTION';
    player.currentBid = newBid;
    if (!player.bidHistory) player.bidHistory = [];
    player.bidHistory.unshift(newBid);
    player.currentPrice = bidAmount;

    // Regra 1: O tempo de leilão do jogador DEVE ACOMPANHAR O CRONÔMETRO OFICIAL DO LEILÃO DEFINIDO PELO ADMINISTRADOR
    const officialTimer = (leagueState.auction.status === 'ACTIVE' && leagueState.auction.timerRemaining > 0)
      ? leagueState.auction.timerRemaining
      : (leagueState.auction.defaultDurationSeconds || getAuctionDuration());

    if (!player.timerRemaining || player.timerRemaining <= 0) {
      player.timerRemaining = officialTimer;
    }

    // Regra 2: Caso o usuário faça uma oferta em um jogador e no cronômetro oficial (ou no cronômetro do jogador)
    // estiver nos últimos segundos (<= 60s), concede-se um acréscimo de 60 segundos SOMENTE para aquele leilão específico
    let receivedOvertime = false;
    const isUnderLastSeconds = player.timerRemaining <= 60 || officialTimer <= 60;
    if (isUnderLastSeconds) {
      player.timerRemaining += 60;
      receivedOvertime = true;
    }
    player.auctionExpiresAt = Date.now() + (player.timerRemaining * 1000);

    // Keep global auction status ACTIVE
    leagueState.auction.status = 'ACTIVE';
    leagueState.auction.currentPlayer = player;
    leagueState.auction.currentBid = newBid;
    if (!leagueState.auction.bidHistory) leagueState.auction.bidHistory = [];
    leagueState.auction.bidHistory.unshift(newBid);
    leagueState.auction.lastUpdated = Date.now();

    saveState();

    broadcast({
      type: 'NEW_BID',
      data: {
        bid: sanitizeBid(newBid, isAnonymous),
        player: {
          ...player,
          currentBid: sanitizeBid(player.currentBid, isAnonymous),
          bidHistory: (player.bidHistory || []).map((b) => sanitizeBid(b, isAnonymous))
        },
        auction: {
          ...leagueState.auction,
          currentBid: sanitizeBid(leagueState.auction.currentBid, isAnonymous),
          bidHistory: (leagueState.auction.bidHistory || []).map((b) => sanitizeBid(b, isAnonymous))
        }
      }
    });

    // Conforme a Ata: Sigilo de lances
    const actionText = isRaisingOwnBid ? 'aumentou a proposta' : 'cobriu a proposta';
    const bidNotification = isAnonymous
      ? `💰 Proposta de ***** por ${player.name} atualizada para € ${(bidAmount / 1000000).toFixed(1)}M!`
      : `💰 ${user.name} (${user.teamName}) ${actionText} por ${player.name} para € ${(bidAmount / 1000000).toFixed(1)}M!`;

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: bidNotification,
        timestamp: Date.now(),
        type: 'bid'
      }
    });

    if (receivedOvertime) {
      const minsRem = Math.floor(player.timerRemaining / 60);
      const secsRem = player.timerRemaining % 60;
      const formattedRem = minsRem > 0 ? `${minsRem}m${secsRem > 0 ? ` ${secsRem}s` : ''}` : `${secsRem}s`;
      broadcast({
        type: 'CHAT_NOTIFICATION',
        data: {
          message: `⏱️ Acréscimo de +60s! Proposta recebida na reta final por ${player.name}. Tempo restante apenas deste atleta estendido para ${formattedRem} para disputa justa!`,
          timestamp: Date.now(),
          type: 'alert'
        }
      });
    }

    broadcastState();
    res.json({ success: true, bid: newBid, player, auction: leagueState.auction, receivedOvertime });
  });

  // 5. Pass nomination turn
  app.post('/api/auction/pass-turn', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;

    if (leagueState.auction.status === 'NOT_STARTED') {
      res.status(400).json({ 
        success: false, 
        error: 'Leilão ainda não iniciado, participantes se preparem para logo em breve darmos inicio ao leilão' 
      });
      return;
    }

    if (leagueState.auction.status === 'ENDED') {
      res.status(400).json({ 
        success: false, 
        error: 'O leilão da liga foi encerrado pelo administrador.' 
      });
      return;
    }

    const isUserTurn = leagueState.auction.nominationTurnUserId === user.id;
    const isAdmin = user.role === 'ADMIN';
    const isFreeMode = leagueState.auction.isFreeNominationMode;

    if (!isUserTurn && !isAdmin && !isFreeMode) {
      res.status(403).json({ success: false, error: 'Não é sua vez de passar o turno!' });
      return;
    }

    advanceNominationTurn();

    const nextUser = leagueState.users.find(
      (u) => u.id === leagueState.auction.nominationTurnUserId
    );

    let message = 'Vez de anunciar passada com sucesso!';
    if (leagueState.users.length <= 1) {
      message = 'Você é o único participante no momento. Cronômetro de 45s reiniciado.';
    } else if (nextUser) {
      message = `Vez de anunciar passada para ${nextUser.name} (${nextUser.teamName})!`;
    }

    res.json({ 
      success: true, 
      nextTurnUserId: leagueState.auction.nominationTurnUserId,
      nextUserName: nextUser?.name,
      message 
    });
  });

  // 6. Save User Squad (Formation, Starters, Bench - With RLS verification)
  app.post('/api/squad/save', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { userId, formationId, starterSlots, benchPlayerIds } = req.body;
    const targetUserId = userId || req.user!.id;

    // RLS check: only owner of squad or admin can modify
    if (!checkRLSOwnership(req.user!.id, targetUserId, req.user!.role)) {
      res.status(403).json({ success: false, error: 'Violação de RLS: você só tem permissão para salvar o elenco do seu próprio clube.' });
      return;
    }

    // Garantir limite de 23 jogadores no elenco (11 titulares + até 12 reservas)
    const validStarters = Object.values(starterSlots || {}).filter(Boolean) as string[];
    const validBench = (benchPlayerIds || []) as string[];
    const allSelectedUnique = Array.from(new Set([...validStarters, ...validBench]));
    if (allSelectedUnique.length > MAX_SQUAD_PLAYERS) {
      res.status(400).json({
        success: false,
        error: `O limite de jogadores por time é de ${MAX_SQUAD_PLAYERS} atletas (11 titulares + até 12 reservas).`
      });
      return;
    }

    // Quando o leilão for finalizado (ENDED), o elenco conceito é resetado e apenas os jogadores conquistados no leilão podem compor o elenco oficial
    let finalStarters = starterSlots || {};
    let finalBench = benchPlayerIds || [];

    if (leagueState.auction.status === 'ENDED') {
      const wonPlayerIds = leagueState.players
        .filter((p) => p.status === 'SOLD' && p.soldTo?.userId === targetUserId)
        .map((p) => p.id);

      const cleanedStarters: { [slotId: string]: string | null } = {};
      Object.entries(finalStarters).forEach(([slotId, pid]) => {
        cleanedStarters[slotId] = pid && wonPlayerIds.includes(pid as string) ? (pid as string) : null;
      });
      finalStarters = cleanedStarters;
      finalBench = (finalBench as string[]).filter((pid: string) => wonPlayerIds.includes(pid));
    }

    leagueState.squads[targetUserId] = {
      userId: targetUserId,
      formationId: formationId || '4-3-3',
      starterSlots: finalStarters,
      benchPlayerIds: finalBench
    };

    saveState();
    broadcastState();
    syncSquadToFirestore(leagueState.squads[targetUserId]);
    res.json({ success: true, squad: leagueState.squads[targetUserId] });
  });

  // 5.2. Watchlist (Favoritos do Radar) - Persistência em Nuvem no Cloud Firestore
  app.get('/api/user/watchlist', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
      return;
    }
    const userId = req.user.id;
    try {
      const cloudPlayerIds = await loadWatchlistFromFirestore(userId);
      if (!leagueState.watchlists) leagueState.watchlists = {};
      const localList = leagueState.watchlists[userId] || [];
      const merged = Array.from(new Set([...(cloudPlayerIds || []), ...localList]));
      leagueState.watchlists[userId] = merged;
      res.json({ success: true, playerIds: merged });
    } catch (err) {
      console.warn('[Firebase] Fallback local para watchlist do usuário', userId, err);
      const fallbackList = leagueState.watchlists?.[userId] || [];
      res.json({ success: true, playerIds: fallbackList });
    }
  });

  app.post('/api/user/watchlist', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
      return;
    }
    const userId = req.user.id;
    const { playerIds } = req.body;
    if (!Array.isArray(playerIds)) {
      res.status(400).json({ success: false, error: 'playerIds deve ser uma lista de IDs.' });
      return;
    }
    try {
      if (!leagueState.watchlists) leagueState.watchlists = {};
      leagueState.watchlists[userId] = playerIds;
      saveState();
      syncWatchlistToFirestore(userId, playerIds).catch((err) => {
        console.warn('[Firebase] Erro ao sincronizar watchlist em segundo plano:', err);
      });
      res.json({ success: true, playerIds });
    } catch (err) {
      console.error('[Firebase] Erro ao salvar watchlist:', err);
      res.status(500).json({ success: false, error: 'Erro ao persistir lista de favoritos.' });
    }
  });

  // ADMIN ENDPOINTS

  // 6.1. Adicionar Jogador Extra (Não Cadastrado) - Conforme Seção 2 da Ata Oficial
  app.post('/api/players/add-extra', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { name, position, club, nationality, initialPrice } = req.body;

    // Regra Oficial: Permitido somente quando o leilão estiver fechado ou pausado
    if (leagueState.auction.status === 'ACTIVE') {
      res.status(400).json({
        success: false,
        error: 'A inclusão de jogadores extras fora da base é permitida somente quando o leilão estiver fechado ou pausado. Durante o leilão ativo, não é permitido adicionar jogadores.'
      });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Nome do jogador é obrigatório.' });
      return;
    }
    const cleanName = name.trim();

    // Evitar duplicação por nome
    const alreadyExists = leagueState.players.some(
      (p) => p.name.toLowerCase().trim() === cleanName.toLowerCase()
    );
    if (alreadyExists) {
      res.status(400).json({
        success: false,
        error: `O atleta "${cleanName}" já existe na lista de jogadores da Khedira League!`
      });
      return;
    }

    let pos = (position && String(position).trim().toUpperCase()) || 'ATA';
    if (pos === 'MD') pos = 'PD';
    if (pos === 'ME') pos = 'PE';

    // Lance Mínimo Obrigatório: € 10.000.000 (€ 10M) para qualquer jogador extra
    const MIN_EXTRA_PRICE = 10000000;
    let price = Number(initialPrice);
    if (isNaN(price) || price < MIN_EXTRA_PRICE) {
      price = MIN_EXTRA_PRICE;
    }

    const newPlayer: Player = {
      id: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      position: pos as PlayerPosition,
      club: (club && club.trim()) || 'Livre no Mercado',
      nationality: (nationality && nationality.trim()) || 'Internacional',
      initialPrice: price,
      currentPrice: price,
      status: 'AVAILABLE',
      isManualExtra: true
    };

    leagueState.players.unshift(newPlayer);
    saveState();

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📝 Jogador fora da base adicionado: ${newPlayer.name} (${newPlayer.position} - ${newPlayer.club}) com lance mínimo obrigatório de € ${(price / 1000000).toFixed(1)}M por ${user.name} (${user.teamName})!`,
        timestamp: Date.now(),
        type: 'info'
      }
    });

    broadcastState();
    res.json({ success: true, player: newPlayer });
  });

  // 6.2. Contratação de Agente Livre (Pós-Leilão / Participação Tardia)
  app.post('/api/auction/sign-free-agent', authenticate, requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { playerId } = req.body;

    if (leagueState.auction.status !== 'ENDED') {
      res.status(400).json({
        success: false,
        error: 'A contratação direta de Agentes Livres (jogadores que ninguém arrematou) fica liberada após o encerramento oficial do leilão da liga.'
      });
      return;
    }

    if (!playerId) {
      res.status(400).json({ success: false, error: 'Identificador do jogador ausente.' });
      return;
    }

    const player = leagueState.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado no catálogo.' });
      return;
    }

    // Não pode comprar jogador já vinculado a outro clube
    if (player.status === 'SOLD' || player.soldTo) {
      res.status(400).json({
        success: false,
        error: `Este jogador já está vinculado ao clube ${player.soldTo?.teamName || 'outro clube'} e não pode ser adquirido!`
      });
      return;
    }

    if (player.status !== 'AVAILABLE') {
      res.status(400).json({
        success: false,
        error: 'Este jogador não está disponível como Agente Livre.'
      });
      return;
    }

    // Limite de 23 jogadores por clube
    const userWonPlayersCount = leagueState.players.filter(
      (p) => p.status === 'SOLD' && p.soldTo?.userId === user.id
    ).length;

    if (userWonPlayersCount >= MAX_SQUAD_PLAYERS) {
      res.status(400).json({
        success: false,
        error: `Seu clube já atingiu o teto máximo regulamentar de exatamente ${MAX_SQUAD_PLAYERS} jogadores contratados!`
      });
      return;
    }

    // Custo de aquisição do agente livre (valor inicial / base)
    const cost = player.currentPrice || player.initialPrice;
    if (user.budget < cost) {
      res.status(400).json({
        success: false,
        error: `Saldo insuficiente para contratar ${player.name}! Custo: € ${(cost / 1000000).toFixed(1)}M. Saldo em conta: € ${(user.budget / 1000000).toFixed(1)}M.`
      });
      return;
    }

    // Deduz do orçamento e transfere vínculo oficial para o clube
    user.budget = Math.max(0, user.budget - cost);
    user.spent = (user.spent || 0) + cost;

    player.status = 'SOLD';
    player.currentPrice = cost;
    player.timerRemaining = 0;
    player.auctionExpiresAt = undefined;
    player.currentBid = null;
    player.soldTo = {
      userId: user.id,
      userName: user.name,
      teamName: user.teamName,
      amount: cost,
      auctionDay: 'ALL',
      soldAt: Date.now()
    };

    if (!leagueState.squads[user.id]) {
      leagueState.squads[user.id] = {
        userId: user.id,
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      };
    }
    const squad = leagueState.squads[user.id];
    if (!squad.benchPlayerIds.includes(player.id)) {
      squad.benchPlayerIds.push(player.id);
    }

    saveState();

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `✍️ CONTRATAÇÃO DE AGENTE LIVRE! ${player.name} (${player.position}) foi contratado pelo ${user.teamName} (${user.name}) pelo valor de € ${(cost / 1000000).toFixed(1)}M!`,
        timestamp: Date.now(),
        type: 'hammer'
      }
    });

    broadcastState();
    res.json({ success: true, player, user: sanitizeUser(user) });
  });

  // 7. Admin: Player operations
  app.post('/api/admin/player/create', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { name, position, club, nationality, initialPrice } = req.body;
    if (!name || !position || !club || !initialPrice) {
      res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
      return;
    }

    const newPlayer: Player = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      position,
      club: club.trim(),
      nationality: nationality?.trim() || 'Internacional',
      initialPrice: Number(initialPrice),
      currentPrice: Number(initialPrice),
      status: 'AVAILABLE'
    };

    leagueState.players.unshift(newPlayer);
    saveState();
    broadcastState();
    res.json({ success: true, player: newPlayer });
  });

  app.post('/api/admin/player/update-price', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerId, initialPrice } = req.body;
    const player = leagueState.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado' });
      return;
    }

    player.initialPrice = Number(initialPrice);
    if (player.status === 'AVAILABLE') {
      player.currentPrice = Number(initialPrice);
    }
    saveState();
    broadcastState();
    res.json({ success: true, player });
  });

  // Admin: corrigir dados cadastrais do jogador (nome, posição, clube, nacionalidade)
  app.post('/api/admin/player/update', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerId, name, position, club, nationality } = req.body;

    const player = leagueState.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado' });
      return;
    }

    const nameCheck = validateString(name, 'Nome do jogador', 2, 100);
    if (!nameCheck.valid) {
      res.status(400).json({ success: false, error: nameCheck.error });
      return;
    }
    const positionCheck = validatePosition(position);
    if (!positionCheck.valid) {
      res.status(400).json({ success: false, error: positionCheck.error });
      return;
    }
    const clubCheck = validateString(club, 'Clube', 1, 100);
    if (!clubCheck.valid) {
      res.status(400).json({ success: false, error: clubCheck.error });
      return;
    }

    player.name = nameCheck.value!;
    let normPos = positionCheck.position as string;
    if (normPos === 'MD') normPos = 'PD';
    if (normPos === 'ME') normPos = 'PE';
    player.position = normPos as PlayerPosition;
    player.club = clubCheck.value!;
    if (nationality) {
      const nationalityCheck = validateString(nationality, 'Nacionalidade', 1, 100);
      if (nationalityCheck.valid) {
        player.nationality = nationalityCheck.value!;
      }
    }

    // Mantém o nome do jogador sincronizado no histórico de lances já registrados
    if (player.currentBid) player.currentBid.playerName = player.name;
    (player.bidHistory || []).forEach((b) => { b.playerName = player.name; });

    saveState();
    broadcastState();
    res.json({ success: true, player });
  });

  app.post('/api/admin/player/delete', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerId } = req.body;
    leagueState.players = leagueState.players.filter((p) => p.id !== playerId);
    saveState();
    broadcastState();
    res.json({ success: true });
  });

  // Admin: Assign player directly to a club/user
  app.post('/api/admin/player/assign', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerId, userId, amount } = req.body;
    const player = leagueState.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado' });
      return;
    }
    const targetUser = leagueState.users.find((u) => u.id === userId);
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'Usuário/Clube de destino não encontrado' });
      return;
    }

    // If previously owned by someone else, refund previous owner
    if (player.soldTo && player.soldTo.userId !== targetUser.id) {
      const prevOwner = leagueState.users.find((u) => u.id === player.soldTo?.userId);
      if (prevOwner) {
        prevOwner.budget += player.soldTo.amount;
        prevOwner.spent = Math.max(0, prevOwner.spent - player.soldTo.amount);
      }
      if (leagueState.squads[player.soldTo.userId]) {
        const sq = leagueState.squads[player.soldTo.userId];
        sq.benchPlayerIds = sq.benchPlayerIds.filter((id) => id !== player.id);
        Object.keys(sq.starterSlots).forEach((slot) => {
          if (sq.starterSlots[slot] === player.id) sq.starterSlots[slot] = null;
        });
      }
    }

    const price = typeof amount === 'number' && amount >= 0 ? amount : (player.currentPrice || player.initialPrice);
    if (player.soldTo?.userId !== targetUser.id) {
      targetUser.budget = Math.max(0, targetUser.budget - price);
      targetUser.spent = (targetUser.spent || 0) + price;
    }

    player.status = 'SOLD';
    player.currentPrice = price;
    player.timerRemaining = 0;
    player.auctionExpiresAt = undefined;
    player.currentBid = null;
    player.soldTo = {
      userId: targetUser.id,
      userName: targetUser.name,
      teamName: targetUser.teamName,
      amount: price,
      auctionDay: 'ALL',
      soldAt: Date.now()
    };

    if (!leagueState.squads[targetUser.id]) {
      leagueState.squads[targetUser.id] = {
        userId: targetUser.id,
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      };
    }
    const squad = leagueState.squads[targetUser.id];
    if (!squad.benchPlayerIds.includes(player.id)) {
      squad.benchPlayerIds.push(player.id);
    }

    // Remove from nominationQueue if present
    if (leagueState.auction?.nominationQueue) {
      leagueState.auction.nominationQueue = leagueState.auction.nominationQueue.filter((q) => q.player.id !== player.id);
    }

    saveState();
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📋 ATRIBUIÇÃO OFICIAL: ${player.name} (${player.position}) foi adicionado ao time ${targetUser.teamName} (${targetUser.name}) por € ${(price / 1000000).toFixed(1)}M!`,
        timestamp: Date.now(),
        type: 'hammer'
      }
    });
    broadcastState();
    res.json({ success: true, player, user: sanitizeUser(targetUser) });
  });

  // Admin: Return player to market (release from club)
  app.post('/api/admin/player/release-to-market', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerId } = req.body;
    const player = leagueState.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(404).json({ success: false, error: 'Jogador não encontrado' });
      return;
    }

    if (player.soldTo) {
      const prevOwner = leagueState.users.find((u) => u.id === player.soldTo?.userId);
      if (prevOwner) {
        prevOwner.budget += player.soldTo.amount;
        prevOwner.spent = Math.max(0, prevOwner.spent - player.soldTo.amount);
      }

      // Remove from user's squad
      const ownerSquad = leagueState.squads[player.soldTo.userId];
      if (ownerSquad) {
        Object.keys(ownerSquad.starterSlots).forEach((slotId) => {
          if (ownerSquad.starterSlots[slotId] === playerId) {
            delete ownerSquad.starterSlots[slotId];
          }
        });
        ownerSquad.benchPlayerIds = ownerSquad.benchPlayerIds.filter((id) => id !== playerId);
      }
    }

    player.status = 'AVAILABLE';
    player.currentPrice = player.initialPrice;
    player.soldTo = undefined;
    player.nominatedBy = undefined;

    saveState();
    broadcastState();
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📢 ${player.name} foi devolvido ao mercado de transferências e está disponível para lances!`,
        timestamp: Date.now(),
        type: 'info'
      }
    });

    res.json({ success: true, player });
  });

  // Admin: Return multiple players to market in a single atomic batch
  app.post('/api/admin/player/release-batch', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerIds } = req.body;
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      res.status(400).json({ success: false, error: 'Lista de IDs de jogadores inválida' });
      return;
    }

    const releasedPlayers: Player[] = [];
    for (const playerId of playerIds) {
      const player = leagueState.players.find((p) => p.id === playerId);
      if (!player) continue;

      if (player.soldTo) {
        const prevOwner = leagueState.users.find((u) => u.id === player.soldTo?.userId);
        if (prevOwner) {
          prevOwner.budget += player.soldTo.amount;
          prevOwner.spent = Math.max(0, prevOwner.spent - player.soldTo.amount);
        }

        const ownerSquad = leagueState.squads[player.soldTo.userId];
        if (ownerSquad) {
          Object.keys(ownerSquad.starterSlots).forEach((slotId) => {
            if (ownerSquad.starterSlots[slotId] === playerId) {
              delete ownerSquad.starterSlots[slotId];
            }
          });
          ownerSquad.benchPlayerIds = ownerSquad.benchPlayerIds.filter((id) => id !== playerId);
        }
      }

      player.status = 'AVAILABLE';
      player.currentPrice = player.initialPrice;
      player.soldTo = undefined;
      player.nominatedBy = undefined;
      releasedPlayers.push(player);
    }

    saveState();
    broadcastState();
    if (releasedPlayers.length > 0) {
      broadcast({
        type: 'CHAT_NOTIFICATION',
        data: {
          message: `📢 ${releasedPlayers.length} ${releasedPlayers.length === 1 ? 'jogador foi devolvido' : 'jogadores foram devolvidos'} ao mercado de transferências!`,
          timestamp: Date.now(),
          type: 'info'
        }
      });
    }

    res.json({ success: true, count: releasedPlayers.length, players: releasedPlayers });
  });

  // 8. Admin: User management
  app.post('/api/admin/user/role', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { targetUserId, role } = req.body;
    const target = leagueState.users.find((u) => u.id === targetUserId);
    if (!target) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    const isTargetPereira = target.email.toLowerCase() === PEREIRA_EMAIL.toLowerCase() || target.email.toLowerCase().includes('marquesbrito');
    const isTargetTourinho = target.email.toLowerCase() === TOURINHO_EMAIL.toLowerCase() || target.email.toLowerCase().includes('tourinho');

    if (role === 'ADMIN') {
      target.role = 'ADMIN';
      target.adminTitle = isTargetPereira ? 'Diretor' : isTargetTourinho ? 'Presidente' : (target.adminTitle || 'Diretor');
    } else {
      target.role = 'PARTICIPANT';
      target.adminTitle = undefined;
    }

    saveState();
    broadcastState();
    res.json({ success: true, user: target });
  });

  app.post('/api/admin/user/budget', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    res.status(400).json({
      success: false,
      error: 'Regulamento da Khedira League: O orçamento inicial de € 400.000.000 é fixo e inegociável para todos os clubes. Não são permitidos ajustes manuais nem transferências de saldo.'
    });
  });

  app.post('/api/admin/user/reset', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { targetUserId } = req.body;
    const target = leagueState.users.find((u) => u.id === targetUserId);
    if (!target) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    // Reset user budget and players sold to them
    target.budget = leagueState.defaultBudget;
    target.spent = 0;
    leagueState.players.forEach((p) => {
      if (p.soldTo?.userId === targetUserId) {
        p.status = 'AVAILABLE';
        p.soldTo = undefined;
        p.currentPrice = p.initialPrice;
      }
    });

    leagueState.squads[targetUserId] = {
      userId: targetUserId,
      formationId: '4-3-3',
      starterSlots: {},
      benchPlayerIds: []
    };

    saveState();
    broadcastState();
    res.json({ success: true });
  });

  app.post('/api/admin/user/delete', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { targetUserId } = req.body;
    const target = leagueState.users.find((u) => u.id === targetUserId);
    if (!target) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    if (target.email.toLowerCase() === PEREIRA_EMAIL.toLowerCase() || target.email.toLowerCase() === TOURINHO_EMAIL.toLowerCase()) {
      res.status(400).json({ success: false, error: 'Não é permitido remover os administradores oficiais da Khedira League.' });
      return;
    }

    leagueState.players.forEach((p) => {
      if (p.soldTo?.userId === targetUserId) {
        p.status = 'AVAILABLE';
        p.soldTo = undefined;
        p.currentPrice = p.initialPrice;
      }
    });

    delete leagueState.squads[targetUserId];
    leagueState.users = leagueState.users.filter((u) => u.id !== targetUserId);

    if (leagueState.auction.nominationTurnUserId === targetUserId) {
      leagueState.auction.nominationTurnUserId = 'user-admin-default';
    }

    saveState();
    broadcastState();
    res.json({ success: true });
  });

  // Status da sincronização com o site de produção (Render)
  app.get('/api/production-sync/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      productionUrl: PRODUCTION_ORIGIN,
      wsConnected: isProductionWsConnected,
      lastSyncTime: lastProductionSyncTime,
    });
  });

  // Admin: disparar sincronização com produção sob demanda
  app.post('/api/admin/sync-production', async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const result = await syncFromProductionState(true);
    res.json(result);
  });

  // 9. Admin: Auction control action
  app.post('/api/admin/auction/action', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { action, value } = req.body;
    const token = extractToken(req);
    const session = token ? verifySessionToken(token) : null;
    const adminId = (req.headers['x-user-id'] || session?.userId) as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    const adminLeaderLabel = adminUser?.adminTitle === 'Diretor'
      ? 'O Diretor Guilherme Pereira'
      : adminUser?.adminTitle === 'Presidente'
      ? 'O Presidente Guilherme Tourinho'
      : (adminUser ? `${adminUser.name} (${adminUser.adminTitle || 'Admin'})` : 'A Diretoria');

    switch (action) {
      case 'SET_SCHEDULED_START': {
        const targetTime = typeof value === 'number' ? value : Number(value);
        if (!isNaN(targetTime)) {
          leagueState.auction.scheduledStartTime = targetTime;
          leagueState.auction.lastUpdated = Date.now();
          saveState();
          broadcastState();
          broadcast({
            type: 'CHAT_NOTIFICATION',
            data: {
              message: `⏱️ ${adminLeaderLabel} ajustou o cronômetro oficial de contagem regressiva para o início do leilão!`,
              timestamp: Date.now(),
              type: 'info'
            }
          });
          res.json({ success: true, auction: leagueState.auction });
          return;
        }
        res.status(400).json({ success: false, error: 'Horário inválido' });
        return;
      }
      case 'START_LEAGUE_AUCTION':
        leagueState.auction.status = 'ACTIVE';
        if (!leagueState.auction.timerRemaining || leagueState.auction.timerRemaining <= 0) {
          leagueState.auction.timerRemaining = leagueState.auction.defaultDurationSeconds || AUCTION_DURATION_SECONDS;
        }
        // Regra 1: Todos os jogadores atualmente em leilão acompanham o cronômetro oficial definido pelo administrador
        leagueState.players.forEach((p) => {
          if (p.status === 'IN_AUCTION') {
            p.timerRemaining = leagueState.auction.timerRemaining;
            p.auctionExpiresAt = Date.now() + p.timerRemaining * 1000;
          }
        });
        leagueState.auction.lastUpdated = Date.now();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `🚀 ${adminLeaderLabel} iniciou oficialmente o Leilão da Khedira League! Orçamento de € 400M por clube. O mercado está aberto e propostas simultâneas estão liberadas para todos os jogadores do dia!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
      case 'SET_AUCTION_DAY': {
        leagueState.auction.auctionDay = 'ALL';
        leagueState.auction.lastUpdated = Date.now();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `📅 ${adminLeaderLabel} confirmou o Mercado Geral Unificado da Khedira League: ATAQUE, MEIO CAMPO E DEFESA simultâneos!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        broadcastState();
        res.json({ success: true, message: 'Mercado configurado para Mercado Geral Unificado (ATAQUE, MEIO e DEFESA simultâneos).' });
        return;
      }
      case 'SET_AUCTION_TYPE': {
        const newType: AuctionType = value === 'PHASED' ? 'PHASED' : 'FREE';
        leagueState.auction.auctionType = newType;
        if (newType === 'PHASED' && !leagueState.auction.currentPhase) {
          leagueState.auction.currentPhase = 'GOLEIROS';
        }
        leagueState.auction.lastUpdated = Date.now();
        const notificationText = newType === 'FREE'
          ? `🌐 ${adminLeaderLabel} alterou o formato do leilão para LEILÃO LIVRE: todos os clubes podem postar seu interesse por jogadores de TODAS as posições simultaneamente!`
          : `📋 ${adminLeaderLabel} alterou o formato do leilão para LEILÃO POR FASES: a disputa agora seguirá por etapas setoriais (1. Goleiros, 2. Defensores, 3. Meio Campo e 4. Atacantes). Fase atual: ${leagueState.auction.currentPhase === 'GOLEIROS' ? '1ª Fase: GOLEIROS' : leagueState.auction.currentPhase}!`;
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: notificationText,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        saveState();
        broadcastState();
        res.json({ success: true, auction: leagueState.auction });
        return;
      }
      case 'SET_AUCTION_PHASE': {
        const validPhases: AuctionPhase[] = ['GOLEIROS', 'DEFENSORES', 'MEIO_CAMPO', 'ATACANTES'];
        const newPhase: AuctionPhase = validPhases.includes(value as AuctionPhase) ? (value as AuctionPhase) : 'GOLEIROS';
        leagueState.auction.auctionType = 'PHASED';
        leagueState.auction.currentPhase = newPhase;
        leagueState.auction.lastUpdated = Date.now();
        const phaseLabels: Record<AuctionPhase, string> = {
          GOLEIROS: '1ª Fase: GOLEIROS (GOL)',
          DEFENSORES: '2ª Fase: DEFENSORES (Zagueiros e Laterais)',
          MEIO_CAMPO: '3ª Fase: MEIO-CAMPO (Volantes e Meias)',
          ATACANTES: '4ª Fase: ATACANTES (Centroavantes e Pontas)'
        };
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `📢 ${adminLeaderLabel} definiu a etapa ativa do leilão para: ${phaseLabels[newPhase]}! Apenas jogadores desta fase podem ser postados agora.`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        saveState();
        broadcastState();
        res.json({ success: true, auction: leagueState.auction });
        return;
      }
      case 'TOGGLE_ANONYMOUS_BIDDING':
        leagueState.auction.anonymousBidding = !leagueState.auction.anonymousBidding;
        leagueState.auction.lastUpdated = Date.now();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: leagueState.auction.anonymousBidding
              ? `🔒 Sigilo de Lances ativado por ${adminLeaderLabel}: formato de lances anônimos em vigor durante a disputa!`
              : `🔓 Sigilo de Lances desativado por ${adminLeaderLabel}: nomes dos clubes visíveis nos lances.`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
      case 'END_LEAGUE_AUCTION':
        leagueState.players.forEach((pl) => {
          if (pl.status === 'IN_AUCTION') {
            sellPlayerToHighestBidder(pl, leagueState.auction.auctionDay || 'ALL');
          }
        });
        leagueState.auction.status = 'ENDED';
        leagueState.auction.currentPlayer = null;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = 0;
        leagueState.auction.lastUpdated = Date.now();
        // Reseta o elenco conceito dos usuários e substitui oficialmente pelos jogadores obtidos no leilão
        resetConceptAndApplyWonPlayersToAllUsers();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: '🏁 O Administrador encerrou a sessão de leilões da Khedira League. Todas as propostas mais altas foram oficializadas e os atletas transferidos aos clubes vencedores!',
            timestamp: Date.now(),
            type: 'alert'
          }
        });
        break;
      case 'RESET_TO_NOT_STARTED':
        leagueState.players.forEach((pl) => {
          if (pl.status === 'IN_AUCTION') {
            pl.status = 'AVAILABLE';
            pl.timerRemaining = undefined;
            pl.auctionExpiresAt = undefined;
            pl.currentBid = null;
            pl.bidHistory = [];
            pl.currentPrice = pl.initialPrice;
          }
        });
        leagueState.auction.status = 'NOT_STARTED';
        leagueState.auction.currentPlayer = null;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.nominationQueue = [];
        leagueState.auction.timerRemaining = getAuctionDuration();
        leagueState.auction.nominationTimerRemaining = 45;
        leagueState.auction.lastUpdated = Date.now();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: '📢 Leilão ainda não iniciado, participantes se preparem para logo em breve darmos inicio ao leilão',
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
      case 'CLEAR_BID_HISTORY':
        leagueState.auction.bidHistory = [];
        leagueState.auction.currentBid = null;
        leagueState.players.forEach((pl) => {
          pl.bidHistory = [];
          if (pl.status === 'IN_AUCTION') {
            pl.currentBid = null;
            pl.currentPrice = pl.initialPrice;
          }
        });
        break;
      case 'PAUSE':
        if (leagueState.auction.status === 'ACTIVE') {
          leagueState.auction.status = 'PAUSED';
        }
        break;
      case 'RESUME':
        if (leagueState.auction.status === 'PAUSED') {
          leagueState.auction.status = 'ACTIVE';
        }
        break;
      case 'FORCE_FINISH': {
        if (value && typeof value === 'string') {
          const targetP = leagueState.players.find((pl) => pl.id === value);
          if (targetP && targetP.status === 'IN_AUCTION') {
            finalizeSpecificPlayerAuction(targetP);
            break;
          }
        }
        if (leagueState.auction.currentPlayer) {
          finalizeAuction();
        } else {
          const inAuctionPlayers = leagueState.players.filter((pl) => pl.status === 'IN_AUCTION');
          if (inAuctionPlayers.length > 0) {
            inAuctionPlayers.forEach((pl) => finalizeSpecificPlayerAuction(pl));
          }
        }
        break;
      }
      case 'RESET_TIMER':
      case 'SET_TIMER': {
        const targetSeconds = Math.max(10, Math.floor(Number(value) || getAuctionDuration()));
        leagueState.auction.timerRemaining = targetSeconds;
        // Salvar também como defaultDurationSeconds para refletir no lobby e nas próximas disputas
        leagueState.auction.defaultDurationSeconds = targetSeconds;
        if (leagueState.auction.currentPlayer) {
          const cp = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
          if (cp && cp.status === 'IN_AUCTION') {
            cp.timerRemaining = targetSeconds;
            cp.auctionExpiresAt = Date.now() + targetSeconds * 1000;
          }
        }
        leagueState.players.forEach((p) => {
          if (p.status === 'IN_AUCTION') {
            p.timerRemaining = targetSeconds;
            p.auctionExpiresAt = Date.now() + targetSeconds * 1000;
          }
        });
        leagueState.auction.lastUpdated = Date.now();
        const mins = Math.floor(targetSeconds / 60);
        const secs = targetSeconds % 60;
        const timeFormatted = mins > 0 ? `${mins}m${secs > 0 ? ` ${secs}s` : ''}` : `${secs}s`;
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⏱️ ${adminLeaderLabel} ajustou o cronômetro oficial do leilão para ${timeFormatted}!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
      }
      case 'SET_DEFAULT_DURATION': {
        const targetSeconds = Math.max(10, Math.floor(Number(value) || AUCTION_DURATION_SECONDS));
        leagueState.auction.defaultDurationSeconds = targetSeconds;
        // Se o leilão estiver no lobby ou sem disputa ativa, atualizar também o timerRemaining
        if (leagueState.auction.status === 'NOT_STARTED' || leagueState.auction.status === 'IDLE' || !leagueState.auction.timerRemaining) {
          leagueState.auction.timerRemaining = targetSeconds;
        }
        leagueState.auction.lastUpdated = Date.now();
        const mins = Math.floor(targetSeconds / 60);
        const secs = targetSeconds % 60;
        const timeFormatted = mins > 0 ? `${mins}m${secs > 0 ? ` ${secs}s` : ''}` : `${secs}s`;
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⚙️ ${adminLeaderLabel} alterou o tempo padrão oficial de disputa do leilão para ${timeFormatted}!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
      }
      case 'ADJUST_TIMER': {
        const delta = Math.floor(Number(value) || 0);
        const current = leagueState.auction.timerRemaining > 0 
          ? leagueState.auction.timerRemaining 
          : (leagueState.auction.defaultDurationSeconds || getAuctionDuration());
        const targetSeconds = Math.max(10, current + delta);
        leagueState.auction.timerRemaining = targetSeconds;
        if (leagueState.auction.status === 'NOT_STARTED' || leagueState.auction.status === 'IDLE' || !leagueState.auction.currentPlayer) {
          leagueState.auction.defaultDurationSeconds = targetSeconds;
        }
        if (leagueState.auction.currentPlayer) {
          const cp = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
          if (cp && cp.status === 'IN_AUCTION') {
            cp.timerRemaining = targetSeconds;
            cp.auctionExpiresAt = Date.now() + targetSeconds * 1000;
          }
        }
        leagueState.players.forEach((p) => {
          if (p.status === 'IN_AUCTION') {
            p.timerRemaining = targetSeconds;
            p.auctionExpiresAt = Date.now() + targetSeconds * 1000;
          }
        });
        leagueState.auction.lastUpdated = Date.now();
        const mins = Math.floor(targetSeconds / 60);
        const secs = targetSeconds % 60;
        const timeFormatted = mins > 0 ? `${mins}m${secs > 0 ? ` ${secs}s` : ''}` : `${secs}s`;
        const deltaMins = Math.round(delta / 60);
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⏱️ ${adminLeaderLabel} ajustou o cronômetro do leilão para ${timeFormatted} (${deltaMins >= 0 ? `+${deltaMins}` : deltaMins} min)!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
      }
      case 'CANCEL_AUCTION':
        if (leagueState.auction.currentPlayer) {
          const p = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
          if (p) p.status = 'AVAILABLE';
        }
        leagueState.auction.status = 'IDLE';
        leagueState.auction.currentPlayer = null;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = 0;
        advanceNominationTurn();
        break;
      case 'TOGGLE_FREE_NOMINATION':
        leagueState.auction.isFreeNominationMode = !leagueState.auction.isFreeNominationMode;
        break;
      case 'PASS_NOMINATION_TURN':
      case 'ADVANCE_NOMINATION_TURN':
        advanceNominationTurn();
        leagueState.auction.nominationTimerRemaining = 45;
        break;
      case 'SET_NOMINATOR':
        leagueState.auction.nominationTurnUserId = value;
        leagueState.auction.nominationTimerRemaining = 45;
        break;
      case 'RESET_MARKET_AND_SQUADS':
        executeResetMarketAndSquads(adminUser);
        break;
      case 'RESET_PHASE':
        executeResetPhase(value as string | number, adminUser);
        break;
    }

    saveState();
    broadcastState();
    res.json({ success: true, auction: leagueState.auction });
  });

  function getPhaseTargetPositions(target: string | number): {
    positions: string[];
    phaseName: string;
    targetAuctionPhase?: AuctionPhase;
  } {
    const t = String(target).toUpperCase().trim();
    if (t === 'ATACANTES' || t === 'ATAQUE' || t === 'ATK' || t === '3' || t === '4') {
      return {
        positions: ['ATA', 'PD', 'PE', 'SA'],
        phaseName: 'Etapa dos Atacantes (Centroavantes e Pontas)',
        targetAuctionPhase: 'ATACANTES'
      };
    }
    if (t === 'MEIO_CAMPO' || t === 'MEIO' || t === 'MID' || t === '2') {
      return {
        positions: ['VOL', 'MC', 'MEI'],
        phaseName: 'Etapa do Meio-Campo (Volantes e Meias)',
        targetAuctionPhase: 'MEIO_CAMPO'
      };
    }
    if (t === 'DEFENSORES' || t === 'DEFESA' || t === 'DEF') {
      return {
        positions: ['ZAG', 'LE', 'LD'],
        phaseName: 'Etapa dos Defensores (Zagueiros e Laterais)',
        targetAuctionPhase: 'DEFENSORES'
      };
    }
    if (t === 'GOLEIROS' || t === 'GOL') {
      return {
        positions: ['GOL'],
        phaseName: 'Etapa dos Goleiros (GOL)',
        targetAuctionPhase: 'GOLEIROS'
      };
    }
    if (t === 'DEFESA_COMPLETA' || t === '1') {
      return {
        positions: ['GOL', 'ZAG', 'LE', 'LD'],
        phaseName: 'Etapa de Defensores & Goleiros',
        targetAuctionPhase: 'DEFENSORES'
      };
    }
    return {
      positions: ['ATA', 'PD', 'PE', 'SA'],
      phaseName: 'Etapa dos Atacantes',
      targetAuctionPhase: 'ATACANTES'
    };
  }

  // Função centralizada para refazer o leilão por fase específica (ex: Atacantes)
  function executeResetPhase(targetPhase: string | number, adminUser?: UserProfile) {
    const { positions, phaseName, targetAuctionPhase } = getPhaseTargetPositions(targetPhase);
    const adminLabel = adminUser?.adminTitle === 'Diretor'
      ? 'O Diretor Guilherme Pereira'
      : adminUser?.adminTitle === 'Presidente'
      ? 'O Presidente Guilherme Tourinho'
      : (adminUser ? `${adminUser.name} (${adminUser.adminTitle || 'Admin'})` : 'A Diretoria');

    let releasedCount = 0;
    let refundedTotal = 0;
    const releasedPlayersList: Array<{ id: string; name: string; position: string; club: string; amount: number }> = [];
    const refundedByClub: Record<string, { clubName: string; amount: number; count: number }> = {};

    // 1. Encontrar todos os jogadores da fase que foram vendidos ou indicados
    leagueState.players.forEach((player) => {
      if (!positions.includes(player.position)) return;

      // Se o jogador estiver vendido para um clube
      if (player.soldTo) {
        const amount = player.soldTo.amount || 0;
        const buyerId = player.soldTo.userId;
        const prevOwner = leagueState.users.find((u) => u.id === buyerId);

        if (prevOwner) {
          prevOwner.budget += amount;
          prevOwner.spent = Math.max(0, prevOwner.spent - amount);

          if (!refundedByClub[buyerId]) {
            refundedByClub[buyerId] = {
              clubName: prevOwner.teamName || prevOwner.name,
              amount: 0,
              count: 0
            };
          }
          refundedByClub[buyerId].amount += amount;
          refundedByClub[buyerId].count += 1;
        }

        // Remover do elenco do clube (titulares e reservas)
        const ownerSquad = leagueState.squads[buyerId];
        if (ownerSquad) {
          Object.keys(ownerSquad.starterSlots).forEach((slotId) => {
            if (ownerSquad.starterSlots[slotId] === player.id) {
              delete ownerSquad.starterSlots[slotId];
            }
          });
          ownerSquad.benchPlayerIds = ownerSquad.benchPlayerIds.filter((id) => id !== player.id);
        }

        refundedTotal += amount;
        releasedCount += 1;
        releasedPlayersList.push({
          id: player.id,
          name: player.name,
          position: player.position,
          club: prevOwner?.teamName || prevOwner?.name || 'Clube',
          amount
        });
      }

      // Restaurar o atleta como disponível para novos lances
      player.status = 'AVAILABLE';
      player.currentPrice = player.initialPrice;
      player.soldTo = undefined;
      player.nominatedBy = undefined;
      player.currentBid = null;
      player.bidHistory = [];
      player.timerRemaining = undefined;
      player.auctionExpiresAt = undefined;
    });

    // 2. Se o jogador atualmente em leilão for desta fase, cancela o leilão ativo
    if (leagueState.auction.currentPlayer) {
      if (positions.includes(leagueState.auction.currentPlayer.position)) {
        leagueState.auction.status = 'IDLE';
        leagueState.auction.currentPlayer = null;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = 0;
      }
    }

    // 3. Remover atletas dessa fase da fila de nomeações
    if (leagueState.auction.nominationQueue && Array.isArray(leagueState.auction.nominationQueue)) {
      leagueState.auction.nominationQueue = leagueState.auction.nominationQueue.filter((item) => {
        const pos = item?.player?.position || (item as any)?.position;
        return !positions.includes(pos);
      });
    }

    // 4. Se houver fase de leilão correspondente, define o leilão para ela
    if (targetAuctionPhase) {
      leagueState.auction.auctionType = 'PHASED';
      leagueState.auction.currentPhase = targetAuctionPhase;
    }

    // Se o leilão estava encerrado (ENDED), reabre o leilão para permitir novos lances na fase refeita
    if (leagueState.auction.status === 'ENDED') {
      leagueState.auction.status = 'NOT_STARTED';
    }

    leagueState.auction.lastUpdated = Date.now();

    // 5. Garantir que saldos e gastos de todos os clubes estejam 100% exatos com base no elenco real
    leagueState.users.forEach((u) => {
      const owned = leagueState.players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === u.id);
      const realSpent = owned.reduce((sum, p) => sum + (p.soldTo?.amount || 0), 0);
      u.spent = realSpent;
      u.budget = DEFAULT_BUDGET - realSpent;
    });

    // 6. Salvar e transmitir
    saveState(true);
    broadcastState();

    const formattedRefund = `€ ${(refundedTotal / 1000000).toFixed(1)}M`;
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `🔄 ${adminLabel} refez a etapa de leilão: ${phaseName}! ${releasedCount} ${releasedCount === 1 ? 'atleta retornou' : 'atletas retornaram'} ao mercado como disponíveis e ${formattedRefund} foram estornados integralmente aos cofres dos clubes compradores!`,
        timestamp: Date.now(),
        type: 'alert'
      }
    });

    return {
      phase: targetPhase,
      phaseName,
      targetAuctionPhase,
      releasedCount,
      refundedTotal,
      refundedByClub,
      releasedPlayersList
    };
  }

  // Função centralizada para resetar mercado, retirar jogadores dos clubes e devolver saldos
  function executeResetMarketAndSquads(adminUser?: UserProfile) {
    const adminLabel = adminUser?.adminTitle === 'Diretor'
      ? 'O Diretor Guilherme Pereira'
      : adminUser?.adminTitle === 'Presidente'
      ? 'O Presidente Guilherme Tourinho'
      : (adminUser ? `${adminUser.name} (${adminUser.adminTitle || 'Admin'})` : 'A Diretoria');

    // 1. Devolver todos os jogadores para o mercado como disponíveis e zerar todo histórico de lances
    leagueState.players.forEach((p) => {
      p.status = 'AVAILABLE';
      p.soldTo = undefined;
      p.nominatedBy = undefined;
      p.currentPrice = p.initialPrice;
      p.currentBid = null;
      p.bidHistory = [];
      p.timerRemaining = undefined;
      p.auctionExpiresAt = undefined;
    });

    // 2. Limpar elencos de todos os usuários e devolver 100% do orçamento a todos os clubes
    leagueState.users.forEach((u) => {
      u.budget = leagueState.defaultBudget;
      u.spent = 0;
      leagueState.squads[u.id] = {
        userId: u.id,
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      };
    });

    // 3. Reiniciar estado do leilão e zerar integralmente o histórico de lances da rodada
    leagueState.auction.status = 'NOT_STARTED';
    leagueState.auction.currentPlayer = null;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    leagueState.auction.nominationQueue = [];
    leagueState.auction.timerRemaining = 0;
    leagueState.auction.nominationTimerRemaining = 45;
    leagueState.auction.nominationTurnUserId = leagueState.users[0]?.id || 'user-admin-default';
    leagueState.auction.lastUpdated = Date.now();

    // 4. Notificar a todos em tempo real
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `🔄 ${adminLabel} executou o Reset de Mercado e Elencos: todos os atletas retornaram ao mercado, o histórico de lances da rodada foi zerado e o orçamento total (€ ${(leagueState.defaultBudget / 1000000).toFixed(0)}M) foi 100% devolvido a todos os clubes!`,
        timestamp: Date.now(),
        type: 'alert'
      }
    });

    saveState();
    broadcastState();
  }

  // 10. Admin: Reset de Mercado e Devolução de Saldo aos Clubes
  app.post('/api/admin/reset-league', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const adminId = req.headers['x-user-id'] as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    executeResetMarketAndSquads(adminUser);
    res.json({ 
      success: true, 
      message: `Reset executado com sucesso: todos os jogadores voltaram para o mercado, histórico de lances foi zerado e o orçamento de € ${(leagueState.defaultBudget / 1000000).toFixed(0)}M foi devolvido aos clubes.`,
      auction: leagueState.auction,
      players: leagueState.players
    });
  });

  app.post('/api/admin/reset-market-squads', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const adminId = req.headers['x-user-id'] as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    executeResetMarketAndSquads(adminUser);
    res.json({ 
      success: true, 
      message: `Reset executado com sucesso: todos os jogadores voltaram para o mercado, histórico de lances foi zerado e o orçamento de € ${(leagueState.defaultBudget / 1000000).toFixed(0)}M foi devolvido aos clubes.`,
      auction: leagueState.auction,
      players: leagueState.players
    });
  });

  // 10b. Admin: Refazer o leilão por fase específica (Atacantes, Meio-Campo, Defensores ou Goleiros)
  app.post('/api/admin/auction/reset-phase', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const adminId = req.headers['x-user-id'] as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    const { phase } = req.body;

    if (!phase) {
      res.status(400).json({ success: false, error: 'Identificador de fase inválido ou não fornecido.' });
      return;
    }

    const result = executeResetPhase(phase, adminUser);
    res.json({
      success: true,
      ...result,
      message: `${result.phaseName} refeita com sucesso! ${result.releasedCount} ${result.releasedCount === 1 ? 'atleta retornou' : 'atletas retornaram'} ao mercado e € ${(result.refundedTotal / 1000000).toFixed(1)}M foram estornados aos clubes. A fase ativa do leilão foi posicionada para novas disputas.`,
      auction: leagueState.auction,
      players: leagueState.players,
      users: leagueState.users
    });
  });

  // 10c. Admin: Replicar transferências de documento/planilha
  app.post('/api/admin/replicate-from-document', async (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const adminId = req.headers['x-user-id'] as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    const { rawText, transfers, skipAttackers = true } = req.body;

    const atkPositions = ['ATA', 'PD', 'PE', 'SA'];
    const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    interface ParsedItem {
      playerName: string;
      targetUserOrTeam: string;
      amount: number;
    }
    const itemsToProcess: ParsedItem[] = [];

    if (Array.isArray(transfers) && transfers.length > 0) {
      for (const t of transfers) {
        if (t.playerName && (t.targetUserOrTeam || t.teamName || t.userName || t.userId)) {
          let amt = Number(t.amount);
          if (isNaN(amt) || amt <= 0) amt = 10000000;
          if (amt < 1000) amt = amt * 1000000;
          itemsToProcess.push({
            playerName: String(t.playerName).trim(),
            targetUserOrTeam: String(t.targetUserOrTeam || t.teamName || t.userName || t.userId).trim(),
            amount: amt
          });
        }
      }
    } else if (typeof rawText === 'string' && rawText.trim()) {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (/^(jogador|atleta|player|nome|club|time|valor|posicao)/i.test(line) && line.includes(';')) continue;
        let parts = line.split('\t');
        if (parts.length < 2) parts = line.split(';');
        if (parts.length < 2) parts = line.split('|');
        if (parts.length < 2) parts = line.split(/ - | – | — /);
        if (parts.length < 2) parts = line.split(',');

        if (parts.length >= 2) {
          const pName = parts[0].trim().replace(/^[-*•\d.]+\s*/, '');
          const teamOrUser = parts[1].trim();
          const rawAmt = parts[2] ? parts[2].trim() : '10M';
          const cleanAmt = rawAmt.replace(/[€$R\s]/gi, '').replace(/\.000\.000/g, 'M').replace(/\.000/g, 'k');
          let amt = 10000000;
          const matchM = cleanAmt.match(/(\d+([.,]\d+)?)\s*m/i);
          if (matchM) {
            amt = Math.round(parseFloat(matchM[1].replace(',', '.')) * 1000000);
          } else {
            const num = parseFloat(cleanAmt.replace(/[^\d.,]/g, '').replace(',', '.'));
            if (!isNaN(num)) {
              if (num < 1000) amt = Math.round(num * 1000000);
              else amt = Math.round(num);
            }
          }
          itemsToProcess.push({
            playerName: pName,
            targetUserOrTeam: teamOrUser,
            amount: amt
          });
        }
      }
    }

    if (itemsToProcess.length === 0) {
      res.status(400).json({ success: false, error: 'Nenhuma transferência válida encontrada no documento/texto enviado.' });
      return;
    }

    // Zerar todos os elencos e devolver jogadores para o mercado
    leagueState.players.forEach((p) => {
      p.status = 'AVAILABLE';
      p.soldTo = undefined;
      p.nominatedBy = undefined;
      p.currentPrice = p.initialPrice;
      p.currentBid = null;
      p.bidHistory = [];
      p.timerRemaining = undefined;
      p.auctionExpiresAt = undefined;
    });

    leagueState.users.forEach((u) => {
      u.budget = DEFAULT_BUDGET;
      u.spent = 0;
      leagueState.squads[u.id] = {
        userId: u.id,
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      };
    });

    const applied: Array<{ player: string; team: string; amount: number; position: string }> = [];
    const skippedAttackers: Array<{ player: string; position: string; target: string }> = [];
    const unmatched: string[] = [];

    const findPlayer = (name: string) => {
      const n = norm(name);
      return (
        leagueState.players.find((p) => norm(p.name) === n) ||
        leagueState.players.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name)))
      );
    };

    const findUser = (str: string) => {
      const n = norm(str);
      return (
        leagueState.users.find((u) => u.id === str) ||
        leagueState.users.find((u) => norm(u.teamName) === n || norm(u.name) === n) ||
        leagueState.users.find((u) => norm(u.teamName).includes(n) || norm(u.name).includes(n) || n.includes(norm(u.teamName)) || n.includes(norm(u.name)))
      );
    };

    const assignSlot = (userId: string, playerId: string, pos: string) => {
      const sq = leagueState.squads[userId];
      if (!sq) return;
      const s = sq.starterSlots;
      if (pos === 'GOL' && !s.gol) s.gol = playerId;
      else if (pos === 'ZAG' && !s.zag_1) s.zag_1 = playerId;
      else if (pos === 'ZAG' && !s.zag_2) s.zag_2 = playerId;
      else if (pos === 'LE' && !s.le) s.le = playerId;
      else if (pos === 'LD' && !s.ld) s.ld = playerId;
      else if (pos === 'VOL' && !s.vol) s.vol = playerId;
      else if ((pos === 'MC' || pos === 'MEI') && !s.mc_1) s.mc_1 = playerId;
      else if ((pos === 'MC' || pos === 'MEI') && !s.mc_2) s.mc_2 = playerId;
      else if ((pos === 'MC' || pos === 'MEI') && !s.mei_1) s.mei_1 = playerId;
      else if ((pos === 'ATA' || pos === 'SA') && !s.ata) s.ata = playerId;
      else if (pos === 'PE' && !s.pe) s.pe = playerId;
      else if (pos === 'PD' && !s.pd) s.pd = playerId;
      else {
        if (!sq.benchPlayerIds.includes(playerId)) sq.benchPlayerIds.push(playerId);
      }
    };

    for (const item of itemsToProcess) {
      const player = findPlayer(item.playerName);
      if (!player) {
        unmatched.push(`Jogador não encontrado: "${item.playerName}"`);
        continue;
      }
      if (skipAttackers && atkPositions.includes(player.position)) {
        skippedAttackers.push({ player: player.name, position: player.position, target: item.targetUserOrTeam });
        continue;
      }
      const user = findUser(item.targetUserOrTeam);
      if (!user) {
        unmatched.push(`Clube/Usuário não encontrado para "${item.playerName}": "${item.targetUserOrTeam}"`);
        continue;
      }

      player.status = 'SOLD';
      player.currentPrice = item.amount;
      player.soldTo = {
        userId: user.id,
        userName: user.name,
        teamName: user.teamName,
        amount: item.amount,
        soldAt: Date.now(),
        auctionDay: 'ALL'
      };
      const b: Bid = {
        id: `bid-${player.id}-doc`,
        playerId: player.id,
        playerName: player.name,
        userId: user.id,
        userName: user.name,
        teamName: user.teamName,
        userEmail: user.email,
        amount: item.amount,
        timestamp: Date.now(),
        isAnonymous: true
      };
      player.currentBid = b;
      player.bidHistory = [b];

      assignSlot(user.id, player.id, player.position);
      applied.push({ player: player.name, team: user.teamName, amount: item.amount, position: player.position });
    }

    // Recalcular saldo e gastos de todos os usuários
    leagueState.users.forEach((u) => {
      const owned = leagueState.players.filter((p) => p.status === 'SOLD' && p.soldTo?.userId === u.id);
      const spent = owned.reduce((sum, p) => sum + (p.soldTo?.amount || 0), 0);
      u.spent = spent;
      u.budget = DEFAULT_BUDGET - spent;
    });

    leagueState.auction.currentPhase = 'ATACANTES';
    leagueState.auction.lastUpdated = Date.now();

    saveState(true);
    broadcastState();
    await syncAllStateToFirestore(leagueState);

    const adminLabel = adminUser ? `${adminUser.name}` : 'A Diretoria';
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📋 ${adminLabel} sincronizou os elencos a partir do documento oficial! ${applied.length} contratações foram replicadas e os orçamentos foram recalculados. A etapa dos Atacantes permanece disponível para o leilão!`,
        timestamp: Date.now(),
        type: 'alert'
      }
    });

    res.json({
      success: true,
      message: `Transferências replicadas com sucesso! ${applied.length} jogadores transferidos. ${skippedAttackers.length} atacantes mantidos no mercado para a próxima etapa.`,
      appliedCount: applied.length,
      skippedAttackersCount: skippedAttackers.length,
      skippedAttackers,
      applied,
      unmatched,
      auction: leagueState.auction,
      players: leagueState.players,
      users: leagueState.users
    });
  });

  // API 404 fallback - never serve HTML for /api requests
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Endpoint da API não encontrado' });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Sincronização com Cloud Firestore
  try {
    const hasLocalData = leagueState.players && leagueState.players.length > 0 && leagueState.users && leagueState.users.length > 0;
    if (!hasLocalData) {
      const cloudData = await loadStateFromFirestore(leagueState);
      if (cloudData) {
        if (cloudData.users && cloudData.users.length > 0) leagueState.users = cloudData.users;
        if (cloudData.squads && Object.keys(cloudData.squads).length > 0) leagueState.squads = cloudData.squads;
        if (cloudData.auction) leagueState.auction = cloudData.auction;
        if (cloudData.players && cloudData.players.length > 0) leagueState.players = cloudData.players;
        if (cloudData.watchlists) leagueState.watchlists = cloudData.watchlists;
        console.log(`[Firebase] Hydrated state from Cloud Firestore.`);
        saveState(false);
      }
    } else {
      // Local state is authoritative: sync to Cloud Firestore
      console.log(`[Firebase] Local state authoritative (${leagueState.users.length} users, ${leagueState.players.length} players). Updating Cloud Firestore...`);
      await syncAllStateToFirestore(leagueState);
    }
  } catch (cloudErr) {
    console.error('[Firebase] Firestore sync error on boot:', cloudErr);
  }

  // Se o banco local estiver vazio, permite sincronização com produção
  if (!leagueState.players || leagueState.players.length === 0) {
    try {
      await syncFromProductionState(false);
      saveState(true);
    } catch (syncErr) {
      console.warn('[Production Sync] Sincronização inicial com produção adiada:', syncErr);
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Khedira League Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
