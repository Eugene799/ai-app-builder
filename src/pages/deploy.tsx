import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Rocket, 
  Loader2, 
  CheckCircle, 
  Globe,
  Copy,
  Terminal,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface DeployStatus {
  id: string;
  status: "pending" | "building" | "deployed" | "failed";
  logs: string[];
  url?: string;
  error?: string;
}

export default function Deploy() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/status/${id}`);
        const data = await response.json();
        setStatus(data);
        
        if (data.status === "deployed" || data.status === "failed") {
          setPolling(false);
        }
      } catch (error) {
        console.error("Poll error:", error);
      }
    };

    poll();
    if (polling) {
      const interval = setInterval(poll, 3000);
      return () => clearInterval(interval);
    }
  }, [id, polling]);

  const redeploy = async () => {
    if (!id) return;
    setPolling(true);
    
    try {
      await fetch(`/api/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: id }),
      });
      toast({ title: "Redeployment started" });
    } catch (error) {
      toast({ title: "Failed to redeploy", variant: "destructive" });
    }
  };

  const copyUrl = () => {
    if (status?.url) {
      navigator.clipboard.writeText(status.url);
      toast({ title: "URL copied" });
    }
  };

  if (!status) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/history">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to History
              </Button>
            </Link>
            <h1 className="font-bold text-lg">Deploy Status</h1>
          </div>
          <Badge 
            variant="outline" 
            className={
              status.status === "deployed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
              status.status === "failed" ? "bg-red-500/20 text-red-400 border-red-500/30" :
              "bg-amber-500/20 text-amber-400 border-amber-500/30"
            }
          >
            {status.status}
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg">Deployment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.url && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Live URL</p>
                    <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-lg">
                      <Globe className="w-4 h-4 text-violet-500" />
                      <code className="text-sm text-violet-400 flex-1 truncate">{status.url}</code>
                      <Button variant="ghost" size="sm" onClick={copyUrl}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {status.status === "deployed" && (
                  <Button asChild className="w-full bg-violet-600 hover:bg-violet-500">
                    <a href={status.url} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-4 h-4 mr-2" />
                      Open App
                    </a>
                  </Button>
                )}

                {status.status === "failed" && (
                  <Button onClick={redeploy} variant="outline" className="w-full border-slate-700">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Redeploy
                  </Button>
                )}

                {(status.status === "building" || status.status === "pending") && (
                  <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    <span className="text-sm text-amber-400">Deployment in progress...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-slate-800 h-full">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Build Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] rounded-lg bg-slate-950 p-4 font-mono text-sm">
                  {status.logs.length === 0 ? (
                    <div className="text-slate-600 italic">Waiting for logs...</div>
                  ) : (
                    status.logs.map((log, i) => (
                      <div key={i} className="text-slate-400 py-0.5">
                        <span className="text-violet-500">➜</span> {log}
                      </div>
                    ))
                  )}
                  {polling && <div className="animate-pulse text-violet-500">▋</div>}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
