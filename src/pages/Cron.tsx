import { useEffect } from "react";
import { useCronStore } from "@/stores/cron-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function Cron() {
  const { jobs, loading, error, fetch, run, remove } = useCronStore();

  useEffect(() => { fetch(); }, [fetch]);

  const handleRun = async (cronId: string) => {
    try {
      await run(cronId);
      toast.success("Cron job triggered");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleRemove = async (cronId: string) => {
    if (!confirm("Remove this cron job?")) return;
    try {
      await remove(cronId);
      toast.success("Cron job removed");
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (error) return <div className="text-destructive">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cron Jobs</h1>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{job.name}</CardTitle>
                  <Badge variant={job.enabled ? "default" : "secondary"}>
                    {job.enabled ? "Active" : "Paused"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Schedule: <code className="bg-muted px-1 rounded">{job.schedule}</code></div>
                  <div>Agent: {job.agentId}</div>
                  {job.lastRun && <div>Last run: {job.lastRun}</div>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => handleRun(job.id)}>
                    <Play className="h-3 w-3 mr-1" /> Run
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(job.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {jobs.length === 0 && (
            <div className="text-muted-foreground col-span-full text-center py-8">
              No cron jobs found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}