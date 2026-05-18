# Git SVN Buttons

Git SVN Buttons adds Source Control title buttons for repositories managed with `git svn`.

## Features

- `Publish To SVN`: runs `git svn dcommit`
- `git svn rebase`: runs `git svn rebase`

Buttons are shown only when the selected Git repository is detected as a git-svn repository. Detection is based on local Git config keys that start with `svn-remote.`.

## Usage

Open a git-svn repository in VS Code and use the added buttons in the Source Control view title area.

Source code available at [GitHub](https://github.com/taroxd/git-svn-vsix).
