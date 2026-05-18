import type { GitRepositoryLike } from './repositoryResolver';

export interface TerminalLike {
  readonly name: string;
  readonly exitStatus: { readonly code: number | undefined } | undefined;
  show(preserveFocus?: boolean): void;
  sendText(text: string, addNewLine?: boolean): void;
}

export interface TerminalFactory {
  createTerminal(options: { readonly name: string; readonly cwd: string }): TerminalLike;
  getTerminals(): readonly TerminalLike[];
}

export class TerminalCommandRunner {
  public constructor(
    private readonly terminalFactory: TerminalFactory,
    private readonly terminalName = 'Git SVN'
  ) {}

  public run(repository: GitRepositoryLike, command: string): void {
    const existing = this.terminalFactory.getTerminals().find(
      t => t.name === this.terminalName && t.exitStatus === undefined
    );

    const terminal = existing ?? this.terminalFactory.createTerminal({
      name: this.terminalName,
      cwd: repository.rootUri.fsPath
    });

    terminal.show(true);
    terminal.sendText(command, true);
  }
}
