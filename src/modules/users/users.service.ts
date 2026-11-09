import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserModel } from './users.entity';
import {
  FindAllUserRequest,
  FindOneUserRequest,
  DeleteUserRequest,
  UpdateProfileRequest,
  CreateUserRequestByEmail,
  CreateUserRequestByGoogle,
} from './users.contract';
import { FindAndCountOptions, Op } from 'sequelize';
import { generatePaginationResponse } from 'src/helpers/parse';
import { v4 as uuidv4 } from 'uuid';
import { BaseUserInfoRequest } from '../common/base.contract';
import { RoleModel } from '../roles/roles.entity';
import { DeviceModel } from '../devices/devices.entity';
import { hash } from 'bcrypt';

const RETURN_COLUMNS_FOR_LOGIN = ['email', 'name', 'userId', 'isEmailVerified'];
const EXCLUDED_USER_COLUMNS = [
  'passwordHash',
  'refreshTokenHash',
  'providerId',
];
const EXCLUDED_USER_COLUMNS_WITH_REFRESH = ['passwordHash', 'providerId'];

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserModel)
    private readonly userModel: typeof UserModel,
  ) {}

  async findAll(params: FindAllUserRequest) {
    const { search, limit, offset, status } = params;
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
      attributes: { exclude: EXCLUDED_USER_COLUMNS },
      include: [
        { model: RoleModel, as: 'role', attributes: ['roleId', 'name'] },
        {
          model: DeviceModel,
          as: 'device',
          attributes: ['deviceId', 'serialNumber'],
        },
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
      ...generatePaginationResponse({ count, query: params }),
      results,
    };
  }

  async findOne({ userId }: FindOneUserRequest, returnRefreshToken?: boolean) {
    const result = await this.userModel.findOne({
      where: { userId },
      attributes: {
        exclude: returnRefreshToken
          ? EXCLUDED_USER_COLUMNS_WITH_REFRESH
          : EXCLUDED_USER_COLUMNS,
      },
      include: [
        { model: RoleModel, as: 'role', attributes: { exclude: [] } },
        { model: DeviceModel, as: 'device', attributes: { exclude: [] } },
      ],
    });
    if (!result) throw new NotFoundException();
    return result;
  }

  async findOneWithPassword({ userId }: FindOneUserRequest) {
    const result = await this.userModel.findOne({
      where: { userId },
      attributes: ['userId', 'passwordHash', 'isEmailVerified'],
    });
    if (!result) throw new NotFoundException();
    return result;
  }

  async findOneByEmail(email: string) {
    const result = await this.userModel.findOne({
      where: { email },
      attributes: ['passwordHash', ...RETURN_COLUMNS_FOR_LOGIN],
      include: {
        model: RoleModel,
        attributes: ['permissions'],
        as: 'role',
      },
    });
    return result;
  }

  async create(
    params: CreateUserRequestByEmail & Partial<BaseUserInfoRequest>,
  ) {
    const roleId = params.roleId || process.env.ROLE_USER_ID;
    if (!params.password || !roleId) throw new ForbiddenException();

    const passwordHash = await hash(
      params.password,
      Number(process.env.BCRYPT_SALT_ROUNDS),
    );
    const result = await this.userModel.create({
      ...params,
      passwordHash,
      roleId,
      authProvider: 'email',
      userId: uuidv4(),
      isEmailVerified: false,
    });

    const user = await this.userModel.findOne({
      where: { userId: result.userId },
      attributes: RETURN_COLUMNS_FOR_LOGIN,
      include: {
        model: RoleModel,
        attributes: ['permissions'],
        as: 'role',
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async createByGoogle(params: CreateUserRequestByGoogle) {
    const roleId = process.env.ROLE_USER_ID;
    if (!params.providerId || !roleId) throw new ForbiddenException();

    const data = {
      ...params,
      roleId,
      authProvider: 'google',
      userId: uuidv4(),
      isEmailVerified: true,
    };
    const result = await this.userModel.create(data, {});

    const user = await this.userModel.findOne({
      where: { userId: result.userId },
      attributes: RETURN_COLUMNS_FOR_LOGIN,
      include: {
        model: RoleModel,
        attributes: ['permissions'],
        as: 'role',
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateRefreshToken({
    userId,
    refreshToken,
  }: {
    userId: string;
    refreshToken?: string;
  }) {
    const refreshTokenHash = refreshToken?.length
      ? await hash(refreshToken, Number(process.env.BCRYPT_SALT_ROUNDS))
      : null;

    const result = await this.userModel.update(
      { refreshTokenHash },
      { where: { userId } },
    );
    return result;
  }

  async update({
    userId,
    ...params
  }: UpdateProfileRequest & { userId: string }) {
    const result = await this.userModel.update(params, {
      where: { userId },
      returning: false,
    });
    return result;
  }

  async markEmailAsVerified(userId: string) {
    const result = await this.userModel.update(
      { isEmailVerified: true },
      { where: { userId } },
    );
    if (!result) throw new NotFoundException('email not registered');

    const user = await this.findOne({ userId });
    return user;
  }

  async updatePassword({
    userId,
    newPassword,
  }: {
    userId: string;
    newPassword: string;
  }) {
    const passwordHash = await hash(
      newPassword,
      Number(process.env.BCRYPT_SALT_ROUNDS),
    );

    const result = await this.userModel.update(
      { passwordHash },
      { where: { userId } },
    );
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
