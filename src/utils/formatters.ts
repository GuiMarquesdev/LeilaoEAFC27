import { PlayerPosition, Player, AuctionState, Bid, AuctionType, AuctionPhase } from '../types';

export function getPlayerActiveBid(player: Player | null | undefined, auction?: AuctionState | null): Bid | null {
  if (!player) return null;

  const candidates: Bid[] = [];

  // 1. Direct currentBid on player
  if (player.currentBid && typeof player.currentBid.amount === 'number' && player.currentBid.amount > 0) {
    candidates.push(player.currentBid);
  }

  // 2. Global auction currentBid if player matches currentPlayer
  if (auction?.currentPlayer?.id === player.id && auction.currentBid && typeof auction.currentBid.amount === 'number' && auction.currentBid.amount > 0) {
    candidates.push(auction.currentBid);
  }

  // 3. Player's own bidHistory
  if (player.bidHistory && player.bidHistory.length > 0) {
    for (const b of player.bidHistory) {
      if (b && typeof b.amount === 'number' && b.amount > 0) {
        candidates.push(b);
      }
    }
  }

  // 4. Global auction.bidHistory for this specific player
  if (auction?.bidHistory && auction.bidHistory.length > 0) {
    for (const b of auction.bidHistory) {
      if (b && (b.playerId === player.id || (b.playerName && b.playerName === player.name)) && typeof b.amount === 'number' && b.amount > 0) {
        candidates.push(b);
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick candidate with highest amount; if tie, newest timestamp
  candidates.sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return candidates[0];
}

export function getPlayerEffectivePrice(player: Player | null | undefined, auction?: AuctionState | null): number {
  if (!player) return 0;

  // If sold, return final sold amount
  if (player.status === 'SOLD' && player.soldTo?.amount) {
    return player.soldTo.amount;
  }

  // Find the highest active bid amount
  const activeBid = getPlayerActiveBid(player, auction);
  const activeBidAmount = activeBid && typeof activeBid.amount === 'number' ? activeBid.amount : 0;

  // Check player currentPrice and initialPrice
  const playerCurrentPrice = typeof player.currentPrice === 'number' ? player.currentPrice : 0;
  const initialPrice = typeof player.initialPrice === 'number' && player.initialPrice > 0 ? player.initialPrice : 10000000;

  return Math.max(activeBidAmount, playerCurrentPrice, initialPrice);
}

export function formatCurrency(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 1000000) {
      return `€ ${(amount / 1000000).toFixed(1).replace('.0', '')}M`;
    }
    if (amount >= 1000) {
      return `€ ${(amount / 1000).toFixed(0)}K`;
    }
    return `€ ${amount}`;
  }

  // Format with dots e.g. € 25.000.000
  return `€ ${amount.toLocaleString('pt-BR')}`;
}

export interface AuctionPhaseDefinition {
  id: AuctionPhase;
  name: string;
  label: string;
  shortLabel: string;
  positions: PlayerPosition[];
  icon: string;
  description: string;
  badgeClass: string;
  activeClass: string;
  borderClass: string;
  accentColor: string;
}

export const AUCTION_PHASES: AuctionPhaseDefinition[] = [
  {
    id: 'GOLEIROS',
    name: 'Goleiros',
    label: '1ª Fase: Goleiros',
    shortLabel: 'Goleiros',
    positions: ['GOL'],
    icon: '🧤',
    description: 'Apenas goleiros (GOL) liberados para postagem e propostas.',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    activeClass: 'bg-amber-500 text-white shadow-amber-200',
    borderClass: 'border-amber-400',
    accentColor: 'amber'
  },
  {
    id: 'DEFENSORES',
    name: 'Defensores',
    label: '2ª Fase: Defensores',
    shortLabel: 'Defensores',
    positions: ['ZAG', 'LE', 'LD'],
    icon: '🛡️',
    description: 'Zagueiros e Laterais (ZAG, LE, LD) liberados para postagem e lances.',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    activeClass: 'bg-blue-600 text-white shadow-blue-200',
    borderClass: 'border-blue-400',
    accentColor: 'blue'
  },
  {
    id: 'MEIO_CAMPO',
    name: 'Meio-Campo',
    label: '3ª Fase: Meio-Campo',
    shortLabel: 'Meio-Campo',
    positions: ['VOL', 'MC', 'MEI', 'MD', 'ME'],
    icon: '⚡',
    description: 'Volantes, Meias Centrais e Meias Ofensivos liberados.',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    activeClass: 'bg-emerald-600 text-white shadow-emerald-200',
    borderClass: 'border-emerald-400',
    accentColor: 'emerald'
  },
  {
    id: 'ATACANTES',
    name: 'Atacantes',
    label: '4ª Fase: Atacantes',
    shortLabel: 'Atacantes',
    positions: ['ATA', 'PD', 'PE', 'SA'],
    icon: '⚽',
    description: 'Centroavantes, Pontas e Segundos Atacantes liberados.',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    activeClass: 'bg-rose-600 text-white shadow-rose-200',
    borderClass: 'border-rose-400',
    accentColor: 'rose'
  }
];

export function getPhaseInfo(phase?: AuctionPhase): AuctionPhaseDefinition {
  return AUCTION_PHASES.find((p) => p.id === phase) || AUCTION_PHASES[0];
}

export function getPlayerPhaseKey(position: string): AuctionPhase {
  if (position === 'GOL') return 'GOLEIROS';
  if (['ZAG', 'LE', 'LD'].includes(position)) return 'DEFENSORES';
  if (['VOL', 'MC', 'MEI', 'MD', 'ME'].includes(position)) return 'MEIO_CAMPO';
  return 'ATACANTES';
}

export function isPlayerInActivePhase(
  position: string,
  auction?: { auctionType?: AuctionType; currentPhase?: AuctionPhase }
): boolean {
  if (!auction || auction.auctionType !== 'PHASED') return true;
  const currentPhase = auction.currentPhase || 'GOLEIROS';
  const phaseDef = getPhaseInfo(currentPhase);
  return (phaseDef.positions as string[]).includes(position);
}

export function isPositionAllowedForDay(
  position: string, 
  auctionOrDay?: 1 | 2 | 3 | 'ALL' | { auctionType?: AuctionType; currentPhase?: AuctionPhase }
): boolean {
  if (typeof auctionOrDay === 'object' && auctionOrDay !== null) {
    return isPlayerInActivePhase(position, auctionOrDay);
  }
  return true;
}

export function getPlayerSectorName(position: string): 'Goleiro' | 'Defesa' | 'Meio-Campo' | 'Ataque' {
  if (position === 'GOL') return 'Goleiro';
  if (['ZAG', 'LE', 'LD'].includes(position)) return 'Defesa';
  if (['VOL', 'MC', 'MEI'].includes(position)) return 'Meio-Campo';
  return 'Ataque';
}

export function getPlayerAuctionDay(position: string): 1 | 2 | 3 {
  if (['GOL', 'ZAG', 'LE', 'LD'].includes(position)) return 1;
  if (['VOL', 'MC', 'MEI'].includes(position)) return 2;
  return 3;
}

export function getDayLabel(
  auctionOrDay?: 1 | 2 | 3 | 'ALL' | { auctionType?: AuctionType; currentPhase?: AuctionPhase }
): { title: string; subtitle: string; positions: string[] } {
  if (typeof auctionOrDay === 'object' && auctionOrDay !== null && auctionOrDay.auctionType === 'PHASED') {
    const phase = getPhaseInfo(auctionOrDay.currentPhase || 'GOLEIROS');
    return {
      title: `Leilão por Fases • ${phase.label}`,
      subtitle: phase.description,
      positions: phase.positions
    };
  }

  return {
    title: 'Leilão Livre (Todas as Posições)',
    subtitle: 'Goleiros, Defensores, Meio-Campo e Atacantes liberados simultaneamente',
    positions: ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'MD', 'ME', 'PE', 'PD', 'SA', 'ATA']
  };
}

