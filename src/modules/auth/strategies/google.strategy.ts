import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleLoginRequest } from '../auth.contract';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CookieStateStore } from './cookie-state.store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['email', 'profile'],
      store: new CookieStateStore(),
      // state: true,
    } as any);
  }

  async validate(
    _at: string,
    _rt: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { displayName, emails, _json } = profile;
    if (!emails || !emails[0])
      return done(
        new UnauthorizedException('No email found from Google profile'),
        false,
      );
    if (!_json.email_verified)
      return done(
        new UnauthorizedException('Google account email is not verified'),
        false,
      );

    return done(null, {
      googleId: profile.id,
      email: emails[0]?.value,
      name: displayName,
      picture: profile.photos?.[0]?.value,
    });
  }
}
