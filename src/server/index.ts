import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createLocalServer } from './nodeServer.ts';
import { SqliteSeriesRepository } from './repositories/sqliteRepository.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const databasePath = resolve(root, process.env.FEARLESS_DB_PATH || 'src/server/data/fearless.db');
const writeToken = process.env.FEARLESS_API_TOKEN || '';
const adminToken = process.env.FEARLESS_ADMIN_TOKEN ?? writeToken;
const port = Number(process.env.FEARLESS_API_PORT || 8787);
const host = process.env.FEARLESS_API_HOST || '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FEARLESS_API_PORT no es válido.');

await mkdir(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
const repository = new SqliteSeriesRepository(database);
const server = createLocalServer(repository, writeToken, undefined, undefined, adminToken);
server.listen(port, host, () => { process.stdout.write(`Fearless API local: http://${host}:${port}\n`); });

const close = () => server.close(() => { database.close(); process.exit(0); });
process.on('SIGINT', close);
process.on('SIGTERM', close);
