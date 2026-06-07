<div align="center">

# Verify Hydra

**Open source Discord verification system built for scale.**

No callback servers. No webhook dependencies. Just a bot, an edge worker, and a database.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue.svg)](https://discord.js.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com)

</div>

---

## What is this?

Verify Hydra is a decentralized Discord verification microservice. It protects your server from alt accounts, VPNs, and bots using a pull-based architecture where the Discord bot polls a database for verification status — no Express server, no callback URLs, no port forwarding.

**You can name it whatever you want.** Fork it, rename it, brand it as your own. The code is yours.

## How it works

```
User clicks "Verify My Account"
        |
        v
Discord Bot generates a token
and sends it to the Worker
        |
        v
Cloudflare Worker creates a
verification session in Supabase
        |
        v
User completes captcha on the
edge-hosted verification page
        |
        v
Worker updates session status
to "verified" in the database
        |
        v
Bot polls Supabase every 3 seconds,
detects the change, assigns the role
```

No incoming HTTP connections. No firewall rules. The bot pulls data out — it never receives data in.

## Features

| Feature | Description |
|---------|-------------|
| **Dual-Layer Captcha** | hCaptcha + SVG image captcha for maximum security |
| **Pull-Based Architecture** | Bot polls database, no callback server needed |
| **Single-File Worker** | Entire backend in one `index.js` — deploy with one command |
| **Edge Verification** | Captcha page hosted on Cloudflare's global edge network |
| **Matte Black/White UI** | Clean, professional verification page with dark and light themes |
| **Role Hierarchy Safety** | Bot checks role positions before assigning — never breaks your hierarchy |
| **Token Expiry** | Verification links expire in 5 minutes for security |
| **Multi-Server** | One bot instance, unlimited servers |
| **Zero Dependencies** | Worker uses only native `fetch` — no npm packages |
| **Auto-Quarantine** | New members automatically get the unverified role on join |
| **Slash Commands** | `/panel` and `/setup` for quick configuration |
| **Graceful Fallback** | Falls back to system channel if control channel creation fails |

## Project Structure

```
verify-hydra/
├── bot/                    # Discord bot (Node.js)
│   ├── src/
│   │   ├── index.js        # Entry point
│   │   ├── deploy-commands.js    # Register slash commands
│   │   ├── events/
│   │   │   ├── guildCreate.js        # Control panel on bot join
│   │   │   ├── guildMemberAdd.js     # Auto-assign unverified role
│   │   │   └── interactionCreate.js  # All interactions + poller
│   │   └── utils/
│   │       └── supabase.js  # Database queries
│   ├── .env.example         # Environment template
│   └── package.json
├── worker/                 # Cloudflare Worker (single file)
│   ├── index.js            # Everything: API + frontend + captcha
│   ├── wrangler.example.toml
│   └── package.json
├── database/
│   └── schema.sql          # Supabase PostgreSQL schema
├── LICENSE                 # MIT
└── README.md
```

## Prerequisites

| Service | Purpose | Link |
|---------|---------|------|
| **Discord** | Bot token + client ID | [Developer Portal](https://discord.com/developers/applications) |
| **Cloudflare** | Edge worker hosting | [Dashboard](https://dash.cloudflare.com) |
| **Supabase** | PostgreSQL database | [Dashboard](https://supabase.com/dashboard) |
| **hCaptcha** | Captcha verification (optional) | [hCaptcha.com](https://www.hcaptcha.com) |
| **Node.js 18+** | Running the bot locally | [nodejs.org](https://nodejs.org) |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/verify-hydra.git
cd verify-hydra
npm install
```

### 2. Database

Open your Supabase project, go to the SQL Editor, and run:

```sql
-- Paste the contents of database/schema.sql here
```

This creates two tables:
- `guild_settings` — per-server configuration
- `active_sessions` — verification tokens and status

### 3. Cloudflare Worker

```bash
cd worker
npm install

# Login to Cloudflare
npx wrangler login

# Set secrets (you'll be prompted to paste each value)
npx wrangler secret put INTERNAL_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put HCAPTCHA_SECRET
```

Edit `wrangler.toml` with your public values:

```toml
name = "your-worker-name"
main = "index.js"
compatibility_date = "2026-06-07"

[vars]
SUPABASE_URL = "https://your-project.supabase.co"
HCAPTCHA_SITEKEY = "your-hcaptcha-sitekey"
FRONTEND_BASE_URL = "https://your-worker.workers.dev"
```

Deploy:

```bash
npx wrangler deploy
```

Your worker URL will be something like `https://your-worker.your-subdomain.workers.dev`.

### 4. Discord Bot

```bash
cd ../bot
cp .env.example .env
```

Fill in `bot/.env`:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
HYDRA_WORKER_URL=https://your-worker.workers.dev
INTERNAL_API_KEY=same_key_you_set_in_worker
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Install dependencies and register slash commands:

```bash
npm install
node src/deploy-commands.js
npm start
```

### 5. Server Configuration

When the bot joins your server, it tries to create a `verify-hydra-control` channel with a configuration panel. If it can't create the channel (missing permissions), it sends the panel to the system channel instead.

**Option A: Automatic (bot join)**
- Bot creates the control panel channel automatically
- Select: verification channel, verified role, quarantine role, security level
- Click **Save and Initialize**

**Option B: `/panel` command**
- Type `/panel` in any channel (Admin only)
- Same configuration panel as automatic setup

**Option C: `/setup` command (fastest)**
- Type directly in any channel:

```
/setup channel:#verify verified_role:@Verified quarantine_role:@Unverified security:dual-layer
```

This configures everything in one command — no menus needed.

### Auto-Quarantine

New members automatically receive the unverified role when they join. This requires:
- The unverified role to be set in the configuration
- The bot's role to be above the unverified role in the hierarchy

## Slash Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/panel` | Opens the configuration panel | Administrator |
| `/setup` | Quick setup with channel and roles | Administrator |

### `/setup` Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `channel` | Channel | Yes | Where the verification prompt appears |
| `verified_role` | Role | Yes | Role assigned after verification |
| `quarantine_role` | Role | Yes | Role for new unverified members |
| `security` | Choice | Yes | `image-captcha`, `hcaptcha`, or `dual-layer` |

## Security Levels

| Level | What happens |
|-------|-------------|
| `image-captcha` | User solves a text-based SVG captcha |
| `hcaptcha` | User solves an hCaptcha widget |
| `dual-layer` | Both hCaptcha AND image captcha (recommended) |

## Environment Variables Reference

### Bot (`bot/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application client ID |
| `HYDRA_WORKER_URL` | Yes | Deployed Cloudflare Worker URL |
| `INTERNAL_API_KEY` | Yes | Shared secret (min 32 chars, must match worker) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |

### Worker (Cloudflare)

| Variable | Type | Description |
|----------|------|-------------|
| `SUPABASE_URL` | Var | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase service role key |
| `INTERNAL_API_KEY` | Secret | Shared secret (must match bot) |
| `HCAPTCHA_SITEKEY` | Var | hCaptcha site key (public) |
| `HCAPTCHA_SECRET` | Secret | hCaptcha secret key |
| `FRONTEND_BASE_URL` | Var | Worker public URL |

## FAQ

**Q: Can I use this without hCaptcha?**
Yes. Set the security level to `image-captcha` and don't configure `HCAPTCHA_SECRET`. The worker will use only the built-in SVG captcha.

**Q: Can I customize the verification page?**
Yes. The entire frontend is embedded in `worker/index.js`. Edit the CSS and HTML directly.

**Q: Does this work with multiple servers?**
Yes. One bot instance can serve unlimited servers. Each server has its own configuration stored in the database.

**Q: Why pull-based instead of webhooks?**
No need to expose your bot to incoming HTTP traffic. No firewall configuration, no port forwarding, no callback URL management. The bot polls the database — simple and secure.

**Q: Bot can't create the control channel?**
Grant the bot **Administrator** permission and re-invite. Or use `/panel` or `/setup` as a fallback.

**Q: How do I configure quickly?**
Use `/setup #channel @verified-role @quarantine-role dual-layer` — one command, done.

## Contributing

Contributions are welcome. Open an issue or submit a pull request.

## License

[MIT](LICENSE) — use it however you want.
