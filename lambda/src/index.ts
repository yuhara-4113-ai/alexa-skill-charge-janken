import {
  getIntentName,
  getRequestType,
  SkillBuilders,
  type HandlerInput,
} from 'ask-sdk-core';
import { type Response } from 'ask-sdk-model';
import { type Action, playRound } from './game';
import { initialSession, readSession, resetForReplay, type GameSession } from './session';
import { chooseAlexaAction, type Random } from './strategy';

const actionNames: Record<Action, string> = {
  charge: '溜め',
  attack: '攻撃',
  defend: '防御',
};

const actionPrompt = '溜め、攻撃、防御のどれかを言ってね。せーの。';

function saveSession(input: HandlerInput, session: GameSession): void {
  input.attributesManager.setSessionAttributes(session);
}

function ask(input: HandlerInput, session: GameSession, speech: string, reprompt = actionPrompt): Response {
  saveSession(input, session);
  return input.responseBuilder
    .speak(speech)
    .reprompt(reprompt)
    .withShouldEndSession(false)
    .getResponse();
}

function end(input: HandlerInput, session: GameSession, speech: string): Response {
  saveSession(input, session);
  return input.responseBuilder.speak(speech).withShouldEndSession(true).getResponse();
}

export function prepareActionRound(session: GameSession, random: Random = Math.random): GameSession {
  return {
    ...session,
    phase: 'AWAITING_ACTION',
    pendingAlexaAction: session.round === 1 ? 'charge' : chooseAlexaAction(session.alexaPower, random),
  };
}

function resolvedAction(input: HandlerInput): Action | undefined {
  const request = input.requestEnvelope.request;
  if (request.type !== 'IntentRequest' || request.intent.name !== 'ActionIntent') return undefined;
  const resolutions = request.intent.slots?.action?.resolutions?.resolutionsPerAuthority;
  const match = resolutions?.find((resolution) => resolution.status.code === 'ER_SUCCESS_MATCH');
  const id = match?.values?.[0]?.value.id;
  return id === 'charge' || id === 'attack' || id === 'defend' ? id : undefined;
}

function sessionFor(input: HandlerInput): GameSession {
  return readSession(input.attributesManager.getSessionAttributes());
}

function phaseGuidance(session: GameSession): string {
  if (session.phase === 'AWAITING_READY') return '準備ができたら、「はい」か「スタート」と言ってね。';
  if (session.phase === 'AWAITING_REPLAY') return 'もう一回なら「はい」、終わるなら「いいえ」と言ってね。';
  return '溜め、攻撃、防御のどれかを言ってね。';
}

function startOrReplay(input: HandlerInput, session: GameSession): Response {
  const reset = session.phase === 'AWAITING_REPLAY' ? resetForReplay(session) : {
    ...initialSession(),
    playerWins: session.playerWins,
    alexaWins: session.alexaWins,
  };
  const next = prepareActionRound(reset);
  return ask(input, next, actionPrompt);
}

const LaunchRequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === 'LaunchRequest';
  },
  handle(input: HandlerInput): Response {
    const session = prepareActionRound(initialSession());
    return ask(input, session, `チャージじゃんけんへようこそ。${actionPrompt}`);
  },
};

const StartHandler = {
  canHandle(input: HandlerInput): boolean {
    const type = getRequestType(input.requestEnvelope);
    const name = type === 'IntentRequest' ? getIntentName(input.requestEnvelope) : undefined;
    return name === 'StartGameIntent' || name === 'AMAZON.YesIntent';
  },
  handle(input: HandlerInput): Response {
    const session = sessionFor(input);
    if (session.phase === 'AWAITING_ACTION') return ask(input, session, phaseGuidance(session));
    return startOrReplay(input, session);
  },
};

const ActionHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === 'IntentRequest' && getIntentName(input.requestEnvelope) === 'ActionIntent';
  },
  handle(input: HandlerInput): Response {
    const session = sessionFor(input);
    if (session.phase !== 'AWAITING_ACTION' || !session.pendingAlexaAction) {
      return ask(input, session, phaseGuidance(session), phaseGuidance(session));
    }

    const playerAction = resolvedAction(input);
    if (!playerAction) {
      return ask(input, session, '溜め、攻撃、防御のどれかを言ってね。');
    }

    const result = playRound(session, playerAction, session.pendingAlexaAction);
    if (!result.valid) {
      return ask(input, session, 'パワーが足りないから攻撃はできないよ。溜めか防御を選んでね。');
    }

    const roundSpeech = `私は${actionNames[session.pendingAlexaAction]}。`;
    if (result.winner !== 'none') {
      const playerWon = result.winner === 'player';
      const next: GameSession = {
        ...session,
        ...result.powers,
        phase: 'AWAITING_REPLAY',
        playerWins: session.playerWins + (playerWon ? 1 : 0),
        alexaWins: session.alexaWins + (playerWon ? 0 : 1),
        pendingAlexaAction: undefined,
      };
      return ask(
        input,
        next,
        `${roundSpeech}${playerWon ? 'あなたの勝ち！' : '私の勝ち！'} もう一回やる？`,
        'もう一回なら「はい」、終わるなら「いいえ」と言ってね。',
      );
    }

    const next = prepareActionRound({
      ...session,
      ...result.powers,
      round: session.round + 1,
      pendingAlexaAction: undefined,
    });
    return ask(input, next, `${roundSpeech}せーの。`);
  },
};

const NoHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === 'IntentRequest' && getIntentName(input.requestEnvelope) === 'AMAZON.NoIntent';
  },
  handle(input: HandlerInput): Response {
    const session = sessionFor(input);
    if (session.phase === 'AWAITING_ACTION') {
      return ask(input, session, `ゲームを続けるよ。${phaseGuidance(session)}`, phaseGuidance(session));
    }
    if (session.phase === 'AWAITING_READY') return end(input, session, 'また遊んでね。');
    const score = `通算はあなた${session.playerWins}勝、私${session.alexaWins}勝。`;
    return end(input, session, `${score}また遊んでね。`);
  },
};

const HelpHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === 'IntentRequest' && getIntentName(input.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(input: HandlerInput): Response {
    const session = sessionFor(input);
    const explanation = session.phase === 'AWAITING_ACTION'
      ? '溜めるとパワーが1増えるよ。パワーがあるときに攻撃できて、攻撃と溜めがぶつかると勝負が決まるよ。'
      : '溜め、攻撃、防御で遊ぶゲームだよ。攻撃と溜めがぶつかると勝負が決まるよ。';
    return ask(input, session, `${explanation}${phaseGuidance(session)}`, phaseGuidance(session));
  },
};

const StopHandler = {
  canHandle(input: HandlerInput): boolean {
    if (getRequestType(input.requestEnvelope) !== 'IntentRequest') return false;
    const name = getIntentName(input.requestEnvelope);
    return name === 'AMAZON.StopIntent' || name === 'AMAZON.CancelIntent';
  },
  handle(input: HandlerInput): Response {
    return end(input, sessionFor(input), 'また遊んでね。');
  },
};

const FallbackHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === 'IntentRequest' && getIntentName(input.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(input: HandlerInput): Response {
    const session = sessionFor(input);
    return ask(input, session, `ごめんね、わからなかった。${phaseGuidance(session)}`, phaseGuidance(session));
  },
};

const SessionEndedHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(): Response {
    return {};
  },
};

const ErrorHandler = {
  canHandle(): boolean {
    return true;
  },
  handle(input: HandlerInput): Response {
    return input.responseBuilder
      .speak('うまく処理できませんでした。もう一度試してね。')
      .withShouldEndSession(true)
      .getResponse();
  },
};

export function createSkill(skillId = process.env.ALEXA_SKILL_ID) {
  const builder = SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      StartHandler,
      ActionHandler,
      NoHandler,
      HelpHandler,
      StopHandler,
      FallbackHandler,
      SessionEndedHandler,
    )
    .addErrorHandlers(ErrorHandler);

  if (skillId) builder.withSkillId(skillId);
  return builder.create();
}

const skill = createSkill();

export const handler = skill.invoke.bind(skill);
