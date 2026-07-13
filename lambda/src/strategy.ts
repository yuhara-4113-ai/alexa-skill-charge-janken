import { actions, canUseAction, type Action } from './game';

export type Random = () => number;

export function legalAlexaActions(alexaPower: number): Action[] {
  return actions.filter((action) => canUseAction(action, alexaPower));
}
export function chooseAlexaAction(alexaPower: number, random: Random = Math.random): Action {
  const legalActions = legalAlexaActions(alexaPower);
  const index = Math.min(Math.floor(random() * legalActions.length), legalActions.length - 1);
  return legalActions[index];
}
