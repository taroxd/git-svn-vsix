# Git SVN Buttons

Git SVN Buttons adds Source Control title buttons for repositories managed with `git svn`.

## Features

- `Publish To SVN`: runs `git svn dcommit`
- `git svn rebase`: runs `git svn rebase`

Buttons are shown only when the selected Git repository is detected as a git-svn repository. Detection is based on local Git config keys that start with `svn-remote.`.

## Usage

Open a git-svn repository in VS Code and use the added buttons in the Source Control view title area.

Commands run through a Git child process instead of an integrated terminal. Use `Git SVN: Show Output` from the Command Palette to open the extension log output.

When SVN username/password authentication fails, the extension prompts for credentials and retries through `GIT_ASKPASS`. The extension does not store credentials; if Subversion saves them, they are stored in SVN's own auth cache. Terminal-only prompts such as certificate trust prompts may still require running the `git svn` command manually in a terminal.

Source code is available at [GitHub](https://github.com/taroxd/git-svn-vsix).
