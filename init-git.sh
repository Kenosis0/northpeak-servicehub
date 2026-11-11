#!/usr/bin/env bash
# ============================================================================
# NorthPeak ServiceHub — Git Repository Initialization Script (Bash)
# Usage: bash ./init-git.sh
# ============================================================================

set -e

echo "Initializing NorthPeak ServiceHub Git repository..."

if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

git add .
git status --short

git commit -m "feat: complete NorthPeak ServiceHub 3-tier system (MySQL 3NF, Express API, React 5-role UI)"

echo "Git repository initialized and initial commit created on branch 'main'!"
