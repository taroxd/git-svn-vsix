export interface UriLike {
  readonly fsPath: string;
}

export interface RepositoryUiLike {
  readonly selected: boolean;
}

export interface GitRepositoryLike {
  readonly rootUri: UriLike;
  readonly ui?: RepositoryUiLike;
}

export interface GitApiLike {
  readonly repositories: readonly GitRepositoryLike[];
  getRepository(uri: UriLike): GitRepositoryLike | null;
}

export function resolveRepository(
  api: GitApiLike,
  args: readonly unknown[] = [],
  activeDocumentUri?: UriLike
): GitRepositoryLike | undefined {
  for (const arg of args) {
    if (isRepositoryLike(arg)) {
      const resolved = api.getRepository(arg.rootUri) ?? findRepositoryByRoot(api, arg.rootUri);
      if (resolved) {
        return resolved;
      }
    }
  }

  for (const arg of args) {
    const uri = extractUri(arg);

    if (!uri) {
      continue;
    }

    const repository = api.getRepository(uri) ?? findRepositoryByRoot(api, uri);

    if (repository) {
      return repository;
    }
  }

  const selectedRepository = api.repositories.find(repository => repository.ui?.selected);

  if (selectedRepository) {
    return selectedRepository;
  }

  if (activeDocumentUri) {
    const activeRepository = api.getRepository(activeDocumentUri);

    if (activeRepository) {
      return activeRepository;
    }
  }

  if (api.repositories.length === 1) {
    return api.repositories[0];
  }

  return undefined;
}

function findRepositoryByRoot(api: GitApiLike, uri: UriLike): GitRepositoryLike | undefined {
  return api.repositories.find(repository => repository.rootUri.fsPath === uri.fsPath);
}

function isRepositoryLike(value: unknown): value is GitRepositoryLike {
  return isObject(value) && isUriLike(value.rootUri);
}

function extractUri(value: unknown): UriLike | undefined {
  if (isUriLike(value)) {
    return value;
  }

  if (!isObject(value)) {
    return undefined;
  }

  if (isUriLike(value.resourceUri)) {
    return value.resourceUri;
  }

  if (isUriLike(value.uri)) {
    return value.uri;
  }

  if (isUriLike(value.rootUri)) {
    return value.rootUri;
  }

  if (isObject(value.sourceControl) && isUriLike(value.sourceControl.rootUri)) {
    return value.sourceControl.rootUri;
  }

  return undefined;
}

function isUriLike(value: unknown): value is UriLike {
  return isObject(value) && typeof value.fsPath === 'string' && value.fsPath.length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
