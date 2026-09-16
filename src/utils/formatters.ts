import { PlayerPosition } from '../types';

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

export function isPositionAllowedForDay(position: string, day: 1 | 2 | 3 | 'ALL'): boolean {
  if (day === 'ALL') return true;

  // Dia 1 - Sistema Defensivo: GOL, ZAG, LD/LE
  if (day === 1) {
    return ['GOL', 'ZAG', 'LE', 'LD'].includes(position);
  }

  // Dia 2 - Meio-Campo: VOL, MC, MEI
  if (day === 2) {
    return ['VOL', 'MC', 'MEI'].includes(position);
  }

  // Dia 3 - Setor Ofensivo: ME, MD, PE, PD, SA, ATA
  if (day === 3) {
    return ['ATA', 'PD', 'PE', 'MD', 'ME', 'SA'].includes(position);
  }

  return true;
}

export function getDayLabel(day: 1 | 2 | 3 | 'ALL'): { title: string; subtitle: string; positions: string[] } {
  switch (day) {
    case 1:
      return {
        title: 'Dia 1 - Sistema Defensivo',
        subtitle: 'Período exclusivo para Goleiros (GOL), Zagueiros (ZAG) e Laterais (LD/LE)',
        positions: ['GOL', 'ZAG', 'LE', 'LD']
      };
    case 2:
      return {
        title: 'Dia 2 - Meio-Campo',
        subtitle: 'Período exclusivo para Volantes (VOL) e Meio-campistas (MC/MEI)',
        positions: ['VOL', 'MC', 'MEI']
      };
    case 3:
      return {
        title: 'Dia 3 - Setor Ofensivo',
        subtitle: 'Período exclusivo para Pontas (ME/MD/PE/PD), Segundos Atacantes (SA) e Centroavantes (ATA)',
        positions: ['ATA', 'PD', 'PE', 'MD', 'ME', 'SA']
      };
    case 'ALL':
    default:
      return {
        title: 'Fase Livre - Todas as Posições',
        subtitle: 'Lances e indicações permitidos para qualquer setor de campo',
        positions: ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'MD', 'ME', 'PE', 'PD', 'SA', 'ATA']
      };
  }
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
        label: position === 'VOL' ? 'Volante' : position === 'MEI' ? 'Meia Ofensivo' : 'Meio-Campo',
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

