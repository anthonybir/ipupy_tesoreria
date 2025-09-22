# ABSD Developer Quick Start Guide
## Get Up and Running in 5 Minutes

### Prerequisites
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- Node.js 18+ (for development server)
- Basic understanding of HTML/JavaScript

---

## 🚀 Quick Start

### 1. Clone and Setup (30 seconds)
```bash
git clone [repository-url]
cd IPUPY_Tesoreria
npm install
```

### 2. Start Development Server (10 seconds)
```bash
npm run dev
# Open http://localhost:3000
```

### 3. Your First ABSD Component (2 minutes)

Create a new file `my-dashboard.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mi Dashboard ABSD</title>

    <!-- ABSD Core -->
    <link rel="stylesheet" href="/css/absd-tokens.css">
    <script src="/js/absd-components.js"></script>
    <script src="/js/absd-data-pipeline.js"></script>
    <script src="/js/absd-state-manager.js"></script>
    <!-- Accessibility helper removed September 22, 2025 -->
</head>
<body class="theme-light density-normal">

    <!-- Container -->
    <div class="absd-container">
        <header>
            <h1>Mi Dashboard</h1>
        </header>

        <main id="main" class="absd-grid">
            <!-- Metric Cards -->
            <div class="absd-span-narrow" data-skeleton-type="metric">
                <div class="bg-white p-6 rounded-lg shadow">
                    <p class="text-sm text-gray-600">Total</p>
                    <p id="total" class="text-2xl font-bold">Loading...</p>
                </div>
            </div>

            <!-- Data Table -->
            <div class="absd-span-wide" data-skeleton-type="table">
                <div id="data-table" class="bg-white p-6 rounded-lg shadow">
                    <!-- Will be populated -->
                </div>
            </div>
        </main>
    </div>

    <script>
        // Initialize ABSD
        document.addEventListener('DOMContentLoaded', async () => {
            // Load data with progressive enhancement
            const data = await ABSD.pipeline.fetch('/api/dashboard', {
                container: 'data-table'
            });

            // Update metrics
            document.getElementById('total').textContent =
                ABSD.Core.formatCurrency(data.total);

            // Accessibility announcer removed September 22, 2025
        });
    </script>
</body>
</html>
```

---

> ⚠️ **Heads up:** The ABSD runtime is shipping incrementally. Dashboard KPIs already use the pipeline and skeletons, but other tables/forms still rely on legacy markup. Treat the examples below as the target pattern rather than a guarantee of current production behavior.

## 📚 Core Concepts (2 minute read)

### 1. Grid System
Replace complex Tailwind classes with semantic ABSD classes:

```html
<!-- ❌ Old Way -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">

<!-- ✅ ABSD Way -->
<div class="absd-grid">
    <div class="absd-span-narrow">Sidebar</div>
    <div class="absd-span-wide">Content</div>
</div>
```

### 2. Progressive Loading
Never show blank screens - use skeleton states:

> **Current status:** The pipeline drives dashboard KPIs today. Wrap additional tables in your feature branches to expand coverage.

```javascript
// ❌ Old Way
const data = await fetch('/api/data');
element.innerHTML = renderData(data);

// ✅ ABSD Way
const data = await ABSD.pipeline.fetch('/api/data', {
    container: 'element-id',
    skeletonType: 'table'
});
// Skeleton shows automatically, then real data
```

### 3. State Management
Persist everything important:

```javascript
// Save user preferences
ABSD.preferences.toggleTheme();  // Auto-persists

// Save form data
ABSD.state.set('form.field', value);  // Survives refresh

// React to changes
ABSD.state.subscribe('form.*', (data) => {
    console.log('Form changed:', data);
});
```

### 4. Accessibility Built-in (Removed September 22, 2025)
The prior accessibility helpers (screen reader announcements, modal focus traps, and keyboard shortcut registry) were removed from the ABSD runtime. Implement any required accessibility behaviour directly in your feature code or adopt an alternative utility library.

---

## 🏗️ Common Patterns

