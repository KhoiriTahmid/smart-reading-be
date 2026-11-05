import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserModel } from '../users/users.entity';
import { compare } from 'bcrypt';
import {
  GoogleLoginRequest,
  RefreshTokenRequest,
  SignupRequest,
} from './auth.contract';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UniqueConstraintError } from 'sequelize';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async me(userId: string) {
    return await this.userService.findOne({ userId }, false);
  }

  async findUserByEmail(email: string) {
    return await this.userService.findOneByEmail(email);
  }

  async validateUserByEmail(email: string, password: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user?.passwordHash || !(await compare(password, user.passwordHash)))
      return false;
    return user;
  }

  async validateUserByGoogle({
    googleId,
    name,
    email,
    picture,
  }: GoogleLoginRequest) {
    if (!email) throw new InternalServerErrorException();
    let user = await this.userService.findOneByEmail(email);
    if (!user) {
      user = await this.userService.createByGoogle({
        providerId: googleId,
        email,
        name,
        picture,
      });
    }
    return user;
  }

  async generateTokens(params: {
    userId: string;
    email: string;
    permissions: Record<string, boolean>;
  }) {
    const payload = { sub: params.userId, ...params };
    const accessToken = this.jwt.sign(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_SECRET_ACCESS,
    });
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_SECRET_REFRESH,
    });

    await this.userService.updateRefreshToken({
      userId: params.userId,
      refreshToken,
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async loginByEmail(user: UserModel) {
    return await this.generateTokens({
      userId: user.userId,
      email: user.email,
      permissions: user.role.permissions,
    });
  }

  async signupByEmail(params: SignupRequest) {
    const email = params.email.trim();
    const existing = await this.userService.findOneByEmail(email);
    if (existing) throw new ConflictException('Email is already registered');

    try {
      const user = await this.userService.create({
        name: params.name,
        email,
        password: params.password,
      });

      return await this.generateTokens({
        userId: user.userId,
        email: user.email,
        permissions: user.role.permissions,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  async loginOrRegisterByGoogle(params: GoogleLoginRequest) {
    const user = await this.validateUserByGoogle(params);
    if (!user) throw new InternalServerErrorException();
    return await this.generateTokens({
      userId: user.userId,
      email: user.email,
      permissions: user.role.permissions,
    });
  }

  async refreshToken({ userId, refreshToken }: RefreshTokenRequest) {
    const user = await this.userService.findOne({ userId }, true);
    if (!user) throw new NotFoundException();

    if (!user.refreshTokenHash) return { needLogout: true };
    if (!(await compare(refreshToken, user.refreshTokenHash)))
      return { needLogout: true };

    return await this.generateTokens({
      userId: user.userId,
      email: user.email,
      permissions: user.role.permissions,
    });
  }

  async logout(userId: string) {
    await this.userService.updateRefreshToken({ userId });
    return true;
  }
}
