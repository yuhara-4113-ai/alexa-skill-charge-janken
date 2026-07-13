export const actions = ['charge', 'attack', 'fire', 'blackhole', 'defend'] as const;

export type Action = (typeof actions)[number];
export type Winner = 'player' | 'alexa' | 'none';

export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (actions as readonly string[]).includes(value);
}

export type Powers = {
  playerPower: number;
  alexaPower: number;
};

export type RoundResult = {
  valid: boolean;
  powers: Powers;
  winner: Winner;
};

const actionCosts: Record<Action, number> = {
  charge: 0,
  attack: 1,
  fire: 2,
  blackhole: 3,
  defend: 0,
};

const attackStrengths: Partial<Record<Action, number>> = {
  attack: 1,
  fire: 2,
  blackhole: 3,
};

export function actionCost(action: Action): number {
  return actionCosts[action];
}

export function canUseAction(action: Action, power: number): boolean {
  return power >= actionCost(action);
}

function updatePower(action: Action, power: number): number {
  if (action === 'charge') return power + 1;
  return power - actionCost(action);
}

export function decideWinner(playerAction: Action, alexaAction: Action): Winner {
  const playerStrength = attackStrengths[playerAction];
  const alexaStrength = attackStrengths[alexaAction];

  if (playerStrength !== undefined && alexaAction === 'charge') return 'player';
  if (alexaStrength !== undefined && playerAction === 'charge') return 'alexa';

  if (playerStrength !== undefined && alexaStrength !== undefined) {
    if (playerStrength > alexaStrength) return 'player';
    if (alexaStrength > playerStrength) return 'alexa';
    return 'none';
  }

  if (playerAction === 'blackhole' && alexaAction === 'defend') return 'player';
  if (alexaAction === 'blackhole' && playerAction === 'defend') return 'alexa';
  return 'none';
}

export function playRound(
  powers: Powers,
  playerAction: Action,
  alexaAction: Action,
): RoundResult {
  if (!canUseAction(playerAction, powers.playerPower)) {
    return { valid: false, powers, winner: 'none' };
  }

  return {
    valid: true,
    powers: {
      playerPower: updatePower(playerAction, powers.playerPower),
      alexaPower: updatePower(alexaAction, powers.alexaPower),
    },
    winner: decideWinner(playerAction, alexaAction),
  };
}
