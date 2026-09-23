export type UserRole = 'ADMIN' | 'PARTICIPANT';

export type PlayerPosition = 
  | 'GOL' 
  | 'ZAG' | 'LE' | 'LD' 
  | 'VOL' | 'MC' | 'MEI' | 'MD' | 'ME' 
  | 'ATA' | 'PD' | 'PE' | 'SA';

export type PlayerStatus = 'AVAILABLE' | 'IN_AUCTION' | 'SOLD';

export interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  club: string;
  nationality: string;
  initialPrice: number; // in fictional currency (e.g., 25000000 = €25M)
  currentPrice: number;
  status: PlayerStatus;
  currentBid?: Bid | null;
  bidHistory?: Bid[];
  auctionExpiresAt?: number;
  timerRemaining?: number;
  soldTo?: {
    userId: string;
    userName: string;
    teamName: string;
    amount: number;
    auctionDay?: 1 | 2 | 3 | 'ALL';
    soldAt?: number;
  };
  nominatedBy?: string; // userId who nominated
  isManualExtra?: boolean; // Jogador extra adicionado manualmente conforme o regulamento
}

export interface Bid {
  id: string;
  playerId: string;
  playerName: string;
  userId: string;
  userName: string;
  teamName: string;
  userEmail: string;
  amount: number;
  timestamp: number;
  isAnonymous?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  teamName: string;
  role: UserRole;
  adminTitle?: 'Diretor' | 'Presidente';
  budget: number; // fictional funds available
  spent: number;
  avatarUrl?: string;
  password?: string;
  passwordHash?: string;
  authProvider?: 'gmail' | 'google' | 'password' | string;
  createdAt: number;
}

export interface NominationQueueItem {
  player: Player;
  nominatedByUserId: string;
  nominatedByUserName: string;
  nominatedByTeamName: string;
  nominatedAt: number;
}

export interface AuctionState {
  status: 'NOT_STARTED' | 'IDLE' | 'NOMINATING' | 'ACTIVE' | 'PAUSED' | 'FINALIZING' | 'ENDED';
  currentPlayer: Player | null;
  currentBid: Bid | null;
  bidHistory: Bid[];
  timerRemaining: number; // in seconds
  nominationTurnUserId: string | null;
  nominationTimerRemaining: number; // in seconds
  isFreeNominationMode: boolean; // if true, any participant can nominate
  nominationQueue?: NominationQueueItem[]; // Fila de jogadores de interesse postados pelos participantes
  minimumBidIncrement: number; // e.g., 1000000 (€1M)
  auctionDay: 1 | 2 | 3 | 'ALL'; // Dia 1: Defesa (GOL/ZAG/LE/LD), Dia 2: Meio (VOL/MC/MEI), Dia 3: Ataque (ATA/ME/MD/PE/PD/SA), 'ALL': Todas
  anonymousBidding: boolean; // Sigilo de Lances obrigatório conforme Ata Oficial
  lastUpdated: number;
}

export interface FormationSlot {
  slotId: string;
  role: string; // e.g. "GOL", "ZAG-E", "ATA", etc.
  x: number; // percentage on pitch (0 - 100)
  y: number; // percentage on pitch (0 - 100)
  assignedPlayerId?: string | null;
  isPermanent?: boolean; // true if won in auction
}

export interface TacticalFormation {
  id: string;
  name: string; // e.g. "4-3-3 Ofensivo", "4-4-2 Clássico", "4-2-3-1"
  slots: FormationSlot[];
}

export interface UserSquad {
  userId: string;
  formationId: string;
  starterSlots: { [slotId: string]: string | null }; // slotId -> playerId
  benchPlayerIds: string[]; // reserve players
}

export const MAX_SQUAD_PLAYERS = 23;

export interface LeagueState {
  users: UserProfile[];
  players: Player[];
  auction: AuctionState;
  squads: { [userId: string]: UserSquad };
  defaultBudget: number;
}

export type WSMessage = 
  | { type: 'STATE_SYNC'; data: LeagueState }
  | { type: 'NEW_BID'; data: { bid: Bid; auction: AuctionState; player?: Player } }
  | { type: 'AUCTION_STARTED'; data: { player: Player; auction: AuctionState; bid?: Bid } }
  | { type: 'AUCTION_HAMMER'; data: { winner: UserProfile; player: Player; finalPrice: number } }
  | { type: 'NOMINATION_TURN_CHANGE'; data: { userId: string | null; userName?: string } }
  | { type: 'CHAT_NOTIFICATION'; data: { message: string; timestamp: number; type?: 'info' | 'bid' | 'hammer' | 'alert' } };
