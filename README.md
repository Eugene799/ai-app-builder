# AutoAI - AI App & Automation Builder

AutoAI is a full-stack AI-powered application and automation builder. It allows you to describe an app idea or a workflow, and it generates a complete, ready-to-deploy codebase.

## Key Features

- **AI-Powered Generation**: Describe your app or automation in natural language.
- **Full-Stack Automations**: Build workflows that connect Slack, GitHub, Discord, Twitter, and Notion.
- **Web 2.0 Connectors**: Securely link your external accounts via OAuth or API keys.
- **Stripe Credit System**: Paid-only credit system for generating apps.
- **Supabase Integration**: Powered by Supabase for Auth and Database.
- **Instant Deployment**: Deploys to `.autoai.space` subdomains.
- **Code Review**: Integrated syntax highlighting and ZIP downloads.

## Tech Stack

- **Backend**: Hono (Bun)
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Database & Auth**: Supabase
- **Payments**: Stripe
- **AI**: OpenAI, Groq, OpenRouter, Gemini

## Getting Started

1. Clone the repository.
2. Install dependencies: `bun install`
3. Set up your `.env` file with Supabase, Stripe, and AI provider keys.
4. Run development server: `bun run dev`

## Deployment

The application is designed to be deployed to any platform supporting Bun/Node.js. Subdomain deployment for generated apps is simulated in the current version.
