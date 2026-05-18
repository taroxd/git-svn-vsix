import * as fs from 'fs';

interface Credentials {
  readonly username?: string;
  readonly password?: string;
}

export function getAskpassResponse(prompt: string, credentials: Credentials): string | undefined {
  if (/password/i.test(prompt)) {
    return credentials.password;
  }

  if (/username/i.test(prompt)) {
    return credentials.username;
  }

  return undefined;
}

if (require.main === module) {
  main();
}

function main(): void {
  const credentialsPath = process.env.GIT_SVN_ASKPASS_CREDENTIALS;

  if (!credentialsPath) {
    process.exit(1);
  }

  let credentials: Credentials;

  try {
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) as Credentials;
  } catch {
    process.exit(1);
  }

  const prompt = process.argv.slice(2).join(' ');
  const response = getAskpassResponse(prompt, credentials);

  if (typeof response !== 'string') {
    process.exit(1);
  }

  process.stdout.write(`${response}\n`);
}
