// Standalone test suite for ClipStash core modules
#[path = "../src/crypto.rs"]
mod crypto;

#[path = "../src/detector.rs"]
mod detector;

#[path = "../src/db.rs"]
mod db;

#[test]
fn test_detector_rules() {
    let aws = detector::scan_and_mask("export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE");
    assert!(aws.is_secret);
    assert_eq!(aws.secret_types[0], "AWS Access Key");
    assert!(aws.masked_content.contains("AKIA••••••••••••"));

    let gh = detector::scan_and_mask("ghp_1234567890abcdefghijklmnopqrstuvwxyz");
    assert!(gh.is_secret);
    assert_eq!(gh.secret_types[0], "GitHub Token");

    let openai = detector::scan_and_mask("sk-proj-123456789012345678901234567890");
    assert!(openai.is_secret);
    assert_eq!(openai.secret_types[0], "OpenAI API Key");

    let clean = detector::scan_and_mask("const greeting = 'hello world';");
    assert!(!clean.is_secret);
}

#[test]
fn test_crypto_engine() {
    let plain = "sensitive_database_password_9988!";
    let encrypted = crypto::encrypt_text(plain).expect("encryption failed");
    assert_ne!(plain, encrypted);
    let decrypted = crypto::decrypt_text(&encrypted).expect("decryption failed");
    assert_eq!(plain, decrypted);
}

#[test]
fn test_database_crud_and_fts() {
    let db = db::Database::new_memory().expect("in-memory db init failed");
    let clip = db.save_clip("let x = 42;", Some("code"), Some(vec!["rust".into()])).expect("save failed");
    assert_eq!(clip.preview_text, "let x = 42;");
    assert!(!clip.is_secret);

    // Search via FTS
    let results = db.get_clips(Some("let"), None, false, false, 10, 0).expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, clip.id);

    // Toggle pin
    let pinned = db.toggle_pin(&clip.id).expect("pin failed");
    assert!(pinned);

    // Decrypt content
    let content = db.get_decrypted_content(&clip.id).expect("get content failed");
    assert_eq!(content, "let x = 42;");
}
