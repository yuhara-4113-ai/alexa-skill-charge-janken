import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const skillId = process.argv[2];
const refreshToken = process.env.ASK_REFRESH_TOKEN;
const vendorId = process.env.ASK_VENDOR_ID;

if (!skillId || !/^amzn1\.ask\.skill\.[A-Za-z0-9-]+$/.test(skillId)) {
  throw new Error('A non-placeholder Alexa Skill ID must be supplied.');
}
if (!refreshToken || !vendorId) {
  throw new Error('ASK_REFRESH_TOKEN and ASK_VENDOR_ID are required only for ASK CLI configuration.');
}

const projectAskDirectory = join(process.cwd(), '.ask');
await mkdir(projectAskDirectory, { recursive: true });
await writeFile(join(projectAskDirectory, 'ask-states.json'), `${JSON.stringify({
  profiles: { default: { skillId } },
}, null, 2)}\n`);

const userAskDirectory = join(homedir(), '.ask');
await mkdir(userAskDirectory, { recursive: true });
const cliConfigPath = join(userAskDirectory, 'cli_config');
let existingConfig = {};
try {
  existingConfig = JSON.parse(await readFile(cliConfigPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}
await writeFile(cliConfigPath, `${JSON.stringify({
  ...existingConfig,
  profiles: {
    ...existingConfig.profiles,
    default: {
      ...existingConfig.profiles?.default,
      vendor_id: vendorId,
      token: {
        ...existingConfig.profiles?.default?.token,
        access_token: '',
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 0,
        expires_at: '1970-01-01T00:00:00.000Z',
      },
    },
  },
}, null, 2)}\n`);
