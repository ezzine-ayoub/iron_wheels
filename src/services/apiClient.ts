// API Client avec refresh token automatique
import { authService } from './authService';

// API Configuration
const API_BASE_URL = 'http://192.168.1.19:3000/api/v1';

interface ApiRequestOptions extends RequestInit {
    skipAuth?: boolean; // Pour les endpoints publics (login, register, etc.)
}

/**
 * 🚀 Client API avec gestion automatique du refresh token
 * 
 * Utilisation:
 * ```typescript
 * const data = await apiClient.get('/users/me');
 * const result = await apiClient.post('/tasks', { title: 'Ma tâche' });
 * ```
 */
export const apiClient = {
    /**
     * 🔐 Requête GET avec authentification
     */
    async get<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'GET',
        });
    },

    /**
     * 🔐 Requête POST avec authentification
     */
    async post<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * 🔐 Requête PUT avec authentification
     */
    async put<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * 🔐 Requête PATCH avec authentification
     */
    async patch<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * 🔐 Requête DELETE avec authentification
     */
    async delete<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'DELETE',
        });
    },

    /**
     * 🔧 Requête de base avec gestion automatique du refresh token
     */
    async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        const { skipAuth = false, ...fetchOptions } = options;

        try {
            // 🔐 ÉTAPE 1: Vérifier et rafraîchir le token si nécessaire (sauf pour les endpoints publics)
            if (!skipAuth) {
                const isTokenValid = await authService.ensureValidToken();
                
                if (!isTokenValid) {
                    throw new Error('Session invalide, veuillez vous reconnecter');
                }
            }

            // 🔐 ÉTAPE 2: Récupérer le token
            const accessToken = skipAuth ? null : await authService.getAccessToken();

            // 🔧 ÉTAPE 3: Préparer les headers
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                ...fetchOptions.headers,
            };

            // Ajouter le token d'authentification si disponible
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            // 🚀 ÉTAPE 4: Faire la requête
            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
            
            console.log(`📡 ${fetchOptions.method || 'GET'} ${url}`);

            const response = await fetch(url, {
                ...fetchOptions,
                headers,
            });

            // 🔍 ÉTAPE 5: Gérer la réponse
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: `Erreur HTTP ${response.status}`,
                }));

                // 🆕 Si 401 et que c'est pas un endpoint public, notifier l'expiration
                if (response.status === 401 && !skipAuth) {
                    console.error('🚫 Token invalide (401), déconnexion...');
                    await authService.logout();
                    authService.notifySessionExpired(); // 🆕 Notifier l'app
                    throw new Error('Session expirée, veuillez vous reconnecter');
                }

                throw new Error(errorData.message || `Erreur ${response.status}`);
            }

            // Vérifier si la réponse a du contenu
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            // Si pas de contenu JSON, retourner un objet vide
            return {} as T;

        } catch (error) {
            console.error(`❌ Erreur API ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * 📤 Upload de fichier avec authentification
     */
    async uploadFile<T = any>(
        endpoint: string,
        file: File | Blob,
        fieldName: string = 'file',
        additionalData?: Record<string, any>
    ): Promise<T> {
        try {
            // Vérifier et rafraîchir le token
            const isTokenValid = await authService.ensureValidToken();
            if (!isTokenValid) {
                throw new Error('Session invalide, veuillez vous reconnecter');
            }

            const accessToken = await authService.getAccessToken();

            // Créer FormData
            const formData = new FormData();
            formData.append(fieldName, file);

            // Ajouter les données supplémentaires
            if (additionalData) {
                Object.entries(additionalData).forEach(([key, value]) => {
                    formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
                });
            }

            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
            
            console.log(`📤 UPLOAD ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: `Erreur HTTP ${response.status}`,
                }));

                if (response.status === 401) {
                    console.error('🚫 Token invalide (401), déconnexion...');
                    await authService.logout();
                    authService.notifySessionExpired(); // 🆕 Notifier l'app
                    throw new Error('Session expirée, veuillez vous reconnecter');
                }

                throw new Error(errorData.message || `Erreur ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error(`❌ Erreur upload ${endpoint}:`, error);
            throw error;
        }
    },
};

export default apiClient;
