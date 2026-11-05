'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reading_histories', 'voice', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'female',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reading_histories', 'voice');
  },
};