export function getPositionBadge(position: PlayerPosition): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (position) {
    case 'GOL':
      return {
        label: 'Goleiro',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-200'
      };
    case 'ZAG':
    case 'LE':
    case 'LD':
      return {
        label: position === 'ZAG' ? 'Zagueiro' : position === 'LE' ? 'Lat. Esquerdo' : 'Lat. Direito',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-800',
        borderClass: 'border-blue-200'
      };
    case 'VOL':
    case 'MC':
    case 'MEI':
    case 'MD':
    case 'ME':
      return {
        label:
          position === 'VOL'
            ? 'Volante'
            : position === 'MEI'
            ? 'Meia Ofensivo'
            : position === 'MD'
            ? 'Meia Direita'
            : position === 'ME'
            ? 'Meia Esquerda'
            : 'Meio-Campo',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-200'
      };
    case 'ATA':
    case 'PD':
    case 'PE':
    case 'SA':
    default:
      return {
        label: position === 'ATA' ? 'Atacante' : position === 'PD' ? 'Ponta Direita' : 'Ponta Esquerda',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-800',
        borderClass: 'border-rose-200'
      };
  }
}

export function getPositionCategory(position: PlayerPosition): 'GOL' | 'DEF' | 'MEI' | 'ATA' {
  if (position === 'GOL') return 'GOL';
  if (['ZAG', 'LE', 'LD'].includes(position)) return 'DEF';
  if (['VOL', 'MC', 'MEI', 'MD', 'ME'].includes(position)) return 'MEI';
  return 'ATA';
}

