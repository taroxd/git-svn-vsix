# Git-SVN VS Code Extension

This repository contains a VS Code extension that adds Source Control buttons for git-svn repositories:

- `Publish To SVN`, which runs `git svn dcommit`
- `git svn rebase`, which runs `git svn rebase`

The extension integrates with the built-in VS Code Git extension through the public Git extension API and Source Control menu contribution points.

## Useful Documentation

- VS Code Source Control API guide: https://code.visualstudio.com/api/extension-guides/scm-provider
- VS Code extension manifest reference: https://code.visualstudio.com/api/references/extension-manifest
- VS Code when-clause contexts: https://code.visualstudio.com/api/references/when-clause-contexts

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

Bump version (updates both `package.json` and `package-lock.json`, creates git commit and tag):

```bash
npm version patch   # e.g. 0.0.4 → 0.0.5
npm version minor   # e.g. 0.0.4 → 0.1.0
npm version major   # e.g. 0.0.4 → 1.0.0
```
