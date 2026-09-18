import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PLAYERS } from './src/data/initialPlayers.js';
import { LeagueState, Player, UserProfile, Bid, UserSquad, WSMessage } from './src/types.js';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'league_db.json');
const DEFAULT_BUDGET = 400000000; // €400.000.000 (400 Milhões de Euros fixos e inegociáveis conforme Ata Oficial)
// Administradores Oficiais da Khedira League:
// - Guilherme Pereira Marques Brito (guimarquesbrito@gmail.com) -> Diretor
// - Guilherme Tourinho (Guilhermebtourinho@gmail.com) -> Presidente
const PEREIRA_EMAIL = 'guimarquesbrito@gmail.com';
const TOURINHO_EMAIL = 'guilhermebtourinho@gmail.com';
const TOURINHO_PASSWORD = 'fifakhedira2015';

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

// Initial state builder
function getInitialState(): LeagueState {
  const players: Player[] = INITIAL_PLAYERS.map((p) => ({
    ...p,
    status: 'AVAILABLE'
  }));

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
        u.password = TOURINHO_PASSWORD;
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
        return {
          ...initP,
          id: initP.id,
          name: initP.name,
          position: initP.position,
          club: initP.club,
          nationality: initP.nationality,
          initialPrice: initP.initialPrice,
          currentPrice: existing.status === 'AVAILABLE' ? initP.initialPrice : existing.currentPrice,
          status: existing.status || 'AVAILABLE',
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
    fs.writeFileSync(DB_FILE, JSON.stringify(leagueState, null, 2));
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
  broadcast({ type: 'STATE_SYNC', data: leagueState });
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

// Complete current auction: hammer drops!
function finalizeAuction() {
  const { currentPlayer, currentBid } = leagueState.auction;

  if (currentPlayer && currentBid) {
    // Player sold to highest bidder
    const winner = leagueState.users.find((u) => u.id === currentBid.userId);
    const playerInCatalog = leagueState.players.find((p) => p.id === currentPlayer.id);

    if (winner && playerInCatalog) {
      winner.budget -= currentBid.amount;
      winner.spent += currentBid.amount;

      playerInCatalog.status = 'SOLD';
      playerInCatalog.currentPrice = currentBid.amount;
      playerInCatalog.soldTo = {
        userId: winner.id,
        userName: winner.name,
        teamName: winner.teamName,
        amount: currentBid.amount,
        auctionDay: leagueState.auction.auctionDay || 1,
        soldAt: Date.now()
      };

      // Add permanently to winner's squad (bench or next empty slot)
      if (!leagueState.squads[winner.id]) {
        leagueState.squads[winner.id] = {
          userId: winner.id,
          formationId: '4-3-3',
          starterSlots: {},
          benchPlayerIds: []
        };
      }
      const squad = leagueState.squads[winner.id];
      if (!squad.benchPlayerIds.includes(currentPlayer.id)) {
        squad.benchPlayerIds.push(currentPlayer.id);
      }

      broadcast({
        type: 'AUCTION_HAMMER',
        data: {
          winner,
          player: playerInCatalog,
          finalPrice: currentBid.amount
        }
      });

      broadcast({
        type: 'CHAT_NOTIFICATION',
        data: {
          message: `🔨 MARTELO BATIDO! ${playerInCatalog.name} foi arrematado por ${winner.name} (${winner.teamName}) por € ${(currentBid.amount / 1000000).toFixed(1)}M!`,
          timestamp: Date.now(),
          type: 'hammer'
        }
      });
    }
  } else if (currentPlayer) {
    // No bids placed: return to available
    const playerInCatalog = leagueState.players.find((p) => p.id === currentPlayer.id);
    if (playerInCatalog) {
      playerInCatalog.status = 'AVAILABLE';
    }
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `⏳ Tempo esgotado para ${currentPlayer.name} sem nenhum lance. Jogador segue disponível no mercado.`,
        timestamp: Date.now(),
        type: 'info'
      }
    });
  }

  // Reset auction state
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

  saveState();
  broadcastState();
}

