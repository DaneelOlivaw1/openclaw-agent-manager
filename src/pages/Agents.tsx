import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAgentsStore } from "@/stores/agents-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function Agents() {
  const { agents, loading, error, fetch } = useAgentsStore();

  useEffect(() => { fetch(); }, [fetch]);

  if (error) return <div className="text-destructive">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Agents</h1>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Link key={agent.id} to={`/agents/${agent.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>ID: <code className="text-xs bg-muted px-1 rounded">{agent.id}</code></div>
                    <div>Model: <Badge variant="outline">{agent.model}</Badge></div>
                    {agent.workspace && <div className="truncate">Workspace: {agent.workspace}</div>}
                    {agent.status && <div>Status: <Badge variant="secondary">{agent.status}</Badge></div>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {agents.length === 0 && (
            <div className="text-muted-foreground col-span-full text-center py-8">
              No agents found. Make sure the Gateway is running.
            </div>
          )}
        </div>
      )}
    </div>
  );
}