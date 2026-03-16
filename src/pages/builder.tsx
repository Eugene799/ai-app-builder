import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Code, 
  Globe, 
  Database, 
  Shield, 
  Rocket, 
  CheckCircle, 
  Loader2,
  ChevronRight,
  Copy,
  Download,
  Terminal,
  Layers,
  Zap,
  History,
  Wand2,
  Settings,
  CreditCard,
  LogOut,
  Workflow,
  Zap as ZapIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { ModelSelector } from "@/components/model-selector";
import { downloadFilesAsZip } from "@/lib/zip-utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type BuildStep = "input" | "generating" | "review" | "deploying" | "complete";
type AppType = "web" | "api" | "automation" | "workflow";
type DatabaseType = "sqlite" | "postgresql" | "none";

interface AppConfig {
  type: AppType;
  database: DatabaseType;
  auth: boolean;
  aiFeatures: boolean;
}

interface GeneratedApp {
  id: string;
  name: string;
  description: string;
  files: Array<{ path: string; content: string }>;
  dependencies: string[];
  envVars: string[];
  port: number;
  deployCommand: string;
}

export default function Builder() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<BuildStep>("input");
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState<AppConfig>({
    type: "web",
    database: "sqlite",
    auth: false,
    aiFeatures: false,
  });
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [generatedApp, setGeneratedApp] = useState<GeneratedApp | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchConnectors();
  }, []);

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setProfile(data.profile);
    }
  };

  const fetchConnectors = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/connectors", {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setConnectors(data.connectors || []);
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const generateApp = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe your app");
      return;
    }

    if (!profile || profile.credits < 1) {
      toast.error("Insufficient credits. Please purchase more credits.");
      return;
    }

    setStep("generating");
    setLogs([]);
    addLog("Initializing AI code generation...");
    addLog(`App type: ${config.type}`);
    addLog(`Database: ${config.database}`);
    addLog(`AI Model: ${selectedModel} (${selectedProvider})`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          prompt, 
          config,
          provider: selectedProvider,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      setGeneratedApp(data.app);
      if (data.app.files.length > 0) setSelectedFile(data.app.files[0].path);
      addLog(`Generated ${data.app.files.length} files`);
      addLog(`App ID: ${data.app.id}`);
      setStep("review");
      toast.success("App generated successfully!");
      fetchProfile(); // Update credits
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
      toast.error(error.message);
      setStep("input");
    }
  };

  const buyCredits = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("Failed to initiate checkout");
    }
  };

  const deployApp = async () => {
    if (!generatedApp) return;

    setStep("deploying");
    addLog("Starting deployment...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ appId: generatedApp.id }),
      });

      if (!response.ok) throw new Error("Deployment failed");

      const data = await response.json();
      addLog(`Deployed to: ${data.url}`);
      setStep("complete");
      toast.success("App deployed!");
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
      toast.error("Deployment failed");
      setStep("review");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const downloadFiles = async () => {
    if (!generatedApp) return;
    addLog("Downloading source files...");
    await downloadFilesAsZip(generatedApp.name, generatedApp.files);
    toast.success("Download started");
  };

  const examples = [
    "A Slack bot that summarizes GitHub PRs",
    "A Discord bot that alerts on Twitter mentions",
    "A Notion automation to sync with Slack",
    "A GitHub action that posts to Discord",
    "An AI workflow that cleans up Notion databases",
    "An automation that cross-posts from Twitter to Slack",
  ];

  const getFileLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx': return 'tsx';
      case 'js':
      case 'jsx': return 'jsx';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'py': return 'python';
      default: return 'javascript';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">AutoAI</h1>
              <p className="text-xs text-slate-400">Automation & Workflow Builder</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 mr-4">
              <Link to="/history">
                <Button variant="ghost" size="sm" className="gap-2">
                  <History className="w-4 h-4" />
                  History
                </Button>
              </Link>
              <Link to="/connectors">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Connectors
                </Button>
              </Link>
              <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
                <CreditCard className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-medium">{profile?.credits ?? 0} Credits</span>
                <button onClick={buyCredits} className="text-[10px] bg-violet-600 px-1.5 py-0.5 rounded hover:bg-violet-500 transition-colors">
                  Buy
                </button>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {step === "input" && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                What automation should we build?
              </h2>
              <p className="text-slate-400 text-lg">
                Describe your workflow and AI will connect your favorite platforms
              </p>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Describe your workflow</label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="When a new PR is opened on GitHub, send a summary to Slack..."
                    className="min-h-[120px] bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "automation", icon: ZapIcon, label: "Auto" },
                        { key: "workflow", icon: Workflow, label: "Flow" },
                        { key: "web", icon: Globe, label: "Web" },
                        { key: "api", icon: Code, label: "API" },
                      ].map(({ key, icon: Icon, label }) => (
                        <button
                          key={key}
                          onClick={() => setConfig((c) => ({ ...c, type: key as AppType }))}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                            config.type === key
                              ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                              : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <ModelSelector 
                    value={selectedModel} 
                    onChange={(m, p) => {
                      setSelectedModel(m);
                      setSelectedProvider(p);
                    }} 
                  />

                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Database</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: "sqlite", label: "SQLite" },
                        { key: "postgresql", label: "PostgreSQL" },
                        { key: "none", label: "None" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setConfig((c) => ({ ...c, database: key as DatabaseType }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                            config.database === key
                              ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                              : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                          }`}
                        >
                          <Database className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Connected Services</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 min-h-[82px]">
                      {connectors.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {connectors.map(c => (
                            <Badge key={c.provider} variant="secondary" className="capitalize bg-slate-800 text-slate-300">
                              {c.provider}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-[10px] text-slate-600 mb-2">No connectors linked</p>
                          <Link to="/connectors">
                            <Button variant="outline" size="xs" className="h-6 text-[10px]">Link Services</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={generateApp}
                  disabled={!prompt.trim() || (profile && profile.credits < 1)}
                  className="w-full h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-lg font-semibold"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate Automation (1 Credit)
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <p className="text-sm text-slate-500 text-center">Try these examples:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    onClick={() => setPrompt(example)}
                    className="px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(step === "generating" || step === "deploying") && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                  {step === "generating" ? "Generating your app..." : "Deploying your app..."}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-lg bg-slate-950 p-4 font-mono text-sm">
                  {logs.map((log, i) => (
                    <div key={i} className="text-slate-400 py-0.5">
                      <span className="text-violet-500">➜</span> {log}
                    </div>
                  ))}
                  <div className="animate-pulse text-violet-500">▋</div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "review" && generatedApp && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg">{generatedApp.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-400">{generatedApp.description}</p>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Files</p>
                    <p className="text-2xl font-bold">{generatedApp.files.length}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Dependencies</p>
                    <div className="flex flex-wrap gap-1">
                      {generatedApp.dependencies.slice(0, 5).map((dep) => (
                        <Badge key={dep} variant="outline" className="text-xs">
                          {dep}
                        </Badge>
                      ))}
                      {generatedApp.dependencies.length > 5 && (
                        <Badge variant="outline">+{generatedApp.dependencies.length - 5}</Badge>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-slate-800" />

                  <div className="flex gap-2">
                    <Button onClick={deployApp} className="flex-1 bg-violet-600 hover:bg-violet-500">
                      <Rocket className="w-4 h-4 mr-2" />
                      Deploy Now
                    </Button>
                    <Button variant="outline" onClick={downloadFiles} className="border-slate-700">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-sm">Environment Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {generatedApp.envVars.map((env) => (
                      <div key={env} className="flex items-center justify-between text-sm">
                        <code className="text-violet-400">{env}</code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(env)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="bg-slate-900/50 border-slate-800 h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Source Code
                  </CardTitle>
                  <div className="flex gap-2">
                    {generatedApp.files.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file.path)}
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${
                          selectedFile === file.path
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-slate-950 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {file.path.split("/").pop()}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px] w-full bg-slate-950">
                    <SyntaxHighlighter
                      language={selectedFile ? getFileLanguage(selectedFile) : 'javascript'}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '1.5rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        background: 'transparent',
                      }}
                      showLineNumbers={true}
                    >
                      {selectedFile
                        ? generatedApp.files.find((f) => f.path === selectedFile)?.content || ""
                        : generatedApp.files[0]?.content || ""}
                    </SyntaxHighlighter>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "complete" && generatedApp && (
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2">Automation Deployed!</h2>
              <p className="text-slate-400">Your automation is now live and ready to use</p>
            </div>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg">
                  <code className="text-violet-400">https://{generatedApp.id}.autoai.space</code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`https://${generatedApp.id}.autoai.space`)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-4 justify-center">
              <Button asChild className="bg-violet-600 hover:bg-violet-500">
                <a href={`https://${generatedApp.id}.autoai.space`} target="_blank" rel="noopener noreferrer">
                  <Globe className="w-4 h-4 mr-2" />
                  Open App
                </a>
              </Button>
              <Button variant="outline" onClick={() => setStep("input")} className="border-slate-700">
                <Sparkles className="w-4 h-4 mr-2" />
                Build Another
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
