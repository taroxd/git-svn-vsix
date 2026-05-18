import type { Event, Uri } from 'vscode';
import type { GitConfig } from './gitSvn';
import type { GitApiLike, GitRepositoryLike, UriLike } from './repositoryResolver';

export interface GitRepository extends GitRepositoryLike {
  readonly rootUri: Uri;
  readonly state: {
    readonly onDidChange: Event<void>;
  };
  readonly ui: {
    readonly selected: boolean;
    readonly onDidChange: Event<void>;
  };
  getConfigs(): Promise<readonly GitConfig[]>;
}

export interface GitApi extends GitApiLike {
  readonly git: {
    readonly path: string;
  };
  readonly repositories: readonly GitRepository[];
  readonly onDidOpenRepository: Event<GitRepository>;
  readonly onDidCloseRepository: Event<GitRepository>;
  getRepository(uri: UriLike): GitRepository | null;
}

export interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;
  getAPI(version: 1): GitApi;
}
