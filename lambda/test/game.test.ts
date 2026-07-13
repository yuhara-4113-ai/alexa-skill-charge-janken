import { describe, expect, it } from 'vitest';
import { actionCost, actions, canUseAction, decideWinner, playRound, type Winner } from '../src/game';
import { initialSession, isGameSession, resetForReplay } from '../src/session';
import { chooseAlexaAction, legalAlexaActions } from '../src/strategy';

describe('game rules', () => {
  const expectedWinners: Winner[][] = [
    ['none', 'alexa', 'alexa', 'alexa', 'none'],
    ['player', 'none', 'alexa', 'alexa', 'none'],
    ['player', 'player', 'none', 'alexa', 'none'],
    ['player', 'player', 'player', 'none', 'player'],
    ['none', 'none', 'none', 'alexa', 'none'],
  ];

  it.each(actions.flatMap((player, playerIndex) => actions.map((alexa, alexaIndex) => ({
    player,
    alexa,
    expected: expectedWinners[playerIndex][alexaIndex],
  }))))('decides $player against $alexa as $expected', ({ player, alexa, expected }) => {
    expect(decideWinner(player, alexa)).toBe(expected);
  });

  it('updates every action cost simultaneously', () => {
    expect(actionCost('attack')).toBe(1);
    expect(actionCost('fire')).toBe(2);
    expect(actionCost('blackhole')).toBe(3);
    expect(playRound({ playerPower: 0, alexaPower: 0 }, 'charge', 'defend').powers)
      .toEqual({ playerPower: 1, alexaPower: 0 });
    expect(playRound({ playerPower: 6, alexaPower: 6 }, 'fire', 'blackhole').powers)
      .toEqual({ playerPower: 4, alexaPower: 3 });
    expect(playRound({ playerPower: 3, alexaPower: 1 }, 'blackhole', 'attack').powers)
      .toEqual({ playerPower: 0, alexaPower: 0 });
  });

  it.each([
    ['attack', 0],
    ['fire', 1],
    ['blackhole', 2],
  ] as const)('does not advance %s below its required power', (action, power) => {
    const powers = { playerPower: power, alexaPower: 3 };
    expect(canUseAction('attack', 0)).toBe(false);
    expect(canUseAction(action, power)).toBe(false);
    expect(playRound(powers, action, 'blackhole')).toEqual({ valid: false, powers, winner: 'none' });
  });
});

describe('strategy', () => {
  it('only exposes actions affordable at the current power', () => {
    expect(legalAlexaActions(0)).toEqual(['charge', 'defend']);
    expect(legalAlexaActions(1)).toEqual(['charge', 'attack', 'defend']);
    expect(legalAlexaActions(2)).toEqual(['charge', 'attack', 'fire', 'defend']);
    expect(legalAlexaActions(3)).toEqual(actions);
  });

  it('chooses uniformly from available actions with injectable randomness', () => {
    expect(chooseAlexaAction(3, () => 0)).toBe('charge');
    expect(chooseAlexaAction(3, () => 0.21)).toBe('attack');
    expect(chooseAlexaAction(3, () => 0.41)).toBe('fire');
    expect(chooseAlexaAction(3, () => 0.61)).toBe('blackhole');
    expect(chooseAlexaAction(3, () => 0.99)).toBe('defend');
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
    expect(isGameSession({
      ...initialSession(),
      phase: 'AWAITING_ACTION',
      alexaPower: 1,
      pendingAlexaAction: 'fire',
    })).toBe(false);
    expect(isGameSession({
      ...initialSession(),
      phase: 'AWAITING_ACTION',
      alexaPower: 2,
      pendingAlexaAction: 'blackhole',
    })).toBe(false);
    expect(isGameSession({
      ...initialSession(),
      phase: 'AWAITING_ACTION',
      alexaPower: 3,
      pendingAlexaAction: 'blackhole',
    })).toBe(true);
  });
});
