import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../../common/errors';

/**
 * Shared-password access gate for hosted demos (e.g. Render).
 * Enabled only when AURORA_ACCESS_PASSWORD is set; local development is unaffected.
 * A correct password sets an HttpOnly, SameSite=Lax cookie holding `<expiry>.<HMAC>`; the HMAC key is derived
 * from the password, so changing the password signs everyone out. This is a demo gate, not user authentication.
 */
const COOKIE = 'aurora_access';
const TTL_MS = 7 * 24 * 3600 * 1000;
const password = () => process.env.AURORA_ACCESS_PASSWORD ?? '';
export const gateEnabled = () => password().length > 0;
const key = () => createHash('sha256').update(`aurora-access-gate:${password()}`).digest();
const sign = (exp: number) => createHmac('sha256', key()).update(String(exp)).digest('base64url');

function cookieValue(req: Request): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function hasAccess(req: Request): boolean {
  if (!gateEnabled()) return true;
  const v = cookieValue(req);
  if (!v) return false;
  const [expRaw, mac] = v.split('.');
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() || !mac) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

const OPEN = [/^\/api\/v1\/access(\/|$)/, /^\/health$/, /^\/api\/v1\/health$/];

/** Blocks every API route without a valid access cookie (web assets stay public so the sign-in screen loads). */
export function accessGate(req: Request, res: Response, next: NextFunction) {
  const p = req.originalUrl.split('?')[0];
  if (!gateEnabled() || !p.startsWith('/api/') || OPEN.some((r) => r.test(p)) || hasAccess(req)) return next();
  res.status(401).json({ code: 'ACCESS_REQUIRED', message: 'Enter the access password to use this demo' });
}

const attempts = new Map<string, { n: number; until: number }>();
function throttle(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.until < now) return void attempts.set(ip, { n: 1, until: now + 60_000 });
  a.n += 1;
  if (a.n > 10) throw new DomainError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts — wait a minute and try again');
}

class LoginDto {
  @IsString() @MaxLength(200) password!: string;
}

@Controller('access')
export class AccessGateController {
  @Get('status')
  status(@Req() req: Request) {
    return { required: gateEnabled(), granted: hasAccess(req) };
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!gateEnabled()) return { required: false, granted: true };
    throttle(req.ip ?? 'unknown');
    const a = createHash('sha256').update(dto.password).digest();
    const b = createHash('sha256').update(password()).digest();
    if (!timingSafeEqual(a, b)) throw new DomainError(401, 'WRONG_PASSWORD', 'That password is not correct');
    const exp = Date.now() + TTL_MS;
    res.cookie(COOKIE, `${exp}.${sign(exp)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: TTL_MS,
      path: '/',
    });
    return { required: true, granted: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE, { path: '/' });
    return { granted: false };
  }
}
