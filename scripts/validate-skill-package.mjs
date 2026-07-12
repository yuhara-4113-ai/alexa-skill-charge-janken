import { readFile } from 'node:fs/promises';

const packageRoot = process.argv[2] ?? 'skill-package';
const manifest = JSON.parse(await readFile(`${packageRoot}/skill.json`, 'utf8'));
const model = JSON.parse(await readFile(`${packageRoot}/interactionModels/custom/ja-JP.json`, 'utf8'));
const locale = manifest.manifest?.publishingInformation?.locales?.['ja-JP'];
const endpoint = manifest.manifest?.apis?.custom?.endpoint?.uri;
const intentNames = new Set(model.interactionModel?.languageModel?.intents?.map((intent) => intent.name));
const requiredIntents = [
  'ActionIntent', 'StartGameIntent', 'AMAZON.YesIntent', 'AMAZON.NoIntent',
  'AMAZON.HelpIntent', 'AMAZON.FallbackIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent',
];

if (!manifest.manifest?.manifestVersion || !locale?.name || !locale?.summary || !locale?.description || locale.examplePhrases?.length !== 3) {
  throw new Error('skill.json is missing required ja-JP publishing metadata.');
}
if (!endpoint || endpoint === 'REPLACE_AFTER_CONSOLE_CREATION') {
  throw new Error('skill.json is missing an endpoint URI.');
}
if (requiredIntents.some((intent) => !intentNames.has(intent))) {
  throw new Error('The interaction model is missing a required intent.');
}
