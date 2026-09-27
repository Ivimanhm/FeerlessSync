import { ApiFault } from '../errors.ts';

export function requireAuth(request: Request, token: string): void {
  if (!token) throw new ApiFault(503, 'auth_not_configured', 'La autenticación de escrituras no está configurada.');
  if (request.headers.get('Authorization') !== `Bearer ${token}`) {
    throw new ApiFault(401, 'unauthorized', 'Se requiere un token válido.');
  }
}

export function requireAdmin(request: Request, token: string): void {
  if (!token) throw new ApiFault(503, 'ADMIN_TOKEN_NOT_CONFIGURED', 'Falta configurar la clave de administrador en el servidor.');
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBytes = new TextEncoder().encode(token);
  const providedBytes = new TextEncoder().encode(provided);
  let mismatch = expectedBytes.length ^ providedBytes.length;
  for (let index = 0; index < Math.max(expectedBytes.length, providedBytes.length); index++) {
    mismatch |= (expectedBytes[index] ?? 0) ^ (providedBytes[index] ?? 0);
  }
  if (mismatch) throw new ApiFault(401, 'UNAUTHORIZED', 'La clave de administrador no es válida.');
}

