use std::fs;
use std::path::PathBuf;

use kaspa_consensus_core::Hash;
use kaspa_consensus_core::hashing;
use kaspa_consensus_core::hashing::sighash::{SigHashReusedValuesUnsync, calc_schnorr_signature_hash};
use kaspa_consensus_core::hashing::sighash_type::SIG_HASH_ALL;
use kaspa_consensus_core::tx::{MutableTransaction, Transaction, TransactionId, TransactionInput, TransactionOutpoint, TransactionOutput, UtxoEntry};
use kaspa_txscript::opcodes::codes::OpTrue;
use kaspa_txscript::pay_to_script_hash_script;
use rand::thread_rng;
use secp256k1::{Keypair, Message, Secp256k1, SecretKey};
use silverscript_lang::ast::Expr;
use silverscript_lang::compiler::{CompileOptions, CompiledContract, compile_contract, struct_object};

mod common;

use common::{assert_verify_like_error, compiled_template_parts_and_hash, covenant_decl_sigscript, covenant_output, execute_input_with_covenants};

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

fn sign_tx_input(tx: Transaction, entries: Vec<UtxoEntry>, input_idx: usize, keypair: &Keypair) -> Vec<u8> {
    let tx = MutableTransaction::with_entries(tx, entries);
    let reused_values = SigHashReusedValuesUnsync::new();
    let sig_hash = calc_schnorr_signature_hash(&tx.as_verifiable(), input_idx, SIG_HASH_ALL, &reused_values);
    let msg = Message::from_digest_slice(sig_hash.as_bytes().as_slice()).expect("valid sighash message");
    let sig = keypair.sign_schnorr(msg);
    let mut signature = sig.as_ref().to_vec();
    signature.push(SIG_HASH_ALL.to_u8());
    signature
}

fn output_utxo(output: &TransactionOutput, tx: &Transaction, covenant_id: Hash) -> UtxoEntry {
    UtxoEntry::new(output.value, output.script_public_key.clone(), 0, tx.is_coinbase(), Some(covenant_id))
}

fn tx_input_from_outpoint(previous_outpoint: TransactionOutpoint, signature_script: Vec<u8>) -> TransactionInput {
    TransactionInput::new(previous_outpoint, signature_script, 0, 0)
}

fn kcc20_state_arg<'i>(owner_identifier: Vec<u8>, identifier_type: u8, amount: i64, is_minter: bool) -> Expr<'i> {
    struct_object(vec![
        ("ownerIdentifier", Expr::bytes(owner_identifier)),
        ("identifierType", Expr::byte(identifier_type)),
        ("amount", Expr::int(amount)),
        ("isMinter", Expr::bool(is_minter)),
    ])
}

fn kcc20_state_array_arg_full<'i>(values: Vec<(Vec<u8>, u8, i64, bool)>) -> Expr<'i> {
    values
        .into_iter()
        .map(|(owner_identifier, identifier_type, amount, is_minter)| {
            struct_object(vec![
                ("ownerIdentifier", Expr::bytes(owner_identifier)),
                ("identifierType", Expr::byte(identifier_type)),
                ("amount", Expr::int(amount)),
                ("isMinter", Expr::bool(is_minter)),
            ])
        })
        .collect::<Vec<_>>()
        .into()
}

fn sig_array_arg<'i>(values: Vec<Vec<u8>>) -> Expr<'i> {
    values.into_iter().map(Expr::bytes).collect::<Vec<_>>().into()
}

fn witness_array_arg<'i>(values: Vec<u8>) -> Expr<'i> {
    Expr::bytes(values)
}

fn capped_state_arg<'i>(kcc20_covid: Vec<u8>, total_cap: i64, remaining_allowance: i64, initialized: bool) -> Expr<'i> {
    struct_object(vec![
        ("kcc20Covid", Expr::bytes(kcc20_covid)),
        ("totalCap", Expr::int(total_cap)),
        ("remainingAllowance", Expr::int(remaining_allowance)),
        ("initialized", Expr::bool(initialized)),
    ])
}

fn pausable_state_arg<'i>(kcc20_covid: Vec<u8>, paused: bool, initialized: bool) -> Expr<'i> {
    struct_object(vec![
        ("kcc20Covid", Expr::bytes(kcc20_covid)),
        ("paused", Expr::bool(paused)),
        ("initialized", Expr::bool(initialized)),
    ])
}


fn ownable_state_arg<'i>(
    admin: Vec<u8>,
    has_pending_admin: bool,
    pending_admin: Vec<u8>,
    kcc20_covid: Vec<u8>,
    initialized: bool,
) -> Expr<'i> {
    struct_object(vec![
        ("admin", Expr::bytes(admin)),
        ("hasPendingAdmin", Expr::bool(has_pending_admin)),
        ("pendingAdmin", Expr::bytes(pending_admin)),
        ("kcc20Covid", Expr::bytes(kcc20_covid)),
        ("initialized", Expr::bool(initialized)),
    ])
}


fn vesting_state_arg<'i>(
    total_allocation: i64,
    minted_amount: i64,
    cliff_time: i64,
    period: i64,
    release_per_period: i64,
    kcc20_covid: Vec<u8>,
    initialized: bool,
) -> Expr<'i> {
    struct_object(vec![
        ("totalAllocation", Expr::int(total_allocation)),
        ("mintedAmount", Expr::int(minted_amount)),
        ("cliffTime", Expr::int(cliff_time)),
        ("period", Expr::int(period)),
        ("releasePerPeriod", Expr::int(release_per_period)),
        ("kcc20Covid", Expr::bytes(kcc20_covid)),
        ("initialized", Expr::bool(initialized)),
    ])
}

