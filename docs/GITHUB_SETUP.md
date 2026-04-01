# Git and GitHub Setup Guide

## 1) Initialize local repository
```bash
cd "/Users/sumit/Documents/New project"
git init
git branch -M main
```

## 2) Configure identity (once per machine)
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## 3) Make first commit
```bash
git add .
git commit -m "chore: scaffold LinkVault fullstack project"
```

## 4) Create a new GitHub repo
1. Open GitHub -> New repository.
2. Name it `linkvault`.
3. Keep it empty (no README/.gitignore/license, because local repo already has files).

## 5) Connect local to GitHub
```bash
git remote add origin https://github.com/<your-username>/linkvault.git
git push -u origin main
```

## 6) Daily workflow
```bash
git pull --rebase origin main
# work

git add <changed-files>
git commit -m "feat: add upload endpoint validation"
git push origin main
```

## 7) Recommended branch workflow
```bash
git checkout -b feat/<short-feature-name>
# work + commits

git push -u origin feat/<short-feature-name>
# create PR on GitHub -> review -> merge to main
```
