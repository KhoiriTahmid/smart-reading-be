'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('roles', {
      fields: ['created_by_user_id'],
      type: 'foreign key',
      name: 'fk_roles_created_by_user_id',
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
      'roles',
      'fk_roles_created_by_user_id',
    );
  },
};
