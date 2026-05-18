import * as assert from 'assert';
import { describe, it } from 'node:test';
import { hasGitSvnConfig, isGitSvnRepository } from '../gitSvn';

describe('git-svn detection', () => {
  it('returns true when a svn-remote config exists', () => {
    assert.strictEqual(
      hasGitSvnConfig([
        { key: 'core.repositoryformatversion', value: '0' },
        { key: 'svn-remote.svn.url', value: 'https://svn.example.test/project' }
      ]),
      true
    );
  });

  it('returns false for a normal Git config', () => {
    assert.strictEqual(
      hasGitSvnConfig([
        { key: 'core.repositoryformatversion', value: '0' },
        { key: 'remote.origin.url', value: 'https://git.example.test/project.git' }
      ]),
      false
    );
  });

  it('returns false when configs cannot be read', async () => {
    const repository = {
      async getConfigs(): Promise<never> {
        throw new Error('git config failed');
      }
    };

    assert.strictEqual(await isGitSvnRepository(repository), false);
  });
});
