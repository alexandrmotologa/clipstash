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
}
