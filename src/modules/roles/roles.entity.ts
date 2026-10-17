import { BelongsTo, Column, DataType, ForeignKey, Table } from 'sequelize-typescript';
import { BaseModelWithMetaUser } from '../common/base.entity';
import { UserModel } from '../users/users.entity';

@Table({
  tableName: 'roles',
  timestamps: true,
  underscored: true,
})
export class RoleModel extends BaseModelWithMetaUser {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare roleId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  declare permissions: any;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare createdByUserId: string;

  @BelongsTo(() => UserModel, 'createdByUserId')
  declare createdByUser: UserModel;
}

