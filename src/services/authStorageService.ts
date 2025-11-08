// AuthStorageService - Stockage avec react-native-sqlite-storage
import SQLite from 'react-native-sqlite-storage';

// Enable debugging
SQLite.enablePromise(true);
SQLite.DEBUG(false);

interface StorageRecord {
  key: string;
  value: string;
  timestamp: number;
}

class AuthStorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private dbName = 'iron_wheels_auth.db';
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  
  // 💾 CACHE EN MÉMOIRE pour réduire les lectures
  private cache: Map<string, any> = new Map();

  // ==================== INITIALISATION ====================
  
  async initDatabase(): Promise<void> {
    // Si déjà initialisé, retourner immédiatement
    if (this.db) {
      return;
    }

    // Si en cours d'initialisation, attendre la promesse existante
    if (this.isInitializing && this.initPromise) {
      console.log('⏳ Initialisation déjà en cours, attente...');
      return this.initPromise;
    }

    // Marquer comme en cours d'initialisation
    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        console.log('💾 Ouverture de la base de données auth...');

        // Ouvrir la base de données
        this.db = await SQLite.openDatabase({
          name: this.dbName,
          location: 'default',
        });

        // Créer la table si elle n'existe pas
        await this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS auth_storage (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            timestamp INTEGER NOT NULL
          );
        `);

        console.log('✅ Base de données auth initialisée avec succès');

      } catch (error) {
        console.error('❌ Erreur initialisation DB auth:', error);
        this.db = null;
        throw error;
      }
    })();

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async ensureDbInitialized(): Promise<void> {
    if (!this.db) {
      await this.initDatabase();
    }
  }

  // ==================== OPÉRATIONS CRUD ====================

  /**
   * ✅ Sauvegarde des données
   */
  async save(key: string, value: any): Promise<boolean> {
    try {
      // 🔒 OPTIMISATION: Vérifier le cache
      const cachedValue = this.cache.get(key);
      
      // Comparer avec le cache
      if (cachedValue !== undefined) {
        const cachedJson = JSON.stringify(cachedValue);
        const newJson = JSON.stringify(value);
        
        if (cachedJson === newJson) {
          // Valeur identique, pas besoin de sauvegarder
          return true;
        }
      }
      
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const dataToStore = {
        data: value,
        timestamp: Date.now(),
      };

      await this.db.executeSql(
        'INSERT OR REPLACE INTO auth_storage (key, value, timestamp) VALUES (?, ?, ?)',
        [key, JSON.stringify(dataToStore), Date.now()]
      );

      // Mettre à jour le cache
      this.cache.set(key, value);

      return true;

    } catch (error) {
      console.error(`❌ Erreur sauvegarde ${key}:`, error);
      return false;
    }
  }

  /**
   * ✅ Récupération des données (avec cache)
   */
  async get(key: string): Promise<any | null> {
    try {
      // 💾 Vérifier le cache d'abord
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const results = await this.db.executeSql(
        'SELECT * FROM auth_storage WHERE key = ?',
        [key]
      );

      if (results[0].rows.length === 0) {
        return null;
      }

      const row = results[0].rows.item(0);
      const parsed = JSON.parse(row.value);
      
      // Mettre en cache
      this.cache.set(key, parsed.data);
      
      return parsed.data;

    } catch (error) {
      console.error(`❌ Erreur récupération ${key}:`, error);
      return null;
    }
  }

  /**
   * ✅ Suppression d'une clé
   */
  async remove(key: string): Promise<boolean> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const result = await this.db.executeSql(
        'DELETE FROM auth_storage WHERE key = ?',
        [key]
      );

      // Supprimer du cache
      this.cache.delete(key);

      console.log('🗑️ Clé supprimée:', key);
      return result[0].rowsAffected > 0;

    } catch (error) {
      console.error(`❌ Erreur suppression ${key}:`, error);
      return false;
    }
  }

  /**
   * ✅ Suppression de toutes les données
   */
  async clear(): Promise<boolean> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      await this.db.executeSql('DELETE FROM auth_storage');
      
      // Vider le cache
      this.cache.clear();
      
      console.log('🧹 Toutes les données auth supprimées');
      return true;

    } catch (error) {
      console.error('❌ Erreur vidage auth storage:', error);
      return false;
    }
  }

  /**
   * ✅ Liste toutes les clés
   */
  async getAllKeys(): Promise<string[]> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const results = await this.db.executeSql(
        'SELECT key FROM auth_storage'
      );

      const keys: string[] = [];
      for (let i = 0; i < results[0].rows.length; i++) {
        keys.push(results[0].rows.item(i).key);
      }

      return keys;

    } catch (error) {
      console.error('❌ Erreur récupération clés:', error);
      return [];
    }
  }

  /**
   * ✅ Obtenir la taille de la base de données
   */
  async getStorageSize(): Promise<{ count: number; size: string }> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const results = await this.db.executeSql(
        'SELECT COUNT(*) as count, SUM(LENGTH(value)) as total_size FROM auth_storage'
      );

      if (results[0].rows.length === 0) {
        return { count: 0, size: '0 bytes' };
      }

      const row = results[0].rows.item(0);
      const sizeInBytes = row.total_size || 0;
      let sizeStr = '';

      if (sizeInBytes < 1024) {
        sizeStr = `${sizeInBytes} bytes`;
      } else if (sizeInBytes < 1024 * 1024) {
        sizeStr = `${(sizeInBytes / 1024).toFixed(2)} KB`;
      } else {
        sizeStr = `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
      }

      return {
        count: row.count,
        size: sizeStr
      };

    } catch (error) {
      console.error('❌ Erreur calcul taille:', error);
      return { count: 0, size: '0 bytes' };
    }
  }

  /**
   * ✅ Vérifier si une clé existe
   */
  async has(key: string): Promise<boolean> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const results = await this.db.executeSql(
        'SELECT COUNT(*) as count FROM auth_storage WHERE key = ?',
        [key]
      );

      return results[0].rows.item(0).count > 0;

    } catch (error) {
      console.error(`❌ Erreur vérification clé ${key}:`, error);
      return false;
    }
  }

  /**
   * ✅ Obtenir toutes les données (debug)
   */
  async getAllData(): Promise<Record<string, any>> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const results = await this.db.executeSql(
        'SELECT * FROM auth_storage'
      );

      const data: Record<string, any> = {};
      
      for (let i = 0; i < results[0].rows.length; i++) {
        const row = results[0].rows.item(i);
        try {
          const parsed = JSON.parse(row.value);
          data[row.key] = parsed.data;
        } catch (parseError) {
          console.error(`⚠️ Erreur parsing ${row.key}:`, parseError);
          data[row.key] = null;
        }
      }

      return data;

    } catch (error) {
      console.error('❌ Erreur récupération toutes données:', error);
      return {};
    }
  }

  /**
   * ✅ Nettoyer les anciennes données (optionnel - pour maintenance)
   */
  async cleanOldData(daysOld: number = 365): Promise<number> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Base de données non initialisée');
      }

      const cutoffTimestamp = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      const results = await this.db.executeSql(
        'DELETE FROM auth_storage WHERE timestamp < ?',
        [cutoffTimestamp]
      );

      const changes = results[0].rowsAffected;

      if (changes > 0) {
        console.log(`🧹 ${changes} anciennes données supprimées (> ${daysOld} jours)`);
      }

      return changes;

    } catch (error) {
      console.error('❌ Erreur nettoyage anciennes données:', error);
      return 0;
    }
  }

  /**
   * ✅ Fermer la connexion (à utiliser seulement si vraiment nécessaire)
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        console.log('🔒 Base de données auth fermée');
      } catch (error) {
        console.error('❌ Erreur fermeture DB:', error);
      }
    }
  }

  // ==================== COMPATIBILITÉ AsyncStorage ====================
  
  /**
   * ✅ Alias pour compatibilité avec AsyncStorage
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.save(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    const result = await this.get(key);
    return result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null;
  }

  async removeItem(key: string): Promise<void> {
    await this.remove(key);
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.remove(key);
    }
  }
}

// Export singleton
export const authStorageService = new AuthStorageService();

// Auto-initialisation silencieuse (une seule fois au démarrage de l'app)
(async () => {
  try {
    await authStorageService.initDatabase();
  } catch (error) {
    console.error('❌ Erreur auto-initialisation authStorageService:', error);
  }
})();

export default authStorageService;
