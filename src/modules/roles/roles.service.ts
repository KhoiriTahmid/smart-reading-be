import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { RoleModel } from './roles.entity';
import {
  CreateRoleRequest,
  DeleteRoleRequest,
  FindAllRoleRequest,
  FindOneRequest,
  UpdateRoleRequest,
} from './roles.contract';
import { FindAndCountOptions, Op } from 'sequelize';
import { UserModel } from '../users/users.entity';
import { generatePaginationResponse } from 'src/helpers/parse';
import { v4 as uuidv4 } from 'uuid';
import { BaseUserInfoRequest } from '../common/base.contract';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(RoleModel)
    private readonly roleModel: typeof RoleModel,
  ) {}

  async findAll({ search, limit, offset, status }: FindAllRoleRequest) {
    let where: Record<string, any> = {};

    if (status === 'archive') where.deletedAt = { [Op.not]: null };
    if (search) {
      where = {
        ...where,
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ],
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
        ['name', 'ASC'],
      ],
      paranoid: status === 'active' ? true : false,
    };

    const { count, rows } = await this.roleModel.findAndCountAll(options);
    const results = rows.map((v) => v.get());

    return {
      ...generatePaginationResponse(limit, offset, count),
      results,
    };
  }

  async findOne({ roleId }: FindOneRequest) {
    const result = await this.roleModel.findOne({
      where: { roleId },
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

  async create(params: CreateRoleRequest & BaseUserInfoRequest) {
    const result = await this.roleModel.create({ ...params, roleId: uuidv4() });
    return result;
  }

  async update({ roleId, ...params }: UpdateRoleRequest & { roleId: string }) {
    const result = await this.roleModel.update(params, { where: { roleId } });
    return result;
  }

  async restore(roleId: string) {
    const result = await this.roleModel.restore({ where: { roleId } });
    return 'success';
  }

  async delete({
    roleId,
    isForceDelete,
  }: DeleteRoleRequest & { roleId: string }) {
    const result = await this.roleModel.destroy({
      where: { roleId },
      force: isForceDelete,
    });
    return 'success';
  }
}
