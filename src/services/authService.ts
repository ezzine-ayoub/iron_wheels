// AuthService - API REST Authentication
import storageService from './storageService';
import { API_BASE_URL } from "./apiClient";
import messaging from "@react-native-firebase/messaging";

// Session expiration: 7 days in milliseconds
const SESSION_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000;

// Access token expiration: 1 hour (55 minutes for refresh before expiration)
const ACCESS_TOKEN_EXPIRATION = 55 * 60 * 1000;

// Interface for API response
interface ApiLoginResponse {
    accessToken: string;
    refreshToken: string;
    profileCompleted: boolean;
    user: {
        id: string;
        email: string;
        name: string;
        passwordChanged: boolean;
        role: string;
        driverNo: string;
        phone: string;
        personalNo: string;
        fcmToken: string;
        employed: boolean;
        createdAt: string;
        updatedAt: string;
    };
}

// Interface for stored session
interface UserAuthSession {
    id: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    name: string;
    phone: string;
    personalNo: string;
    driverNo: string;
    employed: boolean;
    fcmToken: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
    timestamp: number;
    tokenRefreshedAt: number;
}

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    phone: string;
    personalNo: string;
    employed: boolean;
    driverNo: string;
    fcmToken: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
}

export interface AuthResponse {
    id: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    name: string;
    phone: string;
    personalNo: string;
    employed: boolean;
    driverNo: string;
    fcmToken: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
}

export interface LoginCredentials {
    driverNo: string;
    password: string;
}

export interface ChangePasswordPayload {
    oldPassword: string;
    newPassword: string;
    response: AuthResponse;
}

export interface ChangePasswordResponse {
    success: boolean;
    message: string;
}

// Storage keys
const STORAGE_KEYS = {
    SESSION: '@iron_wheels_session',
    CREDENTIALS: '@iron_wheels_credentials',
    USER_INFO: '@iron_wheels_user_info',
};

// Session expiration callback
type SessionExpiredCallback = () => void;
let sessionExpiredCallback: SessionExpiredCallback | null = null;

// ==================== AUTHENTICATION SERVICE ====================

