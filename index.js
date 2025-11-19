/**
 * @format
 */

import 'react-native-gesture-handler'; // ⚠️ IMPORTANT: Doit être en premier !
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Register background message handler
// This handles notifications when app is in background or quit state
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔔 Background notification received:', remoteMessage);
  
  // You can perform background tasks here:
  // - Save notification to local storage
  // - Update badge count
  // - Trigger local notification
  // - Update app data
  
  // Example: Log notification details
  if (remoteMessage.notification) {
    console.log('Title:', remoteMessage.notification.title);
    console.log('Body:', remoteMessage.notification.body);
  }
  
  if (remoteMessage.data) {
    console.log('Data:', remoteMessage.data);
  }
});

AppRegistry.registerComponent(appName, () => App);
