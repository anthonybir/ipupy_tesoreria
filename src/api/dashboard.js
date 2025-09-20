const supabaseDashboardHandler = require('./dashboard-supabase');

module.exports = async function handler(req, res) {
  return supabaseDashboardHandler(req, res);
};
