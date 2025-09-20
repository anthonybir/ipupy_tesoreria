/**
 * ABSD Localization Framework - Spanish/Guaraní (ES/GN)
 * Anthony Bir System Designs (ABSD) Studio
 *
 * Cultural Code-Switching Principle:
 * "Embrace the mezcolanza - Natural bilingual support"
 *
 * Paraguay has two official languages:
 * - Spanish (ES): Official business language
 * - Guaraní (GN): Indigenous language, widely spoken
 */

'use strict';

// ABSD Localization Namespace
window.ABSD = window.ABSD || {};

ABSD.Locale = {
  // Current active language
  currentLang: 'es',

  // Available languages
  languages: ['es', 'gn'],

  // Translations database
  translations: {
    // ============================================
    // SPANISH (ES) - Primary Business Language
    // ============================================
    es: {
      // App metadata
      app: {
        title: 'IPU PY - Sistema de Tesorería Nacional',
        subtitle: 'Iglesia Pentecostal Unida del Paraguay',
        version: 'ABSD v1.0'
      },

      // Navigation and UI
      nav: {
        dashboard: 'Dashboard',
        new_report: 'Nuevo Informe',
        churches: 'Iglesias',
        reports: 'Reportes',
        settings: 'Configuración'
      },

      // Fund categories (9 official funds)
      funds: {
        general: 'Fondo General',
        caballeros: 'Caballeros',
        misiones: 'Misiones',
        apy: 'APY (Asociación de Pastores Jóvenes)',
        lazos: 'Lazos de Amor',
        mision_posible: 'Misión Posible',
        ninos: 'Niños',
        iba: 'IBA (Instituto Bíblico de las Asambleas)',
        damas: 'Damas'
      },

      // Financial terms
      finance: {
        // Basic terms
        amount: 'Monto',
        total: 'Total',
        balance: 'Saldo',
        currency: 'Guaraníes',
        currency_symbol: '₲',

        // Income types
        tithes: 'Diezmos',
        offerings: 'Ofrendas',
        annexes: 'Anexos',
        donations: 'Donaciones',
        special_offerings: 'Ofrendas Especiales',

        // Expense types
        pastoral_fees: 'Honorarios Pastorales',
        utilities: 'Servicios Públicos',
        electricity: 'Energía Eléctrica (ANDE)',
        water: 'Agua (ESSAP)',
        garbage: 'Recolección de Basura',
        operational: 'Gastos Operativos',

        // Tax terms (Paraguay-specific)
        iva: 'IVA',
        iva_10: 'IVA 10%',
        iva_5: 'IVA 5%',
        exempt: 'Exenta',
        tax_included: 'IVA Incluido',
        tax_excluded: 'IVA Excluido',

        // Banking
        deposit: 'Depósito',
        deposit_slip: 'Boleta de Depósito',
        bank_receipt: 'Comprobante Bancario',
        account_number: 'Número de Cuenta',
        deposit_date: 'Fecha de Depósito'
      },

      // Reports and forms
      reports: {
        monthly_report: 'Informe Mensual',
        financial_summary: 'Resumen Financiero',
        income_summary: 'Resumen de Entradas',
        expense_summary: 'Resumen de Salidas',
        worship_record: 'Registro de Culto Individual',
        national_fund: 'Fondo Nacional (10%)',
        pending_reports: 'Informes Pendientes',

        // Form fields
        church: 'Iglesia (Filial)',
        pastor: 'Pastor',
        month: 'Mes',
        year: 'Año',
        date: 'Fecha',
        observations: 'Observaciones',
        attachments: 'Adjuntos'
      },

      // Status and actions
      status: {
        online: 'En línea',
        offline: 'Sin conexión',
        syncing: 'Sincronizando',
        saved: 'Guardado',
        pending: 'Pendiente',
        completed: 'Completado',
        error: 'Error',
        loading: 'Cargando...'
      },

      // Actions
      actions: {
        save: 'Guardar',
        edit: 'Editar',
        delete: 'Eliminar',
        cancel: 'Cancelar',
        submit: 'Enviar',
        clear: 'Limpiar',
        export: 'Exportar',
        import: 'Importar',
        print: 'Imprimir',
        search: 'Buscar',
        filter: 'Filtrar',
        calculate: 'Calcular'
      },

      // Messages
      messages: {
        save_success: 'Informe guardado exitosamente',
        save_error: 'Error al guardar el informe',
        required_field: 'Este campo es obligatorio',
        invalid_amount: 'Monto inválido',
        confirm_delete: '¿Está seguro de eliminar este registro?',
        no_data: 'No hay datos disponibles',
        loading_data: 'Cargando datos...',
        offline_mode: 'Modo offline activo - Los datos se sincronizarán cuando regrese la conexión'
      },

      // Months
      months: {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
      },

      // Progressive disclosure
      disclosure: {
        basic: 'Básico',
        intermediate: 'Intermedio',
        advanced: 'Avanzado',
        show_more: 'Mostrar más opciones',
        show_less: 'Mostrar menos opciones',
        expert_mode: 'Modo experto'
      }
    },

    // ============================================
    // GUARANÍ (GN) - Indigenous Language
    // ============================================
    gn: {
      // App metadata
      app: {
        title: 'IPU PY - Viru Ñemboaty Retã',
        subtitle: 'Iglesia Pentecostal Unida Paraguay',
        version: 'ABSD v1.0'
      },

      // Navigation and UI
      nav: {
        dashboard: 'Ñemboaty',
        new_report: 'Marandu Pyahu',
        churches: 'Tupã Óga',
        reports: 'Marandu',
        settings: 'Ñemoambue'
      },

      // Fund categories (mixing Spanish for official names + Guaraní descriptions)
      funds: {
        general: 'Fondo General (Tuichavéva)',
        caballeros: 'Caballeros (Kuimba\'e)',
        misiones: 'Misiones (Ñe\'ẽmondo)',
        apy: 'APY (Pyhare Pyahu)',
        lazos: 'Lazos de Amor (Mborayhu)',
        mision_posible: 'Misión Posible (Ikatúva)',
        ninos: 'Niños (Mitã)',
        iba: 'IBA (Mbo\'esyry)',
        damas: 'Damas (Kuña)'
      },

      // Financial terms
      finance: {
        // Basic terms
        amount: 'Viru',
        total: 'Opavavete',
        balance: 'Oĩva',
        currency: 'Guaraní',
        currency_symbol: '₲',

        // Income types
        tithes: 'Diezmo (Umi Viru Pa)',
        offerings: 'Ofrenda (Mborayhu Viru)',
        annexes: 'Anexo',
        donations: 'Poropytyvõ',
        special_offerings: 'Ofrenda Especial',

        // Expense types
        pastoral_fees: 'Pyhare Tepyme',
        utilities: 'Mba\'apo Ñepyrũ',
        electricity: 'Aranduguy (ANDE)',
        water: 'Y (ESSAP)',
        garbage: 'Mba\'esarai Ñemyenyhẽ',
        operational: 'Mba\'apo Tepyme',

        // Tax terms
        iva: 'IVA',
        iva_10: 'IVA 10%',
        iva_5: 'IVA 5%',
        exempt: 'Rei\'ỹva',
        tax_included: 'IVA Oĩ Hague',
        tax_excluded: 'IVA Ỹre',

        // Banking
        deposit: 'Ñemboguapy',
        deposit_slip: 'Kuatia Ñemboguapy',
        bank_receipt: 'Viru Róga Kuatia',
        account_number: 'Mba\'eguasu Papapy',
        deposit_date: 'Ára Ñemboguapy'
      },

      // Reports and forms
      reports: {
        monthly_report: 'Jasy Marandu',
        financial_summary: 'Viru Ñemboaty',
        income_summary: 'Jeguerupa Marandu',
        expense_summary: 'Jehepyme Marandu',
        worship_record: 'Ñembo\'e Ñepyrũ',
        national_fund: 'Tetã Viru (10%)',
        pending_reports: 'Marandu Oiméva',

        // Form fields
        church: 'Tupã Óga',
        pastor: 'Pyhare',
        month: 'Jasy',
        year: 'Ary',
        date: 'Ára',
        observations: 'Ñehechauka',
        attachments: 'Mba\'e Ojuehe'
      },

      // Status and actions
      status: {
        online: 'Jeikeva',
        offline: 'Jeike\'ỹ',
        syncing: 'Ñembojuehe',
        saved: 'Ñeñongatu',
        pending: 'Oha\'arõva',
        completed: 'Opávama',
        error: 'Javy',
        loading: 'Henyhẽ...'
      },

      // Actions
      actions: {
        save: 'Ñeñongatu',
        edit: 'Ñemoambue',
        delete: 'Mbogue',
        cancel: 'Ñepyrũ',
        submit: 'Mondo',
        clear: 'Mopotĩ',
        export: 'Guenohẽ',
        import: 'Guenoty',
        print: 'Ñehai',
        search: 'Heka',
        filter: 'Mohenda',
        calculate: 'Japapa'
      },

      // Messages
      messages: {
        save_success: 'Marandu ñeñongatu porãma',
        save_error: 'Javy ñeñongatu jave',
        required_field: 'Ko ñu\'ã tekotevẽ',
        invalid_amount: 'Viru nei porãi',
        confirm_delete: 'Emboguese kóva?',
        no_data: 'Ndaipóri mba\'ekuaarã',
        loading_data: 'Henyhẽ mba\'ekuaarã...',
        offline_mode: 'Jeike\'ỹ reko - Mba\'ekuaarã ñembojuehe jeikévo jey'
      },

      // Months
      months: {
        1: 'Jasyteĩ', 2: 'Jasymokõi', 3: 'Jasyapy', 4: 'Jasyrundy',
        5: 'Jasypo', 6: 'Jasypoteĩ', 7: 'Jasypokõi', 8: 'Jasypohapy',
        9: 'Jasyporundy', 10: 'Jasypa', 11: 'Jasypateĩ', 12: 'Jasypakõi'
      },

      // Progressive disclosure
      disclosure: {
        basic: 'Ñepyrũha',
        intermediate: 'Mbytegua',
        advanced: 'Katupyry',
        show_more: 'Ehechaukave',
        show_less: 'Ehechauka\'ive',
        expert_mode: 'Katupyry Reko'
      }
    }
  },

  // ============================================
  // CORE LOCALIZATION METHODS
  // ============================================

  /**
   * Initialize localization system
   */
  init() {
    // Detect language from:
    // 1. localStorage preference
    // 2. document.documentElement.lang
    // 3. navigator.language
    // 4. default to Spanish

    const storedLang = localStorage.getItem('absd_language');
    const htmlLang = document.documentElement.lang;
    const browserLang = navigator.language.split('-')[0];

    this.currentLang = storedLang ||
                      (this.languages.includes(htmlLang) ? htmlLang : null) ||
                      (this.languages.includes(browserLang) ? browserLang : null) ||
                      'es';

    this.setLanguage(this.currentLang);
    this.createLanguageSwitch();

    ABSD.Core.logAction('localization_init', { language: this.currentLang });
  },

  /**
   * Get translation for a key
   */
  t(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to Spanish if key not found in current language
        if (this.currentLang !== 'es') {
          return this.t(key, defaultValue, 'es');
        }
        return defaultValue || key;
      }
    }

    return value;
  },

  /**
   * Get translation with forced language
   */
  tLang(key, lang, defaultValue = null) {
    const originalLang = this.currentLang;
    this.currentLang = lang;
    const result = this.t(key, defaultValue);
    this.currentLang = originalLang;
    return result;
  },

  /**
   * Set active language
   */
  setLanguage(lang) {
    if (!this.languages.includes(lang)) {return;}

    this.currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.className =
      document.documentElement.className.replace(/absd-lang-\w+/g, '') + ` absd-lang-${lang}`;

    // Store preference
    localStorage.setItem('absd_language', lang);

    // Update all translatable elements
    this.updateTranslatableElements();

    // Fire language change event
    document.dispatchEvent(new CustomEvent('languagechange', {
      detail: { language: lang, locale: this }
    }));

    ABSD.Core.logAction('language_change', { from: localStorage.getItem('absd_prev_language'), to: lang });
    localStorage.setItem('absd_prev_language', lang);
  },

  /**
   * Update all elements with data-translate attribute
   */
  updateTranslatableElements() {
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const attribute = element.getAttribute('data-translate-attr') || 'textContent';

      const translation = this.t(key);

      if (attribute === 'textContent') {
        element.textContent = translation;
      } else {
        element.setAttribute(attribute, translation);
      }
    });
  },

  /**
   * Create language switcher UI
   */
  createLanguageSwitch() {
    const switcher = document.createElement('div');
    switcher.className = 'absd-language-switcher';
    switcher.innerHTML = `
      <button class="absd-lang-btn ${this.currentLang === 'es' ? 'active' : ''}" data-lang="es">
        🇪🇸 Español
      </button>
      <button class="absd-lang-btn ${this.currentLang === 'gn' ? 'active' : ''}" data-lang="gn">
        🇵🇾 Guaraní
      </button>
    `;

    // Add event listeners
    switcher.querySelectorAll('.absd-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        this.setLanguage(lang);

        // Update button states
        switcher.querySelectorAll('.absd-lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Add to header or specified container
    const container = document.querySelector('[data-language-switcher]') ||
                     document.querySelector('.header-content') ||
                     document.body;
    container.appendChild(switcher);
  },

  /**
   * Format currency with localization
   */
  formatCurrency(amount, showDecimals = false) {
    const symbol = this.t('finance.currency_symbol');

    // Use Paraguayan number format (dots for thousands, commas for decimals)
    const formatter = new Intl.NumberFormat('es-PY', {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0
    });

    return `${symbol} ${formatter.format(amount)}`;
  },

  /**
   * Format date with localization
   */
  formatDate(date, format = 'short') {
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat(this.currentLang === 'gn' ? 'es-PY' : 'es-PY', {
      dateStyle: format
    });

    return formatter.format(d);
  },

  /**
   * Get month name
   */
  getMonthName(monthNumber) {
    return this.t(`months.${monthNumber}`);
  },

  /**
   * Cultural Code-Switching helper
   * Mix languages naturally for common business terms
   */
  mixedTerm(spanishKey, guaraniKey, context = 'business') {
    if (context === 'business' || this.currentLang === 'es') {
      return this.t(spanishKey);
    } else {
      const guarani = this.t(guaraniKey);
      const spanish = this.tLang(spanishKey, 'es');

      // Return mixed format: "Guaraní (Spanish)"
      return `${guarani} (${spanish})`;
    }
  }
};

// ============================================
// AUTO-INITIALIZATION
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ABSD.Locale.init());
} else {
  ABSD.Locale.init();
}

// Export for manual initialization
window.ABSD = window.ABSD || {};
window.ABSD.Locale = ABSD.Locale;

// Convenience global function
window.t = function(key, defaultValue) {
  return ABSD.Locale.t(key, defaultValue);
};