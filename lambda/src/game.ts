export const actions = ['charge', 'attack', 'defend'] as const;

export type Action = (typeof actions)[number];
export type Winner = 'player' | 'alexa' | 'none';

export type Powers = {
  playerPower: number;
  alexaPower: number;
};

export type RoundResult = {
  valid: boolean;
  powers: Powers;
  winner: Winner;
};

export function canUseAction(action: Action, power: number): boolean {
  return action !== 'attack' || power >= 1;
}
function updatePower(action: Action, power: number): number {
  if (action === 'charge') return power + 1;
  if (action === 'attack') return power - 1;
  return power;
}

export function decideWinner(playerAction: Action, alexaAction: Action): Winner {
  if (playerAction === 'attack' && alexaAction === 'charge') return 'player';
  if (playerAction === 'charge' && alexaAction === 'attack') return 'alexa';
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
