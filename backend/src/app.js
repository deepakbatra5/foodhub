require('dotenv').config();
const cors = require('cors');
const express = require('express');
const { ensureDatabaseReady } = require('./bootstrap');

const app = express();
app.set('etag', false);
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

function getAllowedOrigins() {
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.VERCEL_URL) {
    configuredOrigins.push(`https://${process.env.VERCEL_URL}`);
  }

  return configuredOrigins;
}

const allowedOrigins = getAllowedOrigins();
const vercelPreviewPattern = /^https:\/\/.*\.vercel\.app$/;
const localOriginPatterns = [
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/
];

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (vercelPreviewPattern.test(origin)) {
    return true;
  }

  return localOriginPatterns.some((pattern) => pattern.test(origin));
}

function handleHealthCheck(req, res) {
  ensureDatabaseReady()
    .then(() => {
      res.json({ status: 'ok' });
    })
    .catch((error) => {
      console.error('Health check failed:', error);
      res.status(503).json({ status: 'error', message: 'Database unavailable' });
    });
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json());

app.get('/healthz', handleHealthCheck);
app.get('/api/healthz', handleHealthCheck);

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api', (req, res, next) => {
  ensureDatabaseReady()
    .then(() => next())
    .catch(next);
});

app.post('/api/register', authRoutes.register);
app.post('/api/login', authRoutes.login);
app.post('/api/admin-login', adminRoutes.login);
app.use('/api/auth', authRoutes.router);
app.use('/api/admin', adminRoutes.router);

// Compatibility mounts for environments that strip the /api prefix before handing requests to Express.
app.post('/admin-login', adminRoutes.login);
app.use('/admin', adminRoutes.router);

app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/search', require('./routes/search'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/help', require('./routes/help'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat', require('./routes/chat'));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled application error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
