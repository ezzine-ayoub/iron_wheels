import NetInfo from '@react-native-community/netinfo';
import { offlineActionsService } from './offlineActionsService';
import { apiClient } from './apiClient';
import { jobStorageService } from './jobStorageService';
import { Job } from '../types';

type SyncCallback = (success: boolean, syncedCount: number, failedCount: number) => void;

class AutoSyncService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncCallbacks: SyncCallback[] = [];
  private netInfoUnsubscribe: (() => void) | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize auto-sync service
   * Listens to network changes and automatically syncs when online
   */
  async initialize() {
    console.log('🔄 Initializing AutoSyncService...');

    // Listen to network state changes
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log('📡 Network status changed:', this.isOnline ? 'Online' : 'Offline');

      // If we just came back online and were offline before
      if (this.isOnline && wasOffline) {
        console.log('✅ Internet restored! Starting auto-sync...');
        this.triggerAutoSync();
      }
    });

    // Check initial network state
    const netState = await NetInfo.fetch();
    this.isOnline = netState.isConnected ?? false;

    // Set up periodic sync (every 2 minutes when online)
    this.startPeriodicSync();

    console.log('✅ AutoSyncService initialized');
  }

  /**
   * Start periodic sync check (every 2 minutes)
   */
  private startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const pendingCount = await offlineActionsService.getPendingActionsCount();
        if (pendingCount > 0) {
          console.log(`🔄 Periodic sync check: ${pendingCount} pending actions`);
          this.triggerAutoSync();
        }
      }
    }, 120000); // 2 minutes
  }

  /**
   * Trigger automatic sync
   */
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

  /**
   * Sync all pending actions
   */
  private async syncPendingActions(): Promise<{ success: number; failed: number }> {
    const pendingActions = await offlineActionsService.getPendingActions();

    if (pendingActions.length === 0) {
      console.log('✅ No pending actions to sync');
      return { success: 0, failed: 0 };
    }

    console.log(`🔄 Starting sync of ${pendingActions.length} pending actions...`);

    let successCount = 0;
    let failCount = 0;
    const failedActions: any[] = [];

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
        if (response) {
          await jobStorageService.saveJob(response);
        }

        // Mark as synced
        await offlineActionsService.markAsSynced(action.id!);
        successCount++;

        console.log(`✅ Successfully synced ${action.actionType}`);
      } catch (error: any) {
        console.error(`❌ Failed to sync ${action.actionType}:`, error.message);
        failCount++;
        failedActions.push({ action, error: error.message });
      }
    }

    // Clean up successfully synced actions
    await offlineActionsService.clearSyncedActions();

    console.log(`✅ Sync complete: ${successCount} success, ${failCount} failed`);

    // Notify all registered callbacks
    this.notifyCallbacks(failCount === 0, successCount, failCount);

    return { success: successCount, failed: failCount };
  }

  /**
   * Register a callback to be notified when sync completes
   */
  onSyncComplete(callback: SyncCallback) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(success: boolean, syncedCount: number, failedCount: number) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(success, syncedCount, failedCount);
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });
  }

  /**
   * Manually trigger sync
   */
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

  /**
   * Get current sync status
   */
  getSyncStatus(): { isOnline: boolean; isSyncing: boolean } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Check if there are pending actions
   */
  async hasPendingActions(): Promise<boolean> {
    const count = await offlineActionsService.getPendingActionsCount();
    return count > 0;
  }

  /**
   * Get pending actions count
   */
  async getPendingCount(): Promise<number> {
    return await offlineActionsService.getPendingActionsCount();
  }

  /**
   * Force sync now (if online)
   */
  async forceSyncNow() {
    if (!this.isOnline) {
      console.log('❌ Cannot force sync: No internet connection');
      return;
    }
    await this.triggerAutoSync();
  }

  /**
   * Clean up and stop auto-sync
   */
  destroy() {
    console.log('🛑 Stopping AutoSyncService...');

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.syncCallbacks = [];
    console.log('✅ AutoSyncService stopped');
  }
}

export const autoSyncService = new AutoSyncService();
