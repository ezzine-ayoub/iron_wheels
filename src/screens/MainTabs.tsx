import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabs from '../components/BottomTabs';

interface MainTabsProps {
  onLogout: () => void;
}

const MainTabs: React.FC<MainTabsProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');

  return (
    <View style={styles.container}>
      {activeTab === 'home' ? (
        <HomeScreen onLogout={onLogout} />
      ) : (
        <ProfileScreen onLogout={onLogout} />
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
