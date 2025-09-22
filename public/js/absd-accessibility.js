/**
 * ABSD Accessibility Module - WCAG AA+ Compliance
 * Anthony Bir System Designs (ABSD) Studio
 * Implements BIRHAUS principle: Accessibility = Dignity
 */

'use strict';

window.ABSD = window.ABSD || {};

// ============================================
// ACCESSIBILITY MANAGER
// ============================================

ABSD.AccessibilityManager = class {
  constructor() {
    this.focusTrapStack = [];
    this.announcer = null;
    this.shortcuts = new Map();
    this.skipLinks = [];
    this.focusableElements = 'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])';

    this.init();
  }

  init() {
    // Create screen reader announcer
    this.createAnnouncer();

    // Setup skip navigation
    this.setupSkipNavigation();

    // Initialize keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Monitor focus for accessibility
    this.setupFocusMonitoring();

    // Setup live regions
    this.setupLiveRegions();

    // Handle reduced motion
    this.handleReducedMotion();
  }

  // ============================================
  // SCREEN READER ANNOUNCEMENTS
  // ============================================

  /**
   * Create screen reader announcer element
   */
  createAnnouncer() {
    this.announcer = document.createElement('div');
    this.announcer.className = 'sr-only';
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.setAttribute('role', 'status');
    document.body.appendChild(this.announcer);

    // Create assertive announcer for urgent messages
    this.urgentAnnouncer = document.createElement('div');
    this.urgentAnnouncer.className = 'sr-only';
    this.urgentAnnouncer.setAttribute('aria-live', 'assertive');
    this.urgentAnnouncer.setAttribute('aria-atomic', 'true');
    this.urgentAnnouncer.setAttribute('role', 'alert');
    document.body.appendChild(this.urgentAnnouncer);
  }

  /**
   * Announce message to screen readers
   */
  announce(message, urgent = false) {
    const announcer = urgent ? this.urgentAnnouncer : this.announcer;

    // Clear and set new message
    announcer.textContent = '';

    // Use setTimeout to ensure screen readers pick up the change
    setTimeout(() => {
      announcer.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }, 100);

    // Log for debugging
    ABSD.Core.logAction('accessibility_announcement', { message, urgent });
  }

  // ============================================
  // FOCUS TRAP FOR MODALS
  // ============================================

  /**
   * Create focus trap for modal dialogs
   */
  createFocusTrap(element) {
    const focusableContent = element.querySelectorAll(this.focusableElements);
    const firstFocusable = focusableContent[0];
    const lastFocusable = focusableContent[focusableContent.length - 1];

    const trap = {
      element,
      firstFocusable,
      lastFocusable,
      previousFocus: document.activeElement,
      handleKeyDown: (e) => this.handleTrapKeyDown(e, trap),
      handleFocusIn: (e) => this.handleTrapFocusIn(e, trap)
    };

    // Add event listeners
    element.addEventListener('keydown', trap.handleKeyDown);
    document.addEventListener('focusin', trap.handleFocusIn);

    // Store trap
    this.focusTrapStack.push(trap);

    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Set ARIA attributes
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');

    // Announce modal opened
    const label = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
    if (label) {
      this.announce(`Diálogo abierto: ${label}`, true);
    }

    return trap;
  }

  /**
   * Handle keyboard events in focus trap
   */
  handleTrapKeyDown(e, trap) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === trap.firstFocusable) {
          trap.lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === trap.lastFocusable) {
          trap.firstFocusable.focus();
          e.preventDefault();
        }
      }
    } else if (e.key === 'Escape') {
      this.releaseFocusTrap(trap.element);
    }
  }

  /**
   * Handle focus events in trap
   */
  handleTrapFocusIn(e, trap) {
    if (!trap.element.contains(e.target)) {
      e.stopPropagation();
      trap.firstFocusable.focus();
    }
  }

  /**
   * Release focus trap
   */
  releaseFocusTrap(element) {
    const trapIndex = this.focusTrapStack.findIndex(t => t.element === element);
    if (trapIndex === -1) {return;}

    const trap = this.focusTrapStack[trapIndex];

    // Remove event listeners
    element.removeEventListener('keydown', trap.handleKeyDown);
    document.removeEventListener('focusin', trap.handleFocusIn);

    // Remove from stack
    this.focusTrapStack.splice(trapIndex, 1);

    // Restore focus
    if (trap.previousFocus && trap.previousFocus.focus) {
      trap.previousFocus.focus();
    }

    // Remove ARIA attributes
    element.removeAttribute('aria-modal');

    // Announce modal closed
    this.announce('Diálogo cerrado');
  }

  // ============================================
  // SKIP NAVIGATION
  // ============================================

  /**
   * Setup skip navigation links
   */
  setupSkipNavigation() {
    // Create skip links container
    const skipNav = document.createElement('nav');
    skipNav.className = 'absd-skip-nav sr-only focus-within:not-sr-only';
    skipNav.setAttribute('aria-label', 'Enlaces de salto');

    // Define skip targets
    const skipTargets = [
      { href: '#main-content', text: 'Saltar al contenido principal' },
      { href: '#navigation', text: 'Saltar a navegación' },
      { href: '#search', text: 'Saltar a búsqueda' },
      { href: '#footer', text: 'Saltar al pie de página' }
    ];

    // Create skip links
    skipTargets.forEach(target => {
      const link = document.createElement('a');
      link.href = target.href;
      link.textContent = target.text;
      link.className = 'absd-skip-link';

      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetElement = document.querySelector(target.href);
        if (targetElement) {
          targetElement.tabIndex = -1;
          targetElement.focus();
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      skipNav.appendChild(link);
      this.skipLinks.push(link);
    });

    // Insert at beginning of body
    document.body.insertBefore(skipNav, document.body.firstChild);
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    // Define default shortcuts
    const defaultShortcuts = [
      { key: 'Alt+D', action: () => this.navigateTo('dashboard'), description: 'Ir al Dashboard' },
      { key: 'Alt+R', action: () => this.navigateTo('reports'), description: 'Ir a Reportes' },
      { key: 'Alt+I', action: () => this.navigateTo('churches'), description: 'Ir a Iglesias' },
      { key: 'Alt+N', action: () => this.openNewReport(), description: 'Nuevo reporte' },
      { key: 'Alt+S', action: () => this.focusSearch(), description: 'Buscar' },
      { key: 'Alt+H', action: () => this.showHelp(), description: 'Mostrar ayuda' },
      { key: 'Alt+/', action: () => this.showShortcuts(), description: 'Mostrar atajos' },
      { key: 'Escape', action: () => this.closeModal(), description: 'Cerrar modal' }
    ];

    // Register shortcuts
    defaultShortcuts.forEach(shortcut => {
      this.registerShortcut(shortcut.key, shortcut.action, shortcut.description);
    });

    // Listen for keyboard events
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e));
  }

  /**
   * Register keyboard shortcut
   */
  registerShortcut(key, action, description) {
    const normalizedKey = this.normalizeKey(key);
    this.shortcuts.set(normalizedKey, { action, description, key });
  }

  /**
   * Handle keyboard shortcut
   */
  handleKeyboardShortcut(e) {
    // Skip if in input field (unless it's Escape)
    if (e.key !== 'Escape') {
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }
    }

    const key = this.getKeyCombo(e);
    const shortcut = this.shortcuts.get(key);

    if (shortcut) {
      e.preventDefault();
      shortcut.action();
      this.announce(`Atajo activado: ${shortcut.description}`);
    }
  }

  /**
   * Normalize key combination
   */
  normalizeKey(key) {
    return key.toLowerCase()
      .replace('cmd', 'meta')
      .replace('command', 'meta')
      .replace('ctrl', 'control')
      .split('+')
      .sort()
      .join('+');
  }

  /**
   * Get key combination from event
   */
  getKeyCombo(e) {
    const keys = [];

    if (e.altKey) {keys.push('alt');}
    if (e.ctrlKey) {keys.push('control');}
    if (e.metaKey) {keys.push('meta');}
    if (e.shiftKey) {keys.push('shift');}

    keys.push(e.key.toLowerCase());

    return keys.sort().join('+');
  }

  /**
   * Show keyboard shortcuts help
   */
  showShortcuts() {
    const modal = document.createElement('div');
    modal.className = 'absd-shortcuts-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Atajos de teclado');

    const content = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md">
        <h2 class="text-xl font-bold mb-4">Atajos de Teclado</h2>
        <dl class="space-y-2">
          ${Array.from(this.shortcuts.entries()).map(([, shortcut]) => `
            <div class="flex justify-between">
              <dt class="font-medium">${shortcut.key}</dt>
              <dd class="text-gray-600">${shortcut.description}</dd>
            </div>
          `).join('')}
        </dl>
        <button onclick="ABSD.a11y.closeModal()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
          Cerrar
        </button>
      </div>
    `;

    modal.innerHTML = content;
    document.body.appendChild(modal);

    this.createFocusTrap(modal);
  }

  // ============================================
  // LIVE REGIONS
  // ============================================

  /**
   * Setup live regions for dynamic content
   */
  setupLiveRegions() {
    // Find all elements that should be live regions
    const liveElements = document.querySelectorAll('[data-live-region]');

    liveElements.forEach(element => {
      const type = element.dataset.liveRegion || 'polite';
      element.setAttribute('aria-live', type);
      element.setAttribute('aria-relevant', 'additions text');

      // Monitor for changes
      this.observeLiveRegion(element);
    });
  }

  /**
   * Observe live region for changes
   */
  observeLiveRegion(element) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const text = element.textContent.trim();
          if (text) {
            this.announce(text, element.getAttribute('aria-live') === 'assertive');
          }
        }
      });
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  // ============================================
  // FOCUS MANAGEMENT
  // ============================================

  /**
   * Setup focus monitoring
   */
  setupFocusMonitoring() {
    // Add focus visible polyfill
    this.setupFocusVisible();

    // Monitor focus changes for better accessibility
    document.addEventListener('focusin', (e) => {
      const element = e.target;

      // Add focus indicator class
      element.classList.add('absd-focus');

      // Ensure focus is visible
      this.ensureFocusVisible(element);

      // Announce form field labels
      if (element.matches('input, select, textarea')) {
        const label = this.getFieldLabel(element);
        if (label) {
          this.announce(label);
        }
      }
    });

    document.addEventListener('focusout', (e) => {
      e.target.classList.remove('absd-focus');
    });
  }

  /**
   * Setup focus visible polyfill
   */
  setupFocusVisible() {
    // Check if browser supports :focus-visible
    try {
      document.querySelector(':focus-visible');
    } catch {
      // Add polyfill
      document.addEventListener('keydown', () => {
        document.body.classList.add('keyboard-nav');
      });

      document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-nav');
      });
    }
  }

  /**
   * Ensure element focus is visible
   */
  ensureFocusVisible(element) {
    const rect = element.getBoundingClientRect();
    const isVisible = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    if (!isVisible) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Get field label
   */
  getFieldLabel(element) {
    // Check for aria-label
    if (element.hasAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // Check for aria-labelledby
    if (element.hasAttribute('aria-labelledby')) {
      const labelElement = document.getElementById(element.getAttribute('aria-labelledby'));
      if (labelElement) {
        return labelElement.textContent;
      }
    }

    // Check for associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent;
      }
    }

    // Check for parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent;
    }

    return null;
  }

  // ============================================
  // REDUCED MOTION
  // ============================================

  /**
   * Handle reduced motion preference
   */
  handleReducedMotion() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateMotion = (e) => {
      if (e.matches) {
        document.body.classList.add('reduce-motion');
        ABSD.preferences?.set('reducedMotion', true);
      } else {
        document.body.classList.remove('reduce-motion');
        ABSD.preferences?.set('reducedMotion', false);
      }
    };

    // Check initial state
    updateMotion(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', updateMotion);
  }

  // ============================================
  // NAVIGATION HELPERS
  // ============================================

  navigateTo(tab) {
    if (typeof window.showTab === 'function') {
      window.showTab(tab);
    }
  }

  openNewReport() {
    if (typeof window.openManualReportModal === 'function') {
      window.openManualReportModal();
    }
  }

  focusSearch() {
    const searchInput = document.querySelector('[type="search"], [role="search"] input');
    if (searchInput) {
      searchInput.focus();
      this.announce('Campo de búsqueda enfocado');
    }
  }

  showHelp() {
    this.announce('Ayuda no disponible actualmente');
  }

  closeModal() {
    const modal = document.querySelector('[role="dialog"]');
    if (modal && this.focusTrapStack.length > 0) {
      this.releaseFocusTrap(modal);
      modal.remove();
    }
  }
};

// Initialize accessibility manager
ABSD.a11y = new ABSD.AccessibilityManager();

// ============================================
// UTILITY STYLES FOR ACCESSIBILITY
// ============================================

const accessibilityStyles = `
  .sr-only:not(:focus):not(:active) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .absd-skip-nav {
    position: fixed;
    top: -100px;
    left: 0;
    background: white;
    padding: 1rem;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  .absd-skip-nav:focus-within {
    top: 0;
  }

  .absd-skip-link {
    display: inline-block;
    padding: 0.5rem 1rem;
    margin: 0.25rem;
    background: var(--ultra-blue);
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
  }

  .absd-skip-link:focus {
    outline: 3px solid var(--ultra-green);
    outline-offset: 2px;
  }

  .absd-focus {
    outline: 3px solid var(--ultra-blue);
    outline-offset: 2px;
  }

  body.keyboard-nav *:focus {
    outline: 3px solid var(--ultra-blue);
    outline-offset: 2px;
  }

  body:not(.keyboard-nav) *:focus {
    outline: none;
  }

  .reduce-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .absd-shortcuts-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
`;

// Inject styles
const styleEl = document.createElement('style');
styleEl.textContent = accessibilityStyles;
document.head.appendChild(styleEl);