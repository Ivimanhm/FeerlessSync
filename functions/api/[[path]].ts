import { createApiHandler } from '../../src/server/routes/api.ts';
import { D1SeriesRepository, type D1DatabaseLike } from '../../src/server/repositories/d1Repository.ts';

interface SiteEnvironment {
  DB?: D1DatabaseLike;
  FEARLESS_API_TOKEN?: string;
  FEARLESS_ADMIN_TOKEN?: string;
}

interface SiteContext {
  request: Request;
  env: SiteEnvironment;
}

export async function onRequest(context: SiteContext): Promise<Response> {
  if (!context.env.DB) {
    return Response.json({ success: false, error: 'database_unavailable', message: 'Falta la base de datos DB.' }, { status: 503 });
  }
  const repository = new D1SeriesRepository(context.env.DB);
  const handler = createApiHandler(repository, {
    writeToken: context.env.FEARLESS_API_TOKEN ?? '',
    adminToken: context.env.FEARLESS_ADMIN_TOKEN ?? '',
  });
  return handler(context.request);
}
