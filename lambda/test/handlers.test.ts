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

function responseSpeech(response: { outputSpeech?: { type?: string; ssml?: string; text?: string } }): string {
  if (response.outputSpeech?.type === 'SSML') return response.outputSpeech.ssml ?? '';
  return response.outputSpeech?.text ?? '';
}

describe('ASK handlers', () => {
  it('starts with a fixed Alexa charge on the first round', () => {
    expect(prepareActionRound({ ...initialSession(), phase: 'AWAITING_ACTION' }, () => 0.99).pendingAlexaAction)
      .toBe('charge');
  });

  it('keeps the hidden Alexa hand when player attack lacks power', async () => {
    const state = {
      ...initialSession(),
      phase: 'AWAITING_ACTION' as const,
      pendingAlexaAction: 'charge' as const,
    };
    const response = await createSkill(skillId).invoke(envelope(actionRequest('attack'), state));
    expect(response.response.shouldEndSession).toBe(false);
    expect(response.sessionAttributes).toMatchObject({
      ...state,
      pendingAlexaAction: 'charge',
    });
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
    expect(help.sessionAttributes).toMatchObject(state);

    const fallback = await createSkill(skillId).invoke(envelope({
      type: 'IntentRequest',
      intent: { name: 'AMAZON.FallbackIntent', confirmationStatus: 'NONE', slots: {} },
    }, state));
    expect(fallback.response.shouldEndSession).toBe(false);
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

  it('rejects requests for a different skill ID', async () => {
    const wrongSkillRequest = envelope({ type: 'LaunchRequest' });
    wrongSkillRequest.context.System.application.applicationId = 'amzn1.ask.skill.other';
    await expect(createSkill(skillId).invoke(wrongSkillRequest)).rejects.toThrow();
  });
});
