require('dotenv').config({
  path: process.env.ENV_PATH,
});

module.exports = {
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    pool: {
      min: 0,
      max: 10,
      acquire: 10,
      idle: 5,
    },
    seederStorage: 'sequelize',
  },
  local: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'local_base',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',

    pool: {
      min: 0,
      max: 10,
      acquire: 10,
      idle: 5,
    },
    seederStorage: 'sequelize',
  },
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',

    pool: {
      min: 0,
      max: 10,
      acquire: 30000,
      idle: 10000,
    },
    seederStorage: 'sequelize',
  },
  staging: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',

    pool: {
      min: 0,
      max: 10,
      acquire: 10,
      idle: 5,
    },
    seederStorage: 'sequelize',
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',

    pool: {
      min: 0,
      max: 10,
      acquire: 10,
      idle: 5,
    },
    seederStorage: 'sequelize',
  },
};
