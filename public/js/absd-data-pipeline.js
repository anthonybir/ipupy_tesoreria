/**
 * ABSD Data Pipeline - Progressive Loading System
 * Anthony Bir System Designs (ABSD) Studio
 * Implements BIRHAUS principles: Paraguayan Pragmatism, Visible Complexity
 */

'use strict';

window.ABSD = window.ABSD || {};

// ============================================
// PROGRESSIVE DATA PIPELINE
// ============================================

ABSD.DataPipeline = class {
  constructor(options = {}) {
    this.options = {
      enableOfflineQueue: true,
      progressiveLoad: true,
      skeletonTimeout: 300,
      retryAttempts: 3,
      retryDelay: 1000,
      cacheExpiry: 5 * 60 * 1000, // 5 minutes
      ...options
    };

    this.cache = new Map();
    this.offlineQueue = [];
    this.observers = new Map();
    this.loadingStates = new Map();

    this.init();
  }

  init() {
    // Monitor online/offline status
    window.addEventListener('online', () => this.processOfflineQueue());
    window.addEventListener('offline', () => this.handleOffline());

    // Setup IntersectionObserver for lazy loading
    if ('IntersectionObserver' in window) {
      this.setupIntersectionObserver();
    }

    // Restore offline queue from localStorage
    this.restoreOfflineQueue();
  }

  /**
   * Progressive data fetching with skeleton states
   */
  async fetch(url, options = {}) {
    const cacheKey = this.getCacheKey(url, options);

    // Check cache first
    if (this.cache.has(cacheKey) && !options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.options.cacheExpiry) {
        return cached.data;
      }
    }

    // Show skeleton state
    this.showSkeleton(options.container);

    try {
      const response = await this.fetchWithRetry(url, options);
      const data = await response.json();

      // Cache the response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      // Hide skeleton and show data
      this.hideSkeleton(options.container);

      return data;
    } catch (error) {
      // Queue for offline processing if network error
      if (!navigator.onLine && this.options.enableOfflineQueue) {
        this.queueOfflineRequest(url, options);
      }

      this.hideSkeleton(options.container);
      this.handleError(error, options.container);
      throw error;
    }
  }

  /**
   * Fetch with automatic retry logic
   */
  async fetchWithRetry(url, options = {}) {
    let lastError;

    // Disable retries for auth endpoints to prevent rate limiting
    const isAuthEndpoint = url.includes('/auth');
    const maxAttempts = isAuthEndpoint ? 1 : this.options.retryAttempts;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError = error;

        // Don't retry if offline or auth endpoint
        if (!navigator.onLine || isAuthEndpoint) {
          break;
        }

        // Wait before retrying
        if (i < maxAttempts - 1) {
          await this.delay(this.options.retryDelay * Math.pow(2, i));
        }
      }
    }

    throw lastError;
  }

  /**
   * Show skeleton loading state
   */
  showSkeleton(container) {
    if (!container) {return;}

    const element = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!element) {return;}

    // Store original content only the first time we swap it out
    if (!this.loadingStates.has(element)) {
      this.loadingStates.set(element, element.innerHTML);
    }

    // Apply skeleton based on element type
    const skeletonType = element.dataset.skeletonType || 'default';
    element.innerHTML = this.getSkeletonTemplate(skeletonType);
    element.classList.add('absd-data-loading');
  }

  /**
   * Hide skeleton loading state
   */
  hideSkeleton(container) {
    if (!container) {return;}

    const element = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!element) {return;}

    // Restore original content if we swapped it
    if (this.loadingStates.has(element)) {
      const originalContent = this.loadingStates.get(element);
      element.innerHTML = originalContent;
      this.loadingStates.delete(element);
    }

    element.classList.remove('absd-data-loading');
  }

  /**
   * Get skeleton template based on type
   */
  getSkeletonTemplate(type) {
    const templates = {
      card: `
        <div class="absd-skeleton absd-skeleton-card"></div>
      `,
      metric: `
        <div class="absd-skeleton absd-skeleton-metric"></div>
      `,
      table: `
        <div class="absd-skeleton absd-skeleton-table-row"></div>
        <div class="absd-skeleton absd-skeleton-table-row"></div>
        <div class="absd-skeleton absd-skeleton-table-row"></div>
        <div class="absd-skeleton absd-skeleton-table-row"></div>
        <div class="absd-skeleton absd-skeleton-table-row"></div>
      `,
      text: `
        <div class="absd-skeleton absd-skeleton-title"></div>
        <div class="absd-skeleton absd-skeleton-text"></div>
        <div class="absd-skeleton absd-skeleton-text"></div>
        <div class="absd-skeleton absd-skeleton-text" style="width: 75%;"></div>
      `,
      default: `
        <div class="absd-skeleton absd-skeleton-text"></div>
      `
    };

    return templates[type] || templates.default;
  }

  /**
   * Setup IntersectionObserver for lazy loading
   */
  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const url = element.dataset.lazyUrl;

          if (url && !element.dataset.loaded) {
            this.fetch(url, {
              container: element,
              ...JSON.parse(element.dataset.lazyOptions || '{}')
            }).then(data => {
              element.dataset.loaded = 'true';
              this.renderData(element, data);
            });
          }
        }
      });
    }, {
      rootMargin: '50px'
    });

    // Observe all elements with lazy loading
    document.querySelectorAll('[data-lazy-url]').forEach(element => {
      this.observer.observe(element);
    });
  }

  /**
   * Render data into element
   */
  renderData(element, data) {
    const template = element.dataset.template;

    if (template && window[template]) {
      element.innerHTML = window[template](data);
    } else {
      // Default rendering
      element.innerHTML = JSON.stringify(data, null, 2);
    }

    // Trigger rendered event
    element.dispatchEvent(new CustomEvent('absd:data-rendered', {
      detail: data
    }));
  }

  /**
   * Queue offline request
   */
  queueOfflineRequest(url, options) {
    const request = {
      id: Date.now(),
      url,
      options,
      timestamp: new Date().toISOString()
    };

    this.offlineQueue.push(request);

    // Persist to localStorage
    localStorage.setItem('absd_offline_queue', JSON.stringify(this.offlineQueue));

    // Show offline indicator
    this.showOfflineIndicator();

    ABSD.Core.logAction('offline_request_queued', request);
  }

  /**
   * Process offline queue when back online
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) {return;}

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const request of queue) {
      try {
        await this.fetch(request.url, request.options);
      } catch {
        // Re-queue if still failing
        this.offlineQueue.push(request);
      }
    }

    // Update localStorage
    if (this.offlineQueue.length === 0) {
      localStorage.removeItem('absd_offline_queue');
      this.hideOfflineIndicator();
    } else {
      localStorage.setItem('absd_offline_queue', JSON.stringify(this.offlineQueue));
    }
  }

  /**
   * Restore offline queue from localStorage
   */
  restoreOfflineQueue() {
    const saved = localStorage.getItem('absd_offline_queue');
    if (saved) {
      try {
        this.offlineQueue = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to restore offline queue:', error);
        this.offlineQueue = [];
      }
    }
  }

  /**
   * Show offline indicator
   */
  showOfflineIndicator() {
    if (document.getElementById('absd-offline-indicator')) {return;}

    const indicator = document.createElement('div');
    indicator.id = 'absd-offline-indicator';
    indicator.className = 'absd-data-offline';
    indicator.innerHTML = `
      <span>📡 Sin conexión - Los cambios se sincronizarán cuando vuelva la conexión</span>
    `;

    document.body.insertBefore(indicator, document.body.firstChild);
  }

  /**
   * Hide offline indicator
   */
  hideOfflineIndicator() {
    const indicator = document.getElementById('absd-offline-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Handle offline status
   */
  handleOffline() {
    this.showOfflineIndicator();
  }

  /**
   * Handle errors with user-friendly messages
   */
  handleError(error, container) {
    if (!container) {return;}

    const element = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!element) {return;}

    element.innerHTML = `
      <div class="absd-data-error">
        <h3 class="text-lg font-semibold mb-2">¿Qué pasó?</h3>
        <p class="mb-4">${this.getErrorMessage(error)}</p>
        <h4 class="font-semibold mb-2">Cómo resolver:</h4>
        <ul class="list-disc list-inside space-y-1">
          ${this.getErrorResolution(error)}
        </ul>
      </div>
    `;
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error) {
    if (!navigator.onLine) {
      return 'No hay conexión a Internet';
    }

    if (error.message.includes('404')) {
      return 'No se encontraron los datos solicitados';
    }

    if (error.message.includes('500')) {
      return 'Hubo un problema con el servidor';
    }

    return 'Ocurrió un error al cargar los datos';
  }

  /**
   * Get error resolution steps
   */
  getErrorResolution(error) {
    if (!navigator.onLine) {
      return `
        <li>Verifique su conexión a Internet</li>
        <li>Los datos se cargarán automáticamente cuando vuelva la conexión</li>
      `;
    }

    if (error.message.includes('404')) {
      return `
        <li>Verifique que los datos existan</li>
        <li>Intente recargar la página</li>
      `;
    }

    return `
      <li>Intente recargar la página</li>
      <li>Si el problema persiste, contacte al soporte</li>
    `;
  }

  /**
   * Generate cache key
   */
  getCacheKey(url, options) {
    return `${url}_${JSON.stringify(options.params || {})}`;
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      offlineQueueLength: this.offlineQueue.length,
      isOnline: navigator.onLine
    };
  }
};

