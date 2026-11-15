export interface AllianceSide {
  name: string;
  rank: string;
  glory: string;
  division: string;
}

export interface WarEntry {
  page: number;
  title: string;
  date: string;
  left: AllianceSide;
  right: AllianceSide;
  result: string;
  stars: [string, string];
  size: string;
  notes: string;
}

export interface WarsSnapshot {
  updated_at: string;
  refresh_pages: number;
  wars: WarEntry[];
}

export type OutcomeFilter = 'all' | 'win' | 'loss' | 'time' | 'close';
export type ChartRange = '50' | '100' | 'year' | 'all';
