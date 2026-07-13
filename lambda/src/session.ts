import { actions, canUseAction, type Action } from './game';

export type Phase = 'AWAITING_READY' | 'AWAITING_ACTION' | 'AWAITING_REPLAY';

export type GameSession = {
  phase: Phase;
  playerPower: number;
  alexaPower: number;
  playerWins: number;
  alexaWins: number;
  round: number;
  pendingAlexaAction?: Action;
};

const phases: Phase[] = ['AWAITING_READY', 'AWAITING_ACTION', 'AWAITING_REPLAY'];

export function initialSession(): GameSession {
  return {
    phase: 'AWAITING_READY',
    playerPower: 0,
    alexaPower: 0,
    playerWins: 0,
    alexaWins: 0,
    round: 1,
  };
}
export function resetForReplay(session: GameSession): GameSession {
  return {
    ...initialSession(),
    phase: 'AWAITING_ACTION',
    playerWins: session.playerWins,
    alexaWins: session.alexaWins,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (actions as readonly string[]).includes(value);
}

export function isGameSession(value: unknown): value is GameSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  if (
    typeof session.phase !== 'string' ||
    !phases.includes(session.phase as Phase) ||
    !isNonNegativeInteger(session.playerPower) ||
    !isNonNegativeInteger(session.alexaPower) ||
    !isNonNegativeInteger(session.playerWins) ||
    !isNonNegativeInteger(session.alexaWins) ||
    !isNonNegativeInteger(session.round) ||
    session.round < 1
  ) {
    return false;
  }

  if (session.phase !== 'AWAITING_ACTION') return session.pendingAlexaAction === undefined;
  if (!isAction(session.pendingAlexaAction)) return false;
  return canUseAction(session.pendingAlexaAction, session.alexaPower);
}

export function readSession(attributes: unknown): GameSession {
  return isGameSession(attributes) ? attributes : initialSession();
}
