// Central exports for all services
export { authService } from './authService';
export { storageService } from './storageService';
export { syncService } from './syncService';
export { apiClient } from './apiClient';
export { default as FirebaseNotificationService } from './FirebaseNotificationService';
export { appEventEmitter, AppEvents } from './appEventEmitter';
export type { AppEventType } from './appEventEmitter';

// Export types
export type {
    AuthResponse,
    AuthUser,
    LoginCredentials,
    ChangePasswordPayload,
    ChangePasswordResponse,
} from './authService';

export type {
    PendingAction,
} from './syncService';

// Export constants
export const SESSION_EXPIRATION_DAYS = 7;
export const SESSION_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000;
