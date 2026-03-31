const app = require('../backend/src/app');

module.exports = (req, res) => {
	// Vercel catch-all can pass '/admin/...' for requests originally sent to '/api/admin/...'.
	// Normalize to '/api/...' so backend routes are resolved consistently.
	if (typeof req.url === 'string' && !req.url.startsWith('/api/')) {
		req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
	}

	return app(req, res);
};
