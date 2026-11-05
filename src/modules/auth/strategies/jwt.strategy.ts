import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface Params {
  sub: string;
  email: string;
  permissions: Record<string, boolean>;
}

@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req?.cookies?.['access_token'] ?? null,
      ]),
      secretOrKey: process.env.JWT_SECRET_ACCESS!,
      ignoreExpiration: false,
    });
  }

  validate({ sub, email, permissions }: Params) {
    return { userId: sub, email, permissions };
  }
}
