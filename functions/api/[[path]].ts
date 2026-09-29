import { createApiHandler } from '../../src/server/routes/api.ts';
import { D1SeriesRepository, type D1DatabaseLike } from '../../src/server/repositories/d1Repository.ts';
import { ensureD1Schema } from '../../src/server/d1Schema.ts';

interface SiteEnvironment {
  DB?: D1DatabaseLike;
  FEARLESS_ADMIN_TOKEN?: string;
}

interface SiteContext {
  request: Request;
  env: SiteEnvironment;
}

export async function onRequest(context: SiteContext): Promise<Response> {
  if (!context.env.DB) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (context.request.method.toUpperCase() === 'OPTIONS') return new Response(null, { status: 204, headers });
    return Response.json(
      { success: false, error: 'database_unavailable', message: 'Falta la base de datos DB.' },
      { status: 503, headers },
    );
  }
  try {
    await ensureD1Schema(context.env.DB);
  } catch {
    return Response.json({ success: false, error: 'database_unavailable', message: 'No se pudo preparar el esquema de la base de datos.' }, {
      status: 503,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
  const repository = new D1SeriesRepository(context.env.DB);
  const handler = createApiHandler(repository, {
    adminToken: context.env.FEARLESS_ADMIN_TOKEN ?? '',
  });
  return handler(context.request);
}
