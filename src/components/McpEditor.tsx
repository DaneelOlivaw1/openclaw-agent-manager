import { useState, useEffect, useCallback } from "react";
import { agents as api } from "@/lib/tauri-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<
    string,
    { command: string; args?: string[]; env?: Record<string, string> }
  >;
}

interface Props {
  agentId: string;
}

function parseMcpConfig(raw: string): McpServer[] {
  try {
    const config: McpConfig = JSON.parse(raw);
    const servers = config.mcpServers ?? {};
    return Object.entries(servers).map(([name, entry]) => ({
      name,
      command: entry.command ?? "",
      args: entry.args ?? [],
      env: entry.env ?? {},
    }));
  } catch {
    return [];
  }
}

function serializeMcpConfig(servers: McpServer[]): string {
  const mcpServers: McpConfig["mcpServers"] = {};
  for (const server of servers) {
    const entry: McpConfig["mcpServers"][string] = { command: server.command };
    if (server.args.length > 0) entry.args = server.args;
    if (Object.keys(server.env).length > 0) entry.env = server.env;
    mcpServers[server.name] = entry;
  }
  return JSON.stringify({ mcpServers }, null, 2) + "\n";
}

export function McpEditor({ agentId }: Props) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [originalJson, setOriginalJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .mcpGet(agentId)
      .then((raw) => {
        setOriginalJson(raw);
        setServers(parseMcpConfig(raw));
        setLoading(false);
      })
      .catch(() => {
        setOriginalJson("");
        setServers([]);
        setLoading(false);
      });
  }, [agentId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const json = serializeMcpConfig(servers);
      await api.mcpSet(agentId, json);
      setOriginalJson(json);
      toast.success("MCP config saved");
    } catch (e) {
      toast.error(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [agentId, servers]);

  const isDirty = serializeMcpConfig(servers) !== originalJson;

  const addServer = () => {
    setServers([
      ...servers,
      { name: "new-server", command: "", args: [], env: {} },
    ]);
  };

  const removeServer = (index: number) => {
    setServers(servers.filter((_, i) => i !== index));
  };

  const updateServer = (index: number, updates: Partial<McpServer>) => {
    const updated = [...servers];
    updated[index] = { ...updated[index], ...updates };
    setServers(updated);
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">MCP Servers</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addServer}>
            <Plus className="h-3 w-3 mr-1" /> Add Server
          </Button>
          <Button size="sm" onClick={save} disabled={!isDirty || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {servers.map((server, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <Input
                value={server.name}
                onChange={(e) => updateServer(i, { name: e.target.value })}
                className="font-mono text-sm"
                placeholder="server-name"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeServer(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Command</label>
              <Input
                value={server.command}
                onChange={(e) => updateServer(i, { command: e.target.value })}
                placeholder="npx"
                className="font-mono text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Args (comma-separated)
              </label>
              <Input
                value={server.args.join(", ")}
                onChange={(e) =>
                  updateServer(i, {
                    args: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="-y, @some/mcp-server"
                className="font-mono text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Environment Variables
              </label>
              {Object.entries(server.env).map(([key, value]) => (
                <div key={key} className="flex gap-2 mt-1">
                  <Input
                    value={key}
                    onChange={(e) => {
                      const newEnv = { ...server.env };
                      delete newEnv[key];
                      newEnv[e.target.value] = value;
                      updateServer(i, { env: newEnv });
                    }}
                    placeholder="KEY"
                    className="font-mono text-sm flex-1"
                  />
                  <Input
                    value={value}
                    onChange={(e) =>
                      updateServer(i, {
                        env: { ...server.env, [key]: e.target.value },
                      })
                    }
                    placeholder="value"
                    className="font-mono text-sm flex-1"
                  />
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  updateServer(i, { env: { ...server.env, "": "" } })
                }
                className="mt-1 text-xs"
              >
                + Add variable
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {servers.length === 0 && (
        <div className="text-muted-foreground text-center py-8">
          No MCP servers configured. Click "Add Server" to create one.
        </div>
      )}
    </div>
  );
}