#[test]
fn kcc20_capped_init_and_mint_accept_happy_path() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const TOTAL_CAP: i64 = 1_000;
    const FIRST_MINT: i64 = 200;

    let admin = random_keypair();
    let recipient = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let recipient_bytes = recipient.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_capped = |kcc20_covid: Hash, remaining_allowance: i64, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-capped.sil",
            vec![
                admin_bytes.clone().into(),
                TOTAL_CAP.into(),
                remaining_allowance.into(),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_capped(placeholder_kcc20_covid, TOTAL_CAP, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0x4d; 32]), index: 0 };
    let funding_input = TransactionInput::new(funding_outpoint, vec![], 0, 0);
    let funding_utxo = UtxoEntry::new(1_500, kaspa_consensus_core::tx::ScriptPublicKey::new(0, vec![OpTrue].into()), 0, false, None);
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![funding_input],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );

    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_capped(asset_cov_id, TOTAL_CAP, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])],
        init_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(
        &pre_init,
        "init",
        vec![capped_state_arg(asset_cov_id.as_bytes().to_vec(), TOTAL_CAP, TOTAL_CAP, true), init_sig.into()],
        true,
    );
    let init_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)],
        init_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );

    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("capped init should succeed");

    let next_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            recipient_bytes.clone().into(),
            FIRST_MINT.into(),
            Expr::byte(IDENTIFIER_PUBKEY),
            Expr::bool(false),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let post_mint = compile_capped(asset_cov_id, TOTAL_CAP - FIRST_MINT, true);

    let mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&recipient_asset, 0, asset_cov_id),
        covenant_output(&post_mint, 1, controller_cov_id),
    ];
    let mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id),
    ];
    let mint_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![]),
        ],
        mint_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let admin_sig = sign_tx_input(mint_unsigned.clone(), mint_entries.clone(), 1, &admin);
    let asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (recipient_bytes.clone(), IDENTIFIER_PUBKEY, FIRST_MINT, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let controller_sigscript = covenant_decl_sigscript(
        &post_init,
        "mint",
        vec![
            capped_state_arg(asset_cov_id.as_bytes().to_vec(), TOTAL_CAP, TOTAL_CAP - FIRST_MINT, true),
            admin_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(recipient_bytes, IDENTIFIER_PUBKEY, FIRST_MINT, false),
        ],
        true,
    );
    let mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, controller_sigscript),
        ],
        mint_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );

    execute_input_with_covenants(mint_tx.clone(), mint_entries.clone(), 0).expect("asset leader transfer should succeed");
    execute_input_with_covenants(mint_tx, mint_entries, 1).expect("capped controller mint should succeed");

    let _ = funding_utxo;
}

#[test]
fn kcc20_capped_rejects_over_mint() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const TOTAL_CAP: i64 = 300;
    const BAD_MINT: i64 = 400;

    let admin = random_keypair();
    let recipient = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let recipient_bytes = recipient.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_capped = |kcc20_covid: Hash, remaining_allowance: i64, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-capped.sil",
            vec![
                admin_bytes.clone().into(),
                TOTAL_CAP.into(),
                remaining_allowance.into(),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_capped(placeholder_kcc20_covid, TOTAL_CAP, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0x5d; 32]), index: 0 };
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![TransactionInput::new(funding_outpoint, vec![], 0, 0)],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );

    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_capped(asset_cov_id, TOTAL_CAP, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])],
        init_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(
        &pre_init,
        "init",
        vec![capped_state_arg(asset_cov_id.as_bytes().to_vec(), TOTAL_CAP, TOTAL_CAP, true), init_sig.into()],
        true,
    );
    let init_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)],
        init_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("capped init should succeed");

    let next_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            recipient_bytes.clone().into(),
            BAD_MINT.into(),
            Expr::byte(IDENTIFIER_PUBKEY),
            Expr::bool(false),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let bad_post_mint = compile_capped(asset_cov_id, TOTAL_CAP - BAD_MINT, true);

    let mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&recipient_asset, 0, asset_cov_id),
        covenant_output(&bad_post_mint, 1, controller_cov_id),
    ];
    let mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id),
    ];
    let mint_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![]),
        ],
        mint_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let admin_sig = sign_tx_input(mint_unsigned.clone(), mint_entries.clone(), 1, &admin);
    let asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (recipient_bytes.clone(), IDENTIFIER_PUBKEY, BAD_MINT, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let controller_sigscript = covenant_decl_sigscript(
        &post_init,
        "mint",
        vec![
            capped_state_arg(asset_cov_id.as_bytes().to_vec(), TOTAL_CAP, TOTAL_CAP - BAD_MINT, true),
            admin_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(recipient_bytes, IDENTIFIER_PUBKEY, BAD_MINT, false),
        ],
        true,
    );
    let mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, controller_sigscript),
        ],
        mint_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );

    let err = execute_input_with_covenants(mint_tx, mint_entries, 1).expect_err("over-cap mint should fail");
    assert_verify_like_error(err);
}


