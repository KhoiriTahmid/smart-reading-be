import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from 'sequelize-typescript';
import { BaseModelWithMetaUser } from '../common/base.entity';
import { UserModel } from '../users/users.entity';

@Table({
  tableName: 'devices',
  timestamps: true,
  underscored: true,
})
export class DeviceModel extends BaseModelWithMetaUser {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare deviceId: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    unique: true,
  })
  declare serialNumber: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare apiKeyHash: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    defaultValue: 'DISCONNECTED',
  })
  declare status: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastSeenAt: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare createdByUserId: string;

  @BelongsTo(() => UserModel, 'createdByUserId')
  declare createdByUser: UserModel;
}

