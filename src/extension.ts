import * as vscode from 'vscode';
import { GitSvnAskpass } from './askpass';
import type { AskpassEnvironment, GitSvnCredentials } from './askpass';
import { isRebaseConflictError } from './conflictDetection';
import { GIT_SVN_CONTEXT_KEY, isGitSvnRepository } from './gitSvn';
import { ProcessCommandError, ProcessCommandRunner } from './processRunner';
import type { GitSvnCommand, ProcessCommandRunOptions, ProcessExecutionResult } from './processRunner';
import { resolveRepository } from './repositoryResolver';
import type { GitRepositoryLike } from './repositoryResolver';
import type { GitApi, GitExtension, GitRepository } from './vscodeGit';

const PUBLISH_COMMAND: GitSvnCommand = { args: ['svn', 'dcommit'], label: 'git svn dcommit' };
const REBASE_COMMAND: GitSvnCommand = { args: ['svn', 'rebase'], label: 'git svn rebase' };

let controller: GitSvnController | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  controller = new GitSvnController(context);
  await controller.activate();
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}

class GitSvnController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly apiDisposables: vscode.Disposable[] = [];
  private readonly repositoryDisposables = new Map<string, vscode.Disposable[]>();
  private readonly logger = vscode.window.createOutputChannel('Git SVN', { log: true });
  private readonly askpass: GitSvnAskpass;
  private readonly commandRunner = new ProcessCommandRunner({
    logger: this.logger,
    getGitPath: () => this.api?.git.path
  });

  private api: GitApi | undefined;
  private contextUpdateGeneration = 0;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.askpass = new GitSvnAskpass(context.globalStorageUri, context.extensionUri);
  }

  public async activate(): Promise<void> {
    await this.setGitSvnContext(false);

    this.disposables.push(
      this.logger,
      vscode.commands.registerCommand('gitSvn.publishToSvn', (...args: unknown[]) =>
        this.runGitSvnCommand(PUBLISH_COMMAND, args)
      ),
      vscode.commands.registerCommand('gitSvn.rebase', (...args: unknown[]) =>
        this.runGitSvnCommand(REBASE_COMMAND, args)
      ),
      vscode.commands.registerCommand('gitSvn.showOutput', () => {
        this.logger.show();
      }),
      vscode.window.onDidChangeActiveTextEditor(() => {
        void this.updateContext();
      })
    );

    await this.initializeGitApi();
  }

  public dispose(): void {
    vscode.Disposable.from(...this.apiDisposables).dispose();
    this.apiDisposables.length = 0;
    this.disposeRepositoryWatchers();
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private async initializeGitApi(): Promise<void> {
    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');

    if (!extension) {
      return;
    }

    const gitExtension = extension.isActive ? extension.exports : await extension.activate();

    this.disposables.push(
      gitExtension.onDidChangeEnablement(enabled => {
        if (!enabled) {
          this.api = undefined;
          this.disposeRepositoryWatchers();
          void this.setGitSvnContext(false);
          return;
        }

        this.initializeApi(gitExtension.getAPI(1));
      })
    );

    if (gitExtension.enabled) {
      this.initializeApi(gitExtension.getAPI(1));
    }
  }

  private initializeApi(api: GitApi): void {
    this.api = api;
    vscode.Disposable.from(...this.apiDisposables).dispose();
    this.apiDisposables.length = 0;
    this.disposeRepositoryWatchers();

    this.apiDisposables.push(
      api.onDidOpenRepository(repository => {
        this.watchRepository(repository);
        void this.updateContext();
      }),
      api.onDidCloseRepository(repository => {
        this.unwatchRepository(repository);
        void this.updateContext();
      })
    );

    for (const repository of api.repositories) {
      this.watchRepository(repository);
    }

    void this.updateContext();
  }

  private watchRepository(repository: GitRepository): void {
    const key = repositoryKey(repository);

    if (this.repositoryDisposables.has(key)) {
      return;
    }

    this.repositoryDisposables.set(key, [
      repository.ui.onDidChange(() => {
        void this.updateContext();
      }),
      repository.state.onDidChange(() => {
        void this.updateContext();
      })
    ]);
  }

  private unwatchRepository(repository: GitRepository): void {
    const key = repositoryKey(repository);
    const disposables = this.repositoryDisposables.get(key);

    if (!disposables) {
      return;
    }

    vscode.Disposable.from(...disposables).dispose();
    this.repositoryDisposables.delete(key);
  }

  private disposeRepositoryWatchers(): void {
    for (const disposables of this.repositoryDisposables.values()) {
      vscode.Disposable.from(...disposables).dispose();
    }

    this.repositoryDisposables.clear();
  }

  private async updateContext(): Promise<void> {
    const api = this.api;
    const generation = ++this.contextUpdateGeneration;

    if (!api) {
      await this.setGitSvnContext(false);
      return;
    }

    const repository = resolveRepository(api, [], vscode.window.activeTextEditor?.document.uri);
    const isGitSvn = repository ? await isGitSvnRepository(repository as GitRepository) : false;

    if (generation === this.contextUpdateGeneration) {
      await this.setGitSvnContext(isGitSvn);
    }
  }

  private async runGitSvnCommand(command: GitSvnCommand, args: readonly unknown[]): Promise<void> {
    const api = this.api;

    if (!api) {
      void vscode.window.showWarningMessage('The VS Code Git extension is not available.');
      return;
    }

    const repository = resolveRepository(api, args, vscode.window.activeTextEditor?.document.uri);

    if (!repository) {
      void vscode.window.showWarningMessage('No Git repository is selected.');
      return;
    }

    if (!(await isGitSvnRepository(repository as GitRepository))) {
      void vscode.window.showWarningMessage('The selected Git repository is not a git-svn repository.');
      return;
    }

    let credentials: GitSvnCredentials | undefined;
    let lastError: unknown;
    let authPromptCount = 0;

    while (true) {
      try {
        await this.runGitSvnCommandAttempt(repository, command, credentials, {
          logFailureOutput: credentials !== undefined
        });
        return;
      } catch (error) {
        lastError = error;

        if (!isAuthenticationError(error)) {
          break;
        }

        if (authPromptCount >= 2) {
          break;
        }

        credentials = await this.promptCredentials(credentials);
        authPromptCount++;

        if (!credentials) {
          break;
        }
      }
    }

    if (command === REBASE_COMMAND && isRebaseConflictError(lastError)) {
      await this.showRebaseConflictMessage();
      return;
    }

    await this.showCommandError(lastError, command);
  }

  private async runGitSvnCommandAttempt(
    repository: GitRepositoryLike,
    command: GitSvnCommand,
    credentials: GitSvnCredentials | undefined,
    runOptions: Pick<ProcessCommandRunOptions, 'logFailureOutput'> = {}
  ): Promise<void> {
    let askpassEnvironment: AskpassEnvironment | undefined;

    try {
      if (credentials) {
        askpassEnvironment = await this.askpass.createEnvironment(credentials);
      }

      await this.commandRunner.run(repository, withUsername(command, credentials?.username), {
        env: askpassEnvironment?.env,
        ...runOptions
      });
    } finally {
      await askpassEnvironment?.dispose();
    }
  }

  private async promptCredentials(previous: GitSvnCredentials | undefined): Promise<GitSvnCredentials | undefined> {
    const username = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'SVN repository username',
      prompt: 'Please enter your username',
      value: previous?.username
    });

    if (username === undefined) {
      return undefined;
    }

    const password = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'SVN repository password',
      prompt: 'Please enter your password'
    });

    if (password === undefined) {
      return undefined;
    }

    return { username, password };
  }

  private async showRebaseConflictMessage(): Promise<void> {
    const abort = 'Abort Rebase';
    const result = await vscode.window.showInformationMessage(
      'Git SVN: Conflicts detected during rebase. Resolve conflicts and continue the rebase.',
      abort
    );

    if (result === abort) {
      await vscode.commands.executeCommand('git.rebaseAbort');
    }
  }

  private async showCommandError(error: unknown, command: GitSvnCommand): Promise<void> {
    const message = getCommandErrorMessage(error, command);
    const openLog = 'Open Git SVN Log';
    const result = await vscode.window.showErrorMessage(message, openLog);

    if (result === openLog) {
      this.logger.show();
    }
  }

  private async setGitSvnContext(value: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', GIT_SVN_CONTEXT_KEY, value);
  }
}

