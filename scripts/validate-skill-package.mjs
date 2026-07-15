import { readFile } from 'node:fs/promises';

const packageRoot = process.argv[2] ?? 'skill-package';
const manifest = JSON.parse(await readFile(`${packageRoot}/skill.json`, 'utf8'));
const model = JSON.parse(await readFile(`${packageRoot}/interactionModels/custom/ja-JP.json`, 'utf8'));
const locale = manifest.manifest?.publishingInformation?.locales?.['ja-JP'];
const customApi = manifest.manifest?.apis?.custom;
const endpoint = manifest.manifest?.apis?.custom?.endpoint?.uri;
const publishingInformation = manifest.manifest?.publishingInformation;
const privacyAndCompliance = manifest.manifest?.privacyAndCompliance;
const intentSamples = model.interactionModel?.languageModel?.intents?.flatMap((intent) => intent.samples ?? []) ?? [];
const intentNames = new Set(model.interactionModel?.languageModel?.intents?.map((intent) => intent.name));
const startGameIntent = model.interactionModel?.languageModel?.intents?.find((intent) => intent.name === 'StartGameIntent');
const requiredIntents = [
  'ActionIntent', 'StartGameIntent', 'AMAZON.YesIntent', 'AMAZON.NoIntent',
  'AMAZON.HelpIntent', 'AMAZON.FallbackIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent',
];
const requiredStartGameSamples = [
  'しよう', '勝負', '勝負する', '遊ぶ', '対戦', '遊ぼう', '勝負しよう', '対戦しよう',
];

if (!manifest.manifest?.manifestVersion || !locale?.name || !locale?.summary || !locale?.description || locale.examplePhrases?.length !== 3) {
  throw new Error('skill.json is missing required ja-JP publishing metadata.');
}
if (!Array.isArray(locale.keywords) || locale.keywords.length === 0) {
  throw new Error('skill.json is missing ja-JP publishing keywords.');
}
if (!privacyAndCompliance?.locales?.['ja-JP']?.privacyPolicyUrl?.startsWith('https://')) {
  throw new Error('skill.json must contain an HTTPS privacy policy URL.');
}
if (
  publishingInformation?.isAvailableWorldwide !== false
  || publishingInformation?.distributionMode !== 'PUBLIC'
  || publishingInformation?.category !== 'GAMES'
  || publishingInformation?.distributionCountries?.length !== 1
  || publishingInformation.distributionCountries[0] !== 'JP'
  || !publishingInformation?.testingInstructions
) {
  throw new Error('skill.json has invalid Store distribution metadata.');
}
const requiredComplianceValues = {
  allowsPurchases: false,
  usesPersonalInfo: false,
  isChildDirected: false,
  isExportCompliant: true,
  containsAds: false,
};
if (Object.entries(requiredComplianceValues).some(([key, value]) => privacyAndCompliance?.[key] !== value)) {
  throw new Error('skill.json privacyAndCompliance values do not match the verified release policy.');
}
if (!endpoint || endpoint === 'REPLACE_AFTER_CONSOLE_CREATION') {
  throw new Error('skill.json is missing an endpoint URI.');
}
if (customApi?.locales !== undefined) {
  throw new Error('Custom interaction models must be separate skill-package resources, not manifest.apis.custom.locales.');
}
if (requiredIntents.some((intent) => !intentNames.has(intent))) {
  throw new Error('The interaction model is missing a required intent.');
}
const missingStartGameSamples = requiredStartGameSamples.filter((sample) => !startGameIntent?.samples?.includes(sample));
if (missingStartGameSamples.length > 0) {
  throw new Error(`StartGameIntent is missing natural invocation samples: ${missingStartGameSamples.join(', ')}`);
}
if (intentSamples.some((sample) => /[^ ]\{[^{}]+\}|\{[^{}]+\}[^ ]/u.test(sample))) {
  throw new Error('Interaction model slots in sample utterances must be separated from surrounding text by spaces.');
}

async function validatePngIcon(uri, expectedWidth, expectedHeight) {
  if (!uri?.startsWith('file://')) {
    throw new Error('Store icons must use skill-package-relative file:// URIs.');
  }
  const icon = await readFile(`${packageRoot}/${uri.slice('file://'.length)}`);
  const pngSignature = '89504e470d0a1a0a';
  if (icon.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`${uri} is not a PNG file.`);
  }
  const width = icon.readUInt32BE(16);
  const height = icon.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${uri} must be ${expectedWidth} x ${expectedHeight}px, but is ${width} x ${height}px.`);
  }
}

await validatePngIcon(locale.smallIconUri, 108, 108);
await validatePngIcon(locale.largeIconUri, 512, 512);
