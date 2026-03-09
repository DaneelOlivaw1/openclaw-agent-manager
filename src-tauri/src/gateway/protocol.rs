use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Outgoing request frame
#[derive(Debug, Clone, Serialize)]
pub struct RequestFrame {
    #[serde(rename = "type")]
    pub frame_type: String, // always "req"
    pub id: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

impl RequestFrame {
    pub fn new(id: String, method: String, params: Option<Value>) -> Self {
        Self {
            frame_type: "req".to_string(),
            id,
            method,
            params,
        }
    }
}

/// Error shape from server
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ErrorShape {
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub details: Option<Value>,
    #[serde(default)]
    pub retryable: Option<bool>,
}

/// Incoming response frame
#[derive(Debug, Clone, Deserialize)]
pub struct ResponseFrame {
    pub id: String,
    pub ok: bool,
    #[serde(default)]
    pub payload: Option<Value>,
    #[serde(default)]
    pub error: Option<ErrorShape>,
}

/// Incoming event frame (server-push)
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EventFrame {
    pub event: String,
    #[serde(default)]
    pub payload: Option<Value>,
    #[serde(default)]
    pub seq: Option<u64>,
}

/// Discriminated union for ALL incoming messages
/// The "type" field discriminates: "res" = response, "event" = event
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum IncomingFrame {
    #[serde(rename = "res")]
    Response(ResponseFrame),
    #[serde(rename = "event")]
    Event(EventFrame),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_response() {
        let json = r#"{"type":"res","id":"abc","ok":true,"payload":{"agents":[]}}"#;
        let msg: IncomingFrame = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, IncomingFrame::Response(_)));
        if let IncomingFrame::Response(r) = msg {
            assert!(r.ok);
            assert_eq!(r.id, "abc");
        }
    }

    #[test]
    fn parse_event() {
        let json = r#"{"type":"event","event":"chat","payload":{"runId":"r1","sessionKey":"s1","seq":1,"state":"delta"}}"#;
        let msg: IncomingFrame = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, IncomingFrame::Event(_)));
        if let IncomingFrame::Event(e) = msg {
            assert_eq!(e.event, "chat");
        }
    }

    #[test]
    fn parse_challenge() {
        let json = r#"{"type":"event","event":"connect.challenge","payload":{"nonce":"abc-123","ts":1234567890}}"#;
        let msg: IncomingFrame = serde_json::from_str(json).unwrap();
        if let IncomingFrame::Event(e) = msg {
            assert_eq!(e.event, "connect.challenge");
            let nonce = e.payload.as_ref().unwrap()["nonce"].as_str().unwrap();
            assert_eq!(nonce, "abc-123");
        }
    }

    #[test]
    fn parse_error_response() {
        let json = r#"{"type":"res","id":"x","ok":false,"error":{"code":"INVALID_REQUEST","message":"bad params"}}"#;
        let msg: IncomingFrame = serde_json::from_str(json).unwrap();
        if let IncomingFrame::Response(r) = msg {
            assert!(!r.ok);
            assert_eq!(r.error.unwrap().code, "INVALID_REQUEST");
        }
    }

    #[test]
    fn serialize_request() {
        let req = RequestFrame::new("test-id".into(), "agents.list".into(), None);
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""type":"req""#));
        assert!(json.contains("agents.list"));
    }
}
