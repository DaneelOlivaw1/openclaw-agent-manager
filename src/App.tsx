import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Config } from "./pages/Config";
import { Cron } from "./pages/Cron";
import { Chat } from "./pages/Chat";

export default function App() {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<ErrorBoundary><Agents /></ErrorBoundary>} />
          <Route path="/agents/:id" element={<ErrorBoundary><AgentDetail /></ErrorBoundary>} />
          <Route path="/config" element={<ErrorBoundary><Config /></ErrorBoundary>} />
          <Route path="/cron" element={<ErrorBoundary><Cron /></ErrorBoundary>} />
          <Route path="/chat" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
          <Route path="/chat/:sessionKey" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
