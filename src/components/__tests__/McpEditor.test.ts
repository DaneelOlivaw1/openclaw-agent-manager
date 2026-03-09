import { describe, it, expect } from "vitest";

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

function parseToolsMd(content: string): McpServer[] {
  const servers: McpServer[] = [];
  const regex = /```json\s+(\S+)\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const config = JSON.parse(match[2]);
      servers.push({
        name: match[1],
        command: config.command || "",
        args: config.args || [],
        env: config.env || {},
      });
    } catch {
      // skip
    }
  }
  return servers;
}

function serializeMcpSection(servers: McpServer[]): string {
  let md = "## MCP Servers\n\n";
  for (const server of servers) {
    const config = { command: server.command, args: server.args, env: server.env };
    md += "```json " + server.name + "\n" + JSON.stringify(config, null, 2) + "\n```\n\n";
  }
  return md;
}

describe("MCP TOOLS.md parsing", () => {
  it("parses valid MCP server config", () => {
    const content = `## MCP Servers

\`\`\`json my-server
{
  "command": "npx",
  "args": ["-y", "@some/pkg"],
  "env": { "API_KEY": "test123" }
}
\`\`\`
`;
    const servers = parseToolsMd(content);
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe("my-server");
    expect(servers[0].command).toBe("npx");
    expect(servers[0].args).toEqual(["-y", "@some/pkg"]);
    expect(servers[0].env.API_KEY).toBe("test123");
  });

  it("skips malformed JSON", () => {
    const content = `\`\`\`json broken
{ not valid json
\`\`\``;
    const servers = parseToolsMd(content);
    expect(servers).toHaveLength(0);
  });

  it("parses multiple servers", () => {
    const content = `\`\`\`json server-a
{"command":"cmd-a","args":[],"env":{}}
\`\`\`

\`\`\`json server-b
{"command":"cmd-b","args":["--flag"],"env":{"K":"V"}}
\`\`\``;
    const servers = parseToolsMd(content);
    expect(servers).toHaveLength(2);
    expect(servers[0].name).toBe("server-a");
    expect(servers[1].name).toBe("server-b");
    expect(servers[1].args).toEqual(["--flag"]);
  });

  it("round-trips serialize → parse", () => {
    const original = [
      { name: "test-srv", command: "node", args: ["server.js"], env: { PORT: "3000" } },
    ];
    const serialized = serializeMcpSection(original);
    const parsed = parseToolsMd(serialized);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(original[0]);
  });

  it("handles empty args and env", () => {
    const content = `\`\`\`json minimal
{"command":"echo"}
\`\`\``;
    const servers = parseToolsMd(content);
    expect(servers).toHaveLength(1);
    expect(servers[0].args).toEqual([]);
    expect(servers[0].env).toEqual({});
  });
});
