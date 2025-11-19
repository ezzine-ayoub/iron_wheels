import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import MainTabs from '../screens/MainTabs';
import SplashScreen from '../components/SplashScreen';
import { authService } from '../services/authService';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    
    // 🆕 Register callback for session expiration
    authService.onSessionExpired(() => {
      console.log('⏰ Session expired detected, redirecting to Login...');
      setIsAuthenticated(false);
    });
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking session...');
      
      // Check if user is already authenticated
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        // Check if session is still valid (not expired)
        const isValid = await authService.isSessionValid();
        
        if (isValid) {
          console.log('✅ Valid session found, redirecting to Home');
          setIsAuthenticated(true);
        } else {
          console.log('⚠️ Session expired, redirecting to Login');
          setIsAuthenticated(false);
        }
      } else {
        console.log('ℹ️ No session found, redirecting to Login');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log('❌ Error checking session:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Show splash screen during verification
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen 
                {...props} 
                onLoginSuccess={() => setIsAuthenticated(true)} 
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Home">
            {(props) => (
              <MainTabs 
                {...props} 
                onLogout={() => setIsAuthenticated(false)} 
              />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
