import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Clock, 
  Globe, 
  Code, 
  Shield, 
  Sparkles,
  Trash2,
  ExternalLink,
  ChevronRight,
  Zap as ZapIcon,
  Workflow
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface AppRecord {
  id: string;
  name: string;
  description: string;
  type: string;
  status: "building" | "deployed" | "failed" | "ready";
  created_at: string;
  url?: string;
}

export default function History() {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/apps", {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await response.json();
      setApps(data.apps || []);
    } catch (error) {
      toast.error("Failed to load apps");
    } finally {
      setLoading(false);
    }
  };

  const deleteApp = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/apps/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      setApps(apps.filter((a) => a.id !== id));
      toast.success("App deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "automation": return ZapIcon;
      case "workflow": return Workflow;
      case "api": return Code;
      case "ai": return Sparkles;
      default: return Globe;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "deployed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "ready": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "building": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-red-500/20 text-red-400 border-red-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Builder
              </Button>
            </Link>
            <h1 className="font-bold text-lg">App History</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading...</div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No apps yet</h3>
            <p className="text-slate-500 mb-6">Build your first app to see it here</p>
            <Link to="/">
              <Button className="bg-violet-600 hover:bg-violet-500">
                <Sparkles className="w-4 h-4 mr-2" />
                Build App
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {apps.map((app) => {
              const Icon = getIcon(app.type);
              return (
                <Card key={app.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-violet-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{app.name}</h3>
                          <p className="text-sm text-slate-400">{app.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className={getStatusColor(app.status)}>
                              {app.status}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {app.url && (
                          <Button asChild variant="ghost" size="sm">
                            <a href={app.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        <Link to={`/deploy/${app.id}`}>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteApp(app.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
