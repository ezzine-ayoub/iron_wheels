// Export all auth services
export { authService } from './authService';
export { authStorageService } from './authStorageService';
export { apiClient } from './apiClient';
export { offlineActionsService } from './offlineActionsService';
export { jobStorageService } from './jobStorageService';

// Export types
export type {
    AuthResponse,
    AuthUser,
    LoginCredentials,
} from './authService';

// Export constants
export const SESSION_EXPIRATION_DAYS = 7;
export const SESSION_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
