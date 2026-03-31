const auth = require('./auth');

module.exports = (req, res, next) => {
  auth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    return next();
  });
};
