// SyncService - Unified offline actions and auto-sync management
import SQLite from 'react-native-sqlite-storage';
import NetInfo from '@react-native-community/netinfo';
import { apiClient } from './apiClient';
import { storageService } from './storageService';
import { Job } from '../types';

SQLite.enablePromise(true);

const DB_NAME = 'iron_wheels.db';

export interface PendingAction {
  id?: number;
  jobId: string;
  actionType: 'receive' | 'start' | 'sleep' | 'finish';
  actionData?: string;
  timestamp: string;
  synced: number;
}

type SyncCallback = (success: boolean, syncedCount: number, failedCount: number) => void;

class SyncService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  // Auto-sync state
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncCallbacks: SyncCallback[] = [];
  private netInfoUnsubscribe: (() => void) | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  // ==================== INITIALIZATION ====================

  async init() {
    if (this.isInitialized && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    await this.initPromise;
    this.initPromise = null;
  }

  private async _doInit() {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });
      
      await this.createTable();
      this.isInitialized = true;
      console.log('✅ SyncService initialized');
    } catch (error) {
      console.error('❌ Error initializing SyncService:', error);
      throw error;
    }
  }

  private async createTable() {
    if (!this.db) return;

    const query = `
      CREATE TABLE IF NOT EXISTS pending_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jobId TEXT NOT NULL,
        actionType TEXT NOT NULL,
        actionData TEXT,
        timestamp TEXT NOT NULL,
        synced INTEGER DEFAULT 0
      );
    `;

    await this.db.executeSql(query);
    console.log('✅ pending_actions table created/verified');
  }

  // ==================== AUTO-SYNC INITIALIZATION ====================

  async initializeAutoSync() {
    console.log('🔄 Initializing AutoSync...');

    // Ensure DB is initialized
    await this.init();

    // Listen to network state changes
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log('📡 Network status changed:', this.isOnline ? 'Online' : 'Offline');

      if (this.isOnline && wasOffline) {
        console.log('✅ Internet restored! Starting auto-sync...');
        this.triggerAutoSync();
      }
    });

    // Check initial network state
    const netState = await NetInfo.fetch();
    this.isOnline = netState.isConnected ?? false;

    // Start periodic sync (every 2 minutes)
    this.startPeriodicSync();

    console.log('✅ AutoSync initialized');
  }

  private startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const pendingCount = await this.getPendingActionsCount();
        if (pendingCount > 0) {
          console.log(`🔄 Periodic sync check: ${pendingCount} pending actions`);
          this.triggerAutoSync();
        }
      }
    }, 120000); // 2 minutes
  }

  private async triggerAutoSync() {
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }

    if (!this.isOnline) {
      console.log('❌ Cannot sync: No internet connection');
      return;
    }

    try {
      this.isSyncing = true;
      await this.syncPendingActions();
    } catch (error) {
      console.error('❌ Auto-sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // ==================== PENDING ACTIONS ====================

  async addPendingAction(action: Omit<PendingAction, 'id' | 'synced'>): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = `
        INSERT INTO pending_actions (jobId, actionType, actionData, timestamp, synced) 
        VALUES (?, ?, ?, ?, 0)
      `;
      
      await this.db!.executeSql(query, [
        action.jobId,
        action.actionType,
        action.actionData || null,
        action.timestamp,
      ]);
      
      console.log('✅ Pending action saved:', action.actionType);
    } catch (error) {
      console.error('❌ Error saving pending action:', error);
      throw error;
    }
  }

  async getPendingActions(): Promise<PendingAction[]> {
    if (!this.db) await this.init();

    try {
      const query = 'SELECT * FROM pending_actions WHERE synced = 0 ORDER BY timestamp ASC';
      const [results] = await this.db!.executeSql(query);
      
      const actions: PendingAction[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        actions.push(results.rows.item(i));
      }
      
      return actions;
    } catch (error) {
      console.error('❌ Error getting pending actions:', error);
      return [];
    }
  }

  async getPendingActionsCount(): Promise<number> {
    if (!this.db) await this.init();

    try {
      const query = 'SELECT COUNT(*) as count FROM pending_actions WHERE synced = 0';
      const [results] = await this.db!.executeSql(query);
      
      if (results.rows.length > 0) {
        return results.rows.item(0).count;
      }
      return 0;
    } catch (error) {
      console.error('❌ Error counting pending actions:', error);
      return 0;
    }
  }

  async markAsSynced(id: number): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'UPDATE pending_actions SET synced = 1 WHERE id = ?';
      await this.db!.executeSql(query, [id]);
      console.log('✅ Action marked as synced:', id);
    } catch (error) {
      console.error('❌ Error marking action as synced:', error);
      throw error;
    }
  }

  async clearSyncedActions(): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM pending_actions WHERE synced = 1';
      await this.db!.executeSql(query);
      console.log('✅ Synced actions cleared');
    } catch (error) {
      console.error('❌ Error clearing synced actions:', error);
    }
  }

  async deleteAction(id: number): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM pending_actions WHERE id = ?';
      await this.db!.executeSql(query, [id]);
      console.log('✅ Action deleted:', id);
    } catch (error) {
      console.error('❌ Error deleting action:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM pending_actions';
      await this.db!.executeSql(query);
      console.log('✅ All pending actions cleared');
    } catch (error) {
      console.error('❌ Error clearing all actions:', error);
    }
  }

  // ==================== SYNC OPERATIONS ====================

  private async syncPendingActions(): Promise<{ success: number; failed: number }> {
    const pendingActions = await this.getPendingActions();

    if (pendingActions.length === 0) {
      console.log('✅ No pending actions to sync');
      return { success: 0, failed: 0 };
    }

    console.log(`🔄 Starting sync of ${pendingActions.length} pending actions...`);

    let successCount = 0;
    let failCount = 0;

    for (const action of pendingActions) {
      try {
        console.log(`📤 Syncing ${action.actionType} for job ${action.jobId}...`);

        let response: Job | null = null;

        switch (action.actionType) {
          case 'receive':
            response = await apiClient.post<Job>(`/jobs/${action.jobId}/receive`);
            console.log('✅ Synced: Receive job');
            break;

          case 'start':
            response = await apiClient.post<Job>(`/jobs/${action.jobId}/start`);
            console.log('✅ Synced: Start job');
            break;

          case 'sleep':
            const sleepData = action.actionData ? JSON.parse(action.actionData) : {};
            response = await apiClient.post<Job>(`/jobs/${action.jobId}/sleep`, sleepData);
            console.log('✅ Synced: Sleep', sleepData.country);
            break;

          case 'finish':
            response = await apiClient.post<Job>(`/jobs/${action.jobId}/finish`);
            console.log('✅ Synced: Finish job');
            break;
        }

        // Update local storage with server response
        if (response && response.id) {
          await storageService.saveJob(response);
        } else if (response === null || !response.id) {
          // If API returns empty, update local storage manually
          console.log('⚠️ API returned empty during sync, updating local job manually');
          switch (action.actionType) {
            case 'receive':
              await storageService.updateReceiveStatus(action.jobId);
              break;
            case 'start':
              await storageService.updateStartStatus(action.jobId);
              break;
            case 'sleep':
              const sleepData = action.actionData ? JSON.parse(action.actionData) : {};
              if (sleepData.country) {
                await storageService.updateSleepStatus(action.jobId, sleepData.country);
              }
              break;
            case 'finish':
              await storageService.updateFinishStatus(action.jobId);
              break;
          }
        }

        // Mark as synced
        await this.markAsSynced(action.id!);
        successCount++;

        console.log(`✅ Successfully synced ${action.actionType}`);
      } catch (error: any) {
        console.error(`❌ Failed to sync ${action.actionType}:`, error.message);
        failCount++;
      }
    }

    // Clean up successfully synced actions
    await this.clearSyncedActions();

    console.log(`✅ Sync complete: ${successCount} success, ${failCount} failed`);

    // Notify all registered callbacks
    this.notifyCallbacks(failCount === 0, successCount, failCount);

    return { success: successCount, failed: failCount };
  }

  async manualSync(): Promise<{ success: number; failed: number }> {
    if (!this.isOnline) {
      throw new Error('No internet connection');
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    try {
      this.isSyncing = true;
      return await this.syncPendingActions();
    } finally {
      this.isSyncing = false;
    }
  }

  async forceSyncNow() {
    if (!this.isOnline) {
      console.log('❌ Cannot force sync: No internet connection');
      return;
    }
    await this.triggerAutoSync();
  }

  // ==================== CALLBACKS ====================

  onSyncComplete(callback: SyncCallback) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks(success: boolean, syncedCount: number, failedCount: number) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(success, syncedCount, failedCount);
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });
  }

  // ==================== STATUS ====================

  getSyncStatus(): { isOnline: boolean; isSyncing: boolean } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }

  async hasPendingActions(): Promise<boolean> {
    const count = await this.getPendingActionsCount();
    return count > 0;
  }

  // ==================== CLEANUP ====================

  destroy() {
    console.log('🛑 Stopping SyncService...');

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.syncCallbacks = [];
    console.log('✅ SyncService stopped');
  }

  async close(): Promise<void> {
    this.destroy();
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('✅ SyncService database closed');
    }
  }
}

export const syncService = new SyncService();
export default syncService;
