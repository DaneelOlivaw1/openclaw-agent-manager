import { useState, useEffect } from "react";
import { git, type CommitInfo, type DiffInfo } from "@/lib/tauri-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Props {
  workspace: string;
}

export function HistoryPanel({ workspace }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    git.log(workspace, 50).then((c) => {
      setCommits(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [workspace]);

  useEffect(() => {
    if (selectedCommit) {
      git.diff(workspace, undefined, selectedCommit).then(setDiffs).catch(() => setDiffs([]));
    }
  }, [workspace, selectedCommit]);

  const rollback = async (commitId: string) => {
    if (!confirm("Rollback to this commit? Current changes will be lost.")) return;
    try {
      await git.checkout(workspace, commitId);
      const updated = await git.log(workspace, 50);
      setCommits(updated);
      toast.success("Rolled back successfully");
    } catch (e) {
      toast.error(`Rollback failed: ${e}`);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="flex gap-4 h-[calc(100vh-260px)]">
      <ScrollArea className="w-72 shrink-0 border rounded-md">
        <div className="p-2 space-y-1">
          {commits.map((commit) => (
            <button
              key={commit.id}
              onClick={() => setSelectedCommit(commit.id)}
              className={`w-full text-left px-2 py-2 rounded text-sm ${
                selectedCommit === commit.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              <div className="font-medium truncate">{commit.message}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(commit.timestamp * 1000).toLocaleString()}
              </div>
            </button>
          ))}
          {commits.length === 0 && (
            <div className="text-muted-foreground text-sm p-2">No commits yet</div>
          )}
        </div>
      </ScrollArea>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedCommit ? (
          <>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-sm font-medium truncate">
                {commits.find((c) => c.id === selectedCommit)?.message}
              </span>
              <Button size="sm" variant="destructive" onClick={() => rollback(selectedCommit)}>
                Rollback
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                {diffs.map((d) => (
                  <div key={d.filename} className="mb-4">
                    <div className="font-bold text-primary mb-1">{d.filename}</div>
                    {d.patch.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith("+") ? "text-green-400 bg-green-400/10" :
                          line.startsWith("-") ? "text-red-400 bg-red-400/10" :
                          "text-muted-foreground"
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ))}
                {diffs.length === 0 && <span className="text-muted-foreground">No changes in this commit</span>}
              </pre>
            </ScrollArea>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a commit to view changes
          </div>
        )}
      </div>
    </div>
  );
}
