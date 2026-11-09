import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserModel } from '../users/users.entity';
import { compare } from 'bcrypt';
import {
  GoogleLoginRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
  SignupRequest,
} from './auth.contract';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UniqueConstraintError } from 'sequelize';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
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

    if (!user.isEmailVerified)
      throw new ForbiddenException(
        'Please verify your email before signing in',
      );

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

  private async sendVerificationEmail(user: UserModel) {
    const token = this.jwt.sign(
      { sub: user.userId, email: user.email, purpose: 'verify-email' },
      {
        expiresIn: '24h',
        secret: process.env.JWT_SECRET_EMAIL_VERIFY,
      },
    );

    await this.mailService.enqueueVerificationEmail({
      email: user.email,
      name: user.name,
      token,
    });

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
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

      return await this.sendVerificationEmail(user);
    } catch (error) {
      if (error instanceof UniqueConstraintError)
        throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  async resendVerificationEmail(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new NotFoundException('Account with this email not found');
    return await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string) {
    try {
      const data = await this.jwt.verify(token, {
        secret: process.env.JWT_SECRET_EMAIL_VERIFY,
      });

      const user = await this.userService.markEmailAsVerified(data.sub);

      return await this.generateTokens({
        userId: user.userId,
        email: user.email,
        permissions: user.role.permissions,
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new NotFoundException('Account with this email not found');

    const token = this.jwt.sign(
      { sub: user.userId, email: user.email, purpose: 'reset-password' },
      {
        expiresIn: '24h',
        secret: `${process.env.JWT_SECRET_ACCESS}-${user.passwordHash}`,
      },
    );

    await this.mailService.enqueueResetPasswordEmail({
      email: user.email,
      name: user.name,
      token,
    });

    return {
      message: 'A password reset link has been sent, please check your email.',
    };
  }

  async resetPassword({ token, newPassword }: ResetPasswordRequest) {
    try {
      const userDecode = await this.jwt.decode(token);
      const user = await this.userService.findOneWithPassword({
        userId: userDecode.sub,
      });

      const data = await this.jwt.verify(token, {
        secret: `${process.env.JWT_SECRET_ACCESS}-${user.passwordHash}`,
      });

      const affectedRows = await this.userService.updatePassword({
        userId: data.sub,
        newPassword,
      });

      return {
        message:
          'Password has been reset successfully, please login with new password.',
      };
    } catch {
      throw new BadRequestException('Invalid or expired token');
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
