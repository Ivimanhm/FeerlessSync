import { DatabaseSync } from 'node:sqlite';
import { createLocalServer } from '../../../server/nodeServer.ts';
import { SqliteSeriesRepository } from '../../../server/repositories/sqliteRepository.ts';

// Browser tests use an isolated database and never touch server/data.
const database = new DatabaseSync(':memory:');
const repository = new SqliteSeriesRepository(database);
repository.createSeries('fearless-001');
repository.addGame('fearless-001', { gameNumber: 1, blueTeam: [266, 32, 103, 523, 12], redTeam: [122, 131, 84, 22, 201] });
repository.addGame('fearless-001', { gameNumber: 2, blueTeam: [164, 245, 34, 51, 53], redTeam: [86, 60, 1, 119, 432] });
repository.setWinner('fearless-001', 1, 'blue');
// Repeated champions in other series exercise the global victory ranking.
for (const seriesId of ['fearless-002', 'fearless-003']) {
  repository.createSeries(seriesId);
  repository.addGame(seriesId, { gameNumber: 1, blueTeam: [266, 32, 103, 523, 12], redTeam: [122, 131, 84, 22, 201] });
  repository.setWinner(seriesId, 1, seriesId === 'fearless-002' ? 'blue' : 'red');
}
const server = createLocalServer(repository, 'browser-test-token', 'http://127.0.0.1:5178');
server.listen(8789, '127.0.0.1');
const close = () => server.close(() => { database.close(); process.exit(0); });
process.on('SIGINT', close);
process.on('SIGTERM', close);
