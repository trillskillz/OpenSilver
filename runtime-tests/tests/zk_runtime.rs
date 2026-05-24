// Phase 5 runtime suite.
//
// COMPILER REQUIREMENT: this suite requires the OpenSilver Phase-5 compiler
// patch. Run `npm run patch:silverc:zk` (or
// `bash scripts/apply-silverscript-opzkprecompile-patch.sh`) before
// `cargo test --test zk_runtime`. The patch adds `OpGroth16Verify` and
// `OpZkPrecompile` builtins to the pinned upstream silverscript-lang
// checkout that this crate path-imports. Without the patch, the contracts
// under `contracts/zk/` fail to parse.
//
// What this suite proves: Pattern 5.1 Verified Computation lowers via the
// patched silverc + executes through `kaspa-txscript`'s engine with a
// real Groth16 fixture (verifying key + proof + public inputs sourced
// from `rusty-kaspa`'s engine-side KIP-16 test vector, vendored at
// `references/fixtures/groth16-opzkprecompile-fixture.json`).

use std::fs;
use std::path::PathBuf;

use kaspa_consensus_core::Hash;
use kaspa_consensus_core::hashing::sighash::{SigHashReusedValuesUnsync, calc_schnorr_signature_hash};
use kaspa_consensus_core::hashing::sighash_type::SIG_HASH_ALL;
use kaspa_consensus_core::mass::units::SigopCount;
use kaspa_consensus_core::tx::{
    CovenantBinding, MutableTransaction, PopulatedTransaction, ScriptPublicKey, Transaction, TransactionId,
    TransactionInput, TransactionOutpoint, TransactionOutput, UtxoEntry,
};
use kaspa_txscript::caches::Cache;
use kaspa_txscript::covenants::CovenantsContext;
use kaspa_txscript::opcodes::codes::OpCheckSig;
use kaspa_txscript::script_builder::ScriptBuilder;
use kaspa_txscript::{EngineCtx, EngineFlags, TxScriptEngine, pay_to_script_hash_script};
use kaspa_txscript_errors::TxScriptError;
use rand::thread_rng;
use secp256k1::{Keypair, Message, Secp256k1, SecretKey};
use serde::Deserialize;
use silverscript_lang::ast::Expr;
use silverscript_lang::compiler::{CompileOptions, CompiledContract, compile_contract};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().expect("runtime-tests lives under repo root").to_path_buf()
}

#[derive(Debug, Deserialize)]
struct Groth16Fixture {
    #[serde(rename = "verifyingKeyCompressedHex")]
    verifying_key_compressed_hex: String,
    #[serde(rename = "proofCompressedHex")]
    proof_compressed_hex: String,
    #[serde(rename = "publicInputsHex")]
    public_inputs_hex: Vec<String>,
}

fn load_groth16_fixture() -> Groth16Fixture {
    let path = repo_root().join("references/fixtures/groth16-opzkprecompile-fixture.json");
    let body = fs::read_to_string(&path).unwrap_or_else(|err| panic!("read fixture {path:?}: {err}"));
    serde_json::from_str(&body).expect("fixture is valid JSON in the documented Groth16 schema")
}

fn decode_hex(hex: &str) -> Vec<u8> {
    let trimmed = hex.strip_prefix("0x").unwrap_or(hex);
    (0..trimmed.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&trimmed[i..i + 2], 16).expect("hex byte parses"))
        .collect()
}

fn bytes_to_expr(bytes: &[u8]) -> Expr<'static> {
    Expr::bytes(bytes.to_vec())
}

fn random_keypair() -> Keypair {
    let secp = Secp256k1::new();
    let secret = SecretKey::new(&mut thread_rng());
    Keypair::from_secret_key(&secp, &secret)
}

fn schnorr_signature<T: AsRef<Transaction>>(tx: &MutableTransaction<T>, input_index: usize, keypair: &Keypair) -> Vec<u8> {
    let reused_values = SigHashReusedValuesUnsync::new();
    let sig_hash = calc_schnorr_signature_hash(&tx.as_verifiable(), input_index, SIG_HASH_ALL, &reused_values);
    let msg = Message::from_digest_slice(sig_hash.as_bytes().as_slice()).expect("valid sighash message");
    let sig = keypair.sign_schnorr(msg);
    let mut bytes = Vec::from(sig.as_ref());
    bytes.push(SIG_HASH_ALL.to_u8());
    bytes
}

