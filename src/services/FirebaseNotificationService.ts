import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import apiClient from "./apiClient.ts";
import { authService } from './authService';

class FirebaseNotificationService {
  private isInitialized = false;
  
  /**
   * Check if Google Play Services is available
   */
  async checkPlayServices() {
    if (Platform.OS !== 'android') return true;
    
    try {
      const isAvailable = await messaging().hasPermission();
      return isAvailable !== messaging.AuthorizationStatus.NOT_DETERMINED;
    } catch (error) {
      console.error('❌ Google Play Services check failed:', error);
      return false;
    }
  }

  /**
   * Request notification permissions (Android 13+ and iOS)
   */
  async requestUserPermission() {
    try {
      // First check if Play Services is available (Android only)
      if (Platform.OS === 'android') {
        const playServicesAvailable = await this.checkPlayServices();
        if (!playServicesAvailable) {
          console.warn('⚠️ Google Play Services not available');
          return false;
        }
      }

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Notification permission granted');
          return true;
        } else {
          console.log('❌ Notification permission denied');
          return false;
        }
      } else if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('✅ iOS notification permission granted:', authStatus);
          return true;
        }
        return false;
      } else {
        // Android < 13 doesn't need runtime permission
        return true;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token with retry logic
   */
  async getFCMToken(retries = 3, skipUpdate = false) {
    try {
      // Check if firebase is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      let lastError;
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`🔄 Attempting to get FCM token (attempt ${i + 1}/${retries})...`);
          const token = await messaging().getToken();

          if (token) {
            console.log('✅ FCM Token obtained successfully');
            console.log('📱 FCM Token:', token);
            
            // ✅ Compare with stored token and update if different (unless skipUpdate is true)
            if (!skipUpdate) {
              await this.updateTokenIfNeeded(token);
            }

            return token;
          }
        } catch (error: any) {
          lastError = error;
          console.warn(`⚠️ FCM token attempt ${i + 1} failed:`, error.message);
          
          // Wait before retrying (exponential backoff)
          if (i < retries - 1) {
            const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      console.error('❌ Error getting FCM token after all retries:', lastError);
      return null;
    } catch (error) {
      console.error('❌ Fatal error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Initialize Firebase Messaging
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        console.log('ℹ️ Firebase Messaging already initialized');
        return true;
      }

      // Request permission first
      const hasPermission = await this.requestUserPermission();
      if (!hasPermission) {
        console.warn('⚠️ Notification permission not granted');
        return false;
      }

      // Register for remote notifications (iOS)
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }

      this.isInitialized = true;
      console.log('✅ Firebase Messaging initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Firebase Messaging:', error);
      return false;
    }
  }

  /**
   * Listen for token refresh
   */
  onTokenRefresh(callback: (token: string) => void) {
    return messaging().onTokenRefresh(token => {
      console.log('🔄 FCM Token refreshed:', token?.substring(0, 20) + '...');
      callback(token);
    });
  }

  /**
   * Handle foreground notifications
   */
  onMessageReceived(callback: (message: any) => void) {
    return messaging().onMessage(async remoteMessage => {
      console.log('🔔 Foreground notification received:', remoteMessage);
      callback(remoteMessage);
    });
  }

  /**
   * Handle background/quit state notifications
   */
  setBackgroundMessageHandler(handler: (message: any) => Promise<any>) {
    messaging().setBackgroundMessageHandler(handler);
  }

  /**
   * Handle notification opened app (background/quit state)
   */
  onNotificationOpenedApp(callback: (message: any) => void) {
    return messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('👆 Notification opened app:', remoteMessage);
      callback(remoteMessage);
    });
  }

  /**
   * Check if app was opened by a notification (quit state)
   */
  async getInitialNotification() {
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('🚀 App opened from quit state by notification:', remoteMessage);
        return remoteMessage;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting initial notification:', error);
      return null;
    }
  }

  /**
   * Subscribe to a topic
   */
  async subscribeToTopic(topic: string) {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`✅ Subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      console.error('❌ Error subscribing to topic:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic: string) {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`✅ Unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      console.error('❌ Error unsubscribing from topic:', error);
      return false;
    }
  }

  /**
   * Delete FCM token
   */
  async deleteToken() {
    try {
      await messaging().deleteToken();
      console.log('✅ FCM token deleted');
      this.isInitialized = false;
      return true;
    } catch (error) {
      console.error('❌ Error deleting FCM token:', error);
      return false;
    }
  }

  /**
   * Compare and update Firebase token if different from stored one
   */
  async updateTokenIfNeeded(newToken: string) {
    try {
      // Get current user data from session
      const userData = await authService.getStoredAuthData();

      if (!userData) {
        console.log('⚠️ No user session found, skipping token update');
        return false;
      }

      // ✅ Check if driverNo exists
      if (!userData.driverNo) {
        console.log('⚠️ No driverNo found in session, skipping token update');
        return false;
      }

      // Compare tokens
      if (userData.fcmToken === newToken) {
        console.log('ℹ️ Firebase token unchanged, no update needed');
        return false;
      }

      console.log('🔄 Firebase token changed, updating profile...');
      console.log('📱 Old token:', userData.fcmToken?.substring(0, 20) + '...');
      console.log('📱 New token:', newToken.substring(0, 20) + '...');

      // Update profile with new token
      await apiClient.put(`/users/complete-profile/${userData.driverNo}`, {
        email: userData.email,
        name: userData.name,
        phone: userData.phone,
        personalNo: userData.personalNo,
        employed: userData.employed,
        fcmToken: newToken,
      });

      console.log('✅ Firebase token updated successfully in profile');
      return true;

    } catch (error) {
      console.error('❌ Error updating Firebase token:', error);
      // Don't throw error, just log it - this is not critical
      return false;
    }
  }

  /**
   * 🆕 Manually sync current FCM token to server
   * Call this after login to ensure token is synced
   */
  async syncTokenToServer() {
    try {
      console.log('🔄 Manually syncing FCM token to server...');
      
      // Get token without auto-update to avoid recursion
      const token = await this.getFCMToken(3, true);
      
      if (!token) {
        console.log('⚠️ No FCM token available to sync');
        return false;
      }

      // Now manually call update
      return await this.updateTokenIfNeeded(token);

    } catch (error) {
      console.error('❌ Error syncing token to server:', error);
      return false;
    }
  }

}

export default new FirebaseNotificationService();
