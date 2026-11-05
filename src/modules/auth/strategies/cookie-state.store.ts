import { randomBytes, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const COOKIE = 'oauth_state';
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // lax: cookie ikut terkirim saat Google redirect balik
  path: '/auth', // sesuaikan dengan path callback kamu
};

export class CookieStateStore {
  store(
    req: Request,
    _meta: unknown,
    cb: (err: Error | null, state?: string) => void,
  ) {
    const state = randomBytes(16).toString('hex');
    req.res?.cookie(COOKIE, state, { ...options, maxAge: 10 * 60 * 1000 });
    cb(null, state);
  }

  verify(
    req: Request,
    providedState: string,
    cb: (err: Error | null, ok: boolean, info?: unknown) => void,
  ) {
    const saved: string | undefined = req.cookies?.[COOKIE];
    req.res?.clearCookie(COOKIE, options); // sekali pakai

    const ok =
      !!saved &&
      !!providedState &&
      saved.length === providedState.length &&
      timingSafeEqual(Buffer.from(saved), Buffer.from(providedState));

    if (!ok) return cb(null, false, { message: 'Invalid OAuth state' });
    cb(null, true);
  }
}
