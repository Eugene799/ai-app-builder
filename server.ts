import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { callZo } from "./backend-lib/zo-api";
import { getProvider } from "./backend-lib/ai-providers";
import { Database } from "bun:sqlite";
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type Mode = "development" | "production";
const app = new Hono();

const mode: Mode = process.env.NODE_ENV === "production" ? "production" : "development";

// Middleware
app.use(cors());
app.use(logger());

// Initialize database
const db = new Database("ai-app-builder.sqlite");
db.exec(`
  CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    config TEXT,
    files TEXT,
    dependencies TEXT,
    env_vars TEXT,
    status TEXT DEFAULT 'building',
    url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// In-memory build status tracking (keeping for active sessions, but backing with SQLite)
const buildStatus = new Map<string, { logs: string[]; status: string; url?: string }>();

// Helper to add logs
function addLog(appId: string, message: string) {
  const formattedMessage = `[${new Date().toISOString()}] ${message}`;
  
  // Update in-memory
  const status = buildStatus.get(appId) || { logs: [], status: "pending" };
  status.logs.push(formattedMessage);
  buildStatus.set(appId, status);
  
  // Persist to SQLite
  db.query("INSERT INTO logs (app_id, message) VALUES (?, ?)").run(appId, formattedMessage);
  
  console.log(`[${appId}] ${message}`);
}

// API Routes

// Get all apps
app.get("/api/apps", (c) => {
  const apps = db.query("SELECT * FROM apps ORDER BY created_at DESC").all();
  return c.json({ apps });
});

// Get single app
app.get("/api/apps/:id", (c) => {
  const id = c.req.param("id");
  const app_data = db.query("SELECT * FROM apps WHERE id = ?").get(id);
  if (!app_data) return c.json({ error: "App not found" }, 404);
  return c.json({ app: app_data });
});

// Delete app
app.delete("/api/apps/:id", async (c) => {
  const id = c.req.param("id");
  
  // Remove from database
  db.query("DELETE FROM apps WHERE id = ?").run(id);
  
  // Clean up build status
  buildStatus.delete(id);
  
  // Clean up project directory
  try {
    await rm(`./projects/${id}`, { recursive: true, force: true });
  } catch {}
  
  return c.json({ success: true });
});

// Build app endpoint
app.post("/api/build", async (c) => {
  const body = await c.req.json();
  const { prompt, config: appConfig, provider = "openai", model } = body;
  
  const appId = randomUUID().slice(0, 8);
  buildStatus.set(appId, { logs: [], status: "building" });
  
  addLog(appId, `Starting AI code generation with ${provider}...`);
  addLog(appId, `App type: ${appConfig.type}`);
  addLog(appId, `Database: ${appConfig.database}`);
  if (appConfig.blockchain !== "none") addLog(appId, `Blockchain: ${appConfig.blockchain}`);
  
  try {
    let systemPrompt = `You are an expert full-stack developer and Web3 engineer.
Generate a complete ${appConfig.type} application based on the user's description.
Requirements:
- Type: ${appConfig.type} (web, api, dapp, or ai)
- Database: ${appConfig.database}
- Blockchain: ${appConfig.blockchain !== "none" ? appConfig.blockchain : "none"}
- Authentication: ${appConfig.auth ? "yes" : "no"}
- AI Features: ${appConfig.aiFeatures ? "yes" : "no"}

${appConfig.type === 'dapp' ? `
SPECIAL DAPP REQUIREMENTS:
- If Blockchain is Ethereum/Polygon: Use Solidity for smart contracts. Provide a Hardhat or Foundry project structure.
- If Blockchain is Solana: Use Anchor (Rust) for smart contracts.
- Frontend: Must use RainbowKit and Wagmi for wallet connections.
- Ensure you provide at least one sample smart contract and the corresponding frontend hooks to interact with it.
` : ''}

Generate a complete application with:
1. Main server/application file
2. Frontend components (if web app)
3. Database schema and models
4. API routes
5. Package.json with dependencies
6. README with setup instructions

Respond with a JSON object containing:
{
  "name": "App name",
  "description": "Brief description",
  "files": [
    { "path": "filename", "content": "file content as string" }
  ],
  "dependencies": ["package1", "package2"],
  "envVars": ["VAR1", "VAR2"],
  "port": 3000,
  "deployCommand": "bun run start"
}
`;

    addLog(appId, `Calling ${provider} to generate code...`);
    
    let generated;
    if (provider === "zo") {
      const aiResponse = await callZo(systemPrompt + "\n\nUser Prompt: " + prompt, {
        outputFormat: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            files: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" }
                }
              }
            },
            dependencies: { type: "array", items: { type: "string" } },
            envVars: { type: "array", items: { type: "string" } },
            port: { type: "number" },
            deployCommand: { type: "string" }
          }
        }
      });
      generated = aiResponse.output as any;
    } else {
      const aiProvider = getProvider(provider);
      generated = await aiProvider.generateResponse(systemPrompt + "\n\nUser Prompt: " + prompt, model, true);
    }
    
    addLog(appId, `Generated ${generated.files?.length || 0} files`);
    
    // Save to database
    db.query(`
      INSERT INTO apps (id, name, description, type, config, files, dependencies, env_vars, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appId,
      generated.name || "Untitled App",
      generated.description || prompt.slice(0, 200),
      appConfig.type,
      JSON.stringify(appConfig),
      JSON.stringify(generated.files || []),
      JSON.stringify(generated.dependencies || []),
      JSON.stringify(generated.envVars || []),
      "ready"
    );
    
    // Write files to disk
    const projectDir = `./projects/${appId}`;
    await mkdir(projectDir, { recursive: true });
    
    for (const file of generated.files || []) {
      const filePath = `${projectDir}/${file.path}`;
      const dir = filePath.split("/").slice(0, -1).join("/");
      await mkdir(dir, { recursive: true });
      await writeFile(filePath, file.content);
    }
    
    // Create package.json if not exists
    if (!generated.files?.some((f: any) => f.path === "package.json")) {
      const pkg = {
        name: generated.name?.toLowerCase().replace(/\s+/g, "-") || "ai-app",
        version: "1.0.0",
        scripts: {
          start: generated.deployCommand || "bun run index.ts",
          dev: "bun --hot run index.ts"
        },
        dependencies: generated.dependencies?.reduce((acc: any, dep: string) => {
          acc[dep] = "latest";
          return acc;
        }, {})
      };
      await writeFile(`${projectDir}/package.json`, JSON.stringify(pkg, null, 2));
    }
    
    addLog(appId, "App files written to disk");
    buildStatus.get(appId)!.status = "ready";
    
    return c.json({
      app: {
        id: appId,
        name: generated.name || "Untitled App",
        description: generated.description || prompt.slice(0, 200),
        files: generated.files || [],
        dependencies: generated.dependencies || [],
        envVars: generated.envVars || [],
        port: generated.port || 3000,
        deployCommand: generated.deployCommand || "bun run start"
      }
    });
    
  } catch (error) {
    console.error("Build error:", error);
    addLog(appId, `Error: ${error}`);
    buildStatus.get(appId)!.status = "failed";
    
    db.query("UPDATE apps SET status = ? WHERE id = ?").run("failed", appId);
    
    return c.json({ error: "Failed to generate app", details: String(error) }, 500);
  }
});

