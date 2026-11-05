import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from 'sequelize-typescript';
import { BaseModel } from '../common/base.entity';
import { RoleModel } from '../roles/roles.entity';
import { DeviceModel } from '../devices/devices.entity';

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
})
export class UserModel extends BaseModel {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare userId: string;

  @ForeignKey(() => RoleModel)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare roleId: string;

  @BelongsTo(() => RoleModel)
  declare role: RoleModel;

  @ForeignKey(() => DeviceModel)
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare deviceId?: string;

  @BelongsTo(() => DeviceModel)
  declare device: DeviceModel;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare passwordHash?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare refreshTokenHash?: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare authProvider?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare providerId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare picture?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metaAdditionalData?: any;
}