#[test]
fn kcc20_pausable_pause_unpause_and_reject_paused_mint() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const MINT_AMOUNT: i64 = 150;

    let admin = random_keypair();
    let recipient = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let recipient_bytes = recipient.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_pausable = |kcc20_covid: Hash, paused: bool, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-pausable.sil",
            vec![
                admin_bytes.clone().into(),
                Expr::bool(paused),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_pausable(placeholder_kcc20_covid, false, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0x6d; 32]), index: 0 };
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![TransactionInput::new(funding_outpoint, vec![], 0, 0)],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );

    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_pausable(asset_cov_id, false, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])],
        init_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(
        &pre_init,
        "init",
        vec![pausable_state_arg(asset_cov_id.as_bytes().to_vec(), false, true), init_sig.into()],
        true,
    );
    let init_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)],
        init_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("pausable init should succeed");

    let paused_controller = compile_pausable(asset_cov_id, true, true);
    let pause_outputs = vec![covenant_output(&paused_controller, 0, controller_cov_id)];
    let pause_entries = vec![output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id)];
    let pause_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![])],
        pause_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let pause_sig = sign_tx_input(pause_unsigned.clone(), pause_entries.clone(), 0, &admin);
    let pause_sigscript = covenant_decl_sigscript(
        &post_init,
        "pause",
        vec![pausable_state_arg(asset_cov_id.as_bytes().to_vec(), true, true), pause_sig.into()],
        true,
    );
    let pause_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, pause_sigscript)],
        pause_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(pause_tx.clone(), pause_entries, 0).expect("pause should succeed");

    let unpaused_controller = compile_pausable(asset_cov_id, false, true);
    let unpause_outputs = vec![covenant_output(&unpaused_controller, 0, controller_cov_id)];
    let unpause_entries = vec![output_utxo(&pause_tx.outputs[0], &pause_tx, controller_cov_id)];
    let unpause_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: pause_tx.id(), index: 0 }, vec![])],
        unpause_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let unpause_sig = sign_tx_input(unpause_unsigned.clone(), unpause_entries.clone(), 0, &admin);
    let unpause_sigscript = covenant_decl_sigscript(
        &paused_controller,
        "unpause",
        vec![pausable_state_arg(asset_cov_id.as_bytes().to_vec(), false, true), unpause_sig.into()],
        true,
    );
    let unpause_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: pause_tx.id(), index: 0 }, unpause_sigscript)],
        unpause_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(unpause_tx, unpause_entries, 0).expect("unpause should succeed");

    let next_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            recipient_bytes.clone().into(),
            MINT_AMOUNT.into(),
            Expr::byte(IDENTIFIER_PUBKEY),
            Expr::bool(false),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let paused_again_controller = compile_pausable(asset_cov_id, true, true);
    let pause2_outputs = vec![covenant_output(&paused_again_controller, 0, controller_cov_id)];
    let pause2_entries = vec![output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id)];
    let pause2_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![])],
        pause2_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let pause2_sig = sign_tx_input(pause2_unsigned.clone(), pause2_entries.clone(), 0, &admin);
    let pause2_sigscript = covenant_decl_sigscript(
        &post_init,
        "pause",
        vec![pausable_state_arg(asset_cov_id.as_bytes().to_vec(), true, true), pause2_sig.into()],
        true,
    );
    let pause2_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, pause2_sigscript)],
        pause2_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(pause2_tx.clone(), pause2_entries, 0).expect("second pause should succeed");

    let mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&recipient_asset, 0, asset_cov_id),
        covenant_output(&paused_again_controller, 1, controller_cov_id),
    ];
    let mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&pause2_tx.outputs[0], &pause2_tx, controller_cov_id),
    ];
    let mint_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: pause2_tx.id(), index: 0 }, vec![]),
        ],
        mint_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let admin_sig = sign_tx_input(mint_unsigned.clone(), mint_entries.clone(), 1, &admin);
    let asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (recipient_bytes, IDENTIFIER_PUBKEY, MINT_AMOUNT, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let controller_sigscript = covenant_decl_sigscript(
        &paused_again_controller,
        "mint",
        vec![
            pausable_state_arg(asset_cov_id.as_bytes().to_vec(), true, true),
            admin_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(recipient.x_only_public_key().0.serialize().to_vec(), IDENTIFIER_PUBKEY, MINT_AMOUNT, false),
        ],
        true,
    );
    let mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: pause2_tx.id(), index: 0 }, controller_sigscript),
        ],
        mint_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );

    let err = execute_input_with_covenants(mint_tx, mint_entries, 1).expect_err("paused mint should fail");
    assert_verify_like_error(err);
}


