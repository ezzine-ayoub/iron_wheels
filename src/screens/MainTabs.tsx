import React, {useEffect, useState} from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabs from '../components/BottomTabs';
import FirebaseNotificationService from '../services/FirebaseNotificationService';

interface MainTabsProps {
  onLogout: () => void;
}

const MainTabs: React.FC<MainTabsProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  
  useEffect(() => {
    // Setup notification handlers after login
    const setupNotificationHandlers = () => {
      // Listen for foreground notifications
      const unsubscribeForeground = FirebaseNotificationService.onMessageReceived((remoteMessage) => {
        console.log('🔔 Foreground notification received:', remoteMessage);
        
        const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'New Notification';
        const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'You have a new message';
        
        // Show alert for foreground notifications
        Alert.alert(
          title,
          body,
          [
            { text: 'Dismiss', style: 'cancel' },
            { 
              text: 'View', 
              onPress: () => {
                // Handle navigation based on notification data
                if (remoteMessage.data?.screen === 'home') {
                  setActiveTab('home');
                } else if (remoteMessage.data?.screen === 'profile') {
                  setActiveTab('profile');
                }
              }
            }
          ]
        );
      });
      
      // Handle notification that opened the app (background/quit state)
      const unsubscribeOpened = FirebaseNotificationService.onNotificationOpenedApp((remoteMessage) => {
        console.log('👆 App opened from notification:', remoteMessage);
        
        // Navigate based on notification data
        if (remoteMessage.data?.screen === 'home') {
          setActiveTab('home');
        } else if (remoteMessage.data?.screen === 'profile') {
          setActiveTab('profile');
        }
      });
      
      // Check if app was opened from notification (quit state)
      FirebaseNotificationService.getInitialNotification().then((remoteMessage) => {
        if (remoteMessage) {
          console.log('🚀 App launched from notification:', remoteMessage);
          
          // Navigate based on notification data
          if (remoteMessage.data?.screen === 'home') {
            setActiveTab('home');
          } else if (remoteMessage.data?.screen === 'profile') {
            setActiveTab('profile');
          }
        }
      });
      
      // Cleanup
      return () => {
        if (unsubscribeForeground) unsubscribeForeground();
        if (unsubscribeOpened) unsubscribeOpened();
      };
    };
    
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);
  
  const handleNavigateHome = () => {
    setActiveTab('home');
  };

  return (
    <View style={styles.container}>
      {activeTab === 'home' ? (
        <HomeScreen onLogout={onLogout} />
      ) : (
        <ProfileScreen onLogout={onLogout} onNavigateHome={handleNavigateHome} />
      )}
      <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MainTabs;
