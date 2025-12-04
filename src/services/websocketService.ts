// Background WebSocket Service
import { AppState, AppStateStatus, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { io, Socket } from 'socket.io-client';
import { appEventEmitter, AppEvents } from './appEventEmitter';
import { storageService } from './storageService';
import { authService } from './authService';

// WebSocket server URL
const WS_BASE_URL = 'https://api.ironwheelsdriver.com';

// Background task options
const backgroundOptions = {
  taskName: 'IronWheelsWebSocket',
  taskTitle: 'Iron Wheels',
  taskDesc: 'Keeping connection alive for real-time updates',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#1a3a5e',
  linkingURI: 'ironwheels://',
  parameters: {
    delay: 1000,
  },
};

class WebSocketService {
  private socket: Socket | null = null;
  private driverId: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isBackgroundServiceRunning: boolean = false;

  /**
   * Initialize WebSocket connection for a driver
   */
  async connect(driverId: string): Promise<void> {
    if (this.socket && this.isConnected && this.driverId === driverId) {
      console.log('🔌 WebSocket already connected for driver:', driverId);
      return;
    }

    // Disconnect existing connection if any
    this.disconnect();

    this.driverId = driverId;

    try {
      // Get access token for authentication
      const accessToken = await authService.getAccessToken();
      
      if (!accessToken) {
        console.error('❌ No access token available for WebSocket connection');
        return;
      }

      console.log('🔌 Connecting WebSocket for driver:', driverId);

      this.socket = io(WS_BASE_URL, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        auth: {
          token: accessToken,
        },
      });

      this.setupEventListeners();
      
      // Start background service on Android
      if (Platform.OS === 'android') {
        await this.startBackgroundService();
      }

      // Start heartbeat to keep connection alive
      this.startHeartbeat();

    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
    }
  }

  /**
   * Start background service for Android
   */
  private async startBackgroundService(): Promise<void> {
    if (this.isBackgroundServiceRunning) {
      console.log('🔄 Background service already running');
      return;
    }

    try {
      const isRunning = await BackgroundService.isRunning();
      if (isRunning) {
        console.log('🔄 Background service already running (checked)');
        this.isBackgroundServiceRunning = true;
        return;
      }

      await BackgroundService.start(this.backgroundTask, backgroundOptions);
      this.isBackgroundServiceRunning = true;
      console.log('✅ Background service started');
    } catch (error) {
      console.error('❌ Failed to start background service:', error);
    }
  }

  /**
   * Background task that keeps the WebSocket alive
   */
  private backgroundTask = async (taskData: any) => {
    const { delay } = taskData;

    await new Promise<void>(async (resolve) => {
      // Keep the task running indefinitely
      const keepAlive = setInterval(async () => {
        if (!this.isConnected && this.driverId) {
          console.log('🔄 Background: Attempting reconnect...');
          const accessToken = await authService.getAccessToken();
          if (accessToken && this.socket) {
            this.socket.auth = { token: accessToken };
            this.socket.connect();
          }
        } else {
          console.log('💓 Background: WebSocket alive');
        }
      }, 30000); // Check every 30 seconds

      // This promise never resolves to keep the background task running
    });
  };

  /**
   * Stop background service
   */
  private async stopBackgroundService(): Promise<void> {
    if (!this.isBackgroundServiceRunning) {
      return;
    }

    try {
      await BackgroundService.stop();
      this.isBackgroundServiceRunning = false;
      console.log('✅ Background service stopped');
    } catch (error) {
      console.error('❌ Failed to stop background service:', error);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        // Send ping to server
        this.socket.emit('heartbeat', {
          driverId: this.driverId,
          timestamp: new Date().toISOString(),
        });
        console.log('💓 Heartbeat sent');
      }
    }, 25000); // Every 25 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected, socket ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Join driver-specific channels
      if (this.driverId) {
        this.joinDriverChannels(this.driverId);
      }
    });

    // Connection error
    this.socket.on('connect_error', async (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      this.isConnected = false;
      
      // Try to refresh token on auth error
      if (error.message.includes('Authentication')) {
        console.log('🔄 Refreshing token due to auth error...');
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          const newToken = await authService.getAccessToken();
          if (newToken && this.socket) {
            this.socket.auth = { token: newToken };
            this.socket.connect();
          }
        }
      }
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect manually
        this.attemptReconnect();
      }
    });

    // Reconnect attempt
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 WebSocket reconnect attempt:', attemptNumber);
      this.reconnectAttempts = attemptNumber;
    });

    // Reconnected
    this.socket.on('reconnect', () => {
      console.log('✅ WebSocket reconnected');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      if (this.driverId) {
        this.joinDriverChannels(this.driverId);
      }
    });

    // Generic message handler for debugging
    this.socket.onAny((event, ...args) => {
      console.log('📨 WebSocket event received:', event, JSON.stringify(args));
      
      // Handle job deletion event dynamically
      // If we receive this event, it means the server sent it to our room,
      // so we should process it regardless of local driverId state
      if (event.startsWith('deleteJob_driver_')) {
        const eventDriverId = event.replace('deleteJob_driver_', '');
        console.log('🚨 Job deletion event detected for driver:', eventDriverId);
        console.log('🚨 Current driver ID:', this.driverId);
        
        // Process the deletion - if we received this event, it's meant for us
        // The server only sends to the specific driver's room
        console.log('✅ Processing job deletion (received in our room)...');
        this.handleJobDeleted(args[0]);
      }
      
      // Handle online check event dynamically
      if (event.startsWith('check_online_driver_')) {
        this.handleOnlineCheck(args[0]);
      }
    });
  }

  /**
   * Handle job deleted event
   */
  private async handleJobDeleted(data: any): Promise<void> {
    console.log('🗑️ Job deleted event received, data:', JSON.stringify(data));
    
    try {
      const receivedJobId = data?.jobId;
      
      if (!receivedJobId) {
        console.log('⚠️ No jobId in deletion event, ignoring');
        return;
      }
      
      // Get current local job
      const localJob = await storageService.getJob();
      
      if (!localJob) {
        console.log('ℹ️ No local job exists, nothing to delete');
        return;
      }
      
      // Check if the deleted job matches the local job
      if (localJob.id !== receivedJobId) {
        console.log('⚠️ Job ID mismatch - Local:', localJob.id, 'Received:', receivedJobId);
        console.log('ℹ️ Ignoring deletion event (not the same job)');
        return;
      }
      
      // Job IDs match - delete the local job
      console.log('✅ Job ID matches local job, deleting...');
      await storageService.deleteJobById(receivedJobId, false);
      
      // Emit event to update UI
      console.log('📢 Emitting JOB_DELETED event to UI...');
      appEventEmitter.emit(AppEvents.JOB_DELETED, {
        jobId: receivedJobId,
        reason: data?.reason || 'Job cancelled by admin',
      });
      
      console.log('✅ Job deleted from local storage and UI notified');
    } catch (error) {
      console.error('❌ Error handling job deletion:', error);
    }
  }

  /**
   * Handle online check event
   */
  private handleOnlineCheck(data: any): void {
    console.log('📡 Online check received:', data);
    
    // Respond to confirm driver is online
    this.socket?.emit('driver_online_response', {
      driverId: this.driverId,
      online: true,
      timestamp: new Date().toISOString(),
    });
    
    console.log('✅ Responded to online check');
  }

  /**
   * Join driver-specific channels
   */
  private joinDriverChannels(driverId: string): void {
    if (!this.socket) return;

    // Emit join event to server
    this.socket.emit('join_driver_room', {
      driverId: driverId,
    });

    console.log('📢 Joined driver channels for:', driverId);
  }

  /**
   * Attempt manual reconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setInterval(async () => {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('❌ Max reconnect attempts reached');
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
        return;
      }

      if (!this.isConnected && this.driverId) {
        console.log('🔄 Attempting manual reconnect...');
        
        // Refresh token before reconnecting
        const accessToken = await authService.getAccessToken();
        if (accessToken && this.socket) {
          this.socket.auth = { token: accessToken };
          this.socket.connect();
        }
        
        this.reconnectAttempts++;
      } else {
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      }
    }, 5000);
  }

  /**
   * Disconnect WebSocket
   */
  async disconnect(): Promise<void> {
    // Stop background service
    await this.stopBackgroundService();

    // Stop heartbeat
    this.stopHeartbeat();

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.driverId = null;
    this.reconnectAttempts = 0;
    console.log('✅ WebSocket disconnected');
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get current driver ID
   */
  getCurrentDriverId(): string | null {
    return this.driverId;
  }

  /**
   * Emit event to server
   */
  emit(event: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
      console.log('📤 Emitted event:', event, data);
    } else {
      console.warn('⚠️ Cannot emit, WebSocket not connected');
    }
  }

  /**
   * Listen for custom event
   */
  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove listener for event
   */
  off(event: string, callback?: (data: any) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  /**
   * Check if background service is running
   */
  isBackgroundRunning(): boolean {
    return this.isBackgroundServiceRunning;
  }
}

// Export singleton
export const websocketService = new WebSocketService();
export default websocketService;
