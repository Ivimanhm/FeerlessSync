export type TeamSide = 'blue' | 'red';
export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';

export interface Champion {
  id: number;
  name: string;
  imageUrl?: string;
  roles: Role[];
  searchAliases?: string[];
}

export interface PlayedChampion {
  championId: number;
  championName: string;
  imageUrl?: string;
  team: TeamSide;
  role: Role | null;
}

export interface Game {
  gameNumber: number;
  date: string;
  winner: TeamSide | null;
  champions: PlayedChampion[];
}

export interface FearlessSeries {
  seriesId: string;
  updatedAt: string | null;
  usedChampions: number[];
  gamesCount: number;
  usedChampionsCount: number;
  availableChampionsCount: number;
  totalChampionsCount: number;
  availableChampions: Champion[];
  games: Game[];
}
