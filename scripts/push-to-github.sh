#!/usr/bin/env bash
# Push ExamPath to YOUR GitHub. Run from the repo root:  ./scripts/push-to-github.sh [repo-name]
set -e

REPO_NAME="${1:-exampath}"

# Ensure there is a commit
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git add -A && git commit -m "Initial commit: ExamPath"
fi
git branch -M main 2>/dev/null || true

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "Creating and pushing to GitHub repo: $REPO_NAME"
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
  echo "Done. Repo: $(gh repo view --json url -q .url 2>/dev/null)"
else
  cat <<EOF
GitHub CLI not installed or not logged in. Two ways to finish:

A) Install gh + login, then re-run this script:
   https://cli.github.com/  ->  gh auth login  ->  ./scripts/push-to-github.sh $REPO_NAME

B) Manual:
   1) Create an empty repo:  https://github.com/new   (name: $REPO_NAME, do NOT add a README)
   2) git remote add origin https://github.com/<your-username>/$REPO_NAME.git
   3) git push -u origin main
EOF
fi
