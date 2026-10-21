use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

static ENCRYPTION_KEY: OnceLock<[u8; 32]> = OnceLock::new();

pub fn get_or_init_key() -> &'static [u8; 32] {
    ENCRYPTION_KEY.get_or_init(|| {
        let key_path = get_key_file_path();
        if key_path.exists() {
            if let Ok(content) = fs::read(&key_path) {
                if content.len() == 32 {
                    let mut key = [0u8; 32];
                    key.copy_from_slice(&content);
                    return key;
                }
            }
        }

        // Generate new random 256-bit key
        let mut key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);

        if let Some(parent) = key_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&key_path, &key);
        key
    })
}

fn get_key_file_path() -> PathBuf {
    let base_dir = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base_dir.join("ClipStash").join(".vault.key")
}

pub fn hash_content(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn encrypt_text(plain: &str) -> Result<String, String> {
    let key = get_or_init_key();
    let cipher = Aes256Gcm::new(key.into());

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| format!("Encryption failure: {e}"))?;

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(combined))
}

pub fn decrypt_text(encrypted_b64: &str) -> Result<String, String> {
    let raw = BASE64
        .decode(encrypted_b64)
        .map_err(|e| format!("Base64 decode error: {e}"))?;

    if raw.len() < 12 {
        return Err("Payload too short for initialization vector".to_string());
    }

    let (nonce_bytes, ciphertext) = raw.split_at(12);
    let key = get_or_init_key();
    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(nonce_bytes);

    let decrypted_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failure: {e}"))?;

    String::from_utf8(decrypted_bytes).map_err(|e| format!("UTF-8 decode error: {e}"))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct EncryptedVaultContainer {
    pub format: String,
    pub version: u32,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub fn derive_key_from_passphrase(passphrase: &str, salt: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(passphrase.as_bytes());
    hasher.update(salt);
    let mut key = hasher.finalize();
    for _ in 1..5_000 {
        let mut round_hasher = Sha256::new();
        round_hasher.update(key);
        round_hasher.update(salt);
        key = round_hasher.finalize();
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&key);
    out
}

pub fn encrypt_with_passphrase(plain: &str, passphrase: &str) -> Result<String, String> {
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let key = derive_key_from_passphrase(passphrase, &salt);
    let cipher = Aes256Gcm::new((&key).into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| format!("Passphrase encryption failure: {e}"))?;

    let container = EncryptedVaultContainer {
        format: "clipstash-encrypted-vault".to_string(),
        version: 1,
        salt: BASE64.encode(salt),
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(ciphertext),
    };

    serde_json::to_string_pretty(&container)
        .map_err(|e| format!("Serialization error: {e}"))
}

pub fn decrypt_with_passphrase(container_json: &str, passphrase: &str) -> Result<String, String> {
    let container: EncryptedVaultContainer = serde_json::from_str(container_json)
        .map_err(|e| format!("Invalid vault container JSON: {e}"))?;

    if container.format != "clipstash-encrypted-vault" {
        return Err("Unrecognized vault backup format".to_string());
    }

    let salt = BASE64
        .decode(&container.salt)
        .map_err(|e| format!("Invalid salt: {e}"))?;
    let nonce_bytes = BASE64
        .decode(&container.nonce)
        .map_err(|e| format!("Invalid nonce: {e}"))?;
    let ciphertext = BASE64
        .decode(&container.ciphertext)
        .map_err(|e| format!("Invalid ciphertext: {e}"))?;

    let key = derive_key_from_passphrase(passphrase, &salt);
    let cipher = Aes256Gcm::new((&key).into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    let decrypted = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Invalid passphrase or corrupted vault backup".to_string())?;

    String::from_utf8(decrypted).map_err(|e| format!("UTF-8 decode error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_content() {
        let hash = hash_content("test text");
        assert_eq!(hash.len(), 64);
        assert_eq!(hash, hash_content("test text"));
        assert_ne!(hash, hash_content("different"));
    }

    #[test]
    fn test_encryption_roundtrip() {
        let secret = "sk-proj-supersecretkey1234567890abcdefghijklmn";
        let encrypted = encrypt_text(secret).expect("encryption failed");
        assert_ne!(encrypted, secret);
        let decrypted = decrypt_text(&encrypted).expect("decryption failed");
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn test_passphrase_encryption_roundtrip() {
        let payload = r#"{"name":"clipstash-test","clips":[{"id":"1","text":"test"}]}"#;
        let pass = "my-secure-master-passphrase-2026";
        let encrypted_container =
            encrypt_with_passphrase(payload, pass).expect("passphrase encryption failed");
        assert!(encrypted_container.contains("clipstash-encrypted-vault"));

        let decrypted = decrypt_with_passphrase(&encrypted_container, pass)
            .expect("passphrase decryption failed");
        assert_eq!(decrypted, payload);

        let wrong_pass = "wrong-password";
        let failed = decrypt_with_passphrase(&encrypted_container, wrong_pass);
        assert!(failed.is_err());
    }
}
