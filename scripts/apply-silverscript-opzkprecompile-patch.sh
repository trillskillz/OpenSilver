#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_FILE="${REPO_ROOT}/patches/silverscript-opzkprecompile.patch"
UPSTREAM_DIR="${REPO_ROOT}/upstream/silverscript"
SILVERC_BIN="${UPSTREAM_DIR}/target/debug/silverc"

bash "${REPO_ROOT}/scripts/bootstrap-silverc.sh"

cd "${UPSTREAM_DIR}"
git reset --hard HEAD >/dev/null
git clean -fd >/dev/null

if rg -q '"OpZkPrecompile" => compile_opcode_builtin_call' silverscript-lang/src/compiler/compile.rs \
  && rg -q '"OpGroth16Verify" => compile_groth16_verify_call' silverscript-lang/src/compiler/compile.rs \
  && rg -q '"OpZkPrecompile" \| "OpGroth16Verify" => "bool"' silverscript-lang/src/compiler/debug_value_types.rs \
  && rg -q 'function OpZkPrecompile\(\) : \(bool\);' silverscript-lang/std/builtins.sil \
  && rg -q 'function OpGroth16Verify\(byte\[\] verifyingKey, byte\[\] proofBytes, byte\[32\]\[\] publicInputs\) : \(bool\);' silverscript-lang/std/builtins.sil; then
  echo "OpZkPrecompile/Groth16 helper patch already present in upstream checkout"
else
  git apply "${PATCH_FILE}"
  echo "Applied patch: ${PATCH_FILE}"
fi

cargo build --manifest-path silverscript-lang/Cargo.toml --bin silverc

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
SMOKE_CONTRACTS=(
  "${REPO_ROOT}/contracts/zk/opzkprecompile-smoke.sil"
  "${REPO_ROOT}/contracts/zk/opgroth16verify-smoke.sil"
)

for SMOKE_CONTRACT in "${SMOKE_CONTRACTS[@]}"; do
  OUT_BASENAME="$(basename "${SMOKE_CONTRACT}" .sil)"
  "${SILVERC_BIN}" --ast-only "${SMOKE_CONTRACT}" --output "${TMP_DIR}/${OUT_BASENAME}.json"
  echo "Patched silverc smoke test passed: ${SMOKE_CONTRACT}"
done
