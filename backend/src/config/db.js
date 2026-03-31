// Sequelize loads the Postgres driver dynamically. Requiring it here makes
// sure serverless bundlers like Vercel include the driver in the function.
require('pg');
require('pg-hstore');
const { Sequelize } = require('sequelize');

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/zomato';
const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const isLocalConnection = /(localhost|127\.0\.0\.1|@db:|zomato-db)/i.test(connectionString);

const dialectOptions = {
  connectTimeout: 60000
};

if (!isLocalConnection) {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false
  };
}

module.exports = new Sequelize(connectionString, {
  logging: false,
  dialectOptions
});
