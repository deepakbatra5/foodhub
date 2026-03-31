const app = require('../../backend/src/app');

module.exports = (req, res) => {
  // Ensure nested admin routes resolve to backend '/api/admin/*' handlers.
  if (typeof req.url === 'string' && !req.url.startsWith('/api/admin/')) {
    req.url = `/api/admin${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
};
