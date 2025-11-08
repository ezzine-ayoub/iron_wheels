import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import MainTabs from '../screens/MainTabs';
import SplashScreen from '../components/SplashScreen';
import { authService } from '../services/authService';
import { colors } from '../screens/theme';

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
    
    // 🆕 Enregistrer le callback pour l'expiration de session
    authService.onSessionExpired(() => {
      console.log('⏰ Session expirée détectée, redirection vers Login...');
      setIsAuthenticated(false);
    });
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Vérification de la session...');
      
      // Vérifier si l'utilisateur est déjà authentifié
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        // Vérifier si la session est toujours valide (pas expirée)
        const isValid = await authService.isSessionValid();
        
        if (isValid) {
          console.log('✅ Session valide trouvée, redirection vers Home');
          setIsAuthenticated(true);
        } else {
          console.log('⚠️ Session expirée, redirection vers Login');
          setIsAuthenticated(false);
        }
      } else {
        console.log('ℹ️ Aucune session trouvée, redirection vers Login');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de la session:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Afficher un splash screen pendant la vérification
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
