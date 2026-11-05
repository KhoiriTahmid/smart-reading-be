import { ConflictException, NotFoundException } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { compare } from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockedCompare = compare as jest.MockedFunction<typeof compare>;

describe('AuthService', () => {
  const users = {
    findOne: jest.fn(),
    findOneByEmail: jest.fn(),
    create: jest.fn(),
    createByGoogle: jest.fn(),
    updateRefreshToken: jest.fn(),
  };
  const jwt = { sign: jest.fn() };
  let service: AuthService;

  const user = {
    userId: 'u-1',
    email: 'a@b.com',
    passwordHash: 'hashed',
    role: { permissions: { DASHBOARD: true } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET_ACCESS = 'access-secret';
    process.env.JWT_SECRET_REFRESH = 'refresh-secret';
    jwt.sign.mockImplementation(
      (_payload: unknown, opts: { secret: string }) => `token-${opts.secret}`,
    );
    service = new AuthService(users as any, jwt as any);
  });

  describe('validateUserByEmail', () => {
    it('returns the user when the password matches', async () => {
      users.findOneByEmail.mockResolvedValue(user);
      mockedCompare.mockResolvedValue(true as never);
      await expect(service.validateUserByEmail('a@b.com', 'pw')).resolves.toBe(
        user,
      );
      expect(mockedCompare).toHaveBeenCalledWith('pw', 'hashed');
    });

    it('returns false for a wrong password', async () => {
      users.findOneByEmail.mockResolvedValue(user);
      mockedCompare.mockResolvedValue(false as never);
      await expect(service.validateUserByEmail('a@b.com', 'x')).resolves.toBe(
        false,
      );
    });

    it('returns false for unknown users and Google-only users (no hash)', async () => {
      users.findOneByEmail.mockResolvedValueOnce(null);
      await expect(service.validateUserByEmail('x@y.com', 'pw')).resolves.toBe(
        false,
      );
      users.findOneByEmail.mockResolvedValueOnce({ ...user, passwordHash: null });
      await expect(service.validateUserByEmail('a@b.com', 'pw')).resolves.toBe(
        false,
      );
      expect(mockedCompare).not.toHaveBeenCalled();
    });
  });

  describe('generateTokens', () => {
    it('signs access + refresh tokens with permissions and stores the refresh token', async () => {
      const tokens = await service.generateTokens({
        userId: 'u-1',
        email: 'a@b.com',
        permissions: { DASHBOARD: true },
      });

      expect(tokens).toEqual({
        access_token: 'token-access-secret',
        refresh_token: 'token-refresh-secret',
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'u-1',
          permissions: { DASHBOARD: true },
        }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
      expect(users.updateRefreshToken).toHaveBeenCalledWith({
        userId: 'u-1',
        refreshToken: 'token-refresh-secret',
      });
    });
  });

  describe('signupByEmail', () => {
    it('rejects an email that is already registered', async () => {
      users.findOneByEmail.mockResolvedValue(user);
      await expect(
        service.signupByEmail({ name: 'A', email: 'a@b.com', password: 'pw' }),
      ).rejects.toThrow(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('maps a DB unique-constraint race to 409', async () => {
      users.findOneByEmail.mockResolvedValue(null);
      users.create.mockRejectedValue(new UniqueConstraintError({}));
      await expect(
        service.signupByEmail({ name: 'A', email: 'a@b.com', password: 'pw' }),
      ).rejects.toThrow(ConflictException);
    });

    it('trims the email, creates the user and returns tokens', async () => {
      users.findOneByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue(user);
      const tokens = await service.signupByEmail({
        name: 'A',
        email: '  a@b.com ',
        password: 'pw',
      });
      expect(users.create).toHaveBeenCalledWith({
        name: 'A',
        email: 'a@b.com',
        password: 'pw',
      });
      expect(tokens.access_token).toBe('token-access-secret');
    });
  });

  describe('refreshToken', () => {
    it('throws NotFound when the user no longer exists', async () => {
      users.findOne.mockRejectedValue(new NotFoundException());
      await expect(
        service.refreshToken({ userId: 'gone', refreshToken: 'r' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('asks for logout when no refresh token is stored', async () => {
      users.findOne.mockResolvedValue({ ...user, refreshTokenHash: null });
      await expect(
        service.refreshToken({ userId: 'u-1', refreshToken: 'r' } as any),
      ).resolves.toEqual({ needLogout: true });
    });

    it('asks for logout when the refresh token does not match (reuse/theft)', async () => {
      users.findOne.mockResolvedValue({ ...user, refreshTokenHash: 'h' });
      mockedCompare.mockResolvedValue(false as never);
      await expect(
        service.refreshToken({ userId: 'u-1', refreshToken: 'old' } as any),
      ).resolves.toEqual({ needLogout: true });
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('rotates tokens when the refresh token matches', async () => {
      users.findOne.mockResolvedValue({ ...user, refreshTokenHash: 'h' });
      mockedCompare.mockResolvedValue(true as never);
      const result = await service.refreshToken({
        userId: 'u-1',
        refreshToken: 'r',
      } as any);
      expect(result).toEqual({
        access_token: 'token-access-secret',
        refresh_token: 'token-refresh-secret',
      });
    });
  });

  it('logout clears the stored refresh token', async () => {
    await expect(service.logout('u-1')).resolves.toBe(true);
    expect(users.updateRefreshToken).toHaveBeenCalledWith({ userId: 'u-1' });
  });
});
