// Test simple du système de refresh token
import { authService, apiClient } from './services';

console.log('✅ Services importés avec succès');
console.log('authService:', typeof authService);
console.log('apiClient:', typeof apiClient);

export { authService, apiClient };
