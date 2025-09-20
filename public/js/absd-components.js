/**
 * ABSD Component Library - IPU PY Treasury System
 * Anthony Bir System Designs (ABSD) Studio
 * "Build like you're serving 10,000, design like you're serving family."
 *
 * Progressive disclosure, fund management, and Paraguay-specific components
 */

'use strict';

// ABSD Namespace
window.ABSD = window.ABSD || {};

// ============================================
// CORE ABSD PRINCIPLES & UTILITIES
// ============================================

ABSD.Core = {
  /**
   * Conversational Architecture - Make code readable
   */
  createElement(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);
    if (className) {element.className = className;}
    if (innerHTML) {element.innerHTML = innerHTML;}
    return element;
  },

  /**
   * Paraguayan Pragmatism - Handle offline gracefully
   */
  isOnline() {
    return navigator.onLine;
  },

  /**
   * Data Dignity - Format currency with respect (Enhanced)
   */
  formatCurrency(amount, showDecimals = false) {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {return '₲ 0';}

    const formatter = new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0
    });

    // Enhanced formatting with proper Paraguayan thousand separators
    let formatted = formatter.format(Math.abs(amount));
    formatted = formatted.replace('PYG', '₲').replace(/\s+/g, ' ');

    // Handle negative values with proper spacing
    if (amount < 0) {
      return `-${formatted}`;
    }

    return formatted;
  },

  /**
   * Enhanced number formatting for large amounts
   */
  formatLargeNumber(amount, compact = false) {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {return '₲ 0';}

    if (compact && Math.abs(amount) >= 1000000) {
      const millions = amount / 1000000;
      return `₲ ${millions.toFixed(1)}M`;
    } else if (compact && Math.abs(amount) >= 1000) {
      const thousands = amount / 1000;
      return `₲ ${thousands.toFixed(0)}K`;
    }

    return this.formatCurrency(amount);
  },

  /**
   * Defensive Optimism - Expect success, prepare for chaos
   */
  safeExecute(fn, fallback = () => {}) {
    try {
      return fn();
    } catch (error) {
      console.warn('ABSD Safe Execute caught error:', error);
      return fallback();
    }
  },

  /**
   * Institutional Memory - Log important actions
   */
  logAction(action, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, action, data };

    // Store in localStorage for audit trail
    const logs = JSON.parse(localStorage.getItem('absd_audit_log') || '[]');
    logs.push(logEntry);

    // Keep only last 1000 entries
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    localStorage.setItem('absd_audit_log', JSON.stringify(logs));
    console.log('ABSD Action:', logEntry);
  }
};

// ============================================
// PROGRESSIVE DISCLOSURE COMPONENT
// ============================================

ABSD.ProgressiveDisclosure = class {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = {
      startLevel: 'basic',
      levels: ['basic', 'intermediate', 'advanced'],
      transition: 'smooth',
      rememberLevel: true,
      ...options
    };

    this.currentLevel = this.options.rememberLevel
      ? localStorage.getItem('absd_disclosure_level') || this.options.startLevel
      : this.options.startLevel;

    this.init();
  }

  init() {
    this.container.classList.add('absd-progressive-disclosure');
    this.setLevel(this.currentLevel);
    this.createLevelIndicator();
  }

  setLevel(level) {
    if (!this.options.levels.includes(level)) {return;}

    this.currentLevel = level;
    this.container.className = this.container.className
      .replace(/absd-disclosure-\w+/g, '')
      + ` absd-disclosure-${level}`;

    if (this.options.rememberLevel) {
      localStorage.setItem('absd_disclosure_level', level);
    }

    // Fire custom event
    this.container.dispatchEvent(new CustomEvent('levelchange', {
      detail: { level, component: this }
    }));

    ABSD.Core.logAction('progressive_disclosure_change', { level });
  }

  nextLevel() {
    const currentIndex = this.options.levels.indexOf(this.currentLevel);
    if (currentIndex < this.options.levels.length - 1) {
      this.setLevel(this.options.levels[currentIndex + 1]);
    }
  }

  previousLevel() {
    const currentIndex = this.options.levels.indexOf(this.currentLevel);
    if (currentIndex > 0) {
      this.setLevel(this.options.levels[currentIndex - 1]);
    }
  }

  createLevelIndicator() {
    const indicator = ABSD.Core.createElement('div', 'absd-level-indicator');

    this.options.levels.forEach(level => {
      const button = ABSD.Core.createElement('button',
        `absd-level-button ${level === this.currentLevel ? 'active' : ''}`,
        this.getLevelLabel(level)
      );

      button.addEventListener('click', () => this.setLevel(level));
      indicator.appendChild(button);
    });

    this.container.appendChild(indicator);
  }

  getLevelLabel(level) {
    const labels = {
      basic: '🟢 Básico',
      intermediate: '🟡 Intermedio',
      advanced: '🔴 Avanzado'
    };
    return labels[level] || level;
  }
};

