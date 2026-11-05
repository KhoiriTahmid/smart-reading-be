'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reading_histories', {
      history_id: {
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      extracted_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      audio_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source_file_key: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source_mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      remark: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_by_device_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'devices', key: 'device_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      meta_user: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      meta_device: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('reading_histories', [
      'created_by_user_id',
      'created_at',
    ]);
    await queryInterface.addIndex('reading_histories', [
      'created_by_device_id',
      'created_at',
    ]);
    await queryInterface.addIndex('reading_histories', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reading_histories');
  },
};
