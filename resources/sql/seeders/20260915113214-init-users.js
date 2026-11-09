'use strict';

const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const ROLE_ADMIN_ID = '0747b5d6-1a5c-4955-a9c9-91122884da99';
const ROLE_USER_ID = '4ce388ae-b756-47f3-bf32-9bb245f065b7';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('users', [
      {
        user_id: randomUUID(),
        role_id: ROLE_ADMIN_ID,
        name: 'Khoiri Admin',
        email: 'admin@gmail.com',
        password_hash: bcrypt.hashSync(
          'password',
          parseInt(process.env.BCRYPT_SALT_ROUNDS ?? 10),
        ),
        is_email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        user_id: randomUUID(),
        role_id: ROLE_USER_ID,
        name: 'Khoiri User',
        email: 'user@gmail.com',
        password_hash: bcrypt.hashSync(
          'password',
          parseInt(process.env.BCRYPT_SALT_ROUNDS ?? 10),
        ),
        is_email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      email: ['admin@gmail.com', 'user@gmail.com'],
    });
  },
};
