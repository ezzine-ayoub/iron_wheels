// Mandatory password change popup
import React, {useState} from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Alert,
} from 'react-native';
import {colors} from '../screens/theme';

interface ChangePasswordModalProps {
    visible: boolean;
    onPasswordChanged: () => void;
    oldPasswordChanged: string;
    response: any;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
                                                                     visible,
                                                                     onPasswordChanged,
                                                                     oldPasswordChanged,
                                                                     response,
                                                                 }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({old: '', new: '', confirm: ''});

    const validateForm = (): boolean => {
        const newErrors = {old: '', new: '', confirm: ''};
        let isValid = true;

        if (!oldPassword) {
            newErrors.old = 'Old password required';
            isValid = false;
        }

        // @ts-ignore
        if (oldPassword !== oldPasswordChanged) {
            newErrors.old = 'Old password is incorrect';
            isValid = false;
        }

        if (!newPassword) {
            newErrors.new = 'New password required';
            isValid = false;
        } else if (newPassword.length < 8) {
            newErrors.new = 'Minimum 8 characters';
            isValid = false;
        }

        if (newPassword !== confirmPassword) {
            newErrors.confirm = 'Passwords do not match';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleCancel = () => {
        // Clean all fields
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({old: '', new: '', confirm: ''});
    };

    const handleChangePassword = async () => {

        if (!validateForm()) return;

        setLoading(true);

        try {
            const {authService} = await import('../services/authService');
            const result = await authService.changePassword({oldPassword, newPassword, response});
            console.log(result.success);
            if (result.success) {
                // Reset fields
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setErrors({old: '', new: '', confirm: ''});

                // Notify parent
                onPasswordChanged();
            }
        } catch (error: any) {
            // 🆕 If it's local verification error, display under field
            if (error.message === 'Incorrect old password') {
                setErrors({
                    old: 'The old password does not match the one used to log in',
                    new: '',
                    confirm: ''
                });
            } else {
                // Other errors, display in Alert
                Alert.alert('❌ Error', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.icon}>🔐</Text>
                    <Text style={styles.title}>Password Change Required</Text>
                    <Text style={styles.subtitle}>Change your password to continue</Text>

                    <TextInput
                        style={[styles.input, errors.old && styles.inputError]}
                        placeholder="Old password"
                        value={oldPassword}
                        onChangeText={(text) => {
                            setOldPassword(text);
                            // Reset error when user types again
                            if (errors.old) {
                                setErrors({...errors, old: ''});
                            }
                        }}
                        secureTextEntry
                        editable={!loading}
                    />
                    {errors.old ? <Text style={styles.error}>{errors.old}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.new && styles.inputError]}
                        placeholder="New password"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                    {errors.new ? <Text style={styles.error}>{errors.new}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.confirm && styles.inputError]}
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                    {errors.confirm ? <Text style={styles.error}>{errors.confirm}</Text> : null}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, loading && styles.buttonDisabled]}
                            onPress={handleCancel}
                            disabled={loading}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.button, styles.changeButton, loading && styles.buttonDisabled]}
                            onPress={handleChangePassword}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.changeButtonText}>Change</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center'},
    modal: {backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '90%', maxWidth: 400},
    icon: {fontSize: 48, textAlign: 'center', marginBottom: 12},
    title: {fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8},
    subtitle: {fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20},
    input: {backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 16},
    inputError: {borderColor: 'red', borderWidth: 1},
    error: {color: 'red', fontSize: 12, marginTop: -8, marginBottom: 8},
    buttonContainer: {flexDirection: 'row', gap: 12, marginTop: 8},
    button: {flex: 1, borderRadius: 10, padding: 14, alignItems: 'center'},
    cancelButton: {backgroundColor: '#6B7280'},
    changeButton: {backgroundColor: colors.primary},
    buttonDisabled: {opacity: 0.6},
    cancelButtonText: {color: '#FFF', fontSize: 16, fontWeight: '600'},
    changeButtonText: {color: '#FFF', fontSize: 16, fontWeight: '600'},
});

export default ChangePasswordModal;
