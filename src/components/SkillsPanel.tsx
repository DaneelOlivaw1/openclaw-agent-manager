import { useState, useEffect } from "react";
import { skills as api, type SkillInfo } from "@/lib/tauri-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

export function SkillsPanel({ agentId }: Props) {
  const [skillList, setSkillList] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [installName, setInstallName] = useState("");

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const result = await api.status(agentId);
      setSkillList(result);
    } catch (e) {
      toast.error(`Failed to load skills: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSkills(); }, [agentId]);

  const toggleSkill = async (skill: SkillInfo) => {
    try {
      await api.update(agentId, { name: skill.name, enabled: !skill.enabled });
      await fetchSkills();
      toast.success(`${skill.name} ${skill.enabled ? "disabled" : "enabled"}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const installSkill = async () => {
    if (!installName.trim()) return;
    try {
      await api.install(agentId, installName.trim());
      setInstallName("");
      await fetchSkills();
      toast.success(`Installed ${installName}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Skill name to install..."
          value={installName}
          onChange={(e) => setInstallName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && installSkill()}
        />
        <Button onClick={installSkill} disabled={!installName.trim()}>Install</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {skillList.map((skill) => (
          <Card key={skill.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{skill.name}</CardTitle>
                <Switch checked={skill.enabled} onCheckedChange={() => toggleSkill(skill)} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{skill.description}</p>
              {skill.apiKey !== undefined && (
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground">API Key</label>
                  <Input
                    value={skill.apiKey || ""}
                    className="text-xs mt-1"
                    placeholder="API key..."
                    type="password"
                    onChange={() => {/* TODO: save on blur */}}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