fn build_p2pk_script(pubkey: &[u8]) -> Vec<u8> {
    ScriptBuilder::new().add_data(pubkey).unwrap().add_op(OpCheckSig).unwrap().drain()
}

fn execute_plain_input(tx: Transaction, utxo_entry: UtxoEntry) -> Result<(), TxScriptError> {
    let reused_values = SigHashReusedValuesUnsync::new();
    let sig_cache = Cache::new(10_000);
    let input = tx.inputs[0].clone();
    let populated_tx = PopulatedTransaction::new(&tx, vec![utxo_entry.clone()]);
    let mut vm = TxScriptEngine::from_transaction_input(
        &populated_tx,
        &input,
        0,
        &utxo_entry,
        EngineCtx::new(&sig_cache).with_reused(&reused_values),
        EngineFlags { covenants_enabled: true, ..Default::default() },
    );
    vm.execute()
}

/// Execute one input of a multi-input transaction with full covenant
/// context built from ALL utxo entries. Used by Pattern 5.4 to verify
/// both leader and delegate paths in the same proof-stitched batch.
fn execute_multi_input_with_covenants(
    tx: Transaction,
    utxo_entries: Vec<UtxoEntry>,
    input_index: usize,
) -> Result<(), TxScriptError> {
    let reused_values = SigHashReusedValuesUnsync::new();
    let sig_cache = Cache::new(10_000);
    let input = tx.inputs[input_index].clone();
    let utxo_entry = utxo_entries[input_index].clone();
    let populated_tx = PopulatedTransaction::new(&tx, utxo_entries);
    let cov_ctx = CovenantsContext::from_tx(&populated_tx).map_err(TxScriptError::from)?;

    let mut vm = TxScriptEngine::from_transaction_input(
        &populated_tx,
        &input,
        input_index,
        &utxo_entry,
        EngineCtx::new(&sig_cache).with_reused(&reused_values).with_covenants_ctx(&cov_ctx),
        EngineFlags { covenants_enabled: true, sigop_script_units: 0.into() },
    );
    vm.execute()
}

fn compile_verified_computation(
    verifying_key: &[u8],
    recipient_pk: &[u8],
    prover_pk: &[u8],
) -> CompiledContract<'static> {
    let source = fs::read_to_string(repo_root().join("contracts/zk/verified-computation.sil"))
        .expect("contract source reads");
    let args: Vec<Expr<'static>> = vec![
        bytes_to_expr(verifying_key),
        bytes_to_expr(recipient_pk),
        bytes_to_expr(prover_pk),
    ];
    let leaked_source: &'static str = Box::leak(source.into_boxed_str());
    let leaked_args: &'static [Expr<'static>] = Vec::leak(args);
    compile_contract(leaked_source, leaked_args, CompileOptions::default())
        .expect("verified-computation.sil compiles under the patched silverc")
}

fn compile_private_asset_transfer(
    verifying_key: &[u8],
    commitment_root: &[u8],
    amount: i64,
) -> CompiledContract<'static> {
    let source = fs::read_to_string(repo_root().join("contracts/zk/private-asset-transfer.sil"))
        .expect("contract source reads");
    let args: Vec<Expr<'static>> = vec![
        bytes_to_expr(verifying_key),
        bytes_to_expr(commitment_root),
        Expr::int(amount),
    ];
    let leaked_source: &'static str = Box::leak(source.into_boxed_str());
    let leaked_args: &'static [Expr<'static>] = Vec::leak(args);
    compile_contract(leaked_source, leaked_args, CompileOptions::default())
        .expect("private-asset-transfer.sil compiles under the patched silverc")
}

