<p align="center">
  <img src="assets/icon.svg" width="120" alt="Verify Hydra" style="border-radius:24px;">
</p>

<h1 align="center">Verify Hydra</h1>

<p align="center">
  Open-source Discord verification system.<br>
  Decentralized architecture. Zero callback servers. One edge worker.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-27272a?style=flat-square&labelColor=0f0f0f" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/node-18+-27272a?style=flat-square&labelColor=0f0f0f" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/discord.js-v14-27272a?style=flat-square&labelColor=0f0f0f" alt="Discord.js v14">
  <img src="https://img.shields.io/badge/cloudflare-workers-27272a?style=flat-square&labelColor=0f0f0f" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/supabase-postgresql-27272a?style=flat-square&labelColor=0f0f0f" alt="Supabase">
</p>

---

## What is this?

Verify Hydra protects Discord servers from alt accounts, VPNs, and bots using a **pull-based** architecture. The Discord bot polls a Supabase database for verification status — no Express server, no callback URLs, no port forwarding.

Three components. No incoming HTTP traffic. Simple to deploy, simple to maintain.

## Architecture

```
Discord Bot  ←— polls —→  Supabase  ←— writes —→  Cloudflare Worker
     │                         │                         │
     │  role assignment        │  token storage          │  captcha page
     │  every 3s               │  session status         │  edge-hosted
     ▼                         ▼                         ▼
   Guild                    Database                  User Browser
```

**How a verification flows:**

| Step | Component | Action |
|------|-----------|--------|
| 1 | Bot | Generates token, sends to worker |
| 2 | Worker | Creates session in Supabase |
| 3 | User | Opens verification link, solves captcha |
| 4 | Worker | Marks session as verified |
| 5 | Bot | Detects change via poll, assigns role |

The bot never receives incoming connections. It pulls data out — zero firewall rules needed.

## Features

| | Feature | Detail |
|---|---------|--------|
| **Dual-Layer Captcha** | hCaptcha + SVG image captcha for maximum security |
| **Pull Architecture** | Bot polls database, no callback server required |
| **Single-File Worker** | Entire backend in one `index.js` — deploy with one command |
| **Edge Verification** | Captcha page served from Cloudflare's global edge |
| **Obsidian UI** | Clean dark/light verification pages, Components V2 embeds |
| **Role Safety** | Bot checks hierarchy before assigning — never breaks permissions |
| **Token Expiry** | Verification links expire in 5 minutes |
| **Multi-Server** | One bot instance, unlimited servers |
| **Zero Dependencies** | Worker uses only native `fetch` — no npm packages |
| **Auto-Quarantine** | New members get unverified role on join automatically |
| **Slash Commands** | `/panel` and `/setup` for instant configuration |

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Bot | Node.js 18+ / Discord.js v14 | Discord integration, role management |
| Worker | Cloudflare Workers | Edge-hosted verification page |
| Database | Supabase (PostgreSQL) | Session storage, guild config |
| Captcha | hCaptcha + SVG | Dual-layer human verification |

## Quick Start

```bash
git clone https://github.com/your-username/verify-hydra.git
cd verify-hydra
npm install
```

### 1. Database

Run `database/schema.sql` in your Supabase SQL Editor. Creates two tables:
- `guild_settings` — per-server configuration
- `active_sessions` — verification tokens and status

### 2. Worker

```bash
cd worker
npx wrangler login
npx wrangler secret put INTERNAL_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put HCAPTCHA_SECRET
```

Edit `wrangler.toml`:

```toml
name = "your-worker"
main = "index.js"
compatibility_date = "2026-06-07"

[vars]
SUPABASE_URL = "https://your-project.supabase.co"
HCAPTCHA_SITEKEY = "your-sitekey"
FRONTEND_BASE_URL = "https://your-worker.workers.dev"
```

```bash
npx wrangler deploy
```

### 3. Bot

```bash
cd ../bot
cp .env.example .env
```

Fill in `bot/.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
HYDRA_WORKER_URL=https://your-worker.workers.dev
INTERNAL_API_KEY=same_key_as_worker
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

```bash
node src/deploy-commands.js
npm start
```

### 4. Configure Servers

**Automatic** — bot creates a control panel when it joins a server.

**Manual** — run in any channel:

```
/setup channel:#verify verified_role:@Verified quarantine_role:@Unverified security:dual-layer
```

## Security Levels

| Level | Behavior |
|-------|----------|
| `image-captcha` | SVG text captcha only |
| `hcaptcha` | hCaptcha widget only |
| `dual-layer` | hCaptcha + SVG captcha (recommended) |

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/panel` | Opens configuration panel | Administrator |
| `/setup` | Quick setup with all options | Administrator |

## Project Structure

```
verify-hydra/
├── bot/
│   └── src/
│       ├── index.js                  # Entry point
│       ├── deploy-commands.js        # Slash command registration
│       ├── events/
│       │   ├── guildCreate.js        # Control panel on bot join
│       │   ├── guildMemberAdd.js     # Auto-assign unverified role
│       │   └── interactionCreate.js  # All interactions + poller
│       └── utils/
│           └── supabase.js           # Database queries
├── worker/
│   └── index.js                      # Everything: API + frontend + captcha
├── database/
│   └── schema.sql                    # PostgreSQL schema
└── README.md
```

## Environment Variables

### Bot

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Application client ID |
| `HYDRA_WORKER_URL` | Yes | Deployed worker URL |
| `INTERNAL_API_KEY` | Yes | Shared secret (min 32 chars) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |

### Worker

| Variable | Type | Description |
|----------|------|-------------|
| `SUPABASE_URL` | Var | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase service role key |
| `INTERNAL_API_KEY` | Secret | Shared secret (must match bot) |
| `HCAPTCHA_SITEKEY` | Var | hCaptcha site key |
| `HCAPTCHA_SECRET` | Secret | hCaptcha secret key |
| `FRONTEND_BASE_URL` | Var | Worker public URL |

## FAQ

**Can I skip hCaptcha?**
Yes. Set security to `image-captcha` and don't set `HCAPTCHA_SECRET`.

**Can I customize the pages?**
Yes. The entire frontend lives in `worker/index.js` — edit the CSS and HTML directly.

**Multiple servers?**
One bot instance serves unlimited servers. Each has its own database config.

**Why pull-based instead of webhooks?**
No incoming HTTP traffic. No firewall rules. No port forwarding. The bot polls the database — simple and secure.

## License

[MIT](LICENSE) — use it however you want.
