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
