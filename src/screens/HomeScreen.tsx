import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import NetInfo from '@react-native-community/netinfo';
import { Job, SleepTrackingEntry } from '../types';
import { colors } from './theme';
import { apiClient } from '../services/apiClient';
import { authService } from '../services/authService';
import NetworkIndicator from '../components/NetworkIndicator';
import OfflineWarningModal from '../components/OfflineWarningModal';
import SyncBar from '../components/SyncBar';
import { AppEvents, storageService, syncService } from '../services';
import { useAppEvents } from '../hooks/useAppEvent';

interface HomeScreenProps {
  onLogout?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const { width } = useWindowDimensions();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<'receive' | 'start' | 'sleep' | 'finish' | null>(null);
  const [message, setMessage] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [offlineWarningVisible, setOfflineWarningVisible] = useState(false);
  const [pendingActionType, setPendingActionType] = useState<'receive' | 'start' | 'sleep' | 'finish' | null>(null);
  const [pendingCountryChoice, setPendingCountryChoice] = useState<string | null>(null);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  // Local state for sleep tracking checkboxes
  const [localSleepTracking, setLocalSleepTracking] = useState<SleepTrackingEntry[]>([]);
  // 🆕 State for what to display in modal (filtered view)
  const [displaySleepTracking, setDisplaySleepTracking] = useState<SleepTrackingEntry[]>([]);
  // 🆕 New states for custom city
  const [newCityName, setNewCityName] = useState('');
  const [showAddCityInput, setShowAddCityInput] = useState(false);

  // 🆕 Listen to Firebase notification events for real-time updates

  useAppEvents({ // @ts-ignore
    [AppEvents.JOB_CREATED]: (data) => {
      if (data.job) {
        setJob(data.job);
        const step = determineCurrentStep(data.job);
        setCurrentStep(step);
      } else {
        fetchJob(); // Fallback: fetch from SQLite
      }
    }, // @ts-ignore
    [AppEvents.JOB_UPDATED]: (data) => {
      if (data.job) {
        setJob(data.job);
        const step = determineCurrentStep(data.job);
        setCurrentStep(step);
      } else {
        fetchJob(); // Fallback: fetch from SQLite
      }
    }, // @ts-ignore
    [AppEvents.JOB_DELETED]: (data) => {
      setJob(null);
      setCurrentStep(null);
    },
  });

  useEffect(() => {
    const initialize = async () => {
      await initializeOfflineService();
      await fetchJob();
      await checkPendingActions();
    };

    initialize();

    // Listen to network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      const wasConnected = isConnected;

      setIsConnected(connected);

      // Auto-sync when connection is restored
      if (connected && !wasConnected) {
        console.log('🌐 Internet connection restored, auto-syncing...');
        handleAutoSync();
      }

      if (connected) {
        checkPendingActions();
      }
    });

