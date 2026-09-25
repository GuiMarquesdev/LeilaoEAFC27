import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  arrayUnion
} from 'firebase/firestore';
import path from 'path';
import fs from 'fs';
import { LeagueState, UserProfile, UserSquad, Player, AuctionState } from '../types.js';

// O banco Firestore "Starter / cota compartilhada de IA" deste projeto nega
// consultas de listagem de coleção inteira (getDocs em uma collection), mesmo
// quando as regras de seguranca permitiriam - so getDoc em documento
// especifico funciona. Por isso mantemos um documento-indice por colecao
// (em vez de listar) e buscamos cada documento individualmente por id.
//
// IDs de participantes que ja existiam no Firestore antes do indice ser
// criado (confirmados no Console em 24/09) - usados como semente unica do
// indice, para nao perder quem ja tinha se cadastrado.
const LEGACY_KNOWN_USER_IDS = [
  // Administradores: sempre recriados localmente (independem do Firestore
  // pra existir como usuario), entao nunca entravam no indice sozinhos -
  // sem isso aqui, o squad/watchlist deles nunca era sequer verificado.
  'user-admin-default',
  'user-admin-tourinho',
  'user-1790259041454-mewkw',
  'user-1790259670059-zxvzd',
  'user-1790260795753-20s8c',
  'user-1790261315866-noq3i',
  'user-1790268292035-6driw'
];

async function addToIndex(indexId: string, id: string): Promise<void> {
  if (!db || !id) return;
  try {
    await setDoc(
      doc(db, 'league', indexId),
      { ids: arrayUnion(id), updatedAt: Date.now() },
      { merge: true }
    );
  } catch (err) {
    console.error(`[Firebase] Failed to update index '${indexId}' with id '${id}':`, err);
  }
}

// Read config
let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (err) {
  console.warn('[Firebase] Could not read firebase-applet-config.json from cwd, trying fallback:', err);
}

let db: any = null;
if (firebaseConfig && firebaseConfig.projectId) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log('[Firebase] Firestore initialized successfully with databaseId:', firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.error('[Firebase] Failed to initialize Firestore:', err);
  }
} else {
  console.warn('[Firebase] No firebase-applet-config found. Persistent cloud storage disabled.');
}

export function isFirebaseReady(): boolean {
  return db !== null;
}

/**
 * Loads all persistent data from Firestore to hydrate server memory.
 * Ensures user accounts, squads, and auction progress survive Cloud Run container restarts.
 */
