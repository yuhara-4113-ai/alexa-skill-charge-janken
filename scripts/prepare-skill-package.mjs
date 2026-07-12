import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const lambdaArn = process.argv[2];
if (!lambdaArn || !/^arn:[a-z0-9-]+:lambda:[a-z0-9-]+:\d{12}:function:[A-Za-z0-9-_]+(?::[A-Za-z0-9-_]+)?$/.test(lambdaArn)) {
  throw new Error('A valid Lambda ARN must be supplied as the first argument.');
}

const source = resolve('skill-package');
const destination = resolve('.build/skill-package');
await rm(destination, { recursive: true, force: true });
await mkdir(resolve('.build'), { recursive: true });
await cp(source, destination, { recursive: true });

const manifestPath = resolve(destination, 'skill.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const customApi = manifest.manifest?.apis?.custom;
if (
  customApi?.endpoint?.uri !== '{{LAMBDA_ARN}}' ||
  customApi?.regions?.FE?.endpoint?.uri !== '{{LAMBDA_ARN}}'
) {
  throw new Error('skill.json must contain the {{LAMBDA_ARN}} placeholder for its default and FE endpoints.');
}
customApi.endpoint.uri = lambdaArn;
customApi.regions.FE.endpoint.uri = lambdaArn;
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (serialized.includes('{{LAMBDA_ARN}}') || serialized.includes('REPLACE_AFTER_CONSOLE_CREATION')) {
  throw new Error('The generated skill package contains an unresolved placeholder.');
}
await writeFile(manifestPath, serialized);
