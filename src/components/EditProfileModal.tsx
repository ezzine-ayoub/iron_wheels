import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../screens/theme';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: {
    name: string;
    phone: string;
    email: string;
    personalNo: string;
  };
  onSave: (updatedUser: { name: string; phone: string; email: string; personalNo: string }) => void;
  isSaving: boolean;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  user,
  onSave,
  isSaving,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [personalNo, setPersonalNo] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
      setEmail(user.email);
      setPersonalNo(user.personalNo);
    }
  }, [user, visible]);

  const handleSave = () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Name and email cannot be empty.');
      return;
    }
    if (!personalNo.trim()) {
      Alert.alert('Error', 'Personal number cannot be empty.');
      return;
    }
    onSave({ name, phone, email, personalNo });
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Edit Profile</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Personal Number</Text>
            <TextInput
              style={styles.input}
              value={personalNo}
              onChangeText={setPersonalNo}
              placeholder="Enter your personal number"
              keyboardType="default"
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonClose, isSaving && styles.buttonDisabled]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.textStyle}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSave, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.textStyle}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: colors.lightGray,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  button: {
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
  },
  buttonClose: {
    backgroundColor: colors.textSecondary,
  },
  buttonSave: {
    backgroundColor: colors.primary,
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default EditProfileModal;
