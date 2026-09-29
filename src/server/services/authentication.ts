import { ApiFault } from '../errors.ts';

export function requireAdmin(request: Request, token: string): void {
  if (!token) throw new ApiFault(503, 'ADMIN_TOKEN_NOT_CONFIGURED', 'Falta configurar la clave de administrador en el servidor.');
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const provided = match?.[1] ?? '';
  const expectedBytes = new TextEncoder().encode(token);
  const providedBytes = new TextEncoder().encode(provided);
  let mismatch = expectedBytes.length ^ providedBytes.length;
  for (let index = 0; index < Math.max(expectedBytes.length, providedBytes.length); index++) {
    mismatch |= (expectedBytes[index] ?? 0) ^ (providedBytes[index] ?? 0);
  }
  if (!match || mismatch) throw new ApiFault(401, 'UNAUTHORIZED', 'La clave de administrador no es válida.');
}

