// Popup de changement de mot de passe obligatoire
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
            newErrors.old = 'Ancien mot de passe requis';
            isValid = false;
        }

        // @ts-ignore
        if (oldPassword !== oldPasswordChanged) {
            newErrors.old = 'old password not correct';
            isValid = false;
        }

        if (!newPassword) {
            newErrors.new = 'Nouveau mot de passe requis';
            isValid = false;
        } else if (newPassword.length < 8) {
            newErrors.new = 'Minimum 8 caractères';
            isValid = false;
        }

        if (newPassword !== confirmPassword) {
            newErrors.confirm = 'Les mots de passe ne correspondent pas';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleChangePassword = async () => {

        if (!validateForm()) return;

        setLoading(true);

        try {
            const {authService} = await import('../services/authService');
            const result = await authService.changePassword({oldPassword, newPassword,response});
            console.log(result.success);
            if (result.success) {
                // Réinitialiser les champs
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setErrors({old: '', new: '', confirm: ''});

            }
        } catch (error: any) {
            // 🆕 Si c'est l'erreur de vérification locale, afficher sous le champ
            if (error.message === 'Ancien mot de passe incorrect') {
                setErrors({
                    old: 'L\'ancien mot de passe ne correspond pas à celui utilisé pour se connecter',
                    new: '',
                    confirm: ''
                });
            } else {
                // Autres erreurs, afficher en Alert
                Alert.alert('❌ Erreur', error.message);
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
                    <Text style={styles.title}>Changement obligatoire</Text>
                    <Text style={styles.subtitle}>Changez votre mot de passe pour continuer</Text>

                    <TextInput
                        style={[styles.input, errors.old && styles.inputError]}
                        placeholder="Ancien mot de passe"
                        value={oldPassword}
                        onChangeText={(text) => {
                            setOldPassword(text);
                            // Réinitialiser l'erreur quand l'utilisateur retape
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
                        placeholder="Nouveau mot de passe"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                    {errors.new ? <Text style={styles.error}>{errors.new}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.confirm && styles.inputError]}
                        placeholder="Confirmer le mot de passe"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                    {errors.confirm ? <Text style={styles.error}>{errors.confirm}</Text> : null}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleChangePassword}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.buttonText}>Changer</Text>}
                    </TouchableOpacity>
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
    button: {backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8},
    buttonDisabled: {opacity: 0.6},
    buttonText: {color: '#FFF', fontSize: 16, fontWeight: '600'},
});

export default ChangePasswordModal;
