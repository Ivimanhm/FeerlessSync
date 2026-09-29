import type { TeamSide } from './fearless';

export interface CreateSeriesRequest {
  seriesId: string;
}

export interface CreateGameRequest {
  gameNumber: number;
  blueTeam: [number, number, number, number, number];
  redTeam: [number, number, number, number, number];
}

export interface SetWinnerRequest {
  winner: TeamSide | null;
}

export interface ApiErrorBody {
  success: false;
  error: string;
  message?: string;
}
