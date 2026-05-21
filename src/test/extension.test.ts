import * as assert from 'assert';
import { describe, it } from 'node:test';
import { isRebaseConflictError } from '../conflictDetection';
import { ProcessCommandError } from '../processRunner';
import type { GitSvnCommand } from '../processRunner';

const command: GitSvnCommand = { args: ['svn', 'rebase'], label: 'git svn rebase' };

describe('isRebaseConflictError', () => {
  it('returns true when stderr contains CONFLICT', () => {
    const error = new ProcessCommandError('git svn rebase exited with code 1.', command, {
      exitCode: 1,
      stdout: '',
      stderr: 'CONFLICT (content): Merge conflict in foo.txt\nFailed to merge in the changes.'
    });

    assert.strictEqual(isRebaseConflictError(error), true);
  });

  it('returns true when stdout contains CONFLICT', () => {
    const error = new ProcessCommandError('git svn rebase exited with code 1.', command, {
      exitCode: 1,
      stdout: 'CONFLICT (modify/delete): bar.txt deleted in HEAD and modified in remote.',
      stderr: ''
    });

    assert.strictEqual(isRebaseConflictError(error), true);
  });

  it('returns false for unrelated error output', () => {
    const error = new ProcessCommandError('git svn rebase exited with code 1.', command, {
      exitCode: 1,
      stdout: '',
      stderr: 'fatal: unable to access remote repository'
    });

    assert.strictEqual(isRebaseConflictError(error), false);
  });

  it('returns false for non-ProcessCommandError', () => {
    const error = new Error('something went wrong');

    assert.strictEqual(isRebaseConflictError(error), false);
  });

  it('returns false when result is undefined', () => {
    const error = new ProcessCommandError('Failed to start git svn rebase.', command);

    assert.strictEqual(isRebaseConflictError(error), false);
  });
});
