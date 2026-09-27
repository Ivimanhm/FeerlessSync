import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ApiFault } from './errors.ts';
import { createApiHandler } from './routes/api.ts';
import type { ChampionCatalogProvider, SeriesRepository } from './types.ts';

async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (!['POST', 'PATCH', 'PUT'].includes(request.method ?? '')) return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += bytes.length;
    if (size > 64 * 1024) throw new ApiFault(413, 'body_too_large', 'El cuerpo supera el límite de 64 KiB.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

async function respond(incoming: IncomingMessage, outgoing: ServerResponse, handler: (request: Request) => Promise<Response>): Promise<void> {
  try {
    const body = await readBody(incoming);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === 'string') headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(', '));
    }
    const request = new Request(new URL(incoming.url ?? '/', 'http://localhost'), {
      method: incoming.method,
      headers,
      body: body?.toString('utf8'),
    });
    const response = await handler(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const status = error instanceof ApiFault ? error.status : 500;
    const code = error instanceof ApiFault ? error.code : 'internal_error';
    outgoing.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    outgoing.end(JSON.stringify({ success: false, error: code }));
  }
}

export function createLocalServer(repository: SeriesRepository, writeToken: string, allowedOrigin: string | string[] = ['http://localhost:5173', 'http://127.0.0.1:5173'], catalogProvider?: ChampionCatalogProvider, adminToken = writeToken) {
  const handler = createApiHandler(repository, { writeToken, adminToken, allowedOrigin, catalogProvider });
  return createServer((incoming, outgoing) => { void respond(incoming, outgoing, handler); });
}
