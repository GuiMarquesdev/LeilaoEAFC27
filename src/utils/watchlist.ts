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

    // Sincroniza em nuvem no Firestore se o usuário estiver autenticado
    if (userId && userId !== 'guest') {
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('khedira_token') || localStorage.getItem('khedira_token')) : null;
      fetch('/api/user/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ playerIds })
      }).catch((err) => {
        console.warn('Erro ao sincronizar watchlist com o servidor:', err);
      });
    }
  } catch (err) {
    console.warn('Erro ao salvar lista de observação:', err);
  }
}

/**
 * Baixa e mescla a lista de favoritos permanente do Firestore com o cache local
 */
export async function syncWatchlistWithServer(userId: string | null | undefined): Promise<string[]> {
  if (!userId || userId === 'guest') return getWatchlist(userId);
  try {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('khedira_token') || localStorage.getItem('khedira_token')) : null;
    const res = await fetch('/api/user/watchlist', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.playerIds)) {
      const local = getWatchlist(userId);
      const merged = Array.from(new Set([...data.playerIds, ...local]));
      const key = `${WATCHLIST_PREFIX}${userId}`;
      localStorage.setItem(key, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: { userId, playerIds: merged } }));
      return merged;
    }
  } catch (err) {
    console.warn('Erro ao baixar watchlist do servidor:', err);
  }
  return getWatchlist(userId);
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

export function addMultipleToWatchlist(
  userId: string | null | undefined,
  playerIdsToAdd: string[]
): { addedCount: number; playerIds: string[] } {
  const current = getWatchlist(userId);
  const currentSet = new Set(current);
  let newlyAdded = 0;

  playerIdsToAdd.forEach((id) => {
    if (!currentSet.has(id)) {
      currentSet.add(id);
      newlyAdded++;
    }
  });

  const updated = Array.from(currentSet);
  saveWatchlist(userId, updated);
  return { addedCount: newlyAdded, playerIds: updated };
}

export function setWatchlistFromConcept(
  userId: string | null | undefined,
  playerIds: string[],
  mode: 'merge' | 'replace' = 'merge'
): { totalCount: number; newCount: number; playerIds: string[] } {
  const current = getWatchlist(userId);
  let finalIds: string[];
  let newCount = 0;

  if (mode === 'replace') {
    finalIds = Array.from(new Set(playerIds));
    newCount = finalIds.length;
  } else {
    const set = new Set(current);
    playerIds.forEach((id) => {
      if (!set.has(id)) {
        newCount++;
        set.add(id);
      }
    });
    finalIds = Array.from(set);
  }

  saveWatchlist(userId, finalIds);
  return { totalCount: finalIds.length, newCount, playerIds: finalIds };
}
