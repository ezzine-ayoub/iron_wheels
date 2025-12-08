/**
 * Iron Wheels Mobile App
 * Driver Job Management Application
 *
 * @format
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { syncService, storageService, websocketService, authService } from './src/services';
import FirebaseNotificationService from './src/services/FirebaseNotificationService';

/**
 * Convert job data to proper format for SQLite
 */
function formatJobForStorage(jobData: any) {
  // Parse sleepTracking if it's a string
  let sleepTracking = null;
  if (jobData.sleepTracking) {
    try {
      sleepTracking = typeof jobData.sleepTracking === 'string' 
        ? JSON.parse(jobData.sleepTracking) 
        : jobData.sleepTracking;
    } catch (e) {
      console.warn('⚠️ Failed to parse sleepTracking:', e);
    }
  }

  return {
    id: jobData.id,
    sequence: parseInt(jobData.sequence) || null,
    assigneeId: jobData.assigneeId || null,
    description: jobData.description || '',
    status: jobData.status || 'CREATED',
    sleepSweden: parseInt(jobData.sleepSweden) || 0,
    sleepNorway: parseInt(jobData.sleepNorway) || 0,
    sleepTracking: sleepTracking,
    startCountry: jobData.startCountry || null,
    deliveryCountry: jobData.deliveryCountry || null,
    tripPath: jobData.tripPath || '',
    startDatetime: jobData.startDatetime === 'null' ? null : jobData.startDatetime,
    endDatetime: jobData.endDatetime === 'null' ? null : jobData.endDatetime,
    isReceived: jobData.isReceived === 'true' || jobData.isReceived === true,
    isFinished: jobData.isFinished === 'true' || jobData.isFinished === true,
    createdAt: jobData.createdAt || new Date().toISOString(),
    updatedAt: jobData.updatedAt || new Date().toISOString(),
    deletedAt: jobData.deletedAt || null,
  };
}

const App = () => {
  useEffect(() => {
    // Initialize services when app starts
    const initializeServices = async () => {
      try {
        // Initialize auto-sync
        await syncService.initializeAutoSync();
        console.log('✅ Auto-sync firebase initialized');

        // ✅ Connect WebSocket if user is already logged in
        const user = await authService.getCurrentUser();
        if (user?.id) {
          console.log('🔌 Reconnecting WebSocket for existing session...');
          await websocketService.connect(user.id);
          console.log('✅ WebSocket reconnected for user:', user.id);
        }

        // Initialize Firebase notifications with delay on Android
        if (Platform.OS === 'android') {
          // Add a small delay to ensure Google Play Services is ready
          console.log('⏳ Waiting for Google Play Services...');
          // @ts-ignore
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('🔔 Initializing Firebase notifications...');
        const initialized = await FirebaseNotificationService.initialize();

        if (initialized) {
          // ✅ Get FCM token but skip auto-update (will be done after login)
          const token = await FirebaseNotificationService.getFCMToken(3, true);

          if (token) {
            console.log('✅ Firebase notifications initialized successfully');
            console.log('ℹ️ Token will be synced to server after login');
          } else {
            console.warn(
              '⚠️ Could not obtain FCM token, notifications may not work',
            );
          }
        } else {
          console.warn(
            '⚠️ Firebase initialization failed, notifications will not work',
          );
        }

        // 🆕 Setup foreground notification handler
        const unsubscribeForeground =
          FirebaseNotificationService.onMessageReceived(async remoteMessage => {
            console.log('🔔 Foreground notification received');
            console.log(
              '📦 Notification data:',
              JSON.stringify(remoteMessage.data),
            );

            // Handle job updates in foreground
            if (remoteMessage.data && remoteMessage.data.id) {
              try {
                // Les données arrivent déjà comme un objet plat avec tous les champs
                const jobData = remoteMessage.data;

                console.log('🔍 Job ID detected:', jobData.id);

                await storageService.initDatabase();

                const parsedJob = formatJobForStorage(jobData);

                console.log('💾 Saving job to SQLite:', parsedJob.id);
                console.log(
                  '📝 Job details:',
                  JSON.stringify(parsedJob, null, 2),
                );

                // Save to SQLite (will emit event automatically)
                await storageService.saveJob(parsedJob, true);
                console.log(
                  '✅ Job saved from foreground notification:',
                  parsedJob.id,
                );
              } catch (error) {
                console.error(
                  '❌ Error handling foreground job update:',
                  error,
                );
              }
            } else {
              console.warn('⚠️ Notification data missing job ID');
            }
          });

        return () => {
          if (unsubscribeForeground) {
            unsubscribeForeground();
          }
        };
      } catch (error) {
        console.error('❌ Error initializing services:', error);
      }
    };

    initializeServices();

    // 🔄 Handle app state changes for WebSocket reconnection
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground, checking WebSocket...');
        const user = await authService.getCurrentUser();
        if (user?.id && !websocketService.isSocketConnected()) {
          console.log('🔌 Reconnecting WebSocket...');
          await websocketService.connect(user.id);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup when app closes
    return () => {
      syncService.destroy();
      websocketService.disconnect(); // Now async but we don't need to await in cleanup
      appStateSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;