#[test]
fn kcc20_ownable_handoff_preserves_pending_mint_then_transfers_authority() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const PENDING_MINT: i64 = 120;
    const ACCEPTED_MINT: i64 = 80;

    let admin = random_keypair();
    let next_admin = random_keypair();
    let recipient = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let next_admin_bytes = next_admin.x_only_public_key().0.serialize().to_vec();
    let recipient_bytes = recipient.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_ownable = |admin_arg: Vec<u8>, has_pending: bool, pending_arg: Vec<u8>, kcc20_covid: Hash, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-ownable.sil",
            vec![
                admin_arg.into(),
                Expr::bool(has_pending),
                pending_arg.into(),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_ownable(admin_bytes.clone(), false, admin_bytes.clone(), placeholder_kcc20_covid, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0x7d; 32]), index: 0 };
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![TransactionInput::new(funding_outpoint, vec![], 0, 0)],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );

    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_ownable(admin_bytes.clone(), false, admin_bytes.clone(), asset_cov_id, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])],
        init_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(
        &pre_init,
        "init",
        vec![ownable_state_arg(admin_bytes.clone(), false, admin_bytes.clone(), asset_cov_id.as_bytes().to_vec(), true), admin_bytes.clone().into(), init_sig.into()],
        true,
    );
    let init_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)],
        init_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("ownable init should succeed");

    let pending_state = compile_ownable(admin_bytes.clone(), true, next_admin_bytes.clone(), asset_cov_id, true);
    let propose_outputs = vec![covenant_output(&pending_state, 0, controller_cov_id)];
    let propose_entries = vec![output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id)];
    let propose_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![])],
        propose_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let propose_sig = sign_tx_input(propose_unsigned.clone(), propose_entries.clone(), 0, &admin);
    let propose_sigscript = covenant_decl_sigscript(
        &post_init,
        "propose_admin_transfer",
        vec![next_admin_bytes.clone().into(), admin_bytes.clone().into(), propose_sig.into()],
        true,
    );
    let propose_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, propose_sigscript)],
        propose_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(propose_tx.clone(), propose_entries, 0).expect("propose admin transfer should succeed");

    let next_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let pending_recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![recipient_bytes.clone().into(), PENDING_MINT.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let pending_state_after_mint = compile_ownable(admin_bytes.clone(), true, next_admin_bytes.clone(), asset_cov_id, true);
    let pending_mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&pending_recipient_asset, 0, asset_cov_id),
        covenant_output(&pending_state_after_mint, 1, controller_cov_id),
    ];
    let pending_mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&propose_tx.outputs[0], &propose_tx, controller_cov_id),
    ];
    let pending_mint_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: propose_tx.id(), index: 0 }, vec![]),
        ],
        pending_mint_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let pending_admin_sig = sign_tx_input(pending_mint_unsigned.clone(), pending_mint_entries.clone(), 1, &admin);
    let pending_asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (recipient_bytes.clone(), IDENTIFIER_PUBKEY, PENDING_MINT, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let pending_controller_sigscript = covenant_decl_sigscript(
        &pending_state,
        "mint",
        vec![
            ownable_state_arg(admin_bytes.clone(), true, next_admin_bytes.clone(), asset_cov_id.as_bytes().to_vec(), true),
            admin_bytes.clone().into(),
            pending_admin_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(recipient_bytes.clone(), IDENTIFIER_PUBKEY, PENDING_MINT, false),
        ],
        true,
    );
    let pending_mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, pending_asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: propose_tx.id(), index: 0 }, pending_controller_sigscript),
        ],
        pending_mint_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(pending_mint_tx, pending_mint_entries, 1).expect("current admin should still mint while transfer pending");

    let accepted_state = compile_ownable(next_admin_bytes.clone(), false, next_admin_bytes.clone(), asset_cov_id, true);
    let accept_outputs = vec![covenant_output(&accepted_state, 0, controller_cov_id)];
    let accept_entries = vec![output_utxo(&propose_tx.outputs[0], &propose_tx, controller_cov_id)];
    let accept_unsigned = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: propose_tx.id(), index: 0 }, vec![])],
        accept_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let accept_sig = sign_tx_input(accept_unsigned.clone(), accept_entries.clone(), 0, &next_admin);
    let accept_sigscript = covenant_decl_sigscript(
        &pending_state,
        "accept_admin_transfer",
        vec![next_admin_bytes.clone().into(), accept_sig.into()],
        true,
    );
    let accept_tx = Transaction::new(
        1,
        vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: propose_tx.id(), index: 0 }, accept_sigscript)],
        accept_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(accept_tx.clone(), accept_entries, 0).expect("accept admin transfer should succeed");

    let accepted_recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![recipient_bytes.clone().into(), ACCEPTED_MINT.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let post_accept_state = compile_ownable(next_admin_bytes.clone(), false, next_admin_bytes.clone(), asset_cov_id, true);
    let accepted_mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&accepted_recipient_asset, 0, asset_cov_id),
        covenant_output(&post_accept_state, 1, controller_cov_id),
    ];
    let accepted_mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&accept_tx.outputs[0], &accept_tx, controller_cov_id),
    ];
    let accepted_mint_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: accept_tx.id(), index: 0 }, vec![]),
        ],
        accepted_mint_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let next_admin_sig = sign_tx_input(accepted_mint_unsigned.clone(), accepted_mint_entries.clone(), 1, &next_admin);
    let accepted_asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (recipient_bytes.clone(), IDENTIFIER_PUBKEY, ACCEPTED_MINT, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let accepted_controller_sigscript = covenant_decl_sigscript(
        &accepted_state,
        "mint",
        vec![
            ownable_state_arg(next_admin_bytes.clone(), false, next_admin_bytes.clone(), asset_cov_id.as_bytes().to_vec(), true),
            next_admin_bytes.clone().into(),
            next_admin_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(recipient_bytes, IDENTIFIER_PUBKEY, ACCEPTED_MINT, false),
        ],
        true,
    );
    let accepted_mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, accepted_asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: accept_tx.id(), index: 0 }, accepted_controller_sigscript),
        ],
        accepted_mint_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(accepted_mint_tx, accepted_mint_entries, 1).expect("accepted new admin should mint");
}

