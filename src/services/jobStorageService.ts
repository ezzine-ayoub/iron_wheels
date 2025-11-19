import SQLite from 'react-native-sqlite-storage';
import { Job } from '../types';

const DB_NAME = 'iron_wheels.db';

// Enable promise API
SQLite.enablePromise(true);

class JobStorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  async init() {
    // If already initialized, return immediately
    if (this.isInitialized && this.db) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this._doInit();
    await this.initPromise;
    this.initPromise = null;
  }

  private async _doInit() {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });
      await this.createTable();
      this.isInitialized = true;
      console.log('✅ JobStorageService initialized');
    } catch (error) {
      console.error('❌ Error initializing JobStorageService:', error);
      throw error;
    }
  }

  private async createTable() {
    if (!this.db) return;

    const query = `
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
    `;

    await this.db.executeSql(query);
    console.log('✅ current_job table created/verified');
  }

  // Sauvegarder/mettre à jour le job local
  async saveJob(job: Job): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = `
        INSERT OR REPLACE INTO current_job 
        (id, assigneeId, description, sleepSweden, sleepNorway, startCountry, 
         deliveryCountry, startDatetime, endDatetime, isReceived, isFinished, 
         createdAt, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.db!.executeSql(query, [
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
      
      console.log('✅ Job saved locally:', job.id);
    } catch (error) {
      console.error('❌ Error saving job:', error);
      throw error;
    }
  }

  // Récupérer le job local
  async getJob(): Promise<Job | null> {
    if (!this.db) await this.init();

    try {
      const query = 'SELECT * FROM current_job LIMIT 1';
      const [results] = await this.db!.executeSql(query);
      
      if (results.rows.length === 0) {
        return null;
      }
      
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

  // Mettre à jour le statut receive
  async updateReceiveStatus(jobId: string): Promise<Job | null> {
    if (!this.db) await this.init();

    try {
      const query = 'UPDATE current_job SET isReceived = 1, updatedAt = ? WHERE id = ?';
      await this.db!.executeSql(query, [new Date().toISOString(), jobId]);
      
      console.log('✅ Job receive status updated locally');
      return await this.getJob();
    } catch (error) {
      console.error('❌ Error updating receive status:', error);
      throw error;
    }
  }

  // Mettre à jour le statut start
  async updateStartStatus(jobId: string): Promise<Job | null> {
    if (!this.db) await this.init();

    try {
      const now = new Date().toISOString();
      const query = 'UPDATE current_job SET startDatetime = ?, updatedAt = ? WHERE id = ?';
      await this.db!.executeSql(query, [now, now, jobId]);
      
      console.log('✅ Job start status updated locally');
      return await this.getJob();
    } catch (error) {
      console.error('❌ Error updating start status:', error);
      throw error;
    }
  }

  // Mettre à jour le sleep
  async updateSleepStatus(jobId: string, country: string): Promise<Job | null> {
    if (!this.db) await this.init();

    try {
      const column = country.toLowerCase() === 'norway' ? 'sleepNorway' : 'sleepSweden';
      const query = `UPDATE current_job SET ${column} = ${column} + 1, updatedAt = ? WHERE id = ?`;
      await this.db!.executeSql(query, [new Date().toISOString(), jobId]);
      
      console.log(`✅ Job sleep status updated locally (${country})`);
      return await this.getJob();
    } catch (error) {
      console.error('❌ Error updating sleep status:', error);
      throw error;
    }
  }

  // Mettre à jour le statut finish
  async updateFinishStatus(jobId: string): Promise<Job | null> {
    if (!this.db) await this.init();

    try {
      const now = new Date().toISOString();
      const query = 'UPDATE current_job SET endDatetime = ?, isFinished = 1, updatedAt = ? WHERE id = ?';
      await this.db!.executeSql(query, [now, now, jobId]);
      
      console.log('✅ Job finish status updated locally');
      return await this.getJob();
    } catch (error) {
      console.error('❌ Error updating finish status:', error);
      throw error;
    }
  }

  // Supprimer le job local
  async deleteJob(): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM current_job';
      await this.db!.executeSql(query);
      console.log('✅ Local job deleted');
    } catch (error) {
      console.error('❌ Error deleting job:', error);
    }
  }

  // Supprimer le job par ID
  async deleteJobById(jobId: string): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM current_job WHERE id = ?';
      await this.db!.executeSql(query, [jobId]);
      console.log('✅ Job deleted by ID:', jobId);
    } catch (error) {
      console.error('❌ Error deleting job by ID:', error);
    }
  }

  // Vérifier si un job existe
  async hasJob(): Promise<boolean> {
    if (!this.db) await this.init();

    try {
      const query = 'SELECT COUNT(*) as count FROM current_job';
      const [results] = await this.db!.executeSql(query);
      
      if (results.rows.length > 0) {
        return results.rows.item(0).count > 0;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking if job exists:', error);
      return false;
    }
  }

  // Fermer la connexion DB
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('✅ Job database connection closed');
    }
  }
}

export const jobStorageService = new JobStorageService();
