require('dotenv').config();
const app = require('./app');
const { ensureDatabaseReady } = require('./bootstrap');

const PORT = process.env.PORT || 4000;

ensureDatabaseReady()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database: ${process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zomato'}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
