/**
 * PawCare AI — Sync Store
 *
 * Tracks network status, sync progress, pending outbox count, and last sync timestamp.
 * Integrates with NetInfo and provides simulated offline mode for dev testing.
 */
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { getDatabase } from '../../data/local/database';
import { OutboxDao } from '../../data/local/OutboxDao';
import { SyncEngine } from '../../data/sync/SyncEngine';

interface SyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;

  // Actions
  initSync: () => Promise<void>;
  setOnline: (isOnline: boolean) => void;
  toggleSimulatedOffline: () => void;
  refreshPendingCount: () => Promise<void>;
  syncNow: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  isSimulatedOffline: false,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,

  initSync: async () => {
    try {
      const db = await getDatabase();
      const outboxDao = new OutboxDao(db);
      const count = await outboxDao.getPendingCount();
      set({ pendingCount: count });

      // Immediate network check
      const netState = await NetInfo.fetch();
      const initialConnected = Boolean(netState.isConnected);
      set({ isOnline: initialConnected });

      // 1. Listen to real network changes
      NetInfo.addEventListener((state) => {
        const connected = Boolean(state.isConnected);
        const currentSim = get().isSimulatedOffline;
        const online = currentSim ? false : connected;
        const wasOffline = !get().isOnline;
        set({ isOnline: online });

        // Auto sync immediately upon reconnecting to the internet
        if (online && (wasOffline || get().pendingCount > 0)) {
          void get().syncNow();
        }
      });

      // 2. Listen to AppState (when user returns to app after enabling Wifi in OS settings)
      AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          void NetInfo.fetch().then((s) => {
            if (s.isConnected && !get().isSimulatedOffline) {
              set({ isOnline: true });
              void get().syncNow();
            }
          });
        }
      });

      // 3. Background periodic sync check every 15 seconds
      setInterval(() => {
        const state = get();
        if (state.isOnline && !state.isSyncing) {
          void state.syncNow();
        }
      }, 15000);

      // Trigger initial sync if online and has pending items
      if (initialConnected) {
        void get().syncNow();
      }
    } catch {
      // ignore
    }
  },

  setOnline: (isOnline: boolean) => {
    set({ isOnline });
    if (isOnline && get().pendingCount > 0) {
      void get().syncNow();
    }
  },

  toggleSimulatedOffline: () => {
    const nextSim = !get().isSimulatedOffline;
    set({ isSimulatedOffline: nextSim, isOnline: !nextSim });
    if (!nextSim) {
      void get().syncNow();
    }
  },

  refreshPendingCount: async () => {
    try {
      const db = await getDatabase();
      const outboxDao = new OutboxDao(db);
      const count = await outboxDao.getPendingCount();
      set({ pendingCount: count });
    } catch {
      // ignore
    }
  },

  syncNow: async () => {
    const { isSyncing, isSimulatedOffline } = get();
    if (isSyncing || isSimulatedOffline) return false;

    try {
      const db = await getDatabase();
      const outboxDao = new OutboxDao(db);
      const count = await outboxDao.getPendingCount();
      set({ pendingCount: count });

      // If pending count is 0 and we are just pulling updates, verify connection
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        set({ isOnline: false });
        return false;
      }
      set({ isOnline: true });

      set({ isSyncing: true, lastError: null });

      const engine = new SyncEngine(db);
      const result = await engine.syncAll();

      const remainingPending = await outboxDao.getPendingCount();
      const hasErrors = result.errors.length > 0;
      set({
        isSyncing: false,
        pendingCount: remainingPending,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        lastError: hasErrors ? result.errors[0] : null,
      });

      return !hasErrors;
    } catch (e: any) {
      set({
        isSyncing: false,
        lastError: e?.message || 'Lỗi đồng bộ',
      });
      return false;
    }
  },
}));

