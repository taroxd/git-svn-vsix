import * as assert from 'assert';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it } from 'node:test';
import type { Uri } from 'vscode';
import { GitSvnAskpass } from '../askpass';
import { getAskpassResponse } from '../gitSvnAskpass';

describe('git svn askpass', () => {
  it('creates a wrapper and temporary credential file', async () => {
    const storagePath = await fsp.mkdtemp(path.join(os.tmpdir(), 'git-svn-vsix-storage-'));
    const extensionPath = path.resolve(__dirname, '..', '..');
    const askpass = new GitSvnAskpass(uri(storagePath), uri(extensionPath));

    const environment = await askpass.createEnvironment({
      username: 'alice',
      password: 'secret'
    });

    try {
      assert.ok(environment.env.GIT_ASKPASS);
      assert.ok(fs.existsSync(environment.env.GIT_ASKPASS));
      assert.ok(environment.env.GIT_SVN_ASKPASS_CREDENTIALS);
      assert.ok(fs.existsSync(environment.env.GIT_SVN_ASKPASS_CREDENTIALS));
      assert.strictEqual(environment.env.GIT_SVN_ASKPASS_NODE, process.execPath);
      assert.strictEqual(environment.env.GIT_SVN_ASKPASS_MAIN, path.join(extensionPath, 'out', 'gitSvnAskpass.js'));
    } finally {
      const credentialsPath = environment.env.GIT_SVN_ASKPASS_CREDENTIALS;
      await environment.dispose();
      await fsp.rm(storagePath, { recursive: true, force: true });
      assert.ok(credentialsPath);
      assert.strictEqual(fs.existsSync(credentialsPath), false);
    }
  });

  it('returns username and password for git svn prompts', () => {
    const credentials = { username: 'alice', password: 'secret' };

    assert.strictEqual(getAskpassResponse('Username:', credentials), 'alice');
    assert.strictEqual(getAskpassResponse("Password for 'alice':", credentials), 'secret');
    assert.strictEqual(getAskpassResponse('Certificate problem.', credentials), undefined);
  });
});

function uri(fsPath: string): Uri {
  return { fsPath } as Uri;
}