### Loading Data
```javascript
async function loadDashboard() {
    // Show skeleton
    ABSD.pipeline.showSkeleton('dashboard');

    try {
        // Fetch with offline support
        const data = await ABSD.pipeline.fetch('/api/dashboard');

        // Update UI
        updateDashboard(data);

        // Accessibility announcer removed September 22, 2025
    } catch (error) {
        // Errors handled automatically (offline queue)
    }
}
```

### Creating Forms
```html
<form id="report-form" class="absd-form-grid">
    <div class="absd-form-row">
        <label for="amount">Amount</label>
        <input type="number" id="amount" required>
    </div>

    <button type="submit">Submit</button>
</form>

<script>
// Auto-save drafts
document.getElementById('report-form').addEventListener('input', (e) => {
    ABSD.state.set('draft', new FormData(e.target));
});

// Restore on reload
const draft = ABSD.state.get('draft');
if (draft) {
    // Restore form fields
}
</script>
```

### Virtual Scrolling for Large Lists
```javascript
// Automatically virtualizes if > 50 items
if (items.length > 50) {
    const scroller = new ABSD.VirtualScroller('container', {
        itemHeight: 60,
        renderItem: (item) => `<div>${item.name}</div>`
    });
    scroller.setItems(items);
}
```

### Responsive Charts
> **Current status:** The chart helper is available, but existing pages still instantiate Chart.js directly. Use this pattern when you touch chart code.

```javascript
const chart = ABSD.Charts.createChart('canvas-id', 'bar', {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{
        label: 'Revenue',
        data: [1000, 1500, 2000]
    }]
}, {
    isCurrency: true,  // Formats as currency
    title: 'Monthly Revenue'
});

// Theme changes automatically handled
```

---

## 🎯 Do's and Don'ts

### ✅ DO's
- Use semantic ABSD classes
- Show skeleton states during loading
- Save important state
- Test with keyboard only
- Handle offline scenarios

### ❌ DON'Ts
- Don't use inline styles
- Don't forget ARIA labels
- Don't block on network requests
- Don't ignore error states
- Don't disable focus outlines

---

## 🛠️ Debugging

### Enable Debug Mode
```javascript
// In console
localStorage.setItem('ABSD_DEBUG', 'true');
location.reload();

// Now see detailed logs
ABSD.Core.logAction('test', {data: 'value'});
```

### Check State
```javascript
// View current state
console.log(ABSD.state.export());

// View preferences
console.log(ABSD.preferences.export());

// View cache stats
console.log(ABSD.pipeline.getCacheStats());
```

### Test Offline
```javascript
// Simulate offline
window.dispatchEvent(new Event('offline'));

// Actions now queue automatically
await ABSD.pipeline.fetch('/api/data');  // Queued

// Go back online
window.dispatchEvent(new Event('online'));
// Queue processes automatically
```

---

## 📦 Module Reference

### Files to Include
```html
<!-- Required Core -->
<link rel="stylesheet" href="/css/absd-tokens.css">
<script src="/js/absd-components.js"></script>

<!-- Optional Based on Needs -->
<script src="/js/absd-data-pipeline.js"></script>  <!-- For API calls -->
<script src="/js/absd-state-manager.js"></script>   <!-- For persistence -->
<script src="/js/absd-charts.js"></script>          <!-- For charts -->
<!-- Accessibility helper removed September 22, 2025 -->
```

### Global Objects Available
```javascript
window.ABSD = {
    Core,           // Utilities
    pipeline,       // Data fetching
    state,          // State management
    preferences,    // User preferences
    Charts          // Chart configuration
    // Accessibility helper removed September 22, 2025
};
```

---

## 🚢 Production Checklist

Before deploying:

- [ ] Verify offline functionality
- [ ] Check skeleton states appear
- [ ] Test on mobile devices
- [ ] Check theme switching
- [ ] Re-evaluate accessibility coverage once a replacement module is defined
- [ ] Verify Spanish translations
- [ ] Test slow network (throttle to 3G)
- [ ] Check error states

---

## 📖 Examples

### Complete Page Template
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ABSD Template</title>

    <!-- ABSD Stack -->
    <link rel="stylesheet" href="/css/absd-tokens.css">
    <script src="/js/absd-components.js"></script>
    <script src="/js/absd-data-pipeline.js"></script>
    <script src="/js/absd-state-manager.js"></script>
    <script src="/js/absd-charts.js"></script>
    <!-- Accessibility helper removed September 22, 2025 -->
