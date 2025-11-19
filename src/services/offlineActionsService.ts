import SQLite from 'react-native-sqlite-storage';
import { jobStorageService } from './jobStorageService';

const DB_NAME = 'iron_wheels.db';

export interface PendingAction {
  id?: number;
  jobId: number;
  actionType: 'receive' | 'start' | 'sleep' | 'finish';
  actionData?: string; // JSON string for additional data (like country for sleep)
  timestamp: string;
  synced: number; // 0 = pending, 1 = synced
}

// Enable promise API
SQLite.enablePromise(true);

class OfflineActionsService {
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
      console.log('✅ OfflineActionsService initialized');
    } catch (error) {
      console.error('❌ Error initializing OfflineActionsService:', error);
      throw error;
    }
  }

  private async createTable() {
    if (!this.db) return;

    const query = `
      CREATE TABLE IF NOT EXISTS pending_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jobId INTEGER NOT NULL,
        actionType TEXT NOT NULL,
        actionData TEXT,
        timestamp TEXT NOT NULL,
        synced INTEGER DEFAULT 0
      );
    `;

    await this.db.executeSql(query);
    console.log('✅ pending_actions table created/verified');
  }

  // Ajouter une action en attente
  async addPendingAction(action: Omit<PendingAction, 'id' | 'synced'>): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = `
        INSERT INTO pending_actions (jobId, actionType, actionData, timestamp, synced) 
        VALUES (?, ?, ?, ?, 0)
      `;
      
      await this.db!.executeSql(query, [
        action.jobId,
        action.actionType,
        action.actionData || null,
        action.timestamp,
      ]);
      
      console.log('✅ Pending action saved:', action.actionType);
    } catch (error) {
      console.error('❌ Error saving pending action:', error);
      throw error;
    }
  }

  // Récupérer toutes les actions en attente (non synchronisées)
  async getPendingActions(): Promise<PendingAction[]> {
    if (!this.db) await this.init();

    try {
      const query = 'SELECT * FROM pending_actions WHERE synced = 0 ORDER BY timestamp ASC';
      const [results] = await this.db!.executeSql(query);
      
      const actions: PendingAction[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        actions.push(results.rows.item(i));
      }
      
      return actions;
    } catch (error) {
      console.error('❌ Error getting pending actions:', error);
      return [];
    }
  }

  // Compter les actions en attente
  async getPendingActionsCount(): Promise<number> {
    if (!this.db) await this.init();

    try {
      const query = 'SELECT COUNT(*) as count FROM pending_actions WHERE synced = 0';
      const [results] = await this.db!.executeSql(query);
      
      if (results.rows.length > 0) {
        return results.rows.item(0).count;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Error counting pending actions:', error);
      return 0;
    }
  }

  // Marquer une action comme synchronisée
  async markAsSynced(id: number): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'UPDATE pending_actions SET synced = 1 WHERE id = ?';
      await this.db!.executeSql(query, [id]);
      console.log('✅ Action marked as synced:', id);
    } catch (error) {
      console.error('❌ Error marking action as synced:', error);
      throw error;
    }
  }

  // Supprimer toutes les actions synchronisées
  async clearSyncedActions(): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM pending_actions WHERE synced = 1';
      await this.db!.executeSql(query);
      console.log('✅ Synced actions cleared');
    } catch (error) {
      console.error('❌ Error clearing synced actions:', error);
    }
  }

  // Supprimer une action spécifique
  async deleteAction(id: number): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM pending_actions WHERE id = ?';
      await this.db!.executeSql(query, [id]);
      console.log('✅ Action deleted:', id);
    } catch (error) {
      console.error('❌ Error deleting action:', error);
      throw error;
    }
  }

  // Nettoyer toutes les actions (pour le logout)
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    try {
      const query = 'DELETE FROM pending_actions';
      await this.db!.executeSql(query);
      console.log('✅ All pending actions cleared');
    } catch (error) {
      console.error('❌ Error clearing all actions:', error);
    }
  }

  // Fermer la connexion DB (optionnel)
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('✅ Database connection closed');
    }
  }
}

export const offlineActionsService = new OfflineActionsService();
