import { ApiFault } from '../errors.ts';
import type { NewGame } from '../types.ts';

export function validateGame(body: Record<string, unknown>): NewGame {
  const { gameNumber, blueTeam, redTeam } = body;
  if (typeof gameNumber !== 'number' || !Number.isSafeInteger(gameNumber) || gameNumber < 1) {
    throw new ApiFault(400, 'invalid_game_number', 'gameNumber debe ser un entero positivo.');
  }
  const validTeam = (team: unknown): team is number[] =>
    Array.isArray(team) && team.length === 5 && team.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);
  if (!validTeam(blueTeam) || !validTeam(redTeam)) {
    throw new ApiFault(400, 'invalid_teams', 'Cada equipo debe tener cinco IDs numéricos válidos.');
  }
  if (new Set([...blueTeam, ...redTeam]).size !== 10) {
    throw new ApiFault(400, 'duplicate_champion', 'No puede haber campeones repetidos entre los equipos.');
  }
  return { gameNumber, blueTeam, redTeam };
}

export function seriesIdFrom(segment: string): string {
  let seriesId: string;
  try { seriesId = decodeURIComponent(segment); }
  catch { throw new ApiFault(400, 'invalid_series_id', 'El ID de serie no es válido.'); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(seriesId) || seriesId === 'count') {
    throw new ApiFault(400, 'invalid_series_id', 'El ID de serie no es válido.');
  }
  return seriesId;
}

export function gameNumberFrom(segment: string): number {
  if (!/^[1-9]\d*$/.test(segment)) throw new ApiFault(400, 'invalid_game_number', 'gameNumber debe ser un entero positivo.');
  const gameNumber = Number(segment);
  if (!Number.isSafeInteger(gameNumber)) throw new ApiFault(400, 'invalid_game_number', 'gameNumber debe ser un entero positivo.');
  return gameNumber;
}