</head>
<body class="theme-light density-normal absd-disclosure-basic">

    <!-- Header -->
    <header class="gradient-bg text-white">
        <div class="absd-container py-4">
            <h1>My Application</h1>
        </div>
    </header>

    <!-- Navigation -->
    <nav id="nav" class="bg-white shadow">
        <div class="absd-container">
            <div class="absd-grid">
                <a href="#dashboard" class="absd-span-narrow">Dashboard</a>
                <a href="#reports" class="absd-span-narrow">Reports</a>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main id="main" class="absd-container py-6">
        <div class="absd-grid">
            <!-- Metrics -->
            <section class="absd-span-full" aria-label="Metrics">
                <div class="absd-grid" id="metrics">
                    <!-- Metric cards -->
                </div>
            </section>

            <!-- Data -->
            <section class="absd-span-wide" aria-label="Data">
                <div id="data-container" data-skeleton-type="table">
                    <!-- Table or list -->
                </div>
            </section>

            <!-- Sidebar -->
            <aside class="absd-span-narrow">
                <!-- Filters, actions -->
            </aside>
        </div>
    </main>

    <script>
        // Initialize your app
        class App {
            constructor() {
                this.init();
            }

            async init() {
                // Setup state
                this.setupState();

                // Load data
                await this.loadData();

                // Setup interactions
                this.setupInteractions();

                // Accessibility announcer removed September 22, 2025
            }

            setupState() {
                // Subscribe to state changes
                ABSD.state.subscribe('filters.*', (filters) => {
                    this.applyFilters(filters);
                });
            }

            async loadData() {
                const data = await ABSD.pipeline.fetch('/api/data', {
                    container: 'data-container'
                });

                this.renderData(data);
            }

            renderData(data) {
                // Render with virtualization if needed
                const container = document.getElementById('data-container');

                if (data.length > 50) {
                    new ABSD.VirtualScroller(container, {
                        itemHeight: 60,
                        renderItem: (item) => this.renderItem(item)
                    }).setItems(data);
                } else {
                    container.innerHTML = data.map(item =>
                        this.renderItem(item)
                    ).join('');
                }
            }

            renderItem(item) {
                return `
                    <div class="p-4 border-b">
                        <h3>${item.title}</h3>
                        <p>${ABSD.Core.formatCurrency(item.amount)}</p>
                    </div>
                `;
            }

            setupInteractions() {
                // Accessibility shortcut helpers removed September 22, 2025
            }

            async refresh() {
                await this.loadData();
                // Accessibility announcer removed September 22, 2025
            }

            applyFilters(filters) {
                // Apply and reload
                this.loadData();
            }
        }

        // Start app when ready
        document.addEventListener('DOMContentLoaded', () => {
            window.app = new App();
        });
    </script>
</body>
</html>
```

---

## 🆘 Need Help?

### Documentation
- [Complete Documentation](./ABSD_COMPLETE_DOCUMENTATION.md)
- [Implementation Progress](./ABSD_IMPLEMENTATION_PROGRESS.md)
- [Design System](./ABSD_DESIGN_SYSTEM.md)

### Common Solutions

**Q: Skeleton not showing?**
A: Add `data-skeleton-type` attribute:
```html
<div data-skeleton-type="table"></div>
```

**Q: State not persisting?**
A: Check localStorage:
```javascript
console.log(localStorage);
ABSD.state.export();  // See current state
```

**Q: Charts not theming?**
A: Update after theme change:
```javascript
ABSD.Charts.updateChartTheme(chart);
```

**Q: Focus trap not working?**
A: Need focusable elements:
```html
<div role="dialog">
    <button>Must have focusable element</button>
</div>
```

---

## 🎉 That's It!

You now know everything needed to build with ABSD. Remember:

1. **Grid**: Use semantic classes
2. **Loading**: Show skeletons
3. **State**: Persist everything
4. **Offline**: It just works
5. **A11y**: Built into everything

Start building and enjoy the ABSD experience!

---

*Quick Start Guide v1.0*
*© 2024 ABSD Studio*