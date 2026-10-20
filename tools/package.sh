#!/usr/bin/env bash
# Builds a source zip of the repository (no node_modules, builds, local data or test artefacts).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-../Project_Aurora_Claude_M1.zip}
rm -f "$OUT"
git archive --format=zip --prefix=aurora/ -o "$OUT" HEAD
echo "wrote $OUT"
