import React, {useState, useEffect} from 'react';
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
    ActivityIndicator,
    Alert,
} from 'react-native';
import {Job} from '../types';
import {colors} from './theme';
import {apiClient} from '../services/apiClient';
import {authService} from '../services/authService';

interface HomeScreenProps {
    onLogout?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({onLogout}) => {
    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentStep, setCurrentStep] = useState<'receive' | 'start' | 'sleep' | 'finish' | null>(null);
    const [message, setMessage] = useState(false);
    useEffect(() => {
        fetchJob();
    }, []);

    const fetchJob = async () => {
        try {
            setLoading(true);

            const user = await authService.getCurrentUser();

            if (!user) {
                console.log('❌ No user found');
                setJob(null);
                setCurrentStep(null);
                return;
            }

            console.log('🔍 Fetching job for driver:', user.id);

            const response = await apiClient.get<Job>(`/jobs/${user.id}`);

            if (response) {
                console.log('✅ Job fetched:', response);
                setJob(response);

                // Determine current step based on API fields
                const step = determineCurrentStep(response);
                setCurrentStep(step);
                console.log('📍 Current step:', step);
            } else {
                console.log('ℹ️ No job available');
                setJob(null);
                setCurrentStep(null);
            }
        } catch (error: any) {
            console.log('❌ Error fetching job:', error);

            if (error.message?.includes('404') || error.message?.includes('not found')) {
                console.log('ℹ️ No job available for driver');
                setJob(null);
                setCurrentStep(null);
            } else {
                Alert.alert('Error', 'Failed to load job. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Determine current step based on existing API fields
    const determineCurrentStep = (jobData: Job): 'receive' | 'start' | 'sleep' | 'finish' | null => {
        if (!jobData) return null;

        // Step 1: Not received yet
        if (!jobData.isReceived) {
            return 'receive';
        }

        // Step 2: Received but not started (no startDatetime)
        if (jobData.isReceived && !jobData.startDatetime) {
            return 'start';
        }
        // Step 3: Started but sleep not logged yet (startDatetime exists but endDatetime doesn't)
        if (jobData.startDatetime && jobData.endDatetime===null && jobData.sleepNorway===0 && jobData.sleepSweden==0) {
            return 'sleep';
        }
        // Step 4: Sleep logged but not finished (endDatetime exists but not finished)
        if (!jobData.endDatetime && !jobData.isFinished) {
            return 'finish';
        }

        return null;
    };

    const handleReceive = async () => {
        if (!job) return;

        try {
            setActionLoading(true);
            console.log('📥 Receiving job:', job.id);

            const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/receive`);

            console.log('✅ Job received successfully');
            console.log('🔄 Updated job:', updatedJob);

            // Update job with response
            setJob(updatedJob);

            // Determine new step
            const step = determineCurrentStep(updatedJob);
            setCurrentStep(step);
            console.log('📍 New step:', step);
        } catch (error: any) {
            console.log('❌ Error receiving job:', error);
            Alert.alert('Error', 'Failed to receive job. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStart = async () => {
        if (!job) return;

        try {
            setActionLoading(true);
            console.log('▶️ Starting job:', job.id);

            const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/start`);

            console.log('✅ Job started successfully');
            console.log('🔄 Updated job:', updatedJob);

            // Update job with response
            setJob(updatedJob);

            // Determine new step
            const step = determineCurrentStep(updatedJob);
            setCurrentStep(step);
            console.log('📍 New step:', step);
        } catch (error: any) {
            console.log('❌ Error starting job:', error);
            Alert.alert('Error', 'Failed to start job. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSleep = () => {
        setShowModal(true);
    };

    const handleCountryChoice = async (country: string) => {
        if (!job) return;

        try {
            setActionLoading(true);
            setShowModal(false);

            console.log('😴 Logging sleep in:', country);

            const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/sleep`, {
                country: country.toLowerCase(),
            });
            // Update job with response
            setJob(updatedJob);

            // Determine new step
            const step = determineCurrentStep(updatedJob);
            setCurrentStep(step);
            console.log('📍 New step:', step);
        } catch (error: any) {
            console.log('❌ Error logging sleep:', error);
            Alert.alert('Error', 'Failed to log sleep. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinish = async () => {
        if (!job) return;

        try {
            setActionLoading(true);
            console.log('✅ Finishing job:', job.id);

            // Immediately hide the card before API call
            setJob(null);
            setCurrentStep(null);

            const response = await apiClient.post<Job>(`/jobs/${job.id}/finish`);
            console.log('🔄 Finished job response:', response);
            // Wait 3 seconds then check for new jobs
            setMessage(true)
            setTimeout(() => {
                setMessage(false);
                fetchJob();
            }, 3000);
        } catch (error: any) {
            console.log('❌ Error finishing job:', error);
            Alert.alert('Error', 'Failed to finish job. Please try again.');
            // Refresh to restore the job if finish failed
            await fetchJob();
        } finally {
            setActionLoading(false);
        }
    };
    const getStatusText = (): string => {
        switch (currentStep) {
            case 'receive':
                return 'New Job';
            case 'start':
                return 'Ready to Start';
            case 'sleep':
                return 'In Progress';
            case 'finish':
                return 'Ready to Complete';
            default:
                return 'No Active Job';
        }
    };

    const renderActionButton = () => {
        if (!job || !currentStep) return null;

        switch (currentStep) {
            case 'receive':
                return (
                    <TouchableOpacity
                        style={[styles.receiveButton, actionLoading && styles.buttonDisabled]}
                        onPress={handleReceive}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color={colors.white}/>
                        ) : (
                            <Text style={styles.buttonText}>Receive Job</Text>
                        )}
                    </TouchableOpacity>
                );

            case 'start':
                return (
                    <TouchableOpacity
                        style={[styles.startButton, actionLoading && styles.buttonDisabled]}
                        onPress={handleStart}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color={colors.white}/>
                        ) : (
                            <Text style={styles.buttonText}>Start Job</Text>
                        )}
                    </TouchableOpacity>
                );

            case 'sleep':
                return (
                    <>
                        <TouchableOpacity
                            style={[styles.sleepButton, actionLoading && styles.buttonDisabled]}
                            onPress={handleSleep}
                            disabled={actionLoading}
                        >
                            <Text style={styles.buttonText}>Log Sleep</Text>
                        </TouchableOpacity>
                    </>
                );

            case 'finish':
                return (
                    <TouchableOpacity
                        style={[styles.finishButton, actionLoading && styles.buttonDisabled]}
                        onPress={handleFinish}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color={colors.white}/>
                        ) : (
                            <Text style={styles.buttonText}>Complete Job</Text>
                        )}
                    </TouchableOpacity>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.outerContainer}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary}/>
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
                        {loading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={colors.primary}/>
                                    <Text style={styles.loadingText}>Loading job...</Text>
                                </View>
                            ) :
                            job?.isFinished === false ? (<View style={styles.card}>
                                {/* Status Badge */}
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>{getStatusText()}</Text>
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

                                {/* Single Action Button */}
                                <View style={styles.buttonContainer}>
                                    {renderActionButton()}
                                </View>
                            </View>) : message ?
                                (
                                    <View style={styles.emptyContainer}>
                                        <View style={styles.emptyIconContainer}>
                                            <Text style={styles.emptyIcon}>✓</Text>
                                        </View>
                                        <Text style={styles.emptyTitle}>All Done!</Text>
                                        <Text style={styles.emptyText}>No active jobs at the moment</Text>
                                    </View>
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <View style={styles.emptyIconContainer}>
                                            <Text style={styles.emptyIcon}>📋</Text>
                                        </View>
                                        <Text style={styles.emptyTitle}>No Jobs Available</Text>
                                        <Text style={styles.emptyText}>There are no jobs assigned to you at the
                                            moment</Text>
                                        <TouchableOpacity
                                            style={styles.refreshButton}
                                            onPress={fetchJob}
                                        >
                                            <Text style={styles.refreshButtonText}>Refresh</Text>
                                        </TouchableOpacity>
                                    </View>
                                )
                        }
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
                                        <View style={[styles.closeIconLine, styles.closeIconLine1]}/>
                                        <View style={[styles.closeIconLine, styles.closeIconLine2]}/>
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>Where do you sleep?</Text>
                                <Text style={styles.modalSubtitle}>Select the country</Text>

                                <TouchableOpacity
                                    style={[styles.modalButton, styles.swedenButton]}
                                    onPress={() => handleCountryChoice('Sweden')}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color={colors.white}/>
                                    ) : (
                                        <Text style={styles.modalButtonText}>🇸🇪 Sweden</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalButton, styles.norwayButton]}
                                    onPress={() => handleCountryChoice('Norway')}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color={colors.white}/>
                                    ) : (
                                        <Text style={styles.modalButtonText}>🇳🇴 Norway</Text>
                                    )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '500',
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
        shadowOffset: {width: 0, height: 2},
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
        shadowOffset: {width: 0, height: 1},
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
        shadowOffset: {width: 0, height: 2},
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
        shadowOffset: {width: 0, height: 2},
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
        shadowOffset: {width: 0, height: 2},
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
        shadowOffset: {width: 0, height: 2},
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
    buttonDisabled: {
        opacity: 0.6,
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
        backgroundColor: colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyIcon: {
        fontSize: 40,
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
        textAlign: 'center',
        paddingHorizontal: 40,
        marginBottom: 20,
    },
    refreshButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 25,
        elevation: 3,
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    refreshButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
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
        transform: [{rotate: '45deg'}],
    },
    closeIconLine2: {
        transform: [{rotate: '-45deg'}],
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
        shadowOffset: {width: 0, height: 2},
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