#[test]
fn kcc20_ownable_rejects_old_admin_after_acceptance() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const BAD_MINT: i64 = 90;

    let admin = random_keypair();
    let next_admin = random_keypair();
    let recipient = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let next_admin_bytes = next_admin.x_only_public_key().0.serialize().to_vec();
    let recipient_bytes = recipient.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_ownable = |admin_arg: Vec<u8>, has_pending: bool, pending_arg: Vec<u8>, kcc20_covid: Hash, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-ownable.sil",
            vec![
                admin_arg.into(),
                Expr::bool(has_pending),
                pending_arg.into(),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_ownable(admin_bytes.clone(), false, admin_bytes.clone(), placeholder_kcc20_covid, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0x8d; 32]), index: 0 };
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![TransactionInput::new(funding_outpoint, vec![], 0, 0)],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );
    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_ownable(admin_bytes.clone(), false, admin_bytes.clone(), asset_cov_id, true);
    let pending_state = compile_ownable(admin_bytes.clone(), true, next_admin_bytes.clone(), asset_cov_id, true);
    let accepted_state = compile_ownable(next_admin_bytes.clone(), false, next_admin_bytes.clone(), asset_cov_id, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(1, vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])], init_outputs.clone(), 0, Default::default(), 0, vec![]);
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(&pre_init, "init", vec![ownable_state_arg(admin_bytes.clone(), false, admin_bytes.clone(), asset_cov_id.as_bytes().to_vec(), true), admin_bytes.clone().into(), init_sig.into()], true);
    let init_tx = Transaction::new(1, vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)], init_outputs, 0, Default::default(), 0, vec![]);
    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("ownable init should succeed");

    let propose_outputs = vec![covenant_output(&pending_state, 0, controller_cov_id)];
    let propose_entries = vec![output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id)];
    let propose_unsigned = Transaction::new(1, vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![])], propose_outputs.clone(), 0, Default::default(), 0, vec![]);
    let propose_sig = sign_tx_input(propose_unsigned.clone(), propose_entries.clone(), 0, &admin);
    let propose_sigscript = covenant_decl_sigscript(&post_init, "propose_admin_transfer", vec![next_admin_bytes.clone().into(), admin_bytes.clone().into(), propose_sig.into()], true);
    let propose_tx = Transaction::new(1, vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, propose_sigscript)], propose_outputs, 0, Default::default(), 0, vec![]);
    execute_input_with_covenants(propose_tx.clone(), propose_entries, 0).expect("propose should succeed");

    let accept_outputs = vec![covenant_output(&accepted_state, 0, controller_cov_id)];
    let accept_entries = vec![output_utxo(&propose_tx.outputs[0], &propose_tx, controller_cov_id)];
    let accept_unsigned = Transaction::new(1, vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: propose_tx.id(), index: 0 }, vec![])], accept_outputs.clone(), 0, Default::default(), 0, vec![]);
    let accept_sig = sign_tx_input(accept_unsigned.clone(), accept_entries.clone(), 0, &next_admin);
    let accept_sigscript = covenant_decl_sigscript(&pending_state, "accept_admin_transfer", vec![next_admin_bytes.clone().into(), accept_sig.into()], true);
    let accept_tx = Transaction::new(1, vec![tx_input_from_outpoint(TransactionOutpoint { transaction_id: propose_tx.id(), index: 0 }, accept_sigscript)], accept_outputs, 0, Default::default(), 0, vec![]);
    execute_input_with_covenants(accept_tx.clone(), accept_entries, 0).expect("accept should succeed");

    let next_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![controller_cov_id.as_bytes().to_vec().into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![recipient_bytes.clone().into(), BAD_MINT.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&recipient_asset, 0, asset_cov_id),
        covenant_output(&accepted_state, 1, controller_cov_id),
    ];
    let mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&accept_tx.outputs[0], &accept_tx, controller_cov_id),
    ];
    let mint_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: accept_tx.id(), index: 0 }, vec![]),
        ],
        mint_outputs.clone(),
        0,
        Default::default(),
        0,
        vec![],
    );
    let stale_admin_sig = sign_tx_input(mint_unsigned.clone(), mint_entries.clone(), 1, &admin);
    let asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (recipient_bytes.clone(), IDENTIFIER_PUBKEY, BAD_MINT, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let stale_controller_sigscript = covenant_decl_sigscript(
        &accepted_state,
        "mint",
        vec![
            ownable_state_arg(next_admin_bytes.clone(), false, next_admin_bytes.clone(), asset_cov_id.as_bytes().to_vec(), true),
            admin_bytes.into(),
            stale_admin_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(recipient_bytes, IDENTIFIER_PUBKEY, BAD_MINT, false),
        ],
        true,
    );
    let mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: accept_tx.id(), index: 0 }, stale_controller_sigscript),
        ],
        mint_outputs,
        0,
        Default::default(),
        0,
        vec![],
    );

    let err = execute_input_with_covenants(mint_tx, mint_entries, 1).expect_err("old admin should fail after acceptance");
    assert_verify_like_error(err);
}


