import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../screens/theme';

interface OfflineWarningModalProps {
  visible: boolean;
  actionType: 'receive' | 'start' | 'sleep' | 'finish';
  onCancel: () => void;
  onContinue: () => void;
  customMessage?: string; // Optional custom message
}

const OfflineWarningModal: React.FC<OfflineWarningModalProps> = ({
  visible,
  actionType,
  onCancel,
  onContinue,
  customMessage,
}) => {
  const getActionText = () => {
    switch (actionType) {
      case 'receive':
        return 'receive this job';
      case 'start':
        return 'start this job';
      case 'sleep':
        return 'log sleep';
      case 'finish':
        return 'complete this job';
      default:
        return 'perform this action';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Warning Icon */}
          <View style={styles.warningIconContainer}>
            <Text style={styles.warningIcon}>⚠️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>No Internet Connection</Text>

          {/* Message */}
          <Text style={styles.message}>
            {customMessage || `You are currently offline. If you ${getActionText()}, the changes will be saved locally and synchronized with the server when you reconnect.`}
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ℹ️ Your action will be queued and sent to the server automatically when internet is available.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.continueButton]}
              onPress={onContinue}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warningIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff3cd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#1976d2',
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: colors.warning,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OfflineWarningModal;