export const authService = {
    /**
     * Register callback for session expiration
     */
    onSessionExpired(callback: SessionExpiredCallback): void {
        sessionExpiredCallback = callback;
        console.log('✅ Session expiration callback registered');
    },

    /**
     * Notify session expiration
     */
    notifySessionExpired(): void {
        if (sessionExpiredCallback) {
            console.log('📢 Notification: Session expired');
            sessionExpiredCallback();
        }
    },

    /**
     * Login with API
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            console.log('🔐 Login attempt...', credentials.driverNo);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 401) {
                    throw new Error('Incorrect driver number or password');
                }
                if (response.status === 400) {
                    throw new Error('Invalid login credentials');
                }
                if (response.status === 500) {
                    throw new Error('Server error, please try again');
                }
                
                throw new Error(errorData.message || 'Login failed');
            }

            const data: ApiLoginResponse = await response.json();
            console.log("Login response data: ", data);

            // If passwordChanged === false, DO NOT save the session
            if (!data.user.passwordChanged) {
                console.log('⚠️ passwordChanged = false, session NOT saved');
                
                await storageService.save(STORAGE_KEYS.CREDENTIALS, {
                    driverNo: credentials.driverNo,
                    password: credentials.password,
                });
                
                return {
                    id: data.user.id,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    email: data.user.email,
                    name: data.user.name,
                    phone: data.user.phone,
                    personalNo: data.user.personalNo,
                    employed: data.user.employed,
                    driverNo: data.user.driverNo,
                    fcmToken: data.user.fcmToken,
                    passwordChanged: data.user.passwordChanged,
                    profileCompleted: data.profileCompleted,
                };
            }

            // passwordChanged === true, save session normally
            console.log('✅ passwordChanged = true, saving session...');
            
            const sessionData: UserAuthSession = {
                id: data.user.id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                email: data.user.email,
                name: data.user.name,
                phone: data.user.phone,
                personalNo: data.user.personalNo,
                driverNo: data.user.driverNo,
                employed: data.user.employed,
                fcmToken: data.user.fcmToken,
                passwordChanged: data.user.passwordChanged,
                profileCompleted: data.profileCompleted,
                timestamp: Date.now(),
                tokenRefreshedAt: Date.now(),
            };

            await storageService.save(STORAGE_KEYS.SESSION, sessionData);
            await storageService.save(STORAGE_KEYS.CREDENTIALS, {
                driverNo: credentials.driverNo,
                password: credentials.password,
            });

            console.log('✅ Login successful');

            return {
                id: data.user.id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                email: data.user.email,
                name: data.user.name,
                phone: data.user.phone,
                personalNo: data.user.personalNo,
                employed: data.user.employed,
                driverNo: data.user.driverNo,
                fcmToken: data.user.fcmToken,
                passwordChanged: data.user.passwordChanged,
                profileCompleted: data.profileCompleted,
            };

        } catch (error) {
            console.log('❌ Login error:', error);
            throw error;
        }
    },

    /**
     * Check authenticated session
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const sessionData = await storageService.get(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.accessToken) {
                return false;
            }

            const currentTime = Date.now();
            const sessionAge = currentTime - sessionData.timestamp;
            
            if (sessionAge > SESSION_EXPIRATION_TIME) {
                console.log('⏰ Session expired after 7 days, automatic logout');
                await this.logout();
                return false;
            }

            return true;
        } catch (error) {
            console.log('❌ Error in isAuthenticated:', error);
            return false;
        }
    },

    /**
     * Get stored auth data
     */
    async getStoredAuthData(): Promise<AuthResponse | null> {
        try {
            const sessionData = await storageService.get(STORAGE_KEYS.SESSION);
            
            if (!sessionData) {
                return null;
            }

            return {
                id: sessionData.id,
                accessToken: sessionData.accessToken,
                refreshToken: sessionData.refreshToken,
                email: sessionData.email,
                name: sessionData.name,
                phone: sessionData.phone,
                personalNo: sessionData.personalNo,
                employed: sessionData.employed,
                driverNo: sessionData.driverNo,
                fcmToken: sessionData.fcmToken,
                passwordChanged: sessionData.passwordChanged,
                profileCompleted: sessionData.profileCompleted,
            };

        } catch (error) {
            console.log('❌ Error in getStoredAuthData:', error);
            return null;
        }
    },

    /**
     * Get current user
     */
    async getCurrentUser(): Promise<AuthUser | null> {
        try {
            const authData = await this.getStoredAuthData();
            
            if (!authData) {
                return null;
            }

            return {
                id: authData.id,
                email: authData.email,
                name: authData.name,
                phone: authData.phone,
                personalNo: authData.personalNo,
                employed: authData.employed,
                driverNo: authData.driverNo,
                fcmToken: authData.fcmToken,
                passwordChanged: authData.passwordChanged,
                profileCompleted: authData.profileCompleted,
            };
        } catch (error) {
            console.log('❌ Error in getCurrentUser:', error);
            return null;
        }
    },

    /**
     * Get access token
     */
    async getAccessToken(): Promise<string | null> {
        try {
            const authData = await this.getStoredAuthData();
            return authData?.accessToken || null;
        } catch (error) {
            console.log('❌ Error in getAccessToken:', error);
            return null;
        }
    },

    /**
     * Check valid session
     */
    async isSessionValid(): Promise<boolean> {
        try {
            const sessionData = await storageService.get(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.accessToken) {
                return false;
            }

            const currentTime = Date.now();
            const sessionAge = currentTime - sessionData.timestamp;
            
            if (sessionAge > SESSION_EXPIRATION_TIME) {
                console.log('⏰ Session expired after 7 days');
                await this.logout();
                return false;
            }
            
            return true;

        } catch (error) {
            console.log('❌ Error in isSessionValid:', error);
            return false;
        }
    },

    /**
     * Logout
     */
    async logout(): Promise<void> {
        try {
            await storageService.multiRemove([
                STORAGE_KEYS.SESSION,
                STORAGE_KEYS.CREDENTIALS,
                STORAGE_KEYS.USER_INFO,
            ]);
            await messaging().deleteToken();
            console.log('✅ Logout successful');

        } catch (error) {
            console.log('❌ Logout error:', error);
        }
    },

    /**
     * Change password
     */
    async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
        try {
            const accessToken = payload.response?.accessToken;
            
            if (!accessToken) {
                throw new Error('Token not available');
            }

            const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    oldPassword: payload.oldPassword,
                    newPassword: payload.newPassword,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 401) {
                    throw new Error('Incorrect old password');
                }
                if (response.status === 400) {
                    throw new Error('Invalid new password');
                }
                
                throw new Error(errorData.message || 'Password change failed');
            }

            const data = await response.json();
            
            // Save complete session with passwordChanged = true
            if (payload.response) {
                const sessionData: UserAuthSession = {
                    id: payload.response.id,
                    accessToken: payload.response.accessToken,
                    refreshToken: payload.response.refreshToken,
                    email: payload.response.email,
                    name: payload.response.name,
                    phone: payload.response.phone,
                    personalNo: payload.response.personalNo,
                    employed: payload.response.employed,
                    driverNo: payload.response.driverNo,
                    fcmToken: payload.response.fcmToken,
                    passwordChanged: true,
                    profileCompleted: payload.response.profileCompleted,
                    timestamp: Date.now(),
                    tokenRefreshedAt: Date.now(),
                };
                
                await storageService.save(STORAGE_KEYS.SESSION, sessionData);
                
                const existingCreds = await storageService.get(STORAGE_KEYS.CREDENTIALS);
                if (existingCreds) {
                    await storageService.save(STORAGE_KEYS.CREDENTIALS, {
                        ...existingCreds,
                        password: payload.newPassword,
                    });
                }
                
                console.log('✅ Complete session saved with passwordChanged = true');
            }

            console.log('✅ Password changed successfully');

            return {
                success: true,
                message: data.message || 'Password changed successfully',
            };

        } catch (error) {
            console.log('❌ Error in changePassword:', error);
            throw error;
        }
    },

    /**
     * Initialize auth
     */
    async initializeAuth(): Promise<boolean> {
        try {
            const isAuth = await this.isAuthenticated();

            if (isAuth) {
                console.log('✅ User session restored');
            } else {
                console.log('⚠️ No active session');
            }

            return isAuth;

        } catch (error) {
            console.log('❌ Error in initializeAuth:', error);
            return false;
        }
    },

    /**
     * Forgot password
     */
    async forgotPassword(email: string): Promise<void> {
        try {
            console.log('🔑 Forgot password attempt...', email);

            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to send reset link');
            }

            console.log('✅ Password reset link sent successfully');

        } catch (error) {
            console.log('❌ Error in forgotPassword:', error);
            throw error;
        }
    },

    /**
     * Refresh access token
     */
    async refreshAccessToken(): Promise<boolean> {
        try {
            const sessionData = await storageService.get(STORAGE_KEYS.SESSION);

            if (!sessionData || !sessionData.refreshToken) {
                console.log('❌ No refresh token available');
                return false;
            }

            console.log('🔄 Token refresh in progress...');

            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refreshToken: sessionData.refreshToken,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.log('❌ Error refreshing token:', errorData.message);
                
                if (response.status === 401 || response.status === 403) {
                    console.log('🚫 Refresh token expired (401/403), logging out...');
                    await this.logout();
                    this.notifySessionExpired();
                }
                return false;
            }

            const data: { accessToken: string } = await response.json();

            const updatedSession: UserAuthSession = {
                ...sessionData,
                accessToken: data.accessToken,
                tokenRefreshedAt: Date.now(),
            };

            await storageService.save(STORAGE_KEYS.SESSION, updatedSession);

            console.log('✅ Token refreshed successfully');
            return true;

        } catch (error) {
            console.log('❌ Error in refreshAccessToken:', error);
            return false;
        }
    },

    /**
     * Check if token is expired
     */
    async isTokenExpired(): Promise<boolean> {
        try {
            const sessionData = await storageService.get(STORAGE_KEYS.SESSION);

            if (!sessionData || !sessionData.tokenRefreshedAt) {
                return true;
            }

            const currentTime = Date.now();
            const tokenAge = currentTime - sessionData.tokenRefreshedAt;

            return tokenAge > ACCESS_TOKEN_EXPIRATION;

        } catch (error) {
            console.log('❌ Error in isTokenExpired:', error);
            return true;
        }
    },

    /**
     * Ensure valid token - check and refresh if necessary
     */
    async ensureValidToken(): Promise<boolean> {
        try {
            const isAuth = await this.isAuthenticated();
            if (!isAuth) {
                console.log('⚠️ User not authenticated');
                return false;
            }

            const isExpired = await this.isTokenExpired();

            if (isExpired) {
                console.log('⏰ Token expired, automatic refresh...');
                const refreshed = await this.refreshAccessToken();
                
                if (!refreshed) {
                    console.log('❌ Unable to refresh token');
                    return false;
                }
            } else {
                console.log('✅ Token valid, no refresh needed');
            }

            return true;

        } catch (error) {
            console.log('❌ Error in ensureValidToken:', error);
            return false;
        }
    },
};
