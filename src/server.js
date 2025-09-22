const express = require('express');
const cors = require('cors');
const path = require('path');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Validate environment configuration before starting
const EnvironmentValidator = require('./lib/env-validator');
EnvironmentValidator.validateOrExit();

// Import rate limiting middleware
const { generalLimiter, authLimiter, financialLimiter, rateLimiter } = require('./lib/rate-limiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Apply general rate limiting to all routes
app.use('/api/', generalLimiter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/test', (_req, res) => {
  res.json({
    message: 'ABSD Treasury API is running',
    timestamp: new Date().toISOString(),
    status: 'online'
  });
});

// Rate limiter monitoring endpoint (for administrators)
app.get('/api/rate-limiter/stats', (_req, res) => {
  const stats = rateLimiter.getStats();
  res.json({
    message: 'Rate limiter statistics',
    stats,
    timestamp: new Date().toISOString()
  });
});

const createApiHandler = (relativePath) => {
  const fileUrl = pathToFileURL(path.resolve(__dirname, relativePath)).href;
  return async (req, res, next) => {
    try {
      const mod = await import(fileUrl);
      const handler = mod.default || mod;
      return handler(req, res);
    } catch (error) {
      next(error);
    }
  };
};

const registerApiRoute = (route, filePath) => {
  app.all(route, createApiHandler(filePath));
};

registerApiRoute('/api/db-test', '../tests/api/db-test.js');

// Authentication endpoints (strict rate limiting)
app.all('/api/auth', authLimiter, createApiHandler('../api/auth.js'));

// Dashboard initialization endpoint (moderate rate limiting for initial load)
app.all('/api/dashboard-init', financialLimiter, createApiHandler('../api/dashboard-init.js'));

// Financial endpoints (moderate rate limiting)
app.all('/api/financial', financialLimiter, createApiHandler('../api/financial.js'));
app.all('/api/reports', financialLimiter, createApiHandler('../api/reports.js'));
app.all('/api/fund-movements', financialLimiter, createApiHandler('../api/fund-movements.js'));

// New donor and ledger management endpoints (moderate rate limiting)
app.all('/api/donors/search', financialLimiter, createApiHandler('../api/donors.js'));
app.all('/api/donors/:id/summary', financialLimiter, createApiHandler('../api/donors.js'));
app.all('/api/donors/:id', financialLimiter, createApiHandler('../api/donors.js'));
app.all('/api/donors', financialLimiter, createApiHandler('../api/donors.js'));
app.all('/api/worship-records', financialLimiter, createApiHandler('../api/worship-records.js'));
app.all('/api/accounting', financialLimiter, createApiHandler('../api/accounting.js'));
// Legacy routes redirect to accounting API
app.all('/api/expense-records', financialLimiter, createApiHandler('../api/accounting.js'));
app.all('/api/monthly-ledger/close', financialLimiter, createApiHandler('../api/accounting.js'));
app.all('/api/monthly-ledger', financialLimiter, createApiHandler('../api/accounting.js'));

// General endpoints (already covered by general limiter)
registerApiRoute('/api/data', '../api/data.js');
registerApiRoute('/api/churches', '../api/churches.js');
registerApiRoute('/api/dashboard', '../api/dashboard.js');
registerApiRoute('/api/people', '../api/people.js');
// Legacy routes redirect to people API
registerApiRoute('/api/families', '../api/people.js');
registerApiRoute('/api/members', '../api/people.js');

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`🚀 ABSD Treasury System running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
});
