import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { Uri } from 'vscode';

export interface GitSvnCredentials {
  readonly username: string;
  readonly password: string;
}

export interface AskpassEnvironment {
  readonly env: NodeJS.ProcessEnv;
  dispose(): Promise<void>;
}

export class GitSvnAskpass {
  public constructor(
    private readonly globalStorageUri: Uri,
    private readonly extensionUri: Uri
  ) {}

  public async createEnvironment(credentials: GitSvnCredentials): Promise<AskpassEnvironment> {
    const wrapperPath = await this.ensureWrapper();
    const credentialsDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'git-svn-vsix-askpass-'));
    const credentialsPath = path.join(credentialsDirectory, 'credentials.json');

    await fs.writeFile(credentialsPath, JSON.stringify(credentials), { mode: 0o600 });

    return {
      env: {
        GIT_ASKPASS: wrapperPath,
        SSH_ASKPASS: wrapperPath,
        GIT_SVN_ASKPASS_CREDENTIALS: credentialsPath,
        GIT_SVN_ASKPASS_MAIN: path.join(this.extensionUri.fsPath, 'out', 'gitSvnAskpass.js'),
        GIT_SVN_ASKPASS_NODE: process.execPath
      },
      dispose: async () => {
        await fs.rm(credentialsDirectory, { recursive: true, force: true });
      }
    };
  }

  private async ensureWrapper(): Promise<string> {
    await fs.mkdir(this.globalStorageUri.fsPath, { recursive: true });

    const wrapperPath = path.join(
      this.globalStorageUri.fsPath,
      process.platform === 'win32' ? 'git-svn-askpass.bat' : 'git-svn-askpass.sh'
    );
    const content = process.platform === 'win32' ? windowsWrapper : shellWrapper;

    await fs.writeFile(wrapperPath, content, { mode: 0o700 });

    if (process.platform !== 'win32') {
      await fs.chmod(wrapperPath, 0o700);
    }

    return wrapperPath;
  }
}

const shellWrapper = `#!/bin/sh
ELECTRON_RUN_AS_NODE=1 "$GIT_SVN_ASKPASS_NODE" "$GIT_SVN_ASKPASS_MAIN" "$@"
`;

const windowsWrapper = `@echo off
set ELECTRON_RUN_AS_NODE=1
"%GIT_SVN_ASKPASS_NODE%" "%GIT_SVN_ASKPASS_MAIN%" %*
`;
