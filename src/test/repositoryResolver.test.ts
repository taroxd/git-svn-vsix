import * as assert from 'assert';
import { describe, it } from 'node:test';
import { GitApiLike, GitRepositoryLike, resolveRepository, UriLike } from '../repositoryResolver';

describe('repository resolver', () => {
  it('prefers an explicit repository argument', () => {
    const first = repository('/workspace/first', true);
    const second = repository('/workspace/second', false);
    const api = apiFor([first, second]);

    assert.strictEqual(resolveRepository(api, [second]), second);
  });

  it('resolves a source-control-like argument through the Git API', () => {
    const first = repository('/workspace/first', true);
    const second = repository('/workspace/second', false);
    const api = apiFor([first, second]);
    const sourceControl = { rootUri: uri('/workspace/second'), id: 'git', label: 'Git' };

    assert.strictEqual(resolveRepository(api, [sourceControl]), second);
  });

  it('resolves a resource URI argument through the Git API', () => {
    const first = repository('/workspace/first', false);
    const second = repository('/workspace/second', false);
    const api = apiFor([first, second]);

    assert.strictEqual(resolveRepository(api, [{ resourceUri: uri('/workspace/second/file.txt') }]), second);
  });

  it('falls back to the selected repository', () => {
    const first = repository('/workspace/first', false);
    const second = repository('/workspace/second', true);
    const api = apiFor([first, second]);

    assert.strictEqual(resolveRepository(api), second);
  });

  it('falls back to the active editor repository', () => {
    const first = repository('/workspace/first', false);
    const second = repository('/workspace/second', false);
    const api = apiFor([first, second]);

    assert.strictEqual(resolveRepository(api, [], uri('/workspace/second/file.txt')), second);
  });

  it('falls back to the only repository', () => {
    const only = repository('/workspace/only', false);
    const api = apiFor([only]);

    assert.strictEqual(resolveRepository(api), only);
  });

  it('returns undefined when multiple repositories are ambiguous', () => {
    const api = apiFor([
      repository('/workspace/first', false),
      repository('/workspace/second', false)
    ]);

    assert.strictEqual(resolveRepository(api), undefined);
  });
});

function repository(root: string, selected: boolean): GitRepositoryLike {
  return {
    rootUri: uri(root),
    ui: { selected }
  };
}

function uri(fsPath: string): UriLike {
  return { fsPath };
}

function apiFor(repositories: readonly GitRepositoryLike[]): GitApiLike {
  return {
    repositories,
    getRepository(resource: UriLike): GitRepositoryLike | null {
      return repositories.find(repository =>
        resource.fsPath === repository.rootUri.fsPath ||
        resource.fsPath.startsWith(`${repository.rootUri.fsPath}/`)
      ) ?? null;
    }
  };
}
