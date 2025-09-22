/**
 * ABSD Chart Configuration - Semantic Visual Language
 * Anthony Bir System Designs (ABSD) Studio
 * Implements BIRHAUS principles: Data Dignity, Typography as Hierarchy
 */

'use strict';

window.ABSD = window.ABSD || {};

// ============================================
// CHART THEMING WITH ABSD TOKENS
// ============================================

ABSD.ChartConfig = {
  /**
   * Get computed style values from CSS variables
   */
  getToken(tokenName) {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(tokenName).trim();
  },

  /**
   * Color palettes following ABSD semantic system
   */
  colors: {
    // Categorical colors for different data series
    categorical: [
      '#0066CC', // Ultra blue
      '#00AA00', // Ultra green
      '#FFC93B', // Prosperity yellow
      '#002556', // Authority navy
      '#6E6A7A', // Wisdom gray
      '#059669', // Success forest
      '#F59E0B', // Warning amber
      '#EF4444' // Error coral
    ],

    // Diverging colors for positive/negative values
    diverging: {
      positive: ['#00AA00', '#059669', '#10B981', '#34D399', '#6EE7B7'],
      negative: ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2'],
      neutral: ['#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6']
    },

    // Sequential colors for gradients
    sequential: {
      blue: ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#0066CC'],
      green: ['#D1FAE5', '#6EE7B7', '#34D399', '#10B981', '#059669', '#00AA00'],
      purple: ['#EDE9FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9']
    },

    // Threshold colors for status indicators
    thresholds: {
      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#00AA00',
      info: '#0EA5E9'
    }
  },

  /**
   * Typography configuration for charts
   */
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

    sizes: {
      title: 18,
      subtitle: 14,
      label: 12,
      tick: 11,
      legend: 11
    },

    weights: {
      title: 600,
      subtitle: 500,
      label: 400,
      tick: 400,
      legend: 400
    },

    colors: {
      primary: '#0A0A0A',   // Ultra black
      secondary: '#6B7280', // Ultra gray
      muted: '#9CA3AF'
    }
  },

  /**
   * Animation configuration
   */
  animation: {
    duration: 750,
    easing: 'easeInOutQuart',

    // Respect reduced motion preference
    getDuration() {
      const reducedMotion = ABSD.preferences?.get('reducedMotion') ||
                           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return reducedMotion ? 0 : this.duration;
    }
  },

  /**
   * Grid and layout configuration
   */
  layout: {
    padding: {
      top: 20,
      right: 20,
      bottom: 40,
      left: 60
    },

    responsive: true,
    maintainAspectRatio: false,

    grid: {
      display: true,
      color: 'rgba(0, 0, 0, 0.05)',
      borderDash: [2, 2],
      drawBorder: false,
      drawTicks: false
    }
  },

  /**
   * Create Chart.js configuration with ABSD defaults
   */
  createChartConfig(type, data, options = {}) {
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const density = document.body.classList.contains('density-compact') ? 'compact' : 'normal';

    const baseConfig = {
      type,
      data: this.processChartData(data, type),
      options: {
        responsive: this.layout.responsive,
        maintainAspectRatio: this.layout.maintainAspectRatio,

        animation: {
          duration: this.animation.getDuration(),
          easing: this.animation.easing
        },

        layout: {
          padding: density === 'compact' ? 10 : 20
        },

        plugins: {
          legend: {
            display: options.showLegend !== false,
            position: options.legendPosition || 'bottom',

            labels: {
              font: {
                family: this.typography.fontFamily,
                size: this.typography.sizes.legend,
                weight: this.typography.weights.legend
              },
              color: theme === 'dark' ? '#E2E8F0' : this.typography.colors.secondary,
              padding: density === 'compact' ? 8 : 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },

          title: {
            display: !!options.title,
            text: options.title,
            font: {
              family: this.typography.fontFamily,
              size: this.typography.sizes.title,
              weight: this.typography.weights.title
            },
            color: theme === 'dark' ? '#F3F4F6' : this.typography.colors.primary,
            padding: density === 'compact' ? 10 : 20
          },

          subtitle: {
            display: !!options.subtitle,
            text: options.subtitle,
            font: {
              family: this.typography.fontFamily,
              size: this.typography.sizes.subtitle,
              weight: this.typography.weights.subtitle
            },
            color: theme === 'dark' ? '#D1D5DB' : this.typography.colors.secondary
          },

          tooltip: {
            enabled: true,
            backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: theme === 'dark' ? '#F3F4F6' : this.typography.colors.primary,
            bodyColor: theme === 'dark' ? '#E2E8F0' : this.typography.colors.secondary,
            borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: density === 'compact' ? 8 : 12,
            displayColors: true,

            titleFont: {
              family: this.typography.fontFamily,
              size: this.typography.sizes.label,
              weight: this.typography.weights.label
            },

            bodyFont: {
              family: this.typography.fontFamily,
              size: this.typography.sizes.tick
            },

            callbacks: {
              // Format currency values
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  if (options.isCurrency) {
                    label += ABSD.Core.formatCurrency(context.parsed.y);
                  } else if (options.isPercentage) {
                    label += context.parsed.y.toFixed(1) + '%';
                  } else {
                    label += context.parsed.y.toLocaleString('es-PY');
                  }
                }
                return label;
              }
            }
          }
        },

        scales: this.createScales(type, options, theme)
      }
    };

    // Deep merge with custom options
    return this.deepMerge(baseConfig, options.customConfig || {});
  },

  /**
   * Process chart data with ABSD colors
   */
  processChartData(data, type) {
    if (!data.datasets) {return data;}

    data.datasets = data.datasets.map((dataset, index) => {
      // Apply ABSD colors if not specified
      if (!dataset.backgroundColor) {
        if (type === 'line') {
          dataset.borderColor = this.colors.categorical[index % this.colors.categorical.length];
          dataset.backgroundColor = this.colors.categorical[index % this.colors.categorical.length] + '20';
        } else {
          dataset.backgroundColor = this.colors.categorical[index % this.colors.categorical.length];
          dataset.borderColor = this.colors.categorical[index % this.colors.categorical.length];
        }
      }

      // Apply consistent styling
      return {
        ...dataset,
        borderWidth: dataset.borderWidth || 2,
        tension: dataset.tension || 0.4,
        fill: dataset.fill !== undefined ? dataset.fill : false
      };
    });

    return data;
  },

  /**
   * Create scale configuration
   */
  createScales(type, options, theme) {
    const scales = {};

    if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
      return scales;
    }

    // X-axis configuration
    scales.x = {
      display: true,
      grid: {
        ...this.layout.grid,
        color: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : this.layout.grid.color
      },
      ticks: {
        font: {
          family: this.typography.fontFamily,
          size: this.typography.sizes.tick
        },
        color: theme === 'dark' ? '#9CA3AF' : this.typography.colors.secondary
      }
    };

    // Y-axis configuration
    scales.y = {
      display: true,
      grid: {
        ...this.layout.grid,
        color: theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : this.layout.grid.color
      },
      ticks: {
        font: {
          family: this.typography.fontFamily,
          size: this.typography.sizes.tick
        },
        color: theme === 'dark' ? '#9CA3AF' : this.typography.colors.secondary,

        // Format based on data type
        callback: function(value) {
          if (options.isCurrency) {
            return ABSD.Core.formatCurrency(value, true);
          } else if (options.isPercentage) {
            return value + '%';
          } else {
            return value.toLocaleString('es-PY');
          }
        }
      }
    };

    return scales;
  },

  /**
   * Create accessible data table from chart
   */
  createAccessibleTable(chartData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {return;}

    const table = document.createElement('table');
    table.className = 'sr-only';
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Datos del gráfico en formato tabla');

    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Categoría</th>';

    chartData.datasets.forEach(dataset => {
      headerRow.innerHTML += `<th>${dataset.label}</th>`;
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');

    chartData.labels.forEach((label, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${label}</td>`;

      chartData.datasets.forEach(dataset => {
        const value = dataset.data[index];
        row.innerHTML += `<td>${value}</td>`;
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  },

  /**
   * Enable high contrast mode
   */
  enableHighContrast(chart) {
    const highContrastColors = [
      '#000000', // Black
      '#FFFFFF', // White
      '#FF0000', // Red
      '#00FF00', // Green
      '#0000FF', // Blue
      '#FFFF00', // Yellow
      '#FF00FF', // Magenta
      '#00FFFF'  // Cyan
    ];

    chart.data.datasets.forEach((dataset, index) => {
      dataset.borderColor = highContrastColors[index % highContrastColors.length];
      dataset.backgroundColor = highContrastColors[index % highContrastColors.length] + '40';
      dataset.borderWidth = 3;
    });

    chart.update();
  },

  /**
   * Export chart as image
   */
  exportChart(chart, filename = 'chart') {
    const url = chart.toBase64Image();
    const link = document.createElement('a');
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = url;
    link.click();
  },

  /**
   * Deep merge utility
   */
  deepMerge(target, source) {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  },

  /**
   * Initialize chart with ABSD configuration
   */
  createChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {return null;}

    // Destroy existing chart if it exists
    if (canvas.chart) {
      canvas.chart.destroy();
    }

    // Create new chart with ABSD config
    const config = this.createChartConfig(type, data, options);
    const chart = new window.Chart(canvas, config);

    // Store chart reference
    canvas.chart = chart;

    // Create accessible table
    if (options.createTable !== false) {
      this.createAccessibleTable(data, canvasId + '_table');
    }

    // Subscribe to theme changes
    if (ABSD.preferences) {
      ABSD.preferences.subscribe('theme', () => {
        this.updateChartTheme(chart);
      });
    }

    return chart;
  },

  /**
   * Update chart theme dynamically
   */
  updateChartTheme(chart) {
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';

    // Update colors based on theme
    const config = chart.config;

    // Update text colors
    if (config.options.plugins.legend) {
      config.options.plugins.legend.labels.color = theme === 'dark' ? '#E2E8F0' : this.typography.colors.secondary;
    }

    if (config.options.plugins.title) {
      config.options.plugins.title.color = theme === 'dark' ? '#F3F4F6' : this.typography.colors.primary;
    }

    // Update grid colors
    if (config.options.scales) {
      Object.values(config.options.scales).forEach(scale => {
        if (scale.grid) {
          scale.grid.color = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : this.layout.grid.color;
        }
        if (scale.ticks) {
          scale.ticks.color = theme === 'dark' ? '#9CA3AF' : this.typography.colors.secondary;
        }
      });
    }

    chart.update();
  }
};

// Export for use
window.ABSD.Charts = ABSD.ChartConfig;