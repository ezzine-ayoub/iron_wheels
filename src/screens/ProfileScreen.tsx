import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from './theme';
import { authService } from '../services/authService';

interface ProfileScreenProps {
  onLogout?: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const [user, setUser] = useState({
      name: '',
      phone: '',
      personal_No: '',
    email: '',
    id: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      console.log('💾 Chargement des données depuis la session...');
      
      // ✅ Récupérer uniquement depuis la session SQLite
      const authData = await authService.getStoredAuthData();
      
      if (authData) {
        setUser({
            name: authData.name || '',
            personal_No: authData.personal_No || '',
            phone:  authData.phone || '',
            email: authData.email || '',
          id: authData.id || ''
        });
        console.log('✅ Données utilisateur chargées depuis la session');
      } else {
        console.log('⚠️ Aucune session trouvée');
      }
    } catch (error) {
      console.error('❌ Erreur chargement données utilisateur:', error);
      Alert.alert('Error', 'Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Nettoyer la session SQLite
              await authService.logout();
              console.log('✅ Session nettoyée de SQLite');
              
              // Notifier le parent pour changer l'état
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('❌ Erreur lors du logout:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'This feature will be available soon!');
  };

  // Helper pour vérifier si une valeur existe
  const hasValue = (value: string | undefined | null): boolean => {
    return value !== undefined && value !== null && value.trim() !== '';
  };

  // Obtenir les champs avec valeurs
  const getFieldsWithValues = () => {
    const fields = [
      { label: 'User ID', value: user.id },
      { label: 'Email', value: user.email },
      { label: 'Phone', value: user.phone },
      { label: 'Personal Number', value: user.personal_No },
    ];
    return fields.filter(field => hasValue(field.value));
  };

  // Fonction pour rendre une ligne d'info seulement si la valeur existe
  const renderInfoRow = (label: string, value: string | undefined | null, index: number, totalItems: number) => {
    if (!hasValue(value)) {
      return null;
    }

    const isLast = index === totalItems - 1;

    return (
      <React.Fragment key={label}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
        {!isLast && <View style={styles.divider} />}
      </React.Fragment>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerLogoCircle}>
                <Image 
                  source={require('../assets/logo.png')}
                  style={styles.headerLogo}
                />
              </View>
              <Text style={styles.headerTitle}>Iron Wheels</Text>
            </View>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.content}
          >
            {/* Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={require('../assets/logo.png')}
                  style={styles.avatar}
                />
              </View>
              {hasValue(user.name) && <Text style={styles.userName}>{user.name}</Text>}
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>

            {/* Information Card - Afficher seulement si au moins un champ a une valeur */}
            {getFieldsWithValues().length > 0 && (
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                
                {getFieldsWithValues().map((field, index, array) => 
                  renderInfoRow(field.label, field.value, index, array.length)
                )}
              </View>
            )}

            {/* Actions Card */}
            <View style={styles.actionsCard}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleEditProfile}
              >
                <Text style={styles.actionIcon}>✏️</Text>
                <Text style={styles.actionText}>Edit Profile</Text>
                <Text style={styles.actionArrow}>›</Text>
              </TouchableOpacity>

            </View>

            {/* Logout Button */}
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

            <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    marginRight: 12,
  },
  headerLogo: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  avatar: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  statusText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGray,
  },
  actionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 24,
    color: colors.textSecondary,
    fontWeight: '300',
  },
  logoutButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default ProfileScreen;