fn compile_proof_stitched(verifying_key: &[u8], recipient_pk: &[u8]) -> CompiledContract<'static> {
    let source = fs::read_to_string(repo_root().join("contracts/zk/proof-stitched-multi-pattern.sil"))
        .expect("contract source reads");
    let args: Vec<Expr<'static>> = vec![bytes_to_expr(verifying_key), bytes_to_expr(recipient_pk)];
    let leaked_source: &'static str = Box::leak(source.into_boxed_str());
    let leaked_args: &'static [Expr<'static>] = Vec::leak(args);
    compile_contract(leaked_source, leaked_args, CompileOptions::default())
        .expect("proof-stitched-multi-pattern.sil compiles under the patched silverc")
}

fn compile_zk_verified_oracle(
    verifying_key: &[u8],
    recipient_pk: &[u8],
    threshold: i64,
    guardian1_pk: &[u8],
    guardian2_pk: &[u8],
    guardian3_pk: &[u8],
) -> CompiledContract<'static> {
    let source = fs::read_to_string(repo_root().join("contracts/zk/zk-verified-oracle.sil"))
        .expect("contract source reads");
    let args: Vec<Expr<'static>> = vec![
        bytes_to_expr(verifying_key),
        bytes_to_expr(recipient_pk),
        Expr::int(threshold),
        bytes_to_expr(guardian1_pk),
        bytes_to_expr(guardian2_pk),
        bytes_to_expr(guardian3_pk),
    ];
    let leaked_source: &'static str = Box::leak(source.into_boxed_str());
    let leaked_args: &'static [Expr<'static>] = Vec::leak(args);
    compile_contract(leaked_source, leaked_args, CompileOptions::default())
        .expect("zk-verified-oracle.sil compiles under the patched silverc")
}

// ─── Pattern 5.1: Verified Computation ─────────────────────────────────────