// ============================================
// VIRTUALIZATION FOR LARGE DATASETS
// ============================================

ABSD.VirtualScroller = class {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    this.options = {
      itemHeight: 50,
      buffer: 5,
      threshold: 50,
      renderItem: () => '<div>Item</div>',
      ...options
    };

    this.items = [];
    this.visibleRange = { start: 0, end: 0 };
    this.scrollTop = 0;
    this.boundHandleScroll = null;

    this.init();
  }

  init() {
    if (!this.container) {return;}

    // Setup container styles
    if (!this.container.dataset.originalOverflow) {
      this.container.dataset.originalOverflow = this.container.style.overflow || '';
    }
    if (!this.container.dataset.originalPosition) {
      this.container.dataset.originalPosition = this.container.style.position || '';
    }

    this.container.style.overflow = 'auto';
    if (!this.container.style.position || this.container.style.position === 'static') {
      this.container.style.position = 'relative';
    }

    // Create viewport
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'relative';
    this.container.appendChild(this.viewport);

    // Setup scroll listener
    this.boundHandleScroll = this.handleScroll.bind(this);
    this.container.addEventListener('scroll', this.boundHandleScroll);
  }

  /**
   * Set items for virtual scrolling
   */
  setItems(items) {
    this.items = items;

    // Only virtualize if over threshold
    if (items.length > this.options.threshold) {
      this.enableVirtualization();
    } else {
      this.renderAllItems();
    }
  }

  /**
   * Enable virtualization for large datasets
   */
  enableVirtualization() {
    // Calculate total height
    const totalHeight = this.items.length * this.options.itemHeight;
    this.viewport.style.height = `${totalHeight}px`;

    // Initial render
    this.updateVisibleItems();
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    requestAnimationFrame(() => this.updateVisibleItems());
  }

  /**
   * Update visible items based on scroll position
   */
  updateVisibleItems() {
    const containerHeight = this.container.clientHeight;
    const start = Math.floor(this.scrollTop / this.options.itemHeight) - this.options.buffer;
    const end = Math.ceil((this.scrollTop + containerHeight) / this.options.itemHeight) + this.options.buffer;

    const newStart = Math.max(0, start);
    const newEnd = Math.min(this.items.length, end);

    // Only update if range changed
    if (newStart !== this.visibleRange.start || newEnd !== this.visibleRange.end) {
      this.visibleRange = { start: newStart, end: newEnd };
      this.renderVisibleItems();
    }
  }

  /**
   * Render visible items
   */
  renderVisibleItems() {
    // Clear current items
    this.viewport.innerHTML = '';

    // Create container for visible items
    const fragment = document.createDocumentFragment();

    for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
      const item = this.items[i];
      const element = this.createItemElement(item, i);

      // Position item
      element.style.position = 'absolute';
      element.style.top = `${i * this.options.itemHeight}px`;
      element.style.left = '0';
      element.style.right = '0';
      element.style.height = `${this.options.itemHeight}px`;

      fragment.appendChild(element);
    }

    this.viewport.appendChild(fragment);
  }

  /**
   * Create item element
   */
  createItemElement(item, index) {
    const div = document.createElement('div');
    div.innerHTML = this.options.renderItem(item, index);
    return div.firstElementChild || div;
  }

  /**
   * Render all items (for small datasets)
   */
  renderAllItems() {
    this.viewport.innerHTML = this.items
      .map((item, index) => this.options.renderItem(item, index))
      .join('');
  }

  /**
   * Destroy virtual scroller instance
   */
  destroy() {
    if (!this.container) {return;}
    if (this.boundHandleScroll) {
      this.container.removeEventListener('scroll', this.boundHandleScroll);
    }
    if (this.viewport && this.viewport.parentNode === this.container) {
      this.container.removeChild(this.viewport);
    }
    const originalOverflow = this.container.dataset.originalOverflow ?? '';
    this.container.style.overflow = originalOverflow;

    if (this.container.dataset.originalPosition !== undefined) {
      this.container.style.position = this.container.dataset.originalPosition || '';
    }
    this.items = [];
    this.viewport = null;
    this.boundHandleScroll = null;
  }

  /**
   * Get visible items
   */
  getVisibleItems() {
    return this.items.slice(this.visibleRange.start, this.visibleRange.end);
  }
};

// Initialize global pipeline instance
ABSD.pipeline = new ABSD.DataPipeline();