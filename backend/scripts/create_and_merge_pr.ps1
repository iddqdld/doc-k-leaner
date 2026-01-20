<#
.SYNOPSIS
  Create a GitHub PR and merge it using the GitHub CLI (`gh`).

.DESCRIPTION
  This script assumes the `gh` CLI is installed and authenticated. It creates
  a pull request from a head branch into a base branch on the given repo,
  then merges the PR and deletes the branch.

.USAGE
  # Interactive (ensure gh is authenticated):
  .\create_and_merge_pr.ps1

  # Specify custom branch or title:
  .\create_and_merge_pr.ps1 -Head feature/add-trivy-dedupe -Title "My PR title"

NOTES
  - Does NOT require any token passed to the script; `gh auth login` must be
    done beforehand by the user.
  - If your repository enforces branch protection (reviews/CI), automatic
    merging may fail and you'll need to complete the PR in GitHub.
#>

param(
    [string]$Repo = "iddqdld/doc-k-leaner",
    [string]$Head = "feature/add-trivy-dedupe",
    [string]$Base = "main",
    [string]$Title = "backend: add trivy_scan and dedupe_json modules",
    [string]$Body = "Adds Trivy wrapper and JSON dedupe utilities; adds CLI in app/main.py",
    [ValidateSet("merge","squash","rebase")] [string]$MergeMethod = "merge",
    [switch]$OpenInBrowser
)

function Write-ErrAndExit($msg) {
    Write-Error $msg
    exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-ErrAndExit "The 'gh' CLI is not installed or not in PATH. Install from https://cli.github.com/."
}

# Check auth
try {
    gh auth status --hostname github.com > $null 2>&1
} catch {
    Write-ErrAndExit "You are not authenticated with 'gh'. Run 'gh auth login' first."
}

Write-Host "Creating PR: $Head -> $Base on $Repo"

# Create PR and get JSON (number + url)
$prJson = gh pr create --repo $Repo --head $Head --base $Base --title $Title --body $Body --json number,url 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create PR:"
    Write-Error $prJson
    exit $LASTEXITCODE
}

$pr = $prJson | ConvertFrom-Json
$prNumber = $pr.number
$prUrl = $pr.url

Write-Host "PR created: #$prNumber -> $prUrl"

if ($OpenInBrowser) {
    Start-Process $prUrl
}

# Merge PR
Write-Host "Merging PR #$prNumber using method '$MergeMethod'"
$mergeFlag = "--$MergeMethod"
try {
    gh pr merge $prNumber --repo $Repo $mergeFlag --delete-branch
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Merge command failed. See output above for details."
        exit $LASTEXITCODE
    }
    Write-Host "PR #$prNumber merged and head branch deleted (if permitted)."
} catch {
    Write-Error "Error merging PR: $_"
    exit 1
}