#[test]
fn verified_computation_accepts_valid_groth16_proof() {
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();
    assert_eq!(public_inputs.len(), 5, "fixture must have 5 public inputs (matches contract arity)");

    let recipient = random_keypair();
    let prover = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let prover_pk = prover.x_only_public_key().0.serialize().to_vec();

    let compiled = compile_verified_computation(&verifying_key, &recipient_pk, &prover_pk);

    let input_value = 5_000u64;
    let payout_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xA0; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let prover_sig = schnorr_signature(&mutable, 0, &prover);

    // Sigscript args, in source order, match the contract's verify_and_release(...)
    // declaration: prover_pk, prover_sig, proof, pi0..pi4.
    let sigscript = compiled
        .build_sig_script(
            "verify_and_release",
            vec![
                prover_pk.into(),
                prover_sig.into(),
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("verify_and_release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "verified-computation runtime failed: {}", result.unwrap_err());
}

#[test]
fn verified_computation_rejects_tampered_proof() {
    // Same fixture but with one byte of the proof flipped — the Groth16
    // verifier must reject, surfacing as TxScriptError::ZkIntegrity.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let mut proof = decode_hex(&fixture.proof_compressed_hex);
    proof[0] ^= 0xff; // flip the first byte
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let prover = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let prover_pk = prover.x_only_public_key().0.serialize().to_vec();

    let compiled = compile_verified_computation(&verifying_key, &recipient_pk, &prover_pk);

    let input_value = 5_000u64;
    let payout_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xA1; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let prover_sig = schnorr_signature(&mutable, 0, &prover);
    let sigscript = compiled
        .build_sig_script(
            "verify_and_release",
            vec![
                prover_pk.into(),
                prover_sig.into(),
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("verify_and_release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("tampered proof must fail");
    match err {
        TxScriptError::ZkIntegrity(_) | TxScriptError::VerifyError | TxScriptError::EvalFalse => {}
        other => panic!("unexpected error variant: {other:?}"),
    }
}

#[test]
fn verified_computation_rejects_wrong_prover_signature() {
    // Valid proof, but the prover slot is filled with an attacker's
    // credentials. The require(prover_pk == prover) gate kills it.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let prover = random_keypair();
    let attacker = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let prover_pk = prover.x_only_public_key().0.serialize().to_vec();
    let attacker_pk = attacker.x_only_public_key().0.serialize().to_vec();

    let compiled = compile_verified_computation(&verifying_key, &recipient_pk, &prover_pk);

    let input_value = 5_000u64;
    let payout_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xA2; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);
    let sigscript = compiled
        .build_sig_script(
            "verify_and_release",
            vec![
                attacker_pk.into(),
                attacker_sig.into(),
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("verify_and_release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("attacker prover must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── Pattern 5.3: ZK-Verified Oracle ───────────────────────────────────────

#[test]
fn zk_verified_oracle_accepts_quorum_plus_groth16() {
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let g1 = random_keypair();
    let g2 = random_keypair();
    let g3 = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let g1_pk = g1.x_only_public_key().0.serialize().to_vec();
    let g2_pk = g2.x_only_public_key().0.serialize().to_vec();
    let g3_pk = g3.x_only_public_key().0.serialize().to_vec();

    let threshold = 2_i64;
    let compiled = compile_zk_verified_oracle(&verifying_key, &recipient_pk, threshold, &g1_pk, &g2_pk, &g3_pk);

    let input_value = 5_000u64;
    let payout_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xB0; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    // 2-of-3: g1 and g2 sign validly; the third slot is padded with a
    // non-member who can't push the approval count past threshold.
    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize().to_vec();
    let sig1 = schnorr_signature(&mutable, 0, &g1);
    let sig2 = schnorr_signature(&mutable, 0, &g2);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);

    let sigscript = compiled
        .build_sig_script(
            "publish",
            vec![
                g1_pk.into(),
                sig1.into(),
                g2_pk.into(),
                sig2.into(),
                attacker_pk.into(),
                attacker_sig.into(),
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("publish sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "zk-verified-oracle runtime failed: {}", result.unwrap_err());

    let _ = g3_pk;
}

#[test]
fn zk_verified_oracle_rejects_below_committee_threshold() {
    // Valid Groth16 proof, but only one valid guardian signature — below
    // threshold = 2. The approvalCount() < threshold gate fires.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let g1 = random_keypair();
    let g2 = random_keypair();
    let g3 = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let g1_pk = g1.x_only_public_key().0.serialize().to_vec();
    let g2_pk = g2.x_only_public_key().0.serialize().to_vec();
    let g3_pk = g3.x_only_public_key().0.serialize().to_vec();

    let threshold = 2_i64;
    let compiled = compile_zk_verified_oracle(&verifying_key, &recipient_pk, threshold, &g1_pk, &g2_pk, &g3_pk);

    let input_value = 5_000u64;
    let payout_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xB1; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    // Only g1 signs validly; the other two slots are non-members.
    let attacker_a = random_keypair();
    let attacker_b = random_keypair();
    let attacker_a_pk = attacker_a.x_only_public_key().0.serialize().to_vec();
    let attacker_b_pk = attacker_b.x_only_public_key().0.serialize().to_vec();
    let sig1 = schnorr_signature(&mutable, 0, &g1);
    let sig_a = schnorr_signature(&mutable, 0, &attacker_a);
    let sig_b = schnorr_signature(&mutable, 0, &attacker_b);

    let sigscript = compiled
        .build_sig_script(
            "publish",
            vec![
                g1_pk.into(),
                sig1.into(),
                attacker_a_pk.into(),
                sig_a.into(),
                attacker_b_pk.into(),
                sig_b.into(),
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("publish sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("below-threshold quorum must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");

    let _ = (g2_pk, g3_pk);
}

#[test]
fn zk_verified_oracle_rejects_quorum_but_tampered_proof() {
    // Two valid guardian sigs (would pass threshold) but the proof has
    // been tampered. Both tiers must succeed; the Groth16 verifier fires.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let mut proof = decode_hex(&fixture.proof_compressed_hex);
    proof[0] ^= 0xff;
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let g1 = random_keypair();
    let g2 = random_keypair();
    let g3 = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let g1_pk = g1.x_only_public_key().0.serialize().to_vec();
    let g2_pk = g2.x_only_public_key().0.serialize().to_vec();
    let g3_pk = g3.x_only_public_key().0.serialize().to_vec();

    let threshold = 2_i64;
    let compiled = compile_zk_verified_oracle(&verifying_key, &recipient_pk, threshold, &g1_pk, &g2_pk, &g3_pk);

    let input_value = 5_000u64;
    let payout_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xB2; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize().to_vec();
    let sig1 = schnorr_signature(&mutable, 0, &g1);
    let sig2 = schnorr_signature(&mutable, 0, &g2);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);

    let sigscript = compiled
        .build_sig_script(
            "publish",
            vec![
                g1_pk.into(),
                sig1.into(),
                g2_pk.into(),
                sig2.into(),
                attacker_pk.into(),
                attacker_sig.into(),
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("publish sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("tampered proof must fail");
    match err {
        TxScriptError::ZkIntegrity(_) | TxScriptError::VerifyError | TxScriptError::EvalFalse => {}
        other => panic!("unexpected error variant: {other:?}"),
    }

    let _ = g3_pk;
}

// ─── Pattern 5.4: Proof-Stitched Multi-Pattern ─────────────────────────────
//
// Two-input batch sharing one covenant_id. Leader runs OpGroth16Verify
// once; delegate trusts via covenant-id context. Both inputs each pay
// their own value (minus fee) to the deploy-time recipient. The economic
// win — amortising Groth16 cost across N inputs — comes from the leader
// being the only input that runs the expensive verifier.

fn build_proof_stitched_two_input_tx(
    compiled_script: &[u8],
    recipient_pk: &[u8],
    input_values: [u64; 2],
    outpoint_markers: [u8; 2],
    cov_id: Hash,
) -> (Transaction, Vec<UtxoEntry>) {
    let inputs = vec![
        TransactionInput {
            previous_outpoint: TransactionOutpoint {
                transaction_id: TransactionId::from_bytes([outpoint_markers[0]; 32]),
                index: 0,
            },
            signature_script: vec![],
            sequence: 0,
            mass: SigopCount(1).into(),
        },
        TransactionInput {
            previous_outpoint: TransactionOutpoint {
                transaction_id: TransactionId::from_bytes([outpoint_markers[1]; 32]),
                index: 0,
            },
            signature_script: vec![],
            sequence: 0,
            mass: SigopCount(1).into(),
        },
    ];

    // Output[i] pairs with input[i] per `requireExactPayout`'s
    // tx.outputs[this.activeInputIndex] convention.
    let outputs = (0..2)
        .map(|i| TransactionOutput {
            value: input_values[i] - 1_000,
            script_public_key: ScriptPublicKey::new(0, build_p2pk_script(recipient_pk).into()),
            covenant: None,
        })
        .collect();

    let tx = Transaction::new(1, inputs, outputs, 0, Default::default(), 0, vec![]);

    // Both inputs spend UtxoEntries pinned to the SAME cov_id with the
    // scriptPubKey set DIRECTLY to the compiled script (not P2SH-wrapped).
    // For P2SH spends, the sigscript would need to push the redeem-script
    // bytes after the args; for direct-script spends, the engine runs the
    // utxo's scriptPubKey straight after the sigscript pushes its args.
    // Matches the verified-computation + zk-verified-oracle harness shape.
    let utxos = (0..2)
        .map(|i| {
            UtxoEntry::new(
                input_values[i],
                ScriptPublicKey::new(0, compiled_script.to_vec().into()),
                0,
                false,
                Some(cov_id),
            )
        })
        .collect();

    (tx, utxos)
}

#[test]
fn proof_stitched_leader_delegate_two_input_batch_passes() {
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_proof_stitched(&verifying_key, &recipient_pk);

    let cov_id = Hash::from_bytes(*b"PSMP_COVENANT_ID_00000000000000z");
    let (tx, utxos) = build_proof_stitched_two_input_tx(
        &compiled.script,
        &recipient_pk,
        [5_000, 7_000],
        [0xC0, 0xC1],
        cov_id,
    );

    // Input 0 is the LEADER (lowest cov-bound index). Its sigscript
    // selects leader_release(proof, pi0..pi4).
    let mutable_for_sigscript = MutableTransaction::with_entries(tx.clone(), utxos.clone());
    let leader_sigscript = compiled
        .build_sig_script(
            "leader_release",
            vec![
                proof.clone().into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("leader_release sigscript builds");
    let delegate_sigscript = compiled
        .build_sig_script("delegate_release", vec![])
        .expect("delegate_release sigscript builds");
    let _ = mutable_for_sigscript;

    let mut tx_with_sigs = tx;
    tx_with_sigs.inputs[0].signature_script = leader_sigscript;
    tx_with_sigs.inputs[1].signature_script = delegate_sigscript;

    // Execute BOTH inputs through the engine. Both must accept for the
    // batch to be valid. The leader does the expensive proof verification;
    // the delegate just runs the cheap cov-context + payout checks.
    let leader_result = execute_multi_input_with_covenants(tx_with_sigs.clone(), utxos.clone(), 0);
    assert!(leader_result.is_ok(), "leader input failed: {}", leader_result.unwrap_err());

    let delegate_result = execute_multi_input_with_covenants(tx_with_sigs, utxos, 1);
    assert!(delegate_result.is_ok(), "delegate input failed: {}", delegate_result.unwrap_err());
}

#[test]
fn proof_stitched_delegate_at_leader_position_rejected() {
    // The delegate path requires this.activeInputIndex != leader_idx.
    // If a sigscript with delegate_release runs at input 0 (which IS
    // the leader position because it's the lowest cov-bound index),
    // the inequality fails.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let recipient = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_proof_stitched(&verifying_key, &recipient_pk);

    let cov_id = Hash::from_bytes(*b"PSMP_COVENANT_ID_00000000000001z");
    let (tx, utxos) = build_proof_stitched_two_input_tx(
        &compiled.script,
        &recipient_pk,
        [5_000, 7_000],
        [0xC2, 0xC3],
        cov_id,
    );

    let delegate_sigscript = compiled
        .build_sig_script("delegate_release", vec![])
        .expect("delegate_release sigscript builds");

    let mut tx_with_sigs = tx;
    // Put delegate_release at input 0 (the leader slot) — must fail.
    tx_with_sigs.inputs[0].signature_script = delegate_sigscript.clone();
    tx_with_sigs.inputs[1].signature_script = delegate_sigscript;

    let err = execute_multi_input_with_covenants(tx_with_sigs, utxos, 0)
        .expect_err("delegate at leader position must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

#[test]
fn proof_stitched_leader_rejects_tampered_proof() {
    // Leader at correct position, but proof is tampered. The
    // OpGroth16Verify gate fires.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let mut proof = decode_hex(&fixture.proof_compressed_hex);
    proof[0] ^= 0xff;
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let recipient = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_proof_stitched(&verifying_key, &recipient_pk);

    let cov_id = Hash::from_bytes(*b"PSMP_COVENANT_ID_00000000000002z");
    let (tx, utxos) = build_proof_stitched_two_input_tx(
        &compiled.script,
        &recipient_pk,
        [5_000, 7_000],
        [0xC4, 0xC5],
        cov_id,
    );

    let leader_sigscript = compiled
        .build_sig_script(
            "leader_release",
            vec![
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("leader_release sigscript builds");
    let delegate_sigscript = compiled
        .build_sig_script("delegate_release", vec![])
        .expect("delegate_release sigscript builds");

    let mut tx_with_sigs = tx;
    tx_with_sigs.inputs[0].signature_script = leader_sigscript;
    tx_with_sigs.inputs[1].signature_script = delegate_sigscript;

    let err = execute_multi_input_with_covenants(tx_with_sigs, utxos, 0)
        .expect_err("tampered leader proof must fail");
    match err {
        TxScriptError::ZkIntegrity(_) | TxScriptError::VerifyError | TxScriptError::EvalFalse => {}
        other => panic!("unexpected error variant: {other:?}"),
    }
}

// ─── Pattern 5.2: Private Asset Transfer ───────────────────────────────────
//
// The fixture's public_inputs[2] (a 32-byte BN254 field element) is
// reinterpreted as the recipient's x-only pubkey here. It's not a valid
// secp256k1 point in the real world — the engine doesn't care because
// the contract compares scriptPubKey bytes verbatim, and the same
// invalid-but-deterministic bytes appear on both sides. A real circuit
// would gate pi_recipient on x-only-point validity inside the circuit;
// these tests prove the COVENANT side of the contract works against the
// shared Groth16 verifier surface.

#[test]
fn private_asset_transfer_accepts_valid_proof_with_pinned_outputs() {
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let commitment_root = public_inputs[0].clone();
    let pi_recipient_bytes = public_inputs[2].clone();
    let amount = 1_000_i64;

    let compiled = compile_private_asset_transfer(&verifying_key, &commitment_root, amount);

    // Build a tx whose output[0] pins (amount, P2PK(pi_recipient_bytes)).
    // We use the same bytes the contract will derive from pi[2] so the
    // scriptPubKey comparison succeeds.
    let recipient_p2pk = build_p2pk_script(&pi_recipient_bytes);
    let output0 = TransactionOutput {
        value: amount as u64,
        script_public_key: ScriptPublicKey::new(0, recipient_p2pk.into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xD0; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    // Input value > amount so the contract's amount-pin succeeds even
    // though we don't compute fees here.
    let input_value = 5_000u64;
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let sigscript = compiled
        .build_sig_script(
            "transfer",
            vec![
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("transfer sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "private-asset-transfer runtime failed: {}", result.unwrap_err());
}

#[test]
fn private_asset_transfer_rejects_wrong_commitment_root() {
    // Same fixture but the contract is deployed with a DIFFERENT
    // commitment_root. The require(pi_commitment_root == commitment_root)
    // gate fires before the proof verification.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    // Deploy with a commitment_root that doesn't match pi[0].
    let wrong_root: Vec<u8> = (0..32).map(|i| i as u8).collect();
    let pi_recipient_bytes = public_inputs[2].clone();
    let amount = 1_000_i64;

    let compiled = compile_private_asset_transfer(&verifying_key, &wrong_root, amount);

    let recipient_p2pk = build_p2pk_script(&pi_recipient_bytes);
    let output0 = TransactionOutput {
        value: amount as u64,
        script_public_key: ScriptPublicKey::new(0, recipient_p2pk.into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xD1; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(5_000, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let sigscript = compiled
        .build_sig_script(
            "transfer",
            vec![
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("transfer sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo)
        .expect_err("commitment_root mismatch must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

#[test]
fn private_asset_transfer_rejects_payout_to_wrong_recipient() {
    // Valid proof + matching commitment_root, but tx output 0 routes
    // to a DIFFERENT recipient than pi_recipient. The
    // requirePayoutToPiRecipient gate fires.
    let fixture = load_groth16_fixture();
    let verifying_key = decode_hex(&fixture.verifying_key_compressed_hex);
    let proof = decode_hex(&fixture.proof_compressed_hex);
    let public_inputs: Vec<Vec<u8>> =
        fixture.public_inputs_hex.iter().map(|s| decode_hex(s)).collect();

    let commitment_root = public_inputs[0].clone();
    let amount = 1_000_i64;

    let compiled = compile_private_asset_transfer(&verifying_key, &commitment_root, amount);

    // Wrong recipient bytes — anything other than pi[2].
    let wrong_recipient: Vec<u8> = (0..32).map(|i| 0xFFu8 ^ i as u8).collect();
    let recipient_p2pk = build_p2pk_script(&wrong_recipient);
    let output0 = TransactionOutput {
        value: amount as u64,
        script_public_key: ScriptPublicKey::new(0, recipient_p2pk.into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xD2; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(5_000, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let sigscript = compiled
        .build_sig_script(
            "transfer",
            vec![
                proof.into(),
                public_inputs[0].clone().into(),
                public_inputs[1].clone().into(),
                public_inputs[2].clone().into(),
                public_inputs[3].clone().into(),
                public_inputs[4].clone().into(),
            ],
        )
        .expect("transfer sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo)
        .expect_err("wrong-recipient payout must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}
