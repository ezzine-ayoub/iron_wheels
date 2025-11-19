import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../screens/theme';

const NetworkIndicator: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('📡 Network status:', state.isConnected ? 'Connected' : 'Disconnected');
      setIsConnected(state.isConnected);
      
      // Animate the icon when status changes
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // WiFi icon component
  const WifiIcon = ({ connected }: { connected: boolean }) => (
    <View style={styles.wifiIcon}>
      <View style={[styles.wifiDot, connected ? styles.wifiConnected : styles.wifiDisconnected]} />
      <View style={[styles.wifiArc1, connected ? styles.wifiConnected : styles.wifiDisconnected]} />
      <View style={[styles.wifiArc2, connected ? styles.wifiConnected : styles.wifiDisconnected]} />
      <View style={[styles.wifiArc3, connected ? styles.wifiConnected : styles.wifiDisconnected]} />
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {isConnected === true && (
        <View style={styles.connectedBadge}>
          <Text style={styles.connectedText}>Online</Text>
        </View>
      )}
      {isConnected === false && (
        <View style={styles.disconnectedBadge}>
          <Text style={styles.disconnectedText}>Offline</Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  wifiIcon: {
    width: 24,
    height: 24,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wifiDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 2,
  },
  wifiArc1: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    transform: [{ rotate: '45deg' }],
  },
  wifiArc2: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -2,
    transform: [{ rotate: '45deg' }],
  },
  wifiArc3: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -4,
    transform: [{ rotate: '45deg' }],
  },
  wifiConnected: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  wifiDisconnected: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  connectedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  connectedText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  disconnectedBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  disconnectedText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
});

export default NetworkIndicator;
