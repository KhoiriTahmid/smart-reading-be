import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserModel } from './users.entity';
import {
  CreateUserRequest,
  UpdateUserRequest,
  FindAllUserRequest,
  FindOneUserRequest,
  DeleteUserRequest,
} from './users.contract';
import { FindAndCountOptions, Op } from 'sequelize';
import { generatePaginationResponse } from 'src/helpers/parse';
import { v4 as uuidv4 } from 'uuid';
import { BaseUserInfoRequest } from '../common/base.contract';
import { RoleModel } from '../roles/roles.entity';
import { DeviceModel } from '../devices/devices.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserModel)
    private readonly userModel: typeof UserModel,
  ) {}

  async findAll({ search, limit, offset, status }: FindAllUserRequest) {
    let where: Record<string, any> = {};

    if (status === 'archive') where.deletedAt = { [Op.not]: null };
    if (search) {
      where = {
        ...where,
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    const options: FindAndCountOptions = {
      where,
      limit,
      offset,
      include: [
        { model: RoleModel, as: 'role', attributes: ['roleId', 'name'] },
        { model: DeviceModel, as: 'device', attributes: ['deviceId', 'serialNumber'] },
      ],
      order: [
        ['createdAt', 'DESC'],
        ['name', 'ASC'],
      ],
      paranoid: status === 'active' ? true : false,
    };

    const { count, rows } = await this.userModel.findAndCountAll(options);
    const results = rows.map((v) => v.get());

    return {
      ...generatePaginationResponse(limit, offset, count),
      results,
    };
  }

  async findOne({ userId }: FindOneUserRequest) {
    const result = await this.userModel.findOne({
      where: { userId },
      include: [
        { model: RoleModel, as: 'role', attributes: { exclude: [] } },
        { model: DeviceModel, as: 'device', attributes: { exclude: [] } },
      ],
    });
    if (!result) throw new NotFoundException();
    return result;
  }

  async create(params: CreateUserRequest & BaseUserInfoRequest) {
    const result = await this.userModel.create({
      ...params,
      userId: uuidv4(),
    });
    return result;
  }

  async update({
    userId,
    ...params
  }: UpdateUserRequest & { userId: string }) {
    const result = await this.userModel.update(params, {
      where: { userId },
    });
    return result;
  }

  async restore(userId: string) {
    const result = await this.userModel.restore({ where: { userId } });
    return 'success';
  }

  async delete({
    userId,
    isForceDelete,
  }: DeleteUserRequest & { userId: string }) {
    const result = await this.userModel.destroy({
      where: { userId },
      force: isForceDelete,
    });
    return 'success';
  }
}

