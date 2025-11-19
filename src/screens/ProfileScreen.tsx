import React, {useEffect, useState} from 'react';
import {
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {colors} from './theme';
import {authService} from '../services/authService';
import EditProfileModal from '../components/EditProfileModal';
import OfflineWarningModal from '../components/OfflineWarningModal';
import {apiClient} from '../services/apiClient';
import NetworkIndicator from '../components/NetworkIndicator';
import SyncBar from '../components/SyncBar';
import {offlineActionsService} from '../services/offlineActionsService';
import {jobStorageService} from '../services/jobStorageService';

interface ProfileScreenProps {
    onLogout?: () => void;
    onNavigateHome?: () => void;
}

const EditIcon = () => (
    <View style={styles.actionIcon}>
        <View style={styles.pencilContainer}>
            <View style={styles.pencilBody}/>
            <View style={styles.pencilTip}/>
        </View>
    </View>
);

const ProfileScreen: React.FC<ProfileScreenProps> = ({onLogout, onNavigateHome}) => {
    const [user, setUser] = useState({
        driverNo: '',
        name: '',
        phone: '',
        personalNo: '',
        employed: null,
        email: '',
        id: '',
    });
    const [loading, setLoading] = useState(true);
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean>(true);
    const [pendingActionsCount, setPendingActionsCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [offlineWarningVisible, setOfflineWarningVisible] = useState(false);
    const [pendingProfileUpdate, setPendingProfileUpdate] = useState<{
        name: string;
        phone: string;
        email: string;
        personalNo: string;
    } | null>(null);

    useEffect(() => {
        loadUserData();
        checkPendingActions();

        // Listen to network changes
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected ?? false);
            if (state.isConnected) {
                checkPendingActions();
            }
        });

        return () => unsubscribe();
    }, []);

    const checkPendingActions = async () => {
        const count = await offlineActionsService.getPendingActionsCount();
        setPendingActionsCount(count);
    };

    const loadUserData = async () => {
        try {
            setLoading(true);
            console.log('💾 Chargement des données depuis la session...');

            // ✅ Récupérer uniquement depuis la session SQLite
            const authData = await authService.getStoredAuthData();

            if (authData) {
                console.log('📥 Auth data loaded===>:', {
                    id: authData.id,
                    name: authData.name,
                    email: authData.email,
                    phone: authData.phone,
                    personalNo: authData.personalNo,
                    driverNo: authData.driverNo,
                    employed: authData.employed,
                });


                setUser({
                    driverNo: authData.driverNo || '',
                    name: authData.name || '',
                    personalNo: authData.personalNo || '', // @ts-ignore
                    employed: authData.employed || null,
                    phone: authData.phone || '',
                    email: authData.email || '',
                    id: authData.id || ''
                });
                console.log('✅ Données utilisateur chargées depuis la session');
            } else {
                console.log('⚠️ Aucune session trouvée');
                Alert.alert('Session Error', 'No user session found. Please login again.');
            }
        } catch (error) {
            console.error('❌ Erreur chargement données utilisateur:', error);
            Alert.alert('Error', 'Failed to load user data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        // Check if there are pending actions
        const pendingCount = await offlineActionsService.getPendingActionsCount();

        if (pendingCount > 0) {
            Alert.alert(
                'Pending Actions',
                `You have ${pendingCount} action(s) that haven't been synced yet. If you logout now, these changes will be lost.`,
                [
                    {text: 'Cancel', style: 'cancel'},
                    {
                        text: 'Sync First',
                        style: 'default',
                        onPress: async () => {
                            if (isConnected) {
                                await handleSyncActions();
                            } else {
                                Alert.alert('No Internet', 'Please connect to the internet to sync your actions before logging out.');
                            }
                        }
                    },
                    {
                        text: 'Logout Anyway',
                        style: 'destructive',
                        onPress: performLogout
                    },
                ]
            );
        } else {
            Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                    {text: 'Cancel', style: 'cancel'},
                    {
                        text: 'Logout',
                        style: 'destructive',
                        onPress: performLogout
                    },
                ]
            );
        }
    };

    const performLogout = async () => {
        try {
            // Clear all pending actions
            await offlineActionsService.clearAll();
            console.log('✅ Pending actions cleared');

            // Clear cached jobs
            await jobStorageService.deleteJob();
            console.log('✅ Cached jobs cleared');

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
    };

    const handleEditProfile = () => {
        setEditModalVisible(true);
    };

    const handleSaveProfile = async (updatedUser: { name: string; phone: string; email: string; personalNo: string }) => {
        // Check if offline
        if (!isConnected) {
            setPendingProfileUpdate(updatedUser);
            setEditModalVisible(false);
            setOfflineWarningVisible(true);
            return;
        }

        // If online, proceed with normal save
        await performProfileUpdate(updatedUser);
    };

    const performProfileUpdate = async (updatedUser: { name: string; phone: string; email: string; personalNo: string }) => {
        try {
            setIsSaving(true);
            console.log('Attempting to save profile:', updatedUser);

            // ✅ Vérifier que l'utilisateur a un ID
            if (!user.id) {
                console.error('❌ User ID not found');
                Alert.alert('Error', 'User session invalid. Please logout and login again.');
                setIsSaving(false);
                return;
            }

            if (!isConnected) {
                // Update local state only
                setUser(prevUser => ({
                    ...prevUser,
                    ...updatedUser,
                }));

                // Save to offline queue
                await offlineActionsService.addPendingAction({
                    jobId: 0, // Special ID for profile updates
                    actionType: 'start', // We'll reuse this type
                    actionData: JSON.stringify({
                        type: 'profile_update',
                        userId: user.id,
                        driverNo: user.driverNo,
                        employed: user.employed,
                        data: updatedUser,
                    }),
                    timestamp: new Date().toISOString(),
                });

                Alert.alert('Saved Offline', 'Profile updated locally. Will sync when online.');
                await checkPendingActions();
                setEditModalVisible(false);
                return;
            }

            await apiClient.put(`/users/complete-profile/${user.driverNo}`, {
                email: updatedUser.email,
                name: updatedUser.name,
                phone: updatedUser.phone,
                personalNo: updatedUser.personalNo,
                employed: user.employed,
            });

            // Update local state
            setUser(prevUser => ({
                ...prevUser,
                ...updatedUser,
            }));

            setEditModalVisible(false);
            Alert.alert('Success', 'Your profile has been successfully updated.');
            console.log('Profile saved successfully.');

        } catch (error: any) {
            console.error('Failed to save profile:', error);
            let errorMessage = 'Failed to update profile. Please try again.';
            if (error.message && error.message.includes('Insufficient role')) {
                errorMessage = 'You do not have sufficient permissions to edit your profile. Please contact an administrator.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    // Sync pending actions
    const handleSyncActions = async () => {
        if (!isConnected) {
            Alert.alert('No Internet', 'Please connect to the internet to sync your actions.');
            return;
        }

        setIsSyncing(true);

        try {
            const pendingActions = await offlineActionsService.getPendingActions();

            if (pendingActions.length === 0) {
                Alert.alert('No Actions', 'There are no pending actions to sync.');
                return;
            }

            console.log(`🔄 Syncing ${pendingActions.length} pending actions...`);

            let successCount = 0;
            let failCount = 0;

            for (const action of pendingActions) {
                try {
                    console.log(`📤 Syncing ${action.actionType} for job ${action.jobId}`);

                    // Check if it's a profile update
                    if (action.jobId === 0 && action.actionData) {
                        const actionData = JSON.parse(action.actionData);
                        if (actionData.type === 'profile_update') {
                            console.log('📤 Syncing profile update...');

                            // ✅ Vérifier que l'userId et driverNo existent
                            if (!actionData.userId || !actionData.driverNo) {
                                console.error('❌ Missing userId or driverNo in pending profile update');
                                failCount++;
                                continue;
                            }

                            // ✅ apiClient.put gère automatiquement l'accessToken via ensureValidToken()
                            await apiClient.put(`/users/complete-profile/${actionData.driverNo}`, {
                                email: actionData.data.email,
                                name: actionData.data.name,
                                phone: actionData.data.phone,
                                personalNo: actionData.data.personalNo,
                                employed: actionData.employed,
                            });
                            await offlineActionsService.markAsSynced(action.id!);
                            successCount++;
                            console.log('✅ Profile update synced successfully');
                            continue;
                        }
                    }

                    switch (action.actionType) {
                        case 'receive':
                            await apiClient.post(`/jobs/${action.jobId}/receive`);
                            break;
                        case 'start':
                            await apiClient.post(`/jobs/${action.jobId}/start`);
                            break;
                        case 'sleep':
                            const sleepData = action.actionData ? JSON.parse(action.actionData) : {};
                            await apiClient.post(`/jobs/${action.jobId}/sleep`, sleepData);
                            break;
                        case 'finish':
                            await apiClient.post(`/jobs/${action.jobId}/finish`);
                            break;
                    }

                    await offlineActionsService.markAsSynced(action.id!);
                    successCount++;
                    console.log(`✅ Synced ${action.actionType} successfully`);
                } catch (error: any) {
                    console.log(`❌ Failed to sync ${action.actionType}:`, error);
                    failCount++;
                }
            }

            // Clean up synced actions
            await offlineActionsService.clearSyncedActions();
            await checkPendingActions();

            // Reload user data after sync
            await loadUserData();

            if (failCount === 0) {
                Alert.alert('Sync Complete', `Successfully synced ${successCount} action(s).`);
            } else {
                Alert.alert('Sync Partial', `Synced ${successCount} action(s), but ${failCount} failed. Please try again later.`);
            }
        } catch (error: any) {
            console.log('❌ Error syncing actions:', error);
            Alert.alert('Sync Error', 'Failed to sync actions. Please try again.');
        } finally {
            setIsSyncing(false);
        }
    };

    // Handle offline warning modal
    const handleOfflineWarningContinue = async () => {
        setOfflineWarningVisible(false);

        if (pendingProfileUpdate) {
            await performProfileUpdate(pendingProfileUpdate);
            setPendingProfileUpdate(null);
        }
    };

    const handleOfflineWarningCancel = () => {
        setOfflineWarningVisible(false);
        setPendingProfileUpdate(null);
    };

    // Helper pour vérifier si une valeur existe
    const hasValue = (value: string | undefined | null): boolean => {
        return value !== undefined && value !== null && value.trim() !== '';
    };

    // Obtenir les champs avec valeurs
    const getFieldsWithValues = () => {
        return [
            {label: 'Driver No', value: user.driverNo},
            {label: 'User ID', value: user.id},
            {label: 'Email', value: user.email},
            {label: 'Phone', value: user.phone},
            {label: 'Personal Number', value: user.personalNo},
        ]
        // return fields.filter(field => hasValue(field.value));
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
                {!isLast && <View style={styles.divider}/>}
            </React.Fragment>
        );
    };

    return (
        <View style={styles.outerContainer}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary}/>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity 
                            style={styles.headerContent}
                            onPress={onNavigateHome}
                            activeOpacity={0.7}
                        >
                            <View style={styles.headerLogoCircle}>
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.headerLogo}
                                />
                            </View>
                            <Text style={styles.headerTitle}>Iron Wheels</Text>
                        </TouchableOpacity>
                        <NetworkIndicator/>
                    </View>

                    {/* Sync Bar */}
                    <SyncBar
                        pendingCount={pendingActionsCount}
                        onSync={handleSyncActions}
                        isSyncing={isSyncing}
                    />

                    {/* Content */}
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.content}
                    >
                        {/* Profile Card */}
                        <View style={styles.profileCard}>

                            {hasValue(user.name) && <Text style={styles.userName}>{user.name}</Text>}
                            <View style={styles.statusBadge}>
                                <View style={styles.statusDot}/>
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
                                <EditIcon/>
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

                        <View style={styles.bottomSpacing}/>
                    </ScrollView>
                </View>
                <EditProfileModal
                    visible={isEditModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    user={user}
                    onSave={handleSaveProfile}
                    isSaving={isSaving} // Pass isSaving prop
                />

                {/* Offline Warning Modal */}
                <OfflineWarningModal
                    visible={offlineWarningVisible}
                    actionType="start" // Using 'start' for profile update
                    onCancel={handleOfflineWarningCancel}
                    onContinue={handleOfflineWarningContinue}
                    customMessage="You are currently offline. If you edit your profile, the changes will be saved locally and synchronized with the server when you reconnect."
                />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 16,
        backgroundColor: colors.primary,
        borderBottomWidth: 0,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
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
        shadowOffset: {width: 0, height: 3},
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
        shadowOffset: {width: 0, height: 4},
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
        shadowOffset: {width: 0, height: 3},
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
        shadowOffset: {width: 0, height: 4},
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
        shadowOffset: {width: 0, height: 4},
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
        width: 24,
        height: 24,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pencilContainer: {
        width: 18,
        height: 18,
        transform: [{rotate: '135deg'}],
        alignItems: 'center',
    },
    pencilBody: {
        height: 12,
        width: 6,
        backgroundColor: colors.textSecondary,
        borderRadius: 1,
    },
    pencilTip: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderBottomWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: colors.textSecondary,
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
        shadowOffset: {width: 0, height: 2},
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
    debugCard: {
        backgroundColor: '#fff3cd',
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#ffc107',
    },
    debugTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#856404',
        marginBottom: 8,
    },
    debugText: {
        fontSize: 12,
        color: '#856404',
        marginBottom: 4,
        fontFamily: 'monospace',
    },
});

export default ProfileScreen;
