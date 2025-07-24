#!/bin/bash
# Usage: ./get-prs-between-tags.sh OWNER REPO START_TAG END_TAG
# Example: ./get-prs-between-tags.sh stefanprodan podinfo v5.0.0 v6.9.1

set -euo pipefail

owner=$1
repo=$2
start_tag=$3
end_tag=$4

# Get the commit SHA for each tag
start_sha=$(git rev-list -n 1 "$start_tag")
end_sha=$(git rev-list -n 1 "$end_tag")

# Fetch the list of commits between the two SHAs using the GitHub API
commits=$(gh api "repos/$owner/$repo/compare/$start_sha...$end_sha" --jq '.commits[].sha')

# Temporary file to store PR JSON lines
tmpfile=$(mktemp)

echo "🔍 Scanning commits between $start_tag and $end_tag..."

for sha in $commits; do
  # Get pull requests associated with each commit
  prs=$(gh api "repos/$owner/$repo/commits/$sha/pulls" \
    -H "Accept: application/vnd.github.groot-preview+json" \
    --jq '.[] | select(.merged_at != null) | {number, title, html_url}' || true)

  # Append each PR entry as a compact JSON line to the temp file
  echo "$prs" | jq -c '.' >> "$tmpfile"
done

echo "✅ Merged PRs between $start_tag and $end_tag:"

# Sort, deduplicate, and pretty-print the final list of PRs
sort -u "$tmpfile" | jq -s 'sort_by(.number)[] | "- [#\(.number)](\(.html_url)) \(.title)"'

# Clean up the temp file
rm "$tmpfile"
