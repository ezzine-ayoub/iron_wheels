/**
 * Iron Wheels Mobile App
 * Driver Job Management Application
 *
 * @format
 */

import React, {useEffect} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Platform} from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import {autoSyncService} from './src/services/autoSyncService';
import FirebaseNotificationService from './src/services/FirebaseNotificationService';

const App = () => {
    useEffect(() => {
        // Initialize services when app starts
        const initializeServices = async () => {
            try {
                // Initialize auto-sync
                await autoSyncService.initialize();
                console.log('✅ Auto-sync service initialized');
                
                // Initialize Firebase notifications with delay on Android
                if (Platform.OS === 'android') {
                    // Add a small delay to ensure Google Play Services is ready
                    console.log('⏳ Waiting for Google Play Services...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                console.log('🔔 Initializing Firebase notifications...');
                const initialized = await FirebaseNotificationService.initialize();
                
                if (initialized) {
                    // Try to get FCM token with retry logic
                    const token = await FirebaseNotificationService.getFCMToken();
                    
                    if (token) {
                        console.log('✅ Firebase notifications initialized successfully');
                        // You can send this token to your backend here if needed
                        // await sendTokenToBackend(token);
                    } else {
                        console.warn('⚠️ Could not obtain FCM token, notifications may not work');
                    }
                } else {
                    console.warn('⚠️ Firebase initialization failed, notifications will not work');
                }
            } catch (error) {
                console.error('❌ Error initializing services:', error);
            }
        };

        initializeServices();

        // Cleanup when app closes
        return () => {
            autoSyncService.destroy();
        };
    }, []);

    return (
        <SafeAreaProvider>
            <AppNavigator/>
        </SafeAreaProvider>
    );
};

export default App;
