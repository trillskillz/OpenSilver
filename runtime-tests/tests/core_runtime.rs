use std::fs;
use std::path::PathBuf;

use kaspa_consensus_core::Hash;
use kaspa_consensus_core::hashing::sighash::{SigHashReusedValuesUnsync, calc_schnorr_signature_hash};
use kaspa_consensus_core::hashing::sighash_type::SIG_HASH_ALL;
use kaspa_consensus_core::mass::units::SigopCount;
use kaspa_consensus_core::tx::{
    CovenantBinding, MutableTransaction, PopulatedTransaction, ScriptPublicKey, Transaction, TransactionId, TransactionInput,
    TransactionOutpoint, TransactionOutput, UtxoEntry,
};
use kaspa_txscript::caches::Cache;
use kaspa_txscript::covenants::CovenantsContext;
use kaspa_txscript::opcodes::codes::OpCheckSig;
use kaspa_txscript::script_builder::ScriptBuilder;
use kaspa_txscript::{EngineCtx, EngineFlags, TxScriptEngine, pay_to_script_hash_script};
use kaspa_txscript_errors::TxScriptError;
use rand::thread_rng;
use secp256k1::{Keypair, Message, Secp256k1, SecretKey};
use silverscript_lang::ast::Expr;
use silverscript_lang::compiler::{CompileOptions, CompiledContract, CovenantDeclCallOptions, compile_contract, struct_object};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().expect("runtime-tests lives under repo root").to_path_buf()
}

fn read_contract(rel: &str) -> String {
    fs::read_to_string(repo_root().join(rel)).expect("contract source reads")
}

fn compile_contract_file(rel: &str, args: Vec<Expr<'static>>) -> CompiledContract<'static> {
    let source = read_contract(rel);
    let args: &'static [Expr<'static>] = Vec::leak(args);
    compile_contract(Box::leak(source.into_boxed_str()), args, CompileOptions::default()).expect("contract compiles")
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

fn execute_covenant_input(tx: Transaction, utxo_entry: UtxoEntry) -> Result<(), TxScriptError> {
    let reused_values = SigHashReusedValuesUnsync::new();
    let sig_cache = Cache::new(10_000);
    let input = tx.inputs[0].clone();
    let populated_tx = PopulatedTransaction::new(&tx, vec![utxo_entry.clone()]);
    let cov_ctx = CovenantsContext::from_tx(&populated_tx).map_err(TxScriptError::from)?;

    let mut vm = TxScriptEngine::from_transaction_input(
        &populated_tx,
        &input,
        0,
        &utxo_entry,
        EngineCtx::new(&sig_cache).with_reused(&reused_values).with_covenants_ctx(&cov_ctx),
        EngineFlags { covenants_enabled: true, sigop_script_units: 0.into() },
    );
    vm.execute()
}

fn covenant_sigscript(compiled: &CompiledContract<'_>, function_name: &str, args: Vec<Expr<'_>>) -> Vec<u8> {
    let mut sigscript = compiled
        .build_sig_script_for_covenant_decl(function_name, args, CovenantDeclCallOptions { is_leader: false })
        .expect("covenant sigscript builds");
    let redeem_script = ScriptBuilder::new().add_data(&compiled.script).expect("push redeem script").drain();
    sigscript.extend_from_slice(&redeem_script);
    sigscript
}

#[test]
fn timelock_claim_accepts_correct_terminal_payout() {
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let unlock_time = 5_i64;
    let compiled = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(true),
        ],
    );

    let input_value = 2_000u64;
    let payout_value = 1_000u64;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&beneficiary_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint { transaction_id: TransactionId::from_bytes([1u8; 32]), index: 0 },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], unlock_time as u64, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let beneficiary_sig = schnorr_signature(&mutable, 0, &beneficiary);
    let sigscript = compiled
        .build_sig_script("claim", vec![beneficiary_pk.to_vec().into(), beneficiary_sig.into()])
        .expect("claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "timelock claim runtime failed: {}", result.unwrap_err());
}

