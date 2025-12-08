// API Client with automatic token refresh
import { authService } from './authService';

// API Configuration
// export const API_BASE_URL = 'https://api.ironwheelsdriver.com/api/v1';
export const API_BASE_URL = 'http://192.168.1.18:3000/api/v1';

interface ApiRequestOptions extends RequestInit {
    skipAuth?: boolean; // For public endpoints (login, register, etc.)
}

/**
 * 🚀 API Client with automatic refresh token management
 * 
 * Usage:
 * ```typescript
 * const data = await apiClient.get('/users/me');
 * const result = await apiClient.post('/tasks', { title: 'My task' });
 * ```
 */
export const apiClient = {
    /**
     * 🔐 GET request with authentication
     */
    async get<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'GET',
        });
    },

    /**
     * 🔐 POST request with authentication
     */
    async post<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * 🔐 PUT request with authentication
     */
    async put<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * 🔐 PATCH request with authentication
     */
    async patch<T = any>(endpoint: string, body?: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * 🔐 DELETE request with authentication
     */
    async delete<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'DELETE',
        });
    },

    /**
     * 🔧 Base request with automatic refresh token management
     */
    async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        const { skipAuth = false, ...fetchOptions } = options;

        try {
            // 🔐 STEP 1: Check and refresh token if necessary (except for public endpoints)
            if (!skipAuth) {
                const isTokenValid = await authService.ensureValidToken();
                
                if (!isTokenValid) {
                    throw new Error('Invalid session, please log in again');
                }
            }

            // 🔐 STEP 2: Retrieve token
            const accessToken = skipAuth ? null : await authService.getAccessToken();

            // 🔧 STEP 3: Prepare headers
            const headers: any = {
                'Content-Type': 'application/json',
                ...fetchOptions.headers,
            };

            // Add authentication token if available
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            // 🚀 STEP 4: Make request
            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
            
            console.log(`📡 ${fetchOptions.method || 'GET'} ${url}`);

            const response = await fetch(url, {
                ...fetchOptions,
                headers,
            });

            // 🔍 STEP 5: Handle response
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: `HTTP Error ${response.status}`,
                }));

                // 🆕 If 401 and not a public endpoint, notify expiration
                if (response.status === 401 && !skipAuth) {
                    console.log('🚫 Invalid token (401), logging out...');
                    await authService.logout();
                    authService.notifySessionExpired(); // 🆕 Notify the app
                    throw new Error('Session expired, please log in again');
                }

                // 🆕 If 404 and it's a "No job assigned" message, don't log as error
                if (response.status === 404 && errorData.message?.includes('No job assigned')) {
                    console.log('ℹ️ No job assigned to driver (404) - This is normal');
                    throw new Error(errorData.message || `Error ${response.status}`);
                }

                throw new Error(errorData.message || `Error ${response.status}`);
            }

            // Check if response has content
            const contentLength = response.headers.get('content-length');
            const contentType = response.headers.get('content-type');
            
            // If content-length is 0 or no content, return null
            if (contentLength === '0' || contentLength === null) {
                console.log('ℹ️ Empty response (content-length: 0)');
                return null as T;
            }
            
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                // Handle empty JSON responses (null, empty object, empty array)
                if (data === null || (typeof data === 'object' && Object.keys(data).length === 0)) {
                    return null as T;
                }
                return data;
            }

            // If no JSON content, return null
            return null as T;

        } catch (error) {
            console.log(`❌ API Error ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * 📤 File upload with authentication
     */
    async uploadFile<T = any>(
        endpoint: string,
        file: File | Blob,
        fieldName: string = 'file',
        additionalData?: Record<string, any>
    ): Promise<T> {
        try {
            // Check and refresh token
            const isTokenValid = await authService.ensureValidToken();
            if (!isTokenValid) {
                throw new Error('Invalid session, please log in again');
            }

            const accessToken = await authService.getAccessToken();

            // Create FormData
            const formData = new FormData();
            formData.append(fieldName, file);

            // Add additional data
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
                    message: `HTTP Error ${response.status}`,
                }));

                if (response.status === 401) {
                    console.log('🚫 Invalid token (401), logging out...');
                    await authService.logout();
                    authService.notifySessionExpired(); // 🆕 Notify the app
                    throw new Error('Session expired, please log in again');
                }

                throw new Error(errorData.message || `Error ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.log(`❌ Upload error ${endpoint}:`, error);
            throw error;
        }
    },
};

export default apiClient;
