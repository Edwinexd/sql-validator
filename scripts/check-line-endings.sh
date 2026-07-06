#!/usr/bin/env bash
# Fails if any tracked text file is committed with CRLF or mixed line endings.
# Repo standard is LF (enforced by .gitattributes); this guards against
# regressions, e.g. files added from a Windows editor with autocrlf off.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# git ls-files --eol reports the index (committed) line ending per file as
# i/lf, i/crlf, i/mixed or i/-text (binary). Flag anything CRLF or mixed.
offenders=$(git ls-files --eol | awk '$1 ~ /^i\/(crlf|mixed)$/ { print "  " $1 "  " $NF }')

if [ -n "$offenders" ]; then
  echo "Line-ending check failed: found non-LF (CRLF/mixed) files:" >&2
  echo "$offenders" >&2
  echo >&2
  echo "Repo standard is LF. Fix with:  git add --renormalize . && git commit" >&2
  exit 1
fi

echo "Line endings OK: all tracked text files use LF."