#[test]
fn timelock_claim_rejects_wrong_terminal_destination() {
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let wrong_dest = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let wrong_pk = wrong_dest.x_only_public_key().0.serialize();
    let unlock_time = 5_i64;
    let compiled = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(true),
        ],
    );

    let input_value = 2_000u64;
    let payout_value = 1_000u64;
    let output0 = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&wrong_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint { transaction_id: TransactionId::from_bytes([2u8; 32]), index: 0 },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], unlock_time as u64, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let beneficiary_sig = schnorr_signature(&mutable, 0, &beneficiary);
    let sigscript = compiled
        .build_sig_script("claim", vec![beneficiary_pk.to_vec().into(), beneficiary_sig.into()])
        .expect("claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("wrong destination should fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

#[test]
fn milestone_approve_accepts_single_preserved_value_continuation() {
    let buyer = random_keypair();
    let seller = random_keypair();
    let arbiter = random_keypair();
    let buyer_pk = buyer.x_only_public_key().0.serialize();
    let seller_pk = seller.x_only_public_key().0.serialize();
    let arbiter_pk = arbiter.x_only_public_key().0.serialize();
    let arbiter_hash = blake2b_simd::Params::new().hash_length(32).to_state().update(arbiter_pk.as_slice()).finalize().as_bytes().to_vec();

    let active = compile_contract_file(
        "contracts/core/escrow-milestone.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.clone().into(),
            3.into(),
            1.into(),
            100.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/escrow-milestone.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.clone().into(),
            3.into(),
            2.into(),
            100.into(),
        ],
    );

    let input_value = 2_000u64;
    let continuation_value = 1_000u64;
    let covenant_id = Hash::from_bytes(*b"MS_CONTINUATION_ID_0000000000000");
    let output0 = TransactionOutput {
        value: continuation_value,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint { transaction_id: TransactionId::from_bytes([3u8; 32]), index: 0 },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(covenant_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let seller_sig = schnorr_signature(&mutable, 0, &seller);
    let sigscript = covenant_sigscript(
        &active,
        "approve_milestone",
        vec![
            arbiter_pk.to_vec().into(),
            arbiter_sig.into(),
            seller_pk.to_vec().into(),
            seller_sig.into(),
        ],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "milestone continuation runtime failed: {}", result.unwrap_err());
}

#[test]
fn milestone_approve_rejects_wrong_continuation_value() {
    let buyer = random_keypair();
    let seller = random_keypair();
    let arbiter = random_keypair();
    let buyer_pk = buyer.x_only_public_key().0.serialize();
    let seller_pk = seller.x_only_public_key().0.serialize();
    let arbiter_pk = arbiter.x_only_public_key().0.serialize();
    let arbiter_hash = blake2b_simd::Params::new().hash_length(32).to_state().update(arbiter_pk.as_slice()).finalize().as_bytes().to_vec();

    let active = compile_contract_file(
        "contracts/core/escrow-milestone.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.clone().into(),
            3.into(),
            1.into(),
            100.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/escrow-milestone.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.clone().into(),
            3.into(),
            2.into(),
            100.into(),
        ],
    );

    let input_value = 2_000u64;
    let wrong_continuation_value = 999u64;
    let covenant_id = Hash::from_bytes(*b"MS_CONTINUATION_ID_0000000000000");
    let output0 = TransactionOutput {
        value: wrong_continuation_value,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint { transaction_id: TransactionId::from_bytes([4u8; 32]), index: 0 },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(covenant_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let seller_sig = schnorr_signature(&mutable, 0, &seller);
    let sigscript = covenant_sigscript(
        &active,
        "approve_milestone",
        vec![
            arbiter_pk.to_vec().into(),
            arbiter_sig.into(),
            seller_pk.to_vec().into(),
            seller_sig.into(),
        ],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_covenant_input(mutable.tx, utxo).expect_err("wrong continuation value should fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── Helpers shared by the terminal-payout patterns ─────────────────────────

/// Build a single-output Transaction paying P2PK(dest) with the input value
/// minus the canonical 1000-sompi miner fee enforced by `requireExactPayout`.
fn build_terminal_payout_tx(
    dest_pk: &[u8],
    input_value: u64,
    locktime: u64,
    outpoint_marker: u8,
) -> (Transaction, u64) {
    let miner_fee = 1000u64;
    let payout = input_value - miner_fee;
    let output0 = TransactionOutput {
        value: payout,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(dest_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([outpoint_marker; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], locktime, Default::default(), 0, vec![]);
    (tx, payout)
}

// ─── AtomicSwapHTLC ─────────────────────────────────────────────────────────

#[test]
fn htlc_claim_accepts_correct_secret_and_payout() {
    let recipient = random_keypair();
    let refunder = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize();
    let refunder_pk = refunder.x_only_public_key().0.serialize();
    let secret = b"open-sesame-32-byte-secret-value".to_vec();
    let secret_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&secret)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout = 100_i64;
    let compiled = compile_contract_file(
        "contracts/core/atomic-swap-htlc.sil",
        vec![
            recipient_pk.to_vec().into(),
            refunder_pk.to_vec().into(),
            secret_hash.clone().into(),
            timeout.into(),
        ],
    );

    let input_value = 5_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&recipient_pk, input_value, 0, 0x10);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let recipient_sig = schnorr_signature(&mutable, 0, &recipient);
    let sigscript = compiled
        .build_sig_script(
            "claim",
            vec![recipient_pk.to_vec().into(), recipient_sig.into(), secret.into()],
        )
        .expect("htlc claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "htlc claim runtime failed: {}", result.unwrap_err());
}

#[test]
fn htlc_claim_rejects_wrong_secret() {
    let recipient = random_keypair();
    let refunder = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize();
    let refunder_pk = refunder.x_only_public_key().0.serialize();
    let real_secret = b"open-sesame-32-byte-secret-value".to_vec();
    let secret_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&real_secret)
        .finalize()
        .as_bytes()
        .to_vec();
    let wrong_secret = b"WRONG-32-byte-preimage-attempt-x".to_vec();
    let timeout = 100_i64;
    let compiled = compile_contract_file(
        "contracts/core/atomic-swap-htlc.sil",
        vec![
            recipient_pk.to_vec().into(),
            refunder_pk.to_vec().into(),
            secret_hash.clone().into(),
            timeout.into(),
        ],
    );

    let input_value = 5_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&recipient_pk, input_value, 0, 0x11);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let recipient_sig = schnorr_signature(&mutable, 0, &recipient);
    let sigscript = compiled
        .build_sig_script(
            "claim",
            vec![recipient_pk.to_vec().into(), recipient_sig.into(), wrong_secret.into()],
        )
        .expect("htlc claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("wrong preimage should fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── BilateralEscrow ────────────────────────────────────────────────────────

#[test]
fn bilateral_release_to_seller_accepts_arbiter_and_seller() {
    let buyer = random_keypair();
    let seller = random_keypair();
    let arbiter = random_keypair();
    let buyer_pk = buyer.x_only_public_key().0.serialize();
    let seller_pk = seller.x_only_public_key().0.serialize();
    let arbiter_pk = arbiter.x_only_public_key().0.serialize();
    let arbiter_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&arbiter_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout = 1_000_i64;
    let compiled = compile_contract_file(
        "contracts/core/escrow-bilateral.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.clone().into(),
            timeout.into(),
        ],
    );

    let input_value = 4_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&seller_pk, input_value, 0, 0x20);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let seller_sig = schnorr_signature(&mutable, 0, &seller);
    let sigscript = compiled
        .build_sig_script(
            "release_to_seller",
            vec![
                arbiter_pk.to_vec().into(),
                arbiter_sig.into(),
                seller_pk.to_vec().into(),
                seller_sig.into(),
            ],
        )
        .expect("release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "bilateral release runtime failed: {}", result.unwrap_err());
}

#[test]
fn bilateral_release_rejects_payout_to_buyer() {
    // Same arbiter+seller signatures but routed to the buyer — the contract
    // pins the destination to the seller, so this must fail.
    let buyer = random_keypair();
    let seller = random_keypair();
    let arbiter = random_keypair();
    let buyer_pk = buyer.x_only_public_key().0.serialize();
    let seller_pk = seller.x_only_public_key().0.serialize();
    let arbiter_pk = arbiter.x_only_public_key().0.serialize();
    let arbiter_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&arbiter_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout = 1_000_i64;
    let compiled = compile_contract_file(
        "contracts/core/escrow-bilateral.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.clone().into(),
            timeout.into(),
        ],
    );

    let input_value = 4_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&buyer_pk, input_value, 0, 0x21);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let seller_sig = schnorr_signature(&mutable, 0, &seller);
    let sigscript = compiled
        .build_sig_script(
            "release_to_seller",
            vec![
                arbiter_pk.to_vec().into(),
                arbiter_sig.into(),
                seller_pk.to_vec().into(),
                seller_sig.into(),
            ],
        )
        .expect("release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("payout to buyer should fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── MultiSig ───────────────────────────────────────────────────────────────

#[test]
fn multisig_spend_accepts_threshold_signatures() {
    let kp1 = random_keypair();
    let kp2 = random_keypair();
    let kp3 = random_keypair();
    let pk1 = kp1.x_only_public_key().0.serialize();
    let pk2 = kp2.x_only_public_key().0.serialize();
    let pk3 = kp3.x_only_public_key().0.serialize();
    let threshold = 2_i64;
    let compiled = compile_contract_file(
        "contracts/core/multisig.sil",
        vec![
            threshold.into(),
            pk1.to_vec().into(),
            pk2.to_vec().into(),
            pk3.to_vec().into(),
        ],
    );

    // No payout constraint on the spend entrypoint — give the tx a single
    // dummy output (the contract does not assert anything about its shape).
    let input_value = 2_000u64;
    let dummy_dest = random_keypair().x_only_public_key().0.serialize();
    let (tx, _payout) = build_terminal_payout_tx(&dummy_dest, input_value, 0, 0x30);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    // Sign with kp1 and kp2 (threshold = 2). For the third slot, supply the
    // third member's key alongside kp3's signature — the contract counts
    // approvals, so two valid + one valid still passes; we use a non-member
    // attacker key + a junk signature to exercise the "two valid + one
    // failing membership" path instead, since that is the more interesting
    // assertion.
    let non_member = random_keypair();
    let non_member_pk = non_member.x_only_public_key().0.serialize();
    let sig1 = schnorr_signature(&mutable, 0, &kp1);
    let sig2 = schnorr_signature(&mutable, 0, &kp2);
    let attacker_sig = schnorr_signature(&mutable, 0, &non_member);
    let sigscript = compiled
        .build_sig_script(
            "spend",
            vec![
                pk1.to_vec().into(),
                sig1.into(),
                pk2.to_vec().into(),
                sig2.into(),
                non_member_pk.to_vec().into(),
                attacker_sig.into(),
            ],
        )
        .expect("multisig spend sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "multisig 2-of-3 runtime failed: {}", result.unwrap_err());
}

#[test]
fn multisig_spend_rejects_below_threshold() {
    let kp1 = random_keypair();
    let kp2 = random_keypair();
    let kp3 = random_keypair();
    let pk1 = kp1.x_only_public_key().0.serialize();
    let pk2 = kp2.x_only_public_key().0.serialize();
    let pk3 = kp3.x_only_public_key().0.serialize();
    let threshold = 2_i64;
    let compiled = compile_contract_file(
        "contracts/core/multisig.sil",
        vec![
            threshold.into(),
            pk1.to_vec().into(),
            pk2.to_vec().into(),
            pk3.to_vec().into(),
        ],
    );

    let input_value = 2_000u64;
    let dummy_dest = random_keypair().x_only_public_key().0.serialize();
    let (tx, _payout) = build_terminal_payout_tx(&dummy_dest, input_value, 0, 0x31);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    // Only kp1 produces a valid signature; the other two are non-members.
    let non_member_a = random_keypair();
    let non_member_b = random_keypair();
    let nm_a_pk = non_member_a.x_only_public_key().0.serialize();
    let nm_b_pk = non_member_b.x_only_public_key().0.serialize();
    let sig1 = schnorr_signature(&mutable, 0, &kp1);
    let sig_a = schnorr_signature(&mutable, 0, &non_member_a);
    let sig_b = schnorr_signature(&mutable, 0, &non_member_b);
    let sigscript = compiled
        .build_sig_script(
            "spend",
            vec![
                pk1.to_vec().into(),
                sig1.into(),
                nm_a_pk.to_vec().into(),
                sig_a.into(),
                nm_b_pk.to_vec().into(),
                sig_b.into(),
            ],
        )
        .expect("multisig spend sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("1-of-3 must fail at threshold 2");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");

    // Silence unused-binding lint for kp3/pk3 (they only seed the config).
    let _ = (kp3, pk3);
}

// ─── TimeLock additional paths ──────────────────────────────────────────────

#[test]
fn timelock_claim_rejects_before_unlock_time() {
    // Same shape as the accepts-test, but the tx locktime sits below the
    // contract's unlock_time, so `require(tx.time >= unlock_time)` fails.
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let unlock_time = 50_i64;
    let compiled = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(true),
        ],
    );

    let input_value = 2_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&beneficiary_pk, input_value, 10, 0x40);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let beneficiary_sig = schnorr_signature(&mutable, 0, &beneficiary);
    let sigscript = compiled
        .build_sig_script("claim", vec![beneficiary_pk.to_vec().into(), beneficiary_sig.into()])
        .expect("claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("early claim must fail");
    assert!(
        matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse | TxScriptError::UnsatisfiedLockTime(_)),
        "unexpected error: {err:?}"
    );
}

#[test]
fn timelock_cancel_accepts_owner_when_soft_cancel_enabled() {
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let unlock_time = 5_i64;
    let compiled = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(true),
        ],
    );

    let input_value = 2_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&owner_pk, input_value, 0, 0x41);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = compiled
        .build_sig_script("cancel", vec![owner_pk.to_vec().into(), owner_sig.into()])
        .expect("cancel sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "timelock cancel runtime failed: {}", result.unwrap_err());
}

#[test]
fn timelock_cancel_rejects_when_soft_cancel_disabled() {
    // soft_cancel_enabled = false locks the owner out of the cancel branch.
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let unlock_time = 5_i64;
    let compiled = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(false),
        ],
    );

    let input_value = 2_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&owner_pk, input_value, 0, 0x42);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = compiled
        .build_sig_script("cancel", vec![owner_pk.to_vec().into(), owner_sig.into()])
        .expect("cancel sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("hard-timelock cancel must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── HTLC refund (timeout path) ─────────────────────────────────────────────

#[test]
fn htlc_refund_accepts_after_timeout() {
    let recipient = random_keypair();
    let refunder = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize();
    let refunder_pk = refunder.x_only_public_key().0.serialize();
    let secret_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(b"unused-for-refund-path")
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout = 100_i64;
    let compiled = compile_contract_file(
        "contracts/core/atomic-swap-htlc.sil",
        vec![
            recipient_pk.to_vec().into(),
            refunder_pk.to_vec().into(),
            secret_hash.into(),
            timeout.into(),
        ],
    );

    let input_value = 5_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&refunder_pk, input_value, timeout as u64, 0x50);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let refunder_sig = schnorr_signature(&mutable, 0, &refunder);
    let sigscript = compiled
        .build_sig_script("refund", vec![refunder_pk.to_vec().into(), refunder_sig.into()])
        .expect("htlc refund sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "htlc refund runtime failed: {}", result.unwrap_err());
}

#[test]
fn htlc_refund_rejects_before_timeout() {
    let recipient = random_keypair();
    let refunder = random_keypair();
    let recipient_pk = recipient.x_only_public_key().0.serialize();
    let refunder_pk = refunder.x_only_public_key().0.serialize();
    let secret_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(b"unused-for-refund-path")
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout = 100_i64;
    let compiled = compile_contract_file(
        "contracts/core/atomic-swap-htlc.sil",
        vec![
            recipient_pk.to_vec().into(),
            refunder_pk.to_vec().into(),
            secret_hash.into(),
            timeout.into(),
        ],
    );

    let input_value = 5_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&refunder_pk, input_value, 50, 0x51);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let refunder_sig = schnorr_signature(&mutable, 0, &refunder);
    let sigscript = compiled
        .build_sig_script("refund", vec![refunder_pk.to_vec().into(), refunder_sig.into()])
        .expect("htlc refund sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("early refund must fail");
    assert!(
        matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse | TxScriptError::UnsatisfiedLockTime(_)),
        "unexpected error: {err:?}"
    );
}

