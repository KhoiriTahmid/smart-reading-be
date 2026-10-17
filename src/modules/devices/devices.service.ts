import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceModel } from './devices.entity';
import {
  CreateDeviceRequest,
  UpdateDeviceRequest,
  FindAllDeviceRequest,
  FindOneDeviceRequest,
  DeleteDeviceRequest,
} from './devices.contract';
import { FindAndCountOptions, Op } from 'sequelize';
import { UserModel } from '../users/users.entity';
import { generatePaginationResponse } from 'src/helpers/parse';
import { v4 as uuidv4 } from 'uuid';
import { BaseUserInfoRequest } from '../common/base.contract';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(DeviceModel)
    private readonly deviceModel: typeof DeviceModel,
  ) {}

  async findAll({
    search,
    limit,
    offset,
    status,
    connectionStatus,
  }: FindAllDeviceRequest) {
    let where: Record<string, any> = {};

    if (status === 'archive') where.deletedAt = { [Op.not]: null };
    if (connectionStatus) where.status = connectionStatus;
    if (search) {
      where = {
        ...where,
        [Op.or]: [{ serialNumber: { [Op.iLike]: `%${search}%` } }],
      };
    }

    const options: FindAndCountOptions = {
      where,
      limit,
      offset,
      include: [
        { model: UserModel, as: 'createdByUser', attributes: ['name'] },
      ],
      order: [
        ['createdAt', 'DESC'],
        ['serialNumber', 'ASC'],
      ],
      paranoid: status === 'active' ? true : false,
    };

    const { count, rows } = await this.deviceModel.findAndCountAll(options);
    const results = rows.map((v) => v.get());

    return {
      ...generatePaginationResponse(limit, offset, count),
      results,
    };
  }

  async findOne({ deviceId }: FindOneDeviceRequest) {
    const result = await this.deviceModel.findOne({
      where: { deviceId },
      include: [
        {
          model: UserModel,
          as: 'createdByUser',
          attributes: { exclude: ['hashedPassword'] },
        },
      ],
    });
    if (!result) throw new NotFoundException();
    return result;
  }

  async create(params: CreateDeviceRequest & BaseUserInfoRequest) {
    const result = await this.deviceModel.create({
      ...params,
      deviceId: uuidv4(),
    });
    return result;
  }

  async update({
    deviceId,
    ...params
  }: UpdateDeviceRequest & { deviceId: string }) {
    const result = await this.deviceModel.update(params, {
      where: { deviceId },
    });
    return result;
  }

  async restore(deviceId: string) {
    const result = await this.deviceModel.restore({ where: { deviceId } });
    return 'success';
  }

  async delete({
    deviceId,
    isForceDelete,
  }: DeleteDeviceRequest & { deviceId: string }) {
    const result = await this.deviceModel.destroy({
      where: { deviceId },
      force: isForceDelete,
    });
    return 'success';
  }
}