// ============================================
// FUND SELECTOR COMPONENT
// ============================================

ABSD.FundSelector = class {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = {
      multiple: false,
      showColors: true,
      showBalances: false,
      progressiveDisclosure: true,
      ...options
    };

    this.funds = [
      {
        id: 1,
        name: 'General',
        color: 'var(--fund-general)',
        key: 'general',
        description: 'Fondo principal de la iglesia para gastos operativos, mantenimiento y actividades generales.',
        purpose: 'Operaciones generales de la iglesia'
      },
      {
        id: 2,
        name: 'Caballeros',
        color: 'var(--fund-caballeros)',
        key: 'caballeros',
        description: 'Fondo del ministerio de caballeros para eventos, actividades masculinas y proyectos específicos.',
        purpose: 'Ministerio de hombres y actividades masculinas'
      },
      {
        id: 3,
        name: 'Misiones',
        color: 'var(--fund-misiones)',
        key: 'misiones',
        description: 'Fondo dedicado a la obra misionera nacional e internacional, evangelización y plantación de iglesias.',
        purpose: 'Evangelización y obra misionera'
      },
      {
        id: 4,
        name: 'APY',
        color: 'var(--fund-apy)',
        key: 'apy',
        description: 'Fondo de la Asamblea Pentecostal de la Juventud para actividades juveniles, campamentos y programas.',
        purpose: 'Ministerio juvenil y actividades para jóvenes'
      },
      {
        id: 5,
        name: 'Lazos de Amor',
        color: 'var(--fund-lazos)',
        key: 'lazos',
        description: 'Fondo para obras de caridad, ayuda social, asistencia a necesitados y proyectos comunitarios.',
        purpose: 'Obras de caridad y asistencia social'
      },
      {
        id: 6,
        name: 'Misión Posible',
        color: 'var(--fund-mision-posible)',
        key: 'mision_posible',
        description: 'Fondo para proyectos especiales, construcciones, equipamiento y iniciativas de crecimiento.',
        purpose: 'Proyectos especiales y construcciones'
      },
      {
        id: 7,
        name: 'Niños',
        color: 'var(--fund-ninos)',
        key: 'ninos',
        description: 'Fondo del ministerio infantil para escuela dominical, materiales educativos y actividades para niños.',
        purpose: 'Ministerio infantil y educación'
      },
      {
        id: 8,
        name: 'IBA',
        color: 'var(--fund-iba)',
        key: 'iba',
        description: 'Fondo del Instituto Bíblico Apostólico para educación teológica, becas y formación ministerial.',
        purpose: 'Educación teológica y formación ministerial'
      },
      {
        id: 9,
        name: 'Damas',
        color: 'var(--fund-damas)',
        key: 'damas',
        description: 'Fondo del ministerio femenino para actividades, eventos y proyectos del departamento de damas.',
        purpose: 'Ministerio femenino y actividades de damas'
      }
    ];

    this.selectedFunds = [];
    this.init();
  }

  init() {
    this.container.classList.add('absd-fund-selector');
    this.render();

    if (this.options.progressiveDisclosure) {
      this.setupProgressiveDisclosure();
    }
  }

  render() {
    this.container.innerHTML = '';

    const visibleFunds = this.getVisibleFunds();

    visibleFunds.forEach(fund => {
      const fundElement = this.createFundElement(fund);
      this.container.appendChild(fundElement);
    });
  }

  createFundElement(fund) {
    const element = ABSD.Core.createElement('div', 'absd-fund-item');

    // Add tooltip functionality
    element.title = fund.description || fund.purpose;
    element.dataset.tooltip = fund.description;
    element.setAttribute('aria-label', `${fund.name}: ${fund.purpose}`);

    const colorIndicator = ABSD.Core.createElement('div', 'absd-fund-color');
    colorIndicator.style.backgroundColor = fund.color;

    const label = ABSD.Core.createElement('label', 'absd-fund-label', fund.name);

    // Add info icon for enhanced tooltip
    const infoIcon = ABSD.Core.createElement('span', 'absd-fund-info-icon', '?');
    infoIcon.setAttribute('aria-hidden', 'true');
    infoIcon.onclick = (e) => {
      e.stopPropagation();
      this.showFundTooltip(fund, e.target);
    };

    const input = ABSD.Core.createElement('input');
    input.type = this.options.multiple ? 'checkbox' : 'radio';
    input.name = this.options.multiple ? 'funds[]' : 'fund';
    input.value = fund.id;
    input.dataset.fundKey = fund.key;

    input.addEventListener('change', () => this.handleSelectionChange(fund, input.checked));

    element.appendChild(colorIndicator);
    element.appendChild(input);
    element.appendChild(label);
    element.appendChild(infoIcon);

    if (this.options.showBalances && fund.balance !== undefined) {
      const balance = ABSD.Core.createElement('span', 'absd-fund-balance',
        ABSD.Core.formatCurrency(fund.balance)
      );
      element.appendChild(balance);
    }

    return element;
  }

  showFundTooltip(fund, triggerElement) {
    // Remove existing tooltips
    document.querySelectorAll('.absd-fund-tooltip').forEach(tip => tip.remove());

    const tooltip = ABSD.Core.createElement('div', 'absd-fund-tooltip');
    tooltip.innerHTML = `
      <div class="absd-tooltip-header" style="border-left: 4px solid ${fund.color};">
        <strong>${fund.name}</strong>
      </div>
      <div class="absd-tooltip-content">
        <p class="absd-tooltip-purpose">${fund.purpose}</p>
        <p class="absd-tooltip-description">${fund.description}</p>
      </div>
      <div class="absd-tooltip-arrow"></div>
    `;

    // Position tooltip
    const rect = triggerElement.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = (rect.top - 10) + 'px';
    tooltip.style.left = (rect.right + 10) + 'px';
    tooltip.style.zIndex = 'var(--z-tooltip)';

    document.body.appendChild(tooltip);

    // Auto-hide after 5 seconds or on outside click
    const hideTooltip = () => tooltip.remove();
    setTimeout(hideTooltip, 5000);
    document.addEventListener('click', hideTooltip, { once: true });
  }

  getVisibleFunds() {
    if (!this.options.progressiveDisclosure) {
      return this.funds;
    }

    const level = this.getDisclosureLevel();
    const fundCounts = { basic: 1, intermediate: 5, advanced: 9 };

    return this.funds.slice(0, fundCounts[level] || 9);
  }

  getDisclosureLevel() {
    const container = this.container.closest('.absd-progressive-disclosure');
    if (!container) {return 'advanced';}

    if (container.classList.contains('absd-disclosure-basic')) {return 'basic';}
    if (container.classList.contains('absd-disclosure-intermediate')) {return 'intermediate';}
    return 'advanced';
  }

  setupProgressiveDisclosure() {
    const container = this.container.closest('.absd-progressive-disclosure');
    if (container) {
      container.addEventListener('levelchange', () => {
        this.render();
      });
    }
  }

  handleSelectionChange(fund, isSelected) {
    if (this.options.multiple) {
      if (isSelected) {
        this.selectedFunds.push(fund);
      } else {
        this.selectedFunds = this.selectedFunds.filter(f => f.id !== fund.id);
      }
    } else {
      this.selectedFunds = isSelected ? [fund] : [];
    }

    // Fire custom event
    this.container.dispatchEvent(new CustomEvent('fundchange', {
      detail: { selectedFunds: this.selectedFunds, fund, isSelected }
    }));

    ABSD.Core.logAction('fund_selection_change', {
      fundId: fund.id,
      fundName: fund.name,
      isSelected
    });
  }

  getSelectedFunds() {
    return this.selectedFunds;
  }

  setSelectedFunds(fundIds) {
    this.selectedFunds = this.funds.filter(fund => fundIds.includes(fund.id));
    this.render();
  }
};

