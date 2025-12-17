import { useEffect, useRef } from 'react';
import { appEventEmitter, AppEventType } from '../services/appEventEmitter';

/**
 * React hook to listen to app events
 * 
 * Usage:
 * ```typescript
 * useAppEvent(AppEvents.JOB_UPDATED, (data) => {
 *   console.log('Job updated:', data);
 *   refreshJob();
 * });
 * ```
 */
export function useAppEvent(
  event: AppEventType,
  callback: (data?: any) => void,
  deps: any[] = []
) {
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Subscribe to event
    const unsubscribe = appEventEmitter.on(event, (data) => {
      callbackRef.current(data);
    });

    // Cleanup on unmount
    return unsubscribe;
  }, [event, ...deps]);
}

/**
 * React hook to listen to multiple app events
 * 
 * Usage:
 * ```typescript
 * useAppEvents({
 *   [AppEvents.JOB_UPDATED]: (data) => console.log('Updated:', data),
 *   [AppEvents.JOB_DELETED]: (data) => console.log('Deleted:', data),
 * });
 * ```
 */
export function useAppEvents(
    eventHandlers: {
        [AppEvents.JOB_CREATED]: (data) => void;
        [AppEvents.JOB_UPDATED]: (data) => void;
        [AppEvents.JOB_DELETED]: (data) => void
    },
    deps: any[] = []
) {
  const handlersRef = useRef(eventHandlers);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Subscribe to all events
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      const unsubscribe = appEventEmitter.on(event as AppEventType, (data) => {
        handlersRef.current[event as AppEventType]?.(data);
      });
      unsubscribers.push(unsubscribe);
    });

    // Cleanup on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [Object.keys(eventHandlers).join(','), ...deps]);
}
