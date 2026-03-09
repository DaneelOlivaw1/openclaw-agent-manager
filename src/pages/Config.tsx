import { useState, useEffect } from "react";
import { useConfigStore } from "@/stores/config-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function Config() {
  const { raw, loading, saving, error, fetch, save } = useConfigStore();
  const [localRaw, setLocalRaw] = useState("");

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { setLocalRaw(raw); }, [raw]);

  const handleSave = async () => {
    if (saving || localRaw === raw) return;
    const result = await save(localRaw);
    if (result.success) {
      toast.success("Config saved");
    } else if (result.conflict) {
      toast.error("Config was modified externally. Reloaded latest version.");
    } else {
      toast.error("Failed to save config");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [localRaw, raw, saving, save]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-[500px]" /></div>;
  if (error) return <div className="text-destructive">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetch()}>Reload</Button>
          <Button onClick={handleSave} disabled={saving || localRaw === raw}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <Textarea
        value={localRaw}
        onChange={(e) => setLocalRaw(e.target.value)}
        className="font-mono text-sm min-h-[calc(100vh-200px)] resize-none"
        spellCheck={false}
      />
    </div>
  );
}