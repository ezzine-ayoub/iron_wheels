// StorageService - Unified SQLite storage for auth and jobs
import SQLite from 'react-native-sqlite-storage';
import { Job } from '../types';
import { appEventEmitter, AppEvents } from './appEventEmitter';

SQLite.enablePromise(true);
SQLite.DEBUG(false);

const DB_NAME = 'iron_wheels.db';

interface StorageRecord {
  key: string;
  value: string;
  timestamp: number;
}

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

class StorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private cache: Map<string, any> = new Map();

  // ==================== INITIALIZATION ====================
  
  async initDatabase(): Promise<void> {
    if (this.db) return;

    if (this.isInitializing && this.initPromise) {
      console.log('⏳ Initialization in progress, waiting...');
      return this.initPromise;
    }

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        console.log('💾 Opening unified database...');

        this.db = await SQLite.openDatabase({
          name: DB_NAME,
          location: 'default',
        });

        // Create auth storage table
        await this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS auth_storage (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            timestamp INTEGER NOT NULL
          );
        `);

        // Create current job table
        await this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS current_job (
            id TEXT PRIMARY KEY,
            assigneeId TEXT,
            description TEXT,
            sleepSweden INTEGER DEFAULT 0,
            sleepNorway INTEGER DEFAULT 0,
            startCountry TEXT,
            deliveryCountry TEXT,
            startDatetime TEXT,
            endDatetime TEXT,
            isReceived INTEGER DEFAULT 0,
            isFinished INTEGER DEFAULT 0,
            createdAt TEXT,
            updatedAt TEXT NOT NULL
          );
        `);

        console.log('✅ Unified database initialized successfully');
      } catch (error) {
        console.log('❌ Error initializing database:', error);
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

  // ==================== AUTH STORAGE ====================

  async save(key: string, value: any): Promise<boolean> {
    try {
      const cachedValue = this.cache.get(key);
      
      if (cachedValue !== undefined) {
        const cachedJson = JSON.stringify(cachedValue);
        const newJson = JSON.stringify(value);
        if (cachedJson === newJson) return true;
      }
      
      await this.ensureDbInitialized();
      if (!this.db) throw new Error('Database not initialized');

      const dataToStore = {
        data: value,
        timestamp: Date.now(),
      };

      await this.db.executeSql(
        'INSERT OR REPLACE INTO auth_storage (key, value, timestamp) VALUES (?, ?, ?)',
        [key, JSON.stringify(dataToStore), Date.now()]
      );

      this.cache.set(key, value);
      return true;
    } catch (error) {
      console.log(`❌ Error saving ${key}:`, error);
      return false;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      await this.ensureDbInitialized();
      if (!this.db) throw new Error('Database not initialized');

      const results = await this.db.executeSql(
        'SELECT * FROM auth_storage WHERE key = ?',
        [key]
      );

      if (results[0].rows.length === 0) return null;

      const row = results[0].rows.item(0);
      const parsed = JSON.parse(row.value);
      
      this.cache.set(key, parsed.data);
      return parsed.data;
    } catch (error) {
      console.log(`❌ Error retrieving ${key}:`, error);
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      await this.ensureDbInitialized();
      if (!this.db) throw new Error('Database not initialized');

      const result = await this.db.executeSql(
        'DELETE FROM auth_storage WHERE key = ?',
        [key]
      );

      this.cache.delete(key);
      console.log('🗑️ Key deleted:', key);
      return result[0].rowsAffected > 0;
    } catch (error) {
      console.log(`❌ Error deleting ${key}:`, error);
      return false;
    }
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.remove(key);
    }
  }

  async clear(): Promise<boolean> {
    try {
      await this.ensureDbInitialized();
      if (!this.db) throw new Error('Database not initialized');

      await this.db.executeSql('DELETE FROM auth_storage');
      this.cache.clear();
      
      console.log('🧹 All auth data deleted');
      return true;
    } catch (error) {
      console.log('❌ Error clearing auth storage:', error);
      return false;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      await this.ensureDbInitialized();
      if (!this.db) throw new Error('Database not initialized');

      const results = await this.db.executeSql('SELECT key FROM auth_storage');

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

  // AsyncStorage compatibility
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

  // ==================== JOB STORAGE ====================

  async saveJob(job: Job, emitEvent: boolean = true): Promise<void> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      // 🆕 IMPORTANT: Delete ALL existing jobs first to ensure only one job exists
      await this.db.executeSql('DELETE FROM current_job');
      console.log('🗑️ Cleared all existing jobs from SQLite');
      
      const query = `
        INSERT INTO current_job 
        (id, assigneeId, description, sleepSweden, sleepNorway, startCountry, 
         deliveryCountry, startDatetime, endDatetime, isReceived, isFinished, 
         createdAt, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.db.executeSql(query, [
        job.id,
        job.assigneeId || null,
        job.description || null,
        job.sleepSweden || 0,
        job.sleepNorway || 0,
        job.startCountry || null,
        job.deliveryCountry || null,
        job.startDatetime ? (typeof job.startDatetime === 'string' ? job.startDatetime : job.startDatetime.toISOString()) : null,
        job.endDatetime ? (typeof job.endDatetime === 'string' ? job.endDatetime : job.endDatetime.toISOString()) : null,
        job.isReceived ? 1 : 0,
        job.isFinished ? 1 : 0,
        job.createdAt ? (typeof job.createdAt === 'string' ? job.createdAt : job.createdAt.toISOString()) : null,
        job.updatedAt ? (typeof job.updatedAt === 'string' ? job.updatedAt : job.updatedAt.toISOString()) : new Date().toISOString(),
      ]);
      
      console.log('✅ Job saved to SQLite:', job.id);
      
      // 🆕 Emit event to notify UI about job change
      if (emitEvent) {
        const fullJob = await this.getJob();
        if (fullJob) {
          console.log('📢 Emitting JOB_UPDATED event with full job data');
          appEventEmitter.emit(AppEvents.JOB_UPDATED, { job: fullJob });
        }
      }
    } catch (error) {
      console.error('❌ Error saving job:', error);
      throw error;
    }
  }

  async getJob(): Promise<Job | null> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = 'SELECT * FROM current_job LIMIT 1';
      const [results] = await this.db.executeSql(query);
      
      if (results.rows.length === 0) return null;
      
      const row = results.rows.item(0);
      
      return {
        id: row.id,
        assigneeId: row.assigneeId,
        description: row.description,
        sleepSweden: row.sleepSweden || 0,
        sleepNorway: row.sleepNorway || 0,
        startCountry: row.startCountry,
        deliveryCountry: row.deliveryCountry,
        startDatetime: row.startDatetime || undefined,
        endDatetime: row.endDatetime || undefined,
        isReceived: row.isReceived === 1,
        isFinished: row.isFinished === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      console.error('❌ Error getting job:', error);
      return null;
    }
  }

  async updateReceiveStatus(jobId: string): Promise<Job | null> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = 'UPDATE current_job SET isReceived = 1, updatedAt = ? WHERE id = ?';
      await this.db.executeSql(query, [new Date().toISOString(), jobId]);
      console.log('✅ Job receive status updated locally');
      
      const updatedJob = await this.getJob();
      if (updatedJob) {
        appEventEmitter.emit(AppEvents.JOB_UPDATED, { job: updatedJob });
      }
      return updatedJob;
    } catch (error) {
      console.error('❌ Error updating receive status:', error);
      throw error;
    }
  }

  async updateStartStatus(jobId: string): Promise<Job | null> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      const query = 'UPDATE current_job SET startDatetime = ?, updatedAt = ? WHERE id = ?';
      await this.db.executeSql(query, [now, now, jobId]);
      console.log('✅ Job start status updated locally');
      
      const updatedJob = await this.getJob();
      if (updatedJob) {
        appEventEmitter.emit(AppEvents.JOB_UPDATED, { job: updatedJob });
      }
      return updatedJob;
    } catch (error) {
      console.error('❌ Error updating start status:', error);
      throw error;
    }
  }

  async updateSleepStatus(jobId: string, country: string): Promise<Job | null> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const column = country.toLowerCase() === 'norway' ? 'sleepNorway' : 'sleepSweden';
      const query = `UPDATE current_job SET ${column} = ${column} + 1, updatedAt = ? WHERE id = ?`;
      await this.db.executeSql(query, [new Date().toISOString(), jobId]);
      console.log(`✅ Job sleep status updated locally (${country})`);
      
      const updatedJob = await this.getJob();
      if (updatedJob) {
        appEventEmitter.emit(AppEvents.JOB_UPDATED, { job: updatedJob });
      }
      return updatedJob;
    } catch (error) {
      console.error('❌ Error updating sleep status:', error);
      throw error;
    }
  }

  async updateFinishStatus(jobId: string): Promise<Job | null> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      const query = 'UPDATE current_job SET endDatetime = ?, isFinished = 1, updatedAt = ? WHERE id = ?';
      await this.db.executeSql(query, [now, now, jobId]);
      console.log('✅ Job finish status updated locally');
      
      const updatedJob = await this.getJob();
      if (updatedJob) {
        appEventEmitter.emit(AppEvents.JOB_UPDATED, { job: updatedJob });
      }
      return updatedJob;
    } catch (error) {
      console.error('❌ Error updating finish status:', error);
      throw error;
    }
  }

  async deleteJob(emitEvent: boolean = true): Promise<void> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = 'DELETE FROM current_job';
      await this.db.executeSql(query);
      console.log('✅ Local job deleted');
      
      if (emitEvent) {
        console.log('📢 Emitting JOB_DELETED event');
        appEventEmitter.emit(AppEvents.JOB_DELETED, { jobId: null });
      }
    } catch (error) {
      console.error('❌ Error deleting job:', error);
    }
  }

  async deleteJobById(jobId: string, emitEvent: boolean = true): Promise<void> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = 'DELETE FROM current_job WHERE id = ?';
      await this.db.executeSql(query, [jobId]);
      console.log('✅ Job deleted by ID:', jobId);
      
      if (emitEvent) {
        console.log('📢 Emitting JOB_DELETED event for job:', jobId);
        appEventEmitter.emit(AppEvents.JOB_DELETED, { jobId });
      }
    } catch (error) {
      console.error('❌ Error deleting job by ID:', error);
    }
  }

  async hasJob(): Promise<boolean> {
    await this.ensureDbInitialized();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = 'SELECT COUNT(*) as count FROM current_job';
      const [results] = await this.db.executeSql(query);
      
      if (results.rows.length > 0) {
        return results.rows.item(0).count > 0;
      }
      return false;
    } catch (error) {
      console.error('❌ Error checking if job exists:', error);
      return false;
    }
  }

  // ==================== CLEANUP ====================

  async closeDatabase(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
        this.cache.clear();
        console.log('🔒 Database closed');
      } catch (error) {
        console.log('❌ Error closing DB:', error);
      }
    }
  }
}

// Export singleton
export const storageService = new StorageService();

// Auto-initialization
(async () => {
  try {
    await storageService.initDatabase();
  } catch (error) {
    console.log('❌ Error auto-initializing storageService:', error);
  }
})();

export default storageService;
