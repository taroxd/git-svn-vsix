import * as assert from 'assert';
import * as fs from 'fs';
import { describe, it } from 'node:test';
import * as path from 'path';

describe('extension manifest', () => {
  const manifest = readManifest();

  it('contributes the Publish To SVN command with repo-push icon', () => {
    const command = findCommand(manifest, 'gitSvn.publishToSvn');

    assert.strictEqual(command.title, 'Publish To SVN (git svn dcommit)');
    assert.strictEqual(command.icon, '$(repo-push)');
  });

  it('contributes the git svn rebase command with repo-pull icon', () => {
    const command = findCommand(manifest, 'gitSvn.rebase');

    assert.strictEqual(command.title, 'Retrieve Changes & Rebase (git svn rebase)');
    assert.strictEqual(command.icon, '$(repo-pull)');
  });

  it('contributes the Show Output command', () => {
    const command = findCommand(manifest, 'gitSvn.showOutput');

    assert.strictEqual(command.title, 'Show Output');
    assert.strictEqual(command.icon, '$(output)');
  });

  it('adds both commands to the Source Control title menu with git-svn gating', () => {
    const sourceControlTitleMenu = manifest.contributes.menus['scm/title'];
    const publish = findMenuItem(sourceControlTitleMenu, 'gitSvn.publishToSvn');
    const rebase = findMenuItem(sourceControlTitleMenu, 'gitSvn.rebase');

    assert.strictEqual(publish.when, 'scmProvider == git && gitSvn.isSelectedRepository');
    assert.strictEqual(rebase.when, 'scmProvider == git && gitSvn.isSelectedRepository');
    assert.strictEqual(rebase.group, 'navigation@2');
    assert.strictEqual(publish.group, 'navigation@3');
  });
});

interface PackageManifest {
  readonly contributes: {
    readonly commands: readonly ManifestCommand[];
    readonly menus: Record<string, readonly ManifestMenuItem[]>;
  };
}

interface ManifestCommand {
  readonly command: string;
  readonly title: string;
  readonly icon?: string;
}

interface ManifestMenuItem {
  readonly command: string;
  readonly group?: string;
  readonly when?: string;
}

function readManifest(): PackageManifest {
  const manifestPath = path.resolve(__dirname, '..', '..', 'package.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest;
}

function findCommand(manifest: PackageManifest, commandId: string): ManifestCommand {
  const command = manifest.contributes.commands.find(candidate => candidate.command === commandId);
  assert.ok(command, `Expected command ${commandId} to be contributed.`);
  return command;
}

function findMenuItem(items: readonly ManifestMenuItem[], commandId: string): ManifestMenuItem {
  const item = items.find(candidate => candidate.command === commandId);
  assert.ok(item, `Expected menu item ${commandId} to be contributed.`);
  return item;
}
