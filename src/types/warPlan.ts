export type WarPlanSize = '10v10' | '15v15' | '20v20' | '30v30';
export type PlayerLine = 'Def' | 'Atk';
export type WarDirective = 'espiar' | 'libre' | 'esperar';

export interface WarPlanPlayer {
  id: string;
  name: string;
  line: PlayerLine;
  objective: string;
}

export interface WarPlanSnapshot {
  updated_at: string;
  warSize: WarPlanSize;
  players: WarPlanPlayer[];
}
