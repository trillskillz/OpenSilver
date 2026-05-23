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
use silverscript_lang::compiler::{CompileOptions, CompiledContract, CovenantDeclCallOptions, compile_contract};

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
