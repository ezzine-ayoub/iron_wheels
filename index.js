/**
 * @format
 */

import 'react-native-gesture-handler'; // ⚠️ IMPORTANT: Doit être en premier !
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Import storage service for SQLite updates
import { storageService } from './src/services';

/**
 * Convert job data to proper format for SQLite
 */
function formatJobForStorage(jobData) {
  return {
    id: jobData.id,
    assigneeId: jobData.assigneeId || null,
    description: jobData.description || '',
    sleepSweden: parseInt(jobData.sleepSweden) || 0,
    sleepNorway: parseInt(jobData.sleepNorway) || 0,
    startCountry: jobData.startCountry || null,
    tripPath: jobData.tripPath || '',
    deliveryCountry: jobData.deliveryCountry || null,
    startDatetime: jobData.startDatetime === 'null' ? null : jobData.startDatetime,
    endDatetime: jobData.endDatetime === 'null' ? null : jobData.endDatetime,
    isReceived: jobData.isReceived === 'true' || jobData.isReceived === true,
    isFinished: jobData.isFinished === 'true' || jobData.isFinished === true,
    createdAt: jobData.createdAt || new Date().toISOString(),
    updatedAt: jobData.updatedAt || new Date().toISOString(),
    deletedAt: jobData.deletedAt || null,
  };
}

// Register background message handler
// This handles notifications when app is in background or quit state
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔔 Background notification received');
  
  try {
    // Log notification details
    if (remoteMessage.notification) {
      console.log('📬 Title:', remoteMessage.notification.title);
      console.log('📬 Body:', remoteMessage.notification.body);
    }
    
    if (remoteMessage.data) {
      console.log('📦 Data:', JSON.stringify(remoteMessage.data));
      
      // ✅ Les données arrivent comme un objet plat avec tous les champs du job
      if (remoteMessage.data.id) {
        console.log('🔄 Job detected in notification');
        
        const jobData = remoteMessage.data;
        
        console.log('🔍 Job ID:', jobData.id);
        
        // Initialize storage if not already done
        await storageService.initDatabase();
        
        const parsedJob = formatJobForStorage(jobData);
        
        console.log('💾 Saving job to SQLite:', parsedJob.id);
        console.log('📝 Job details:', JSON.stringify(parsedJob, null, 2));
        
        // Save/update job in SQLite (will emit event automatically)
        await storageService.saveJob(parsedJob, true);
        console.log('✅ Job saved to SQLite from background notification:', parsedJob.id);
      } else {
        console.warn('⚠️ Notification data missing job ID');
      }
    }
  } catch (error) {
    console.error('❌ Error handling background notification:', error);
  }
});

AppRegistry.registerComponent(appName, () => App);
