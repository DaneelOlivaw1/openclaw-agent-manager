import { useState, useEffect, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import { skills as api, type SkillInfo } from "@/lib/tauri-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react";

interface Props {
  agentId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  "openclaw-bundled": "Bundled",
  "openclaw-managed": "Managed",
  "openclaw-workspace": "Workspace",
  "openclaw-extra": "Extra",
  "openclaw-plugin": "Plugin",
};

function isUserSkill(skill: SkillInfo): boolean {
  return skill.source !== "openclaw-bundled";
}

// ─── Skill File Editor ───────────────────────────────────────

function SkillFileEditor({
  skill,
  onBack,
}: {
  skill: SkillInfo;
  onBack: () => void;
}) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .fileGet(skill.filePath)
      .then((c) => {
        setContent(c);
        setOriginalContent(c);
      })
      .catch((e) => {
        toast.error(`Failed to load skill file: ${e}`);
      })
      .finally(() => setLoading(false));
  }, [skill.filePath]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.fileSet(skill.filePath, content);
      setOriginalContent(content);
      toast.success("Skill file saved");
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [skill.filePath, content]);

  const isDirty = content !== originalContent;

  return (
    <div className="flex flex-col h-[calc(100vh-260px)]">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <span className="text-sm font-medium truncate">
            {skill.emoji && <span className="mr-1">{skill.emoji}</span>}
            {skill.name}
          </span>
          <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[300px]">
            {skill.filePath}
          </code>
        </div>
        <Button size="sm" onClick={save} disabled={!isDirty || saving} className="h-7">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="flex-1" />
      ) : (
        <div className="flex-1 overflow-hidden" data-color-mode="dark">
          <MDEditor
            value={content}
            onChange={(v) => setContent(v || "")}
            height="100%"
            preview="edit"
          />
        </div>
      )}
    </div>
  );
}

// ─── Skill Card ──────────────────────────────────────────────

function SkillCard({
  skill,
  onToggle,
  onRefresh,
  onEdit,
}: {
  skill: SkillInfo;
  onToggle: (skillKey: string, enabled: boolean) => Promise<void>;
  onRefresh: () => void;
  onEdit: (skill: SkillInfo) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [envEdits, setEnvEdits] = useState<Record<string, string>>({});
  const [savingEnv, setSavingEnv] = useState(false);

  const userOwned = isUserSkill(skill);
  const sourceLabel = SOURCE_LABELS[skill.source] ?? skill.source;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(skill.skillKey, skill.disabled);
      onRefresh();
    } finally {
      setToggling(false);
    }
  };

  const handleSaveEnv = async () => {
    if (Object.keys(envEdits).length === 0) return;
    setSavingEnv(true);
    try {
      await api.update({ skillKey: skill.skillKey, env: envEdits });
      setEnvEdits({});
      onRefresh();
      toast.success("Environment saved");
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    } finally {
      setSavingEnv(false);
    }
  };

  return (
    <Card className={skill.disabled ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {userOwned && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="shrink-0 p-0.5 rounded hover:bg-muted"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <CardTitle className="text-sm truncate">
              {skill.emoji && <span className="mr-1">{skill.emoji}</span>}
              {skill.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {sourceLabel}
            </Badge>
            {!skill.disabled && skill.eligible && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
            )}
            {!skill.disabled && !skill.eligible && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Ineligible</Badge>
            )}
            {userOwned && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(skill)}
                  className="h-6 w-6 p-0"
                  title="Edit skill file"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Switch
                  checked={!skill.disabled}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                  className="scale-75"
                />
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>

        {skill.missing.env.length > 0 && (
          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
            Missing env: {skill.missing.env.join(", ")}
          </div>
        )}
        {skill.missing.bins.length > 0 && (
          <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
            Missing bins: {skill.missing.bins.join(", ")}
          </div>
        )}

        {skill.homepage && (
          <a
            href={skill.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-500 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Homepage
          </a>
        )}

        {expanded && userOwned && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {skill.requirements.env.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Environment Variables
                </label>
                <div className="mt-1 space-y-1.5">
                  {skill.requirements.env.map((envKey) => {
                    const isMissing = skill.missing.env.includes(envKey);
                    return (
                      <div key={envKey} className="flex items-center gap-2">
                        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded shrink-0 min-w-[120px]">
                          {envKey}
                        </code>
                        <Input
                          type="password"
                          placeholder={isMissing ? "Not set" : "Set (hidden)"}
                          value={envEdits[envKey] ?? ""}
                          onChange={(e) =>
                            setEnvEdits((prev) => ({ ...prev, [envKey]: e.target.value }))
                          }
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    );
                  })}
                </div>
                {Object.keys(envEdits).some((k) => envEdits[k] !== "") && (
                  <Button
                    size="sm"
                    onClick={handleSaveEnv}
                    disabled={savingEnv}
                    className="mt-2 h-7 text-xs"
                  >
                    {savingEnv ? "Saving..." : "Save Environment"}
                  </Button>
                )}
              </div>
            )}

            <div className="text-[11px] text-muted-foreground">
              <span className="font-medium">Path:</span>{" "}
              <code className="bg-muted px-1 py-0.5 rounded break-all">{skill.filePath}</code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Skills Panel ────────────────────────────────────────────

export function SkillsPanel({ agentId }: Props) {
  const [allSkills, setAllSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSystem, setShowSystem] = useState(false);
  const [installName, setInstallName] = useState("");
  const [editingSkill, setEditingSkill] = useState<SkillInfo | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.status(agentId);
      console.log("[SkillsPanel] loaded skills:", result.length);
      setAllSkills(result);
    } catch (e) {
      console.error("[SkillsPanel] failed to load skills:", e);
      toast.error(`Failed to load skills: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleToggle = async (skillKey: string, currentlyDisabled: boolean) => {
    try {
      await api.update({ skillKey, enabled: currentlyDisabled });
      toast.success(currentlyDisabled ? "Skill enabled" : "Skill disabled");
    } catch (e) {
      toast.error(`Failed to update: ${e}`);
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

  // ─── Editing mode ──────────────────────────────────────────

  if (editingSkill) {
    return (
      <SkillFileEditor
        skill={editingSkill}
        onBack={() => {
          setEditingSkill(null);
          fetchSkills();
        }}
      />
    );
  }

  // ─── List mode ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const userSkills = allSkills.filter(isUserSkill);
  const systemSkills = allSkills.filter((s) => !isUserSkill(s));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Skill name to install..."
          value={installName}
          onChange={(e) => setInstallName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && installSkill()}
        />
        <Button onClick={installSkill} disabled={!installName.trim()}>
          Install
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {userSkills.map((skill) => (
          <SkillCard
            key={skill.skillKey}
            skill={skill}
            onToggle={handleToggle}
            onRefresh={fetchSkills}
            onEdit={setEditingSkill}
          />
        ))}
      </div>

      {userSkills.length === 0 && (
        <div className="text-muted-foreground text-center py-6 text-sm">
          No user-configured skills. Use the input above to install one.
        </div>
      )}

      {systemSkills.length > 0 && (
        <div className="pt-2 border-t">
          <button
            onClick={() => setShowSystem(!showSystem)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSystem ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {showSystem ? "Hide" : "Show"} system skills ({systemSkills.length})
          </button>

          {showSystem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {systemSkills.map((skill) => (
                <Card key={skill.skillKey} className="opacity-70">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm truncate">
                        {skill.emoji && <span className="mr-1">{skill.emoji}</span>}
                        {skill.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Bundled
                        </Badge>
                        {skill.eligible && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
