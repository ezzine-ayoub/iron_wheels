import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Job, User } from '../types';
import { colors } from './theme';

interface HomeScreenProps {
  onLogout?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  // Mock data - replace with real data from API
  const [job] = useState<Job>({
    id: '1',
    assigneeId: 'user-1',
    description: 'Delivery from Stockholm to Oslo - Urgent cargo transport',
    startCountry: 'Sweden',
    deliveryCountry: 'Norway',
    startDatetime: new Date('2024-01-15T08:00:00'),
    endDatetime: new Date('2024-01-16T18:00:00'),
    sleepSweden: 1,
    sleepNorway: 1,
    isReceived: false,
    isFinished: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      password: '',
      role: 'DRIVER' as any,
      driverNo: 'DRV-001',
      phone: '+46 70 123 4567',
      personalNo: '19900101-1234',
      employed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const [showCard, setShowCard] = useState(true);
  const [showReceive, setShowReceive] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleReceive = () => {
    setShowReceive(false);
    setShowStart(true);
  };

  const handleStart = () => {
    setShowStart(false);
    setShowSleep(true);
  };

  const handleSleep = () => {
    setShowModal(true);
  };

  const handleCountryChoice = (country: string) => {
    console.log('Selected country:', country);
    setShowModal(false);
    setShowSleep(false);
    setShowFinish(true);
  };

  const handleFinish = () => {
    setShowCard(false);
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          {showCard ? (
            <View style={styles.card}>
              {/* Status Badge */}
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {showReceive ? 'New Job' : showStart ? 'Ready to Start' : showSleep ? 'In Progress' : 'Ready to Finish'}
                </Text>
              </View>

              {/* Job Info Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Job Details</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Description:</Text>
                  <Text style={styles.value}>{job.description}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>From:</Text>
                  <Text style={styles.value}>{job.startCountry}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>To:</Text>
                  <Text style={styles.value}>{job.deliveryCountry}</Text>
                </View>
                <View style={styles.sleepRow}>
                  <View style={styles.sleepItem}>
                    <Text style={styles.sleepLabel}>Sleep Sweden:</Text>
                    <Text style={styles.sleepValue}>{job.sleepSweden}</Text>
                  </View>
                  <View style={styles.sleepItem}>
                    <Text style={styles.sleepLabel}>Sleep Norway:</Text>
                    <Text style={styles.sleepValue}>{job.sleepNorway}</Text>
                  </View>
                </View>
              </View>

              {/* Driver Info Section */}
              {job.assignee && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Driver Information</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Name:</Text>
                      <Text style={styles.value}>{job.assignee.name}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Driver No:</Text>
                      <Text style={styles.value}>{job.assignee.driverNo}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.label}>Phone:</Text>
                      <Text style={styles.value}>{job.assignee.phone}</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {showReceive && (
                  <TouchableOpacity style={styles.receiveButton} onPress={handleReceive}>
                    <Text style={styles.buttonText}>Receive Job</Text>
                  </TouchableOpacity>
                )}

                {showStart && (
                  <TouchableOpacity style={styles.startButton} onPress={handleStart}>
                    <Text style={styles.buttonText}>Start Job</Text>
                  </TouchableOpacity>
                )}

                {showSleep && (
                  <TouchableOpacity style={styles.sleepButton} onPress={handleSleep}>
                    <Text style={styles.buttonText}>Log Sleep</Text>
                  </TouchableOpacity>
                )}

                {showFinish && (
                  <TouchableOpacity 
                    style={styles.finishButton} 
                    onPress={handleFinish}
                  >
                    <Text style={styles.buttonText}>Complete Job</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>✓</Text>
              </View>
              <Text style={styles.emptyTitle}>All Done!</Text>
              <Text style={styles.emptyText}>No active jobs at the moment</Text>
            </View>
          )}
        </ScrollView>

        {/* Modal for Country Selection */}
        <Modal
          visible={showModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowModal(false)}
              >
                <View style={styles.closeIcon}>
                  <View style={[styles.closeIconLine, styles.closeIconLine1]} />
                  <View style={[styles.closeIconLine, styles.closeIconLine2]} />
                </View>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Where do you sleep?</Text>
              <Text style={styles.modalSubtitle}>Select the country</Text>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.swedenButton]}
                onPress={() => handleCountryChoice('Sweden')}
              >
                <Text style={styles.modalButtonText}>🇸🇪 Sweden</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.norwayButton]}
                onPress={() => handleCountryChoice('Norway')}
              >
                <Text style={styles.modalButtonText}>🇳🇴 Norway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statusBadge: {
    backgroundColor: colors.info,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  statusText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    width: 120,
  },
  value: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    fontWeight: '500',
  },
  sleepRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  sleepItem: {
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 120,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sleepLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  sleepValue: {
    fontSize: 24,
    color: colors.info,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginVertical: 12,
  },
  buttonContainer: {
    marginTop: 8,
  },
  receiveButton: {
    backgroundColor: colors.info,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.info,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginTop: 8,
  },
  startButton: {
    backgroundColor: colors.warning,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.warning,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginTop: 8,
  },
  sleepButton: {
    backgroundColor: colors.purple,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginTop: 8,
  },
  finishButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginTop: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 40,
    color: colors.white,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  closeIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
  },
  closeIconLine1: {
    transform: [{ rotate: '45deg' }],
  },
  closeIconLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  swedenButton: {
    backgroundColor: '#006AA7',
  },
  norwayButton: {
    backgroundColor: '#BA0C2F',
  },
  modalButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default HomeScreen;
