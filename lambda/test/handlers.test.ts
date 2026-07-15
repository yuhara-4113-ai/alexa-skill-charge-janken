import { describe, expect, it } from 'vitest';
import { type RequestEnvelope } from 'ask-sdk-model';
import { createSkill, prepareActionRound } from '../src/index';
import { initialSession } from '../src/session';

const skillId = 'amzn1.ask.skill.local-test';

function envelope(request: Record<string, unknown>, attributes: Record<string, unknown> = {}): RequestEnvelope {
  return {
    version: '1.0',
    session: {
      new: false,
      sessionId: 'SessionId.local-test',
      application: { applicationId: skillId },
      user: { userId: 'amzn1.ask.account.local-test' },
      attributes,
    },
    context: {
      System: {
        application: { applicationId: skillId },
        user: { userId: 'amzn1.ask.account.local-test' },
        device: { deviceId: 'local-device', supportedInterfaces: {} },
      },
    },
    request: {
      requestId: 'EdwRequestId.local-test',
      timestamp: '2026-07-12T00:00:00Z',
      locale: 'ja-JP',
      ...request,
    },
  } as RequestEnvelope;
}

function actionRequest(id: string): Record<string, unknown> {
  return {
    type: 'IntentRequest',
    dialogState: 'COMPLETED',
    intent: {
      name: 'ActionIntent',
      confirmationStatus: 'NONE',
      slots: {
        action: {
          name: 'action',
          confirmationStatus: 'NONE',
          resolutions: {
            resolutionsPerAuthority: [{
              authority: 'amzn1.er-authority.echo-sdk.local.ACTION_TYPE',
              status: { code: 'ER_SUCCESS_MATCH' },
              values: [{ value: { name: id, id } }],
            }],
          },
        },
      },
    },
  };
}

function rawActionRequest(value: string, resolutionCode = 'ER_SUCCESS_NO_MATCH'): Record<string, unknown> {
  return {
    type: 'IntentRequest',
    dialogState: 'COMPLETED',
    intent: {
      name: 'ActionIntent',
      confirmationStatus: 'NONE',
      slots: {
        action: {
          name: 'action',
          value,
          confirmationStatus: 'NONE',
          resolutions: {
            resolutionsPerAuthority: [{
              authority: 'amzn1.er-authority.echo-sdk.local.ACTION_TYPE',
              status: { code: resolutionCode },
            }],
          },
        },
      },
    },
  };
}

function responseSpeech(response: { outputSpeech?: { type?: string; ssml?: string; text?: string } }): string {
  if (response.outputSpeech?.type === 'SSML') {
    return (response.outputSpeech.ssml ?? '').replace(/^<speak>|<\/speak>$/g, '');
  }
  return response.outputSpeech?.text ?? '';
}