// ─── BilateralEscrow timeout reclaim ────────────────────────────────────────

#[test]
fn bilateral_timeout_reclaim_accepts_after_timeout() {
    let buyer = random_keypair();
    let seller = random_keypair();
    let arbiter = random_keypair();
    let buyer_pk = buyer.x_only_public_key().0.serialize();
    let seller_pk = seller.x_only_public_key().0.serialize();
    let arbiter_pk = arbiter.x_only_public_key().0.serialize();
    let arbiter_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&arbiter_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout = 200_i64;
    let compiled = compile_contract_file(
        "contracts/core/escrow-bilateral.sil",
        vec![
            buyer_pk.to_vec().into(),
            seller_pk.to_vec().into(),
            arbiter_hash.into(),
            timeout.into(),
        ],
    );

    let input_value = 4_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&buyer_pk, input_value, timeout as u64, 0x60);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let buyer_sig = schnorr_signature(&mutable, 0, &buyer);
    let sigscript = compiled
        .build_sig_script(
            "timeout_reclaim",
            vec![buyer_pk.to_vec().into(), buyer_sig.into()],
        )
        .expect("timeout_reclaim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "bilateral timeout_reclaim runtime failed: {}", result.unwrap_err());

    // Use seller_pk to silence unused-binding lint — it's only here to seed
    // the contract config alongside buyer/arbiter.
    let _ = seller_pk;
}

// ─── Vault.release — the composition pattern ────────────────────────────────
//
// This single test exercises every primitive the Vault chain depends on:
//   - tx.time >= unlock_time      (TimeLock fragment)
//   - N-of-M signer quorum        (MultiSig fragment)
//   - beneficiary signature       (Ownable-style key-binding)
//   - requireExactPayout          (terminal payout shape)
// If this passes end-to-end, every fragment-level invariant the compiler
// emits is being satisfied by the engine.

#[test]
fn vault_release_accepts_quorum_and_beneficiary_after_unlock() {
    let owner = random_keypair();
    let kp1 = random_keypair();
    let kp2 = random_keypair();
    let kp3 = random_keypair();
    let beneficiary = random_keypair();

    let owner_pk = owner.x_only_public_key().0.serialize();
    let pk1 = kp1.x_only_public_key().0.serialize();
    let pk2 = kp2.x_only_public_key().0.serialize();
    let pk3 = kp3.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();

    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let pending_owner_zero = vec![0u8; 32];
    let threshold = 2_i64;
    let unlock_time = 10_i64;

    let compiled = compile_contract_file(
        "contracts/core/vault.sil",
        vec![
            owner_hash.into(),
            pending_owner_zero.into(),
            threshold.into(),
            pk1.to_vec().into(),
            pk2.to_vec().into(),
            pk3.to_vec().into(),
            unlock_time.into(),
            beneficiary_pk.to_vec().into(),
        ],
    );

    let input_value = 10_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&beneficiary_pk, input_value, unlock_time as u64, 0x70);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    // Threshold = 2: kp1 + kp2 are valid members. Pad the third slot with a
    // non-member + their own valid sig; the contract's approvalCount only
    // counts member-checked signatures, so 2 members > threshold suffices
    // and the non-member contributes nothing.
    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize();
    let sig1 = schnorr_signature(&mutable, 0, &kp1);
    let sig2 = schnorr_signature(&mutable, 0, &kp2);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);
    let beneficiary_sig = schnorr_signature(&mutable, 0, &beneficiary);

    let sigscript = compiled
        .build_sig_script(
            "release",
            vec![
                pk1.to_vec().into(),
                sig1.into(),
                pk2.to_vec().into(),
                sig2.into(),
                attacker_pk.to_vec().into(),
                attacker_sig.into(),
                beneficiary_pk.to_vec().into(),
                beneficiary_sig.into(),
            ],
        )
        .expect("vault release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "vault release runtime failed: {}", result.unwrap_err());

    // owner_pk + pk3 only seed the contract config; silence unused-binding.
    let _ = (owner_pk, pk3);
}

#[test]
fn vault_release_rejects_when_beneficiary_signature_swapped() {
    // Same happy path, but the beneficiary slot is filled with an
    // attacker key + signature. The contract pins beneficiary_pk to the
    // committed state field, so this must fail.
    let owner = random_keypair();
    let kp1 = random_keypair();
    let kp2 = random_keypair();
    let kp3 = random_keypair();
    let beneficiary = random_keypair();
    let attacker = random_keypair();

    let owner_pk = owner.x_only_public_key().0.serialize();
    let pk1 = kp1.x_only_public_key().0.serialize();
    let pk2 = kp2.x_only_public_key().0.serialize();
    let pk3 = kp3.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let attacker_pk = attacker.x_only_public_key().0.serialize();

    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let pending_owner_zero = vec![0u8; 32];
    let threshold = 2_i64;
    let unlock_time = 10_i64;

    let compiled = compile_contract_file(
        "contracts/core/vault.sil",
        vec![
            owner_hash.into(),
            pending_owner_zero.into(),
            threshold.into(),
            pk1.to_vec().into(),
            pk2.to_vec().into(),
            pk3.to_vec().into(),
            unlock_time.into(),
            beneficiary_pk.to_vec().into(),
        ],
    );

    let input_value = 10_000u64;
    // Note: the payout is still routed to the *real* beneficiary; the only
    // change vs the accepts-test is the beneficiary credentials submitted.
    let (tx, _payout) = build_terminal_payout_tx(&beneficiary_pk, input_value, unlock_time as u64, 0x71);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let extra = random_keypair();
    let extra_pk = extra.x_only_public_key().0.serialize();
    let sig1 = schnorr_signature(&mutable, 0, &kp1);
    let sig2 = schnorr_signature(&mutable, 0, &kp2);
    let extra_sig = schnorr_signature(&mutable, 0, &extra);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);

    let sigscript = compiled
        .build_sig_script(
            "release",
            vec![
                pk1.to_vec().into(),
                sig1.into(),
                pk2.to_vec().into(),
                sig2.into(),
                extra_pk.to_vec().into(),
                extra_sig.into(),
                attacker_pk.to_vec().into(),
                attacker_sig.into(),
            ],
        )
        .expect("vault release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("swapped beneficiary must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");

    let _ = (owner_pk, pk3, beneficiary);
}

// ─── FreelancePayroll ───────────────────────────────────────────────────────
//
// Four entrypoints, all with the same `requireExactPayout` shape as
// BilateralEscrow. We sample one positive per branch (worker via mutual
// release, client via arbiter refund, worker via arbiter payout, client via
// timeout reclaim) plus two negatives that pin the destination invariant.

fn freelance_keys() -> (Keypair, Keypair, Keypair, Vec<u8>, Vec<u8>, Vec<u8>, Vec<u8>) {
    let client = random_keypair();
    let worker = random_keypair();
    let arbiter = random_keypair();
    let client_pk = client.x_only_public_key().0.serialize().to_vec();
    let worker_pk = worker.x_only_public_key().0.serialize().to_vec();
    let arbiter_pk = arbiter.x_only_public_key().0.serialize().to_vec();
    let arbiter_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&arbiter_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    (client, worker, arbiter, client_pk, worker_pk, arbiter_pk, arbiter_hash)
}

