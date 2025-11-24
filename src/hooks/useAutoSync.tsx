import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { syncService } from '../services';

interface UseAutoSyncOptions {
  showSuccessAlert?: boolean;
  showErrorAlert?: boolean;
  onSyncComplete?: (success: boolean, syncedCount: number, failedCount: number) => void;
  autoInitialize?: boolean;
}

interface UseAutoSyncReturn {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

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

      await syncService.initializeAutoSync();

      unsubscribe = syncService.onSyncComplete((success, syncedCount, failedCount) => {
        console.log(`🔄 Sync completed: ${syncedCount} synced, ${failedCount} failed`);

        refreshPendingCount();

        if (success && syncedCount > 0 && showSuccessAlert) {
          Alert.alert(
            'Sync Complete',
            `Successfully synced ${syncedCount} action${syncedCount > 1 ? 's' : ''}`
          );
        } else if (!success && showErrorAlert) {
          Alert.alert(
            'Sync Partial',
            `Synced ${syncedCount} action${syncedCount > 1 ? 's' : ''}, but ${failedCount} failed.`
          );
        }

        if (onSyncComplete) {
          onSyncComplete(success, syncedCount, failedCount);
        }
      });

      statusInterval = setInterval(() => {
        const status = syncService.getSyncStatus();
        setIsOnline(status.isOnline);
        setIsSyncing(status.isSyncing);
      }, 1000);

      const status = syncService.getSyncStatus();
      setIsOnline(status.isOnline);
      setIsSyncing(status.isSyncing);
      await refreshPendingCount();
    };

    initialize();

    return () => {
      if (unsubscribe) unsubscribe();
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [autoInitialize]);

  const refreshPendingCount = async () => {
    try {
      const count = await syncService.getPendingActionsCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  };

  const syncNow = async () => {
    try {
      setIsSyncing(true);
      const result = await syncService.manualSync();
      
      if (result.success > 0 && showSuccessAlert) {
        Alert.alert('Sync Complete', `Successfully synced ${result.success} actions`);
      }
      
      await refreshPendingCount();
    } catch (error: any) {
      if (showErrorAlert) {
        Alert.alert('Sync Failed', error.message || 'Unable to sync');
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
