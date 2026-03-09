use std::path::Path;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::pkcs8::DecodePrivateKey;
use ed25519_dalek::{Signer, SigningKey};

pub struct DeviceIdentity {
    pub device_id: String,
    pub public_key_pem: String,
    pub private_key_pem: String,
}

pub fn load_device_identity(home: &Path) -> Option<DeviceIdentity> {
    let path = home.join("identity").join("device.json");
    let raw = std::fs::read_to_string(&path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&raw).ok()?;

    let device_id = val.get("deviceId")?.as_str()?.to_string();
    let public_key_pem = val.get("publicKeyPem")?.as_str()?.to_string();
    let private_key_pem = val.get("privateKeyPem")?.as_str()?.to_string();

    Some(DeviceIdentity {
        device_id,
        public_key_pem,
        private_key_pem,
    })
}

pub fn build_device_auth_payload(
    device_id: &str,
    client_id: &str,
    client_mode: &str,
    role: &str,
    scopes: &[&str],
    signed_at_ms: u64,
    token: &str,
    nonce: Option<&str>,
) -> String {
    let version = if nonce.is_some() { "v2" } else { "v1" };
    let scopes_joined = scopes.join(",");
    let mut payload = format!(
        "{version}|{device_id}|{client_id}|{client_mode}|{role}|{scopes_joined}|{signed_at_ms}|{token}"
    );
    if let Some(n) = nonce {
        payload.push('|');
        payload.push_str(n);
    }
    payload
}

pub fn sign_payload(private_key_pem: &str, payload: &str) -> String {
    let signing_key =
        SigningKey::from_pkcs8_pem(private_key_pem).expect("invalid Ed25519 private key PEM");
    let signature = signing_key.sign(payload.as_bytes());
    URL_SAFE_NO_PAD.encode(signature.to_bytes())
}

/// Extract the raw 32-byte Ed25519 public key from SPKI PEM and base64url-encode it.
/// SPKI wrapping for Ed25519 has a 12-byte prefix: 302a300506032b6570032100
pub fn public_key_raw_base64url(public_key_pem: &str) -> String {
    let pem_body: String = public_key_pem
        .lines()
        .filter(|line| !line.starts_with("-----"))
        .collect();
    let der = base64::engine::general_purpose::STANDARD
        .decode(pem_body)
        .expect("invalid base64 in public key PEM");
    let raw_key = &der[12..];
    URL_SAFE_NO_PAD.encode(raw_key)
}
