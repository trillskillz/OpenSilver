#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_DIR="${REPO_ROOT}/upstream/silverscript"
PINNED_REF="${OPENSILVER_SILVERSCRIPT_REF:-2c46231}"
SILVERC_BIN="${UPSTREAM_DIR}/target/debug/silverc"

mkdir -p "${REPO_ROOT}/upstream"

if [ ! -d "${UPSTREAM_DIR}/.git" ]; then
  rm -rf "${UPSTREAM_DIR}"
  git clone https://github.com/kaspanet/silverscript.git "${UPSTREAM_DIR}"
fi

cd "${UPSTREAM_DIR}"
git fetch --all --tags --prune
CURRENT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"
if [ "${CURRENT_HEAD}" != "${PINNED_REF}" ]; then
  git checkout "${PINNED_REF}"
fi

cargo build --manifest-path silverscript-lang/Cargo.toml --bin silverc

echo "silverc ready: ${SILVERC_BIN}"
