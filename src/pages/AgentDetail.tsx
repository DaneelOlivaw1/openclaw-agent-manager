import { useParams } from "react-router-dom";
import { useAgentsStore } from "@/stores/agents-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileEditor } from "@/components/FileEditor";
import { SkillsPanel } from "@/components/SkillsPanel";
import { McpEditor } from "@/components/McpEditor";

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === id));

  if (!agent) {
    return (
      <div className="text-muted-foreground">
        Agent not found. <a href="#/agents" className="underline">Back to agents</a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{agent.name || agent.identity?.name || agent.id}</h1>
      <p className="text-sm text-muted-foreground mb-4">{agent.id}</p>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="mt-4">
          <FileEditor agentId={agent.id} />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsPanel agentId={agent.id} />
        </TabsContent>
        <TabsContent value="mcp" className="mt-4">
          <McpEditor agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}