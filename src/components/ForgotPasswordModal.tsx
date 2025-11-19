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
import {authService} from '../services';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const [driverNo, setDriverNo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!driverNo) {
      Alert.alert('Missing Information', 'Please enter your driver number', [
        {text: 'OK'},
      ]);
      return;
    }

    setLoading(true);

    try {
      await authService.forgotPassword(driverNo);
      Alert.alert(
        'Success',
        'A password reset link has been sent to your registered contact.',
        [{text: 'OK', onPress: onClose}],
      );
    } catch (error: any) {
      const errorMsg =
        error.message || 'An error occurred. Please try again.';
      Alert.alert('Error', errorMsg, [{text: 'OK'}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Forgot Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your driver number"
            value={driverNo}
            onChangeText={setDriverNo}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Submit</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: colors.text,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 10,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ForgotPasswordModal;