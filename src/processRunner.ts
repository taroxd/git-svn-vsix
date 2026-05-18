import * as cp from 'child_process';
import type { EventEmitter } from 'events';
import type { GitRepositoryLike } from './repositoryResolver';

export interface GitSvnCommand {
  readonly args: readonly string[];
  readonly label: string;
}

export interface ProcessLogger {
  appendLine(value: string): void;
}

export interface ProcessStreamLike extends EventEmitter {}

export interface ProcessLike extends EventEmitter {
  readonly stdout: ProcessStreamLike | null;
  readonly stderr: ProcessStreamLike | null;
}

export interface ProcessFactory {
  spawn(file: string, args: readonly string[], options: cp.SpawnOptions): ProcessLike;
}

export interface ProcessCommandRunnerOptions {
  readonly logger: ProcessLogger;
  readonly processFactory?: ProcessFactory;
  readonly getGitPath?: () => string | undefined;
}

export interface ProcessCommandRunOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly logFailureOutput?: boolean;
}

export interface ProcessExecutionResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export class ProcessCommandError extends Error {
  public constructor(
    message: string,
    public readonly command: GitSvnCommand,
    public readonly result?: ProcessExecutionResult
  ) {
    super(message);
  }
}

const defaultProcessFactory: ProcessFactory = {
  spawn: (file, args, options) => cp.spawn(file, [...args], options)
};

export class ProcessCommandRunner {
  private readonly logger: ProcessLogger;
  private readonly processFactory: ProcessFactory;
  private readonly getGitPath: () => string | undefined;

  public constructor(options: ProcessCommandRunnerOptions) {
    this.logger = options.logger;
    this.processFactory = options.processFactory ?? defaultProcessFactory;
    this.getGitPath = options.getGitPath ?? (() => undefined);
  }

  public async run(
    repository: GitRepositoryLike,
    command: GitSvnCommand,
    runOptions: ProcessCommandRunOptions = {}
  ): Promise<void> {
    const startedAt = Date.now();
    const child = this.processFactory.spawn(this.getGitPath() ?? 'git', command.args, {
      cwd: repository.rootUri.fsPath,
      env: {
        ...process.env,
        VSCODE_GIT_COMMAND: command.args[0],
        LANGUAGE: 'en',
        LC_ALL: 'en_US.UTF-8',
        LANG: 'en_US.UTF-8',
        GIT_PAGER: 'cat',
        ...runOptions.env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let result: ProcessExecutionResult;

    try {
      result = await exec(child);
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      this.appendLogBlock(`> ${command.label} [${elapsed}ms]\n${String(error)}\n`);
      throw new ProcessCommandError(`Failed to start ${command.label}.`, command);
    }

    const elapsed = Date.now() - startedAt;

    if (result.exitCode !== 0) {
      if (runOptions.logFailureOutput !== false) {
        this.appendResult(command, elapsed, result);
      }

      const reason =
        result.exitCode === null ? 'was terminated before it completed' : `exited with code ${result.exitCode}`;
      throw new ProcessCommandError(`${command.label} ${reason}.`, command, result);
    }

    this.appendResult(command, elapsed, result);
  }

  private appendResult(command: GitSvnCommand, elapsed: number, result: ProcessExecutionResult): void {
    this.appendLogBlock(`> ${command.label} [${elapsed}ms]\n`);

    if (result.stdout.length > 0) {
      this.appendLogBlock(`${result.stdout}\n`);
    }

    if (result.stderr.length > 0) {
      this.appendLogBlock(`${result.stderr}\n`);
    }
  }

  private appendLogBlock(output: string): void {
    const lines = output.split(/\r?\n/);

    while (lines.length > 0 && /^\s*$/.test(lines[lines.length - 1])) {
      lines.pop();
    }

    if (lines.length > 0) {
      this.logger.appendLine(lines.join('\n'));
    }
  }
}

async function exec(child: ProcessLike): Promise<ProcessExecutionResult> {
  if (!child.stdout || !child.stderr) {
    throw new Error('Failed to get stdout or stderr from git process.');
  }

  const [exitCode, stdout, stderr] = await Promise.all([
    getExitCode(child),
    collect(child.stdout),
    collect(child.stderr)
  ]);

  return { exitCode, stdout, stderr };
}

function getExitCode(child: ProcessLike): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(typeof code === 'number' ? code : null));
  });
}

function collect(stream: ProcessStreamLike): Promise<string> {
  return new Promise(resolve => {
    const buffers: Buffer[] = [];

    stream.on('data', chunk => {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });

    stream.once('close', () => {
      resolve(Buffer.concat(buffers).toString('utf8'));
    });
  });
}