#[test]
fn kcc20_vesting_rejects_pre_cliff_and_accepts_scheduled_mint() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const TOTAL_ALLOCATION: i64 = 500;
    const RELEASE_PER_PERIOD: i64 = 100;
    const CLIFF_TIME: u64 = 50;
    const PERIOD: i64 = 10;

    let admin = random_keypair();
    let beneficiary = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let beneficiary_bytes = beneficiary.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_vesting = |minted_amount: i64, cliff_time: i64, kcc20_covid: Hash, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-vesting.sil",
            vec![
                admin_bytes.clone().into(),
                beneficiary_bytes.clone().into(),
                TOTAL_ALLOCATION.into(),
                minted_amount.into(),
                cliff_time.into(),
                PERIOD.into(),
                RELEASE_PER_PERIOD.into(),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_vesting(0, CLIFF_TIME as i64, placeholder_kcc20_covid, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0x9d; 32]), index: 0 };
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![TransactionInput::new(funding_outpoint, vec![], 0, 0)],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );

    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_vesting(0, CLIFF_TIME as i64, asset_cov_id, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(1, vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])], init_outputs.clone(), 0, Default::default(), 0, vec![]);
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(
        &pre_init,
        "init",
        vec![vesting_state_arg(TOTAL_ALLOCATION, 0, CLIFF_TIME as i64, PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true), init_sig.into()],
        true,
    );
    let init_tx = Transaction::new(1, vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)], init_outputs, 0, Default::default(), 0, vec![]);
    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("vesting init should succeed");

    let next_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![controller_cov_id.as_bytes().to_vec().into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![beneficiary_bytes.clone().into(), RELEASE_PER_PERIOD.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let post_mint = compile_vesting(RELEASE_PER_PERIOD, CLIFF_TIME as i64 + PERIOD, asset_cov_id, true);

    let mint_outputs = vec![
        covenant_output(&next_minter_asset, 0, asset_cov_id),
        covenant_output(&recipient_asset, 0, asset_cov_id),
        covenant_output(&post_mint, 1, controller_cov_id),
    ];
    let mint_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id),
    ];

    let early_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![]),
        ],
        mint_outputs.clone(),
        CLIFF_TIME - 1,
        Default::default(),
        0,
        vec![],
    );
    let early_beneficiary_sig = sign_tx_input(early_unsigned.clone(), mint_entries.clone(), 1, &beneficiary);
    let early_asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let early_controller_sigscript = covenant_decl_sigscript(
        &post_init,
        "mint",
        vec![
            vesting_state_arg(TOTAL_ALLOCATION, RELEASE_PER_PERIOD, CLIFF_TIME as i64 + PERIOD, PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true),
            beneficiary_bytes.clone().into(),
            early_beneficiary_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
        ],
        true,
    );
    let early_mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, early_asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, early_controller_sigscript),
        ],
        mint_outputs.clone(),
        CLIFF_TIME - 1,
        Default::default(),
        0,
        vec![],
    );
    let err = execute_input_with_covenants(early_mint_tx, mint_entries.clone(), 1).expect_err("pre-cliff vesting mint should fail");
    assert!(matches!(err, kaspa_txscript_errors::TxScriptError::UnsatisfiedLockTime(_) | kaspa_txscript_errors::TxScriptError::VerifyError | kaspa_txscript_errors::TxScriptError::EvalFalse), "unexpected vesting pre-cliff error: {err:?}");

    let good_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![]),
        ],
        mint_outputs.clone(),
        CLIFF_TIME,
        Default::default(),
        0,
        vec![],
    );
    let beneficiary_sig = sign_tx_input(good_unsigned.clone(), mint_entries.clone(), 1, &beneficiary);
    let asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let controller_sigscript = covenant_decl_sigscript(
        &post_init,
        "mint",
        vec![
            vesting_state_arg(TOTAL_ALLOCATION, RELEASE_PER_PERIOD, CLIFF_TIME as i64 + PERIOD, PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true),
            beneficiary_bytes.clone().into(),
            beneficiary_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(beneficiary_bytes, IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
        ],
        true,
    );
    let mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, controller_sigscript),
        ],
        mint_outputs,
        CLIFF_TIME,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(mint_tx, mint_entries, 1).expect("vesting mint at cliff should succeed");
}


