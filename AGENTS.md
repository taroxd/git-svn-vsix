# Git-SVN VS Code Extension

This repository contains a VS Code extension that adds Source Control buttons for git-svn repositories:

- `Publish To SVN`, which runs `git svn dcommit`
- `git svn rebase`, which runs `git svn rebase`

The extension integrates with the built-in VS Code Git extension through the public Git extension API and Source Control menu contribution points.

## Useful Documentation

- VS Code Source Control API guide: https://code.visualstudio.com/api/extension-guides/scm-provider
- VS Code extension manifest reference: https://code.visualstudio.com/api/references/extension-manifest
- VS Code when-clause contexts: https://code.visualstudio.com/api/references/when-clause-contexts
- VS Code icons in labels: https://code.visualstudio.com/api/references/icons-in-labels

## Build And Test

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

Run automated tests:

```bash
npm test
```

Run the extension host test harness when needed:

```bash
npm run vscode-test
```

Package as a `.vsix` file for local installation:

```bash
npm run package
```

## Implementation Notes

- Use only stable VS Code APIs. Do not monkey patch the built-in Git extension or depend on proposed/internal APIs to replace the built-in `Publish Branch` action button.
- Keep git-svn detection conservative: a repository is treated as git-svn when local Git config contains a key starting with `svn-remote.`.
- Commands should execute through a Git child process with the repository root as `cwd`, and should write command/output details to the Git SVN log output channel instead of opening a VS Code terminal.
- Keep behavior-level tests for command selection, git-svn detection, process command dispatch, output logging, and manifest contributions.
