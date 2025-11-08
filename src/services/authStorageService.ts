// AuthStorageService - Storage with react-native-sqlite-storage
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
  
  // 💾 MEMORY CACHE to reduce reads
  private cache: Map<string, any> = new Map();

  // ==================== INITIALIZATION ====================
  
  async initDatabase(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) {
      return;
    }

    // If initialization in progress, wait for existing promise
    if (this.isInitializing && this.initPromise) {
      console.log('⏳ Initialization already in progress, waiting...');
      return this.initPromise;
    }

    // Mark as initializing
    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        console.log('💾 Opening auth database...');

        // Open database
        this.db = await SQLite.openDatabase({
          name: this.dbName,
          location: 'default',
        });

        // Create table if it doesn't exist
        await this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS auth_storage (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            timestamp INTEGER NOT NULL
          );
        `);

        console.log('✅ Auth database initialized successfully');

      } catch (error) {
        console.log('❌ Error initializing auth DB:', error);
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

  // ==================== CRUD OPERATIONS ====================

  /**
   * ✅ Save data
   */
  async save(key: string, value: any): Promise<boolean> {
    try {
      // 🔒 OPTIMIZATION: Check cache
      const cachedValue = this.cache.get(key);
      
      // Compare with cache
      if (cachedValue !== undefined) {
        const cachedJson = JSON.stringify(cachedValue);
        const newJson = JSON.stringify(value);
        
        if (cachedJson === newJson) {
          // Identical value, no need to save
          return true;
        }
      }
      
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const dataToStore = {
        data: value,
        timestamp: Date.now(),
      };

      await this.db.executeSql(
        'INSERT OR REPLACE INTO auth_storage (key, value, timestamp) VALUES (?, ?, ?)',
        [key, JSON.stringify(dataToStore), Date.now()]
      );

      // Update cache
      this.cache.set(key, value);

      return true;

    } catch (error) {
      console.log(`❌ Error saving ${key}:`, error);
      return false;
    }
  }

  /**
   * ✅ Retrieve data (with cache)
   */
  async get(key: string): Promise<any | null> {
    try {
      // 💾 Check cache first
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
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
      
      // Cache it
      this.cache.set(key, parsed.data);
      
      return parsed.data;

    } catch (error) {
      console.log(`❌ Error retrieving ${key}:`, error);
      return null;
    }
  }

  /**
   * ✅ Delete a key
   */
  async remove(key: string): Promise<boolean> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const result = await this.db.executeSql(
        'DELETE FROM auth_storage WHERE key = ?',
        [key]
      );

      // Remove from cache
      this.cache.delete(key);

      console.log('🗑️ Key deleted:', key);
      return result[0].rowsAffected > 0;

    } catch (error) {
      console.log(`❌ Error deleting ${key}:`, error);
      return false;
    }
  }

  /**
   * ✅ Delete all data
   */
  async clear(): Promise<boolean> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      await this.db.executeSql('DELETE FROM auth_storage');
      
      // Clear cache
      this.cache.clear();
      
      console.log('🧹 All auth data deleted');
      return true;

    } catch (error) {
      console.log('❌ Error clearing auth storage:', error);
      return false;
    }
  }

  /**
   * ✅ List all keys
   */
  async getAllKeys(): Promise<string[]> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
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
      console.log('❌ Error retrieving keys:', error);
      return [];
    }
  }

  /**
   * ✅ Get database size
   */
  async getStorageSize(): Promise<{ count: number; size: string }> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
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
      console.log('❌ Error calculating size:', error);
      return { count: 0, size: '0 bytes' };
    }
  }

  /**
   * ✅ Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const results = await this.db.executeSql(
        'SELECT COUNT(*) as count FROM auth_storage WHERE key = ?',
        [key]
      );

      return results[0].rows.item(0).count > 0;

    } catch (error) {
      console.log(`❌ Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * ✅ Get all data (debug)
   */
  async getAllData(): Promise<Record<string, any>> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
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
          console.log(`⚠️ Error parsing ${row.key}:`, parseError);
          data[row.key] = null;
        }
      }

      return data;

    } catch (error) {
      console.log('❌ Error retrieving all data:', error);
      return {};
    }
  }

  /**
   * ✅ Clean old data (optional - for maintenance)
   */
  async cleanOldData(daysOld: number = 365): Promise<number> {
    try {
      await this.ensureDbInitialized();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const cutoffTimestamp = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      const results = await this.db.executeSql(
        'DELETE FROM auth_storage WHERE timestamp < ?',
        [cutoffTimestamp]
      );

      const changes = results[0].rowsAffected;

      if (changes > 0) {
        console.log(`🧹 ${changes} old data entries deleted (> ${daysOld} days)`);
      }

      return changes;

    } catch (error) {
      console.log('❌ Error cleaning old data:', error);
      return 0;
    }
  }

  /**
   * ✅ Close connection (use only if really necessary)
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        console.log('🔒 Auth database closed');
      } catch (error) {
        console.log('❌ Error closing DB:', error);
      }
    }
  }

  // ==================== AsyncStorage COMPATIBILITY ====================
  
  /**
   * ✅ Alias for AsyncStorage compatibility
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

// Silent auto-initialization (once at app startup)
(async () => {
  try {
    await authStorageService.initDatabase();
  } catch (error) {
    console.log('❌ Error auto-initializing authStorageService:', error);
  }
})();

export default authStorageService;
