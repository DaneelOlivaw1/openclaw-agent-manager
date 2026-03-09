use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Outgoing request envelope
#[derive(Debug, Clone, Serialize)]
pub struct GatewayRequest {
    pub id: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// Incoming response envelope
#[derive(Debug, Clone, Deserialize)]
pub struct GatewayResponse {
    pub id: String,
    #[serde(default)]
    pub result: Option<Value>,
    #[serde(default)]
    pub error: Option<GatewayError>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GatewayError {
    pub code: i32,
    pub message: String,
}

/// Server-push broadcast message
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GatewayBroadcast {
    pub method: String,
    pub params: Value,
}

/// Union type for parsing incoming WS messages
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum IncomingMessage {
    Response(GatewayResponse),
    Broadcast(GatewayBroadcast),
}

/// Chat broadcast event payload
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatEvent {
    pub run_id: String,
    pub agent_id: String,
    pub state: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub message: Option<Value>,
    #[serde(default)]
    pub session_key: Option<String>,
}

/// Agent info from agents.list
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub model: String,
    #[serde(default)]
    pub workspace: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

/// Config response from config.get
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConfigResponse {
    pub config: Value,
    pub hash: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_response() {
        let json = r#"{"id":"abc","result":{"agents":[]}}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, IncomingMessage::Response(_)));
    }

    #[test]
    fn parse_broadcast() {
        let json = r#"{"method":"chat","params":{"runId":"r1","agentId":"a1","state":"delta","text":"hi"}}"#;
        let msg: IncomingMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, IncomingMessage::Broadcast(_)));
    }

    #[test]
    fn serialize_request() {
        let req = GatewayRequest {
            id: "test-id".into(),
            method: "agents.list".into(),
            params: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("agents.list"));
        assert!(!json.contains("params"));
    }
}
