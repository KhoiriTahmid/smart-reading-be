'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('devices', {
      fields: ['created_by_user_id'],
      type: 'foreign key',
      name: 'fk_devices_created_by_user_id',
      references: {
        table: 'users',
        field: 'user_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      'devices',
      'fk_devices_created_by_user_id',
    );
  },
};
