import { ApiFault } from '../errors.ts';
import { requireAdmin } from './authentication.ts';

const cookieName = 'fearless_winner_session';
const lifetimeSeconds = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();

function cookieValue(request: Request): string | undefined {
  return request.headers.get('Cookie')?.split(';').map(item => item.trim())
    .find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

function cookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=${value}; Path=/api; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

async function signingKey(adminToken: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(adminToken), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createWinnerSessionCookie(request: Request, adminToken: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const value = `v1.${expires}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(adminToken), encoder.encode(`winner-session:${value}`));
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return cookie(request, `${value}.${hex}`, lifetimeSeconds);
}

export function clearWinnerSessionCookie(request: Request): string {
  return cookie(request, '', 0);
}

export async function hasWinnerSession(request: Request, adminToken: string): Promise<boolean> {
  if (!adminToken) return false;
  const value = cookieValue(request);
  const match = value && /^(v1\.(\d+)\.[0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const expires = Number(match[2]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + lifetimeSeconds) return false;
  const signature = Uint8Array.from(match[3].match(/../g)!, byte => Number.parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', await signingKey(adminToken), signature, encoder.encode(`winner-session:${match[1]}`));
}

export function requireSessionOrigin(request: Request, allowedOrigin?: string | string[]): void {
  const origin = request.headers.get('Origin');
  const allowedOrigins = Array.isArray(allowedOrigin) ? allowedOrigin : [allowedOrigin];
  if (origin && origin !== new URL(request.url).origin && !allowedOrigins.includes(origin)) {
    throw new ApiFault(403, 'invalid_session_origin', 'Esta sesión no se puede usar desde este origen.');
  }
}

/** A winner session authorizes winner changes only; other admin actions still require the key. */
export async function requireWinnerAdmin(request: Request, adminToken: string, allowedOrigin?: string | string[]): Promise<void> {
  if (request.headers.has('Authorization')) {
    requireAdmin(request, adminToken);
    return;
  }
  if (!adminToken) throw new ApiFault(503, 'ADMIN_TOKEN_NOT_CONFIGURED', 'Falta configurar la clave de administrador en el servidor.');
  requireSessionOrigin(request, allowedOrigin);
  if (!await hasWinnerSession(request, adminToken)) {
    throw new ApiFault(401, 'UNAUTHORIZED', 'La sesión ha caducado. Introduce la clave de administrador.');
  }
}