export function getUserRoleBadge(user?: { name?: string; email?: string; adminTitle?: string; role?: string } | null): {
  isLeader: boolean;
  title: string;
  badgeLabel: string;
  badgeClass: string;
} {
  if (!user || user.role !== 'ADMIN') {
    return {
      isLeader: false,
      title: 'Participante',
      badgeLabel: 'Participante',
      badgeClass: 'bg-slate-100 text-slate-700'
    };
  }

  const nameLower = (user.name || '').toLowerCase();
  const emailLower = (user.email || '').toLowerCase();

  // Guilherme Pereira Marques Brito -> Diretor
  if (
    user.adminTitle === 'Diretor' || 
    emailLower === 'guimarquesbrito@gmail.com' || 
    nameLower.includes('pereira') ||
    nameLower.includes('marques brito')
  ) {
    return {
      isLeader: true,
      title: 'Diretor',
      badgeLabel: '👑 Diretor',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300'
    };
  }

  // Guilherme Tourinho -> Presidente
  if (
    user.adminTitle === 'Presidente' || 
    nameLower.includes('tourinho') ||
    emailLower.includes('tourinho')
  ) {
    return {
      isLeader: true,
      title: 'Presidente',
      badgeLabel: '👑 Presidente',
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300'
    };
  }

  return {
    isLeader: true,
    title: 'Administrador',
    badgeLabel: '👑 Admin',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300'
  };
}

export function isCompatiblePosition(slotRole: string, playerPos: string): boolean {
  if (slotRole === playerPos) return true;
  if (slotRole === 'GOL') return playerPos === 'GOL';
  if (slotRole === 'ZAG') return ['ZAG'].includes(playerPos);
  if (slotRole === 'LE') return ['LE', 'LD', 'ZAG'].includes(playerPos);
  if (slotRole === 'LD') return ['LD', 'LE', 'ZAG'].includes(playerPos);
  if (slotRole === 'VOL') return ['VOL', 'MC'].includes(playerPos);
  if (slotRole === 'MC') return ['MC', 'VOL', 'MEI'].includes(playerPos);
  if (slotRole === 'MEI') return ['MEI', 'MC', 'ME', 'MD'].includes(playerPos);
  if (slotRole === 'ME') return ['ME', 'PE', 'MC', 'MEI'].includes(playerPos);
  if (slotRole === 'MD') return ['MD', 'PD', 'MC', 'MEI'].includes(playerPos);
  if (slotRole === 'PE') return ['PE', 'ME', 'ATA'].includes(playerPos);
  if (slotRole === 'PD') return ['PD', 'MD', 'ATA'].includes(playerPos);
  if (slotRole === 'ATA') return ['ATA', 'SA', 'PE', 'PD'].includes(playerPos);
  return false;
}

export function getPlayerAuctionPhase(player: { position: string; soldTo?: { auctionDay?: 1 | 2 | 3 | 'ALL' } }): 1 | 2 | 3 {
  if (player.soldTo?.auctionDay && typeof player.soldTo.auctionDay === 'number') {
    return player.soldTo.auctionDay as 1 | 2 | 3;
  }
  if (['GOL', 'ZAG', 'LE', 'LD'].includes(player.position)) return 1;
  if (['VOL', 'MC', 'MEI'].includes(player.position)) return 2;
  if (['ATA', 'PD', 'PE', 'MD', 'ME', 'SA'].includes(player.position)) return 3;
  return 1;
}

export function formatAuctionTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export function normalizeSearchString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesPlayerSearch(
  player: { name: string; club?: string; nationality?: string; position?: string },
  query: string
): boolean {
  if (!query) return true;
  const cleanTerm = normalizeSearchString(query);
  if (!cleanTerm) return true;

  const cleanName = normalizeSearchString(player.name);
  const cleanClub = normalizeSearchString(player.club || '');
  const cleanNat = normalizeSearchString(player.nationality || '');
  const cleanPos = normalizeSearchString(player.position || '');

  // Direct substring check
  if (
    cleanName.includes(cleanTerm) ||
    cleanClub.includes(cleanTerm) ||
    cleanNat.includes(cleanTerm) ||
    cleanPos.includes(cleanTerm)
  ) {
    return true;
  }

  // Abbreviated first name matching, e.g. "t. courtois", "t courtois", "w. saliba"
  const abbrevMatch = cleanTerm.match(/^([a-z])\.?\s+(.+)$/);
  if (abbrevMatch) {
    const initial = abbrevMatch[1];
    const rest = abbrevMatch[2];
    const nameParts = cleanName.split(/\s+/);
    if (nameParts.length >= 2) {
      const firstInitial = nameParts[0][0];
      const remainder = nameParts.slice(1).join(' ');
      if (firstInitial === initial && remainder.includes(rest)) {
        return true;
      }
    }
  }

  // Dot-free comparison (e.g. "vini jr." vs "vini jr")
  const termNoPunct = cleanTerm.replace(/[.\-_]/g, '');
  const nameNoPunct = cleanName.replace(/[.\-_]/g, '');
  if (nameNoPunct.includes(termNoPunct)) {
    return true;
  }

  return false;
}

