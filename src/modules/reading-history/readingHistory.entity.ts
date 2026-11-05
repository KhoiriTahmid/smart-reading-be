import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from 'sequelize-typescript';
import { BaseModelWithMetaUser } from '../common/base.entity';
import { UserModel } from '../users/users.entity';
import { DeviceModel } from '../devices/devices.entity';
import { ReadingVoice } from './readingHistory.pipeline';

@Table({
  tableName: 'reading_histories',
  timestamps: true,
  underscored: true,
})
export class ReadingHistoryModel extends BaseModelWithMetaUser {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare historyId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare name: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare extractedText: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare audioUrl: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare sourceFileKey: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare sourceMimeType: string | null;

  @Column({ type: DataType.STRING(10), allowNull: false, defaultValue: 'female' })
  declare voice: ReadingVoice;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare status: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare remark: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare errorMessage: string | null;

  @BelongsTo(() => UserModel, 'createdByUserId')
  declare createdByUser: UserModel;

  @ForeignKey(() => DeviceModel)
  @Column({ type: DataType.UUID, allowNull: true })
  declare createdByDeviceId: string | null;

  @BelongsTo(() => DeviceModel, 'createdByDeviceId')
  declare createdByDevice: DeviceModel;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare metaDevice: object | null;
}