// ============================================
// IVA CALCULATOR COMPONENT
// ============================================

ABSD.IvaCalculator = class {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = {
      rates: [0, 5, 10], // IVA rates available in Paraguay
      defaultRate: 10,
      showBreakdown: true,
      autoCalculate: true,
      ...options
    };

    this.amount = 0;
    this.rate = this.options.defaultRate;
    this.init();
  }

  init() {
    this.container.classList.add('absd-iva-calculator');
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="absd-iva-form">
        <div class="absd-form-group">
          <label>Monto Base (sin IVA)</label>
          <input type="number" class="absd-amount-input" placeholder="0" value="${this.amount}">
        </div>

        <div class="absd-form-group">
          <label>Tipo de IVA</label>
          <div class="absd-iva-rates">
            ${this.options.rates.map(rate => `
              <label class="absd-iva-rate ${rate === this.rate ? 'selected' : ''}">
                <input type="radio" name="iva_rate" value="${rate}" ${rate === this.rate ? 'checked' : ''}>
                <span class="absd-rate-label">${rate === 0 ? 'Exenta' : `IVA ${rate}%`}</span>
              </label>
            `).join('')}
          </div>
        </div>

        ${this.options.showBreakdown ? this.renderBreakdown() : ''}
      </div>
    `;

    this.attachEventListeners();
    if (this.options.autoCalculate) {
      this.calculate();
    }
  }

  renderBreakdown() {
    const ivaAmount = this.calculateIva();
    const total = this.amount + ivaAmount;

    return `
      <div class="absd-iva-breakdown">
        <div class="absd-breakdown-item">
          <span>Monto Base:</span>
          <span class="absd-amount">${ABSD.Core.formatCurrency(this.amount)}</span>
        </div>
        <div class="absd-breakdown-item">
          <span>IVA (${this.rate}%):</span>
          <span class="absd-amount">${ABSD.Core.formatCurrency(ivaAmount)}</span>
        </div>
        <div class="absd-breakdown-item absd-total">
          <span><strong>Total:</strong></span>
          <span class="absd-amount"><strong>${ABSD.Core.formatCurrency(total)}</strong></span>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const amountInput = this.container.querySelector('.absd-amount-input');
    const rateInputs = this.container.querySelectorAll('input[name="iva_rate"]');

    amountInput.addEventListener('input', (e) => {
      this.amount = parseFloat(e.target.value) || 0;
      if (this.options.autoCalculate) {this.calculate();}
    });

    rateInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.rate = parseInt(e.target.value);
        this.updateRateSelection();
        if (this.options.autoCalculate) {this.calculate();}
      });
    });
  }

  updateRateSelection() {
    this.container.querySelectorAll('.absd-iva-rate').forEach(label => {
      label.classList.remove('selected');
    });

    const selectedInput = this.container.querySelector(`input[name="iva_rate"][value="${this.rate}"]`);
    if (selectedInput) {
      selectedInput.closest('.absd-iva-rate').classList.add('selected');
    }
  }

  calculateIva() {
    return this.amount * (this.rate / 100);
  }

  calculate() {
    if (this.options.showBreakdown) {
      const breakdown = this.container.querySelector('.absd-iva-breakdown');
      if (breakdown) {
        breakdown.innerHTML = this.renderBreakdown().match(/<div class="absd-iva-breakdown">(.*?)<\/div>/s)[1];
      }
    }

    const result = {
      baseAmount: this.amount,
      ivaRate: this.rate,
      ivaAmount: this.calculateIva(),
      total: this.amount + this.calculateIva()
    };

    // Fire custom event
    this.container.dispatchEvent(new CustomEvent('ivacalculated', {
      detail: result
    }));

    return result;
  }

  setAmount(amount) {
    this.amount = amount;
    const input = this.container.querySelector('.absd-amount-input');
    if (input) {input.value = amount;}
    if (this.options.autoCalculate) {this.calculate();}
  }

  setRate(rate) {
    if (this.options.rates.includes(rate)) {
      this.rate = rate;
      const input = this.container.querySelector(`input[name="iva_rate"][value="${rate}"]`);
      if (input) {
        input.checked = true;
        this.updateRateSelection();
      }
      if (this.options.autoCalculate) {this.calculate();}
    }
  }
};

