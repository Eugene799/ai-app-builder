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
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { ModelSelector } from "@/components/model-selector";
import { downloadFilesAsZip } from "@/lib/zip-utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type BuildStep = "input" | "generating" | "review" | "deploying" | "complete";
type AppType = "web" | "api" | "dapp" | "ai";
type DatabaseType = "sqlite" | "postgresql" | "none";
type Blockchain = "ethereum" | "solana" | "polygon" | "none";

interface AppConfig {
  type: AppType;
  database: DatabaseType;
  blockchain: Blockchain;
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
  const [step, setStep] = useState<BuildStep>("input");
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState<AppConfig>({
    type: "web",
    database: "sqlite",
    blockchain: "none",
    auth: false,
    aiFeatures: false,
  });
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [generatedApp, setGeneratedApp] = useState<GeneratedApp | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { toast } = useToast();

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const generateApp = async () => {
    if (!prompt.trim()) {
      toast({ title: "Please describe your app", variant: "destructive" });
      return;
    }

    setStep("generating");
    setLogs([]);
    addLog("Initializing AI code generation...");
    addLog(`App type: ${config.type}`);
    addLog(`Database: ${config.database}`);
    if (config.blockchain !== "none") addLog(`Blockchain: ${config.blockchain}`);
    addLog(`AI Model: ${selectedModel} (${selectedProvider})`);

    try {
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt, 
          config,
          provider: selectedProvider,
          model: selectedModel
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      setGeneratedApp(data.app);
      if (data.app.files.length > 0) setSelectedFile(data.app.files[0].path);
      addLog(`Generated ${data.app.files.length} files`);
      addLog(`App ID: ${data.app.id}`);
      setStep("review");
      toast({ title: "App generated successfully!" });
    } catch (error) {
      addLog(`Error: ${error}`);
      toast({ title: "Generation failed", variant: "destructive" });
      setStep("input");
    }
  };

  const deployApp = async () => {
    if (!generatedApp) return;

    setStep("deploying");
    addLog("Starting deployment...");

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: generatedApp.id }),
      });

      if (!response.ok) throw new Error("Deployment failed");

      const data = await response.json();
      addLog(`Deployed to: ${data.url}`);
      setStep("complete");
      toast({ title: "App deployed!", description: data.url });
    } catch (error) {
      addLog(`Error: ${error}`);
      toast({ title: "Deployment failed", variant: "destructive" });
      setStep("review");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const downloadFiles = async () => {
    if (!generatedApp) return;
    addLog("Downloading source files...");
    await downloadFilesAsZip(generatedApp.name, generatedApp.files);
    toast({ title: "Download started" });
  };

  const examples = [
    "A voting dApp with wallet connection",
    "A crypto portfolio tracker with price alerts",
    "A task management app with real-time collaboration",
    "An AI chatbot with memory and file uploads",
    "A blog platform with markdown editing",
    "An image gallery with AI-powered search",
  ];

  const getFileLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx': return 'tsx';
      case 'js':
      case 'jsx': return 'jsx';
      case 'sol': return 'solidity';
      case 'rs': return 'rust';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'css': return 'css';
      case 'html': return 'html';
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
              <h1 className="font-bold text-lg">AI App Builder</h1>
              <p className="text-xs text-slate-400">Build & deploy full-stack apps with AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/history">
              <Button variant="ghost" size="sm" className="gap-2">
                <History className="w-4 h-4" />
                History
              </Button>
            </Link>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              <Zap className="w-3 h-3 mr-1" />
              Powered by Zo
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {step === "input" && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                What do you want to build?
              </h2>
              <p className="text-slate-400 text-lg">
                Describe your app idea and AI will generate a complete full-stack application
              </p>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Describe your app</label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="I want to build a..."
                    className="min-h-[120px] bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">App Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "web", icon: Globe, label: "Web" },
                        { key: "api", icon: Code, label: "API" },
                        { key: "dapp", icon: Shield, label: "DApp" },
                        { key: "ai", icon: Sparkles, label: "AI" },
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

                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Blockchain</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: "none", label: "None" },
                        { key: "ethereum", label: "Ethereum" },
                        { key: "solana", label: "Solana" },
                        { key: "polygon", label: "Polygon" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setConfig((c) => ({ ...c, blockchain: key as Blockchain }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                            config.blockchain === key
                              ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                              : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                          }`}
                        >
                          <Shield className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider">Features</label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setConfig((c) => ({ ...c, auth: !c.auth }))}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          config.auth
                            ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        <CheckCircle className={`w-4 h-4 ${config.auth ? "opacity-100" : "opacity-50"}`} />
                        Authentication
                      </button>
                      <button
                        onClick={() => setConfig((c) => ({ ...c, aiFeatures: !c.aiFeatures }))}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          config.aiFeatures
                            ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        <Sparkles className={`w-4 h-4 ${config.aiFeatures ? "opacity-100" : "opacity-50"}`} />
                        AI Features
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={generateApp}
                  disabled={!prompt.trim()}
                  className="w-full h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-lg font-semibold"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate App
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
              <h2 className="text-3xl font-bold mb-2">App Deployed!</h2>
              <p className="text-slate-400">Your app is now live and ready to use</p>
            </div>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg">
                  <code className="text-violet-400">https://{generatedApp.id}.zo.space</code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`https://${generatedApp.id}.zo.space`)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-4 justify-center">
              <Button asChild className="bg-violet-600 hover:bg-violet-500">
                <a href={`https://${generatedApp.id}.zo.space`} target="_blank" rel="noopener noreferrer">
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
