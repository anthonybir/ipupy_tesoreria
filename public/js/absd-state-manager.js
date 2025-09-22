/**
 * ABSD State Management - Persistent State Layer
 * Anthony Bir System Designs (ABSD) Studio
 * Implements BIRHAUS principles: Institutional Memory, Progressive Power
 */

'use strict';

window.ABSD = window.ABSD || {};

// ============================================
// STATE MANAGEMENT WITH PERSISTENCE
// ============================================

ABSD.StateManager = class {
  constructor(options = {}) {
    this.options = {
      namespace: 'absd_state',
      syncWithUrl: true,
      persistToStorage: true,
      debounceDelay: 300,
      maxHistorySize: 50,
      ...options
    };

    this.state = {};
    this.history = [];
    this.subscribers = new Map();
    this.debounceTimers = new Map();

    this.init();
  }

  init() {
    // Load initial state
    this.loadState();

    // Setup URL sync
    if (this.options.syncWithUrl) {
      this.setupUrlSync();
    }

    // Setup storage event listener for cross-tab sync
    if (this.options.persistToStorage) {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
    }

    // Setup beforeunload to save state
    window.addEventListener('beforeunload', () => this.saveState());
  }

  /**
   * Get state value
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.state;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Set state value with persistence
   */
  set(key, value, options = {}) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.state;

    // Navigate to nested object
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    // Store previous value for history
    const previousValue = target[lastKey];

    // Set new value
    target[lastKey] = value;

    // Add to history
    this.addToHistory({
      key,
      previousValue,
      newValue: value,
      timestamp: Date.now()
    });

    // Notify subscribers
    this.notifySubscribers(key, value, previousValue);

    // Persist state
    if (this.options.persistToStorage && !options.skipPersist) {
      this.debouncedSave();
    }

    // Update URL if needed
    if (this.options.syncWithUrl && !options.skipUrlUpdate) {
      this.updateUrl();
    }

    return this;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Notify subscribers of state changes
   */
  notifySubscribers(key, value, previousValue) {
    // Notify exact key subscribers
    const exactCallbacks = this.subscribers.get(key);
    if (exactCallbacks) {
      exactCallbacks.forEach(callback => {
        callback(value, previousValue, key);
      });
    }

    // Notify wildcard subscribers
    const wildcardCallbacks = this.subscribers.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(callback => {
        callback(value, previousValue, key);
      });
    }

    // Notify parent key subscribers
    const parentKeys = key.split('.').slice(0, -1);
    for (let i = parentKeys.length; i > 0; i--) {
      const parentKey = parentKeys.slice(0, i).join('.');
      const parentCallbacks = this.subscribers.get(parentKey + '.*');
      if (parentCallbacks) {
        parentCallbacks.forEach(callback => {
          callback(value, previousValue, key);
        });
      }
    }
  }

  /**
   * Load state from storage and URL
   */
  loadState() {
    // Load from localStorage
    if (this.options.persistToStorage) {
      const stored = localStorage.getItem(this.options.namespace);
      if (stored) {
        try {
          this.state = JSON.parse(stored);
        } catch (error) {
          console.error('Failed to load state from storage:', error);
          this.state = {};
        }
      }
    }

    // Merge URL parameters
    if (this.options.syncWithUrl) {
      const urlState = this.parseUrlState();
      this.state = this.deepMerge(this.state, urlState);
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    if (!this.options.persistToStorage) {return;}

    try {
      localStorage.setItem(this.options.namespace, JSON.stringify(this.state));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  /**
   * Debounced save
   */
  debouncedSave() {
    if (this.debounceTimers.has('save')) {
      clearTimeout(this.debounceTimers.get('save'));
    }

    const timer = setTimeout(() => {
      this.saveState();
      this.debounceTimers.delete('save');
    }, this.options.debounceDelay);

    this.debounceTimers.set('save', timer);
  }

  /**
   * Setup URL synchronization
   */
  setupUrlSync() {
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      const urlState = this.parseUrlState();
      const mergedState = this.deepMerge(this.state, urlState);

      // Update state without triggering URL update
      Object.keys(mergedState).forEach(key => {
        if (mergedState[key] !== this.state[key]) {
          this.set(key, mergedState[key], { skipUrlUpdate: true });
        }
      });
    });
  }

  /**
   * Parse state from URL parameters
   */
  parseUrlState() {
    const params = new URLSearchParams(window.location.search);
    const state = {};

    for (const [key, value] of params.entries()) {
      // Try to parse JSON values
      try {
        state[key] = JSON.parse(value);
      } catch {
        state[key] = value;
      }
    }

    return state;
  }

  /**
   * Update URL with current state
   */
  updateUrl() {
    const params = new URLSearchParams();

    // Only add non-default values to URL
    const urlKeys = this.options.urlKeys || Object.keys(this.state);

    urlKeys.forEach(key => {
      const value = this.get(key);
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object') {
          params.set(key, JSON.stringify(value));
        } else {
          params.set(key, String(value));
        }
      }
    });

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.search = params.toString();

    if (url.href !== window.location.href) {
      window.history.pushState(this.state, '', url.href);
    }
  }

  /**
   * Handle storage changes from other tabs
   */
  handleStorageChange(event) {
    if (event.key !== this.options.namespace) {return;}

    try {
      const newState = JSON.parse(event.newValue);
      const changes = this.findChanges(this.state, newState);

      changes.forEach(({ key, value }) => {
        this.set(key, value, { skipPersist: true });
      });
    } catch (error) {
      console.error('Failed to handle storage change:', error);
    }
  }

  /**
   * Find changes between two state objects
   */
  findChanges(oldState, newState, prefix = '') {
    const changes = [];

    const allKeys = new Set([
      ...Object.keys(oldState),
      ...Object.keys(newState)
    ]);

    allKeys.forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (!(key in newState)) {
        // Key was deleted
        changes.push({ key: fullKey, value: undefined });
      } else if (!(key in oldState)) {
        // Key was added
        changes.push({ key: fullKey, value: newState[key] });
      } else if (typeof newState[key] === 'object' && typeof oldState[key] === 'object') {
        // Recursively check nested objects
        changes.push(...this.findChanges(oldState[key], newState[key], fullKey));
      } else if (newState[key] !== oldState[key]) {
        // Value changed
        changes.push({ key: fullKey, value: newState[key] });
      }
    });

    return changes;
  }

  /**
   * Add to history
   */
  addToHistory(entry) {
    this.history.push(entry);

    // Limit history size
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Undo last state change
   */
  undo() {
    if (this.history.length === 0) {return false;}

    const entry = this.history.pop();
    this.set(entry.key, entry.previousValue, { skipHistory: true });

    return true;
  }

  /**
   * Get state history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear all state
   */
  clear() {
    this.state = {};
    this.history = [];
    this.saveState();
    this.updateUrl();
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  /**
   * Export state as JSON
   */
  export() {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from JSON
   */
  import(json) {
    try {
      const newState = JSON.parse(json);
      this.state = newState;
      this.saveState();
      this.updateUrl();

      // Notify all subscribers
      this.notifySubscribers('*', this.state, {});

      return true;
    } catch (error) {
      console.error('Failed to import state:', error);
      return false;
    }
  }
};

// ============================================
// PREFERENCE MANAGER
// ============================================

ABSD.PreferenceManager = class extends ABSD.StateManager {
  constructor() {
    super({
      namespace: 'absd_preferences',
      syncWithUrl: false,
      urlKeys: ['theme', 'density', 'disclosure', 'tab']
    });

    this.setupDefaults();
    this.applyPreferences();
  }

  setupDefaults() {
    const defaults = {
      theme: 'light',
      density: 'normal',
      disclosure: 'basic',
      locale: 'es-PY',
      reducedMotion: false,
      highContrast: false,
      fontSize: 'normal',
      sidebarCollapsed: false,
      defaultTab: 'dashboard',
      dateFormat: 'DD/MM/YYYY',
      currencyFormat: 'PYG',
      notificationsEnabled: true
    };

    // Apply defaults if not set
    Object.keys(defaults).forEach(key => {
      if (this.get(key) === null) {
        this.set(key, defaults[key]);
      }
    });
  }

  applyPreferences() {
    // Apply theme
    const theme = this.get('theme');
    document.body.className = document.body.className
      .replace(/theme-\w+/g, '')
      + ` theme-${theme}`;

    // Apply density
    const density = this.get('density');
    document.body.className = document.body.className
      .replace(/density-\w+/g, '')
      + ` density-${density}`;

    // Apply disclosure level
    const disclosure = this.get('disclosure');
    document.body.className = document.body.className
      .replace(/absd-disclosure-\w+/g, '')
      + ` absd-disclosure-${disclosure}`;

    // Apply reduced motion
    if (this.get('reducedMotion')) {
      document.documentElement.style.setProperty('--duration-instant', '0ms');
      document.documentElement.style.setProperty('--duration-quick', '0ms');
      document.documentElement.style.setProperty('--duration-normal', '0ms');
      document.documentElement.style.setProperty('--duration-slow', '0ms');
    }

    // Subscribe to changes
    this.subscribe('*', () => this.applyPreferences());
  }

  toggleTheme() {
    const currentTheme = this.get('theme');
    this.set('theme', currentTheme === 'light' ? 'dark' : 'light');
  }

  toggleDensity() {
    const densities = ['compact', 'normal', 'comfortable'];
    const current = this.get('density');
    const index = densities.indexOf(current);
    const next = densities[(index + 1) % densities.length];
    this.set('density', next);
  }

  setDisclosureLevel(level) {
    const levels = ['basic', 'intermediate', 'advanced'];
    if (levels.includes(level)) {
      this.set('disclosure', level);
    }
  }
};

// Initialize global instances
ABSD.state = new ABSD.StateManager();
ABSD.preferences = new ABSD.PreferenceManager();