// AuthService - API REST Authentication
import authStorageService from './authStorageService';

// API Configuration
const API_BASE_URL = 'http://192.168.1.19:3000/api/v1';

// Session expiration: 7 days in milliseconds
const SESSION_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

// Access token expiration: 1 hour (55 minutes for refresh before expiration)
const ACCESS_TOKEN_EXPIRATION = 55 * 60 * 1000; // 55 minutes

// Interface for API response
interface ApiLoginResponse {
    accessToken: string;
    refreshToken: string;
    email: string;
    name: string;
    phone: string;
    personal_No: string;
    id: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
}

// Interface for stored session
interface UserAuthSession {
    id: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    name: string;
    phone: string;
    personal_No: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
    timestamp: number;
    tokenRefreshedAt: number; // 🆕 Date of last token refresh
}

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    phone: string;
    personal_No: string;
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
    personal_No: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
}

export interface LoginCredentials {
    email: string;
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

// SQLite Storage Configuration - Unlimited sessions
const STORAGE_KEYS = {
    SESSION: '@iron_wheels_session',
    CREDENTIALS: '@iron_wheels_credentials',
    USER_INFO: '@iron_wheels_user_info',
};

// 🆕 Callback to notify session expiration
type SessionExpiredCallback = () => void;
let sessionExpiredCallback: SessionExpiredCallback | null = null;

// ==================== STORAGE HELPERS ====================

async function saveToStorage(key: string, value: any): Promise<boolean> {
    try {
        await authStorageService.save(key, value);
        return true;
    } catch (error) {
        console.log(`❌ Error saving to Storage ${key}:`, error);
        return false;
    }
}

async function getFromStorage(key: string): Promise<any | null> {
    try {
        return await authStorageService.get(key);
    } catch (error) {
        console.log(`❌ Error retrieving from Storage ${key}:`, error);
        return null;
    }
}

// ==================== AUTHENTICATION SERVICE ====================

export const authService = {
    /**
     * 🆕 REGISTER: Callback for session expiration
     */
    onSessionExpired(callback: SessionExpiredCallback): void {
        sessionExpiredCallback = callback;
        console.log('✅ Session expiration callback registered');
    },

    /**
     * 🆕 NOTIFY: Session expiration
     */
    notifySessionExpired(): void {
        if (sessionExpiredCallback) {
            console.log('📢 Notification: Session expired');
            sessionExpiredCallback();
        }
    },

    /**
     * ✅ LOGIN: Authentication with API
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            console.log('🔐 Login attempt...', credentials.email);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Specific handling of login errors
                if (response.status === 401) {
                    throw new Error('Incorrect email or password');
                }
                
                if (response.status === 400) {
                    throw new Error('Invalid login credentials');
                }
                
                if (response.status === 500) {
                    throw new Error('Server error, please try again');
                }
                
                // Default message
                throw new Error(errorData.message || 'Login failed');
            }

            const data: ApiLoginResponse = await response.json();

            // 🆕 If passwordChanged === false, DO NOT save the session
            if (!data.passwordChanged) {
                console.log('⚠️ passwordChanged = false, session NOT saved');
                
                // Save ONLY temporary credentials for password change
                await saveToStorage(STORAGE_KEYS.CREDENTIALS, {
                    email: credentials.email,
                    password: credentials.password,
                });
                
                // Return data without saving session
                return {
                    id: data.id,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    email: data.email,
                    name: data.name,
                    phone: data.phone,
                    personal_No: data.personal_No,
                    passwordChanged: data.passwordChanged,
                    profileCompleted: data.profileCompleted,
                };
            }

            // ✅ passwordChanged === true, save session normally
            console.log('✅ passwordChanged = true, saving session...');
            
            // Create session
            const sessionData: UserAuthSession = {
                id: data.id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                email: data.email,
                name: data.name,
                phone: data.phone,
                personal_No: data.personal_No,
                passwordChanged: data.passwordChanged,
                profileCompleted: data.profileCompleted,
                timestamp: Date.now(),
                tokenRefreshedAt: Date.now(), // 🆕 Initialize refresh date
            };

            // Save to storage
            await saveToStorage(STORAGE_KEYS.SESSION, sessionData);
            await saveToStorage(STORAGE_KEYS.CREDENTIALS, {
                email: credentials.email,
                password: credentials.password,
            });

            console.log('✅ Login successful');

            return {
                id: data.id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                email: data.email,
                name: data.name,
                phone: data.phone,
                personal_No: data.personal_No,
                passwordChanged: data.passwordChanged,
                profileCompleted: data.profileCompleted,
            };

        } catch (error) {
            console.log('❌ Login error:', error);
            throw error;
        }
    },

    /**
     * ✅ CHECK: Authenticated session
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.accessToken) {
                return false;
            }

            // Check if session has expired (7 days)
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
     * ✅ RETRIEVE: Auth data
     */
    async getStoredAuthData(): Promise<AuthResponse | null> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            console.log(sessionData)
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
                personal_No: sessionData.personal_No,
                passwordChanged: sessionData.passwordChanged,
                profileCompleted: sessionData.profileCompleted,
            };

        } catch (error) {
            console.log('❌ Error in getStoredAuthData:', error);
            return null;
        }
    },

    /**
     * ✅ USER: Retrieve current user
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
                personal_No: authData.personal_No,
                passwordChanged: authData.passwordChanged,
                profileCompleted: authData.profileCompleted,
            };
        } catch (error) {
            console.log('❌ Error in getCurrentUser:', error);
            return null;
        }
    },

    /**
     * ✅ TOKEN: Retrieve access token
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
     * ✅ SESSION: Time remaining before expiration
     */
    async getSessionTimeRemaining(): Promise<number> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.timestamp) {
                return 0;
            }

            const currentTime = Date.now();
            const sessionAge = currentTime - sessionData.timestamp;
            const timeRemaining = SESSION_EXPIRATION_TIME - sessionAge;
            
            return Math.max(0, timeRemaining);
        } catch (error) {
            console.log('❌ Error in getSessionTimeRemaining:', error);
            return 0;
        }
    },

    /**
     * ✅ SESSION: Days remaining before expiration
     */
    async getDaysUntilExpiration(): Promise<number> {
        try {
            const timeRemaining = await this.getSessionTimeRemaining();
            const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
            return daysRemaining;
        } catch (error) {
            console.log('❌ Error in getDaysUntilExpiration:', error);
            return 0;
        }
    },

    /**
     * ✅ CHECK: Valid session
     */
    async isSessionValid(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.accessToken) {
                return false;
            }

            // Check if session has expired (7 days)
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
     * ✅ LOGOUT: Cleanup
     */
    async logout(): Promise<void> {
        try {
            await authStorageService.multiRemove([
                STORAGE_KEYS.SESSION,
                STORAGE_KEYS.CREDENTIALS,
                STORAGE_KEYS.USER_INFO,
            ]);

            console.log('✅ Logout successful');

        } catch (error) {
            console.log('❌ Logout error:', error);
        }
    },

    /**
     * 🆕 CHANGE PASSWORD
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
            
            // 🆕 NOW save complete session with passwordChanged = true
            if (payload.response) {
                const sessionData: UserAuthSession = {
                    id: payload.response.id,
                    accessToken: payload.response.accessToken,
                    refreshToken: payload.response.refreshToken,
                    email: payload.response.email,
                    name: payload.response.name,
                    phone: payload.response.phone,
                    personal_No: payload.response.personal_No,
                    passwordChanged: true, // 🆕 Mark as changed
                    profileCompleted: payload.response.profileCompleted,
                    timestamp: Date.now(),
                    tokenRefreshedAt: Date.now(),
                };
                
                await saveToStorage(STORAGE_KEYS.SESSION, sessionData);
                
                // Also update credentials with new password
                await saveToStorage(STORAGE_KEYS.CREDENTIALS, {
                    email: payload.response.email,
                    password: payload.newPassword, // 🆕 New password
                });
                
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
     * ✅ INITIALIZATION: At startup
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
     * 🆕 REFRESH TOKEN: Renew access token
     */
    async refreshAccessToken(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);

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
                
                // 🆕 If refresh token is invalid (401/403), logout and notify
                if (response.status === 401 || response.status === 403) {
                    console.log('🚫 Refresh token expired (401/403), logging out...');
                    await this.logout();
                    this.notifySessionExpired(); // 🆕 Notify the app
                }
                return false;
            }

            const data: { accessToken: string } = await response.json();

            // Update session with new access token
            const updatedSession: UserAuthSession = {
                ...sessionData,
                accessToken: data.accessToken,
                tokenRefreshedAt: Date.now(), // 🆕 Update refresh date
            };

            await saveToStorage(STORAGE_KEYS.SESSION, updatedSession);

            console.log('✅ Token refreshed successfully');
            return true;

        } catch (error) {
            console.log('❌ Error in refreshAccessToken:', error);
            return false;
        }
    },

    /**
     * 🆕 CHECK: Token expired or close to expiration
     */
    async isTokenExpired(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);

            if (!sessionData || !sessionData.tokenRefreshedAt) {
                return true;
            }

            const currentTime = Date.now();
            const tokenAge = currentTime - sessionData.tokenRefreshedAt;

            // Token expired if more than 55 minutes (to leave a margin)
            return tokenAge > ACCESS_TOKEN_EXPIRATION;

        } catch (error) {
            console.log('❌ Error in isTokenExpired:', error);
            return true;
        }
    },

    /**
     * 🆕 VALIDATION: Check and refresh token if necessary
     * CALL BEFORE EVERY API REQUEST
     */
    async ensureValidToken(): Promise<boolean> {
        try {
            // Check if user is authenticated
            const isAuth = await this.isAuthenticated();
            if (!isAuth) {
                console.log('⚠️ User not authenticated');
                return false;
            }

            // Check if token is expired
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