fn compile_freelance(client_pk: &[u8], worker_pk: &[u8], arbiter_hash: &[u8], timeout: i64) -> CompiledContract<'static> {
    compile_contract_file(
        "contracts/core/freelance-payroll.sil",
        vec![
            client_pk.to_vec().into(),
            worker_pk.to_vec().into(),
            arbiter_hash.to_vec().into(),
            timeout.into(),
        ],
    )
}

#[test]
fn freelance_standard_release_pays_worker_on_mutual_sign() {
    let (client, worker, _arbiter, client_pk, worker_pk, _arbiter_pk, arbiter_hash) = freelance_keys();
    let compiled = compile_freelance(&client_pk, &worker_pk, &arbiter_hash, 1_000);

    let input_value = 6_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&worker_pk, input_value, 0, 0x80);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let client_sig = schnorr_signature(&mutable, 0, &client);
    let worker_sig = schnorr_signature(&mutable, 0, &worker);
    let sigscript = compiled
        .build_sig_script(
            "standard_release",
            vec![
                client_pk.clone().into(),
                client_sig.into(),
                worker_pk.clone().into(),
                worker_sig.into(),
            ],
        )
        .expect("standard_release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "freelance standard_release runtime failed: {}", result.unwrap_err());
}

#[test]
fn freelance_arbiter_refund_pays_client() {
    let (client, _worker, arbiter, client_pk, worker_pk, arbiter_pk, arbiter_hash) = freelance_keys();
    let compiled = compile_freelance(&client_pk, &worker_pk, &arbiter_hash, 1_000);

    let input_value = 6_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&client_pk, input_value, 0, 0x81);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let client_sig = schnorr_signature(&mutable, 0, &client);
    let sigscript = compiled
        .build_sig_script(
            "arbiter_refund",
            vec![
                arbiter_pk.into(),
                arbiter_sig.into(),
                client_pk.into(),
                client_sig.into(),
            ],
        )
        .expect("arbiter_refund sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "freelance arbiter_refund runtime failed: {}", result.unwrap_err());
}

#[test]
fn freelance_arbiter_payout_pays_worker() {
    let (_client, worker, arbiter, client_pk, worker_pk, arbiter_pk, arbiter_hash) = freelance_keys();
    let compiled = compile_freelance(&client_pk, &worker_pk, &arbiter_hash, 1_000);

    let input_value = 6_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&worker_pk, input_value, 0, 0x82);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let worker_sig = schnorr_signature(&mutable, 0, &worker);
    let sigscript = compiled
        .build_sig_script(
            "arbiter_payout",
            vec![
                arbiter_pk.into(),
                arbiter_sig.into(),
                worker_pk.into(),
                worker_sig.into(),
            ],
        )
        .expect("arbiter_payout sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "freelance arbiter_payout runtime failed: {}", result.unwrap_err());
}

#[test]
fn freelance_timeout_reclaim_pays_client_after_timeout() {
    let (client, _worker, _arbiter, client_pk, worker_pk, _arbiter_pk, arbiter_hash) = freelance_keys();
    let timeout = 500_i64;
    let compiled = compile_freelance(&client_pk, &worker_pk, &arbiter_hash, timeout);

    let input_value = 6_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&client_pk, input_value, timeout as u64, 0x83);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let client_sig = schnorr_signature(&mutable, 0, &client);
    let sigscript = compiled
        .build_sig_script(
            "timeout_reclaim",
            vec![client_pk.into(), client_sig.into()],
        )
        .expect("timeout_reclaim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "freelance timeout_reclaim runtime failed: {}", result.unwrap_err());
}

