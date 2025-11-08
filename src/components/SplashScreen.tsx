import React from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Text } from 'react-native';
import { colors } from '../screens/theme';

const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Image 
            source={require('../assets/logo.png')}
            style={styles.logo}
          />
        </View>
      </View>
      <ActivityIndicator 
        size="large" 
        color={colors.primary} 
        style={styles.loader}
      />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondary,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
  },
  loader: {
    marginTop: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default SplashScreen;