export async function loadStateFromFirestore(fallbackState: LeagueState): Promise<{
  users: UserProfile[];
  squads: { [userId: string]: UserSquad };
  players?: Player[];
  auction?: AuctionState;
  watchlists?: { [userId: string]: string[] };
} | null> {
  if (!db) return null;

  try {
    console.log('[Firebase] 🔄 Loading persistent state from Firestore...');

    // Le o documento-indice de uma colecao (lista de ids) - getDoc simples,
    // nao e uma listagem de colecao, entao nao esbarra na restricao do plano.
    async function readIndexIds(indexId: string): Promise<string[]> {
      try {
        const snap = await getDoc(doc(db, 'league', indexId));
        const ids = snap.exists() && Array.isArray(snap.data().ids) ? (snap.data().ids as string[]) : [];
        return Array.from(new Set([...ids, ...LEGACY_KNOWN_USER_IDS]));
      } catch (e) {
        console.error(`[Firebase] Failed to read index 'league/${indexId}':`, e);
        return [...LEGACY_KNOWN_USER_IDS];
      }
    }

    // 1. Load all registered users (por id individual, via indice)
    const loadedUsers: UserProfile[] = [];
    const userIds = await readIndexIds('user_index');
    try {
      for (const id of userIds) {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            if (data && data.id && data.email) loadedUsers.push(data);
          }
        } catch (e) {
          console.error(`[Firebase] Failed to read users/${id}:`, e);
        }
      }
      console.log(`[Firebase] ✅ Step 1/4 OK: read ${loadedUsers.length}/${userIds.length} doc(s) from 'users'.`);
    } catch (e) {
      console.error("[Firebase] ❌ Step 1/4 FAILED reading 'users' via index:", e);
    }

    // A lista de usuarios de verdade (quem realmente se cadastrou) e a fonte
    // mais confiavel de ids possiveis para elenco/favoritos - qualquer um que
    // tenha salvo algo antes do indice proprio de squads/watchlists existir
    // ainda e encontrado por aqui, em vez de depender so da lista fixa legada.
    const allKnownUserIds = Array.from(new Set([...userIds, ...loadedUsers.map((u) => u.id)]));

    // 2. Load all squads (por id individual, via indice + todos os usuarios conhecidos)
    const loadedSquads: { [userId: string]: UserSquad } = {};
    try {
      const ids = Array.from(new Set([...(await readIndexIds('squad_index')), ...allKnownUserIds]));
      let found = 0;
      for (const id of ids) {
        try {
          const snap = await getDoc(doc(db, 'squads', id));
          if (snap.exists()) {
            const data = snap.data() as UserSquad;
            if (data && data.userId) {
              loadedSquads[data.userId] = data;
              found++;
            }
          }
        } catch (e) {
          console.error(`[Firebase] Failed to read squads/${id}:`, e);
        }
      }
      console.log(`[Firebase] ✅ Step 2/4 OK: read ${found}/${ids.length} doc(s) from 'squads'.`);
    } catch (e) {
      console.error("[Firebase] ❌ Step 2/4 FAILED reading 'squads' via index:", e);
    }

    // 3. Load watchlists (por id individual, via indice + todos os usuarios conhecidos)
    const loadedWatchlists: { [userId: string]: string[] } = {};
    try {
      const ids = Array.from(new Set([...(await readIndexIds('watchlist_index')), ...allKnownUserIds]));
      let found = 0;
      for (const id of ids) {
        try {
          const snap = await getDoc(doc(db, 'watchlists', id));
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.userId && Array.isArray(data.playerIds)) {
              loadedWatchlists[data.userId] = data.playerIds;
              found++;
            }
          }
        } catch (e) {
          console.error(`[Firebase] Failed to read watchlists/${id}:`, e);
        }
      }
      console.log(`[Firebase] ✅ Step 3/4 OK: read ${found}/${ids.length} doc(s) from 'watchlists'.`);
    } catch (e) {
      console.error("[Firebase] ❌ Step 3/4 FAILED reading 'watchlists' via index:", e);
    }

    // 4. Load master league state (auction, players status)
    let loadedAuction: AuctionState | undefined;
    let loadedPlayers: Player[] | undefined;
    try {
      const masterDocRef = doc(db, 'league', 'current_state');
      const masterSnap = await getDoc(masterDocRef);
      if (masterSnap.exists()) {
        const masterData = masterSnap.data();
        if (masterData.auction) {
          loadedAuction = masterData.auction as AuctionState;
        }
        if (Array.isArray(masterData.players)) {
          loadedPlayers = masterData.players as Player[];
        }
      }
      console.log(`[Firebase] ✅ Step 4/4 OK: 'league/current_state' exists=${masterSnap.exists()}.`);
    } catch (e) {
      console.error("[Firebase] ❌ Step 4/4 FAILED reading 'league/current_state':", e);
    }

    console.log(`[Firebase] ✅ Loaded ${loadedUsers.length} users, ${Object.keys(loadedSquads).length} squads, and ${Object.keys(loadedWatchlists).length} watchlists from Cloud Firestore.`);

    return {
      users: loadedUsers,
      squads: loadedSquads,
      players: loadedPlayers,
      auction: loadedAuction,
      watchlists: loadedWatchlists,
    };
  } catch (err) {
    console.error('[Firebase] Error loading state from Firestore:', err);
    return null;
  }
}

/**
 * Persists a user profile to Firestore immediately (on register, login, or profile edit)
 */