#[test]
fn kcc20_vesting_supports_second_period_and_final_drain() {
    const IDENTIFIER_COVENANT_ID: u8 = 0x02;
    const IDENTIFIER_PUBKEY: u8 = 0x00;
    const MAX_COV_INS: i64 = 2;
    const MAX_COV_OUTS: i64 = 2;
    const TOTAL_ALLOCATION: i64 = 250;
    const RELEASE_PER_PERIOD: i64 = 100;
    const CLIFF_TIME: u64 = 75;
    const PERIOD: i64 = 10;
    const FINAL_RELEASE: i64 = 50;

    let admin = random_keypair();
    let beneficiary = random_keypair();
    let admin_bytes = admin.x_only_public_key().0.serialize().to_vec();
    let beneficiary_bytes = beneficiary.x_only_public_key().0.serialize().to_vec();
    let placeholder_kcc20_covid = Hash::from_bytes([0; 32]);

    let asset_template_probe = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![vec![0u8; 32].into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let (template_prefix, template_suffix, expected_template_hash) = compiled_template_parts_and_hash(&asset_template_probe);

    let compile_vesting = |minted_amount: i64, cliff_time: i64, kcc20_covid: Hash, initialized: bool| {
        compile_contract_file(
            "contracts/tokens/kcc20-vesting.sil",
            vec![
                admin_bytes.clone().into(),
                beneficiary_bytes.clone().into(),
                TOTAL_ALLOCATION.into(),
                minted_amount.into(),
                cliff_time.into(),
                PERIOD.into(),
                RELEASE_PER_PERIOD.into(),
                kcc20_covid.as_bytes().to_vec().into(),
                Expr::bool(initialized),
                (template_prefix.len() as i64).into(),
                (template_suffix.len() as i64).into(),
                expected_template_hash.clone().into(),
                template_prefix.clone().into(),
                template_suffix.clone().into(),
            ],
        )
    };

    let pre_init = compile_vesting(0, CLIFF_TIME as i64, placeholder_kcc20_covid, false);
    let funding_outpoint = TransactionOutpoint { transaction_id: TransactionId::from_bytes([0xad; 32]), index: 0 };
    let pre_init_output_without_covenant = TransactionOutput { value: 1_000, script_public_key: pay_to_script_hash_script(&pre_init.script), covenant: None };
    let controller_cov_id = hashing::covenant_id::covenant_id(funding_outpoint, std::iter::once((0, &pre_init_output_without_covenant)));
    let pre_init_genesis_tx = Transaction::new(
        1,
        vec![TransactionInput::new(funding_outpoint, vec![], 0, 0)],
        vec![TransactionOutput { covenant: Some(kaspa_consensus_core::tx::CovenantBinding { authorizing_input: 0, covenant_id: controller_cov_id }), ..pre_init_output_without_covenant }],
        0,
        Default::default(),
        0,
        vec![],
    );

    let asset_genesis = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![
            controller_cov_id.as_bytes().to_vec().into(),
            0.into(),
            Expr::byte(IDENTIFIER_COVENANT_ID),
            Expr::bool(true),
            MAX_COV_INS.into(),
            MAX_COV_OUTS.into(),
        ],
    );
    let asset_genesis_outpoint = TransactionOutpoint { transaction_id: pre_init_genesis_tx.id(), index: 0 };
    let asset_genesis_output = covenant_output(&asset_genesis, 0, Hash::from_bytes([0; 32]));
    let asset_cov_id = hashing::covenant_id::covenant_id(asset_genesis_outpoint, std::iter::once((0, &asset_genesis_output)));
    let post_init = compile_vesting(0, CLIFF_TIME as i64, asset_cov_id, true);

    let init_outputs = vec![covenant_output(&asset_genesis, 0, asset_cov_id), covenant_output(&post_init, 0, controller_cov_id)];
    let init_entries = vec![output_utxo(&pre_init_genesis_tx.outputs[0], &pre_init_genesis_tx, controller_cov_id)];
    let init_unsigned = Transaction::new(1, vec![tx_input_from_outpoint(asset_genesis_outpoint, vec![])], init_outputs.clone(), 0, Default::default(), 0, vec![]);
    let init_sig = sign_tx_input(init_unsigned.clone(), init_entries.clone(), 0, &admin);
    let init_sigscript = covenant_decl_sigscript(
        &pre_init,
        "init",
        vec![vesting_state_arg(TOTAL_ALLOCATION, 0, CLIFF_TIME as i64, PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true), init_sig.into()],
        true,
    );
    let init_tx = Transaction::new(1, vec![tx_input_from_outpoint(asset_genesis_outpoint, init_sigscript)], init_outputs, 0, Default::default(), 0, vec![]);
    execute_input_with_covenants(init_tx.clone(), init_entries, 0).expect("vesting init should succeed");

    let continuing_minter_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![controller_cov_id.as_bytes().to_vec().into(), 0.into(), Expr::byte(IDENTIFIER_COVENANT_ID), Expr::bool(true), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );

    let first_recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![beneficiary_bytes.clone().into(), RELEASE_PER_PERIOD.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let first_post_mint = compile_vesting(RELEASE_PER_PERIOD, CLIFF_TIME as i64 + PERIOD, asset_cov_id, true);
    let first_outputs = vec![
        covenant_output(&continuing_minter_asset, 0, asset_cov_id),
        covenant_output(&first_recipient_asset, 0, asset_cov_id),
        covenant_output(&first_post_mint, 1, controller_cov_id),
    ];
    let first_entries = vec![
        output_utxo(&init_tx.outputs[0], &init_tx, asset_cov_id),
        output_utxo(&init_tx.outputs[1], &init_tx, controller_cov_id),
    ];
    let first_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, vec![]),
        ],
        first_outputs.clone(),
        CLIFF_TIME,
        Default::default(),
        0,
        vec![],
    );
    let first_beneficiary_sig = sign_tx_input(first_unsigned.clone(), first_entries.clone(), 1, &beneficiary);
    let first_asset_sigscript = covenant_decl_sigscript(
        &asset_genesis,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let first_controller_sigscript = covenant_decl_sigscript(
        &post_init,
        "mint",
        vec![
            vesting_state_arg(TOTAL_ALLOCATION, RELEASE_PER_PERIOD, CLIFF_TIME as i64 + PERIOD, PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true),
            beneficiary_bytes.clone().into(),
            first_beneficiary_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
        ],
        true,
    );
    let first_mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 0 }, first_asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: init_tx.id(), index: 1 }, first_controller_sigscript),
        ],
        first_outputs,
        CLIFF_TIME,
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(first_mint_tx.clone(), first_entries, 1).expect("first vesting mint should succeed");

    let second_recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![beneficiary_bytes.clone().into(), RELEASE_PER_PERIOD.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let second_post_mint = compile_vesting(RELEASE_PER_PERIOD * 2, CLIFF_TIME as i64 + (PERIOD * 2), asset_cov_id, true);
    let second_outputs = vec![
        covenant_output(&continuing_minter_asset, 0, asset_cov_id),
        covenant_output(&second_recipient_asset, 0, asset_cov_id),
        covenant_output(&second_post_mint, 1, controller_cov_id),
    ];
    let second_entries = vec![
        output_utxo(&first_mint_tx.outputs[0], &first_mint_tx, asset_cov_id),
        output_utxo(&first_mint_tx.outputs[2], &first_mint_tx, controller_cov_id),
    ];
    let second_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: first_mint_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: first_mint_tx.id(), index: 2 }, vec![]),
        ],
        second_outputs.clone(),
        CLIFF_TIME + (PERIOD as u64),
        Default::default(),
        0,
        vec![],
    );
    let second_beneficiary_sig = sign_tx_input(second_unsigned.clone(), second_entries.clone(), 1, &beneficiary);
    let second_asset_sigscript = covenant_decl_sigscript(
        &continuing_minter_asset,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let second_controller_sigscript = covenant_decl_sigscript(
        &first_post_mint,
        "mint",
        vec![
            vesting_state_arg(TOTAL_ALLOCATION, RELEASE_PER_PERIOD * 2, CLIFF_TIME as i64 + (PERIOD * 2), PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true),
            beneficiary_bytes.clone().into(),
            second_beneficiary_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, RELEASE_PER_PERIOD, false),
        ],
        true,
    );
    let second_mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: first_mint_tx.id(), index: 0 }, second_asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: first_mint_tx.id(), index: 2 }, second_controller_sigscript),
        ],
        second_outputs,
        CLIFF_TIME + (PERIOD as u64),
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(second_mint_tx.clone(), second_entries, 1).expect("second vesting mint should succeed");

    let final_recipient_asset = compile_contract_file(
        "contracts/tokens/kcc20.sil",
        vec![beneficiary_bytes.clone().into(), FINAL_RELEASE.into(), Expr::byte(IDENTIFIER_PUBKEY), Expr::bool(false), MAX_COV_INS.into(), MAX_COV_OUTS.into()],
    );
    let final_post_mint = compile_vesting(TOTAL_ALLOCATION, CLIFF_TIME as i64 + (PERIOD * 3), asset_cov_id, true);
    let final_outputs = vec![
        covenant_output(&continuing_minter_asset, 0, asset_cov_id),
        covenant_output(&final_recipient_asset, 0, asset_cov_id),
        covenant_output(&final_post_mint, 1, controller_cov_id),
    ];
    let final_entries = vec![
        output_utxo(&second_mint_tx.outputs[0], &second_mint_tx, asset_cov_id),
        output_utxo(&second_mint_tx.outputs[2], &second_mint_tx, controller_cov_id),
    ];
    let final_unsigned = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: second_mint_tx.id(), index: 0 }, vec![]),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: second_mint_tx.id(), index: 2 }, vec![]),
        ],
        final_outputs.clone(),
        CLIFF_TIME + ((PERIOD * 2) as u64),
        Default::default(),
        0,
        vec![],
    );
    let final_beneficiary_sig = sign_tx_input(final_unsigned.clone(), final_entries.clone(), 1, &beneficiary);
    let final_asset_sigscript = covenant_decl_sigscript(
        &continuing_minter_asset,
        "transfer",
        vec![
            kcc20_state_array_arg_full(vec![
                (controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
                (beneficiary_bytes.clone(), IDENTIFIER_PUBKEY, FINAL_RELEASE, false),
            ]),
            sig_array_arg(vec![]),
            witness_array_arg(vec![1]),
        ],
        true,
    );
    let final_controller_sigscript = covenant_decl_sigscript(
        &second_post_mint,
        "mint",
        vec![
            vesting_state_arg(TOTAL_ALLOCATION, TOTAL_ALLOCATION, CLIFF_TIME as i64 + (PERIOD * 3), PERIOD, RELEASE_PER_PERIOD, asset_cov_id.as_bytes().to_vec(), true),
            beneficiary_bytes.clone().into(),
            final_beneficiary_sig.into(),
            kcc20_state_arg(controller_cov_id.as_bytes().to_vec(), IDENTIFIER_COVENANT_ID, 0, true),
            kcc20_state_arg(beneficiary_bytes, IDENTIFIER_PUBKEY, FINAL_RELEASE, false),
        ],
        true,
    );
    let final_mint_tx = Transaction::new(
        1,
        vec![
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: second_mint_tx.id(), index: 0 }, final_asset_sigscript),
            tx_input_from_outpoint(TransactionOutpoint { transaction_id: second_mint_tx.id(), index: 2 }, final_controller_sigscript),
        ],
        final_outputs,
        CLIFF_TIME + ((PERIOD * 2) as u64),
        Default::default(),
        0,
        vec![],
    );
    execute_input_with_covenants(final_mint_tx, final_entries, 1).expect("final vesting drain should succeed");
}
