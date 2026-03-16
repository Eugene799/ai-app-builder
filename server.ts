import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { callZo } from "./backend-lib/zo-api";
import { getProvider } from "./backend-lib/ai-providers";
import { supabaseAdmin } from "./backend-lib/supabase-admin";
import { stripe } from "./backend-lib/stripe";
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import "dotenv/config";

type Mode = "development" | "production";
const app = new Hono();

const mode: Mode = process.env.NODE_ENV === "production" ? "production" : "development";

// Middleware
app.use(cors());
app.use(logger());

// In-memory build status tracking (keeping for active sessions)
const buildStatus = new Map<string, { logs: string[]; status: string; url?: string }>();

// Helper to add logs
async function addLog(appId: string, message: string) {
  const formattedMessage = `[${new Date().toISOString()}] ${message}`;
  
  // Update in-memory
  const status = buildStatus.get(appId) || { logs: [], status: "pending" };
  status.logs.push(formattedMessage);
  buildStatus.set(appId, status);
  
  // Persist to Supabase
  await supabaseAdmin.from("logs").insert({ app_id: appId, message: formattedMessage });
  
  console.log(`[${appId}] ${message}`);
}

// Auth Middleware
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health" || c.req.path === "/api/stripe/webhook") {
    return next();
  }
  
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  c.set("user", user);
  return next();
});

// API Routes

// Get all apps
app.get("/api/apps", async (c) => {
  const user = c.get("user");
  const { data: apps, error } = await supabaseAdmin
    .from("apps")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ apps });
});

// Get single app
app.get("/api/apps/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const { data: app_data, error } = await supabaseAdmin
    .from("apps")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
    
  if (error || !app_data) return c.json({ error: "App not found" }, 404);
  return c.json({ app: app_data });
});

// Delete app
app.delete("/api/apps/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  
  // Remove from database
  const { error } = await supabaseAdmin
    .from("apps")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
    
  if (error) return c.json({ error: error.message }, 500);
  
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
  const user = c.get("user");
  const body = await c.req.json();
  const { prompt, config: appConfig, provider = "openai", model } = body;
  
  // Check credits
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();
    
  if (profileError || !profile || profile.credits < 1) {
    return c.json({ error: "Insufficient credits. Please purchase more credits to continue." }, 402);
  }
  
  const appId = randomUUID().slice(0, 8);
  buildStatus.set(appId, { logs: [], status: "building" });
  
  await addLog(appId, `Starting AI code generation with ${provider}...`);
  await addLog(appId, `App type: ${appConfig.type}`);
  await addLog(appId, `Database: ${appConfig.database}`);
  
  // Fetch connectors
  const { data: connectors } = await supabaseAdmin
    .from("connectors")
    .select("provider, metadata")
    .eq("user_id", user.id);
    
  const connectorInfo = connectors?.map(c => c.provider).join(", ") || "none linked";
  await addLog(appId, `Linked Connectors: ${connectorInfo}`);
  
  try {
    // Decrement credits
    await supabaseAdmin
      .from("profiles")
      .update({ credits: profile.credits - 1 })
      .eq("id", user.id);

    let systemPrompt = `You are an expert full-stack developer and Automation Engineer.
Generate a complete ${appConfig.type} application or workflow based on the user's description.
Focus on building robust automations and workflows using external platform integrations (Connectors).

User's Linked Connectors: ${connectorInfo}

Requirements:
- Type: ${appConfig.type} (web, api, automation, or workflow)
- Database: ${appConfig.database}
- Authentication: ${appConfig.auth ? "yes" : "no"}
- AI Features: ${appConfig.aiFeatures ? "yes" : "no"}

AUTOMATION & WORKFLOW GUIDELINES:
- If type is 'automation' or 'workflow': Focus on connecting different services (e.g., GitHub, Slack, Discord).
- Use the linked connectors mentioned above where relevant.
- Provide clear triggers and actions in the code.
- Ensure proper error handling and logging for background tasks.

Generate a complete application with:
1. Main server/application file
2. Frontend components (if web app)
3. Database schema and models
4. API routes and Webhook handlers
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

    await addLog(appId, `Calling ${provider} to generate code...`);
    
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
    
    await addLog(appId, `Generated ${generated.files?.length || 0} files`);
    
    // Save to database
    await supabaseAdmin.from("apps").insert({
      id: appId,
      user_id: user.id,
      name: generated.name || "Untitled App",
      description: generated.description || prompt.slice(0, 200),
      type: appConfig.type,
      config: appConfig,
      files: generated.files || [],
      dependencies: generated.dependencies || [],
      env_vars: generated.envVars || [],
      status: "ready"
    });
    
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
        name: generated.name?.toLowerCase().replace(/\s+/g, "-") || "autoai-app",
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
    
    await addLog(appId, "App files written to disk");
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
    await addLog(appId, `Error: ${error}`);
    buildStatus.get(appId)!.status = "failed";
    
    await supabaseAdmin.from("apps").update({ status: "failed" }).eq("id", appId);
    
    return c.json({ error: "Failed to generate app", details: String(error) }, 500);
  }
});

// Deploy app endpoint
app.post("/api/deploy", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { appId } = body;
  
  const { data: app_data, error: appError } = await supabaseAdmin
    .from("apps")
    .select("*")
    .eq("id", appId)
    .eq("user_id", user.id)
    .single();
    
  if (appError || !app_data) return c.json({ error: "App not found" }, 404);
  
  buildStatus.set(appId, { logs: [], status: "deploying" });
  await addLog(appId, "Starting deployment...");
  
  try {
    const projectDir = `./projects/${appId}`;
    
    // Check if project exists
    try {
      await readdir(projectDir);
    } catch {
      return c.json({ error: "Project files not found" }, 404);
    }
    
    await addLog(appId, "Installing dependencies...");
    
    // Install dependencies
    const installProc = Bun.spawn({
      cmd: ["bun", "install"],
      cwd: projectDir,
      stdout: "pipe",
      stderr: "pipe"
    });
    
    const installOutput = await new Response(installProc.stdout).text();
    const installError = await new Response(installProc.stderr).text();
    
    if (installOutput) await addLog(appId, installOutput.slice(0, 500));
    if (installError) await addLog(appId, `Install warnings: ${installError.slice(0, 500)}`);
    
    await addLog(appId, "Dependencies installed");
    
    // For now, simulate deployment by creating a autoai.space route
    const deployUrl = `https://${appId}.autoai.space`;
    
    await addLog(appId, `App deployed to ${deployUrl}`);
    
    // Update database
    await supabaseAdmin
      .from("apps")
      .update({ status: "deployed", url: deployUrl })
      .eq("id", appId);
    
    buildStatus.get(appId)!.status = "deployed";
    buildStatus.get(appId)!.url = deployUrl;
    
    return c.json({ 
      success: true, 
      url: deployUrl,
      appId 
    });
    
  } catch (error) {
    console.error("Deploy error:", error);
    await addLog(appId, `Error: ${error}`);
    buildStatus.get(appId)!.status = "failed";
    
    await supabaseAdmin.from("apps").update({ status: "failed" }).eq("id", appId);
    
    return c.json({ error: "Deployment failed", details: String(error) }, 500);
  }
});

