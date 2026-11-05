import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { RefreshTokenRequest } from '../auth.contract';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['refresh_token'] ?? null,
      ]),
      secretOrKey: process.env.JWT_SECRET_REFRESH!,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any): Promise<RefreshTokenRequest> {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) throw new ForbiddenException();
    return {
      userId: payload.sub,
      email: payload.email,
      permissions: payload.permissions,
      refreshToken,
    };
  }
}
