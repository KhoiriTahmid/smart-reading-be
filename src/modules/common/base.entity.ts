import {
  Column,
  CreatedAt,
  DataType,
  DeletedAt,
  Model,
  UpdatedAt,
} from 'sequelize-typescript';

export class BaseModel extends Model {
  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @DeletedAt
  declare deletedAt: Date;
}

export class BaseModelWithMetaUser extends BaseModel {
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare createdByUserId: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  metaUser: any;
}


