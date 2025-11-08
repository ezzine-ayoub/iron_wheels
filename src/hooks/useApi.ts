// Hook personnalisé pour les requêtes API avec refresh token automatique
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services';

interface UseApiOptions {
    autoLoad?: boolean; // Charger automatiquement au mount
    onSuccess?: (data: any) => void;
    onError?: (error: Error) => void;
}

interface UseApiReturn<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    execute: (params?: any) => Promise<T | null>;
}

/**
 * 🎣 Hook pour les requêtes API avec refresh token automatique
 * 
 * @example
 * // GET automatique au mount
 * const { data, loading, error, refetch } = useApi('/projects');
 * 
 * @example
 * // POST manuel
 * const { execute, loading } = useApi('/projects', { autoLoad: false });
 * await execute({ name: 'Nouveau projet' });
 */
export function useApi<T = any>(
    endpoint: string,
    options: UseApiOptions = {}
): UseApiReturn<T> {
    const { autoLoad = true, onSuccess, onError } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(autoLoad);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await apiClient.get<T>(endpoint);
            setData(result);

            if (onSuccess) {
                onSuccess(result);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erreur inconnue');
            setError(error);

            if (onError) {
                onError(error);
            }

            return null;
        } finally {
            setLoading(false);
        }
    }, [endpoint, onSuccess, onError]);

    const execute = useCallback(async (params?: any): Promise<T | null> => {
        try {
            setLoading(true);
            setError(null);

            const result = params
                ? await apiClient.post<T>(endpoint, params)
                : await apiClient.get<T>(endpoint);

            setData(result);

            if (onSuccess) {
                onSuccess(result);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erreur inconnue');
            setError(error);

            if (onError) {
                onError(error);
            }

            return null;
        } finally {
            setLoading(false);
        }
    }, [endpoint, onSuccess, onError]);

    useEffect(() => {
        if (autoLoad) {
            fetchData();
        }
    }, [autoLoad, fetchData]);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
        execute,
    };
}

/**
 * 🎣 Hook pour requêtes GET avec refresh automatique
 * 
 * @example
 * const { data, loading, error, refetch } = useApiGet('/projects');
 */
export function useApiGet<T = any>(
    endpoint: string,
    options: UseApiOptions = {}
): UseApiReturn<T> {
    return useApi<T>(endpoint, { ...options, autoLoad: true });
}

/**
 * 🎣 Hook pour requêtes POST/PUT/DELETE manuelles
 * 
 * @example
 * const { execute, loading } = useApiMutation('/projects');
 * await execute({ name: 'Nouveau projet' });
 */
export function useApiMutation<T = any>(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
    options: UseApiOptions = {}
): {
    execute: (params?: any) => Promise<T | null>;
    loading: boolean;
    error: Error | null;
    data: T | null;
} {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(async (params?: any): Promise<T | null> => {
        try {
            setLoading(true);
            setError(null);

            let result: T;

            switch (method) {
                case 'POST':
                    result = await apiClient.post<T>(endpoint, params);
                    break;
                case 'PUT':
                    result = await apiClient.put<T>(endpoint, params);
                    break;
                case 'PATCH':
                    result = await apiClient.patch<T>(endpoint, params);
                    break;
                case 'DELETE':
                    result = await apiClient.delete<T>(endpoint);
                    break;
                default:
                    throw new Error(`Méthode non supportée: ${method}`);
            }

            setData(result);

            if (options.onSuccess) {
                options.onSuccess(result);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erreur inconnue');
            setError(error);

            if (options.onError) {
                options.onError(error);
            }

            return null;
        } finally {
            setLoading(false);
        }
    }, [endpoint, method, options]);

    return { execute, loading, error, data };
}

/**
 * 🎣 Hook pour upload de fichier
 * 
 * @example
 * const { upload, loading, progress } = useApiUpload('/upload');
 * await upload(file, 'document');
 */
export function useApiUpload(endpoint: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<any>(null);

    const upload = useCallback(async (
        file: File | Blob,
        fieldName: string = 'file',
        additionalData?: Record<string, any>
    ) => {
        try {
            setLoading(true);
            setError(null);

            const result = await apiClient.uploadFile(
                endpoint,
                file,
                fieldName,
                additionalData
            );

            setData(result);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erreur upload');
            setError(error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    return { upload, loading, error, data };
}

export default useApi;