export async function syncUserToFirestore(user: UserProfile): Promise<void> {
  if (!db || !user?.id) return;
  try {
    const docRef = doc(db, 'users', user.id);
    const userPayload: any = {
      id: user.id,
      email: user.email.toLowerCase().trim(),
      name: user.name,
      teamName: user.teamName,
      role: user.role,
      budget: user.budget,
      spent: user.spent || 0,
      createdAt: user.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    if (user.adminTitle) userPayload.adminTitle = user.adminTitle;
    if (user.passwordHash) userPayload.passwordHash = user.passwordHash;
    if (user.avatarUrl) userPayload.avatarUrl = user.avatarUrl;

    await setDoc(docRef, userPayload, { merge: true });
    await addToIndex('user_index', user.id);
    console.log(`[Firebase] 💾 User "${user.name}" (${user.email}) persisted to Firestore.`);
  } catch (err) {
    console.error(`[Firebase] Failed to persist user ${user.id} to Firestore:`, err);
  }
}

/**
 * Persists a squad formation to Firestore
 */
export async function syncSquadToFirestore(squad: UserSquad): Promise<void> {
  if (!db || !squad?.userId) return;
  try {
    const docRef = doc(db, 'squads', squad.userId);
    await setDoc(docRef, {
      ...squad,
      updatedAt: Date.now()
    }, { merge: true });
    await addToIndex('squad_index', squad.userId);
    console.log(`[Firebase] 💾 Squad for user "${squad.userId}" persisted to Firestore.`);
  } catch (err) {
    console.error(`[Firebase] Failed to persist squad for ${squad.userId} to Firestore:`, err);
  }
}

/**
 * Persists user watchlist (favorited players) to Firestore
 */
export async function syncWatchlistToFirestore(userId: string, playerIds: string[]): Promise<void> {
  if (!db || !userId) return;
  try {
    const docRef = doc(db, 'watchlists', userId);
    await setDoc(docRef, {
      userId,
      playerIds,
      updatedAt: Date.now()
    }, { merge: true });
    await addToIndex('watchlist_index', userId);
    console.log(`[Firebase] 💾 Watchlist (${playerIds.length} players) for user "${userId}" persisted to Firestore.`);
  } catch (err) {
    console.error(`[Firebase] Failed to persist watchlist for ${userId} to Firestore:`, err);
  }
}

/**
 * Loads user watchlist from Firestore
 */
export async function loadWatchlistFromFirestore(userId: string): Promise<string[]> {
  if (!db || !userId) return [];
  try {
    const docRef = doc(db, 'watchlists', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.playerIds)) {
        return data.playerIds;
      }
    }
    return [];
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn(`[Firebase] Permission denied loading watchlist for ${userId}. Rules updated.`);
    } else {
      console.warn(`[Firebase] Notice loading watchlist for ${userId}:`, err?.message || err);
    }
    return [];
  }
}

/**
 * Persists master league state (auction, players status, etc.) to Firestore
 */
export async function syncLeagueMasterToFirestore(state: LeagueState): Promise<void> {
  if (!db) return;
  try {
    const masterDocRef = doc(db, 'league', 'current_state');
    
    // Save minimal player delta (only players that are sold, extra, or in auction to keep doc size optimized)
    const modifiedPlayers = state.players.filter(
      (p) => p.status !== 'AVAILABLE' || p.isManualExtra || (p.currentBid && p.currentBid.amount > p.initialPrice)
    );

    await setDoc(
      masterDocRef,
      {
        id: 'current_state',
        defaultBudget: state.defaultBudget,
        auction: state.auction,
        modifiedPlayers,
        lastUpdated: Date.now()
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[Firebase] Failed to persist master league state to Firestore:', err);
  }
}

/**
 * Full sync of all league state to Firestore
 */
export async function syncAllStateToFirestore(state: LeagueState): Promise<void> {
  if (!db) return;
  try {
    // 1. Sync users
    for (const u of state.users) {
      await syncUserToFirestore(u);
    }
    // 2. Sync squads
    for (const sq of Object.values(state.squads)) {
      await syncSquadToFirestore(sq);
    }
    // 3. Sync master state
    await syncLeagueMasterToFirestore(state);
    console.log('[Firebase] 🚀 Full state synced to Cloud Firestore.');
  } catch (err) {
    console.error('[Firebase] Full state sync error:', err);
  }
}
