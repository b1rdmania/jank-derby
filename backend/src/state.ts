import type { Horse } from './damlIds.js';

export type RacePhase = 'Committed' | 'BettingClosed' | 'Running' | 'Finished' | 'Cancelled';

export interface ActiveRace {
  raceId: string;
  contractId: string;
  state: RacePhase;
  bettingDeadline: string;
  winner?: Horse;
  positions: Array<{ horse: Horse; position: number }>;
  tickNumber: number;
}

export interface BackendState {
  races: Record<string, ActiveRace>;
  seeds: Record<string, string>; // raceId -> seed (kept until reveal)
  parties: Record<string, string>; // hint -> allocated party id
}

export const backendState: BackendState = {
  races: {},
  seeds: {},
  parties: {},
};

