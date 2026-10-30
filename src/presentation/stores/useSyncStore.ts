/**
 * PawCare AI — Sync Store
 *
 * Tracks network status, sync progress, pending outbox count, and last sync timestamp.
 * Integrates with NetInfo and provides simulated offline mode for dev testing.
 */
import NetInfo from '@react-native-community/netinfo';
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

      // Listen to real network changes
      NetInfo.addEventListener((state) => {
        const connected = state.isConnected ?? true;
        const currentSim = get().isSimulatedOffline;
        set({ isOnline: currentSim ? false : connected });

        if (connected && !currentSim && get().pendingCount > 0) {
          void get().syncNow();
        }
      });
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
    const { isOnline, isSyncing } = get();
    if (!isOnline || isSyncing) return false;

    set({ isSyncing: true, lastError: null });

    try {
      const db = await getDatabase();
      const engine = new SyncEngine(db);
      const result = await engine.syncAll();

      const outboxDao = new OutboxDao(db);
      const pending = await outboxDao.getPendingCount();

      const hasErrors = result.errors.length > 0;
      set({
        isSyncing: false,
        pendingCount: pending,
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