// ============================================
// OFFLINE STATUS INDICATOR
// ============================================

ABSD.OfflineIndicator = class {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = {
      showDetails: true,
      autoHide: false,
      position: 'top-right',
      ...options
    };

    this.isOnline = navigator.onLine;
    this.init();
  }

  init() {
    this.container.classList.add('absd-offline-indicator', this.options.position);
    this.render();
    this.attachEventListeners();
  }

  render() {
    const status = this.isOnline ? 'online' : 'offline';
    const icon = this.isOnline ? '🟢' : '🔴';
    const label = this.isOnline ? 'En línea' : 'Sin conexión';

    this.container.innerHTML = `
      <div class="absd-status-indicator ${status}">
        <span class="absd-status-icon">${icon}</span>
        <span class="absd-status-label">${label}</span>
        ${this.options.showDetails ? this.renderDetails() : ''}
      </div>
    `;

    // Auto-hide when online
    if (this.options.autoHide && this.isOnline) {
      setTimeout(() => {
        this.container.style.opacity = '0.5';
      }, 3000);
    }
  }

  renderDetails() {
    if (this.isOnline) {
      return '<div class="absd-status-details">Datos sincronizados</div>';
    } else {
      const pendingCount = this.getPendingOperationsCount();
      return `
        <div class="absd-status-details">
          Modo offline activo
          ${pendingCount > 0 ? `<br>${pendingCount} operaciones pendientes` : ''}
        </div>
      `;
    }
  }

  attachEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.render();
      ABSD.Core.logAction('connection_restored');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.render();
      ABSD.Core.logAction('connection_lost');
    });
  }

  getPendingOperationsCount() {
    // This would integrate with the offline storage system
    const pending = JSON.parse(localStorage.getItem('absd_pending_operations') || '[]');
    return pending.length;
  }
};