// Deploy app endpoint
app.post("/api/deploy", async (c) => {
  const body = await c.req.json();
  const { appId } = body;
  
  const app_data = db.query("SELECT * FROM apps WHERE id = ?").get(appId);
  if (!app_data) return c.json({ error: "App not found" }, 404);
  
  buildStatus.set(appId, { logs: [], status: "deploying" });
  addLog(appId, "Starting deployment...");
  
  try {
    const projectDir = `./projects/${appId}`;
    
    // Check if project exists
    try {
      await readdir(projectDir);
    } catch {
      return c.json({ error: "Project files not found" }, 404);
    }
    
    addLog(appId, "Installing dependencies...");
    
    // Install dependencies
    const installProc = Bun.spawn({
      cmd: ["bun", "install"],
      cwd: projectDir,
      stdout: "pipe",
      stderr: "pipe"
    });
    
    const installOutput = await new Response(installProc.stdout).text();
    const installError = await new Response(installProc.stderr).text();
    
    if (installOutput) addLog(appId, installOutput.slice(0, 500));
    if (installError) addLog(appId, `Install warnings: ${installError.slice(0, 500)}`);
    
    addLog(appId, "Dependencies installed");
    
    // For now, simulate deployment by creating a zo.space route
    // In production, this would register a user service
    const deployUrl = `https://${appId}.zo.space`;
    
    addLog(appId, `App deployed to ${deployUrl}`);
    
    // Update database
    db.query("UPDATE apps SET status = ?, url = ? WHERE id = ?").run("deployed", deployUrl, appId);
    
    buildStatus.get(appId)!.status = "deployed";
    buildStatus.get(appId)!.url = deployUrl;
    
    return c.json({ 
      success: true, 
      url: deployUrl,
      appId 
    });
    
  } catch (error) {
    console.error("Deploy error:", error);
    addLog(appId, `Error: ${error}`);
    buildStatus.get(appId)!.status = "failed";
    
    db.query("UPDATE apps SET status = ? WHERE id = ?").run("failed", appId);
    
    return c.json({ error: "Deployment failed", details: String(error) }, 500);
  }
});

// Get deployment status
app.get("/api/status/:id", (c) => {
  const id = c.req.param("id");
  const app_data = db.query("SELECT * FROM apps WHERE id = ?").get(id);
  
  if (!app_data) return c.json({ error: "App not found" }, 404);
  
  let status = buildStatus.get(id);
  
  if (!status) {
    // If not in memory, fetch logs from database
    const logs = db.query("SELECT message FROM logs WHERE app_id = ? ORDER BY timestamp ASC").all(id) as { message: string }[];
    status = {
      logs: logs.map(l => l.message),
      status: (app_data as any).status,
      url: (app_data as any).url
    };
  }
  
  return c.json({
    id,
    status: status.status,
    logs: status.logs,
    url: status.url || (app_data as any).url
  });
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", mode }));

// Development vs Production setup
if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();
    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();
    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) return new Response(file);
    }
    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);
    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
      }
      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, { headers: { "Cache-Control": "no-store, must-revalidate" } });
        }
      }
      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }
      if (result) {
        return new Response(result.code, {
          headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store, must-revalidate" },
        });
      }
      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}