#[test]
fn freelance_standard_release_rejects_payout_to_client() {
    // Mutual release sigs are good, but the contract pins the destination to
    // the worker. Routing the output to the client must fail.
    let (client, worker, _arbiter, client_pk, worker_pk, _arbiter_pk, arbiter_hash) = freelance_keys();
    let compiled = compile_freelance(&client_pk, &worker_pk, &arbiter_hash, 1_000);

    let input_value = 6_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&client_pk, input_value, 0, 0x84);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let client_sig = schnorr_signature(&mutable, 0, &client);
    let worker_sig = schnorr_signature(&mutable, 0, &worker);
    let sigscript = compiled
        .build_sig_script(
            "standard_release",
            vec![
                client_pk.into(),
                client_sig.into(),
                worker_pk.into(),
                worker_sig.into(),
            ],
        )
        .expect("standard_release sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("misrouted payout must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

#[test]
fn freelance_arbiter_refund_rejects_with_only_arbiter_sig() {
    // Arbiter signs correctly; the client slot is filled with an attacker key
    // and signature. The require(client_pk == prev_state.client) gate
    // catches it.
    let (_client, _worker, arbiter, client_pk, worker_pk, arbiter_pk, arbiter_hash) = freelance_keys();
    let compiled = compile_freelance(&client_pk, &worker_pk, &arbiter_hash, 1_000);

    let input_value = 6_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&client_pk, input_value, 0, 0x85);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize().to_vec();
    let arbiter_sig = schnorr_signature(&mutable, 0, &arbiter);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);
    let sigscript = compiled
        .build_sig_script(
            "arbiter_refund",
            vec![
                arbiter_pk.into(),
                arbiter_sig.into(),
                attacker_pk.into(),
                attacker_sig.into(),
            ],
        )
        .expect("arbiter_refund sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("attacker-as-client must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── Streaming + Vesting — restored after single-return refactor (2026-05-23)
//
// Earlier in this session the .sil sources for streaming-payment and
// vesting were rejected by the full silverscript compile path with
// `Unsupported("return statement must be the last statement")`. The
// `withdraw`/`claim` policies were trying to *compute* the next state
// inside the function via `return([...]) ... return([])` shapes, which
// triggers `static_check.rs`'s rule that all returns must collapse to a
// single trailing return with no nested returns.
//
// The fix that landed earlier this commit refactors both policies to the
// supported `termination = allowed` shape from the upstream AST fixture
// `lowers_singleton_sugar_transition_termination_allowed_two_field_state`:
// the policy takes `next_states` from the caller, pins every field via
// `require(...)` constraints, and `return(next_states)` once at the end.
// The compiler-generated wrapper enforces `auth_out_count ==
// new_states.length` and `validateOutputState` per output, so no caller
// can substitute a forged continuation state.

#[test]
fn streaming_cancel_accepts_sender_signature() {
    let sender = random_keypair();
    let recipient = random_keypair();
    let sender_pk = sender.x_only_public_key().0.serialize().to_vec();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_contract_file(
        "contracts/core/streaming-payment.sil",
        vec![
            sender_pk.clone().into(),
            recipient_pk.into(),
            500_i64.into(),       // rate_per_claim
            5_000_i64.into(),     // total_allowance
            3_000_i64.into(),     // remaining_allowance
            10_i64.into(),        // period
            0_i64.into(),         // next_release_time
        ],
    );

    let input_value = 4_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&sender_pk, input_value, 0, 0x90);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let sender_sig = schnorr_signature(&mutable, 0, &sender);
    let sigscript = compiled
        .build_sig_script("cancel", vec![sender_pk.into(), sender_sig.into()])
        .expect("streaming cancel sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "streaming cancel runtime failed: {}", result.unwrap_err());
}

#[test]
fn streaming_cancel_rejects_recipient_signature() {
    // Recipient cannot cancel — only sender can.
    let sender = random_keypair();
    let recipient = random_keypair();
    let sender_pk = sender.x_only_public_key().0.serialize().to_vec();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_contract_file(
        "contracts/core/streaming-payment.sil",
        vec![
            sender_pk.clone().into(),
            recipient_pk.clone().into(),
            500_i64.into(),
            5_000_i64.into(),
            3_000_i64.into(),
            10_i64.into(),
            0_i64.into(),
        ],
    );

    let input_value = 4_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&recipient_pk, input_value, 0, 0x91);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let recipient_sig = schnorr_signature(&mutable, 0, &recipient);
    let sigscript = compiled
        .build_sig_script("cancel", vec![recipient_pk.into(), recipient_sig.into()])
        .expect("streaming cancel sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("recipient cancel must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");

    let _ = sender_pk;
}

// ─── Vesting.revoke ─────────────────────────────────────────────────────────

#[test]
fn vesting_revoke_accepts_admin_when_revocable() {
    let beneficiary = random_keypair();
    let admin = random_keypair();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize().to_vec();
    let admin_pk = admin.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_contract_file(
        "contracts/core/vesting.sil",
        vec![
            beneficiary_pk.into(),
            admin_pk.clone().into(),
            10_000_i64.into(),  // total_allocation
            2_000_i64.into(),   // claimed_amount
            100_i64.into(),     // cliff_time
            50_i64.into(),      // period
            1_000_i64.into(),   // release_per_period
            Expr::bool(true),   // revocable
        ],
    );

    let input_value = 8_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&admin_pk, input_value, 0, 0xA0);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let admin_sig = schnorr_signature(&mutable, 0, &admin);
    let sigscript = compiled
        .build_sig_script("revoke", vec![admin_pk.into(), admin_sig.into()])
        .expect("vesting revoke sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "vesting revoke runtime failed: {}", result.unwrap_err());
}

#[test]
fn vesting_revoke_rejects_when_not_revocable() {
    let beneficiary = random_keypair();
    let admin = random_keypair();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize().to_vec();
    let admin_pk = admin.x_only_public_key().0.serialize().to_vec();
    let compiled = compile_contract_file(
        "contracts/core/vesting.sil",
        vec![
            beneficiary_pk.into(),
            admin_pk.clone().into(),
            10_000_i64.into(),
            2_000_i64.into(),
            100_i64.into(),
            50_i64.into(),
            1_000_i64.into(),
            Expr::bool(false),
        ],
    );

    let input_value = 8_000u64;
    let (tx, _payout) = build_terminal_payout_tx(&admin_pk, input_value, 0, 0xA1);
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let admin_sig = schnorr_signature(&mutable, 0, &admin);
    let sigscript = compiled
        .build_sig_script("revoke", vec![admin_pk.into(), admin_sig.into()])
        .expect("vesting revoke sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("non-revocable vesting must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── Ownable (singleton state transitions) ──────────────────────────────────
//
// Ownable has three singleton-transition entrypoints: propose_transfer,
// accept_transfer, cancel_transfer. Each requires a covenant context (the
// input carries a cov_id, the output carries the matching CovenantBinding)
// and produces a continuation output whose P2SH wraps the recompiled
// contract with the new state.

fn ownable_cov_id(marker: u8) -> Hash {
    let mut bytes = [0u8; 32];
    bytes[0] = marker;
    bytes[1..16].copy_from_slice(b"OWNABLE_COV_ID0");
    Hash::from_bytes(bytes)
}

// ── Ownable + SocialRecovery — restored after pubkey refactor (2026-05-23)
//
// Earlier in the session these singleton-transition tests were all
// blocked by the engine's NUM2BIN-on-byte[32]-state-writes cap. The
// patterns originally stored `byte[32] owner` and `byte[32] pending_owner`
// (blake2b(pubkey) hashes); the compiler's lowering for "write a new
// byte[32] value into a state slot" routed through NUM2BIN, which only
// supports targets up to 8 bytes.
//
// Resolution: refactored both .sil contracts to use `pubkey owner` and
// `pubkey pending_owner` directly, with `pubkey(0)` as the empty
// sentinel. Trade-off (pubkey exposed at deploy time vs hash-committed)
// captured in the contract comments + each pattern's "WHEN NOT TO USE
// THIS" doc. Vault.reconfigure_signers already proved pubkey-runtime-args
// pass the engine cleanly.

#[test]
fn ownable_propose_transfer_accepts_owner_sig() {
    let owner = random_keypair();
    let next_owner = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize().to_vec();
    let next_owner_pk = next_owner.x_only_public_key().0.serialize().to_vec();

    // Active: has_pending=false, pending_owner slot reuses owner_pk as
    // an arbitrary 32-byte placeholder. Next: has_pending=true, pending=
    // next_owner_pk.
    let active = compile_contract_file(
        "contracts/core/ownable.sil",
        vec![owner_pk.clone().into(), Expr::bool(false), owner_pk.clone().into()],
    );
    let next = compile_contract_file(
        "contracts/core/ownable.sil",
        vec![owner_pk.clone().into(), Expr::bool(true), next_owner_pk.clone().into()],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xB0);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
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
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = covenant_sigscript(
        &active,
        "propose_transfer",
        vec![next_owner_pk.into(), owner_pk.into(), owner_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "ownable propose_transfer runtime failed: {}", result.unwrap_err());
}

#[test]
fn ownable_propose_transfer_rejects_wrong_owner_sig() {
    // Attacker signs in place of the real owner. The
    // require(owner_pk == prev_state.owner) check kills it before sig
    // verification (and the attacker's own sig wouldn't have validated
    // against the committed owner pubkey anyway).
    let owner = random_keypair();
    let attacker = random_keypair();
    let next_owner = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize().to_vec();
    let attacker_pk = attacker.x_only_public_key().0.serialize().to_vec();
    let next_owner_pk = next_owner.x_only_public_key().0.serialize().to_vec();

    let active = compile_contract_file(
        "contracts/core/ownable.sil",
        vec![owner_pk.clone().into(), Expr::bool(false), owner_pk.clone().into()],
    );
    let next = compile_contract_file(
        "contracts/core/ownable.sil",
        vec![owner_pk.clone().into(), Expr::bool(true), next_owner_pk.clone().into()],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xB1);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
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
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);
    let sigscript = covenant_sigscript(
        &active,
        "propose_transfer",
        vec![next_owner_pk.into(), attacker_pk.into(), attacker_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_covenant_input(mutable.tx, utxo).expect_err("attacker propose must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

#[test]
fn ownable_accept_transfer_completes_handoff() {
    // active state has pending_owner set; pending owner produces a valid
    // continuation where pending_owner == 0 and owner == old pending_owner.
    let prev_owner = random_keypair();
    let new_owner = random_keypair();
    let prev_owner_pk = prev_owner.x_only_public_key().0.serialize().to_vec();
    let new_owner_pk = new_owner.x_only_public_key().0.serialize().to_vec();

    // Active: { owner = prev_pk, has_pending = true, pending = new_pk }
    let active = compile_contract_file(
        "contracts/core/ownable.sil",
        vec![prev_owner_pk.into(), Expr::bool(true), new_owner_pk.clone().into()],
    );
    // Next:   { owner = new_pk, has_pending = false, pending = new_pk
    //          (slot keeps prior value; the bool is source of truth) }
    let next = compile_contract_file(
        "contracts/core/ownable.sil",
        vec![new_owner_pk.clone().into(), Expr::bool(false), new_owner_pk.clone().into()],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xB2);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
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
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let new_owner_sig = schnorr_signature(&mutable, 0, &new_owner);
    let sigscript = covenant_sigscript(
        &active,
        "accept_transfer",
        vec![new_owner_pk.into(), new_owner_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "ownable accept_transfer runtime failed: {}", result.unwrap_err());
}

// ─── SocialRecovery.initiate_recovery ──────────────────────────────────────
//
// Two-of-three guardian threshold initiates the handoff. The continuation
// flips pending_owner from 0 to the proposed owner-hash and shifts the
// activation_time forward.

#[test]
fn social_recovery_initiate_accepts_guardian_quorum() {
    let g1 = random_keypair();
    let g2 = random_keypair();
    let g3 = random_keypair();
    let g1_pk = g1.x_only_public_key().0.serialize().to_vec();
    let g2_pk = g2.x_only_public_key().0.serialize().to_vec();
    let g3_pk = g3.x_only_public_key().0.serialize().to_vec();
    let owner_pk = random_keypair().x_only_public_key().0.serialize().to_vec();
    let new_owner_pk = random_keypair().x_only_public_key().0.serialize().to_vec();
    let activation_time = 100_i64;
    let next_activation_time = 150_i64;

    let active = compile_contract_file(
        "contracts/core/social-recovery.sil",
        vec![
            owner_pk.clone().into(),
            Expr::bool(false),
            owner_pk.clone().into(), // pending slot placeholder
            2_i64.into(),
            g1_pk.clone().into(),
            g2_pk.clone().into(),
            g3_pk.clone().into(),
            activation_time.into(),
            50_i64.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/social-recovery.sil",
        vec![
            owner_pk.into(),
            Expr::bool(true),
            new_owner_pk.clone().into(),
            2_i64.into(),
            g1_pk.clone().into(),
            g2_pk.clone().into(),
            g3_pk.clone().into(),
            next_activation_time.into(),
            50_i64.into(),
        ],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xC0);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xC0; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    // Two valid guardian sigs (g1, g2) + a non-member padded third slot.
    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize().to_vec();
    let sig1 = schnorr_signature(&mutable, 0, &g1);
    let sig2 = schnorr_signature(&mutable, 0, &g2);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);
    let sigscript = covenant_sigscript(
        &active,
        "initiate_recovery",
        vec![
            new_owner_pk.into(),
            next_activation_time.into(),
            g1_pk.into(),
            sig1.into(),
            g2_pk.into(),
            sig2.into(),
            attacker_pk.into(),
            attacker_sig.into(),
        ],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "social initiate_recovery runtime failed: {}", result.unwrap_err());

    let _ = g3_pk;
}

// ─── TimeLock.extend_lock (int-arg singleton) ───────────────────────────────
//
// Singleton transitions with int args do work — NUM2BIN to ≤ 8 bytes
// covers int64. TimeLock's extend_lock takes a single int (next_unlock_time)
// plus owner credentials, and writes a new redeem script that only differs
// in that field.

#[test]
fn timelock_extend_lock_accepts_owner_with_later_unlock() {
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let unlock_time = 100_i64;
    let later_unlock = 200_i64;

    let active = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(true),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            later_unlock.into(),
            Expr::bool(true),
        ],
    );

    let input_value = 5_000u64;
    let cov_id = ownable_cov_id(0xD0);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
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
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = covenant_sigscript(
        &active,
        "extend_lock",
        vec![later_unlock.into(), owner_pk.to_vec().into(), owner_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "timelock extend_lock runtime failed: {}", result.unwrap_err());
}

#[test]
fn timelock_extend_lock_rejects_earlier_unlock() {
    // The compiled `next` redeem script uses an earlier unlock_time than
    // the active one, but the contract requires next_unlock_time >=
    // prev_state.unlock_time. The require fails.
    let owner = random_keypair();
    let beneficiary = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let unlock_time = 200_i64;
    let earlier_unlock = 100_i64;

    let active = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            unlock_time.into(),
            Expr::bool(true),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/timelock.sil",
        vec![
            owner_pk.to_vec().into(),
            beneficiary_pk.to_vec().into(),
            earlier_unlock.into(),
            Expr::bool(true),
        ],
    );

    let input_value = 5_000u64;
    let cov_id = ownable_cov_id(0xD1);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
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
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = covenant_sigscript(
        &active,
        "extend_lock",
        vec![earlier_unlock.into(), owner_pk.to_vec().into(), owner_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_covenant_input(mutable.tx, utxo).expect_err("earlier unlock must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── Vault.extend_lock (int-arg singleton with quorum gate) ────────────────
//
// Vault.extend_lock takes (next_unlock_time: int, 3× (signer_pk, sig)) and
// requires threshold-of-three plus requireExactContinuationValue. Exercises
// the int-arg singleton path on a contract that bundles state with a
// multisig fragment.

#[test]
fn vault_extend_lock_accepts_quorum_with_later_unlock() {
    let owner = random_keypair();
    let kp1 = random_keypair();
    let kp2 = random_keypair();
    let kp3 = random_keypair();
    let beneficiary = random_keypair();

    let owner_pk = owner.x_only_public_key().0.serialize();
    let pk1 = kp1.x_only_public_key().0.serialize();
    let pk2 = kp2.x_only_public_key().0.serialize();
    let pk3 = kp3.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();

    let unlock_time = 100_i64;
    let later_unlock = 250_i64;
    let threshold = 2_i64;

    let active_args: Vec<Expr<'static>> = vec![
        owner_hash.clone().into(),
        vec![0u8; 32].into(),
        threshold.into(),
        pk1.to_vec().into(),
        pk2.to_vec().into(),
        pk3.to_vec().into(),
        unlock_time.into(),
        beneficiary_pk.to_vec().into(),
    ];
    let next_args: Vec<Expr<'static>> = vec![
        owner_hash.into(),
        vec![0u8; 32].into(),
        threshold.into(),
        pk1.to_vec().into(),
        pk2.to_vec().into(),
        pk3.to_vec().into(),
        later_unlock.into(),
        beneficiary_pk.to_vec().into(),
    ];
    let active = compile_contract_file("contracts/core/vault.sil", active_args);
    let next = compile_contract_file("contracts/core/vault.sil", next_args);

    let input_value = 10_000u64;
    let cov_id = ownable_cov_id(0xE0);
    // extend_lock uses requireExactContinuationValue: input_value - 1000.
    let continuation_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: continuation_value,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xE0; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize();
    let sig1 = schnorr_signature(&mutable, 0, &kp1);
    let sig2 = schnorr_signature(&mutable, 0, &kp2);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);
    let sigscript = covenant_sigscript(
        &active,
        "extend_lock",
        vec![
            later_unlock.into(),
            pk1.to_vec().into(),
            sig1.into(),
            pk2.to_vec().into(),
            sig2.into(),
            attacker_pk.to_vec().into(),
            attacker_sig.into(),
        ],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "vault extend_lock runtime failed: {}", result.unwrap_err());

    let _ = pk3;
}

// ─── DeadMansSwitch.ping (int-arg singleton) ────────────────────────────────
//
// Owner reports they're alive by writing a new last_ping_age into the
// covenant state. Sole runtime arg is the int next_last_ping_age plus owner
// credentials — no byte[32] runtime arg, so the NUM2BIN cap is avoided.

#[test]
fn dms_ping_accepts_owner_with_new_ping_age() {
    let owner = random_keypair();
    let fallback = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let fallback_pk = fallback.x_only_public_key().0.serialize();
    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let fallback_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&fallback_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout_age = 100_i64;
    let prev_ping = 10_i64;
    let next_ping = 42_i64;

    let active = compile_contract_file(
        "contracts/core/dead-man-switch.sil",
        vec![
            owner_hash.clone().into(),
            fallback_hash.clone().into(),
            timeout_age.into(),
            prev_ping.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/dead-man-switch.sil",
        vec![
            owner_hash.into(),
            fallback_hash.into(),
            timeout_age.into(),
            next_ping.into(),
        ],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xF0);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xF0; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = covenant_sigscript(
        &active,
        "ping",
        vec![next_ping.into(), owner_pk.to_vec().into(), owner_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "dms ping runtime failed: {}", result.unwrap_err());
}

#[test]
fn dms_ping_rejects_fallback_signature() {
    // Only the owner can ping. Fallback's signature must fail the
    // require(blake2b(owner_pk) == owner) check.
    let owner = random_keypair();
    let fallback = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let fallback_pk = fallback.x_only_public_key().0.serialize();
    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let fallback_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&fallback_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout_age = 100_i64;
    let prev_ping = 10_i64;
    let next_ping = 42_i64;

    let active = compile_contract_file(
        "contracts/core/dead-man-switch.sil",
        vec![
            owner_hash.clone().into(),
            fallback_hash.clone().into(),
            timeout_age.into(),
            prev_ping.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/dead-man-switch.sil",
        vec![
            owner_hash.into(),
            fallback_hash.into(),
            timeout_age.into(),
            next_ping.into(),
        ],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xF1);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xF1; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let fallback_sig = schnorr_signature(&mutable, 0, &fallback);
    let sigscript = covenant_sigscript(
        &active,
        "ping",
        vec![next_ping.into(), fallback_pk.to_vec().into(), fallback_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_covenant_input(mutable.tx, utxo).expect_err("fallback ping must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── SocialRecovery.cancel_recovery (owner-only singleton) ─────────────────
//
// Owner cancels a pending recovery proposal, flipping pending_owner back
// to zero. Pure sig + state-comparison singleton; no runtime byte[32] arg.

#[test]
fn social_recovery_cancel_accepts_owner_signature() {
    let g1 = random_keypair();
    let g2 = random_keypair();
    let g3 = random_keypair();
    let owner = random_keypair();
    let pending = random_keypair();
    let g1_pk = g1.x_only_public_key().0.serialize().to_vec();
    let g2_pk = g2.x_only_public_key().0.serialize().to_vec();
    let g3_pk = g3.x_only_public_key().0.serialize().to_vec();
    let owner_pk = owner.x_only_public_key().0.serialize().to_vec();
    let pending_pk = pending.x_only_public_key().0.serialize().to_vec();

    // Active: has_pending=true with pending_pk; Next: has_pending=false,
    // pending slot keeps its prior value (bool is the source of truth).
    let active = compile_contract_file(
        "contracts/core/social-recovery.sil",
        vec![
            owner_pk.clone().into(),
            Expr::bool(true),
            pending_pk.clone().into(),
            2_i64.into(),
            g1_pk.clone().into(),
            g2_pk.clone().into(),
            g3_pk.clone().into(),
            150_i64.into(),
            50_i64.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/social-recovery.sil",
        vec![
            owner_pk.clone().into(),
            Expr::bool(false),
            pending_pk.into(),
            2_i64.into(),
            g1_pk.into(),
            g2_pk.into(),
            g3_pk.into(),
            150_i64.into(),
            50_i64.into(),
        ],
    );

    let input_value = 3_000u64;
    let cov_id = ownable_cov_id(0xC1);
    let output0 = TransactionOutput {
        value: input_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xC1; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sigscript = covenant_sigscript(
        &active,
        "cancel_recovery",
        vec![owner_pk.into(), owner_sig.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "social cancel_recovery runtime failed: {}", result.unwrap_err());
}

// ─── Vault.reconfigure_signers (int + pubkey args singleton) ────────────────
//
// Vault.reconfigure_signers takes (next_threshold: int, next_pk1/pk2/pk3:
// pubkey, owner credentials, 3x current-signer credentials). Mixes int and
// 32-byte pubkey runtime args. Confirms pubkey runtime args work where
// byte[32] (hash) args break — distinct because pubkey type has its own
// push encoding distinct from byte[32].

#[test]
fn vault_reconfigure_signers_accepts_owner_and_quorum() {
    let owner = random_keypair();
    let kp1 = random_keypair();
    let kp2 = random_keypair();
    let kp3 = random_keypair();
    let new_kp1 = random_keypair();
    let new_kp2 = random_keypair();
    let new_kp3 = random_keypair();
    let beneficiary = random_keypair();

    let owner_pk = owner.x_only_public_key().0.serialize();
    let pk1 = kp1.x_only_public_key().0.serialize();
    let pk2 = kp2.x_only_public_key().0.serialize();
    let pk3 = kp3.x_only_public_key().0.serialize();
    let new_pk1 = new_kp1.x_only_public_key().0.serialize();
    let new_pk2 = new_kp2.x_only_public_key().0.serialize();
    let new_pk3 = new_kp3.x_only_public_key().0.serialize();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize();
    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();

    let unlock_time = 100_i64;
    let active_threshold = 2_i64;
    let next_threshold = 3_i64;

    let active = compile_contract_file(
        "contracts/core/vault.sil",
        vec![
            owner_hash.clone().into(),
            vec![0u8; 32].into(),
            active_threshold.into(),
            pk1.to_vec().into(),
            pk2.to_vec().into(),
            pk3.to_vec().into(),
            unlock_time.into(),
            beneficiary_pk.to_vec().into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/vault.sil",
        vec![
            owner_hash.into(),
            vec![0u8; 32].into(),
            next_threshold.into(),
            new_pk1.to_vec().into(),
            new_pk2.to_vec().into(),
            new_pk3.to_vec().into(),
            unlock_time.into(),
            beneficiary_pk.to_vec().into(),
        ],
    );

    let input_value = 10_000u64;
    let cov_id = ownable_cov_id(0xE1);
    let continuation_value = input_value - 1_000;
    let output0 = TransactionOutput {
        value: continuation_value,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0xE1; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![output0], 0, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let attacker = random_keypair();
    let attacker_pk = attacker.x_only_public_key().0.serialize();
    let owner_sig = schnorr_signature(&mutable, 0, &owner);
    let sig1 = schnorr_signature(&mutable, 0, &kp1);
    let sig2 = schnorr_signature(&mutable, 0, &kp2);
    let attacker_sig = schnorr_signature(&mutable, 0, &attacker);

    let sigscript = covenant_sigscript(
        &active,
        "reconfigure_signers",
        vec![
            next_threshold.into(),
            new_pk1.to_vec().into(),
            new_pk2.to_vec().into(),
            new_pk3.to_vec().into(),
            owner_pk.to_vec().into(),
            owner_sig.into(),
            pk1.to_vec().into(),
            sig1.into(),
            pk2.to_vec().into(),
            sig2.into(),
            attacker_pk.to_vec().into(),
            attacker_sig.into(),
        ],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "vault reconfigure_signers runtime failed: {}", result.unwrap_err());

    let _ = pk3;
}

// ─── DeadMansSwitch.claim ───────────────────────────────────────────────────
//
// Resolved gap from the earlier session: `this.age` in SilverScript lowers
// to OpCheckSequenceVerify (Kaspa's CSV), which reads `input.sequence`
// directly — not a current-DAA-score context. So we satisfy `this.age >=
// timeout_age` by setting the spending input's sequence to >= timeout_age
// (and keeping the SEQUENCE_LOCK_TIME_DISABLED high bit unset).

#[test]
fn dms_claim_accepts_fallback_after_timeout_age() {
    let owner = random_keypair();
    let fallback = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let fallback_pk = fallback.x_only_public_key().0.serialize();
    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let fallback_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&fallback_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout_age = 100_i64;
    let compiled = compile_contract_file(
        "contracts/core/dead-man-switch.sil",
        vec![
            owner_hash.into(),
            fallback_hash.into(),
            timeout_age.into(),
            10_i64.into(),
        ],
    );

    let input_value = 3_000u64;
    let dummy_dest = random_keypair().x_only_public_key().0.serialize();
    let (mut tx, _payout) = build_terminal_payout_tx(&dummy_dest, input_value, 0, 0xF2);
    // Set the input's sequence to the timeout_age so OpCheckSequenceVerify
    // sees a satisfied relative-time lock. Low value, no disabled-bit risk.
    tx.inputs[0].sequence = timeout_age as u64;
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let fallback_sig = schnorr_signature(&mutable, 0, &fallback);
    let sigscript = compiled
        .build_sig_script("claim", vec![fallback_pk.to_vec().into(), fallback_sig.into()])
        .expect("dms claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_plain_input(mutable.tx, utxo);
    assert!(result.is_ok(), "dms claim runtime failed: {}", result.unwrap_err());
}

#[test]
fn dms_claim_rejects_before_timeout_age() {
    // Sequence sits below timeout_age — CSV rejects with UnsatisfiedLockTime.
    let owner = random_keypair();
    let fallback = random_keypair();
    let owner_pk = owner.x_only_public_key().0.serialize();
    let fallback_pk = fallback.x_only_public_key().0.serialize();
    let owner_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&owner_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let fallback_hash = blake2b_simd::Params::new()
        .hash_length(32)
        .to_state()
        .update(&fallback_pk)
        .finalize()
        .as_bytes()
        .to_vec();
    let timeout_age = 100_i64;
    let compiled = compile_contract_file(
        "contracts/core/dead-man-switch.sil",
        vec![
            owner_hash.into(),
            fallback_hash.into(),
            timeout_age.into(),
            10_i64.into(),
        ],
    );

    let input_value = 3_000u64;
    let dummy_dest = random_keypair().x_only_public_key().0.serialize();
    let (mut tx, _payout) = build_terminal_payout_tx(&dummy_dest, input_value, 0, 0xF3);
    tx.inputs[0].sequence = 50; // below timeout_age
    let utxo = UtxoEntry::new(input_value, ScriptPublicKey::new(0, compiled.script.clone().into()), 0, false, None);
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let fallback_sig = schnorr_signature(&mutable, 0, &fallback);
    let sigscript = compiled
        .build_sig_script("claim", vec![fallback_pk.to_vec().into(), fallback_sig.into()])
        .expect("dms claim sigscript builds");
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_plain_input(mutable.tx, utxo).expect_err("early dms claim must fail");
    assert!(
        matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse | TxScriptError::UnsatisfiedLockTime(_)),
        "unexpected error: {err:?}"
    );
}

// ─── Streaming.withdraw (singleton transition with termination_allowed) ────
//
// The policy is `#[covenant.singleton(mode = transition, termination = allowed)]`,
// so the compiler emits a wrapper that:
//   - takes State[] next_states as the sole runtime arg,
//   - requires auth_out_count == next_states.length,
//   - validateOutputState's each auth-bound output against next_states[i].
//
// The contract's require()'d constraints pin every field of the
// continuation so the caller cannot forge it. Two shapes:
//   - partial draw: next_states.length == 1, output 0 = payout to recipient
//     at rate_per_claim, output 1 = P2SH continuation with cov binding.
//   - terminal draw: next_states.length == 0, output 0 = payout to recipient
//     at remaining_allowance, no continuation.

fn streaming_state(
    sender: &[u8],
    recipient: &[u8],
    rate: i64,
    total: i64,
    remaining: i64,
    period: i64,
    next_release_time: i64,
) -> Expr<'static> {
    struct_object(vec![
        ("sender", sender.to_vec().into()),
        ("recipient", recipient.to_vec().into()),
        ("rate_per_claim", rate.into()),
        ("total_allowance", total.into()),
        ("remaining_allowance", remaining.into()),
        ("period", period.into()),
        ("next_release_time", next_release_time.into()),
    ])
}

#[test]
fn streaming_withdraw_accepts_partial_draw_with_continuation() {
    let sender = random_keypair();
    let recipient = random_keypair();
    let sender_pk = sender.x_only_public_key().0.serialize().to_vec();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();

    let rate = 500_i64;
    let total = 5_000_i64;
    let remaining_before = 3_000_i64; // > rate, so partial-draw branch
    let remaining_after = remaining_before - rate;
    let period = 10_i64;
    let next_release_before = 100_i64;
    let next_release_after = next_release_before + period;

    let active_args: Vec<Expr<'static>> = vec![
        sender_pk.clone().into(),
        recipient_pk.clone().into(),
        rate.into(),
        total.into(),
        remaining_before.into(),
        period.into(),
        next_release_before.into(),
    ];
    let next_args: Vec<Expr<'static>> = vec![
        sender_pk.clone().into(),
        recipient_pk.clone().into(),
        rate.into(),
        total.into(),
        remaining_after.into(),
        period.into(),
        next_release_after.into(),
    ];
    let active = compile_contract_file("contracts/core/streaming-payment.sil", active_args);
    let next = compile_contract_file("contracts/core/streaming-payment.sil", next_args);

    // Output 0: payout to recipient = rate_per_claim sompi
    // Output 1: continuation P2SH(next.script) with CovenantBinding
    let input_value = 6_000u64;
    let payout_value = rate as u64;
    let cov_id = ownable_cov_id(0x10);
    let payout = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let continuation = TransactionOutput {
        value: input_value - payout_value - 1_000, // residual minus a token fee
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0x10; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    // tx.time >= next_release_before
    let tx = Transaction::new(1, vec![input], vec![payout, continuation], next_release_before as u64, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let recipient_sig = schnorr_signature(&mutable, 0, &recipient);
    let next_state = streaming_state(
        &sender_pk,
        &recipient_pk,
        rate,
        total,
        remaining_after,
        period,
        next_release_after,
    );
    let next_states_arg: Expr<'static> = vec![next_state].into();
    let sigscript = covenant_sigscript(
        &active,
        "withdraw",
        vec![recipient_pk.clone().into(), recipient_sig.into(), next_states_arg],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "streaming withdraw partial-draw runtime failed: {}", result.unwrap_err());
}

#[test]
fn streaming_withdraw_accepts_terminal_draw_no_continuation() {
    let sender = random_keypair();
    let recipient = random_keypair();
    let sender_pk = sender.x_only_public_key().0.serialize().to_vec();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();

    let rate = 500_i64;
    let total = 5_000_i64;
    let remaining = 300_i64; // <= rate, so terminal-draw branch
    let period = 10_i64;
    let next_release = 100_i64;

    let active = compile_contract_file(
        "contracts/core/streaming-payment.sil",
        vec![
            sender_pk.clone().into(),
            recipient_pk.clone().into(),
            rate.into(),
            total.into(),
            remaining.into(),
            period.into(),
            next_release.into(),
        ],
    );

    let input_value = 1_000u64;
    let payout_value = remaining as u64;
    let cov_id = ownable_cov_id(0x11);
    let payout = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0x11; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![payout], next_release as u64, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let recipient_sig = schnorr_signature(&mutable, 0, &recipient);
    let empty_states: Vec<Expr<'static>> = vec![];
    let sigscript = covenant_sigscript(
        &active,
        "withdraw",
        vec![recipient_pk.clone().into(), recipient_sig.into(), empty_states.into()],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "streaming withdraw terminal-draw runtime failed: {}", result.unwrap_err());

    let _ = sender_pk;
}

#[test]
fn streaming_withdraw_rejects_forged_continuation_remaining() {
    // Same partial-draw shape, but the next state's remaining_allowance is
    // forged (no decrement). The require() in the policy must reject it.
    let sender = random_keypair();
    let recipient = random_keypair();
    let sender_pk = sender.x_only_public_key().0.serialize().to_vec();
    let recipient_pk = recipient.x_only_public_key().0.serialize().to_vec();

    let rate = 500_i64;
    let total = 5_000_i64;
    let remaining_before = 3_000_i64;
    let remaining_forged = remaining_before; // attacker leaves it un-decremented
    let period = 10_i64;
    let next_release_before = 100_i64;
    let next_release_after = next_release_before + period;

    let active = compile_contract_file(
        "contracts/core/streaming-payment.sil",
        vec![
            sender_pk.clone().into(),
            recipient_pk.clone().into(),
            rate.into(),
            total.into(),
            remaining_before.into(),
            period.into(),
            next_release_before.into(),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/streaming-payment.sil",
        vec![
            sender_pk.clone().into(),
            recipient_pk.clone().into(),
            rate.into(),
            total.into(),
            remaining_forged.into(),
            period.into(),
            next_release_after.into(),
        ],
    );

    let input_value = 6_000u64;
    let payout_value = rate as u64;
    let cov_id = ownable_cov_id(0x12);
    let payout = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&recipient_pk).into()),
        covenant: None,
    };
    let continuation = TransactionOutput {
        value: input_value - payout_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0x12; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![payout, continuation], next_release_before as u64, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let recipient_sig = schnorr_signature(&mutable, 0, &recipient);
    // The arg presents the forged state to the policy; the policy's
    // require(next_states[0].remaining_allowance == prev_state.remaining_allowance - rate)
    // catches it.
    let forged_state = streaming_state(
        &sender_pk,
        &recipient_pk,
        rate,
        total,
        remaining_forged,
        period,
        next_release_after,
    );
    let next_states_arg: Expr<'static> = vec![forged_state].into();
    let sigscript = covenant_sigscript(
        &active,
        "withdraw",
        vec![recipient_pk.clone().into(), recipient_sig.into(), next_states_arg],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_covenant_input(mutable.tx, utxo).expect_err("forged remaining must fail");
    assert!(matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse), "unexpected error: {err:?}");
}

// ─── Vesting.claim (singleton transition with termination_allowed) ─────────

fn vesting_state(
    beneficiary: &[u8],
    admin: &[u8],
    total: i64,
    claimed: i64,
    cliff: i64,
    period: i64,
    per_period: i64,
    revocable: bool,
) -> Expr<'static> {
    struct_object(vec![
        ("beneficiary", beneficiary.to_vec().into()),
        ("admin", admin.to_vec().into()),
        ("total_allocation", total.into()),
        ("claimed_amount", claimed.into()),
        ("cliff_time", cliff.into()),
        ("period", period.into()),
        ("release_per_period", per_period.into()),
        ("revocable", Expr::bool(revocable)),
    ])
}

#[test]
fn vesting_claim_accepts_partial_release_with_continuation() {
    let beneficiary = random_keypair();
    let admin = random_keypair();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize().to_vec();
    let admin_pk = admin.x_only_public_key().0.serialize().to_vec();

    let total = 10_000_i64;
    let claimed_before = 2_000_i64;
    let per_period = 1_000_i64;
    let claimed_after = claimed_before + per_period;
    let cliff_before = 100_i64;
    let period = 50_i64;
    let cliff_after = cliff_before + period;
    let revocable = true;

    let active = compile_contract_file(
        "contracts/core/vesting.sil",
        vec![
            beneficiary_pk.clone().into(),
            admin_pk.clone().into(),
            total.into(),
            claimed_before.into(),
            cliff_before.into(),
            period.into(),
            per_period.into(),
            Expr::bool(revocable),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/vesting.sil",
        vec![
            beneficiary_pk.clone().into(),
            admin_pk.clone().into(),
            total.into(),
            claimed_after.into(),
            cliff_after.into(),
            period.into(),
            per_period.into(),
            Expr::bool(revocable),
        ],
    );

    let input_value = 10_000u64;
    let payout_value = per_period as u64;
    let cov_id = ownable_cov_id(0x13);
    let payout = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&beneficiary_pk).into()),
        covenant: None,
    };
    let continuation = TransactionOutput {
        value: input_value - payout_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0x13; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    let tx = Transaction::new(1, vec![input], vec![payout, continuation], cliff_before as u64, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let beneficiary_sig = schnorr_signature(&mutable, 0, &beneficiary);
    let next_state = vesting_state(
        &beneficiary_pk,
        &admin_pk,
        total,
        claimed_after,
        cliff_after,
        period,
        per_period,
        revocable,
    );
    let next_states_arg: Expr<'static> = vec![next_state].into();
    let sigscript = covenant_sigscript(
        &active,
        "claim",
        vec![beneficiary_pk.clone().into(), beneficiary_sig.into(), next_states_arg],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let result = execute_covenant_input(mutable.tx, utxo);
    assert!(result.is_ok(), "vesting claim partial-release runtime failed: {}", result.unwrap_err());
}

#[test]
fn vesting_claim_rejects_pre_cliff() {
    // Same partial-release setup but tx.time < cliff_time.
    let beneficiary = random_keypair();
    let admin = random_keypair();
    let beneficiary_pk = beneficiary.x_only_public_key().0.serialize().to_vec();
    let admin_pk = admin.x_only_public_key().0.serialize().to_vec();

    let total = 10_000_i64;
    let claimed_before = 2_000_i64;
    let per_period = 1_000_i64;
    let claimed_after = claimed_before + per_period;
    let cliff_before = 500_i64;
    let period = 50_i64;
    let cliff_after = cliff_before + period;
    let revocable = true;

    let active = compile_contract_file(
        "contracts/core/vesting.sil",
        vec![
            beneficiary_pk.clone().into(),
            admin_pk.clone().into(),
            total.into(),
            claimed_before.into(),
            cliff_before.into(),
            period.into(),
            per_period.into(),
            Expr::bool(revocable),
        ],
    );
    let next = compile_contract_file(
        "contracts/core/vesting.sil",
        vec![
            beneficiary_pk.clone().into(),
            admin_pk.clone().into(),
            total.into(),
            claimed_after.into(),
            cliff_after.into(),
            period.into(),
            per_period.into(),
            Expr::bool(revocable),
        ],
    );

    let input_value = 10_000u64;
    let payout_value = per_period as u64;
    let cov_id = ownable_cov_id(0x14);
    let payout = TransactionOutput {
        value: payout_value,
        script_public_key: ScriptPublicKey::new(0, build_p2pk_script(&beneficiary_pk).into()),
        covenant: None,
    };
    let continuation = TransactionOutput {
        value: input_value - payout_value - 1_000,
        script_public_key: pay_to_script_hash_script(&next.script),
        covenant: Some(CovenantBinding { authorizing_input: 0, covenant_id: cov_id }),
    };
    let input = TransactionInput {
        previous_outpoint: TransactionOutpoint {
            transaction_id: TransactionId::from_bytes([0x14; 32]),
            index: 0,
        },
        signature_script: vec![],
        sequence: 0,
        mass: SigopCount(1).into(),
    };
    // tx.time = 100 < cliff_time = 500
    let tx = Transaction::new(1, vec![input], vec![payout, continuation], 100, Default::default(), 0, vec![]);
    let utxo = UtxoEntry::new(input_value, pay_to_script_hash_script(&active.script), 0, false, Some(cov_id));
    let mut mutable = MutableTransaction::with_entries(tx, vec![utxo.clone()]);

    let beneficiary_sig = schnorr_signature(&mutable, 0, &beneficiary);
    let next_state = vesting_state(
        &beneficiary_pk,
        &admin_pk,
        total,
        claimed_after,
        cliff_after,
        period,
        per_period,
        revocable,
    );
    let next_states_arg: Expr<'static> = vec![next_state].into();
    let sigscript = covenant_sigscript(
        &active,
        "claim",
        vec![beneficiary_pk.clone().into(), beneficiary_sig.into(), next_states_arg],
    );
    mutable.tx.inputs[0].signature_script = sigscript;

    let err = execute_covenant_input(mutable.tx, utxo).expect_err("pre-cliff claim must fail");
    assert!(
        matches!(err, TxScriptError::VerifyError | TxScriptError::EvalFalse | TxScriptError::UnsatisfiedLockTime(_)),
        "unexpected error: {err:?}"
    );
}
