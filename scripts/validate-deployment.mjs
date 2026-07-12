import { readFile } from 'node:fs/promises';

const deployment = JSON.parse(await readFile('config/deployment.json', 'utf8'));
const skillId = process.env.ALEXA_SKILL_ID;
const validSkillId = /^amzn1\.ask\.skill\.[A-Za-z0-9-]+$/;

if (!validSkillId.test(deployment.skillId ?? '') || !validSkillId.test(skillId ?? '') || deployment.skillId !== skillId) {
  throw new Error('ALEXA_SKILL_ID must be non-placeholder, valid, and exactly match config/deployment.json.');
}
