import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { colors } from '../screens/theme';

interface BottomTabsProps {
  activeTab: 'home' | 'profile';
  onTabChange: (tab: 'home' | 'profile') => void;
}

const HomeIcon = ({ active }: { active: boolean }) => {
  const iconColor = active ? colors.primary : colors.textSecondary;
  return (
    <View style={styles.iconWrapper}>
      <View style={[styles.iconBase, active && styles.iconActive]}>
        {/* Square with door */}
        <View style={[styles.homeSquare, { borderColor: iconColor }]}>
          <View style={[styles.homeDoor, { backgroundColor: iconColor }]} />
        </View>
      </View>
    </View>
  );
};

const ProfileIcon = ({ active }: { active: boolean }) => {
  const iconColor = active ? colors.primary : colors.textSecondary;
  return (
    <View style={styles.iconWrapper}>
      <View style={[styles.iconBase, active && styles.iconActive]}>
        {/* Circle with outline */}
        <View style={[styles.profileCircle, { borderColor: iconColor }]} />
        <View style={[styles.profileShoulder, { borderColor: iconColor }]} />
      </View>
    </View>
  );
};

const BottomTabs: React.FC<BottomTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'home' && styles.activeTab]}
        onPress={() => onTabChange('home')}
      >
        <HomeIcon active={activeTab === 'home'} />
        <Text style={[styles.label, activeTab === 'home' && styles.activeLabel]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
        onPress={() => onTabChange('profile')}
      >
        <ProfileIcon active={activeTab === 'profile'} />
        <Text style={[styles.label, activeTab === 'profile' && styles.activeLabel]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingBottom: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingTop: 8,
  },
  activeTab: {
    borderTopWidth: 3,
    borderTopColor: colors.primary,
  },
  iconWrapper: {
    marginBottom: 4,
  },
  iconBase: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconActive: {
    transform: [{ scale: 1.1 }],
  },
  // Home Icon Styles - Square with door
  homeSquare: {
    width: 22,
    height: 22,
    borderWidth: 2.5,
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  homeDoor: {
    width: 8,
    height: 10,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginBottom: 1,
  },
  // Profile Icon Styles - Circle outline
  profileCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2.5,
    position: 'absolute',
    top: 1,
  },
  profileShoulder: {
    width: 20,
    height: 13,
    borderWidth: 2.5,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 0,
    position: 'absolute',
    bottom: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default BottomTabs;
