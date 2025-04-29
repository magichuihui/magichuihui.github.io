---
layout: post
title: How to remove sensitive data from git history
excerpt: Sensitive data removal
date: 2025-04-29
tags: [git]
comments: true
---

Sometimes you might push your sensitive data, like personal password or tokens to your git repo, Even you remove it from the file, it's still in the git commit history. 

This page describe how to remove sensitive data from commit history by [git-filter-repo](https://github.com/newren/git-filter-repo)

## 1. Replace the password in commit history

If there is secrets that have been uploaded to the git repo by accident, like these format:

- password: my-password
- token: token-1234

You can use git-filter-repo to replace all secrets in the commit history.

First install git-filter-repo by package management tools, for example, in Fedora:

```bash
dnf install git-filter-repo
```

Or using pipx to install as python package
```bash
pipx install git-filter-repo
```

Replace the secrets in commit history by `--replace-text` options, based on the expressions in the provided file.

```bash
cat >> expressions.txt << EOF
my-password==><DN password>
regex:token\: (.*)==>token: <api token>
EOF

git filter-repo --force --replace-text expressions.txt

git push -f origin main
```

## 2. Resign your commits with gpg key

After you finish the above steps, you may find that all your commits revert to unsigned of gpg. So [here](https://superuser.com/questions/397149/can-you-gpg-sign-old-commits) is how to resign all your commits with gpg key.

```bash
# create a git alias for resign
git config --global alias.resign "rebase --exec 'GIT_COMMITTER_DATE=\"\$(git log -n 1 --format=%aD)\" git commit --amend --no-edit -n -S' -i"

git resign <commit-sha>
```

This command will resign all the commits until the \<commit-sha\>

## References

[[1](https://htmlpreview.github.io/?https://github.com/newren/git-filter-repo/blob/docs/html/git-filter-repo.html)] git-filter-repo(1) Manual Page

[[2](https://superuser.com/questions/397149/can-you-gpg-sign-old-commits)] Can you GPG sign old commits?