    return () => unsubscribe();
  }, [isConnected]); // Add isConnected as dependency

  const initializeOfflineService = async () => {
    await syncService.init();
    await storageService.initDatabase();
  };

  const checkPendingActions = async () => {
    const count = await syncService.getPendingActionsCount();
    setPendingActionsCount(count);
  };

  const fetchJob = async (isRefreshing: boolean = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const user = await authService.getCurrentUser();

      if (!user) {
        console.log('❌ No user found');
        setJob(null);
        setCurrentStep(null);
        return;
      }

      console.log('🔍 Fetching job for driver:', user.id);

      // Check network status first
      const networkState = await NetInfo.fetch();
      const hasInternet = networkState.isConnected && networkState.isInternetReachable;

      if (hasInternet) {
        // ✅ ONLINE: Always fetch from server
        console.log('🌐 Online - Fetching from server...');
        try {
          const response = await apiClient.get<Job | null>(`/users/me/job`);

          if (response && response.id) {
            console.log('✅ Job fetched from API:', response);
            setJob(response);

            // Save to local storage for offline use
            await storageService.saveJob(response, false);

            const step = determineCurrentStep(response);
            setCurrentStep(step);
            console.log('📍 Current step:', step);
          } else {
            // API returned no job
            console.log('ℹ️ No job available from API');
            setJob(null);
            setCurrentStep(null);
            // Clear local job since server says there's no job
            await storageService.deleteJob(false);
          }
        } catch (apiError: any) {
          // Check if it's the normal "No job assigned" case
          if (apiError.message?.includes('No job assigned')) {
            console.log('ℹ️ No job assigned to driver');
            setJob(null);
            setCurrentStep(null);
            await storageService.deleteJob(false);
            return;
          }

          if (apiError.message?.includes('404') || apiError.message?.includes('not found')) {
            console.log('ℹ️ No job available (404)');
            setJob(null);
            setCurrentStep(null);
            await storageService.deleteJob(false);
            return;
          }

          // Real API error - show alert
          console.log('❌ API Error:', apiError.message);
          Alert.alert('Error', 'Failed to load job from server. Please try again.');
        }
      } else {
        // ✅ OFFLINE: Use local storage
        console.log('📴 Offline - Using local storage...');
        const localJob = await storageService.getJob();

        if (localJob && !localJob.isFinished) {
          console.log('💾 Using local job (offline):', localJob.id);
          setJob(localJob);
          const step = determineCurrentStep(localJob);
          setCurrentStep(step);
        } else {
          console.log('ℹ️ No local job available');
          setJob(null);
          setCurrentStep(null);
        }
      }
    } catch (error: any) {
      console.log('❌ Error in fetchJob:', error);
      setJob(null);
      setCurrentStep(null);
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    console.log('🔄 Pull to refresh triggered');
    await fetchJob(true);
  };

  // Determine current step based on existing API fields
  const determineCurrentStep = (jobData: Job): 'receive' | 'start' | 'sleep' | 'finish' | null => {
    if (!jobData) return null;

    // Step 1: Not received yet
    if (!jobData.isReceived) {
      return 'receive';
    }

    // If job is finished
    if (jobData.isFinished) {
      return null;
    }

    const sleepTracking = jobData.sleepTracking || [];
    
    // Find all disabled cities (cities that were started)
    const disabledCities = sleepTracking.filter(
      (entry: SleepTrackingEntry) => entry.disabled === true
    );

    // If no disabled cities exist, show Start (first time)
    if (disabledCities.length === 0) {
      return 'start';
    }

    // Get the last disabled city (most recent location)
    const lastDisabledCity = disabledCities[disabledCities.length - 1];

    // Check if last disabled city has been slept
    // If startAt exists but sleepAt is null -> show Sleep
    // If both startAt and sleepAt exist -> show Start (can start again)
    if (lastDisabledCity.startAt !== null && lastDisabledCity.sleepAt === null) {
      return 'sleep'; // Started but not slept yet
    }

    if (lastDisabledCity.startAt !== null && lastDisabledCity.sleepAt !== null) {
      return 'start'; // Slept, can start again
    }

    // Default: show Start
    return 'start';
  };

  const handleReceive = async () => {
    if (!job || !job.id) return;

    // Check if offline
    if (!isConnected) {
      setPendingActionType('receive');
      setOfflineWarningVisible(true);
      return;
    }

    await performReceiveAction();
  };

  const performReceiveAction = async () => {
    if (!job || !job.id) {
      console.error('❌ Error saving job:', 'Job or job ID is null');
      return;
    }
    try {
      setActionLoading(true);
      console.log('📥 Receiving job:', job.id);

      if (!isConnected) {
        // Update job locally
        const updatedJob = await storageService.updateReceiveStatus(job.id);
        if (updatedJob) {
          setJob(updatedJob);
          const step = determineCurrentStep(updatedJob);
          setCurrentStep(step);
        }

        // Save to offline queue
        await syncService.addPendingAction({
          jobId: job.id,
          actionType: 'receive',
          timestamp: new Date().toISOString(),
        });
        // Alert.alert('Saved Offline', 'Job received locally. Will sync when online.');
        await checkPendingActions();
        return;
      }

      const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/receive`);
      console.log('✅ Job received successfully');
      console.log('🔄 Updated job:', updatedJob);

      // If API returns null/empty, update local job manually
      if (!updatedJob || !updatedJob.id) {
        console.log('⚠️ API returned empty response, updating local job manually');
        const localUpdatedJob = await storageService.updateReceiveStatus(job.id);
        if (localUpdatedJob) {
          setJob(localUpdatedJob);
          const step = determineCurrentStep(localUpdatedJob);
          setCurrentStep(step);
          console.log('📍 New step (local):', step);
        }
      } else {
        setJob(updatedJob);

        // Save to local storage
        await storageService.saveJob(updatedJob);

        const step = determineCurrentStep(updatedJob);
        setCurrentStep(step);
        console.log('📍 New step:', step);
      }
    } catch (error: any) {
      console.log('❌ Error receiving job:', error);
      if (job && job.id) {
        Alert.alert('Error', 'Failed to receive job. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!job || !job.id) return;

    // Check if offline
    if (!isConnected) {
      setPendingActionType('start');
      setOfflineWarningVisible(true);
      return;
    }

    await performStartAction();
  };

  const handleStartFromLastCity = async () => {
    if (!job || !job.id) {
      console.error('❌ Error: No job available');
      return;
    }

    // Check if offline
    if (!isConnected) {
      setPendingActionType('start');
      setOfflineWarningVisible(true);
      return;
    }

    try {
      setActionLoading(true);
      console.log('▶️ Starting from last city:', job.id);

      const sleepTracking = job.sleepTracking || [];
      
      if (sleepTracking.length === 0) {
        Alert.alert('Error', 'No cities available in route');
        return;
      }
      
      // Find last disabled city
      const disabledCities = sleepTracking.filter((e: SleepTrackingEntry) => e.disabled === true);
      
      const now = new Date().toISOString();
      let newCity: SleepTrackingEntry;
      
      if (disabledCities.length === 0) {
        // No previous disabled city - start the first city in sleepTracking
        const firstCity = sleepTracking[0];
        console.log('ℹ️ No previous location found, starting first city:', firstCity.city);
        
        newCity = {
          index: sleepTracking.length, // Next index
          city: firstCity.city,
          country: null,
          startAt: now,
          sleepAt: null,
          sleepCount: 0,
          disabled: true, // Mark as disabled when started
        };
      } else {
        // Create new city with same name as last disabled city
        const lastDisabledCity = disabledCities[disabledCities.length - 1];
        console.log('✅ Found last disabled city:', lastDisabledCity.city);
        
        newCity = {
          index: sleepTracking.length, // Next index
          city: lastDisabledCity.city,
          country: null,
          startAt: now,
          sleepAt: null,
          sleepCount: 0,
          disabled: true, // Mark as disabled when started
        };
      }

      const updatedSleepTracking = [...sleepTracking, newCity];

      console.log(`✅ Creating new city: ${newCity.city} with startAt: ${now}`);

      if (!isConnected) {
        // Update locally
        const updatedJob = {
          ...job,
          sleepTracking: updatedSleepTracking,
        };

        await storageService.saveJob(updatedJob, false);
        setJob(updatedJob);
        const step = determineCurrentStep(updatedJob);
        setCurrentStep(step);

        // Save to offline queue
        await syncService.addPendingAction({
          jobId: job.id,
          actionType: 'start',
          actionData: JSON.stringify({ newCity }),
          timestamp: now,
        });
        await checkPendingActions();
        return;
      }

      // Send to server
      const response = await apiClient.post<Job>(`/jobs/${job.id}/start-from-last`);
      
      console.log('✅ Started from last city successfully');
      console.log('🔄 Updated job:', response);

      if (!response || !response.id) {
        console.log('⚠️ API returned empty, updating locally');
        const localUpdatedJob = {
          ...job,
          sleepTracking: updatedSleepTracking,
        };

        await storageService.saveJob(localUpdatedJob, false);
        setJob(localUpdatedJob);
        const step = determineCurrentStep(localUpdatedJob);
        setCurrentStep(step);
      } else {
        setJob(response);
        await storageService.saveJob(response);
        const step = determineCurrentStep(response);
        setCurrentStep(step);
      }
    } catch (error: any) {
      console.log('❌ Error starting from last city:', error);
      Alert.alert('Error', 'Failed to start from last location. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const performStartAction = async () => {
    if (!job || !job.id) {
      console.error('❌ Error starting job:', 'Job or job ID is null');
      return;
    }
    try {
      setActionLoading(true);
      console.log('▶️ Starting job:', job.id);

      if (!isConnected) {
        // Update job locally - set startAt on next city that doesn't have it
        const updatedSleepTracking = job.sleepTracking?.map((entry: SleepTrackingEntry) => {
          // Find first city without startAt
          if (entry.startAt === null) {
            return {
              ...entry,
              startAt: new Date().toISOString(),
            };
          }
          return entry;
        }) || [];

        const updatedJob = {
          ...job,
          sleepTracking: updatedSleepTracking,
        };

        await storageService.saveJob(updatedJob, false);
        setJob(updatedJob);
        const step = determineCurrentStep(updatedJob);
        setCurrentStep(step);

        // Save to offline queue
        await syncService.addPendingAction({
          jobId: job.id,
          actionType: 'start',
          timestamp: new Date().toISOString(),
        });
        await checkPendingActions();
        return;
      }

      const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/start`);
      console.log('✅ Job started successfully');
      console.log('🔄 Updated job:', updatedJob);

      // If API returns null/empty, update local job manually
      if (!updatedJob || !updatedJob.id) {
        console.log('⚠️ API returned empty response, updating local job manually');
        const updatedSleepTracking = job.sleepTracking?.map((entry: SleepTrackingEntry) => {
          // Find first city without startAt
          if (entry.startAt === null) {
            return {
              ...entry,
              startAt: new Date().toISOString(),
            };
          }
          return entry;
        }) || [];

        const localUpdatedJob = {
          ...job,
          sleepTracking: updatedSleepTracking,
        };

        await storageService.saveJob(localUpdatedJob, false);
        setJob(localUpdatedJob);
        const step = determineCurrentStep(localUpdatedJob);
        setCurrentStep(step);
        console.log('📍 New step (local):', step);
      } else {
        setJob(updatedJob);

        // Save to local storage
        await storageService.saveJob(updatedJob);

        const step = determineCurrentStep(updatedJob);
        setCurrentStep(step);
        console.log('📍 New step:', step);
      }
    } catch (error: any) {
      console.log('❌ Error starting job:', error);
      if (job && job.id) {
        Alert.alert('Error', 'Failed to start job. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSleep = () => {
    // Check if offline
    if (!isConnected) {
      setPendingActionType('sleep');
      setOfflineWarningVisible(true);
      return;
    }

    // 🔄 Initialize local sleep tracking from job BEFORE opening modal
    if (job?.sleepTracking) {
      console.log('📊 ====== Initializing sleep tracking ======');
      console.log('Original job.sleepTracking:');
      job.sleepTracking.forEach((e: SleepTrackingEntry, i: number) => {
        console.log(`  [${i}] ${e.city}: index=${e.index}, sleepAt=${e.sleepAt ? 'YES' : 'NO'}, disabled=${e.disabled}`);
      });
      
      // 🔑 FULL sleepTracking - keep ALL cities (disabled + enabled)
      const fullSleepTracking = [...job.sleepTracking];
      
      // Find disabled cities
      const disabledCities = fullSleepTracking.filter((e: SleepTrackingEntry) => e.disabled === true);
      
      // For DISPLAY only: show last disabled city
      let citiesToDisplay: SleepTrackingEntry[] = [];
      const now = new Date().toISOString();
      
      if (disabledCities.length > 0) {
        // Show only the last disabled city with checkbox CHECKED
        const lastDisabledCity = disabledCities[disabledCities.length - 1];
        console.log(`✅ Showing last disabled city for display: ${lastDisabledCity.city} (will be checked)`);
        
        citiesToDisplay = [{
          ...lastDisabledCity,
          sleepAt: lastDisabledCity.sleepAt || now, // ✅ Check the disabled city
        }];
      } else {
        // No disabled cities - show first city with checkbox checked
        const firstCity = fullSleepTracking[0];
        if (firstCity) {
          console.log(`✅ No disabled cities, showing first city: ${firstCity.city}`);
          citiesToDisplay = [{
            ...firstCity,
            sleepAt: firstCity.sleepAt || now, // Check if not already checked
          }];
        }
      }
      
      // ✅ Set FULL tracking (this will be sent to API)
      setLocalSleepTracking(fullSleepTracking);
      // 👀 Set DISPLAY tracking (only last disabled city shown to user)
      setDisplaySleepTracking(citiesToDisplay);
      
      console.log(`📦 Full sleepTracking stored: ${fullSleepTracking.length} cities (will be sent to API)`);
      console.log(`👀 Displaying for user: ${citiesToDisplay.length} city`);
      console.log('📊 ====== Initialization complete ======');
    } else {
      console.log('⚠️ No sleep tracking data found');
      setLocalSleepTracking([]);
      setDisplaySleepTracking([]);
    }

    setShowModal(true);
  };

  // Toggle local checkbox - updates both display and full tracking
  const handleCheckboxToggle = (targetIndex: number) => {
    const now = new Date().toISOString();
    
    // Update display tracking
    setDisplaySleepTracking(prev => {
      console.log('📋 Current display state BEFORE toggle:');
      
      const targetEntry = prev.find(e => e.index === targetIndex);
      const isCheckingTarget = targetEntry?.sleepAt === null;
      
      const updated = prev.map((entry) => {
        // Check if this entry is explicitly disabled
        if (entry.disabled === true) {
          console.log(`  🚫 ${entry.city} is disabled, skipping`);
          return entry;
        }

        // Toggle the target
        if (entry.index === targetIndex) {
          if (entry.sleepAt === null) {
            console.log(`  ✅ CHECKING ${entry.city}`);
            return { ...entry, sleepAt: now };
          } else {
            console.log(`  ⬜ UNCHECKING ${entry.city}`);
            return { ...entry, sleepAt: null };
          }
        }
        
        // Update sleepAt for checked cities
        if (isCheckingTarget && entry.sleepAt !== null) {
          console.log(`  🕐 UPDATING sleepAt for ${entry.city}`);
          return { ...entry, sleepAt: now };
        }

        return entry;
      });

      return updated;
    });
    
    // Also update the full localSleepTracking to keep them in sync
    setLocalSleepTracking(prev => {
      return prev.map(entry => {
        if (entry.index === targetIndex) {
          if (entry.sleepAt === null) {
            return { ...entry, sleepAt: now };
          } else {
            return { ...entry, sleepAt: null };
          }
        }
        return entry;
      });
    });
  };

  // Submit sleep with country selection
  const handleSleepSubmit = async (country: 'sweden' | 'norway') => {
    if (!job || !job.id) {
      console.error('❌ Error logging sleep:', 'Job or job ID is null');
      return;
    }

    // Check if offline
    if (!isConnected) {
      setPendingCountryChoice(country);
      setPendingActionType('sleep');
      setShowModal(false);
      setOfflineWarningVisible(true);
      return;
    }

    try {
      setActionLoading(true);

      const originalTracking = job.sleepTracking || [];

      // Get indices of newly checked items (items that were null in original but now have sleepAt)
      const newlyCheckedIndices = localSleepTracking
        .filter((entry) => {
          // Find if this entry exists in original with same index
          const originalEntry = originalTracking.find(orig => orig.index === entry.index);

          // It's newly checked if:
          // 1. Entry has sleepAt (is checked)
          // 2. Original entry doesn't exist OR original entry was not checked
          const isNewlyChecked = entry.sleepAt !== null &&
            (!originalEntry || originalEntry.sleepAt === null);

          if (isNewlyChecked) {
            console.log(`✅ Newly checked: ${entry.city}#${entry.index}`);
          }

          return isNewlyChecked;
        })
        .map(entry => entry.index);

      // Calculate sleepCount dynamically based on newly checked cities
      const sleepCount = Math.max(newlyCheckedIndices.length, 1); // Ensure at least 1
      
      console.log(`📊 Sleep count: ${sleepCount}, newly checked indices:`, newlyCheckedIndices);
      
      // Call API with all data
      const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/sleep`, {
        country: country,
        indices: newlyCheckedIndices,
        sleepCount: sleepCount,
        newCities: localSleepTracking.length > 0 ? localSleepTracking : undefined,
      });

      setShowModal(false);
      setNewCityName('');
      setShowAddCityInput(false);

      if (!updatedJob || !updatedJob.id) {
        console.log('⚠️ API returned empty response, refetching job');
        await fetchJob();
      } else {
        setJob(updatedJob);
        await storageService.saveJob(updatedJob);
        const step = determineCurrentStep(updatedJob);
        setCurrentStep(step);
      }
    } catch (error: any) {
      console.log('❌ Error logging sleep:', error);
      Alert.alert('Error', 'Failed to record sleep. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // 🆕 Add new custom city to sleep tracking list
  const handleAddNewCity = () => {
    if (!newCityName.trim()) {
      Alert.alert('Error', 'Please enter a city name');
      return;
    }

    const now = new Date().toISOString();

    // Update full localSleepTracking
    setLocalSleepTracking(prev => {
      const newEntry: SleepTrackingEntry = {
        index: prev.length, // Append to end
        city: newCityName.trim().toLowerCase(),
        country: null,
        startAt: null,
        sleepAt: now, // ✅ Auto-checked when added
        sleepCount: 0,
        isNew: true,
        disabled: false,
      };

      return [...prev, newEntry];
    });
    
    // Update display tracking (add to display)
    setDisplaySleepTracking(prev => {
      const newEntry: SleepTrackingEntry = {
        index: localSleepTracking.length, // Use current length for correct index
        city: newCityName.trim().toLowerCase(),
        country: null,
        startAt: null,
        sleepAt: now, // ✅ Auto-checked when added
        sleepCount: 0,
        isNew: true,
        disabled: false,
      };

      return [...prev, newEntry];
    });

    setNewCityName('');
    setShowAddCityInput(false);
  };

  const performSleepAction = async (country: string) => {
    if (!job || !job.id) {
      console.error('❌ Error logging sleep:', 'Job or job ID is null');
      return;
    }
    try {
      setActionLoading(true);
      if (!isConnected) {
        // Save to offline queue
        await syncService.addPendingAction({
          jobId: job.id,
          actionType: 'sleep',
          actionData: JSON.stringify({ country, indices: [] }),
          timestamp: new Date().toISOString(),
        });
        await checkPendingActions();
        return;
      }

      const updatedJob = await apiClient.post<Job>(`/jobs/${job.id}/sleep`, {
        country: country,
        indices: [],
      });

      if (!updatedJob || !updatedJob.id) {
        await fetchJob();
      } else {
        setJob(updatedJob);
        await storageService.saveJob(updatedJob);
        const step = determineCurrentStep(updatedJob);
        setCurrentStep(step);
      }
    } catch (error: any) {
      console.log('❌ Error logging sleep:', error);
      Alert.alert('Error', 'Failed to sleep. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!job || !job.id) return;

    // Check if offline
    if (!isConnected) {
      setPendingActionType('finish');
      setOfflineWarningVisible(true);
      return;
    }

    await performFinishAction();
  };

  const performFinishAction = async () => {
    if (!job || !job.id) {
      console.error('❌ Error finishing job:', 'Job or job ID is null');
      return;
    }
    const jobId = job.id; // Save job ID before clearing
    try {
      setActionLoading(true);
      console.log('✅ Finishing job:', jobId);

      if (!isConnected) {
        // Update job locally
        const updatedJob = await storageService.updateFinishStatus(jobId);
        if (updatedJob) {
          setJob(updatedJob);
          const step = determineCurrentStep(updatedJob);
          setCurrentStep(step);
        }

        // Save to offline queue
        await syncService.addPendingAction({
          jobId: jobId,
          actionType: 'finish',
          timestamp: new Date().toISOString(),
        });
        // Alert.alert('Saved Offline', 'Job finished locally. Will sync when online.');
        await checkPendingActions();

        // Show success message
        setMessage(true);
        setTimeout(() => {
          setMessage(false);
        }, 3000);
        return;
      }

      setJob(null);
      setCurrentStep(null);
      const response = await apiClient.post<Job>(`/jobs/${jobId}/finish`);
      console.log('🔄 Finished job response:', response);

      // Delete local job
      await storageService.deleteJobById(jobId);

      setMessage(true);
      setTimeout(() => {
        setMessage(false);
        fetchJob();
      }, 3000);
    } catch (error: any) {
      console.log('❌ Error finishing job:', error);
      Alert.alert('Error', 'Failed to finish job. Please try again.');
      await fetchJob();
    } finally {
      setActionLoading(false);
    }
  };

  // Handle offline warning modal
  const handleOfflineWarningContinue = async () => {
    setOfflineWarningVisible(false);

    if (!pendingActionType) return;

    switch (pendingActionType) {
      case 'receive':
        await performReceiveAction();
        break;
      case 'start':
        await performStartAction();
        break;
      case 'sleep':
        if (pendingCountryChoice) {
          await performSleepAction(pendingCountryChoice);
          setPendingCountryChoice(null);
        } else {
          // Initialize local sleep tracking from job
          if (job?.sleepTracking) {
            setLocalSleepTracking([...job.sleepTracking]);
          }
          console.log('+++++++++++++++++++++++++');
          console.log(localSleepTracking);
          setShowModal(true);
        }
        break;
      case 'finish':
        await performFinishAction();
        break;
    }

    setPendingActionType(null);
  };

  const handleOfflineWarningCancel = () => {
    setOfflineWarningVisible(false);
    setPendingActionType(null);
    setPendingCountryChoice(null);
  };

  // Auto-sync when internet comes back
  const handleAutoSync = async () => {
    const count = await syncService.getPendingActionsCount();

    if (count === 0) {
      console.log('✅ No pending actions to sync');
      return;
    }

    console.log(`🔄 Auto-syncing ${count} pending action(s)...`);
    setIsAutoSyncing(true);

    try {
      const pendingActions = await syncService.getPendingActions();

      let successCount = 0;
      let failCount = 0;

      for (const action of pendingActions) {
        try {
          console.log(`📤 Syncing ${action.actionType} for job ${action.jobId}`);

          switch (action.actionType) {
            case 'receive':
              await apiClient.post<Job>(`/jobs/${action.jobId}/receive`);
              break;
            case 'start':
              await apiClient.post<Job>(`/jobs/${action.jobId}/start`);
              break;
            case 'sleep':
              const sleepData = action.actionData ? JSON.parse(action.actionData) : {};
              await apiClient.post<Job>(`/jobs/${action.jobId}/sleep`, sleepData);
              break;
            case 'finish':
              await apiClient.post<Job>(`/jobs/${action.jobId}/finish`);
              break;
          }

          await syncService.markAsSynced(action.id!);
          successCount++;
          console.log(`✅ Auto-synced ${action.actionType} successfully`);
        } catch (error: any) {
          console.log(`❌ Failed to auto-sync ${action.actionType}:`, error);
          failCount++;
        }
      }

      // Clean up synced actions
      await syncService.clearSyncedActions();
      await checkPendingActions();

      // Refresh job after sync
      await fetchJob();

      // Show notification to user
      if (failCount === 0 && successCount > 0) {
        Alert.alert(
          '✅ Synced Successfully',
          `${successCount} pending action(s) have been synced automatically.`,
          [{ text: 'OK' }],
        );
      } else if (successCount > 0 && failCount > 0) {
        Alert.alert(
          '⚠️ Partial Sync',
          `Synced ${successCount} action(s), but ${failCount} failed. You can retry manually.`,
          [{ text: 'OK' }],
        );
      } else if (failCount > 0) {
        console.log('❌ All auto-sync attempts failed, user can retry manually');
      }
    } catch (error: any) {
      console.log('❌ Error during auto-sync:', error);
    } finally {
      setIsAutoSyncing(false);
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
      const pendingActions = await syncService.getPendingActions();

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

          switch (action.actionType) {
            case 'receive':
              await apiClient.post<Job>(`/jobs/${action.jobId}/receive`);
              break;
            case 'start':
              await apiClient.post<Job>(`/jobs/${action.jobId}/start`);
              break;
            case 'sleep':
              const sleepData = action.actionData ? JSON.parse(action.actionData) : {};
              await apiClient.post<Job>(`/jobs/${action.jobId}/sleep`, sleepData);
              break;
            case 'finish':
              await apiClient.post<Job>(`/jobs/${action.jobId}/finish`);
              break;
          }

          await syncService.markAsSynced(action.id!);
          successCount++;
          console.log(`✅ Synced ${action.actionType} successfully`);
        } catch (error: any) {
          console.log(`❌ Failed to sync ${action.actionType}:`, error);
          failCount++;
        }
      }

      // Clean up synced actions
      await syncService.clearSyncedActions();
      await checkPendingActions();

      // Refresh job after sync to get latest from server
      await fetchJob();

      if (failCount === 0) {
        // Alert.alert('Sync Complete', `Successfully synced ${successCount} action(s).`);
      } else {
        // Alert.alert('Sync Partial', `Synced ${successCount} action(s), but ${failCount} failed. Please try again later.`);
      }
    } catch (error: any) {
      console.log('❌ Error syncing actions:', error);
      Alert.alert('Sync Error', 'Failed to sync actions. Please try again.');
    } finally {
      setIsSyncing(false);
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
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Receive Job</Text>
            )}
          </TouchableOpacity>
        );

      case 'start':
        return (
          <View style={styles.twoButtonsRow}>
            <TouchableOpacity
              style={[styles.startButton, styles.halfButton, actionLoading && styles.buttonDisabled]}
              onPress={handleStartFromLastCity}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Start</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.finishButton, styles.halfButton, actionLoading && styles.buttonDisabled]}
              onPress={handleFinish}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>End Job</Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'sleep':
        return (
          <View style={styles.twoButtonsRow}>
            <TouchableOpacity
              style={[styles.sleepButton, styles.halfButton, actionLoading && styles.buttonDisabled]}
              onPress={handleSleep}
              disabled={actionLoading}
            >
              <Text style={styles.buttonText}>Sleep</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.finishButton, styles.halfButton, actionLoading && styles.buttonDisabled]}
              onPress={handleFinish}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>End Job</Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'finish':
            return (
                <View style={styles.twoButtonsRow}>
                    <TouchableOpacity
                        style={[styles.startButton, styles.halfButton, actionLoading && styles.buttonDisabled]}
                        onPress={handleStartFromLastCity}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>Start</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.finishButton, styles.halfButton, actionLoading && styles.buttonDisabled]}
                        onPress={handleFinish}
                        disabled={actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>End Job</Text>
                        )}
                    </TouchableOpacity>
                </View>
            );

      default:
        return null;
    }
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
            <NetworkIndicator />
          </View>

          {/* Sync Bar */}
          <SyncBar
            pendingCount={pendingActionsCount}
            onSync={handleSyncActions}
            isSyncing={isSyncing}
            isAutoSyncing={isAutoSyncing}
          />

          {/* Content */}
          <ScrollView
            style={styles.contentContainer}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
                title="Loading jobs..."
                titleColor={colors.textSecondary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading job...</Text>
                </View>
              )
              :
              job?.isFinished === false ? (<View style={styles.cardFullScreen}>
                {/* Status Badge */}
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>

                {/* Job Info Section - Scrollable */}
                <ScrollView
                  style={styles.descriptionScrollView}
                  contentContainerStyle={styles.descriptionContent}
                  showsVerticalScrollIndicator={true}
                >
                  {currentStep === 'receive' ? (
                    // Afficher uniquement le tripPath pour "Receive Job"
                    <View>
                      <Text style={styles.tripPathLabel}>Trip Route:</Text>
                      {job.tripPath ? (
                        job.tripPath.split('-').map((stop, index, arr) => (
                          <View key={index} style={styles.tripStopRow}>
                            <View style={styles.tripStopIndicator}>
                              <View style={styles.tripStopDot} />
                              {index < arr.length - 1 && (
                                <View style={styles.tripStopLine} />
                              )}
                            </View>
                            <Text style={styles.tripStopText}>{stop.trim()}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.tripPathValue}>No route specified</Text>
                      )}
                    </View>
                  ) : (
                    // Afficher la description pour les autres statuts
                    job.description && job.description.includes('<') ? (
                      <RenderHtml
                        contentWidth={width - 72}
                        source={{ html: job.description }}
                        tagsStyles={{
                          body: {
                            fontSize: 16,
                            color: colors.text,
                            lineHeight: 24,
                          },
                          p: {
                            marginVertical: 4,
                          },
                          strong: {
                            fontWeight: '700',
                          },
                          ul: {
                            marginVertical: 8,
                          },
                          ol: {
                            marginVertical: 8,
                          },
                          li: {
                            marginVertical: 2,
                          },
                          h1: {
                            fontSize: 22,
                            fontWeight: '700',
                            marginVertical: 8,
                          },
                          h2: {
                            fontSize: 20,
                            fontWeight: '700',
                            marginVertical: 6,
                          },
                          h3: {
                            fontSize: 18,
                            fontWeight: '600',
                            marginVertical: 4,
                          },
                        }}
                      />
                    ) : (
                      <Text style={styles.descriptionText}>{job.description}</Text>
                    )
                  )}
                </ScrollView>
              </View>) : message ?
                (
                  <View style={styles.emptyContainer}>
                    <View style={{ ...styles.emptyIconContainer, backgroundColor: '#e8f5e9' }}>
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
                    <Text style={styles.emptyTitle}>No Orders Available</Text>
                    <Text style={styles.emptyText}>There are no orders assigned to you at the
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

          {/* Fixed Action Button at Bottom */}
          {job?.id! && !job.isFinished && currentStep && !loading && (
            <View style={styles.fixedButtonContainer}>
              {renderActionButton()}
            </View>
          )}

          {/* Modal for Sleep Tracking Selection */}
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
                <Text style={styles.modalTitle}>Where did you sleep?</Text>
                <Text style={styles.modalSubtitle}>Select the city from your route</Text>

                {/* 🆕 New City Input (shown only when showAddCityInput is true) */}
                <View style={styles.newCityInputContainer}>
                    <TextInput
                      style={styles.newCityInput}
                      placeholder="Enter city name..."
                      value={newCityName}
                      onChangeText={setNewCityName}
                      autoCapitalize="words"
                    />
                    <TouchableOpacity
                      style={styles.addCityConfirmButton}
                      onPress={handleAddNewCity}
                    >
                      <Text style={styles.addCityConfirmButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>


                <ScrollView
                  style={styles.sleepTrackingList}
                  contentContainerStyle={styles.sleepTrackingListContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {displaySleepTracking && displaySleepTracking.length > 0 ? (
                    displaySleepTracking.map((entry: SleepTrackingEntry, arrayIndex: number) => {
                      // Is it a NEW city added via input?
                      const isNewCity = entry.isNew === true;

                      const isChecked = entry.sleepAt !== null;
                      
                      // Is this entry explicitly disabled?
                      const isExplicitlyDisabled = entry.disabled === true;
                      
                      // 🔑 KEY LOGIC: Allow interaction ONLY based on disabled field
                      const canInteract = !isExplicitlyDisabled;

                      return (
                        <TouchableOpacity
                          key={`${entry.city}-${arrayIndex}`}
                          style={[
                            styles.sleepTrackingItem,
                            isChecked && styles.sleepTrackingItemChecked,
                            !canInteract && styles.sleepTrackingItemDisabled,
                            entry.disabled === true && styles.sleepTrackingItemDisabled,
                          ]}
                          onPress={() => {
                            if (canInteract && entry.disabled !== true) {
                              handleCheckboxToggle(entry.index);
                            } else {
                              console.log(`  ❌ Cannot interact - canInteract: ${canInteract}, disabled: ${entry.disabled}`);
                            }
                          }}
                          disabled={entry.disabled === true || !canInteract}
                        >
                          <View style={styles.sleepTrackingCheckbox}>
                            {isChecked ? (
                              <View style={[
                                styles.checkboxChecked,
                                !canInteract && styles.checkboxDisabled,
                              ]}>
                                <Text style={styles.checkmark}>✓</Text>
                              </View>
                            ) : (
                              <View style={styles.checkboxUnchecked} />
                            )}
                          </View>
                          <View style={styles.sleepTrackingInfo}>
                            <Text style={[
                              styles.sleepTrackingCity,
                              isChecked && styles.sleepTrackingCityChecked,
                              isExplicitlyDisabled && styles.sleepTrackingCityDisabled,
                            ]}>
                              {entry.city.charAt(0).toUpperCase() + entry.city.slice(1)}
                              {isNewCity && <Text style={styles.newCityBadge}> (New)</Text>}
                              {isExplicitlyDisabled && <Text style={styles.disabledBadge}> (Disabled)</Text>}
                            </Text>
                            {entry.sleepAt && (
                              <Text style={styles.sleepTrackingDate}>
                                {new Date(entry.sleepAt).toLocaleDateString()} {new Date(entry.sleepAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.sleepTrackingIndex}>#{entry.index + 1}</Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.noSleepTrackingText}>No route cities available</Text>
                    )}
                    </ScrollView>


              {/* Country Buttons - Submit */}
                <View style={styles.countryButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.countryButton,
                      styles.swedenButton,
                      (actionLoading || !displaySleepTracking.some(e => e.sleepAt !== null && e.disabled !== true)) && styles.buttonDisabled
                    ]}
                    onPress={() => handleSleepSubmit('sweden')}
                    disabled={actionLoading || !displaySleepTracking.some(e => e.sleepAt !== null && e.disabled !== true)}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Text style={styles.countryButtonFlag}>🇸🇪</Text>
                        <Text style={styles.countryButtonText}>Sweden</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.countryButton,
                      styles.norwayButton,
                      (actionLoading || !displaySleepTracking.some(e => e.sleepAt !== null && e.disabled !== true)) && styles.buttonDisabled
                    ]}
                    onPress={() => handleSleepSubmit('norway')}
                    disabled={actionLoading || !displaySleepTracking.some(e => e.sleepAt !== null && e.disabled !== true)}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Text style={styles.countryButtonFlag}>🇳🇴</Text>
                        <Text style={styles.countryButtonText}>Norway</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {actionLoading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                )}
              </View>
            </View>
          </Modal>

          {/* Offline Warning Modal */}
          <OfflineWarningModal
            visible={offlineWarningVisible}
            actionType={pendingActionType || 'receive'}
            onCancel={handleOfflineWarningCancel}
            onContinue={handleOfflineWarningContinue}
          />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30,
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
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100, // Space for fixed button + margin
  },
  cardFullScreen: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20, // Separation with fixed button
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  descriptionScrollView: {
    flex: 1,
    marginTop: 16,
  },
  descriptionContent: {
    flexGrow: 1,
  },
  descriptionText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100, // Extra space for fixed button
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
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  twoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfButton: {
    flex: 1,
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
  },
  buttonText: {
    color: colors.white,
    fontSize: 24,
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
    color: 'green',
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
    shadowOffset: { width: 0, height: 2 },
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
    height: '80%',
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
  // Sleep Tracking Modal Styles
  sleepTrackingList: {
    width: '100%',
    flex: 1,
    marginBottom: 16,
  },
  sleepTrackingListContent: {
    paddingBottom: 8,
  },
  sleepTrackingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sleepTrackingItemChecked: {
    backgroundColor: '#e8f5e9',
    borderColor: colors.success,
  },
  sleepTrackingItemDisabled: {
    opacity: 0.5,
    backgroundColor: '#e0e0e0',
  },
  sleepTrackingCheckbox: {
    marginRight: 12,
  },
  checkboxUnchecked: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDisabled: {
    backgroundColor: '#9e9e9e',
  },
  checkmark: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sleepTrackingInfo: {
    flex: 1,
  },
  sleepTrackingCity: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  sleepTrackingCityChecked: {
    color: colors.success,
  },
  sleepTrackingDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  newCityBadge: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  disabledBadge: {
    fontSize: 11,
    color: '#9e9e9e',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  sleepTrackingCityDisabled: {
    color: '#9e9e9e',
    textDecorationLine: 'line-through',
  },
  sleepTrackingIndex: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  noSleepTrackingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    paddingVertical: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  // Country Buttons
  countryButtonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  countryButton: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
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
  countryButtonFlag: {
    fontSize: 24,
    marginRight: 8,
  },
  countryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  tripPathLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
  },
  tripPathValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tripStopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 40,
  },
  tripStopIndicator: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  tripStopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  tripStopLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  tripStopText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
    paddingTop: -2,
  },
  // 🆕 New Styles for Add City and Sleep Count
  addCityButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  addCityButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  newCityInputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  newCityInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  addCityConfirmButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addCityConfirmButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  sleepCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sleepCountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sleepCountInput: {
    width: 60,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
});

export default HomeScreen;
