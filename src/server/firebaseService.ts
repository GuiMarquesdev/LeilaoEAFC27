import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import path from 'path';
import fs from 'fs';
import { LeagueState, UserProfile, UserSquad, Player, AuctionState } from '../types.js';

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
    
    // 1. Load all registered users
    const usersCol = collection(db, 'users');
    const userDocs = await getDocs(usersCol);
    const loadedUsers: UserProfile[] = [];
    userDocs.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      if (data && data.id && data.email) {
        loadedUsers.push(data);
      }
    });

    // 2. Load all squads
    const squadsCol = collection(db, 'squads');
    const squadDocs = await getDocs(squadsCol);
    const loadedSquads: { [userId: string]: UserSquad } = {};
    squadDocs.forEach((docSnap) => {
      const data = docSnap.data() as UserSquad;
      if (data && data.userId) {
        loadedSquads[data.userId] = data;
      }
    });

    // 3. Load watchlists
    const watchlistsCol = collection(db, 'watchlists');
    const watchlistDocs = await getDocs(watchlistsCol);
    const loadedWatchlists: { [userId: string]: string[] } = {};
    watchlistDocs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.userId && Array.isArray(data.playerIds)) {
        loadedWatchlists[data.userId] = data.playerIds;
      }
    });

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
    } catch (e) {
      console.warn('[Firebase] Could not load master doc:', e);
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
