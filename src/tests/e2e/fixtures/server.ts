import { DatabaseSync } from 'node:sqlite';
import { createLocalServer } from '../../../server/nodeServer.ts';
import { SqliteSeriesRepository } from '../../../server/repositories/sqliteRepository.ts';

// Browser tests use an isolated database and never touch server/data.
const database = new DatabaseSync(':memory:');
const repository = new SqliteSeriesRepository(database);
repository.createSeries('fearless-001');
repository.addGame('fearless-001', { gameNumber: 1, blueTeam: [266, 103, 84, 166, 12], redTeam: [32, 34, 1, 523, 22] });
repository.addGame('fearless-001', { gameNumber: 2, blueTeam: [136, 268, 432, 200, 53], redTeam: [63, 201, 51, 164, 69] });
const server = createLocalServer(repository, 'browser-test-token', 'http://127.0.0.1:5178');
server.listen(8789, '127.0.0.1');
const close = () => server.close(() => { database.close(); process.exit(0); });
process.on('SIGINT', close);
process.on('SIGTERM', close);
