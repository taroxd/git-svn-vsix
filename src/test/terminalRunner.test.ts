import * as assert from 'assert';
import { describe, it } from 'node:test';
import { TerminalCommandRunner, TerminalLike } from '../terminalRunner';

describe('terminal command runner', () => {
  it('runs git svn dcommit in the repository root', () => {
    const terminal = new RecordingTerminal();
    const runner = new TerminalCommandRunner({
      createTerminal(options) {
        assert.deepStrictEqual(options, { name: 'Git SVN', cwd: '/workspace/project' });
        return terminal;
      },
      getTerminals: () => []
    });

    runner.run({ rootUri: { fsPath: '/workspace/project' } }, 'git svn dcommit');

    assert.deepStrictEqual(terminal.calls, [
      ['show', true],
      ['sendText', 'git svn dcommit', true]
    ]);
  });

  it('runs git svn rebase in the repository root', () => {
    const terminal = new RecordingTerminal();
    const runner = new TerminalCommandRunner({
      createTerminal() {
        return terminal;
      },
      getTerminals: () => []
    });

    runner.run({ rootUri: { fsPath: '/workspace/project' } }, 'git svn rebase');

    assert.deepStrictEqual(terminal.calls, [
      ['show', true],
      ['sendText', 'git svn rebase', true]
    ]);
  });

  it('reuses an existing live terminal instead of creating a new one', () => {
    const existingTerminal = new RecordingTerminal('Git SVN');
    let createCalled = false;
    const runner = new TerminalCommandRunner({
      createTerminal() {
        createCalled = true;
        return new RecordingTerminal();
      },
      getTerminals: () => [existingTerminal]
    });

    runner.run({ rootUri: { fsPath: '/workspace/project' } }, 'git svn dcommit');

    assert.strictEqual(createCalled, false);
    assert.deepStrictEqual(existingTerminal.calls, [
      ['show', true],
      ['sendText', 'git svn dcommit', true]
    ]);
  });

  it('creates a new terminal when the existing one has exited', () => {
    const exitedTerminal = new RecordingTerminal('Git SVN', { code: 0 });
    const newTerminal = new RecordingTerminal();
    const runner = new TerminalCommandRunner({
      createTerminal() {
        return newTerminal;
      },
      getTerminals: () => [exitedTerminal]
    });

    runner.run({ rootUri: { fsPath: '/workspace/project' } }, 'git svn rebase');

    assert.deepStrictEqual(exitedTerminal.calls, []);
    assert.deepStrictEqual(newTerminal.calls, [
      ['show', true],
      ['sendText', 'git svn rebase', true]
    ]);
  });
});

class RecordingTerminal implements TerminalLike {
  public readonly calls: unknown[][] = [];
  public readonly name: string;
  public readonly exitStatus: { readonly code: number | undefined } | undefined;

  public constructor(name = 'Git SVN', exitStatus?: { readonly code: number | undefined }) {
    this.name = name;
    this.exitStatus = exitStatus;
  }

  public show(preserveFocus?: boolean): void {
    this.calls.push(['show', preserveFocus]);
  }

  public sendText(text: string, addNewLine?: boolean): void {
    this.calls.push(['sendText', text, addNewLine]);
  }
}
