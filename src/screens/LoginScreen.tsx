import React, {useState} from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
} from 'react-native';

import {colors} from './theme';
import {authService} from '../services/authService';
import ChangePasswordModal from '../components/ChangePasswordModal';
import FirebaseNotificationService from '../services/FirebaseNotificationService';

import ForgotPasswordModal from '../components/ForgotPasswordModal';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({onLoginSuccess}) => {
    const [driverNo, setDriverNo] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [responseRequest, setResponseRequest] = useState({});

    const handleLogin = async () => {
        if (!driverNo || !password) {
            Alert.alert(
                'Missing Information',
                'Please enter your driver number and password',
                [{text: 'OK'}]
            );
            return;
        }

        setLoading(true);

        try {
            const result = await authService.login({driverNo, password});
            setResponseRequest(result);
            
            // Check if user must change password
            if (!result.passwordChanged) {
                console.log('⚠️ passwordChanged = false, showing modal...');
                setShowPasswordModal(true);
                setLoading(false);
                return;
            }

            // Password already changed, normal redirection
            console.log('✅ passwordChanged = true, redirecting to Home');
            
            // ✅ Sync Firebase token to server after successful login
            try {
                await FirebaseNotificationService.syncTokenToServer();
                console.log('✅ Firebase token synced after login');
            } catch (error) {
                console.warn('⚠️ Could not sync Firebase token after login:', error);
                // Don't block login if token sync fails
            }
            
            onLoginSuccess();
        } catch (error: any) {
            const errorMsg = error.message || 'Incorrect credentials. Please try again.';

            // Show only Alert
            Alert.alert(
                'Login Failed',
                errorMsg,
                [{text: 'OK'}]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        setShowForgotPasswordModal(true);
    };

    return (
        <>
            <ImageBackground
                source={{uri: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800'}}
                style={styles.backgroundImage}
                imageStyle={styles.backgroundImageStyle}
            >
                <View style={styles.overlay}/>
                <KeyboardAvoidingView
                    style={styles.cleanContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.content}>
                        <View style={styles.logoContainer}>
                            <View style={styles.logoCircle}>
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.logoImage}
                                />
                            </View>
                        </View>

                        <Text style={styles.title}>Login</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Driver Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter driver number"
                                value={driverNo}
                                onChangeText={setDriverNo}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="default"
                                editable={!loading}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, styles.zwinButton, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.white}/>
                            ) : (
                                <Text style={styles.buttonText}>Login</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.forgotPasswordContainer}
                            onPress={handleForgotPassword}
                            disabled={loading}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </ImageBackground>

            {/* Mandatory password change modal */}
            <ChangePasswordModal
                visible={showPasswordModal}
                oldPasswordChanged={password}
                response={responseRequest}
                onPasswordChanged={() => {
                    console.log('✅ Password changed, redirecting to Home');
                    setShowPasswordModal(false);
                    onLoginSuccess();
                }}
            />

            <ForgotPasswordModal
                visible={showForgotPasswordModal}
                onClose={() => setShowForgotPasswordModal(false)}
            />
        </>
    );
};

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
    },
    backgroundImageStyle: {
        opacity: 0.15,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 58, 94, 0.85)',
    },
    cleanContainer: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    logoImage: {
        width: 120,
        height: 120,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.white,
        marginBottom: 32,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: {width: 0, height: 2},
        textShadowRadius: 4,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.white,
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: {width: 0, height: 1},
        textShadowRadius: 2,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.text,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    zwinButton: {
        borderRadius: 25,
    },
    forgotPasswordContainer: {
        alignItems: 'center',
        marginTop: 16,
    },
    forgotPasswordText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: {width: 0, height: 1},
        textShadowRadius: 2,
    },
});

export default LoginScreen;
