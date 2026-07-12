import { describe, expect, it } from 'vitest';
import { canUseAction, decideWinner, playRound } from '../src/game';
import { initialSession, isGameSession, resetForReplay } from '../src/session';
import { chooseAlexaAction, legalAlexaActions } from '../src/strategy';

describe('game rules', () => {
  const allActions = ['charge', 'attack', 'defend'] as const;

  it.each(allActions.flatMap((player) => allActions.map((alexa) => [player, alexa])))('decides %s against %s', (player, alexa) => {
    const expected = player === 'attack' && alexa === 'charge'
      ? 'player'
      : player === 'charge' && alexa === 'attack'
        ? 'alexa'
        : 'none';
    expect(decideWinner(player, alexa)).toBe(expected);
  });

  it('updates charge, attack, and defend simultaneously', () => {
    expect(playRound({ playerPower: 0, alexaPower: 0 }, 'charge', 'defend').powers)
      .toEqual({ playerPower: 1, alexaPower: 0 });
    expect(playRound({ playerPower: 1, alexaPower: 1 }, 'attack', 'attack').powers)
      .toEqual({ playerPower: 0, alexaPower: 0 });
    expect(playRound({ playerPower: 1, alexaPower: 1 }, 'attack', 'defend').powers)
      .toEqual({ playerPower: 0, alexaPower: 1 });
  });

  it('does not advance a zero-power attack', () => {
    const powers = { playerPower: 0, alexaPower: 1 };
    expect(canUseAction('attack', 0)).toBe(false);
    expect(playRound(powers, 'attack', 'attack')).toEqual({ valid: false, powers, winner: 'none' });
  });
});

describe('strategy', () => {
  it('never chooses attack at zero power', () => {
    expect(legalAlexaActions(0)).toEqual(['charge', 'defend']);
    expect(chooseAlexaAction(0, () => 0.99)).toBe('defend');
  });

  it('chooses uniformly from available actions with injectable randomness', () => {
    expect(chooseAlexaAction(1, () => 0)).toBe('charge');
    expect(chooseAlexaAction(1, () => 0.5)).toBe('attack');
    expect(chooseAlexaAction(1, () => 0.99)).toBe('defend');
  });
});

describe('session state', () => {
  it('preserves wins and resets round state for replay', () => {
    expect(resetForReplay({
      ...initialSession(),
      phase: 'AWAITING_REPLAY',
      playerPower: 3,
      alexaPower: 2,
      playerWins: 2,
      alexaWins: 1,
      round: 4,
    })).toEqual({
      phase: 'AWAITING_ACTION',
      playerPower: 0,
      alexaPower: 0,
      playerWins: 2,
      alexaWins: 1,
      round: 1,
    });
  });

  it('rejects malformed and action-phase sessions without a pending hand', () => {
    expect(isGameSession({ phase: 'AWAITING_ACTION', playerPower: 0 })).toBe(false);
    expect(isGameSession({ ...initialSession(), playerPower: -1 })).toBe(false);
    expect(isGameSession({ ...initialSession(), pendingAlexaAction: 'charge' })).toBe(false);
    expect(isGameSession({
      ...initialSession(),
      phase: 'AWAITING_ACTION',
      pendingAlexaAction: 'attack',
    })).toBe(false);
  });
});
