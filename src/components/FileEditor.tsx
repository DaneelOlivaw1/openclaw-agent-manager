import { useState, useEffect, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import { agents as api } from "@/lib/tauri-api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Props {
  agentId: string;
  workspace?: string;
}

export function FileEditor({ agentId, workspace }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    setLoadingFiles(true);
    api.filesList(agentId).then((f) => {
      setFiles(f);
      setLoadingFiles(false);
    }).catch(() => setLoadingFiles(false));
  }, [agentId]);

  useEffect(() => {
    if (selectedFile) {
      setLoadingContent(true);
      api.fileGet(agentId, selectedFile).then((c) => {
        setContent(c);
        setOriginalContent(c);
        setLoadingContent(false);
      }).catch(() => setLoadingContent(false));
    }
  }, [agentId, selectedFile]);

  const save = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.fileSet(agentId, selectedFile, content, workspace);
      setOriginalContent(content);
      toast.success(`${selectedFile} saved`);
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [agentId, selectedFile, content, workspace]);

  const isDirty = content !== originalContent;

  return (
    <div className="flex gap-4 h-[calc(100vh-260px)]">
      <ScrollArea className="w-48 shrink-0 border rounded-md">
        <div className="p-2 space-y-1">
          {loadingFiles ? (
            <>
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </>
          ) : files.map((file) => (
            <button
              key={file}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${
                selectedFile === file ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              {file}
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-sm font-medium truncate">{selectedFile}</span>
              <Button size="sm" onClick={save} disabled={!isDirty || saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            {loadingContent ? (
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
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}
