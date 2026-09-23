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
import { INITIAL_PLAYERS } from './src/data/initialPlayers.js';
import { LeagueState, Player, PlayerPosition, UserProfile, Bid, UserSquad, WSMessage } from './src/types.js';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  sanitizeUser,
  sanitizeLeagueState,
  validateEmail,
  validatePassword,
  validateString,
  validatePositiveInteger,
  validatePosition,
  checkRLSOwnership,
  validateUploadBuffer,
  SessionPayload
} from './src/server/security.js';

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

function isPositionAllowedForDay(position: string, day: 1 | 2 | 3 | 'ALL'): boolean {
  if (day === 'ALL') return true;
  if (day === 1) return ['GOL', 'ZAG', 'LE', 'LD'].includes(position);
  if (day === 2) return ['VOL', 'MC', 'MEI'].includes(position);
  if (day === 3) return ['ATA', 'PD', 'PE', 'MD', 'ME', 'SA'].includes(position);
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
      auctionDay: 1, // Dia 1 - Sistema Defensivo
      anonymousBidding: true, // Sigilo de Lances obrigatório conforme Ata Oficial
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
      if (!leagueState.auction.auctionDay) {
        leagueState.auction.auctionDay = 1;
      }
      if (leagueState.auction.anonymousBidding === undefined) {
        leagueState.auction.anonymousBidding = true;
      }
      if (!leagueState.auction.nominationQueue) {
        leagueState.auction.nominationQueue = [];
      }
      leagueState.auction.isFreeNominationMode = true;
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

    // Retain any manual extra players added via admin if any
    (leagueState.players || []).forEach((p) => {
      if (p.isManualExtra && !updatedPlayers.some((up) => up.id === p.id || up.name.toLowerCase().trim() === p.name.toLowerCase().trim())) {
        updatedPlayers.push(p);
      }
    });

    leagueState.players = updatedPlayers;

    // Ensure leagueState.auction.currentPlayer references the matching player in updatedPlayers with active bid
    if (leagueState.auction?.currentPlayer) {
      const match = updatedPlayers.find((p) => p.id === leagueState.auction.currentPlayer?.id);
      if (match) {
        if (!match.currentBid && leagueState.auction.currentBid) {
          match.currentBid = leagueState.auction.currentBid;
          match.currentPrice = leagueState.auction.currentBid.amount;
        } else if (match.currentBid && !leagueState.auction.currentBid) {
          leagueState.auction.currentBid = match.currentBid;
        }
        leagueState.auction.currentPlayer = match;
      }
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(leagueState, null, 2));
  } else {
    leagueState = getInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(leagueState, null, 2));
  }
} catch (e) {
  console.error('Error loading DB, resetting to initial state:', e);
  leagueState = getInitialState();
}

