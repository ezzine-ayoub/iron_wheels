import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { autoSyncService } from '../services/autoSyncService';

interface UseAutoSyncOptions {
  /**
   * Show alert when sync completes successfully
   */
  showSuccessAlert?: boolean;
  
  /**
   * Show alert when sync fails
   */
  showErrorAlert?: boolean;
  
  /**
   * Custom callback when sync completes
   */
  onSyncComplete?: (success: boolean, syncedCount: number, failedCount: number) => void;
  
  /**
   * Automatically initialize sync on mount
   */
  autoInitialize?: boolean;
}

interface UseAutoSyncReturn {
  /**
   * Current online status
   */
  isOnline: boolean;
  
  /**
   * Is sync in progress
   */
  isSyncing: boolean;
  
  /**
   * Number of pending actions
   */
  pendingCount: number;
  
  /**
   * Manually trigger sync
   */
  syncNow: () => Promise<void>;
  
  /**
   * Refresh pending count
   */
  refreshPendingCount: () => Promise<void>;
}

/**
 * React hook for automatic offline sync
 * 
 * Usage:
 * ```typescript
 * const { isOnline, isSyncing, pendingCount, syncNow } = useAutoSync({
 *   showSuccessAlert: true,
 *   onSyncComplete: (success, synced, failed) => {
 *     if (success) {
 *       console.log(`Synced ${synced} actions!`);
 *     }
 *   }
 * });
 * ```
 */
export const useAutoSync = (options: UseAutoSyncOptions = {}): UseAutoSyncReturn => {
  const {
    showSuccessAlert = false,
    showErrorAlert = true,
    onSyncComplete,
    autoInitialize = true,
  } = options;

  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let statusInterval: NodeJS.Timeout | null = null;

    const initialize = async () => {
      if (!autoInitialize) return;

      // Initialize auto-sync service
      await autoSyncService.initialize();

      // Register sync completion callback
      unsubscribe = autoSyncService.onSyncComplete((success, syncedCount, failedCount) => {
        console.log(`🔄 Sync completed: ${syncedCount} synced, ${failedCount} failed`);

        // Update pending count
        refreshPendingCount();

        // Show alerts if enabled
        if (success && syncedCount > 0 && showSuccessAlert) {
          Alert.alert(
            'Sync Complete',
            `Successfully synced ${syncedCount} action${syncedCount > 1 ? 's' : ''}`
          );
        } else if (!success && showErrorAlert) {
          Alert.alert(
            'Sync Partial',
            `Synced ${syncedCount} action${syncedCount > 1 ? 's' : ''}, but ${failedCount} failed. Will retry automatically.`
          );
        }

        // Call custom callback
        if (onSyncComplete) {
          onSyncComplete(success, syncedCount, failedCount);
        }
      });

      // Update status periodically
      statusInterval = setInterval(() => {
        const status = autoSyncService.getSyncStatus();
        setIsOnline(status.isOnline);
        setIsSyncing(status.isSyncing);
      }, 1000);

      // Initial status and count
      const status = autoSyncService.getSyncStatus();
      setIsOnline(status.isOnline);
      setIsSyncing(status.isSyncing);
      await refreshPendingCount();
    };

    initialize();

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [autoInitialize]);

  const refreshPendingCount = async () => {
    try {
      const count = await autoSyncService.getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  };

  const syncNow = async () => {
    try {
      setIsSyncing(true);
      const result = await autoSyncService.manualSync();
      
      if (result.success > 0 && showSuccessAlert) {
        Alert.alert('Sync Complete', `Successfully synced ${result.success} action${result.success > 1 ? 's' : ''}`);
      }
      
      await refreshPendingCount();
    } catch (error: any) {
      if (showErrorAlert) {
        Alert.alert('Sync Failed', error.message || 'Unable to sync. Please try again.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncNow,
    refreshPendingCount,
  };
};

export default useAutoSync;