// ============================================
// CURRENCY FORMATTER & INPUT COMPONENT
// ============================================

ABSD.CurrencyInput = class {
  constructor(input, options = {}) {
    this.input = typeof input === 'string' ? document.getElementById(input) : input;
    this.options = {
      currency: 'PYG',
      locale: 'es-PY',
      symbol: '₲',
      showDecimals: false,
      allowNegative: false,
      ...options
    };

    this.value = 0;
    this.init();
  }

  init() {
    this.input.classList.add('absd-currency-input');
    this.input.type = 'text';
    this.input.inputMode = 'numeric';

    this.attachEventListeners();
    this.formatDisplay();
  }

  attachEventListeners() {
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('focus', () => this.handleFocus());
    this.input.addEventListener('blur', () => this.handleBlur());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleInput(e) {
    let value = e.target.value;

    // Remove all non-numeric characters except decimal separator
    value = value.replace(/[^\d.,]/g, '');

    // Handle Paraguayan number format (. for thousands, , for decimals)
    value = value.replace(/\./g, '').replace(/,/g, '.');

    this.value = parseFloat(value) || 0;

    // Fire custom event
    this.input.dispatchEvent(new CustomEvent('currencychange', {
      detail: { value: this.value, formattedValue: this.getFormattedValue() }
    }));
  }

  handleFocus() {
    // Show raw number for editing
    this.input.value = this.value === 0 ? '' : this.value.toString();
  }

  handleBlur() {
    this.formatDisplay();
  }

  handleKeydown(e) {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].includes(e.keyCode) ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && (e.ctrlKey || e.metaKey)) ||
        // Allow: home, end, left, right, down, up
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }

    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  }

  formatDisplay() {
    this.input.value = this.getFormattedValue();
  }

  getFormattedValue() {
    return ABSD.Core.formatCurrency(this.value, this.options.showDecimals);
  }

  setValue(value) {
    this.value = parseFloat(value) || 0;
    this.formatDisplay();
  }

  getValue() {
    return this.value;
  }
};

// ============================================
// SPARKLINE COMPONENT FOR TREND VISUALIZATION
// ============================================