function saveState() {
  try {
    const tmp = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(leagueState, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
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

function broadcastState() {
  broadcast({ type: 'STATE_SYNC', data: sanitizeLeagueState(leagueState) });
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

// Obter a proposta mais alta (a última válida) registrada para um atleta
function getHighestBidForPlayer(player: Player): Bid | null {
  let highest: Bid | null = player.currentBid || null;

  if (player.bidHistory && player.bidHistory.length > 0) {
    for (const b of player.bidHistory) {
      if (b && typeof b.amount === 'number' && (!highest || b.amount > highest.amount)) {
        highest = b;
      }
    }
  }

  if (leagueState.auction.currentPlayer?.id === player.id && leagueState.auction.currentBid) {
    if (!highest || leagueState.auction.currentBid.amount > highest.amount) {
      highest = leagueState.auction.currentBid;
    }
  }

  if (leagueState.auction.bidHistory && leagueState.auction.bidHistory.length > 0) {
    for (const b of leagueState.auction.bidHistory) {
      if (b && (b.playerId === player.id || b.playerName === player.name) && typeof b.amount === 'number') {
        if (!highest || b.amount > highest.amount) {
          highest = b;
        }
      }
    }
  }

  return highest;
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
          winner,
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

// Complete specific player auction: hammer drops!
function finalizeSpecificPlayerAuction(player: Player) {
  sellPlayerToHighestBidder(player);

  if (leagueState.auction.currentPlayer?.id === player.id) {
    const nextInAuction = leagueState.players.find((p) => p.id !== player.id && p.status === 'IN_AUCTION');
    if (nextInAuction) {
      leagueState.auction.currentPlayer = nextInAuction;
      leagueState.auction.currentBid = getHighestBidForPlayer(nextInAuction);
      leagueState.auction.timerRemaining = nextInAuction.timerRemaining || 86400;
    } else {
      leagueState.auction.currentPlayer = null;
      leagueState.auction.currentBid = null;
      leagueState.auction.timerRemaining = 0;
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

    // Se houver jogadores postados na fila de interesse, inicia automaticamente o próximo para 24h
    if (leagueState.auction.nominationQueue && leagueState.auction.nominationQueue.length > 0) {
      const nextItem = leagueState.auction.nominationQueue.shift()!;
      const nextPlayer = leagueState.players.find((p) => p.id === nextItem.player.id);
      if (nextPlayer && nextPlayer.status === 'AVAILABLE') {
        nextPlayer.status = 'IN_AUCTION';
        nextPlayer.nominatedBy = nextItem.nominatedByUserId;
        nextPlayer.timerRemaining = 86400;
        nextPlayer.auctionExpiresAt = Date.now() + 86400 * 1000;

        leagueState.auction.status = 'ACTIVE';
        leagueState.auction.currentPlayer = nextPlayer;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = 86400; // 24 hours
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
            message: `📢 Próximo jogador da fila de interesse: ${nextPlayer.name} (${nextPlayer.position} - ${nextPlayer.club}), postado por ${nextItem.nominatedByUserName} (${nextItem.nominatedByTeamName})! Propostas abertas por 24 horas.`,
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
      if (leagueState.auction.timerRemaining === 0 && leagueState.auction.currentPlayer) {
        const cp = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
        if (cp && cp.status === 'IN_AUCTION') {
          finalizeSpecificPlayerAuction(cp);
          saveState();
        }
      }
    }
  } else if (leagueState.auction.status === 'IDLE') {
    // Se estiver IDLE e houver jogadores na fila de interesse, inicia automaticamente a rodada de 24h
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
        leagueState.auction.timerRemaining = 86400;
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
            message: `📢 Próximo jogador da fila: ${nextPlayer.name} (${nextPlayer.position} - ${nextPlayer.club}), postado por ${nextItem.nominatedByUserName}! Propostas abertas por 24 horas.`,
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
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    message: { success: false, error: 'Muitas requisições. Por favor aguarde alguns instantes.' }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    message: { success: false, error: 'Muitas tentativas de autenticação. Por segurança, aguarde alguns minutos.' }
  });

  const bidLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
    },
    message: { success: false, error: 'Limite de lances atingido. Aguarde alguns segundos antes de nova oferta.' }
  });

  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);

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
      if (nameVal.valid) user.name = nameVal.value!;
    }
    if (teamName && typeof teamName === 'string' && teamName.trim()) {
      const teamVal = validateString(teamName, 'Nome do time', 2, 50);
      if (teamVal.valid) user.teamName = teamVal.value!;
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

    res.json({ success: true, user: sanitizeUser(user), message: 'Perfil atualizado com sucesso!' });
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
      res.status(400).json({ success: false, error: 'Este jogador já está no leilão ao vivo com propostas abertas de 24 horas!' });
      return;
    }

    // Validação do Cronograma Oficial por Posições (Dia 1, 2, 3 ou Fase Livre)
    const currentDay = leagueState.auction.auctionDay || 'ALL';
    if (!isPositionAllowedForDay(player.position, currentDay)) {
      let dayDesc = '';
      if (currentDay === 1) dayDesc = 'Dia 1 - Sistema Defensivo: Goleiros (GOL), Zagueiros (ZAG) e Laterais (LD/LE)';
      else if (currentDay === 2) dayDesc = 'Dia 2 - Meio-Campo: Volantes (VOL) e Meio-campistas (MC/MEI)';
      else if (currentDay === 3) dayDesc = 'Dia 3 - Setor Ofensivo: Pontas (ME/MD/PE/PD), Segundos Atacantes (SA) e Centroavantes (ATA)';

      res.status(400).json({
        success: false,
        error: `Conforme o Regulamento Oficial da Khedira League, a disputa atual é restrita ao ${dayDesc}. O atleta ${player.name} (${player.position}) pertence a outra fase.`
      });
      return;
    }

    // Se leilão está em andamento (ACTIVE ou IDLE), abre imediatamente a rodada simultânea de 24h para o atleta
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

    player.status = 'IN_AUCTION';
    player.nominatedBy = user.id;
    player.currentBid = newBid;
    if (!player.bidHistory) player.bidHistory = [];
    player.bidHistory.unshift(newBid);
    player.currentPrice = openingAmount;
    player.timerRemaining = 86400; // 24 horas por atleta
    player.auctionExpiresAt = Date.now() + 86400 * 1000;

    leagueState.auction.status = 'ACTIVE';
    leagueState.auction.currentPlayer = player;
    leagueState.auction.currentBid = newBid;
    if (!leagueState.auction.bidHistory) leagueState.auction.bidHistory = [];
    leagueState.auction.bidHistory.unshift(newBid);
    leagueState.auction.lastUpdated = Date.now();

    saveState();

    broadcast({
      type: 'AUCTION_STARTED',
      data: {
        player,
        bid: newBid,
        auction: leagueState.auction
      }
    });

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📢 Proposta aberta por ${player.name} (${player.position}) no valor de € ${(openingAmount / 1000000).toFixed(1)}M (${isAnonymous ? '*****' : user.teamName})! Disputa ativa por 24 horas.`,
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

    targetPlayer.status = 'IN_AUCTION';
    targetPlayer.nominatedBy = item.nominatedByUserId;

    leagueState.auction.status = 'ACTIVE';
    leagueState.auction.currentPlayer = targetPlayer;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    leagueState.auction.timerRemaining = 86400; // 24 horas
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

    // Regra Inviolável Anti-Burla: Validar rigorosamente se o jogador em disputa pertence à fase do dia
    const currentDay = leagueState.auction.auctionDay || 'ALL';
    if (!isPositionAllowedForDay(player.position, currentDay)) {
      res.status(400).json({
        success: false,
        error: `Regulamento da Khedira League: lances bloqueados! O leilão ativo hoje é restrito ao ${
          currentDay === 1
            ? 'Dia 1 (Sistema Defensivo: GOL, ZAG, LE, LD)'
            : currentDay === 2
            ? 'Dia 2 (Meio-Campo: VOL, MC, MEI)'
            : currentDay === 3
            ? 'Dia 3 (Setor Ofensivo: ATA, PD, PE, MD, ME, SA)'
            : 'Fase Geral'
        }. O atleta ${player.name} (${player.position}) não pertence à fase ativa.`
      });
      return;
    }

    // Calculate true current highest bid for this player
    let currentHighest = player.currentBid?.amount || 0;
    if (player.bidHistory && player.bidHistory.length > 0) {
      for (const b of player.bidHistory) {
        if (b && typeof b.amount === 'number' && b.amount > currentHighest) {
          currentHighest = b.amount;
        }
      }
    }
    if (leagueState.auction.bidHistory && leagueState.auction.bidHistory.length > 0) {
      for (const b of leagueState.auction.bidHistory) {
        if (b && (b.playerId === player.id || b.playerName === player.name) && typeof b.amount === 'number' && b.amount > currentHighest) {
          currentHighest = b.amount;
        }
      }
    }
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

    // 24h timer or anti-snipe 5 min
    if (!player.timerRemaining || player.timerRemaining <= 0) {
      player.timerRemaining = 86400; // 24 hours
    } else if (player.timerRemaining < 300) {
      player.timerRemaining = 300;
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
        bid: newBid,
        player,
        auction: leagueState.auction
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

    broadcastState();
    res.json({ success: true, bid: newBid, player, auction: leagueState.auction });
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

    leagueState.squads[targetUserId] = {
      userId: targetUserId,
      formationId: formationId || '4-3-3',
      starterSlots: starterSlots || {},
      benchPlayerIds: benchPlayerIds || []
    };

    saveState();
    broadcastState();
    res.json({ success: true, squad: leagueState.squads[targetUserId] });
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

    const pos = (position && String(position).trim().toUpperCase()) || 'ATA';

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

  app.post('/api/admin/player/delete', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const { playerId } = req.body;
    leagueState.players = leagueState.players.filter((p) => p.id !== playerId);
    saveState();
    broadcastState();
    res.json({ success: true });
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
      case 'START_LEAGUE_AUCTION':
        leagueState.auction.status = 'ACTIVE';
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
        const validDay = (value === 1 || value === 2 || value === 3 || value === 'ALL') ? value : 'ALL';
        leagueState.auction.auctionDay = validDay;
        leagueState.auction.lastUpdated = Date.now();

        // Se houver leilão ativo com jogador de posição diferente da nova fase, cancela e devolve ao mercado
        if (leagueState.auction.currentPlayer && !isPositionAllowedForDay(leagueState.auction.currentPlayer.position, validDay)) {
          const removedName = leagueState.auction.currentPlayer.name;
          leagueState.auction.currentPlayer.status = 'AVAILABLE';
          leagueState.auction.currentPlayer = null;
          leagueState.auction.currentBid = null;
          leagueState.auction.bidHistory = [];
          if (leagueState.auction.status === 'ACTIVE') {
            leagueState.auction.status = 'IDLE';
          }
          broadcast({
            type: 'CHAT_NOTIFICATION',
            data: {
              message: `⚠️ Leilão de ${removedName} cancelado automaticamente pois a fase do dia foi alterada.`,
              timestamp: Date.now(),
              type: 'alert'
            }
          });
        }

        let dayDesc = '';
        if (validDay === 1) dayDesc = 'Dia 1 - Sistema Defensivo (GOL, ZAG, LD/LE)';
        else if (validDay === 2) dayDesc = 'Dia 2 - Meio-Campo (VOL, MC, MEI)';
        else if (validDay === 3) dayDesc = 'Dia 3 - Setor Ofensivo (Pontas, Segundos Atacantes e Centroavantes)';
        else dayDesc = 'Fase Livre - Todas as posições liberadas';

        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `📅 ${adminLeaderLabel} definiu o Cronograma Oficial do Leilão: ${dayDesc}!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
        break;
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
        leagueState.auction.timerRemaining = 0;
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
        leagueState.auction.timerRemaining = Number(value) || 86400;
        break;
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
      case 'SET_NOMINATOR':
        leagueState.auction.nominationTurnUserId = value;
        leagueState.auction.nominationTimerRemaining = 45;
        break;
      case 'RESET_MARKET_AND_SQUADS':
        executeResetMarketAndSquads(adminUser);
        break;
    }

    saveState();
    broadcastState();
    res.json({ success: true, auction: leagueState.auction });
  });

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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Khedira League Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
