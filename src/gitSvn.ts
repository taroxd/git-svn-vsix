export const GIT_SVN_CONTEXT_KEY = 'gitSvn.isSelectedRepository';

export interface GitConfig {
  readonly key: string;
  readonly value: string;
}

export interface GitSvnConfigRepository {
  getConfigs(): Promise<readonly GitConfig[]>;
}

export function hasGitSvnConfig(configs: readonly GitConfig[]): boolean {
  return configs.some(config => config.key.startsWith('svn-remote.'));
}

export async function isGitSvnRepository(repository: GitSvnConfigRepository): Promise<boolean> {
  try {
    return hasGitSvnConfig(await repository.getConfigs());
  } catch {
    return false;
  }
}
