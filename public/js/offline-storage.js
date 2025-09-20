/**
 * ABSD Offline Storage Extension - IPU PY Treasury System
 * Anthony Bir System Designs (ABSD) Studio
 *
 * Paraguayan Pragmatism Principle:
 * "Design for intermittent connectivity"
 *
 * Features:
 * - IndexedDB for local storage
 * - Sync queue for pending operations
 * - Conflict resolution
 * - Data dignity preservation
 */

'use strict';

// ABSD Offline Storage Namespace
window.ABSD = window.ABSD || {};

ABSD.OfflineStorage = {
  // Database configuration
  dbName: 'absd_treasury_db',
  dbVersion: 1,
  db: null,

  // Store definitions
  stores: {
    fund_movements: 'id, church_id, fund_category_id, tipo_movimiento, monto, concepto, fecha_movimiento, created_at, synced',
    expense_records: 'id, church_id, fecha_comprobante, numero_comprobante, proveedor, concepto, tipo_salida, total_factura, created_at, synced',
    worship_records: 'id, church_id, fecha, total_diezmos, total_ofrendas, total_misiones, created_at, synced',
    reports: 'id, church_id, month, year, diezmos, ofrendas, total_entradas, fondo_nacional, created_at, synced',
    sync_queue: 'id, table_name, operation, data, timestamp, retries, error',
    audit_log: 'id, action, data, timestamp, user_id',
    churches: 'id, name, city, pastor, phone, last_sync',
    cache: 'key, endpoint, data, timestamp, expires, created_at'
  },

  apiRouteMap: {
    fund_movements: 'fund-movements',
    expense_records: 'expense-records',
    worship_records: 'worship-records',
    reports: 'reports',
    churches: 'churches'
  },

  // Sync status
  isOnline: navigator.onLine,
  syncInProgress: false,
  maxRetries: 3,

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize offline storage system
   */
  async init() {
    try {
      await this.openDatabase();
      this.setupEventListeners();
      await this.loadCachedData();

      // Start sync if online
      if (this.isOnline) {
        this.startPeriodicSync();
      }

      ABSD.Core.logAction('offline_storage_init', { dbVersion: this.dbVersion });
      console.log('ABSD Offline Storage initialized');

    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
      ABSD.Core.logAction('offline_storage_init_error', { error: error.message });
    }
  },

  /**
   * Open IndexedDB database
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        Object.entries(this.stores).forEach(([storeName, indexes]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            // Cache store uses 'key' as keyPath, others use 'id'
            const keyPath = storeName === 'cache' ? 'key' : 'id';
            const autoIncrement = storeName !== 'cache';

            const store = db.createObjectStore(storeName, {
              keyPath,
              autoIncrement
            });

            // Create indexes
            indexes.split(', ').forEach(index => {
              if (index !== keyPath) {
                store.createIndex(index, index, { unique: false });
              }
            });
          }
        });
      };
    });
  },

  /**
   * Setup event listeners for connectivity and sync
   */
  setupEventListeners() {
    // Connectivity events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onConnectionRestored();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.onConnectionLost();
    });

    // Page visibility for sync optimization
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncPendingOperations();
      }
    });

    // Before unload - save any pending data
    window.addEventListener('beforeunload', () => {
      this.flushPendingData();
    });
  },

  // ============================================
  // CORE STORAGE OPERATIONS
  // ============================================

  /**
   * Save data to local storage
   */
  async save(storeName, data, options = {}) {
    try {
      const timestamp = new Date().toISOString();
      const record = {
        ...data,
        created_at: data.created_at || timestamp,
        updated_at: timestamp,
        synced: this.isOnline && !options.forceOffline ? false : false // Always false initially
      };

      // Generate temporary ID if not provided
      if (!record.id) {
        record.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const result = await this.dbOperation('readwrite', storeName, store => {
        return store.add(record);
      });

      // Add to sync queue if online
      if (this.isOnline && !options.skipSync) {
        await this.addToSyncQueue(storeName, 'create', record);
      }

      ABSD.Core.logAction('offline_save', { storeName, id: record.id });
      return { ...record, localId: result };

    } catch (error) {
      console.error('Error saving to offline storage:', error);
      throw error;
    }
  },

  /**
   * Update existing data
   */
  async update(storeName, id, data, options = {}) {
    try {
      const existing = await this.get(storeName, id);
      if (!existing) {
        throw new Error(`Record not found: ${id}`);
      }

      const updated = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
        synced: false
      };

      await this.dbOperation('readwrite', storeName, store => {
        return store.put(updated);
      });

      // Add to sync queue
      if (this.isOnline && !options.skipSync) {
        await this.addToSyncQueue(storeName, 'update', updated);
      }

      ABSD.Core.logAction('offline_update', { storeName, id });
      return updated;

    } catch (error) {
      console.error('Error updating offline storage:', error);
      throw error;
    }
  },

  /**
   * Delete data (soft delete for data dignity)
   */
  async delete(storeName, id, options = {}) {
    try {
      if (options.hardDelete) {
        await this.dbOperation('readwrite', storeName, store => {
          return store.delete(id);
        });
      } else {
        // Soft delete - mark as deleted
        await this.update(storeName, id, {
          deleted: true,
          deleted_at: new Date().toISOString()
        }, options);
      }

      // Add to sync queue
      if (this.isOnline && !options.skipSync) {
        await this.addToSyncQueue(storeName, 'delete', { id });
      }

      ABSD.Core.logAction('offline_delete', { storeName, id, hardDelete: options.hardDelete });

    } catch (error) {
      console.error('Error deleting from offline storage:', error);
      throw error;
    }
  },

  /**
   * Get single record
   */
  async get(storeName, id) {
    try {
      return await this.dbOperation('readonly', storeName, store => {
        return store.get(id);
      });
    } catch (error) {
      console.error('Error getting from offline storage:', error);
      return null;
    }
  },

  /**
   * Get all records with optional filter
   */
  async getAll(storeName, filter = {}) {
    try {
      const records = await this.dbOperation('readonly', storeName, store => {
        return store.getAll();
      });

      // Apply filters
      let filtered = records.filter(record => !record.deleted);

      Object.entries(filter).forEach(([key, value]) => {
        filtered = filtered.filter(record => record[key] === value);
      });

      return filtered;

    } catch (error) {
      console.error('Error getting all from offline storage:', error);
      return [];
    }
  },

  /**
   * Query with index
   */
  async query(storeName, indexName, value) {
    try {
      return await this.dbOperation('readonly', storeName, store => {
        const index = store.index(indexName);
        return index.getAll(value);
      });
    } catch (error) {
      console.error('Error querying offline storage:', error);
      return [];
    }
  },

  // ============================================
  // SYNC QUEUE MANAGEMENT
  // ============================================

  /**
   * Add operation to sync queue
   */
  async addToSyncQueue(tableName, operation, data) {
    const queueItem = {
      table_name: tableName,
      operation: operation,
      data: data,
      timestamp: new Date().toISOString(),
      retries: 0,
      error: null
    };

    await this.dbOperation('readwrite', 'sync_queue', store => {
      return store.add(queueItem);
    });
  },

  /**
   * Process sync queue
   */
  async syncPendingOperations() {
    if (this.syncInProgress || !this.isOnline) {return;}

    this.syncInProgress = true;

    try {
      const pendingOperations = await this.getAll('sync_queue');

      for (const operation of pendingOperations) {
        try {
          await this.processSyncOperation(operation);
          await this.delete('sync_queue', operation.id, { hardDelete: true, skipSync: true });

        } catch (error) {
          console.error('Sync operation failed:', error);

          // Update retry count
          await this.update('sync_queue', operation.id, {
            retries: operation.retries + 1,
            error: error.message
          }, { skipSync: true });

          // Remove from queue if max retries exceeded
          if (operation.retries >= this.maxRetries) {
            await this.delete('sync_queue', operation.id, { hardDelete: true, skipSync: true });
            ABSD.Core.logAction('sync_operation_failed_max_retries', {
              operation: operation.operation,
              table: operation.table_name,
              error: error.message
            });
          }
        }
      }

      ABSD.Core.logAction('sync_completed', { operationsProcessed: pendingOperations.length });

    } catch (error) {
      console.error('Sync process error:', error);
    } finally {
      this.syncInProgress = false;
    }
  },

  /**
   * Process individual sync operation
   */
  async processSyncOperation(operation) {
    const { table_name, operation: op, data } = operation;
    const endpoint = this.apiRouteMap?.[table_name] || table_name.replace(/_/g, '-');

    if (!endpoint) {
      console.warn(`No API endpoint configured for store ${table_name}`);
      return null;
    }

    let response;

    switch (op) {
    case 'create':
      response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      break;

    case 'update':
      response = await fetch(`/api/${endpoint}/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      break;

    case 'delete':
      response = await fetch(`/api/${endpoint}/${data.id}`, {
        method: 'DELETE'
      });
      break;

    default:
      throw new Error(`Unknown operation: ${op}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Update local record with server ID if created
    if (op === 'create' && result.id && data.id.startsWith('temp_')) {
      await this.update(table_name, data.id, {
        id: result.id,
        synced: true
      }, { skipSync: true });
    } else {
      await this.update(table_name, data.id, { synced: true }, { skipSync: true });
    }

    return result;
  },

  // ============================================
  // DATABASE UTILITIES
  // ============================================

  /**
   * Perform database operation with transaction
   */
  dbOperation(mode, storeName, operation) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);

      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);

      transaction.onerror = () => reject(transaction.error);
    });
  },

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const stats = {};

    for (const storeName of Object.keys(this.stores)) {
      try {
        const records = await this.getAll(storeName);
        const synced = records.filter(r => r.synced).length;
        const pending = records.filter(r => !r.synced).length;

        stats[storeName] = {
          total: records.length,
          synced: synced,
          pending: pending
        };
      } catch (error) {
        stats[storeName] = { error: error.message };
      }
    }

    return stats;
  },

  /**
   * Clear all offline data (with confirmation)
   */
  async clearAllData(confirm = false) {
    if (!confirm) {
      throw new Error('Must confirm data clearing');
    }

    for (const storeName of Object.keys(this.stores)) {
      await this.dbOperation('readwrite', storeName, store => {
        return store.clear();
      });
    }

    ABSD.Core.logAction('offline_data_cleared');
  },

  // ============================================
  // READ-THROUGH API CACHE
  // ============================================

  /**
   * Fetch data with read-through cache pattern
   * Check cache first, then API, then cache the result
   */
  async fetchWithCache(endpoint, options = {}) {
    const {
      maxAge = 5 * 60 * 1000, // 5 minutes default
      forceRefresh = false,
      fallbackToCache = true
    } = options;

    const cacheKey = this.generateCacheKey(endpoint, options);

    try {
      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = await this.getCached(cacheKey);
        if (cached && !this.isCacheExpired(cached, maxAge)) {
          console.log(`📦 Cache hit: ${endpoint}`);
          return {
            data: cached.data,
            fromCache: true,
            timestamp: cached.timestamp
          };
        }
      }

      // Try to fetch from API if online
      if (this.isOnline) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();

          // Cache the fresh data
          await this.setCached(cacheKey, {
            endpoint,
            data,
            timestamp: new Date().toISOString(),
            expires: new Date(Date.now() + maxAge).toISOString()
          });

          console.log(`🌐 API response cached: ${endpoint}`);

          return {
            data,
            fromCache: false,
            timestamp: new Date().toISOString()
          };

        } catch (apiError) {
          console.warn(`API request failed: ${apiError.message}`);

          // Fall back to cache if available
          if (fallbackToCache) {
            const staleCache = await this.getCached(cacheKey);
            if (staleCache) {
              console.log(`📦 Fallback to stale cache: ${endpoint}`);
              return {
                data: staleCache.data,
                fromCache: true,
                timestamp: staleCache.timestamp,
                stale: true
              };
            }
          }

          throw apiError;
        }
      } else {
        // Offline - return cache if available
        const cached = await this.getCached(cacheKey);
        if (cached) {
          console.log(`📦 Offline cache: ${endpoint}`);
          return {
            data: cached.data,
            fromCache: true,
            timestamp: cached.timestamp,
            offline: true
          };
        }

        throw new Error('No cached data available for offline use');
      }

    } catch (error) {
      console.error(`Cache fetch error for ${endpoint}:`, error);
      throw error;
    }
  },

  /**
   * Get cached data by key
   */
  async getCached(key) {
    try {
      const cached = await this.dbOperation('readonly', 'cache', store => {
        return store.get(key);
      });
      return cached;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  },

  /**
   * Set cached data
   */
  async setCached(key, cacheData) {
    try {
      const cacheRecord = {
        key,
        ...cacheData,
        created_at: new Date().toISOString()
      };

      await this.dbOperation('readwrite', 'cache', store => {
        return store.put(cacheRecord);
      });

    } catch (error) {
      console.error('Error setting cached data:', error);
    }
  },

  /**
   * Generate cache key from endpoint and options
   */
  generateCacheKey(endpoint, options = {}) {
    const { params, query } = options;
    let key = endpoint;

    if (params) {
      key += '_' + Object.values(params).join('_');
    }

    if (query) {
      const queryString = new URLSearchParams(query).toString();
      key += '_' + queryString;
    }

    return key.replace(/[^a-zA-Z0-9_]/g, '_');
  },

  /**
   * Check if cache entry is expired
   */
  isCacheExpired(cached, maxAge) {
    if (!cached.expires) {
      // Fallback to timestamp + maxAge
      const cacheTime = new Date(cached.timestamp).getTime();
      return Date.now() - cacheTime > maxAge;
    }

    return new Date(cached.expires) < new Date();
  },

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache() {
    try {
      const allCached = await this.dbOperation('readonly', 'cache', store => {
        return store.getAll();
      });

      const expired = allCached.filter(cached =>
        cached.expires && new Date(cached.expires) < new Date()
      );

      for (const item of expired) {
        await this.dbOperation('readwrite', 'cache', store => {
          return store.delete(item.key);
        });
      }

      console.log(`🧹 Cleared ${expired.length} expired cache entries`);

    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  },

  /**
   * API convenience methods using cache
   */
  api: {
    async getFunds(options = {}) {
      const result = await ABSD.OfflineStorage.fetchWithCache('/api/funds', {
        maxAge: 2 * 60 * 1000, // 2 minutes for funds
        ...options
      });
      return result;
    },

    async getChurches(options = {}) {
      const result = await ABSD.OfflineStorage.fetchWithCache('/api/churches', {
        maxAge: 10 * 60 * 1000, // 10 minutes for churches
        ...options
      });
      return result;
    },

    async getDashboard(options = {}) {
      const result = await ABSD.OfflineStorage.fetchWithCache('/api/dashboard', {
        maxAge: 1 * 60 * 1000, // 1 minute for dashboard
        ...options
      });
      return result;
    },

    async getDbTest(options = {}) {
      const result = await ABSD.OfflineStorage.fetchWithCache('/api/db-test', {
        maxAge: 30 * 1000, // 30 seconds for db test
        ...options
      });
      return result;
    }
  },

  // ============================================
  // CONNECTION EVENT HANDLERS
  // ============================================

  /**
   * Handle connection restored
   */
  async onConnectionRestored() {
    console.log('Connection restored - starting sync...');

    // Update UI indicator
    document.dispatchEvent(new CustomEvent('connectionrestored'));

    // Start syncing pending operations
    setTimeout(() => {
      this.syncPendingOperations();
    }, 1000); // Small delay to ensure connection is stable

    ABSD.Core.logAction('connection_restored');
  },

  /**
   * Handle connection lost
   */
  onConnectionLost() {
    console.log('Connection lost - switching to offline mode...');

    // Update UI indicator
    document.dispatchEvent(new CustomEvent('connectionlost'));

    ABSD.Core.logAction('connection_lost');
  },

  /**
   * Load cached data on startup
   */
  async loadCachedData() {
    try {
      // Load churches for dropdowns
      const churches = await this.getAll('churches');
      if (churches.length > 0) {
        document.dispatchEvent(new CustomEvent('cachedchurchesloaded', {
          detail: { churches }
        }));
      }

      // Load recent reports
      const reports = await this.getAll('reports');
      if (reports.length > 0) {
        document.dispatchEvent(new CustomEvent('cachedreportsloaded', {
          detail: { reports }
        }));
      }

    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  },

  /**
   * Start periodic sync when online
   */
  startPeriodicSync() {
    // Sync every 5 minutes when online
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingOperations();
      }
    }, 5 * 60 * 1000);

    // Clear expired cache every 15 minutes
    setInterval(() => {
      this.clearExpiredCache();
    }, 15 * 60 * 1000);
  },

  /**
   * Flush any pending data before page unload
   */
  flushPendingData() {
    // Save any form data that might be in progress
    const forms = document.querySelectorAll('form[data-absd-autosave]');
    forms.forEach(form => {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      if (Object.keys(data).length > 0) {
        localStorage.setItem(`absd_form_backup_${form.id}`, JSON.stringify({
          data: data,
          timestamp: new Date().toISOString()
        }));
      }
    });
  },

  // ============================================
  // EXPORT/IMPORT FOR BACKUP
  // ============================================

  /**
   * Export all data for backup
   */
  async exportData() {
    const exportData = {
      version: this.dbVersion,
      timestamp: new Date().toISOString(),
      data: {}
    };

    for (const storeName of Object.keys(this.stores)) {
      exportData.data[storeName] = await this.getAll(storeName);
    }

    return exportData;
  },

  /**
   * Import data from backup
   */
  async importData(backupData, options = { merge: true }) {
    if (!options.merge) {
      await this.clearAllData(true);
    }

    for (const [storeName, records] of Object.entries(backupData.data)) {
      for (const record of records) {
        try {
          await this.save(storeName, record, { skipSync: true });
        } catch (error) {
          console.error(`Error importing ${storeName} record:`, error);
        }
      }
    }

    ABSD.Core.logAction('data_imported', {
      recordsImported: Object.values(backupData.data).flat().length
    });
  }
};

// ============================================
// AUTO-INITIALIZATION
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ABSD.OfflineStorage.init());
} else {
  ABSD.OfflineStorage.init();
}

// Export for manual initialization
window.ABSD = window.ABSD || {};
window.ABSD.OfflineStorage = ABSD.OfflineStorage;