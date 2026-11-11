# ============================================================================
# NorthPeak ServiceHub — Git Repository Initialization Script (PowerShell)
# Usage: .\init-git.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "Initializing NorthPeak ServiceHub Git repository..." -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

git add .
git status --short

git commit -m "feat: complete NorthPeak ServiceHub 3-tier system (MySQL 3NF, Express API, React 5-role UI)"

Write-Host "Git repository initialized and initial commit created on branch 'main'!" -ForegroundColor Green
