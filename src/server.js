const express = require('express');
const cors = require('cors');
const path = require('path');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const app = express();
const PORT = process.env.PORT || 3000;

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
// Consolidated endpoints
registerApiRoute('/api/financial', '../api/financial.js');
registerApiRoute('/api/data', '../api/data.js');

// Regular endpoints
registerApiRoute('/api/churches', './api/churches.js');
registerApiRoute('/api/dashboard', './api/dashboard.js');
registerApiRoute('/api/auth', '../api/auth.js');
registerApiRoute('/api/reports/recent', './api/reports-recent.js');
registerApiRoute('/api/reports', './api/reports.js');
registerApiRoute('/api/reports-enhanced', './api/reports-enhanced.js');
registerApiRoute('/api/worship-records', './api/worship-records.js');
registerApiRoute('/api/expense-records', './api/expense-records.js');
registerApiRoute('/api/church-accounts', './api/church-accounts.js');
registerApiRoute('/api/church-transaction-categories', './api/church-transaction-categories.js');
registerApiRoute('/api/fund-movements', './api/fund-movements.js');
registerApiRoute('/api/national-treasury-overview', './api/national-treasury-overview.js');
registerApiRoute('/api/analytics', './api/analytics.js');
registerApiRoute('/api/families', './api/families.js');
app.all('/api/families/:id/members', createApiHandler('./api/families/members.js'));
registerApiRoute('/api/members', './api/members.js');
app.all('/api/members/:id', createApiHandler('./api/members/[id].js'));

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
