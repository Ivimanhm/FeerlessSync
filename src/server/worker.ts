import { ensureD1Schema } from './d1Schema.ts';
import { D1SeriesRepository, type D1DatabaseLike } from './repositories/d1Repository.ts';
import { createApiHandler } from './routes/api.ts';
import { staticAssets } from './staticAssets.generated.ts';

interface SiteEnvironment {
  DB?: D1DatabaseLike;
  FEARLESS_ADMIN_TOKEN?: string;
}

function serveEmbeddedAsset(pathname: string): Response | undefined {
  const asset = staticAssets[pathname];
  if (!asset) return undefined;
  const bytes = Uint8Array.from(atob(asset.data), (character) => character.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': asset.type,
      'Cache-Control': pathname === '/' ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  });
}

async function servePublicAsset(pathname: string): Promise<Response> {
  if (!/^\/(?:Logo\.png|landscape\.png|champions\/[A-Za-z0-9]+\.png)$/.test(pathname)) {
    return new Response('Not found', { status: 404 });
  }
  const upstream = new URL(`https://cdn.jsdelivr.net/gh/Ivimanhm/FeerlessSync@1.0.0/src/frontend/public${pathname}`);
  const response = await fetch(upstream);
  if (!response.ok) return new Response('Not found', { status: 404 });
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.delete('Access-Control-Allow-Origin');
  return new Response(response.body, { status: response.status, headers });
}

const initializedDatabases = new WeakMap<object, Promise<void>>();

function prepareDatabase(database: D1DatabaseLike): Promise<void> {
  const key = database as object;
  let pending = initializedDatabases.get(key);
  if (!pending) {
    pending = ensureD1Schema(database).catch((error: unknown) => {
      initializedDatabases.delete(key);
      throw error;
    });
    initializedDatabases.set(key, pending);
  }
  return pending;
}

function unavailable(request: Request, message: string): Response {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  if (request.method.toUpperCase() === 'OPTIONS') return new Response(null, { status: 204, headers });
  return Response.json({ success: false, error: 'database_unavailable', message }, { status: 503, headers });
}

async function handleApi(request: Request, env: SiteEnvironment): Promise<Response> {
  if (request.method.toUpperCase() === 'OPTIONS') return unavailable(request, '');
  if (!env.DB) return unavailable(request, 'Falta la base de datos DB.');
  try {
    await prepareDatabase(env.DB);
  } catch {
    return unavailable(request, 'No se pudo preparar el esquema de la base de datos.');
  }
  const handler = createApiHandler(new D1SeriesRepository(env.DB), {
    adminToken: env.FEARLESS_ADMIN_TOKEN ?? '',
  });
  return handler(request);
}

export default {
  async fetch(request: Request, env: SiteEnvironment): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(request, env);
    const embedded = serveEmbeddedAsset(pathname);
    if (embedded) return embedded;
    if (pathname === '/Logo.png' || pathname === '/landscape.png' || pathname.startsWith('/champions/')) {
      return servePublicAsset(pathname);
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      return serveEmbeddedAsset('/') ?? new Response('Not found', { status: 404 });
    }
    return new Response('Not found', { status: 404 });
  },
};
