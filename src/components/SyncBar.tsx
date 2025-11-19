import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../screens/theme';

interface SyncBarProps {
  pendingCount: number;
  onSync: () => void;
  isSyncing: boolean;
  isAutoSyncing?: boolean;
}

const SyncBar: React.FC<SyncBarProps> = ({ 
  pendingCount, 
  onSync, 
  isSyncing, 
  isAutoSyncing = false 
}) => {
  // Don't show if no pending actions and not auto-syncing
  if (pendingCount === 0 && !isAutoSyncing) return null;

  return (
    <View style={[
      styles.container, 
      isAutoSyncing && styles.containerAutoSync
    ]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[
          styles.iconContainer,
          isAutoSyncing && styles.iconContainerAutoSync
        ]}>
          <Text style={styles.icon}>
            {isAutoSyncing ? '🔄' : '⏳'}
          </Text>
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
          <Text style={[
            styles.title,
            isAutoSyncing && styles.titleAutoSync
          ]}>
            {isAutoSyncing 
              ? 'Auto-syncing...' 
              : `${pendingCount} action${pendingCount > 1 ? 's' : ''} pending`
            }
          </Text>
          <Text style={[
            styles.subtitle,
            isAutoSyncing && styles.subtitleAutoSync
          ]}>
            {isAutoSyncing 
              ? 'Syncing pending actions with server' 
              : 'Waiting to sync with server'
            }
          </Text>
        </View>

        {/* Action Button or Loader */}
        {!isAutoSyncing && (
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        )}
        
        {isAutoSyncing && (
          <ActivityIndicator color="#0056b3" size="small" />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderBottomColor: '#ffc107',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  containerAutoSync: {
    backgroundColor: '#d1ecf1',
    borderBottomColor: '#0c5460',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerAutoSync: {
    backgroundColor: '#bee5eb',
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 2,
  },
  titleAutoSync: {
    color: '#0c5460',
  },
  subtitle: {
    fontSize: 12,
    color: '#856404',
    opacity: 0.8,
  },
  subtitleAutoSync: {
    color: '#0c5460',
  },
  syncButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SyncBar;
