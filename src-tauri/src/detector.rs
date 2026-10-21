use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretScanResult {
    pub is_secret: bool,
    pub secret_types: Vec<String>,
    pub masked_content: String,
    pub preview_text: String,
    pub default_purge_seconds: Option<i64>,
}

struct SecretPattern {
    name: &'static str,
    regex: Regex,
    purge_seconds: i64,
}

static PATTERNS: LazyLock<Vec<SecretPattern>> = LazyLock::new(|| {
    vec![
        SecretPattern {
            name: "AWS Access Key",
            regex: Regex::new(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "GitHub Token",
            regex: Regex::new(r"\b(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "OpenAI API Key",
            regex: Regex::new(r"\b(sk-(?:proj-|admin-)?[a-zA-Z0-9_\-]{20,})\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Anthropic API Key",
            regex: Regex::new(r"\b(sk-ant-[a-zA-Z0-9\-_]{20,})\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Google API Key",
            regex: Regex::new(r"\bAIzaSy[0-9A-Za-z\-_]{33}\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Stripe Secret Key",
            regex: Regex::new(r"\b(sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,})\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Slack Token",
            regex: Regex::new(r"\bxox[baprs]-[0-9a-zA-Z\-]{10,}\b").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Private Key",
            regex: Regex::new(r"(?s)-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----.*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Database Credentials",
            regex: Regex::new(r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^:]+:([^@]+)@[^\s]+").unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "Environment Secret",
            regex: Regex::new(r#"(?i)\b(?:API_KEY|SECRET|PASSWORD|AUTH_TOKEN|PRIVATE_KEY)\s*=\s*['"]?([^\s'"]{8,})['"]?"#).unwrap(),
            purge_seconds: 60,
        },
        SecretPattern {
            name: "JSON Web Token",
            regex: Regex::new(r"\beyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\b").unwrap(),
            purge_seconds: 120,
        },
    ]
});

static CREDIT_CARD_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{13,19}\b").unwrap()
});

fn is_valid_luhn(candidate: &str) -> bool {
    let digits: Vec<u32> = candidate.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }

    let mut sum = 0;
    let mut double = false;
    for &digit in digits.iter().rev() {
        if double {
            let doubled = digit * 2;
            sum += if doubled > 9 { doubled - 9 } else { doubled };
        } else {
            sum += digit;
        }
        double = !double;
    }

    sum % 10 == 0
}

pub fn scan_and_mask(content: &str) -> SecretScanResult {
    let mut detected_types = Vec::new();
    let mut masked = content.to_string();
    let mut purge_seconds: Option<i64> = None;

    // Check predefined token patterns
    for pattern in PATTERNS.iter() {
        if pattern.regex.is_match(&masked) {
            detected_types.push(pattern.name.to_string());
            purge_seconds = Some(
                purge_seconds
                    .map(|current| current.min(pattern.purge_seconds))
                    .unwrap_or(pattern.purge_seconds),
            );

            masked = pattern.regex.replace_all(&masked, |caps: &regex::Captures| {
                let full = &caps[0];
                if full.starts_with("-----BEGIN") {
                    "-----BEGIN PRIVATE KEY-----\n[MASKED ENCRYPTED CERTIFICATE PAYLOAD]\n-----END PRIVATE KEY-----".to_string()
                } else if full.len() > 8 {
                    let prefix = &full[..4];
                    format!("{}••••••••••••", prefix)
                } else {
                    "••••••••••••".to_string()
                }
            }).into_owned();
        }
    }

    // Check Credit Cards with Luhn validation
    for m in CREDIT_CARD_REGEX.find_iter(content) {
        let match_str = m.as_str();
        if is_valid_luhn(match_str) {
            if !detected_types.iter().any(|t| t == "Credit Card") {
                detected_types.push("Credit Card".to_string());
            }
            purge_seconds = Some(
                purge_seconds
                    .map(|current| current.min(60))
                    .unwrap_or(60),
            );

            let clean: String = match_str.chars().filter(|c| c.is_ascii_digit()).collect();
            let masked_cc = if clean.len() >= 8 {
                let first4 = &clean[..4];
                let last4 = &clean[clean.len() - 4..];
                format!("{} •••• •••• {}", first4, last4)
            } else {
                "•••• •••• •••• ••••".to_string()
            };
            masked = masked.replace(match_str, &masked_cc);
        }
    }

    let is_secret = !detected_types.is_empty();

    // Create a 1-line clean preview text (up to 120 chars)
    let preview_source = if is_secret { &masked } else { content };
    let preview_text: String = preview_source
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(120)
        .collect();

    SecretScanResult {
        is_secret,
        secret_types: detected_types,
        masked_content: masked,
        preview_text,
        default_purge_seconds: purge_seconds,
    }
}

pub const SENSITIVE_PROCESSES: &[&str] = &[
    "1password.exe",
    "1password",
    "bitwarden.exe",
    "bitwarden",
    "keepass.exe",
    "keepassxc.exe",
    "keepassxc",
    "lastpass.exe",
    "dashlane.exe",
    "nordpass.exe",
    "protonpass.exe",
    "proton pass.exe",
    "authy.exe",
    "enpass.exe",
    "roboform.exe",
];

pub fn is_sensitive_process(process_name: &str) -> bool {
    let lower = process_name.to_lowercase();
    SENSITIVE_PROCESSES
        .iter()
        .any(|&p| lower == p || lower.ends_with(p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aws_detection() {
        let text = "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
        let res = scan_and_mask(text);
        assert!(res.is_secret);
        assert!(res.secret_types.contains(&"AWS Access Key".to_string()));
        assert!(res.masked_content.contains("AKIA••••••••••••"));
    }

    #[test]
    fn test_github_token_detection() {
        let text = "git push https://ghp_0123456789abcdefghijklmnopqrstuvwxyz@github.com";
        let res = scan_and_mask(text);
        assert!(res.is_secret);
        assert!(res.secret_types.contains(&"GitHub Token".to_string()));
        assert!(res.masked_content.contains("ghp_••••••••••••"));
    }

    #[test]
    fn test_openai_key_detection() {
        let text = "OPENAI_API_KEY=sk-proj-999999999999999999999999999999999999";
        let res = scan_and_mask(text);
        assert!(res.is_secret);
        assert!(res.secret_types.contains(&"OpenAI API Key".to_string()));
        assert!(res.masked_content.contains("sk-p••••••••••••"));
    }

    #[test]
    fn test_luhn_credit_card() {
        let valid_card = "4532015112830366";
        assert!(is_valid_luhn(valid_card));
        let res = scan_and_mask(&format!("Payment card: {valid_card}"));
        assert!(res.is_secret);
        assert!(res.secret_types.contains(&"Credit Card".to_string()));
        assert!(res.masked_content.contains("4532 •••• •••• 0366"));
    }

    #[test]
    fn test_regular_text_no_false_positive() {
        let text = "const count = 42; function calculateTotal(items) { return items.reduce((a, b) => a + b, 0); }";
        let res = scan_and_mask(text);
        assert!(!res.is_secret);
        assert!(res.secret_types.is_empty());
        assert_eq!(res.masked_content, text);
    }
}