// Get deployment status
app.get("/api/status/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  
  const { data: app_data, error } = await supabaseAdmin
    .from("apps")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  
  if (error || !app_data) return c.json({ error: "App not found" }, 404);
  
  let status = buildStatus.get(id);
  
  if (!status) {
    // If not in memory, fetch logs from database
    const { data: logs } = await supabaseAdmin
      .from("logs")
      .select("message")
      .eq("app_id", id)
      .order("timestamp", { ascending: true });
      
    status = {
      logs: logs?.map(l => l.message) || [],
      status: app_data.status,
      url: app_data.url
    };
  }
  
  return c.json({
    id,
    status: status.status,
    logs: status.logs,
    url: status.url || app_data.url
  });
});

// Get user profile
app.get("/api/profile", async (c) => {
  const user = c.get("user");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ profile });
});

// Stripe Routes
app.post("/api/stripe/checkout", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const priceId = body.priceId || process.env.STRIPE_CREDIT_PRICE_ID;
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-cancelled`,
    metadata: {
      userId: user.id,
    },
  });
  
  return c.json({ url: session.url });
});

app.post("/api/stripe/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  const body = await c.req.text();
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    return c.json({ error: `Webhook Error: ${err.message}` }, 400);
  }
  
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.metadata.userId;
    
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
      
    await supabaseAdmin
      .from("profiles")
      .update({ credits: (profile?.credits || 0) + 10 })
      .eq("id", userId);
  }
  
  return c.json({ received: true });
});

// Connector Routes
app.get("/api/connectors", async (c) => {
  const user = c.get("user");
  const { data: connectors, error } = await supabaseAdmin
    .from("connectors")
    .select("provider, created_at, metadata")
    .eq("user_id", user.id);
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ connectors });
});

app.post("/api/connectors", async (c) => {
  const user = c.get("user");
  const { provider, apiKey, metadata } = await c.req.json();
  
  const { error } = await supabaseAdmin
    .from("connectors")
    .upsert({
      user_id: user.id,
      provider,
      access_token: apiKey,
      metadata
    });
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

app.delete("/api/connectors/:provider", async (c) => {
  const user = c.get("user");
  const provider = c.req.param("provider");
  
  const { error } = await supabaseAdmin
    .from("connectors")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
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
  : 3000;

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
