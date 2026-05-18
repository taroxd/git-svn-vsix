import * as assert from 'assert';
import { EventEmitter } from 'events';
import { describe, it } from 'node:test';
import {
  GitSvnCommand,
  ProcessCommandError,
  ProcessCommandRunner,
  ProcessFactory,
  ProcessLike,
  ProcessLogger
} from '../processRunner';

const DCOMMIT: GitSvnCommand = { args: ['svn', 'dcommit'], label: 'git svn dcommit' };
const REBASE: GitSvnCommand = { args: ['svn', 'rebase'], label: 'git svn rebase' };

describe('process command runner', () => {
  it('runs git svn dcommit in the repository root without a terminal', async () => {
    const process = new RecordingProcess();
    const factory = new RecordingProcessFactory(process);
    const logger = new RecordingLogger();
    const runner = new ProcessCommandRunner({
      logger,
      processFactory: factory,
      getGitPath: () => '/usr/bin/git'
    });

    const promise = runner.run({ rootUri: { fsPath: '/workspace/project' } }, DCOMMIT);
    process.closeStreams();
    process.exit(0);

    await promise;

    assert.strictEqual(factory.calls.length, 1);
    assert.strictEqual(factory.calls[0].file, '/usr/bin/git');
    assert.deepStrictEqual(factory.calls[0].args, ['svn', 'dcommit']);
    assert.strictEqual(factory.calls[0].options.cwd, '/workspace/project');
    assert.deepStrictEqual(factory.calls[0].options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.strictEqual(factory.calls[0].options.env?.VSCODE_GIT_COMMAND, 'svn');
    assert.strictEqual(factory.calls[0].options.env?.GIT_PAGER, 'cat');
    assert.match(logger.value, /^> git svn dcommit \[\d+ms\]\n$/);
  });

  it('logs stdout and stderr to the output logger', async () => {
    const process = new RecordingProcess();
    const logger = new RecordingLogger();
    const runner = new ProcessCommandRunner({
      logger,
      processFactory: new RecordingProcessFactory(process)
    });

    const promise = runner.run({ rootUri: { fsPath: '/workspace/project' } }, REBASE);
    process.stdout.emit('data', Buffer.from('rebased\n'));
    process.stderr.emit('data', Buffer.from('progress\n'));
    process.closeStreams();
    process.exit(0);

    await promise;

    assert.match(logger.value, /^> git svn rebase \[\d+ms\]\nrebased\nprogress\n$/);
  });

  it('rejects with command output when git exits with a non-zero code', async () => {
    const process = new RecordingProcess();
    const logger = new RecordingLogger();
    const runner = new ProcessCommandRunner({
      logger,
      processFactory: new RecordingProcessFactory(process)
    });

    const promise = runner.run({ rootUri: { fsPath: '/workspace/project' } }, REBASE);
    process.stderr.emit('data', Buffer.from('Unable to rebase\n'));
    process.closeStreams();
    process.exit(1);

    await assert.rejects(
      promise,
      (error: unknown) =>
        error instanceof ProcessCommandError &&
        error.command === REBASE &&
        error.result?.exitCode === 1 &&
        error.result.stderr === 'Unable to rebase\n'
    );
    assert.match(logger.value, /^> git svn rebase \[\d+ms\]\nUnable to rebase\n$/);
  });

  it('can suppress output for failed authentication probes', async () => {
    const process = new RecordingProcess();
    const logger = new RecordingLogger();
    const runner = new ProcessCommandRunner({
      logger,
      processFactory: new RecordingProcessFactory(process)
    });

    const promise = runner.run({ rootUri: { fsPath: '/workspace/project' } }, REBASE, {
      logFailureOutput: false
    });
    process.stderr.emit('data', Buffer.from('Authentication failed\n'));
    process.closeStreams();
    process.exit(1);

    await assert.rejects(promise, ProcessCommandError);
    assert.strictEqual(logger.value, '');
  });

  it('falls back to git from PATH when the Git extension path is unavailable', async () => {
    const process = new RecordingProcess();
    const factory = new RecordingProcessFactory(process);
    const runner = new ProcessCommandRunner({
      logger: new RecordingLogger(),
      processFactory: factory
    });

    const promise = runner.run({ rootUri: { fsPath: '/workspace/project' } }, DCOMMIT);
    process.closeStreams();
    process.exit(0);

    await promise;

    assert.strictEqual(factory.calls[0].file, 'git');
  });

  it('passes extra environment variables to the git process', async () => {
    const process = new RecordingProcess();
    const factory = new RecordingProcessFactory(process);
    const runner = new ProcessCommandRunner({
      logger: new RecordingLogger(),
      processFactory: factory
    });

    const promise = runner.run({ rootUri: { fsPath: '/workspace/project' } }, DCOMMIT, {
      env: {
        GIT_ASKPASS: '/tmp/askpass',
        GIT_SVN_ASKPASS_CREDENTIALS: '/tmp/credentials'
      }
    });
    process.closeStreams();
    process.exit(0);

    await promise;

    assert.strictEqual(factory.calls[0].options.env?.GIT_ASKPASS, '/tmp/askpass');
    assert.strictEqual(factory.calls[0].options.env?.GIT_SVN_ASKPASS_CREDENTIALS, '/tmp/credentials');
  });
});

class RecordingProcessFactory implements ProcessFactory {
  public readonly calls: {
    readonly file: string;
    readonly args: readonly string[];
    readonly options: Parameters<ProcessFactory['spawn']>[2];
  }[] = [];

  public constructor(private readonly process: RecordingProcess) {}

  public spawn(file: string, args: readonly string[], options: Parameters<ProcessFactory['spawn']>[2]): ProcessLike {
    this.calls.push({ file, args: [...args], options });
    return this.process;
  }
}

class RecordingProcess extends EventEmitter implements ProcessLike {
  public readonly stdout = new EventEmitter();
  public readonly stderr = new EventEmitter();

  public exit(code: number): void {
    this.emit('exit', code, null);
  }

  public closeStreams(): void {
    this.stdout.emit('close');
    this.stderr.emit('close');
  }
}

class RecordingLogger implements ProcessLogger {
  public value = '';

  public appendLine(value: string): void {
    this.value += `${value}\n`;
  }
}