function repositoryKey(repository: GitRepository): string {
  return repository.rootUri.toString();
}

function withUsername(command: GitSvnCommand, username: string | undefined): GitSvnCommand {
  if (!username || command.args.includes('--username')) {
    return command;
  }

  return {
    args: [...command.args, '--username', username],
    label: command.label
  };
}

function isAuthenticationError(error: unknown): boolean {
  if (!(error instanceof ProcessCommandError)) {
    return false;
  }

  const output = `${error.result?.stderr ?? ''}\n${error.result?.stdout ?? ''}`;
  return /E170001|authentication failed|authorization failed|no more credentials|password for|username:/i.test(output);
}

function getCommandErrorMessage(error: unknown, command: GitSvnCommand): string {
  if (error instanceof ProcessCommandError) {
    const hint = getCommandErrorHint(error.result);
    return hint ? `Git SVN: ${hint}` : `Git SVN: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Git SVN: ${error.message}`;
  }

  return `Git SVN: ${command.label} failed.`;
}

function getCommandErrorHint(result: ProcessExecutionResult | undefined): string | undefined {
  return getLastMeaningfulLine(result?.stderr) ?? getLastMeaningfulLine(result?.stdout);
}

function getLastMeaningfulLine(output: string | undefined): string | undefined {
  return output
    ?.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .at(-1);
}