describe('ASK handlers', () => {
  it('starts the first action without a ready confirmation or round number', async () => {
    const response = await createSkill(skillId).invoke(envelope({ type: 'LaunchRequest' }));
    const speech = responseSpeech(response.response);

    expect(speech).toBe('チャージじゃんけんへようこそ。チャージ、ビーム、ファイアー、ブラックホール、ガードのどれかを言ってね。せーの。');
    expect(speech).not.toContain('準備');
    expect(speech).not.toContain('第');
    expect(response.sessionAttributes).toMatchObject({
      phase: 'AWAITING_ACTION',
      pendingAlexaAction: 'charge',
    });
  });

  it('keeps only Alexa hand and moves directly to the next round on a tie', async () => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'defend' as const,
    };
    const response = await createSkill(skillId).invoke(envelope(actionRequest('defend'), state));
    const speech = responseSpeech(response.response);

    expect(speech).toBe('私はガード。せーの。');
    expect(speech).not.toContain('あなたは');
    expect(speech).not.toContain('引き分け');
    expect(speech).not.toContain('第');
    expect(speech).not.toContain('チャージ、ビーム、ファイアー');
  });

  it('keeps Alexa hand, winner, and replay confirmation when the game ends', async () => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'charge' as const,
      playerPower: 1,
    };
    const response = await createSkill(skillId).invoke(envelope(actionRequest('attack'), state));
    const speech = responseSpeech(response.response);

    expect(speech).toBe('私はチャージ。あなたの勝ち！ もう一回やる？');
    expect(speech).not.toContain('あなたは');
    expect(speech).not.toContain('第');
  });

  it('starts a replay with a short action prompt and keeps the score', async () => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_REPLAY' as const,
      playerWins: 1,
      alexaWins: 2,
    };
    const response = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.YesIntent', confirmationStatus: 'NONE', slots: {} },
    }, state));

    expect(responseSpeech(response.response)).toBe('せーの。');
    expect(response.sessionAttributes).toMatchObject({
      phase: 'AWAITING_ACTION',
      round: 1,
      playerWins: 1,
      alexaWins: 2,
    });
  });

  it('keeps the action choices on the initial launch', async () => {
    const response = await createSkill(skillId).invoke(envelope({ type: 'LaunchRequest' }));
    expect(responseSpeech(response.response)).toContain('チャージ、ビーム、ファイアー、ブラックホール、ガード');
  });

  it('starts with a fixed Alexa charge on the first round', () => {
    expect(prepareActionRound({ ...initialSession(), phase: 'AWAITING_ACTION' }, () => 0.99).pendingAlexaAction)
      .toBe('charge');
  });

  it('keeps the hidden Alexa hand and uses the player-facing name when attack lacks power', async () => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'charge' as const,
    };
    const response = await createSkill(skillId).invoke(envelope(actionRequest('attack'), state));
    expect(response.response.shouldEndSession).toBe(false);
    expect(responseSpeech(response.response)).toContain('ビームにはパワーが1必要');
    expect(response.sessionAttributes).toMatchObject({
      ...state,
      pendingAlexaAction: 'charge',
    });
  });

  it.each([
    ['fire', 1, 'ファイアーにはパワーが2必要'],
    ['blackhole', 2, 'ブラックホールにはパワーが3必要'],
  ] as const)('keeps state when %s lacks power', async (action, playerPower, guidance) => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'blackhole' as const,
      playerPower,
      alexaPower: 3,
      round: 4,
    };
    const response = await createSkill(skillId).invoke(envelope(actionRequest(action), state));

    expect(responseSpeech(response.response)).toContain(guidance);
    expect(response.sessionAttributes).toEqual(state);
  });

  it('resolves fire and blackhole actions and applies their outcomes', async () => {
    const fireState = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'attack' as const,
      playerPower: 2,
      alexaPower: 1,
      round: 2,
    };
    const fire = await createSkill(skillId).invoke(envelope(actionRequest('fire'), fireState));
    expect(responseSpeech(fire.response)).toBe('私はビーム。あなたの勝ち！ もう一回やる？');
    expect(fire.sessionAttributes).toMatchObject({ playerPower: 0, alexaPower: 0 });

    const blackholeState = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'blackhole' as const,
      playerPower: 0,
      alexaPower: 3,
      round: 4,
    };
    const blackhole = await createSkill(skillId).invoke(envelope(actionRequest('defend'), blackholeState));
    expect(responseSpeech(blackhole.response)).toBe('私はブラックホール。私の勝ち！ もう一回やる？');
    expect(blackhole.sessionAttributes).toMatchObject({ playerPower: 0, alexaPower: 0 });
  });

  it.each([
    ['ファイア', 'fire'],
    ['ファイヤ', 'fire'],
    ['バリア', 'defend'],
    ['バリアー', 'defend'],
    ['ビーモ', 'attack'],
  ] as const)('uses the raw slot fallback for %s', async (value, action) => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: action === 'fire' ? 'charge' as const : 'attack' as const,
      playerPower: action === 'fire' ? 2 : action === 'attack' ? 1 : 0,
      alexaPower: action === 'fire' ? 0 : 1,
    };
    const response = await createSkill(skillId).invoke(envelope(rawActionRequest(value), state));

    expect(response.sessionAttributes).not.toEqual(state);
    expect(responseSpeech(response.response)).toContain('私は');
  });

  it.each([
    ['チャーハン', 'charge', 'attack', 0, '私はビーム。私の勝ち！ もう一回やる？'],
    ['ちゃーはん', 'charge', 'attack', 0, '私はビーム。私の勝ち！ もう一回やる？'],
    ['チャート', 'charge', 'attack', 0, '私はビーム。私の勝ち！ もう一回やる？'],
    ['チャー', 'charge', 'attack', 0, '私はビーム。私の勝ち！ もう一回やる？'],
    ['ビーモ', 'attack', 'charge', 1, '私はチャージ。あなたの勝ち！ もう一回やる？'],
    ['ビール', 'attack', 'charge', 1, '私はチャージ。あなたの勝ち！ もう一回やる？'],
    ['びーる', 'attack', 'charge', 1, '私はチャージ。あなたの勝ち！ もう一回やる？'],
    ['ビー', 'attack', 'charge', 1, '私はチャージ。あなたの勝ち！ もう一回やる？'],
    ['ガードー', 'defend', 'attack', 0, '私はビーム。せーの。'],
    ['がーどー', 'defend', 'attack', 0, '私はビーム。せーの。'],
    ['ガー', 'defend', 'attack', 0, '私はビーム。せーの。'],
  ] as const)('uses the %s prefix fallback as %s', async (value, action, pendingAlexaAction, playerPower, expectedSpeech) => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction,
      playerPower,
      alexaPower: pendingAlexaAction === 'attack' ? 1 : 0,
    };
    const response = await createSkill(skillId).invoke(envelope(rawActionRequest(value), state));

    expect(responseSpeech(response.response)).toBe(expectedSpeech);
  });

  it('prefers entity resolution over the raw slot value', async () => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'charge' as const,
      playerPower: 1,
    };
    const request = actionRequest('attack');
    const slot = (request.intent as { slots: Record<string, { value?: string }> }).slots.action;
    slot.value = 'ファイア';
    const response = await createSkill(skillId).invoke(envelope(request, state));

    expect(responseSpeech(response.response)).toContain('あなたの勝ち');
  });

  it.each(['charge', 'Attack', 'FIRE', 'BlackHole', 'defend'])('accepts a raw Action ID case-insensitively: %s', async (value) => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'charge' as const,
      playerPower: 3,
    };
    const response = await createSkill(skillId).invoke(envelope(rawActionRequest(value), state));

    expect(response.sessionAttributes).not.toEqual(state);
    expect(responseSpeech(response.response)).toContain('私は');
  });

  it.each(['強い技', 'ファンタジー', 'ブラボー', 'toString', 'constructor'])('does not guess an unknown raw slot value: %s', async (value) => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'charge' as const,
    };
    const response = await createSkill(skillId).invoke(envelope(rawActionRequest(value), state));

    expect(response.sessionAttributes).toEqual(state);
    expect(responseSpeech(response.response)).toContain('どれかを言ってね');
  });

  it.each([
    ['ReplayYesIntent', 'せーの。'],
    ['AMAZON.YesIntent', 'せーの。'],
  ] as const)('starts a replay from %s', async (intentName, speech) => {
    const state = { ...initialSession(), phase: 'AWAITING_REPLAY' as const, playerWins: 1, alexaWins: 2 };
    const response = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: intentName, confirmationStatus: 'NONE', slots: {} },
    }, state));

    expect(responseSpeech(response.response)).toBe(speech);
    expect(response.sessionAttributes).toMatchObject({ phase: 'AWAITING_ACTION', round: 1, pendingAlexaAction: 'charge', playerWins: 1, alexaWins: 2 });
  });

  it.each(['ReplayNoIntent', 'AMAZON.NoIntent'] as const)('ends from replay with %s', async (intentName) => {
    const state = { ...initialSession(), phase: 'AWAITING_REPLAY' as const, playerWins: 1, alexaWins: 2 };
    const response = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: intentName, confirmationStatus: 'NONE', slots: {} },
    }, state));

    expect(response.response.shouldEndSession).toBe(true);
    expect(responseSpeech(response.response)).toContain('通算はあなた1勝、私2勝');
  });

  it('does not advance action intent outside the action phase', async () => {
    const response = await createSkill(skillId).invoke(envelope(actionRequest('charge'), initialSession()));
    expect(responseSpeech(response.response)).toContain('はい');
    expect(response.sessionAttributes).toMatchObject(initialSession());
  });

  it('keeps help and fallback in the current phase and ends on stop', async () => {
    const state = prepareActionRound({ ...initialSession(), phase: 'AWAITING_ACTION' });
    const help = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.HelpIntent', confirmationStatus: 'NONE', slots: {} },
    }, state));
    expect(help.response.shouldEndSession).toBe(false);
    expect(responseSpeech(help.response)).toContain('ファイアーは2、ブラックホールは3');
    expect(responseSpeech(help.response)).toContain('ブラックホールはガードを貫通');
    expect(help.sessionAttributes).toMatchObject(state);

    const fallback = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.FallbackIntent', confirmationStatus: 'NONE', slots: {} },
    }, state));
    expect(fallback.response.shouldEndSession).toBe(false);
    expect(responseSpeech(fallback.response)).toBe('もう一回お願いします');
    expect(responseSpeech({ outputSpeech: fallback.response.reprompt?.outputSpeech })).toBe('もう一回お願いします');
    expect(fallback.sessionAttributes).toMatchObject(state);

    const stop = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.StopIntent', confirmationStatus: 'NONE', slots: {} },
    }, state));
    expect(stop.response.shouldEndSession).toBe(true);
  });

  it('does not treat no as quitting while choosing an action', async () => {
    const state = prepareActionRound({ ...initialSession(), phase: 'AWAITING_ACTION' });
    const response = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.NoIntent', confirmationStatus: 'NONE', slots: {} },
    }, state));

    expect(response.response.shouldEndSession).toBe(false);
    expect(responseSpeech(response.response)).toContain('ゲームを続ける');
    expect(response.sessionAttributes).toMatchObject(state);
  });

  it('omits an empty score when declining before the first round', async () => {
    const response = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.NoIntent', confirmationStatus: 'NONE', slots: {} },
    }, initialSession()));

    expect(response.response.shouldEndSession).toBe(true);
    expect(responseSpeech(response.response)).not.toContain('通算');
    expect(responseSpeech(response.response)).toContain('また遊んでね');
  });

  it('rejects requests for a different skill ID', async () => {
    const wrongSkillRequest = envelope({ type: 'LaunchRequest' });
    wrongSkillRequest.context.System.application.applicationId = 'amzn1.ask.skill.other';
    await expect(createSkill(skillId).invoke(wrongSkillRequest)).rejects.toThrow();
  });
});