ABSD.Sparkline = class {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = {
      width: 60,
      height: 20,
      color: 'currentColor',
      strokeWidth: 2,
      showArea: true,
      ...options
    };

    this.data = options.data || [];
    this.init();
  }

  init() {
    this.container.classList.add('fund-sparkline');
    this.render();
  }

  render() {
    if (!this.data || this.data.length < 2) {
      this.container.innerHTML = '<span style="font-size: 10px; color: var(--absd-text-muted);">Sin datos</span>';
      return;
    }

    const { width, height, strokeWidth, color, showArea } = this.options;
    const max = Math.max(...this.data);
    const min = Math.min(...this.data);
    const range = max - min;

    if (range === 0) {
      this.container.innerHTML = '<span style="font-size: 10px; color: var(--absd-text-muted);">Sin cambios</span>';
      return;
    }

    const points = this.data.map((value, index) => {
      const x = (index / (this.data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = showArea ?
      `0,${height} ${points} ${width},${height}` :
      points;

    const trend = this.data[this.data.length - 1] > this.data[0] ? 'positive' :
      this.data[this.data.length - 1] < this.data[0] ? 'negative' : 'neutral';

    this.container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="sparkline-svg ${trend}">
        ${showArea ? `<polygon points="${areaPoints}" class="sparkline-area" fill="${color}"/>` : ''}
        <polyline points="${points}" class="sparkline-path" stroke="${color}" stroke-width="${strokeWidth}" fill="none"/>
      </svg>
    `;
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  static generateSampleData(length = 12) {
    // Generate sample trending data for demonstration
    const data = [];
    let value = 1000000; // Start at 1M

    for (let i = 0; i < length; i++) {
      // Add some randomness and trend
      const trend = (Math.random() - 0.4) * 0.1;
      const noise = (Math.random() - 0.5) * 0.05;
      value = Math.max(0, value * (1 + trend + noise));
      data.push(Math.round(value));
    }

    return data;
  }
};

// ============================================
// FUND HEALTH CALCULATOR
// ============================================

ABSD.FundHealth = {
  calculateHealth(fund) {
    const { summary } = fund;
    if (!summary) {return 'neutral';}

    const balance = summary.saldo || 0;
    const movements = summary.movimientos || 0;
    const growth = summary.growth || 0;

    // Health scoring algorithm
    let score = 0;

    // Balance health (40% weight)
    if (balance > 0) {score += 40;}
    else if (balance > -50000) {score += 20;}
    else {score += 0;}

    // Activity health (30% weight)
    if (movements > 5) {score += 30;}
    else if (movements > 2) {score += 20;}
    else if (movements > 0) {score += 10;}

    // Growth health (30% weight)
    if (growth > 0.05) {score += 30;}
    else if (growth > -0.05) {score += 20;}
    else {score += 0;}

    // Determine health level
    if (score >= 80) {return 'positive';}
    else if (score >= 50) {return 'warning';}
    else {return 'negative';}
  },

  getHealthColor(health) {
    const colors = {
      positive: 'var(--absd-success)',
      warning: 'var(--absd-warning)',
      negative: 'var(--absd-error)',
      neutral: 'var(--absd-text-muted)'
    };
    return colors[health] || colors.neutral;
  },

  getHealthLabel(health) {
    const labels = {
      positive: 'Saludable',
      warning: 'Atención',
      negative: 'Crítico',
      neutral: 'Sin datos'
    };
    return labels[health] || labels.neutral;
  }
};

// ============================================
// INITIALIZATION AND AUTO-SETUP
// ============================================

ABSD.init = function() {
  // Auto-initialize components based on data attributes
  document.addEventListener('DOMContentLoaded', () => {
    // Progressive disclosure containers
    document.querySelectorAll('[data-absd-progressive]').forEach(container => {
      new ABSD.ProgressiveDisclosure(container);
    });

    // Fund selectors
    document.querySelectorAll('[data-absd-fund-selector]').forEach(container => {
      const options = JSON.parse(container.dataset.absdFundSelector || '{}');
      new ABSD.FundSelector(container, options);
    });

    // IVA calculators
    document.querySelectorAll('[data-absd-iva-calculator]').forEach(container => {
      const options = JSON.parse(container.dataset.absdIvaCalculator || '{}');
      new ABSD.IvaCalculator(container, options);
    });

    // Currency inputs
    document.querySelectorAll('[data-absd-currency]').forEach(input => {
      const options = JSON.parse(input.dataset.absdCurrency || '{}');
      new ABSD.CurrencyInput(input, options);
    });

    // Offline indicator
    const offlineContainer = document.querySelector('[data-absd-offline-indicator]');
    if (offlineContainer) {
      const options = JSON.parse(offlineContainer.dataset.absdOfflineIndicator || '{}');
      new ABSD.OfflineIndicator(offlineContainer, options);
    }

    ABSD.Core.logAction('absd_components_initialized');
  });
};

// Cultural Code-Switching - Auto-detect and setup
if (document.documentElement.lang === 'es' || document.documentElement.lang === 'gn') {
  ABSD.init();
}

// Export for manual initialization
window.ABSD = ABSD;