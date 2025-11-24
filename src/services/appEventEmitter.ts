// Event Emitter for real-time updates
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

class AppEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Subscribe to an event
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Emit an event
   */
  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event callback:', error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

// Export singleton instance
export const appEventEmitter = new AppEventEmitter();

// Event types
export const AppEvents = {
  JOB_UPDATED: 'job_updated',
  JOB_DELETED: 'job_deleted',
  JOB_CREATED: 'job_created',
  SYNC_COMPLETED: 'sync_completed',
  NETWORK_STATUS_CHANGED: 'network_status_changed',
} as const;

export type AppEventType = typeof AppEvents[keyof typeof AppEvents];
