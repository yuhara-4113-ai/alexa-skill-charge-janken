import { mkdir, writeFile } from 'node:fs/promises';
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

const askDirectory = join(homedir(), '.ask');
await mkdir(askDirectory, { recursive: true });
await writeFile(join(askDirectory, 'ask-states.json'), `${JSON.stringify({
  profiles: { default: { skillId } },
}, null, 2)}\n`);
await writeFile(join(askDirectory, 'cli_config'), `${JSON.stringify({
  profiles: {
    default: {
      vendor_id: vendorId,
      token: {
        access_token: '',
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 0,
        expires_at: 0,
      },
    },
  },
}, null, 2)}\n`);
