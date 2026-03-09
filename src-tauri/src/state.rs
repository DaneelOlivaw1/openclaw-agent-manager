use std::sync::Arc;
use tokio::sync::RwLock;

use crate::gateway::client::GatewayClient;

pub struct AppState {
    pub gateway: Arc<RwLock<Option<GatewayClient>>>,
}
