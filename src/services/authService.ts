// AuthService - API REST Authentication
import authStorageService from './authStorageService';

// API Configuration
const API_BASE_URL = 'http://192.168.1.19:3000/api/v1';

// Session expiration: 7 days in milliseconds
const SESSION_EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Access token expiration: 1 hour (55 minutes pour refresh avant expiration)
const ACCESS_TOKEN_EXPIRATION = 55 * 60 * 1000; // 55 minutes

// Interface pour la réponse de l'API
interface ApiLoginResponse {
    accessToken: string;
    refreshToken: string;
    email: string;
    id: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
}

// Interface pour la session stockée
interface UserAuthSession {
    id: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
    timestamp: number;
    tokenRefreshedAt: number; // 🆕 Date du dernier refresh du token
}

export interface AuthUser {
    id: string;
    email: string;
    passwordChanged: boolean;
    profileCompleted: boolean;
}

export interface AuthResponse {
    id: string;
    accessToken: string;
    refreshToken: string;
    email: string;
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

// Configuration SQLite Storage - Sessions illimitées
const STORAGE_KEYS = {
    SESSION: '@iron_wheels_session',
    CREDENTIALS: '@iron_wheels_credentials',
    USER_INFO: '@iron_wheels_user_info',
};

// 🆕 Callback pour notifier l'expiration de session
type SessionExpiredCallback = () => void;
let sessionExpiredCallback: SessionExpiredCallback | null = null;

// ==================== STORAGE HELPERS ====================

async function saveToStorage(key: string, value: any): Promise<boolean> {
    try {
        await authStorageService.save(key, value);
        return true;
    } catch (error) {
        console.error(`❌ Erreur sauvegarde Storage ${key}:`, error);
        return false;
    }
}

async function getFromStorage(key: string): Promise<any | null> {
    try {
        return await authStorageService.get(key);
    } catch (error) {
        console.error(`❌ Erreur récupération Storage ${key}:`, error);
        return null;
    }
}

// ==================== SERVICE D'AUTHENTIFICATION ====================

export const authService = {
    /**
     * 🆕 ENREGISTRER: Callback pour expiration de session
     */
    onSessionExpired(callback: SessionExpiredCallback): void {
        sessionExpiredCallback = callback;
        console.log('✅ Callback d\'expiration de session enregistré');
    },

    /**
     * 🆕 NOTIFIER: Expiration de session
     */
    notifySessionExpired(): void {
        if (sessionExpiredCallback) {
            console.log('📢 Notification: Session expirée');
            sessionExpiredCallback();
        }
    },

    /**
     * ✅ LOGIN: Authentification avec l'API
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            console.log('🔐 Tentative de connexion...', credentials.email);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Gestion spécifique des erreurs de login
                if (response.status === 401) {
                    throw new Error('Email ou mot de passe incorrect');
                }
                
                if (response.status === 400) {
                    throw new Error('Données de connexion invalides');
                }
                
                if (response.status === 500) {
                    throw new Error('Erreur serveur, veuillez réessayer');
                }
                
                // Message par défaut
                throw new Error(errorData.message || 'Échec de connexion');
            }

            const data: ApiLoginResponse = await response.json();

            // 🆕 Si passwordChanged === false, NE PAS sauvegarder la session
            if (!data.passwordChanged) {
                console.log('⚠️ passwordChanged = false, session NON sauvegardée');
                
                // Sauvegarder SEULEMENT les credentials temporaires pour changement MDP
                await saveToStorage(STORAGE_KEYS.CREDENTIALS, {
                    email: credentials.email,
                    password: credentials.password,
                });
                
                // Retourner les données sans sauvegarder la session
                return {
                    id: data.id,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    email: data.email,
                    passwordChanged: data.passwordChanged,
                    profileCompleted: data.profileCompleted,
                };
            }

            // ✅ passwordChanged === true, sauvegarder la session normalement
            console.log('✅ passwordChanged = true, sauvegarde de la session...');
            
            // Créer la session
            const sessionData: UserAuthSession = {
                id: data.id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                email: data.email,
                passwordChanged: data.passwordChanged,
                profileCompleted: data.profileCompleted,
                timestamp: Date.now(),
                tokenRefreshedAt: Date.now(), // 🆕 Initialiser la date de refresh
            };

            // Sauvegarder dans le storage
            await saveToStorage(STORAGE_KEYS.SESSION, sessionData);
            await saveToStorage(STORAGE_KEYS.CREDENTIALS, {
                email: credentials.email,
                password: credentials.password,
            });

            console.log('✅ Connexion réussie');

            return {
                id: data.id,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                email: data.email,
                passwordChanged: data.passwordChanged,
                profileCompleted: data.profileCompleted,
            };

        } catch (error) {
            console.error('❌ Erreur login:', error);
            throw error;
        }
    },

    /**
     * ✅ VÉRIFICATION: Session authentifiée
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.accessToken) {
                return false;
            }

            // Vérifier si la session a expiré (7 jours)
            const currentTime = Date.now();
            const sessionAge = currentTime - sessionData.timestamp;
            
            if (sessionAge > SESSION_EXPIRATION_TIME) {
                console.log('⏰ Session expirée après 7 jours, déconnexion automatique');
                await this.logout();
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Erreur isAuthenticated:', error);
            return false;
        }
    },

    /**
     * ✅ RÉCUPÉRATION: Données d'auth
     */
    async getStoredAuthData(): Promise<AuthResponse | null> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            
            if (!sessionData) {
                return null;
            }

            return {
                id: sessionData.id,
                accessToken: sessionData.accessToken,
                refreshToken: sessionData.refreshToken,
                email: sessionData.email,
                passwordChanged: sessionData.passwordChanged,
                profileCompleted: sessionData.profileCompleted,
            };

        } catch (error) {
            console.error('❌ Erreur getStoredAuthData:', error);
            return null;
        }
    },

    /**
     * ✅ UTILISATEUR: Récupération
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
                passwordChanged: authData.passwordChanged,
                profileCompleted: authData.profileCompleted,
            };
        } catch (error) {
            console.error('❌ Erreur getCurrentUser:', error);
            return null;
        }
    },

    /**
     * ✅ TOKEN: Récupération access token
     */
    async getAccessToken(): Promise<string | null> {
        try {
            const authData = await this.getStoredAuthData();
            return authData?.accessToken || null;
        } catch (error) {
            console.error('❌ Erreur getAccessToken:', error);
            return null;
        }
    },

    /**
     * ✅ SESSION: Temps restant avant expiration
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
            console.error('❌ Erreur getSessionTimeRemaining:', error);
            return 0;
        }
    },

    /**
     * ✅ SESSION: Jours restants avant expiration
     */
    async getDaysUntilExpiration(): Promise<number> {
        try {
            const timeRemaining = await this.getSessionTimeRemaining();
            const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
            return daysRemaining;
        } catch (error) {
            console.error('❌ Erreur getDaysUntilExpiration:', error);
            return 0;
        }
    },

    /**
     * ✅ VÉRIFICATION: Session valide
     */
    async isSessionValid(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);
            
            if (!sessionData || !sessionData.accessToken) {
                return false;
            }

            // Vérifier si la session a expiré (7 jours)
            const currentTime = Date.now();
            const sessionAge = currentTime - sessionData.timestamp;
            
            if (sessionAge > SESSION_EXPIRATION_TIME) {
                console.log('⏰ Session expirée après 7 jours');
                await this.logout();
                return false;
            }
            
            return true;

        } catch (error) {
            console.error('❌ Erreur isSessionValid:', error);
            return false;
        }
    },

    /**
     * ✅ DÉCONNEXION: Nettoyage
     */
    async logout(): Promise<void> {
        try {
            await authStorageService.multiRemove([
                STORAGE_KEYS.SESSION,
                STORAGE_KEYS.CREDENTIALS,
                STORAGE_KEYS.USER_INFO,
            ]);

            console.log('✅ Déconnexion réussie');

        } catch (error) {
            console.error('❌ Erreur logout:', error);
        }
    },

    /**
     * 🆕 CHANGEMENT DE MOT DE PASSE
     */
    async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
        try {


            const accessToken = payload.response?.accessToken;
            
            if (!accessToken) {
                throw new Error('Token non disponible');
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
                    throw new Error('Ancien mot de passe incorrect');
                }
                
                if (response.status === 400) {
                    throw new Error('Nouveau mot de passe invalide');
                }
                
                throw new Error(errorData.message || 'Échec du changement de mot de passe');
            }

            const data = await response.json();
            
            // 🆕 MAINTENANT sauvegarder la session complète avec passwordChanged = true
            if (payload.response) {
                const sessionData: UserAuthSession = {
                    id: payload.response.id,
                    accessToken: payload.response.accessToken,
                    refreshToken: payload.response.refreshToken,
                    email: payload.response.email,
                    passwordChanged: true, // 🆕 Marquer comme changé
                    profileCompleted: payload.response.profileCompleted,
                    timestamp: Date.now(),
                    tokenRefreshedAt: Date.now(),
                };
                
                await saveToStorage(STORAGE_KEYS.SESSION, sessionData);
                
                // Mettre à jour aussi les credentials avec le nouveau mot de passe
                await saveToStorage(STORAGE_KEYS.CREDENTIALS, {
                    email: payload.response.email,
                    password: payload.newPassword, // 🆕 Nouveau mot de passe
                });
                
                console.log('✅ Session complète sauvegardée avec passwordChanged = true');
            }

            console.log('✅ Mot de passe changé avec succès');

            return {
                success: true,
                message: data.message || 'Mot de passe changé avec succès',
            };

        } catch (error) {
            console.error('❌ Erreur changePassword:', error);
            throw error;
        }
    },

    /**
     * ✅ INITIALISATION: Au démarrage
     */
    async initializeAuth(): Promise<boolean> {
        try {
            const isAuth = await this.isAuthenticated();

            if (isAuth) {
                console.log('✅ Session utilisateur restaurée');
            } else {
                console.log('⚠️ Aucune session active');
            }

            return isAuth;

        } catch (error) {
            console.error('❌ Erreur initializeAuth:', error);
            return false;
        }
    },

    /**
     * 🆕 REFRESH TOKEN: Renouveler l'access token
     */
    async refreshAccessToken(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);

            if (!sessionData || !sessionData.refreshToken) {
                console.error('❌ Pas de refresh token disponible');
                return false;
            }

            console.log('🔄 Refresh du token en cours...');

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
                console.error('❌ Erreur refresh token:', errorData.message);
                
                // 🆕 Si le refresh token est invalide (401/403), déconnecter et notifier
                if (response.status === 401 || response.status === 403) {
                    console.log('🚫 Refresh token expiré (401/403), déconnexion...');
                    await this.logout();
                    this.notifySessionExpired(); // 🆕 Notifier l'app
                }
                return false;
            }

            const data: { accessToken: string } = await response.json();

            // Mettre à jour la session avec le nouveau access token
            const updatedSession: UserAuthSession = {
                ...sessionData,
                accessToken: data.accessToken,
                tokenRefreshedAt: Date.now(), // 🆕 Mettre à jour la date de refresh
            };

            await saveToStorage(STORAGE_KEYS.SESSION, updatedSession);

            console.log('✅ Token rafraîchi avec succès');
            return true;

        } catch (error) {
            console.error('❌ Erreur refreshAccessToken:', error);
            return false;
        }
    },

    /**
     * 🆕 VÉRIFICATION: Token expiré ou proche de l'expiration
     */
    async isTokenExpired(): Promise<boolean> {
        try {
            const sessionData = await getFromStorage(STORAGE_KEYS.SESSION);

            if (!sessionData || !sessionData.tokenRefreshedAt) {
                return true;
            }

            const currentTime = Date.now();
            const tokenAge = currentTime - sessionData.tokenRefreshedAt;

            // Token expiré si plus de 55 minutes (pour laisser une marge)
            return tokenAge > ACCESS_TOKEN_EXPIRATION;

        } catch (error) {
            console.error('❌ Erreur isTokenExpired:', error);
            return true;
        }
    },

    /**
     * 🆕 VALIDATION: Vérifier et rafraîchir le token si nécessaire
     * À APPELER AVANT CHAQUE REQUÊTE API
     */
    async ensureValidToken(): Promise<boolean> {
        try {
            // Vérifier si l'utilisateur est authentifié
            const isAuth = await this.isAuthenticated();
            if (!isAuth) {
                console.log('⚠️ Utilisateur non authentifié');
                return false;
            }

            // Vérifier si le token est expiré
            const isExpired = await this.isTokenExpired();

            if (isExpired) {
                console.log('⏰ Token expiré, refresh automatique...');
                const refreshed = await this.refreshAccessToken();
                
                if (!refreshed) {
                    console.error('❌ Impossible de rafraîchir le token');
                    return false;
                }
            } else {
                console.log('✅ Token valide, pas de refresh nécessaire');
            }

            return true;

        } catch (error) {
            console.error('❌ Erreur ensureValidToken:', error);
            return false;
        }
    },
};