// Server ticker for live countdowns
setInterval(() => {
  let stateChanged = false;

  // Active auction countdown
  if (leagueState.auction.status === 'ACTIVE') {
    if (leagueState.auction.timerRemaining > 0) {
      leagueState.auction.timerRemaining -= 1;
      leagueState.auction.lastUpdated = Date.now();
      stateChanged = true;

      // 12 hours warning
      if (leagueState.auction.timerRemaining === 43200) {
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⏳ Restam 12 horas para o término das propostas por ${leagueState.auction.currentPlayer?.name}!`,
            timestamp: Date.now(),
            type: 'info'
          }
        });
      }

      // 1 hour warning
      if (leagueState.auction.timerRemaining === 3600) {
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⏳ Resta 1 hora para o encerramento da rodada de leilão de ${leagueState.auction.currentPlayer?.name}!`,
            timestamp: Date.now(),
            type: 'alert'
          }
        });
      }

      // 10m warning
      if (leagueState.auction.timerRemaining === 600) {
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⚠️ Atenção! Restam 10 minutos para as propostas finais de ${leagueState.auction.currentPlayer?.name}!`,
            timestamp: Date.now(),
            type: 'alert'
          }
        });
      }

      // 1m warning
      if (leagueState.auction.timerRemaining === 60) {
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `🚨 Último minuto! Restam 60 segundos para definir o vencedor de ${leagueState.auction.currentPlayer?.name}!`,
            timestamp: Date.now(),
            type: 'alert'
          }
        });
      }

      // 10s warning
      if (leagueState.auction.timerRemaining === 10) {
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⚠️ Atenção! Restam 10 segundos para o término do leilão de ${leagueState.auction.currentPlayer?.name}!`,
            timestamp: Date.now(),
            type: 'alert'
          }
        });
      }

      // 5s warning
      if (leagueState.auction.timerRemaining === 5) {
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `⏰ Dou-lhe uma... dou-lhe duas... Últimos 5 segundos!`,
            timestamp: Date.now(),
            type: 'alert'
          }
        });
      }
    } else {
      finalizeAuction();
      return;
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

  app.use(express.json());

  // WebSocket Server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send full current state on connect
    ws.send(JSON.stringify({ type: 'STATE_SYNC', data: leagueState }));

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // REST API Endpoints

  // 1. Get full state
  app.get('/api/state', (req: Request, res: Response) => {
    res.json({ success: true, data: leagueState });
  });

  // 2. Auth: Register new account
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { email, name, teamName, password, authProvider } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email é obrigatório.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      res.status(400).json({ success: false, error: 'Por favor informe um email ou Gmail válido.' });
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Nome do treinador é obrigatório.' });
      return;
    }

    if (!teamName || typeof teamName !== 'string' || !teamName.trim()) {
      res.status(400).json({ success: false, error: 'Nome do clube / time é obrigatório.' });
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

    // Password validation (unless gmail connection without password)
    const isGmailAuth = authProvider === 'gmail' || authProvider === 'google';
    if (!isGmailAuth && (!password || password.length < 4)) {
      res.status(400).json({ success: false, error: 'A senha de acesso deve ter pelo menos 4 caracteres.' });
      return;
    }

    const isPereira = cleanEmail === PEREIRA_EMAIL.toLowerCase() || cleanEmail.includes('marquesbrito');
    const isTourinho = cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === 'guilherme.tourinho@gmail.com' || cleanEmail.includes('tourinho');
    const isAdmin = isPereira || isTourinho;

    const user: UserProfile = {
      id: isTourinho ? 'user-admin-tourinho' : isPereira ? 'user-admin-default' : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: isTourinho ? TOURINHO_EMAIL : cleanEmail,
      name: isPereira ? 'Guilherme Pereira' : isTourinho ? 'Guilherme Tourinho' : name.trim(),
      teamName: isPereira ? 'Pereira Galácticos FC' : isTourinho ? 'Tourinho Galácticos FC' : teamName.trim(),
      role: isAdmin ? 'ADMIN' : 'PARTICIPANT',
      adminTitle: isPereira ? 'Diretor' : isTourinho ? 'Presidente' : undefined,
      budget: leagueState.defaultBudget || DEFAULT_BUDGET,
      spent: 0,
      password: isTourinho ? TOURINHO_PASSWORD : (password ? password.trim() : undefined),
      authProvider: authProvider || (cleanEmail.includes('gmail') ? 'gmail' : 'password'),
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

    res.json({ success: true, user, message: 'Conta criada com sucesso!' });
  });

  // 2b. Auth: Login existing user
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, name, teamName, password, authProvider } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email é obrigatório' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const isPereira = cleanEmail === PEREIRA_EMAIL.toLowerCase() || cleanEmail.includes('marquesbrito');
    const isTourinho = cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === 'guilherme.tourinho@gmail.com' || cleanEmail.includes('tourinho');
    const isAdmin = isPereira || isTourinho;

    let user = leagueState.users.find((u) => 
      u.email.toLowerCase() === cleanEmail || 
      (isTourinho && (u.id === 'user-admin-tourinho' || u.email.toLowerCase() === TOURINHO_EMAIL.toLowerCase() || u.email.toLowerCase() === 'guilherme.tourinho@gmail.com'))
    );

    // Verify password if protected
    if (isTourinho) {
      if (password && password !== TOURINHO_PASSWORD) {
        res.status(401).json({ success: false, error: 'Senha incorreta para a conta do Presidente Guilherme Tourinho.' });
        return;
      }
    } else if (user && user.password) {
      const isGoogleAuth = authProvider === 'gmail' || authProvider === 'google';
      if (!isGoogleAuth && (!password || password !== user.password)) {
        res.status(401).json({ success: false, error: 'Senha incorreta para esta conta.' });
        return;
      }
    }

    if (!user) {
      // If user provided name and teamName, allow creation for convenience
      if (name && teamName) {
        user = {
          id: isTourinho ? 'user-admin-tourinho' : isPereira ? 'user-admin-default' : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          email: isTourinho ? TOURINHO_EMAIL : cleanEmail,
          name: isPereira ? 'Guilherme Pereira' : isTourinho ? 'Guilherme Tourinho' : (name?.trim() || cleanEmail.split('@')[0]),
          teamName: isPereira ? 'Pereira Galácticos FC' : isTourinho ? 'Tourinho Galácticos FC' : (teamName?.trim() || `${name?.trim() || 'Meu Time'} FC`),
          role: isAdmin ? 'ADMIN' : 'PARTICIPANT',
          adminTitle: isPereira ? 'Diretor' : isTourinho ? 'Presidente' : undefined,
          budget: leagueState.defaultBudget || DEFAULT_BUDGET,
          spent: 0,
          password: isTourinho ? TOURINHO_PASSWORD : (password || undefined),
          authProvider: authProvider || (cleanEmail.includes('gmail') ? 'gmail' : 'password'),
          createdAt: Date.now()
        };
        leagueState.users.push(user);

        // Initialize squad
        leagueState.squads[user.id] = {
          userId: user.id,
          formationId: '4-3-3',
          starterSlots: {},
          benchPlayerIds: []
        };

        saveState();
        broadcastState();
      } else {
        res.status(404).json({ 
          success: false, 
          error: 'Nenhuma conta cadastrada com este email. Clique na aba "Cadastrar" para criar sua conta agora.' 
        });
        return;
      }
    } else {
      // Update existing user credentials and permissions
      if (isPereira) {
        user.role = 'ADMIN';
        user.name = 'Guilherme Pereira';
        user.adminTitle = 'Diretor';
      } else if (isTourinho) {
        user.email = TOURINHO_EMAIL;
        user.role = 'ADMIN';
        user.name = 'Guilherme Tourinho';
        user.adminTitle = 'Presidente';
        user.password = TOURINHO_PASSWORD;
      } else {
        if (name && name.trim()) user.name = name.trim();
        if (teamName && teamName.trim()) user.teamName = teamName.trim();
        if (password) user.password = password;
        if (authProvider) user.authProvider = authProvider;
      }
      saveState();
      broadcastState();
    }

    res.json({ success: true, user });
  });

  // 2c. Auth: Direct Gmail / Google Connect
  app.post('/api/auth/google', (req: Request, res: Response) => {
    const { email, name, teamName, avatarUrl } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email do Gmail é obrigatório' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const isPereira = cleanEmail === PEREIRA_EMAIL.toLowerCase() || cleanEmail.includes('marquesbrito');
    const isTourinho = cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === 'guilherme.tourinho@gmail.com' || cleanEmail.includes('tourinho');
    const isAdmin = isPereira || isTourinho;

    let user = leagueState.users.find((u) => u.email.toLowerCase() === cleanEmail);
    let isNew = false;

    if (!user) {
      isNew = true;
      const trainerName = isPereira ? 'Guilherme Pereira' : isTourinho ? 'Guilherme Tourinho' : (name?.trim() || cleanEmail.split('@')[0]);
      const clubName = isPereira ? 'Pereira Galácticos FC' : isTourinho ? 'Tourinho Galácticos FC' : (teamName?.trim() || `${trainerName} FC`);

      user = {
        id: isTourinho ? 'user-admin-tourinho' : isPereira ? 'user-admin-default' : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        name: trainerName,
        teamName: clubName,
        role: isAdmin ? 'ADMIN' : 'PARTICIPANT',
        adminTitle: isPereira ? 'Diretor' : isTourinho ? 'Presidente' : undefined,
        budget: leagueState.defaultBudget || DEFAULT_BUDGET,
        spent: 0,
        avatarUrl: avatarUrl || undefined,
        authProvider: 'gmail',
        createdAt: Date.now()
      };
      leagueState.users.push(user);

      // Initialize squad
      leagueState.squads[user.id] = {
        userId: user.id,
        formationId: '4-3-3',
        starterSlots: {},
        benchPlayerIds: []
      };
    } else {
      if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      user.authProvider = 'gmail';
      if (isPereira) {
        user.role = 'ADMIN';
        user.adminTitle = 'Diretor';
      } else if (isTourinho) {
        user.role = 'ADMIN';
        user.adminTitle = 'Presidente';
      }
    }

    saveState();
    broadcastState();

    res.json({ 
      success: true, 
      user, 
      isNew,
      message: isNew ? 'Conta criada e conectada com sucesso via Gmail!' : 'Login realizado com sucesso via Gmail!' 
    });
  });

  // 2d. Auth: Reset / Recover password
  app.post('/api/auth/reset-password', (req: Request, res: Response) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      res.status(400).json({ success: false, error: 'Email e nova senha são obrigatórios.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === TOURINHO_EMAIL.toLowerCase() || cleanEmail === PEREIRA_EMAIL.toLowerCase()) {
      res.status(403).json({ success: false, error: 'Contas da Presidência e Diretoria possuem segurança administrativa restrita.' });
      return;
    }

    if (newPassword.trim().length < 4) {
      res.status(400).json({ success: false, error: 'A nova senha deve ter pelo menos 4 caracteres.' });
      return;
    }

    const user = leagueState.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      res.status(404).json({ success: false, error: 'Nenhuma conta cadastrada com este email.' });
      return;
    }

    user.password = newPassword.trim();
    saveState();
    broadcastState();

    res.json({ success: true, message: 'Senha atualizada com sucesso! Você já pode entrar com a nova senha.' });
  });

  // 2e. Auth: Update profile info
  app.post('/api/auth/update-profile', (req: Request, res: Response) => {
    const { userId, name, teamName, password } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    if (name && name.trim()) user.name = name.trim();
    if (teamName && teamName.trim()) user.teamName = teamName.trim();
    if (password && password.trim().length >= 4) user.password = password.trim();

    saveState();
    broadcastState();

    res.json({ success: true, user, message: 'Perfil atualizado com sucesso!' });
  });

  // 3. Nominate / Post player for auction (Todos os usuários podem postar jogadores de interesse)
  app.post('/api/auction/nominate', (req: Request, res: Response) => {
    const { userId, playerId } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'Faça login para postar um jogador de interesse no leilão' });
      return;
    }

    // Check if the overall auction is started by the admin
    if (leagueState.auction.status === 'NOT_STARTED') {
      if (user.role === 'ADMIN') {
        // Se o próprio administrador estiver postando, inicia a liga diretamente
        leagueState.auction.status = 'IDLE';
      } else {
        res.status(400).json({ 
          success: false, 
          error: 'O leilão oficial ainda não foi aberto pelo comissário. Assim que aberto, qualquer participante poderá postar jogadores livremente!' 
        });
        return;
      }
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

    if (!leagueState.auction.nominationQueue) {
      leagueState.auction.nominationQueue = [];
    }

    // Se já existe um leilão em andamento, insere o jogador na Fila de Jogadores de Interesse
    if (leagueState.auction.status === 'ACTIVE' && leagueState.auction.currentPlayer) {
      if (leagueState.auction.nominationQueue.some((q) => q.player.id === player.id)) {
        res.status(400).json({ 
          success: false, 
          error: `O atleta ${player.name} já foi postado e já está na fila de espera para os próximos leilões de 24h!` 
        });
        return;
      }

      leagueState.auction.nominationQueue.push({
        player,
        nominatedByUserId: user.id,
        nominatedByUserName: user.name,
        nominatedByTeamName: user.teamName,
        nominatedAt: Date.now()
      });

      saveState();
      broadcastState();
      broadcast({
        type: 'CHAT_NOTIFICATION',
        data: {
          message: `📋 ${user.name} (${user.teamName}) postou ${player.name} (${player.position} - ${player.club})! Adicionado à fila de interesse (#${leagueState.auction.nominationQueue.length}).`,
          timestamp: Date.now(),
          type: 'info'
        }
      });

      res.json({ 
        success: true, 
        queued: true,
        queuePosition: leagueState.auction.nominationQueue.length,
        message: `${player.name} adicionado à fila de interesse! Abrirá propostas de 24h logo que a rodada atual terminar.`,
        auction: leagueState.auction 
      });
      return;
    }

    // Se leilão está IDLE, abre imediatamente a rodada de 24h para o jogador
    player.status = 'IN_AUCTION';
    player.nominatedBy = user.id;

    leagueState.auction.status = 'ACTIVE';
    leagueState.auction.currentPlayer = player;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    leagueState.auction.timerRemaining = 86400; // 24 hours per round (86400s)
    leagueState.auction.lastUpdated = Date.now();

    saveState();

    broadcast({
      type: 'AUCTION_STARTED',
      data: {
        player,
        auction: leagueState.auction
      }
    });

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `📢 ${user.name} (${user.teamName}) postou ${player.name} (${player.position} - ${player.club}) por lance inicial de € ${(player.initialPrice / 1000000).toFixed(1)}M! Propostas abertas por 24 horas.`,
        timestamp: Date.now(),
        type: 'info'
      }
    });

    broadcastState();
    res.json({ success: true, queued: false, auction: leagueState.auction });
  });

  // Remover jogador da fila de interesse
  app.post('/api/auction/queue/remove', (req: Request, res: Response) => {
    const { userId, playerId } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    if (!leagueState.auction.nominationQueue) {
      leagueState.auction.nominationQueue = [];
    }

    const itemIndex = leagueState.auction.nominationQueue.findIndex((q) => q.player.id === playerId);
    if (itemIndex === -1) {
      res.status(404).json({ success: false, error: 'Jogador não está na fila' });
      return;
    }

    const item = leagueState.auction.nominationQueue[itemIndex];
    if (item.nominatedByUserId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Apenas quem postou ou o administrador pode remover da fila' });
      return;
    }

    leagueState.auction.nominationQueue.splice(itemIndex, 1);
    saveState();
    broadcastState();
    res.json({ success: true, auction: leagueState.auction });
  });

  // Forçar início de jogador da fila (Admin ou quando IDLE)
  app.post('/api/auction/queue/start-now', (req: Request, res: Response) => {
    const { userId, playerId } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Apenas administradores podem forçar início imediato da fila' });
      return;
    }

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

  // 4. Place a bid
  app.post('/api/auction/bid', (req: Request, res: Response) => {
    const { userId, amount } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      return;
    }

    if (leagueState.auction.status !== 'ACTIVE' || !leagueState.auction.currentPlayer) {
      res.status(400).json({ success: false, error: 'Nenhum leilão ativo no momento' });
      return;
    }

    const player = leagueState.auction.currentPlayer;

    // Regra Inviolável Anti-Burla: Validar rigorosamente se o jogador em disputa pertence à fase do dia
    const currentDay = leagueState.auction.auctionDay || 1;
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

    const currentHighest = leagueState.auction.currentBid ? leagueState.auction.currentBid.amount : 0;
    const minRequired = currentHighest > 0
      ? currentHighest + leagueState.auction.minimumBidIncrement
      : player.initialPrice;

    const bidAmount = Number(amount);
    if (isNaN(bidAmount) || bidAmount < minRequired) {
      res.status(400).json({
        success: false,
        error: `O lance mínimo deve ser de € ${(minRequired / 1000000).toFixed(1)}M`
      });
      return;
    }

    if (user.budget < bidAmount) {
      res.status(400).json({
        success: false,
        error: `Saldo insuficiente! Seu saldo atual é de € ${(user.budget / 1000000).toFixed(1)}M`
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

    // Do not allow bidding against yourself
    if (leagueState.auction.currentBid && leagueState.auction.currentBid.userId === user.id) {
      res.status(400).json({ success: false, error: 'Você já possui o maior lance atual!' });
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
      amount: bidAmount,
      timestamp: Date.now(),
      isAnonymous
    };

    leagueState.auction.currentBid = newBid;
    leagueState.auction.bidHistory.unshift(newBid);
    player.currentPrice = bidAmount;

    // Anti-snipe rule: If timer < 300s (5 minutes), extend to 300s to allow counter-bids
    if (leagueState.auction.timerRemaining < 300) {
      leagueState.auction.timerRemaining = 300;
    }
    leagueState.auction.lastUpdated = Date.now();

    saveState();

    broadcast({
      type: 'NEW_BID',
      data: {
        bid: newBid,
        auction: leagueState.auction
      }
    });

    // Conforme a Ata: Sigilo absoluto de lances durante a disputa
    const bidNotification = isAnonymous
      ? `💰 Um clube concorrente (Sigilo de Lances) cobriu a oferta de ${player.name} para € ${(bidAmount / 1000000).toFixed(1)}M!`
      : `💰 ${user.name} cobriu a oferta de ${player.name} para € ${(bidAmount / 1000000).toFixed(1)}M!`;

    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: bidNotification,
        timestamp: Date.now(),
        type: 'bid'
      }
    });

    broadcastState();
    res.json({ success: true, bid: newBid, auction: leagueState.auction });
  });

  // 5. Pass nomination turn
  app.post('/api/auction/pass-turn', (req: Request, res: Response) => {
    const { userId } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      return;
    }

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

  // 6. Save User Squad (Formation, Starters, Bench)
  app.post('/api/squad/save', (req: Request, res: Response) => {
    const { userId, formationId, starterSlots, benchPlayerIds } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: 'ID do usuário é obrigatório' });
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

    leagueState.squads[userId] = {
      userId,
      formationId: formationId || '4-3-3',
      starterSlots: starterSlots || {},
      benchPlayerIds: benchPlayerIds || []
    };

    saveState();
    broadcastState();
    res.json({ success: true, squad: leagueState.squads[userId] });
  });

  // ADMIN ENDPOINTS

  // Check admin helper - permits administrators (Guilherme Pereira & Guilherme Tourinho)
  function checkAdmin(req: Request, res: Response): boolean {
    const adminId = req.headers['x-user-id'] as string;
    const user = leagueState.users.find((u) => u.id === adminId);
    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ 
        success: false, 
        error: 'Acesso restrito exclusivamente à Diretoria e Presidência da Khedira League (Guilherme Pereira & Guilherme Tourinho)' 
      });
      return false;
    }
    return true;
  }

  // 6.1. Adicionar Jogador Extra (Não Cadastrado) - Conforme Seção 2 da Ata Oficial
  app.post('/api/players/add-extra', (req: Request, res: Response) => {
    const { userId, name, position, club, nationality, initialPrice } = req.body;
    const user = leagueState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não autenticado' });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Nome do jogador é obrigatório' });
      return;
    }
    if (!position) {
      res.status(400).json({ success: false, error: 'Posição do jogador é obrigatória' });
      return;
    }

    const price = Number(initialPrice);
    // Lance Mínimo para Extras: Qualquer jogador adicionado manualmente à lista terá um lance mínimo obrigatório de 10 Milhões de Euros.
    const MIN_EXTRA_PRICE = 10000000; // € 10.000.000
    if (isNaN(price) || price < MIN_EXTRA_PRICE) {
      res.status(400).json({
        success: false,
        error: 'Conforme a Ata Oficial, qualquer jogador adicionado manualmente à lista terá um lance mínimo obrigatório de € 10 Milhões de Euros (€ 10M).'
      });
      return;
    }

    const newPlayer: Player = {
      id: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      position,
      club: (club && club.trim()) || 'Sem Clube (Livre)',
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
        message: `📝 Jogador Extra inserido na lista: ${newPlayer.name} (${newPlayer.position} - ${newPlayer.club}) com lance mínimo obrigatório de € ${(price / 1000000).toFixed(1)}M por ${user.name} sob supervisão do Presidente!`,
        timestamp: Date.now(),
        type: 'info'
      }
    });

    broadcastState();
    res.json({ success: true, player: newPlayer });
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
    const { targetUserId, budget } = req.body;
    const target = leagueState.users.find((u) => u.id === targetUserId);
    if (!target) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    target.budget = Number(budget);
    saveState();
    broadcastState();
    res.json({ success: true, user: target });
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
    const adminId = req.headers['x-user-id'] as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    const adminLeaderLabel = adminUser?.adminTitle === 'Diretor'
      ? 'O Diretor Guilherme Pereira'
      : adminUser?.adminTitle === 'Presidente'
      ? 'O Presidente Guilherme Tourinho'
      : (adminUser ? `${adminUser.name} (${adminUser.adminTitle || 'Admin'})` : 'A Diretoria');

    switch (action) {
      case 'START_LEAGUE_AUCTION':
        leagueState.auction.status = 'IDLE';
        leagueState.auction.nominationTimerRemaining = 45;
        if (!leagueState.auction.nominationTurnUserId && leagueState.users.length > 0) {
          leagueState.auction.nominationTurnUserId = leagueState.users[0].id;
        }
        leagueState.auction.lastUpdated = Date.now();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: `🚀 ${adminLeaderLabel} iniciou oficialmente o Leilão da Khedira League! Orçamento de € 400M por clube. Participantes, a disputa começou!`,
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
        if (leagueState.auction.currentPlayer) {
          const p = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
          if (p) p.status = 'AVAILABLE';
        }
        leagueState.auction.status = 'ENDED';
        leagueState.auction.currentPlayer = null;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
        leagueState.auction.timerRemaining = 0;
        leagueState.auction.lastUpdated = Date.now();
        broadcast({
          type: 'CHAT_NOTIFICATION',
          data: {
            message: '🏁 O Administrador encerrou a sessão de leilões da Khedira League. Parabéns pelos elencos montados!',
            timestamp: Date.now(),
            type: 'alert'
          }
        });
        break;
      case 'RESET_TO_NOT_STARTED':
        if (leagueState.auction.currentPlayer) {
          const p = leagueState.players.find((pl) => pl.id === leagueState.auction.currentPlayer?.id);
          if (p) p.status = 'AVAILABLE';
        }
        leagueState.auction.status = 'NOT_STARTED';
        leagueState.auction.currentPlayer = null;
        leagueState.auction.currentBid = null;
        leagueState.auction.bidHistory = [];
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
      case 'FORCE_FINISH':
        if (leagueState.auction.status === 'ACTIVE' || leagueState.auction.status === 'PAUSED') {
          finalizeAuction();
        }
        break;
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

    // 1. Devolver todos os jogadores para o mercado como disponíveis
    leagueState.players.forEach((p) => {
      p.status = 'AVAILABLE';
      p.soldTo = undefined;
      p.nominatedBy = undefined;
      p.currentPrice = p.initialPrice;
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

    // 3. Reiniciar estado do leilão
    leagueState.auction.status = 'NOT_STARTED';
    leagueState.auction.currentPlayer = null;
    leagueState.auction.currentBid = null;
    leagueState.auction.bidHistory = [];
    leagueState.auction.timerRemaining = 0;
    leagueState.auction.nominationTimerRemaining = 45;
    leagueState.auction.nominationTurnUserId = leagueState.users[0]?.id || 'user-admin-default';
    leagueState.auction.lastUpdated = Date.now();

    // 4. Notificar a todos em tempo real
    broadcast({
      type: 'CHAT_NOTIFICATION',
      data: {
        message: `🔄 ${adminLabel} executou o Reset de Mercado e Elencos: todos os atletas retornaram ao mercado e o orçamento total (€ ${(leagueState.defaultBudget / 1000000).toFixed(0)}M) foi 100% devolvido a todos os clubes!`,
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
      message: `Reset executado com sucesso: todos os jogadores voltaram para o mercado e o orçamento de € ${(leagueState.defaultBudget / 1000000).toFixed(0)}M foi devolvido aos clubes.` 
    });
  });

  app.post('/api/admin/reset-market-squads', (req: Request, res: Response) => {
    if (!checkAdmin(req, res)) return;
    const adminId = req.headers['x-user-id'] as string;
    const adminUser = leagueState.users.find((u) => u.id === adminId);
    executeResetMarketAndSquads(adminUser);
    res.json({ 
      success: true, 
      message: `Reset executado com sucesso: todos os jogadores voltaram para o mercado e o orçamento de € ${(leagueState.defaultBudget / 1000000).toFixed(0)}M foi devolvido aos clubes.` 
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
