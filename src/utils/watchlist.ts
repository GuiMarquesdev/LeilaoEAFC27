// Gerenciador de Lista de Observação (Watchlist) para os participantes do leilão
// Cada participante tem sua lista persistida no localStorage por ID de usuário

const WATCHLIST_PREFIX = 'khedira_watchlist_';

export function getWatchlist(userId?: string | null): string[] {
  try {
    const key = `${WATCHLIST_PREFIX}${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Erro ao carregar lista de observação:', err);
    return [];
  }
}

export function saveWatchlist(userId: string | null | undefined, playerIds: string[]): void {
  try {
    const key = `${WATCHLIST_PREFIX}${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(playerIds));
    // Dispara evento para sincronizar componentes na mesma aba
    window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: { userId, playerIds } }));
  } catch (err) {
    console.warn('Erro ao salvar lista de observação:', err);
  }
}

export function toggleWatchlistPlayer(userId: string | null | undefined, playerId: string): {
  isWatched: boolean;
  playerIds: string[];
} {
  const current = getWatchlist(userId);
  const exists = current.includes(playerId);
  let updated: string[];

  if (exists) {
    updated = current.filter((id) => id !== playerId);
  } else {
    updated = [...current, playerId];
  }

  saveWatchlist(userId, updated);
  return { isWatched: !exists, playerIds: updated };
}

export function isPlayerWatched(watchedList: string[], playerId: string): boolean {
  return watchedList.includes(playerId);
}
