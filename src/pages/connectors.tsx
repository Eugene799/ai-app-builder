import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Github, 
  Slack, 
  MessageSquare, 
  Twitter, 
  BookOpen, 
  Trash2, 
  Plus, 
  History as HistoryIcon, 
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const PROVIDERS = [
  { id: "github", name: "GitHub", icon: Github, color: "bg-slate-800" },
  { id: "slack", name: "Slack", icon: Slack, color: "bg-purple-600" },
  { id: "discord", name: "Discord", icon: MessageSquare, color: "bg-indigo-600" },
  { id: "twitter", name: "Twitter/X", icon: Twitter, color: "bg-blue-400" },
  { id: "notion", name: "Notion", icon: BookOpen, color: "bg-slate-200 text-slate-900" },
];

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const fetchConnectors = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/connectors", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      const data = await response.json();
      setConnectors(data.connectors || []);
    } catch (error) {
      toast.error("Failed to fetch connectors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const handleAddConnector = async () => {
    if (!apiKey) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/connectors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          provider: addingProvider,
          apiKey,
          metadata: { added_at: new Date().toISOString() }
        })
      });
      
      if (response.ok) {
        toast.success(`${addingProvider} connected successfully!`);
        setAddingProvider(null);
        setApiKey("");
        fetchConnectors();
      } else {
        throw new Error("Failed to add connector");
      }
    } catch (error) {
      toast.error("Failed to add connector");
    }
  };

  const removeConnector = async (provider: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/connectors/${provider}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      
      if (response.ok) {
        toast.success(`${provider} removed`);
        fetchConnectors();
      }
    } catch (error) {
      toast.error("Failed to remove connector");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">AutoAI</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Builder
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Connectors</h2>
          <p className="text-slate-400">Link your external platforms to enable AI automations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDERS.map((provider) => {
            const isConnected = connectors.some(c => c.provider === provider.id);
            const Icon = provider.icon;
            
            return (
              <Card key={provider.id} className="bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <div className={`w-12 h-12 rounded-lg ${provider.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription className="text-slate-500">
                      {isConnected ? "Connected" : "Not connected"}
                    </CardDescription>
                  </div>
                  {isConnected ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-500 hover:text-red-400"
                      onClick={() => removeConnector(provider.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-slate-700"
                      onClick={() => setAddingProvider(provider.id)}
                    >
                      Connect
                    </Button>
                  )}
                </CardHeader>
                {addingProvider === provider.id && (
                  <CardContent className="pt-0 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key / Access Token</Label>
                      <Input 
                        id="api-key"
                        type="password"
                        placeholder={`Enter your ${provider.name} key`}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="bg-slate-950 border-slate-800"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-violet-600 hover:bg-violet-500" onClick={handleAddConnector}>
                        Save Connector
                      </Button>
                      <Button variant="ghost" onClick={() => setAddingProvider(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
