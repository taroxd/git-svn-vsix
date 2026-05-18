import * as vscode from 'vscode';
import { GIT_SVN_CONTEXT_KEY, isGitSvnRepository } from './gitSvn';
import { resolveRepository } from './repositoryResolver';
import { TerminalCommandRunner } from './terminalRunner';
import type { GitApi, GitExtension, GitRepository } from './vscodeGit';

const PUBLISH_COMMAND = 'git svn dcommit';
const REBASE_COMMAND = 'git svn rebase';

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
  private readonly terminalRunner = new TerminalCommandRunner({
    createTerminal: options => vscode.window.createTerminal(options),
    getTerminals: () => vscode.window.terminals
  });

  private api: GitApi | undefined;
  private contextUpdateGeneration = 0;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async activate(): Promise<void> {
    await this.setGitSvnContext(false);

    this.context.subscriptions.push(
      vscode.commands.registerCommand('gitSvn.publishToSvn', (...args: unknown[]) =>
        this.runGitSvnCommand(PUBLISH_COMMAND, args)
      ),
      vscode.commands.registerCommand('gitSvn.rebase', (...args: unknown[]) =>
        this.runGitSvnCommand(REBASE_COMMAND, args)
      ),
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

  private async runGitSvnCommand(command: string, args: readonly unknown[]): Promise<void> {
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

    this.terminalRunner.run(repository, command);
  }

  private async setGitSvnContext(value: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', GIT_SVN_CONTEXT_KEY, value);
  }
}

function repositoryKey(repository: GitRepository): string {
  return repository.rootUri.toString();
}
